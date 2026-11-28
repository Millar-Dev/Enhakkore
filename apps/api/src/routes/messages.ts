import { Router } from 'express';
import { z } from 'zod';
import { ApiError, route } from '../lib/http';
import { decryptText, encryptText } from '../lib/crypto';
import { readJsonSetting } from '../lib/json';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { broadcastMessage } from '../realtime/socket';
import { notify } from '../services/notifications';
import { areFriends, blockedEither, isMinor, mutualFollow } from '../services/social';

/**
 * My Messages — permanent one-to-one conversations.
 *
 * Who can start one: accepted friends (Game Friends), or two members who
 * follow each other. Between friends the conversation opens straight away;
 * otherwise it is a message request the other person accepts or declines,
 * and until then the sender can send at most three messages. Under-18s can
 * only message, and be messaged by, their friends.
 *
 * Message text and attachments are encrypted at rest. One conversation per
 * pair (directKey), so the same chat is never duplicated.
 */
export const messagesRouter = Router();
messagesRouter.use(requireAuth);

export const MESSAGING_DEFAULTS = { unsendMinutes: 15, pendingLimit: 3 };

const PERSON = { id: true, name: true, username: true, avatarUrl: true, status: true, readReceipts: true } as const;
const pairKey = (a: string, b: string) => [a, b].sort().join(':');

/** Slows down anyone sending faster than a person types. */
const recent = new Map<string, number[]>();
function tooFast(userId: string) {
  const now = Date.now();
  const list = (recent.get(userId) ?? []).filter((at) => now - at < 60_000);
  list.push(now);
  recent.set(userId, list);
  return list.length > 30;
}

async function loadDirect(id: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { members: { include: { user: { select: PERSON } } } },
  });
  if (!conversation || conversation.kind !== 'DIRECT') throw ApiError.notFound('That conversation does not exist.');
  const me = conversation.members.find((member) => member.userId === userId);
  if (!me) throw ApiError.notFound('That conversation does not exist.');
  const other = conversation.members.find((member) => member.userId !== userId)!;
  return { conversation, me, other };
}

