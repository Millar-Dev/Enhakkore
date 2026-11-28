import { hasPermission } from '@enhakkore/shared';
import { Router } from 'express';
import { z } from 'zod';
import { ApiError, route } from '../lib/http';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthUser } from '../middleware/auth';
import { audit } from '../services/audit';
import { notifyMany } from '../services/notifications';
import { broadcastMessage } from '../realtime/socket';
import { toMessage } from '../serializers';
import { looksLikeExactLocation } from './gaming';

/**
 * Group chats for events, activities and communities.
 *
 * They use the same Conversation / Message tables and live socket channel as
 * trip groups. Who may read and post is worked out from the listing every
 * time: confirmed participants and members, the organiser, and staff who
 * manage that kind of listing (for moderation). The organiser switches the
 * chat on or off; switched off, history stays but nobody can post.
 */
export const groupChatsRouter = Router();
groupChatsRouter.use(requireAuth);

const SUBJECTS = ['ACTIVITY', 'EVENT', 'COMMUNITY', 'TOURNAMENT', 'GAMING_GROUP', 'GAME_INVITE'] as const;
type Subject = (typeof SUBJECTS)[number];
const MODULE: Record<Subject, string> = { ACTIVITY: 'activities', EVENT: 'events', COMMUNITY: 'communities', TOURNAMENT: 'gaming', GAMING_GROUP: 'gaming', GAME_INVITE: 'gaming' };
/** Subjects whose chat cannot be switched off by an organiser (it is part of the feature). */
const ALWAYS_ON: Subject[] = ['TOURNAMENT', 'GAMING_GROUP', 'GAME_INVITE'];

interface Access {
  title: string;
  href: string;
  enabled: boolean;
  isMember: boolean;
  isOrganiser: boolean;
  isStaff: boolean;
  organiserUserId: string | null;
  /** Muted by a group moderator: can read, cannot post for now. */
  muted?: boolean;
  /** For the inbox filters: COMMUNITY | STUDY_GROUP | ACTIVITY | EVENT | TOURNAMENT | TEAM | GAMING_TEMP */
  category?: string;
}

