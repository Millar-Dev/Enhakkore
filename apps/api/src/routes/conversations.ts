import { Router } from 'express';
import { z } from 'zod';
import { ApiError, route } from '../lib/http';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { notifyMany } from '../services/notifications';
import { broadcastMessage } from '../realtime/socket';
import { toConversationMember, toMessage, toTripDate } from '../serializers';

export const conversationsRouter = Router();

conversationsRouter.use(requireAuth);

/**
 * Resolves the viewer's relationship to a conversation.
 *
 * This is the single access gate for trip groups. Membership comes from a
 * confirmed booking or from organizing the trip; admins get read access for
 * moderation but are not implicit posters. Every route below goes through it.
 */
async function authorize(conversationId: string, viewer: { id: string; role: string; organizerId: string | null }) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      departure: { include: { trip: { include: { organizer: true, destination: true } } } },
      members: { include: { user: true } },
    },
  });

  if (!conversation) throw ApiError.notFound('That trip group does not exist.');

  const organizerUserId = conversation.departure.trip.organizer.userId;
  const isOrganizer = viewer.id === organizerUserId;
  const isMember = conversation.members.some((member) => member.userId === viewer.id);
  const isAdmin = viewer.role === 'ADMIN';

  if (!isMember && !isOrganizer && !isAdmin) {
    // Deliberately a 404: someone without a booking should not learn that this
    // group exists at all.
    throw ApiError.notFound('That trip group does not exist.');
  }

  return { conversation, isOrganizer, isMember, isAdmin, organizerUserId };
}

/** Every trip group the viewer belongs to. */
conversationsRouter.get(
  '/',
  route(async (req, res) => {
    const viewer = req.auth!;

    const memberships = await prisma.conversationMember.findMany({
      where: { userId: viewer.id },
      include: {
        conversation: {
          include: {
            departure: { include: { trip: { include: { destination: true, organizer: true } } } },
            _count: { select: { members: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { author: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const items = await Promise.all(
      memberships.map(async (membership) => {
        const { conversation } = membership;
        const trip = conversation.departure.trip;
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conversation.id,
            createdAt: membership.lastReadAt ? { gt: membership.lastReadAt } : undefined,
            userId: { not: viewer.id },
          },
        });

        return {
          id: conversation.id,
          title: conversation.title,
          tripId: trip.id,
          tripSlug: trip.slug,
          departure: toTripDate(conversation.departure, trip.currency, trip.basePrice),
          heroImage: trip.heroImage,
          memberCount: conversation._count.members,
          unreadCount,
          lastMessage: conversation.messages[0]
            ? toMessage(conversation.messages[0], trip.organizer.userId)
            : null,
        };
      }),
    );

    // Most recent conversation first, by last message.
    items.sort((a, b) => {
      const at = a.lastMessage?.createdAt ?? '';
      const bt = b.lastMessage?.createdAt ?? '';
      return bt.localeCompare(at);
    });

    res.json({ items });
  }),
);

conversationsRouter.get(
  '/:id',
  route(async (req, res) => {
    const viewer = req.auth!;
    const { conversation, isOrganizer, isMember, isAdmin, organizerUserId } = await authorize(
      req.params.id,
      viewer,
    );

    const trip = conversation.departure.trip;
    const pinned = await prisma.message.findMany({
      where: { conversationId: conversation.id, pinned: true },
      include: { author: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      id: conversation.id,
      title: conversation.title,
      tripId: trip.id,
      tripSlug: trip.slug,
      departure: toTripDate(conversation.departure, trip.currency, trip.basePrice),
      heroImage: trip.heroImage,
      memberCount: conversation.members.length,
      unreadCount: 0,
      lastMessage: null,
      members: conversation.members.map(toConversationMember),
      pinned: pinned.map((message) => toMessage(message, organizerUserId)),
      // Admins can read for moderation but do not post into traveller groups.
      canPost: isMember || isOrganizer,
      viewerIsOrganizer: isOrganizer,
      viewerIsAdmin: isAdmin,
    });
  }),
);

conversationsRouter.get(
  '/:id/messages',
  route(async (req, res) => {
    const viewer = req.auth!;
    const { conversation, organizerUserId } = await authorize(req.params.id, viewer);

    const take = Math.min(100, Number(req.query.limit ?? 50) || 50);
    const before = typeof req.query.before === 'string' ? new Date(req.query.before) : undefined;

    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      include: { author: true },
      orderBy: { createdAt: 'desc' },
      take,
    });

    // Mark read on fetch — the unread badge should clear when the group opens.
    await prisma.conversationMember.updateMany({
      where: { conversationId: conversation.id, userId: viewer.id },
      data: { lastReadAt: new Date() },
    });

    res.json({
      items: messages.reverse().map((message) => toMessage(message, organizerUserId)),
      hasMore: messages.length === take,
    });
  }),
);

const postSchema = z.object({
  body: z.string().trim().min(1, 'Write a message.').max(2000),
  kind: z.enum(['TEXT', 'ANNOUNCEMENT', 'IMAGE']).default('TEXT'),
  attachments: z.array(z.string().url()).max(6).default([]),
});

conversationsRouter.post(
  '/:id/messages',
  route(async (req, res) => {
    const viewer = req.auth!;
    const input = postSchema.parse(req.body);
    const { conversation, isOrganizer, isMember, organizerUserId } = await authorize(req.params.id, viewer);

    if (!isMember && !isOrganizer) {
      throw ApiError.forbidden('Only travellers on this departure can post here.');
    }
    // Announcements carry organizer authority, so only the organizer may send one.
    if (input.kind === 'ANNOUNCEMENT' && !isOrganizer) {
      throw ApiError.forbidden('Only the organizer can post announcements.');
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        userId: viewer.id,
        body: input.body,
        kind: input.kind,
        attachments: JSON.stringify(input.attachments),
      },
      include: { author: true },
    });

    const dto = toMessage(message, organizerUserId);
    broadcastMessage(conversation.id, dto);

    if (input.kind === 'ANNOUNCEMENT') {
      const recipients = conversation.members
        .map((member) => member.userId)
        .filter((userId) => userId !== viewer.id);
      await notifyMany(recipients, {
        type: 'ANNOUNCEMENT',
        title: `Announcement · ${conversation.title}`,
        body: input.body.slice(0, 160),
        link: `/trips/groups/${conversation.id}`,
      });
    }

    res.status(201).json(dto);
  }),
);

conversationsRouter.post(
  '/:id/messages/:messageId/pin',
  route(async (req, res) => {
    const viewer = req.auth!;
    const { conversation, isOrganizer, organizerUserId } = await authorize(req.params.id, viewer);

    if (!isOrganizer && viewer.role !== 'ADMIN') {
      throw ApiError.forbidden('Only the organizer can pin messages.');
    }

    const existing = await prisma.message.findFirst({
      where: { id: req.params.messageId, conversationId: conversation.id },
    });
    if (!existing) throw ApiError.notFound('That message does not exist.');

    const message = await prisma.message.update({
      where: { id: existing.id },
      data: { pinned: !existing.pinned },
      include: { author: true },
    });

    res.json(toMessage(message, organizerUserId));
  }),
);

conversationsRouter.post(
  '/:id/read',
  route(async (req, res) => {
    const viewer = req.auth!;
    await authorize(req.params.id, viewer);
    await prisma.conversationMember.updateMany({
      where: { conversationId: req.params.id, userId: viewer.id },
      data: { lastReadAt: new Date() },
    });
    res.json({ ok: true });
  }),
);