function decodeAttachments(stored: string, encrypted: boolean): string[] {
  try {
    const value = JSON.parse(encrypted && stored.startsWith('v1:') ? decryptText(stored) : stored);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

type MessageRow = {
  id: string;
  userId: string;
  body: string;
  kind: string;
  attachments: string;
  createdAt: Date;
  deletedAt: Date | null;
  encrypted: boolean;
  replyToId: string | null;
  reactions?: { emoji: string; userId: string }[];
};

function view(message: MessageRow, viewerId: string, replies: Map<string, MessageRow>) {
  const removed = !!message.deletedAt;
  const reply = message.replyToId ? replies.get(message.replyToId) : null;
  const reactions = new Map<string, { emoji: string; count: number; mine: boolean }>();
  for (const reaction of message.reactions ?? []) {
    const entry = reactions.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, mine: false };
    entry.count += 1;
    if (reaction.userId === viewerId) entry.mine = true;
    reactions.set(reaction.emoji, entry);
  }
  return {
    id: message.id,
    authorId: message.userId,
    mine: message.userId === viewerId,
    kind: removed ? 'REMOVED' : message.kind,
    body: removed ? '' : message.encrypted ? decryptText(message.body) : message.body,
    attachments: removed ? [] : decodeAttachments(message.attachments, message.encrypted),
    createdAt: message.createdAt,
    removed,
    replyTo: reply
      ? { id: reply.id, authorId: reply.userId, body: reply.deletedAt ? 'Message removed' : (reply.encrypted ? decryptText(reply.body) : reply.body).slice(0, 140), kind: reply.kind }
      : null,
    reactions: [...reactions.values()],
  };
}

async function canStart(meId: string, otherId: string) {
  const [me, other] = await Promise.all([
    prisma.user.findUnique({ where: { id: meId }, select: { dateOfBirth: true } }),
    prisma.user.findUnique({ where: { id: otherId }, select: { id: true, status: true, dateOfBirth: true } }),
  ]);
  if (!other || other.status !== 'ACTIVE') throw ApiError.notFound('That member is not available.');
  if (await blockedEither(meId, otherId)) throw ApiError.notFound('That member is not available.');
  const friends = await areFriends(meId, otherId);
  if (friends) return { status: 'ACCEPTED' as const };
  if (isMinor(me?.dateOfBirth) || isMinor(other.dateOfBirth)) {
    throw ApiError.forbidden('Members under 18 can only message their friends. Send a friend request first.');
  }
  if (await mutualFollow(meId, otherId)) return { status: 'PENDING' as const };
  throw ApiError.forbidden('You can message your friends, or members who follow you back. Follow them, or send a friend request.');
}

/* ----------------------------------- Inbox ---------------------------------- */

messagesRouter.get(
  '/',
  route(async (req, res) => {
    const box = z.enum(['all', 'requests', 'archived']).catch('all').parse(req.query.box);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase().slice(0, 60) : '';
    const memberships = await prisma.conversationMember.findMany({
      where: { userId: req.auth!.id, conversation: { kind: 'DIRECT' } },
      include: {
        conversation: {
          include: {
            members: { include: { user: { select: PERSON } } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    const items = [];
    for (const membership of memberships) {
      const conversation = membership.conversation;
      const other = conversation.members.find((member) => member.userId !== req.auth!.id);
      if (!other) continue;
      const incomingRequest = conversation.requestStatus === 'PENDING' && conversation.requestedById !== req.auth!.id;
      if (conversation.requestStatus === 'DECLINED' && conversation.requestedById !== req.auth!.id) continue;
      if (box === 'requests' && !incomingRequest) continue;
      if (box === 'archived' && !membership.archivedAt) continue;
      if (box === 'all' && (incomingRequest || membership.archivedAt)) continue;
      if (q && !`${other.user.name} ${other.user.username ?? ''}`.toLowerCase().includes(q)) continue;
      const last = conversation.messages[0];
      const visibleLast = last && (!membership.clearedAt || last.createdAt > membership.clearedAt) ? last : null;
      const unread = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          userId: { not: req.auth!.id },
          deletedAt: null,
          createdAt: { gt: new Date(Math.max(membership.lastReadAt?.getTime() ?? 0, membership.clearedAt?.getTime() ?? 0)) },
          hiddenFor: { none: { userId: req.auth!.id } },
        },
      });
      items.push({
        id: conversation.id,
        member: { id: other.user.id, name: other.user.name, username: other.user.username, avatarUrl: other.user.avatarUrl, available: other.user.status === 'ACTIVE' },
        requestStatus: conversation.requestStatus,
        incomingRequest,
        waitingForThem: conversation.requestStatus === 'PENDING' && conversation.requestedById === req.auth!.id,
        muted: membership.muted,
        archived: !!membership.archivedAt,
        unread,
        lastMessage: visibleLast
          ? {
              mine: visibleLast.userId === req.auth!.id,
              preview: visibleLast.deletedAt ? 'Message removed' : visibleLast.kind === 'TEXT' ? (visibleLast.encrypted ? decryptText(visibleLast.body) : visibleLast.body).slice(0, 100) : `[${visibleLast.kind.toLowerCase()}]`,
              createdAt: visibleLast.createdAt,
            }
          : null,
        updatedAt: conversation.lastMessageAt ?? conversation.createdAt,
      });
    }
    items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const requests = memberships.filter((m) => m.conversation.requestStatus === 'PENDING' && m.conversation.requestedById !== req.auth!.id).length;
    res.json({ items, counts: { requests, unread: items.reduce((sum, item) => sum + (box === 'all' ? item.unread : 0), 0) } });
  }),
);

/** Opens (or finds) the conversation with a member. */
messagesRouter.post(
  '/start',
  route(async (req, res) => {
    const { userId } = z.object({ userId: z.string().min(5) }).parse(req.body);
    if (userId === req.auth!.id) throw ApiError.badRequest('That is you.');
    const directKey = pairKey(req.auth!.id, userId);
    const existing = await prisma.conversation.findUnique({ where: { directKey } });
    if (existing) {
      if (await blockedEither(req.auth!.id, userId)) throw ApiError.notFound('That member is not available.');
      // A declined request can be re-sent after the rules allow it again.
      if (existing.requestStatus === 'DECLINED') {
        const allowed = await canStart(req.auth!.id, userId);
        await prisma.conversation.update({ where: { id: existing.id }, data: { requestStatus: allowed.status, requestedById: req.auth!.id } });
      } else if (existing.requestStatus === 'PENDING' && (await areFriends(req.auth!.id, userId))) {
        await prisma.conversation.update({ where: { id: existing.id }, data: { requestStatus: 'ACCEPTED' } });
      }
      await prisma.conversationMember.updateMany({ where: { conversationId: existing.id, userId: req.auth!.id }, data: { archivedAt: null } });
      return res.json({ id: existing.id });
    }
    const allowed = await canStart(req.auth!.id, userId);
    try {
      const conversation = await prisma.conversation.create({
        data: {
          kind: 'DIRECT',
          title: 'Private conversation',
          directKey,
          requestStatus: allowed.status,
          requestedById: req.auth!.id,
          members: { create: [{ userId: req.auth!.id }, { userId }] },
        },
      });
      res.status(201).json({ id: conversation.id });
    } catch (error) {
      // Both started at the same moment: the unique pair key keeps one.
      if ((error as { code?: string }).code === 'P2002') {
        const again = await prisma.conversation.findUniqueOrThrow({ where: { directKey } });
        return res.json({ id: again.id });
      }
      throw error;
    }
  }),
);

/** Text search across the member's own conversations. */
messagesRouter.get(
  '/search',
  route(async (req, res) => {
    const q = z.string().trim().min(2).max(60).parse(req.query.q).toLowerCase();
    const memberships = await prisma.conversationMember.findMany({ where: { userId: req.auth!.id, conversation: { kind: 'DIRECT' } }, select: { conversationId: true, clearedAt: true } });
    const results: { conversationId: string; messageId: string; preview: string; createdAt: Date }[] = [];
    for (const membership of memberships) {
      const messages = await prisma.message.findMany({
        where: { conversationId: membership.conversationId, deletedAt: null, kind: 'TEXT', ...(membership.clearedAt ? { createdAt: { gt: membership.clearedAt } } : {}), hiddenFor: { none: { userId: req.auth!.id } } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      for (const message of messages) {
        const text = message.encrypted ? decryptText(message.body) : message.body;
        if (text.toLowerCase().includes(q)) results.push({ conversationId: membership.conversationId, messageId: message.id, preview: text.slice(0, 140), createdAt: message.createdAt });
        if (results.length >= 50) break;
      }
    }
    res.json({ items: results });
  }),
);

/* ------------------------------- A conversation ------------------------------ */

messagesRouter.get(
  '/:id',
  route(async (req, res) => {
    const { conversation, me, other } = await loadDirect(req.params.id, req.auth!.id);
    const take = Math.min(100, Number(req.query.limit ?? 50) || 50);
    const before = typeof req.query.before === 'string' ? new Date(req.query.before) : undefined;
    const rows = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        hiddenFor: { none: { userId: req.auth!.id } },
        ...(me.clearedAt || before ? { createdAt: { ...(me.clearedAt ? { gt: me.clearedAt } : {}), ...(before ? { lt: before } : {}) } } : {}),
      },
      include: { reactions: { select: { emoji: true, userId: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    });
    const replyIds = rows.map((row) => row.replyToId).filter((id): id is string => !!id);
    const replies = new Map((await prisma.message.findMany({ where: { id: { in: replyIds } } })).map((row) => [row.id, row]));
    await prisma.conversationMember.update({ where: { id: me.id }, data: { lastReadAt: new Date() } });
    const blocked = await blockedEither(req.auth!.id, other.userId);
    const settings = await readJsonSetting('messaging', MESSAGING_DEFAULTS);
    // Read receipts are shown only when both people allow them.
    const showReceipts = me.user.readReceipts && other.user.readReceipts;
    const pendingSent = conversation.requestStatus === 'PENDING' ? await prisma.message.count({ where: { conversationId: conversation.id, userId: conversation.requestedById ?? '' } }) : 0;
    res.json({
      id: conversation.id,
      member: { id: other.user.id, name: other.user.name, username: other.user.username, avatarUrl: other.user.avatarUrl, available: other.user.status === 'ACTIVE' && !blocked },
      requestStatus: conversation.requestStatus,
      incomingRequest: conversation.requestStatus === 'PENDING' && conversation.requestedById !== req.auth!.id,
      canSend:
        !blocked &&
        other.user.status === 'ACTIVE' &&
        (conversation.requestStatus === 'ACCEPTED' || (conversation.requestStatus === 'PENDING' && conversation.requestedById === req.auth!.id && pendingSent < settings.pendingLimit)),
      pendingLimit: settings.pendingLimit,
      unsendMinutes: settings.unsendMinutes,
      muted: me.muted,
      archived: !!me.archivedAt,
      blocked,
      otherReadAt: showReceipts ? other.lastReadAt : null,
      items: rows.reverse().map((row) => view(row, req.auth!.id, replies)),
      hasMore: rows.length === take,
    });
  }),
);

const sendSchema = z.object({
  body: z.string().trim().max(4000).default(''),
  kind: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).default('TEXT'),
  attachments: z.array(z.string().url().max(600)).max(6).default([]),
  replyToId: z.string().min(5).optional(),
});

messagesRouter.post(
  '/:id/messages',
  route(async (req, res) => {
    const input = sendSchema.parse(req.body);
    if (input.kind === 'TEXT' && !input.body) throw ApiError.badRequest('Write a message.');
    if (input.kind !== 'TEXT' && input.attachments.length === 0) throw ApiError.badRequest('Attach the file first.');
    const { conversation, me, other } = await loadDirect(req.params.id, req.auth!.id);
    if (await blockedEither(req.auth!.id, other.userId)) throw ApiError.forbidden('You cannot message this member.');
    if (other.user.status !== 'ACTIVE') throw ApiError.forbidden('This member is not available.');
    const settings = await readJsonSetting('messaging', MESSAGING_DEFAULTS);
    if (conversation.requestStatus === 'PENDING') {
      if (conversation.requestedById !== req.auth!.id) throw ApiError.forbidden('Accept the message request to reply.');
      const sent = await prisma.message.count({ where: { conversationId: conversation.id, userId: req.auth!.id } });
      if (sent >= settings.pendingLimit) throw ApiError.forbidden(`You can send ${settings.pendingLimit} messages until ${other.user.name} accepts your request.`);
    } else if (conversation.requestStatus !== 'ACCEPTED') {
      throw ApiError.forbidden('This conversation is closed.');
    }
    if (tooFast(req.auth!.id)) throw new ApiError(429, 'You are sending messages very quickly. Wait a moment.', 'rate_limited');
    if (input.replyToId) {
      const target = await prisma.message.findFirst({ where: { id: input.replyToId, conversationId: conversation.id } });
      if (!target) throw ApiError.badRequest('That message is not in this conversation.');
    }
    const now = new Date();
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        userId: req.auth!.id,
        kind: input.kind,
        body: encryptText(input.body),
        attachments: input.attachments.length ? encryptText(JSON.stringify(input.attachments)) : '[]',
        encrypted: true,
        replyToId: input.replyToId ?? null,
      },
      include: { reactions: true },
    });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: now } });
    await prisma.conversationMember.updateMany({ where: { conversationId: conversation.id }, data: { archivedAt: null } });
    await prisma.conversationMember.update({ where: { id: me.id }, data: { lastReadAt: now } });
    const replies = new Map<string, MessageRow>();
    if (input.replyToId) {
      const reply = await prisma.message.findUnique({ where: { id: input.replyToId } });
      if (reply) replies.set(reply.id, reply);
    }
    const dto = view(message, req.auth!.id, replies);
    broadcastMessage(conversation.id, { ...dto, mine: false } as never);
    // One notification per unread stretch: nothing more until they read the conversation.
    if (!other.muted) {
      const pending = conversation.requestStatus === 'PENDING';
      await notify({
        userId: other.userId,
        type: pending ? 'MESSAGE_REQUEST' : 'DIRECT_MESSAGE',
        title: pending ? 'New message request' : `Message from ${req.auth!.name}`,
        body: pending ? `${req.auth!.name} would like to message you.` : input.kind === 'TEXT' ? input.body.slice(0, 120) : `Sent ${input.kind.toLowerCase()}`,
        link: pending ? '/account/messages?box=requests' : `/account/messages/${conversation.id}`,
        dedupeKey: `dm:${conversation.id}:${other.lastReadAt?.getTime() ?? 0}`,
      });
    }
    res.status(201).json(dto);
  }),
);