async function access(subjectType: Subject, subjectId: string, viewer: AuthUser): Promise<Access | null> {
  const isStaff = hasPermission(viewer.permissions, `${MODULE[subjectType]}.edit`) && viewer.scope !== 'OWN';
  if (subjectType === 'ACTIVITY') {
    const activity = await prisma.activity.findUnique({ where: { id: subjectId }, select: { title: true, slug: true, chatEnabled: true, organiserUserId: true } });
    if (!activity) return null;
    const [participant, session] = await Promise.all([
      prisma.activityParticipant.findFirst({ where: { activityId: subjectId, userId: viewer.id, status: 'APPROVED' }, select: { id: true } }),
      prisma.sessionRegistration.findFirst({ where: { userId: viewer.id, status: 'REGISTERED', session: { activityId: subjectId } }, select: { id: true } }),
    ]);
    return { title: activity.title, href: `/activities/${activity.slug}`, enabled: activity.chatEnabled, isMember: !!(participant || session), isOrganiser: activity.organiserUserId === viewer.id, isStaff, organiserUserId: activity.organiserUserId, category: 'ACTIVITY' };
  }
  if (subjectType === 'EVENT') {
    const event = await prisma.event.findUnique({ where: { id: subjectId }, select: { title: true, slug: true, chatEnabled: true, managerId: true } });
    if (!event) return null;
    const registration = await prisma.eventRegistration.findFirst({ where: { eventId: subjectId, userId: viewer.id, status: 'CONFIRMED' }, select: { id: true } });
    return { title: event.title, href: `/events/${event.slug}`, enabled: event.chatEnabled, isMember: !!registration, isOrganiser: !!event.managerId && event.managerId === viewer.id, isStaff, organiserUserId: event.managerId, category: 'EVENT' };
  }
  if (subjectType === 'TOURNAMENT') {
    const tournament = await prisma.tournament.findUnique({ where: { id: subjectId }, select: { title: true, slug: true, createdById: true, status: true } });
    if (!tournament || ['HIDDEN', 'SUSPENDED'].includes(tournament.status) && !isStaff) return null;
    const entry = await prisma.tournamentEntry.findFirst({ where: { tournamentId: subjectId, status: { in: ['REGISTERED', 'CONFIRMED'] }, OR: [{ captainId: viewer.id }, { members: { some: { userId: viewer.id } } }] }, select: { id: true } });
    return { title: tournament.title, href: `/experiences/gaming/${tournament.slug}`, enabled: !['CANCELLED', 'ARCHIVED'].includes(tournament.status), isMember: !!entry, isOrganiser: tournament.createdById === viewer.id, isStaff, organiserUserId: tournament.createdById, category: 'TOURNAMENT' };
  }
  if (subjectType === 'GAMING_GROUP') {
    const group = await prisma.gamingGroup.findUnique({ where: { id: subjectId }, select: { name: true, slug: true, kind: true, ownerId: true, status: true } });
    if (!group) return null;
    const me = await prisma.gamingGroupMember.findUnique({ where: { groupId_userId: { groupId: subjectId, userId: viewer.id } } });
    const active = me?.status === 'ACTIVE';
    return { title: group.name, href: `/experiences/gaming/groups/${group.slug}`, enabled: group.status === 'ACTIVE', isMember: active, isOrganiser: active && (me!.role === 'OWNER' || me!.role === 'CAPTAIN'), isStaff, organiserUserId: group.ownerId, category: 'TEAM' };
  }
  if (subjectType === 'GAME_INVITE') {
    const invite = await prisma.gameInvite.findUnique({ where: { id: subjectId } });
    if (!invite) return null;
    const accepted = await prisma.gameInviteResponse.findUnique({ where: { inviteId_userId: { inviteId: subjectId, userId: viewer.id } } });
    const conversation = invite.conversationId ? await prisma.conversation.findUnique({ where: { id: invite.conversationId }, select: { expiresAt: true } }) : null;
    const open = !conversation?.expiresAt || conversation.expiresAt.getTime() > Date.now();
    return { title: `${invite.game} · temporary chat`, href: `/gaming/invites/${invite.id}`, enabled: open && invite.status !== 'CANCELLED', isMember: accepted?.status === 'ACCEPTED', isOrganiser: invite.requesterId === viewer.id, isStaff, organiserUserId: invite.requesterId, category: 'GAMING_TEMP' };
  }
  const community = await prisma.community.findUnique({ where: { id: subjectId }, select: { name: true, slug: true, chatEnabled: true, createdById: true, kind: true, status: true } });
  if (!community) return null;
  const member = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId: subjectId, userId: viewer.id } } });
  const active = member?.status === 'ACTIVE';
  const muted = !!member?.mutedUntil && member.mutedUntil.getTime() > Date.now();
  return { title: community.name, href: `/experiences/communities/${community.slug}`, enabled: community.chatEnabled && community.status !== 'SUSPENDED', isMember: active, isOrganiser: active && (member?.role === 'MODERATOR' || member?.role === 'ADMIN'), isStaff, organiserUserId: community.createdById, muted, category: community.kind === 'STUDY_GROUP' ? 'STUDY_GROUP' : 'COMMUNITY' };
}

async function loadConversation(id: string, viewer: AuthUser) {
  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation || !conversation.subjectType || !conversation.subjectId) throw ApiError.notFound('That group chat does not exist.');
  const subjectType = conversation.subjectType as Subject;
  const info = await access(subjectType, conversation.subjectId, viewer);
  // Someone without a place in the group does not learn that it exists.
  if (!info || (!info.isMember && !info.isOrganiser && !info.isStaff)) {
    // Lost their place (cancelled, removed): drop the live-channel membership too.
    await prisma.conversationMember.deleteMany({ where: { conversationId: id, userId: viewer.id } });
    throw ApiError.notFound('That group chat does not exist.');
  }
  const canPost = (info.isMember || info.isOrganiser) && info.enabled && !conversation.archivedAt && !info.muted;
  const canModerate = info.isOrganiser || info.isStaff;
  return { conversation, subjectType, info, canPost, canModerate };
}

