import { hasPermission } from '@enhakkore/shared';
import { Router } from 'express';
import { z } from 'zod';
import { ApiError, route } from '../lib/http';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { notifyMany } from '../services/notifications';
import { audit } from '../services/audit';
import { parseList, parseObjects } from '../lib/json';
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
async function authorize(
  conversationId: string,
  viewer: { id: string; role: string; organizerId: string | null; permissions?: string[] },
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      departure: { include: { trip: { include: { organizer: true, destination: true, itinerary: { orderBy: { dayNumber: 'asc' } } } } } },
      members: { include: { user: true } },
    },
  });

  if (!conversation) throw ApiError.notFound('That trip group does not exist.');

  const organizerUserId = conversation.departure.trip.organizer.userId;
  // Enhakkore's own trips are run by the team: whoever may edit trips speaks
  // for the organiser in those groups.
  const isEnhakkoreTrip = conversation.departure.trip.organizer.slug === 'enhakkore';
  const isOrganizer =
    viewer.id === organizerUserId || (isEnhakkoreTrip && hasPermission(viewer.permissions ?? [], 'trips.edit'));
  const isMember = conversation.members.some((member) => member.userId === viewer.id);
  const isAdmin = viewer.role === 'ADMIN' || hasPermission(viewer.permissions ?? [], 'trips.view');

  if (!isMember && !isOrganizer && !isAdmin) {
    // Deliberately a 404: someone without a booking should not learn that this
    // group exists at all.
    throw ApiError.notFound('That trip group does not exist.');
  }

  const canModerate = isOrganizer || viewer.role === 'ADMIN' || hasPermission(viewer.permissions ?? [], 'trips.edit');
  return { conversation, isOrganizer, isMember, isAdmin, canModerate, organizerUserId, readOnly: isReadOnly(conversation) };
}

/** A group becomes read-only when archived, or 30 days after its departure ends. History is kept. */
const ARCHIVE_AFTER_DAYS = 30;
function isReadOnly(conversation: { archivedAt: Date | null; departure: { endDate: Date } }): boolean {
  if (conversation.archivedAt) return true;
  return conversation.departure.endDate.getTime() + ARCHIVE_AFTER_DAYS * 86400000 < Date.now();
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
    const { conversation, isOrganizer, isMember, isAdmin, canModerate, organizerUserId, readOnly } = await authorize(
      req.params.id,
      viewer,
    );

    const trip = conversation.departure.trip;
    const [pinned, documents] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: conversation.id, pinned: true },
        include: { author: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.message.findMany({
        where: { conversationId: conversation.id, kind: { in: ['DOCUMENT', 'IMAGE'] } },
        include: { author: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

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
      documents: documents.map((message) => toMessage(message, organizerUserId)),
      trip: {
        title: trip.title,
        summary: trip.summary,
        destination: trip.destinationLabel,
        meetingPoint: trip.meetingPoint,
        departureCity: trip.departureCity,
        accommodation: trip.accommodation,
        transport: trip.transport,
        includes: parseList(trip.includes),
        excludes: parseList(trip.excludes),
        toConfirm: parseList(trip.toConfirm),
        stage: trip.stage,
        itinerary: trip.itinerary.map((day) => ({ dayNumber: day.dayNumber, title: day.title, label: day.label, summary: day.summary, accommodation: day.accommodation, stops: parseObjects(day.stops) })),
      },
      readOnly,
      archivedAt: conversation.archivedAt,
      // Admins can read for moderation but do not post into traveller groups.
      canPost: (isMember || isOrganizer) && !readOnly,
      canModerate,
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

    // Messages from people the viewer has blocked are not shown to them.
    const blocked = (await prisma.block.findMany({ where: { blockerId: viewer.id }, select: { blockedId: true } })).map((row) => row.blockedId);
    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        ...(before ? { createdAt: { lt: before } } : {}),
        ...(blocked.length ? { userId: { notIn: blocked } } : {}),
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
  kind: z.enum(['TEXT', 'ANNOUNCEMENT', 'IMAGE', 'DOCUMENT']).default('TEXT'),
  attachments: z.array(z.string().url()).max(6).default([]),
});

conversationsRouter.post(
  '/:id/messages',
  route(async (req, res) => {
    const viewer = req.auth!;
    const input = postSchema.parse(req.body);
    const { conversation, isOrganizer, isMember, organizerUserId, readOnly } = await authorize(req.params.id, viewer);

    if (!isMember && !isOrganizer) {
      throw ApiError.forbidden('Only travellers on this departure can post here.');
    }
    if (readOnly) throw ApiError.forbidden('This trip group has been archived. You can still read its history.');
    if ((input.kind === 'IMAGE' || input.kind === 'DOCUMENT') && input.attachments.length === 0) {
      throw ApiError.badRequest('Attach the file first.');
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
        link: `/account/groups/${conversation.id}`,
      });
    } else {
      // A chat notice for members who have not opened the group since it was last quiet,
      // and only one unread notice per group — never one per message.
      const recipients = conversation.members.filter((member) => member.userId !== viewer.id && !member.muted).map((member) => member.userId);
      const link = `/account/groups/${conversation.id}`;
      const alreadyNotified = new Set(
        (await prisma.notification.findMany({ where: { userId: { in: recipients }, link, read: false, type: 'CHAT_MESSAGE' }, select: { userId: true } })).map((row) => row.userId),
      );
      await notifyMany(
        recipients.filter((userId) => !alreadyNotified.has(userId)),
        { type: 'CHAT_MESSAGE', title: `New messages · ${conversation.title}`, body: `${message.author.name.split(' ')[0]}: ${input.body.slice(0, 120)}`, link },
      );
    }

    res.status(201).json(dto);
  }),
);