messagesRouter.post(
  '/:id/respond',
  route(async (req, res) => {
    const { accept } = z.object({ accept: z.boolean() }).parse(req.body);
    const { conversation } = await loadDirect(req.params.id, req.auth!.id);
    if (conversation.requestStatus !== 'PENDING' || conversation.requestedById === req.auth!.id) throw ApiError.badRequest('There is no request to answer.');
    await prisma.conversation.update({ where: { id: conversation.id }, data: { requestStatus: accept ? 'ACCEPTED' : 'DECLINED' } });
    if (accept && conversation.requestedById) {
      await notify({ userId: conversation.requestedById, type: 'DIRECT_MESSAGE', title: 'Message request accepted', body: `${req.auth!.name} accepted your message request.`, link: `/account/messages/${conversation.id}`, dedupeKey: `dm-accepted:${conversation.id}` });
    }
    // The sender is not told about a decline.
    res.json({ ok: true, status: accept ? 'ACCEPTED' : 'DECLINED' });
  }),
);

messagesRouter.post(
  '/:id/read',
  route(async (req, res) => {
    const { me } = await loadDirect(req.params.id, req.auth!.id);
    await prisma.conversationMember.update({ where: { id: me.id }, data: { lastReadAt: new Date() } });
    res.json({ ok: true });
  }),
);