/** Group chats the viewer can open: every listing they take part in that has chat switched on. */
groupChatsRouter.get(
  '/',
  route(async (req, res) => {
    const userId = req.auth!.id;
    const [participants, sessions, events, communities, organised] = await Promise.all([
      prisma.activityParticipant.findMany({ where: { userId, status: 'APPROVED', activity: { chatEnabled: true } }, select: { activityId: true } }),
      prisma.sessionRegistration.findMany({ where: { userId, status: 'REGISTERED', session: { activity: { chatEnabled: true } } }, select: { session: { select: { activityId: true } } } }),
      prisma.eventRegistration.findMany({ where: { userId, status: 'CONFIRMED', event: { chatEnabled: true } }, select: { eventId: true } }),
      prisma.communityMember.findMany({ where: { userId, status: 'ACTIVE', community: { chatEnabled: true } }, select: { communityId: true } }),
      prisma.activity.findMany({ where: { organiserUserId: userId, chatEnabled: true }, select: { id: true } }),
    ]);
    const subjects: { subjectType: Subject; subjectId: string }[] = [
      ...new Set([...participants.map((r) => r.activityId), ...sessions.map((r) => r.session.activityId), ...organised.map((r) => r.id)]),
    ].map((subjectId) => ({ subjectType: 'ACTIVITY' as const, subjectId }));
    subjects.push(...[...new Set(events.map((r) => r.eventId))].map((subjectId) => ({ subjectType: 'EVENT' as const, subjectId })));
    subjects.push(...communities.map((r) => ({ subjectType: 'COMMUNITY' as const, subjectId: r.communityId })));
    const [entries, createdTournaments, gamingGroups, invites] = await Promise.all([
      prisma.tournamentEntry.findMany({ where: { status: { in: ['REGISTERED', 'CONFIRMED'] }, OR: [{ captainId: userId }, { members: { some: { userId } } }], tournament: { status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED'] } } }, select: { tournamentId: true } }),
      prisma.tournament.findMany({ where: { createdById: userId, status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED'] } }, select: { id: true } }),
      prisma.gamingGroupMember.findMany({ where: { userId, status: 'ACTIVE', group: { status: 'ACTIVE' } }, select: { groupId: true } }),
      prisma.gameInvite.findMany({ where: { OR: [{ requesterId: userId }, { responses: { some: { userId, status: 'ACCEPTED' } } }], createdAt: { gt: new Date(Date.now() - 2 * 86_400_000) } }, select: { id: true } }),
    ]);
    subjects.push(...[...new Set([...entries.map((r) => r.tournamentId), ...createdTournaments.map((r) => r.id)])].map((subjectId) => ({ subjectType: 'TOURNAMENT' as const, subjectId })));
    subjects.push(...gamingGroups.map((r) => ({ subjectType: 'GAMING_GROUP' as const, subjectId: r.groupId })));
    subjects.push(...invites.map((r) => ({ subjectType: 'GAME_INVITE' as const, subjectId: r.id })));
    const only = typeof req.query.type === 'string' ? req.query.type.toUpperCase() : '';

    const items = [];
    for (const subject of subjects) {
      const info = await access(subject.subjectType, subject.subjectId, req.auth!);
      if (!info) continue;
      if (only && info.category !== only && !(only === 'GAMING' && ['TOURNAMENT', 'GAMING_TEMP'].includes(info.category ?? ''))) continue;
      let conversation = await prisma.conversation.findUnique({ where: { subjectType_subjectId: subject } });
      // Tournament and team chats exist for everyone in them from the start.
      if (!conversation && (subject.subjectType === 'TOURNAMENT' || subject.subjectType === 'GAMING_GROUP')) {
        conversation = await prisma.conversation.create({ data: { ...subject, title: info.title } }).catch(async () => prisma.conversation.findUnique({ where: { subjectType_subjectId: subject } }));
      }
      const membership = conversation ? await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId: conversation.id, userId } } }) : null;
      const last = conversation ? await prisma.message.findFirst({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'desc' }, include: { author: true } }) : null;
      const unreadCount = conversation
        ? await prisma.message.count({ where: { conversationId: conversation.id, userId: { not: userId }, ...(membership?.lastReadAt ? { createdAt: { gt: membership.lastReadAt } } : {}) } })
        : 0;
      items.push({ ...subject, category: info.category ?? subject.subjectType, id: conversation?.id ?? null, title: info.title, href: info.href, unreadCount, lastMessage: last ? toMessage(last, info.organiserUserId) : null });
    }
    items.sort((a, b) => (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? ''));
    res.json({ items });
  }),
);

const subjectSchema = z.object({ subjectType: z.enum(SUBJECTS), subjectId: z.string().min(5).max(60) });

/** Opens (creating on first use) the chat for a listing, and joins the viewer to its live channel. */
groupChatsRouter.post(
  '/open',
  route(async (req, res) => {
    const subject = subjectSchema.parse(req.body);
    const info = await access(subject.subjectType, subject.subjectId, req.auth!);
    if (!info || (!info.isMember && !info.isOrganiser && !info.isStaff)) throw ApiError.forbidden('Only confirmed participants can open this group chat.');
    if (!info.enabled && !info.isOrganiser && !info.isStaff) throw ApiError.forbidden('The organiser has not switched on the group chat.');
    let conversation = await prisma.conversation.findUnique({ where: { subjectType_subjectId: subject } });
    if (!conversation) {
      conversation = await prisma.conversation
        .create({ data: { ...subject, title: info.title } })
        .catch(async () => (await prisma.conversation.findUnique({ where: { subjectType_subjectId: subject } }))!);
    }
    if (info.isMember || info.isOrganiser) {
      await prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: conversation.id, userId: req.auth!.id } },
        create: { conversationId: conversation.id, userId: req.auth!.id, role: info.isOrganiser ? 'ORGANIZER' : 'TRAVELER' },
        update: {},
      });
    }
    res.json({ id: conversation.id });
  }),
);