conversationsRouter.post(
  '/:id/messages/:messageId/pin',
  route(async (req, res) => {
    const viewer = req.auth!;
    const { conversation, isOrganizer, organizerUserId } = await authorize(req.params.id, viewer);

    if (!isOrganizer && viewer.role !== 'ADMIN' && !hasPermission(viewer.permissions ?? [], 'trips.edit')) {
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

/** Any participant can report a message. It goes to Reviews & reports. */
conversationsRouter.post(
  '/:id/messages/:messageId/report',
  route(async (req, res) => {
    const viewer = req.auth!;
    const { conversation } = await authorize(req.params.id, viewer);
    const input = z.object({ reason: z.string().trim().min(3, 'Say briefly what is wrong.').max(200), details: z.string().max(2000).optional() }).parse(req.body);
    const message = await prisma.message.findFirst({ where: { id: req.params.messageId, conversationId: conversation.id } });
    if (!message) throw ApiError.notFound('That message does not exist.');
    await prisma.report.create({
      data: { reporterId: viewer.id, targetType: 'MESSAGE', targetId: message.id, reason: input.reason, details: `${conversation.title}: “${message.body.slice(0, 300)}”${input.details ? `\n${input.details}` : ''}` },
    });
    res.status(201).json({ reported: true });
  }),
);

/** Moderators remove a message. The removal is recorded in the audit log. */
conversationsRouter.delete(
  '/:id/messages/:messageId',
  route(async (req, res) => {
    const viewer = req.auth!;
    const { conversation, canModerate } = await authorize(req.params.id, viewer);
    const message = await prisma.message.findFirst({ where: { id: req.params.messageId, conversationId: conversation.id } });
    if (!message) throw ApiError.notFound('That message does not exist.');
    if (!canModerate && message.userId !== viewer.id) throw ApiError.forbidden('Only moderators can remove other people’s messages.');
    await prisma.message.delete({ where: { id: message.id } });
    await audit(req, { action: 'delete', entityType: 'messages', entityId: message.id, summary: `Removed a message in ${conversation.title}`, before: { body: message.body, userId: message.userId } });
    res.json({ removed: true });
  }),
);

/** Moderators remove a participant from the group, with a reason for the record. */
conversationsRouter.post(
  '/:id/members/:userId/remove',
  route(async (req, res) => {
    const viewer = req.auth!;
    const { conversation, canModerate } = await authorize(req.params.id, viewer);
    if (!canModerate) throw ApiError.forbidden('Only the travel team can remove participants.');
    const input = z.object({ reason: z.string().trim().min(5, 'Give a reason — it is kept in the audit log.').max(500) }).parse(req.body);
    const removed = await prisma.conversationMember.deleteMany({ where: { conversationId: conversation.id, userId: req.params.userId } });
    if (removed.count === 0) throw ApiError.notFound('That person is not in this group.');
    await audit(req, { action: 'update', entityType: 'conversations', entityId: conversation.id, summary: `Removed a participant from ${conversation.title}: ${input.reason}`, before: { userId: req.params.userId } });
    res.json({ removed: true });
  }),
);

/** Archive (read-only) or reopen a group. */
conversationsRouter.post(
  '/:id/archive',
  route(async (req, res) => {
    const viewer = req.auth!;
    const { conversation, canModerate } = await authorize(req.params.id, viewer);
    if (!canModerate) throw ApiError.forbidden('Only the travel team can archive a group.');
    const archive = req.body?.archive !== false;
    await prisma.conversation.update({ where: { id: conversation.id }, data: { archivedAt: archive ? new Date() : null } });
    await audit(req, { action: 'update', entityType: 'conversations', entityId: conversation.id, summary: `${archive ? 'Archived' : 'Reopened'} the group ${conversation.title}` });
    res.json({ archived: archive });
  }),
);