messagesRouter.post(
  '/:id/messages/:messageId/react',
  route(async (req, res) => {
    const { emoji } = z.object({ emoji: z.string().min(1).max(8) }).parse(req.body);
    const { conversation } = await loadDirect(req.params.id, req.auth!.id);
    const message = await prisma.message.findFirst({ where: { id: req.params.messageId, conversationId: conversation.id, deletedAt: null } });
    if (!message) throw ApiError.notFound();
    const existing = await prisma.messageReaction.findUnique({ where: { messageId_userId_emoji: { messageId: message.id, userId: req.auth!.id, emoji } } });
    if (existing) await prisma.messageReaction.delete({ where: { id: existing.id } });
    else await prisma.messageReaction.create({ data: { messageId: message.id, userId: req.auth!.id, emoji } });
    res.json({ reacted: !existing });
  }),
);

/** ?for=me hides it for you; ?for=everyone unsends your own message within the time limit. */
messagesRouter.delete(
  '/:id/messages/:messageId',
  route(async (req, res) => {
    const scope = z.enum(['me', 'everyone']).catch('me').parse(req.query.for);
    const { conversation } = await loadDirect(req.params.id, req.auth!.id);
    const message = await prisma.message.findFirst({ where: { id: req.params.messageId, conversationId: conversation.id } });
    if (!message) throw ApiError.notFound();
    if (scope === 'me') {
      await prisma.messageHidden.upsert({ where: { messageId_userId: { messageId: message.id, userId: req.auth!.id } }, create: { messageId: message.id, userId: req.auth!.id }, update: {} });
      return res.json({ ok: true });
    }
    if (message.userId !== req.auth!.id) throw ApiError.forbidden('You can only unsend your own messages.');
    const { unsendMinutes } = await readJsonSetting('messaging', MESSAGING_DEFAULTS);
    if (Date.now() - message.createdAt.getTime() > unsendMinutes * 60_000) throw ApiError.forbidden(`Messages can be unsent for ${unsendMinutes} minutes after sending.`);
    await prisma.message.update({ where: { id: message.id }, data: { deletedAt: new Date(), body: '', attachments: '[]' } });
    await prisma.messageReaction.deleteMany({ where: { messageId: message.id } });
    res.json({ ok: true });
  }),
);