/** The organiser (or staff) switches the chat on or off. */
groupChatsRouter.post(
  '/settings',
  route(async (req, res) => {
    const input = subjectSchema.extend({ enabled: z.boolean() }).parse(req.body);
    const info = await access(input.subjectType, input.subjectId, req.auth!);
    if (!info || (!info.isOrganiser && !info.isStaff)) throw ApiError.forbidden('Only the organiser can change the group chat.');
    if (ALWAYS_ON.includes(input.subjectType)) throw ApiError.badRequest('This chat is part of the listing and stays on. Close it instead.');
    const data = { chatEnabled: input.enabled };
    if (input.subjectType === 'ACTIVITY') await prisma.activity.update({ where: { id: input.subjectId }, data });
    if (input.subjectType === 'EVENT') await prisma.event.update({ where: { id: input.subjectId }, data });
    if (input.subjectType === 'COMMUNITY') await prisma.community.update({ where: { id: input.subjectId }, data });
    await audit(req, { action: 'update', entityType: MODULE[input.subjectType], entityId: input.subjectId, summary: `Group chat ${input.enabled ? 'switched on' : 'switched off'} for ${info.title}` });
    res.json({ enabled: input.enabled });
  }),
);

/** Public view of a member in the chat: username and first name only. */
function author(user: { id: string; name: string; username: string | null; avatarUrl: string | null; role: string }) {
  return { id: user.id, name: user.username ? `@${user.username}` : user.name.split(' ')[0], avatarUrl: user.avatarUrl, role: user.role };
}

groupChatsRouter.get(
  '/:id',
  route(async (req, res) => {
    const { conversation, subjectType, info, canPost, canModerate } = await loadConversation(req.params.id, req.auth!);
    const [members, pinned] = await Promise.all([
      prisma.conversationMember.findMany({ where: { conversationId: conversation.id }, include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } } }, orderBy: { joinedAt: 'asc' } }),
      prisma.message.findMany({ where: { conversationId: conversation.id, pinned: true }, include: { author: true }, orderBy: { createdAt: 'desc' } }),
    ]);
    res.json({
      id: conversation.id,
      subjectType,
      subjectId: conversation.subjectId,
      title: info.title,
      href: info.href,
      enabled: info.enabled,
      archivedAt: conversation.archivedAt,
      canPost,
      canModerate,
      muted: !!info.muted,
      viewerIsOrganiser: info.isOrganiser,
      members: members.map((member) => ({ ...author(member.user), groupRole: member.role })),
      pinned: pinned.map((message) => ({ ...toMessage(message, info.organiserUserId), author: { ...author(message.author), isOrganizer: message.author.id === info.organiserUserId } })),
    });
  }),
);

groupChatsRouter.get(
  '/:id/messages',
  route(async (req, res) => {
    const { conversation, info } = await loadConversation(req.params.id, req.auth!);
    const take = Math.min(100, Number(req.query.limit ?? 50) || 50);
    const before = typeof req.query.before === 'string' ? new Date(req.query.before) : undefined;
    const blocked = (await prisma.block.findMany({ where: { blockerId: req.auth!.id }, select: { blockedId: true } })).map((row) => row.blockedId);
    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id, ...(before ? { createdAt: { lt: before } } : {}), ...(blocked.length ? { userId: { notIn: blocked } } : {}) },
      include: { author: true, reactions: { select: { emoji: true, userId: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    });
    // Team members reading a group they are not part of: restricted, and written to the audit log.
    if (info.isStaff && !info.isMember && !info.isOrganiser && !before) {
      await audit(req, { action: 'view', entityType: 'conversations', entityId: conversation.id, summary: `Opened the group chat “${info.title}” as a team member (moderation)`, sensitive: true });
    }
    await prisma.conversationMember.updateMany({ where: { conversationId: conversation.id, userId: req.auth!.id }, data: { lastReadAt: new Date() } });
    const replyIds = messages.map((m) => m.replyToId).filter((id): id is string => !!id);
    const replies = new Map((await prisma.message.findMany({ where: { id: { in: replyIds } }, include: { author: { select: { name: true, username: true } } } })).map((m) => [m.id, m]));
    res.json({
      items: messages.reverse().map((message) => {
        const reply = message.replyToId ? replies.get(message.replyToId) : null;
        const reactions = new Map<string, { emoji: string; count: number; mine: boolean }>();
        for (const r of message.reactions) {
          const entry = reactions.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
          entry.count++;
          if (r.userId === req.auth!.id) entry.mine = true;
          reactions.set(r.emoji, entry);
        }
        return {
          ...toMessage(message, info.organiserUserId),
          author: { ...author(message.author), isOrganizer: message.author.id === info.organiserUserId },
          replyTo: reply ? { id: reply.id, body: reply.body.slice(0, 140), author: reply.author.username ? `@${reply.author.username}` : reply.author.name.split(' ')[0] } : null,
          reactions: [...reactions.values()],
        };
      }),
      hasMore: messages.length === take,
    });
  }),
);

const postSchema = z.object({
  body: z.string().trim().min(1, 'Write a message.').max(2000),
  kind: z.enum(['TEXT', 'ANNOUNCEMENT', 'IMAGE', 'VIDEO', 'VOICE', 'DOCUMENT']).default('TEXT'),
  attachments: z.array(z.string().url()).max(6).default([]),
  replyToId: z.string().min(5).optional(),
});

/** Slows down anyone posting faster than people can read. */
const recentPosts = new Map<string, number[]>();
function tooFast(userId: string) {
  const now = Date.now();
  const list = (recentPosts.get(userId) ?? []).filter((at) => now - at < 60_000);
  list.push(now);
  recentPosts.set(userId, list);
  return list.length > 20;
}