messagesRouter.post(
  '/:id/settings',
  route(async (req, res) => {
    const input = z.object({ muted: z.boolean().optional(), archived: z.boolean().optional(), clear: z.literal(true).optional() }).parse(req.body);
    const { me } = await loadDirect(req.params.id, req.auth!.id);
    await prisma.conversationMember.update({
      where: { id: me.id },
      data: {
        ...(input.muted !== undefined ? { muted: input.muted } : {}),
        ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
        ...(input.clear ? { clearedAt: new Date() } : {}),
      },
    });
    res.json({ ok: true });
  }),
);

/** Reporting copies nothing: the team can open the reported message itself, with an audited reason. */
messagesRouter.post(
  '/:id/report',
  route(async (req, res) => {
    const input = z.object({ messageId: z.string().min(5).optional(), reason: z.string().trim().min(3).max(120), details: z.string().trim().max(2000).optional(), block: z.boolean().default(false) }).parse(req.body);
    const { conversation, other } = await loadDirect(req.params.id, req.auth!.id);
    if (input.messageId) {
      const message = await prisma.message.findFirst({ where: { id: input.messageId, conversationId: conversation.id } });
      if (!message) throw ApiError.notFound();
    }
    await prisma.report.create({
      data: {
        reporterId: req.auth!.id,
        targetType: input.messageId ? 'DIRECT_MESSAGE' : 'DIRECT_CONVERSATION',
        targetId: input.messageId ?? conversation.id,
        reason: input.reason,
        details: [`Conversation ${conversation.id}`, `Reported member ${other.userId}`, input.details].filter(Boolean).join('\n'),
      },
    });
    if (input.block) {
      await prisma.block.upsert({ where: { blockerId_blockedId: { blockerId: req.auth!.id, blockedId: other.userId } }, create: { blockerId: req.auth!.id, blockedId: other.userId }, update: {} });
    }
    res.status(201).json({ ok: true, message: 'Thank you. The safety team will review it.' });
  }),
);

/** Shared photos, videos, files and links in this conversation. */
messagesRouter.get(
  '/:id/media',
  route(async (req, res) => {
    const { conversation, me } = await loadDirect(req.params.id, req.auth!.id);
    const rows = await prisma.message.findMany({
      where: { conversationId: conversation.id, deletedAt: null, hiddenFor: { none: { userId: req.auth!.id } }, ...(me.clearedAt ? { createdAt: { gt: me.clearedAt } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const media: { url: string; kind: string; createdAt: Date }[] = [];
    const links: { url: string; createdAt: Date }[] = [];
    for (const row of rows) {
      for (const url of decodeAttachments(row.attachments, row.encrypted)) media.push({ url, kind: row.kind, createdAt: row.createdAt });
      const text = row.encrypted ? decryptText(row.body) : row.body;
      for (const match of text.match(/https?:\/\/[^\s<>"]+/g) ?? []) links.push({ url: match, createdAt: row.createdAt });
    }
    res.json({ media, links });
  }),
);