groupChatsRouter.post(
  '/:id/messages',
  route(async (req, res) => {
    const input = postSchema.parse(req.body);
    const { conversation, info, canPost } = await loadConversation(req.params.id, req.auth!);
    if (info.muted) throw ApiError.forbidden('A moderator has muted you in this group for now. You can still read it.');
    if (!canPost) throw ApiError.forbidden(info.enabled ? 'You cannot post in this group.' : 'The organiser has switched off this group chat. You can still read it.');
    if (tooFast(req.auth!.id)) throw new ApiError(429, 'You are sending messages very quickly. Wait a moment.', 'rate_limited');
    if (input.kind === 'ANNOUNCEMENT' && !info.isOrganiser) throw ApiError.forbidden('Only the organiser can post announcements.');
    if (['IMAGE', 'VIDEO', 'VOICE', 'DOCUMENT'].includes(input.kind) && input.attachments.length === 0) throw ApiError.badRequest('Attach the file first.');
    if (conversation.subjectType === 'GAME_INVITE' && looksLikeExactLocation(input.body)) {
      throw ApiError.badRequest('For everyone’s safety, exact locations and map pins are not allowed in temporary gaming chats. Agree on a public place by name.');
    }
    if (input.replyToId && !(await prisma.message.findFirst({ where: { id: input.replyToId, conversationId: conversation.id }, select: { id: true } }))) throw ApiError.badRequest('That message is not in this chat.');
    const message = await prisma.message.create({
      data: { conversationId: conversation.id, userId: req.auth!.id, body: input.body, kind: input.kind, attachments: JSON.stringify(input.attachments), replyToId: input.replyToId ?? null },
      include: { author: true },
    });
    const dto = { ...toMessage(message, info.organiserUserId), author: { ...author(message.author), isOrganizer: message.author.id === info.organiserUserId } };
    broadcastMessage(conversation.id, dto as Parameters<typeof broadcastMessage>[1]);
    const members = await prisma.conversationMember.findMany({ where: { conversationId: conversation.id, userId: { not: req.auth!.id }, muted: false }, select: { userId: true } });
    const link = `/account/chats/${conversation.id}`;
    const recipients = members.map((m) => m.userId);
    if (input.kind === 'ANNOUNCEMENT') {
      await notifyMany(recipients, { type: 'ANNOUNCEMENT', title: `Announcement · ${info.title}`, body: input.body.slice(0, 160), link });
    } else {
      const already = new Set((await prisma.notification.findMany({ where: { userId: { in: recipients }, link, read: false, type: 'CHAT_MESSAGE' }, select: { userId: true } })).map((r) => r.userId));
      await notifyMany(recipients.filter((id) => !already.has(id)), { type: 'CHAT_MESSAGE', title: `New messages · ${info.title}`, body: `${dto.author.name}: ${input.body.slice(0, 120)}`, link });
    }
    res.status(201).json(dto);
  }),
);

groupChatsRouter.post(
  '/:id/messages/:messageId/pin',
  route(async (req, res) => {
    const { conversation, canModerate } = await loadConversation(req.params.id, req.auth!);
    if (!canModerate) throw ApiError.forbidden('Only the organiser can pin messages.');
    const existing = await prisma.message.findFirst({ where: { id: req.params.messageId, conversationId: conversation.id } });
    if (!existing) throw ApiError.notFound('That message does not exist.');
    await prisma.message.update({ where: { id: existing.id }, data: { pinned: !existing.pinned } });
    res.json({ pinned: !existing.pinned });
  }),
);

groupChatsRouter.post(
  '/:id/messages/:messageId/report',
  route(async (req, res) => {
    const { conversation, info } = await loadConversation(req.params.id, req.auth!);
    const input = z.object({ reason: z.string().trim().min(3, 'Say briefly what is wrong.').max(200), details: z.string().max(2000).optional() }).parse(req.body);
    const message = await prisma.message.findFirst({ where: { id: req.params.messageId, conversationId: conversation.id } });
    if (!message) throw ApiError.notFound('That message does not exist.');
    await prisma.report.create({ data: { reporterId: req.auth!.id, targetType: 'MESSAGE', targetId: message.id, reason: input.reason, details: `${info.title}: “${message.body.slice(0, 300)}”${input.details ? `\n${input.details}` : ''}` } });
    res.status(201).json({ reported: true });
  }),
);

groupChatsRouter.delete(
  '/:id/messages/:messageId',
  route(async (req, res) => {
    const { conversation, info, canModerate } = await loadConversation(req.params.id, req.auth!);
    const message = await prisma.message.findFirst({ where: { id: req.params.messageId, conversationId: conversation.id } });
    if (!message) throw ApiError.notFound('That message does not exist.');
    if (!canModerate && message.userId !== req.auth!.id) throw ApiError.forbidden('Only moderators can remove other people’s messages.');
    await prisma.message.delete({ where: { id: message.id } });
    await audit(req, { action: 'delete', entityType: 'messages', entityId: message.id, summary: `Removed a message in ${info.title}`, before: { body: message.body, userId: message.userId } });
    res.json({ removed: true });
  }),
);

groupChatsRouter.post(
  '/:id/mute',
  route(async (req, res) => {
    const { conversation } = await loadConversation(req.params.id, req.auth!);
    const muted = req.body?.muted !== false;
    await prisma.conversationMember.updateMany({ where: { conversationId: conversation.id, userId: req.auth!.id }, data: { muted } });
    res.json({ muted });
  }),
);

/** Close (read-only) or reopen the group. */
groupChatsRouter.post(
  '/:id/archive',
  route(async (req, res) => {
    const { conversation, info, canModerate } = await loadConversation(req.params.id, req.auth!);
    if (!canModerate) throw ApiError.forbidden('Only the organiser can close the group.');
    const archive = req.body?.archive !== false;
    await prisma.conversation.update({ where: { id: conversation.id }, data: { archivedAt: archive ? new Date() : null } });
    await audit(req, { action: 'update', entityType: 'conversations', entityId: conversation.id, summary: `${archive ? 'Closed' : 'Reopened'} the group chat for ${info.title}` });
    res.json({ archived: archive });
  }),
);

/** Shared study resources: every file, photo, video and voice note posted in the group. */
groupChatsRouter.get(
  '/:id/resources',
  route(async (req, res) => {
    const { conversation, info } = await loadConversation(req.params.id, req.auth!);
    const rows = await prisma.message.findMany({ where: { conversationId: conversation.id, kind: { in: ['DOCUMENT', 'IMAGE', 'VIDEO', 'VOICE'] } }, include: { author: true }, orderBy: { createdAt: 'desc' }, take: 200 });
    res.json({ items: rows.map((message) => ({ ...toMessage(message, info.organiserUserId), author: { ...author(message.author), isOrganizer: message.author.id === info.organiserUserId } })) });
  }),
);

/** React to a message (toggle). */
groupChatsRouter.post(
  '/:id/messages/:messageId/react',
  route(async (req, res) => {
    const { emoji } = z.object({ emoji: z.string().min(1).max(8) }).parse(req.body);
    const { conversation } = await loadConversation(req.params.id, req.auth!);
    const message = await prisma.message.findFirst({ where: { id: req.params.messageId, conversationId: conversation.id } });
    if (!message) throw ApiError.notFound('That message does not exist.');
    const existing = await prisma.messageReaction.findUnique({ where: { messageId_userId_emoji: { messageId: message.id, userId: req.auth!.id, emoji } } });
    if (existing) await prisma.messageReaction.delete({ where: { id: existing.id } });
    else await prisma.messageReaction.create({ data: { messageId: message.id, userId: req.auth!.id, emoji } });
    res.json({ reacted: !existing });
  }),
);
