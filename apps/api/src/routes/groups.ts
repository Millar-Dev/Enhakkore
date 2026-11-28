import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { COUNTRIES, slugify } from '@enhakkore/shared';
import { env } from '../env';
import { randomToken, sha256 } from '../lib/crypto';
import { ApiError, route } from '../lib/http';
import { shortCode } from '../lib/ids';
import { parseList } from '../lib/json';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthUser } from '../middleware/auth';
import { recordActivity } from '../services/activity';
import { notify, notifyMany, notifyStaff } from '../services/notifications';
import { expandQuery, scoreText } from '../services/semantic';

/**
 * Communities and study groups that members create (Phases 1E and 1F).
 *
 * - Published immediately, no routine approval. The team is notified and
 *   monitors reports; it can restrict, suspend and restore.
 * - Public groups: anyone eligible joins instantly.
 * - Private groups: listed with basic information only. Joining needs a
 *   valid invitation link or the group password (stored as a bcrypt hash;
 *   nobody, including the team, can read it — the owner can only reset it).
 *   Chat, members, files and sessions stay hidden from non-members.
 * - One main chat per group (the existing group-chat conversation).
 */
export const groupsMember = Router();
export const groupsPublic = Router();

const KINDS = ['COMMUNITY', 'STUDY_GROUP'] as const;
const createLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: env.isProduction ? 5 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'You have started several groups today. Try again tomorrow.' } },
});
const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProduction ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many attempts. Wait a few minutes and try again.' } },
});

const passwordRule = z.string().min(6, 'Use at least 6 characters for the group password.').max(100);

const createSchema = z
  .object({
    kind: z.enum(KINDS),
    name: z.string().trim().min(4, 'Give the group a name.').max(100),
    summary: z.string().trim().max(300).optional().or(z.literal('')),
    description: z.string().trim().min(20, 'Describe the group in a sentence or two.').max(4000),
    categoryId: z.string().max(60).optional().or(z.literal('')),
    subject: z.string().trim().max(120).optional().or(z.literal('')),
    topic: z.string().trim().max(120).optional().or(z.literal('')),
    course: z.string().trim().max(160).optional().or(z.literal('')),
    institution: z.string().trim().max(160).optional().or(z.literal('')),
    objectives: z.string().trim().max(2000).optional().or(z.literal('')),
    tags: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
    country: z.string().trim().max(80).optional().or(z.literal('')),
    city: z.string().trim().max(80).optional().or(z.literal('')),
    mode: z.enum(['IN_PERSON', 'ONLINE', 'BOTH']).default('ONLINE'),
    visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
    password: passwordRule.optional().or(z.literal('')),
    coverImage: z.string().url().optional().or(z.literal('')),
    schedule: z.string().trim().max(200).optional().or(z.literal('')),
    rules: z.string().trim().max(3000).optional().or(z.literal('')),
    contactName: z.string().trim().min(2, 'Your full name, for the team only.').max(120),
    contactPhone: z.string().trim().min(7, 'A phone number the team can reach you on (never shown to members).').max(40),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'STUDY_GROUP' && !value.subject) ctx.addIssue({ code: 'custom', path: ['subject'], message: 'Give the subject or field.' });
  });

async function place(countryName?: string, cityName?: string) {
  const code = COUNTRIES.find((item) => item.name === countryName)?.code;
  const country = code ? await prisma.country.findUnique({ where: { code } }) : null;
  const city = country && cityName ? await prisma.city.findUnique({ where: { countryId_slug: { countryId: country.id, slug: slugify(cityName) } } }) : null;
  return { countryId: country?.id ?? null, cityId: city?.id ?? null };
}

const isStaffFor = (auth: AuthUser) => auth.permissions.includes('*') || auth.permissions.includes('communities.edit') || auth.permissions.includes('communities.*');

async function membershipOf(communityId: string, userId: string) {
  return prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } } });
}

/** Group admin / moderator, or the Enhakkore team. */
async function manager(slug: string, auth: AuthUser, needAdmin = false) {
  const group = await prisma.community.findUnique({ where: { slug } });
  if (!group) throw ApiError.notFound('Group not found.');
  const me = await membershipOf(group.id, auth.id);
  const role = me?.status === 'ACTIVE' ? me.role : null;
  const staff = isStaffFor(auth);
  if (!(staff || role === 'ADMIN' || (!needAdmin && role === 'MODERATOR'))) {
    throw ApiError.forbidden(needAdmin ? 'Only the group admin can do that.' : 'Only the group’s admin and moderators can do that.');
  }
  return { group, role, staff };
}

/** Active member (or staff). Everything inside a group goes through here. */
async function insider(slug: string, auth: AuthUser) {
  const group = await prisma.community.findUnique({ where: { slug } });
  if (!group || group.status === 'ARCHIVED') throw ApiError.notFound('Group not found.');
  const me = await membershipOf(group.id, auth.id);
  const staff = isStaffFor(auth);
  if (me?.status !== 'ACTIVE' && !staff) throw ApiError.forbidden('Join the group to see this.');
  return { group, member: me?.status === 'ACTIVE' ? me : null, staff };
}

/* ---------------------------------- Create ---------------------------------- */

groupsMember.post(
  '/',
  requireAuth,
  createLimiter,
  route(async (req, res) => {
    const input = createSchema.parse(req.body);
    if (input.visibility === 'PRIVATE' && !input.password) {
      // A private group without a password is joined by invitation links only — allowed.
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.id } });
    if (user.status !== 'ACTIVE') throw ApiError.forbidden('Your account cannot create groups.');
    const category =
      (input.categoryId ? await prisma.category.findUnique({ where: { id: input.categoryId } }) : null) ??
      (input.kind === 'STUDY_GROUP' ? await prisma.category.findFirst({ where: { kind: 'ACTIVITY', name: 'Study Groups' } }) : null);
    let slug = slugify(input.name) || `group-${shortCode(4).toLowerCase()}`;
    if (await prisma.community.findUnique({ where: { slug } })) slug = `${slug}-${shortCode(4).toLowerCase()}`;
    const geo = await place(input.country, input.city);
    const group = await prisma.community.create({
      data: {
        slug,
        kind: input.kind,
        name: input.name,
        summary: input.summary || [input.subject, input.topic].filter(Boolean).join(' — ') || null,
        description: input.description,
        subject: input.subject || null,
        topic: input.topic || null,
        course: input.course || null,
        institution: input.institution || null,
        objectives: input.objectives || null,
        tags: JSON.stringify([...new Set(input.tags.map((tag) => tag.toLowerCase()))]),
        rules: input.rules || 'Be respectful, stay on topic and keep personal details private. No spam, no harassment, and only share material you are allowed to share.',
        categoryId: category?.id ?? null,
        ...geo,
        mode: input.mode,
        accessType: input.visibility === 'PRIVATE' ? 'PRIVATE' : 'FREE',
        passwordHash: input.visibility === 'PRIVATE' && input.password ? await bcrypt.hash(input.password, 12) : null,
        coverImage: input.coverImage || null,
        schedule: input.schedule || null,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        chatEnabled: true,
        createdById: user.id,
        members: { create: { userId: user.id, role: 'ADMIN', status: 'ACTIVE' } },
      },
    });
    const label = input.kind === 'STUDY_GROUP' ? 'study group' : 'community';
    await notifyStaff('communities.view', {
      type: 'ANNOUNCEMENT',
      title: `New ${label}: ${group.name}`,
      body: `${user.name} created a ${input.visibility.toLowerCase()} ${label}. It is live; review it if needed.`,
      link: `/admin/r/${input.kind === 'STUDY_GROUP' ? 'study-groups' : 'communities'}/${group.id}`,
    });
    await recordActivity({ userId: user.id, action: input.kind === 'STUDY_GROUP' ? 'CREATED_STUDY_GROUP' : 'CREATED_COMMUNITY', title: `Created ${group.name}`, link: `/experiences/communities/${group.slug}`, subjectType: 'COMMUNITY', subjectId: group.id });
    res.status(201).json({ slug: group.slug, id: group.id });
  }),
);

/* ----------------------------------- Join ----------------------------------- */

groupsMember.post(
  '/:slug/join',
  requireAuth,
  joinLimiter,
  route(async (req, res) => {
    const input = z.object({ password: z.string().max(100).optional(), invite: z.string().max(100).optional(), message: z.string().trim().max(1000).optional() }).parse(req.body ?? {});
    const group = await prisma.community.findFirst({ where: { slug: req.params.slug, status: { in: ['PUBLISHED', 'RESTRICTED'] } } });
    if (!group) throw ApiError.notFound('That group is not available.');
    if (group.status === 'RESTRICTED') throw ApiError.forbidden('This group is not accepting new members at the moment.');
    if (group.isDemo) throw ApiError.conflict('This is an example (DEMO) group, so it cannot be joined.');
    const key = { communityId_userId: { communityId: group.id, userId: req.auth!.id } };
    const existing = await prisma.communityMember.findUnique({ where: key });
    if (existing?.status === 'ACTIVE') return res.json({ joined: true, status: 'ACTIVE' });
    if (existing?.status === 'DECLINED' && existing.message === 'REMOVED') throw ApiError.forbidden('You were removed from this group and cannot rejoin.');

    if (group.accessType === 'PAID') throw ApiError.badRequest('This is a paid community. Use the membership request on its page.');
    let via: 'PUBLIC' | 'INVITE' | 'PASSWORD' = 'PUBLIC';
    if (group.accessType === 'PRIVATE') {
      if (input.invite) {
        const invite = await prisma.communityInvite.findUnique({ where: { tokenHash: sha256(input.invite) } });
        const valid = invite && invite.communityId === group.id && !invite.revokedAt && (!invite.expiresAt || invite.expiresAt > new Date()) && (invite.maxUses === null || invite.uses < invite.maxUses);
        if (!valid) throw ApiError.forbidden('This invitation link is no longer valid. Ask the group for a new one.');
        // Count the use atomically, so a limited link cannot be over-used.
        const used = await prisma.communityInvite.updateMany({ where: { id: invite!.id, ...(invite!.maxUses !== null ? { uses: { lt: invite!.maxUses } } : {}) }, data: { uses: { increment: 1 } } });
        if (used.count === 0) throw ApiError.forbidden('This invitation link has been used up. Ask the group for a new one.');
        via = 'INVITE';
      } else if (input.password) {
        if (!group.passwordHash || !(await bcrypt.compare(input.password, group.passwordHash))) throw ApiError.forbidden('That password is not right.');
        via = 'PASSWORD';
      } else {
        throw new ApiError(403, 'This is a private group. Join with an invitation link or the group password.', 'private_group');
      }
    }
    await prisma.communityMember.upsert({ where: key, create: { communityId: group.id, userId: req.auth!.id, status: 'ACTIVE' }, update: { status: 'ACTIVE', joinedAt: new Date(), message: null } });
    const conversation = await prisma.conversation.findUnique({ where: { subjectType_subjectId: { subjectType: 'COMMUNITY', subjectId: group.id } } });
    if (conversation) await prisma.conversationMember.upsert({ where: { conversationId_userId: { conversationId: conversation.id, userId: req.auth!.id } }, create: { conversationId: conversation.id, userId: req.auth!.id }, update: {} });
    await recordActivity({ userId: req.auth!.id, action: group.kind === 'STUDY_GROUP' ? 'JOINED_STUDY_GROUP' : 'JOINED_COMMUNITY', title: `Joined ${group.name}`, link: `/experiences/communities/${group.slug}`, subjectType: 'COMMUNITY', subjectId: group.id });
    res.json({ joined: true, status: 'ACTIVE', via });
  }),
);

/* -------------------------- Invitations and password ------------------------- */

groupsMember.get(
  '/:slug/invites',
  requireAuth,
  route(async (req, res) => {
    const { group } = await manager(req.params.slug, req.auth!);
    const rows = await prisma.communityInvite.findMany({ where: { communityId: group.id }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({
      hasPassword: !!group.passwordHash,
      items: rows.map((row) => ({ id: row.id, createdAt: row.createdAt, expiresAt: row.expiresAt, maxUses: row.maxUses, uses: row.uses, active: !row.revokedAt && (!row.expiresAt || row.expiresAt > new Date()) && (row.maxUses === null || row.uses < row.maxUses) })),
    });
  }),
);

/** A new invitation link. The token is shown once; only its hash is stored. */
groupsMember.post(
  '/:slug/invites',
  requireAuth,
  route(async (req, res) => {
    const input = z.object({ days: z.number().int().min(1).max(90).default(7), maxUses: z.number().int().min(1).max(1000).nullable().default(null) }).parse(req.body ?? {});
    const { group } = await manager(req.params.slug, req.auth!);
    const token = randomToken(18);
    await prisma.communityInvite.create({ data: { communityId: group.id, tokenHash: sha256(token), createdById: req.auth!.id, expiresAt: new Date(Date.now() + input.days * 86_400_000), maxUses: input.maxUses } });
    res.status(201).json({ link: `${env.appUrl}/experiences/communities/${group.slug}?invite=${token}`, token });
  }),
);

groupsMember.delete(
  '/:slug/invites/:id',
  requireAuth,
  route(async (req, res) => {
    const { group } = await manager(req.params.slug, req.auth!);
    await prisma.communityInvite.updateMany({ where: { id: req.params.id, communityId: group.id }, data: { revokedAt: new Date() } });
    res.json({ ok: true });
  }),
);

/** Set or reset the group password (group admin only). Nobody can read it back. */
groupsMember.put(
  '/:slug/password',
  requireAuth,
  route(async (req, res) => {
    const { password } = z.object({ password: passwordRule.nullable() }).parse(req.body);
    const { group } = await manager(req.params.slug, req.auth!, true);
    if (group.accessType !== 'PRIVATE') throw ApiError.badRequest('Only private groups use a password.');
    await prisma.community.update({ where: { id: group.id }, data: { passwordHash: password ? await bcrypt.hash(password, 12) : null } });
    res.json({ ok: true, hasPassword: !!password });
  }),
);

/** Change public / private. */
groupsMember.put(
  '/:slug/visibility',
  requireAuth,
  route(async (req, res) => {
    const input = z.object({ visibility: z.enum(['PUBLIC', 'PRIVATE']), password: passwordRule.optional() }).parse(req.body);
    const { group } = await manager(req.params.slug, req.auth!, true);
    if (group.accessType === 'PAID') throw ApiError.badRequest('Paid communities are managed by the Enhakkore team.');
    await prisma.community.update({
      where: { id: group.id },
      data: { accessType: input.visibility === 'PRIVATE' ? 'PRIVATE' : 'FREE', ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 12) } : input.visibility === 'PUBLIC' ? { passwordHash: null } : {}) },
    });
    res.json({ ok: true });
  }),
);

/* ---------------------------------- Sessions --------------------------------- */

const sessionSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  mode: z.enum(['ONLINE', 'PHYSICAL', 'HYBRID']).default('ONLINE'),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  location: z.string().trim().max(200).optional().or(z.literal('')),
  link: z.string().url().max(500).optional().or(z.literal('')),
});

groupsMember.get(
  '/:slug/sessions',
  requireAuth,
  route(async (req, res) => {
    const { group } = await insider(req.params.slug, req.auth!);
    const rows = await prisma.groupSession.findMany({
      where: { communityId: group.id, cancelledAt: null, startsAt: { gte: new Date(Date.now() - 6 * 3600 * 1000) } },
      include: { rsvps: { select: { userId: true, status: true } } },
      orderBy: { startsAt: 'asc' },
      take: 50,
    });
    res.json({
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        mode: row.mode,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        location: row.location,
        link: row.link,
        going: row.rsvps.filter((rsvp) => rsvp.status === 'GOING').length,
        maybe: row.rsvps.filter((rsvp) => rsvp.status === 'MAYBE').length,
        myRsvp: row.rsvps.find((rsvp) => rsvp.userId === req.auth!.id)?.status ?? null,
      })),
    });
  }),
);

groupsMember.post(
  '/:slug/sessions',
  requireAuth,
  route(async (req, res) => {
    const input = sessionSchema.parse(req.body);
    const { group } = await manager(req.params.slug, req.auth!);
    if (input.startsAt.getTime() < Date.now() - 60_000) throw ApiError.badRequest('Choose a time in the future.');
    if (input.mode !== 'ONLINE' && !input.location) throw ApiError.badRequest('Give the meeting place for an in-person session.');
    if (input.mode !== 'PHYSICAL' && !input.link) throw ApiError.badRequest('Give the online meeting link.');
    const session = await prisma.groupSession.create({
      data: { communityId: group.id, title: input.title, description: input.description || null, mode: input.mode, startsAt: input.startsAt, endsAt: input.endsAt ?? null, location: input.location || null, link: input.link || null, createdById: req.auth!.id },
    });
    const members = await prisma.communityMember.findMany({ where: { communityId: group.id, status: 'ACTIVE', userId: { not: req.auth!.id } }, select: { userId: true } });
    await notifyMany(members.map((row) => row.userId), {
      type: group.kind === 'STUDY_GROUP' ? 'STUDY_GROUP' : 'COMMUNITY_ANNOUNCEMENT',
      title: `New session · ${group.name}`,
      body: `${session.title} — ${session.startsAt.toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
      link: `/experiences/communities/${group.slug}#sessions`,
    });
    res.status(201).json({ id: session.id });
  }),
);

groupsMember.post(
  '/:slug/sessions/:id/rsvp',
  requireAuth,
  route(async (req, res) => {
    const { status } = z.object({ status: z.enum(['GOING', 'MAYBE', 'NOT_GOING']) }).parse(req.body);
    const { group } = await insider(req.params.slug, req.auth!);
    const session = await prisma.groupSession.findFirst({ where: { id: req.params.id, communityId: group.id, cancelledAt: null } });
    if (!session) throw ApiError.notFound('That session is not available.');
    await prisma.groupSessionRsvp.upsert({ where: { sessionId_userId: { sessionId: session.id, userId: req.auth!.id } }, create: { sessionId: session.id, userId: req.auth!.id, status }, update: { status } });
    res.json({ ok: true, status });
  }),
);

groupsMember.delete(
  '/:slug/sessions/:id',
  requireAuth,
  route(async (req, res) => {
    const { group } = await manager(req.params.slug, req.auth!);
    const session = await prisma.groupSession.findFirst({ where: { id: req.params.id, communityId: group.id }, include: { rsvps: { where: { status: { in: ['GOING', 'MAYBE'] } } } } });
    if (!session) throw ApiError.notFound();
    await prisma.groupSession.update({ where: { id: session.id }, data: { cancelledAt: new Date() } });
    await notifyMany(session.rsvps.map((rsvp) => rsvp.userId), { type: 'STUDY_GROUP', title: `Session cancelled · ${group.name}`, body: session.title, link: `/experiences/communities/${group.slug}#sessions` });
    res.json({ ok: true });
  }),
);

/* --------------------------------- Resources -------------------------------- */

groupsMember.get(
  '/:slug/resources',
  requireAuth,
  route(async (req, res) => {
    const { group } = await insider(req.params.slug, req.auth!);
    const rows = await prisma.groupResource.findMany({ where: { communityId: group.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 200 });
    const authors = new Map((await prisma.user.findMany({ where: { id: { in: rows.map((row) => row.createdById) } }, select: { id: true, name: true, username: true } })).map((user) => [user.id, user]));
    res.json({
      items: rows.map((row) => {
        const author = authors.get(row.createdById);
        return { id: row.id, kind: row.kind, title: row.title, body: row.body, url: row.url, createdAt: row.createdAt, mine: row.createdById === req.auth!.id, author: author ? (author.username ? `@${author.username}` : author.name.split(' ')[0]) : 'Member' };
      }),
    });
  }),
);

groupsMember.post(
  '/:slug/resources',
  requireAuth,
  route(async (req, res) => {
    const input = z
      .object({ kind: z.enum(['NOTE', 'FILE', 'LINK']), title: z.string().trim().min(2).max(160), body: z.string().trim().max(20_000).optional().or(z.literal('')), url: z.string().url().max(600).optional().or(z.literal('')) })
      .parse(req.body);
    const { group, member } = await insider(req.params.slug, req.auth!);
    if (member?.mutedUntil && member.mutedUntil > new Date()) throw ApiError.forbidden('A moderator has muted you in this group for now.');
    if (input.kind === 'NOTE' && !input.body) throw ApiError.badRequest('Write the note.');
    if (input.kind !== 'NOTE' && !input.url) throw ApiError.badRequest(input.kind === 'FILE' ? 'Upload the file first.' : 'Paste the link.');
    const resource = await prisma.groupResource.create({ data: { communityId: group.id, kind: input.kind, title: input.title, body: input.body || null, url: input.url || null, createdById: req.auth!.id } });
    res.status(201).json({ id: resource.id });
  }),
);

groupsMember.delete(
  '/:slug/resources/:id',
  requireAuth,
  route(async (req, res) => {
    const { group, member, staff } = await insider(req.params.slug, req.auth!);
    const resource = await prisma.groupResource.findFirst({ where: { id: req.params.id, communityId: group.id, deletedAt: null } });
    if (!resource) throw ApiError.notFound();
    const canModerate = staff || member?.role === 'ADMIN' || member?.role === 'MODERATOR';
    if (resource.createdById !== req.auth!.id && !canModerate) throw ApiError.forbidden('Only the person who shared it, or a moderator, can remove it.');
    await prisma.groupResource.update({ where: { id: resource.id }, data: { deletedAt: new Date() } });
    res.json({ ok: true });
  }),
);

/* ------------------------------- Chat inbox ---------------------------------- */

/**
 * The member's group conversations with the latest message and unread count —
 * the "My Study Groups" and "My Group Chats" inboxes. One conversation per group.
 */
groupsMember.get(
  '/inbox',
  requireAuth,
  route(async (req, res) => {
    const kind = typeof req.query.kind === 'string' && (KINDS as readonly string[]).includes(req.query.kind) ? (req.query.kind as (typeof KINDS)[number]) : null;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase().slice(0, 60) : '';
    const memberships = await prisma.communityMember.findMany({
      where: { userId: req.auth!.id, status: 'ACTIVE', community: { status: { in: ['PUBLISHED', 'RESTRICTED'] }, ...(kind ? { kind } : {}) } },
      include: { community: { select: { id: true, slug: true, name: true, kind: true, subject: true, coverImage: true, accessType: true, chatEnabled: true, _count: { select: { members: { where: { status: 'ACTIVE' } } } } } } },
    });
    const items = [];
    for (const membership of memberships) {
      const group = membership.community;
      if (q && !`${group.name} ${group.subject ?? ''}`.toLowerCase().includes(q)) continue;
      // The single main chat of the group, created on first use.
      let conversation = await prisma.conversation.findUnique({ where: { subjectType_subjectId: { subjectType: 'COMMUNITY', subjectId: group.id } } });
      if (!conversation && group.chatEnabled) {
        conversation = await prisma.conversation
          .create({ data: { subjectType: 'COMMUNITY', subjectId: group.id, title: group.name, kind: 'GROUP' } })
          .catch(async () => prisma.conversation.findUnique({ where: { subjectType_subjectId: { subjectType: 'COMMUNITY', subjectId: group.id } } }));
      }
      let lastMessage = null;
      let unread = 0;
      if (conversation) {
        const seat = await prisma.conversationMember.upsert({
          where: { conversationId_userId: { conversationId: conversation.id, userId: req.auth!.id } },
          create: { conversationId: conversation.id, userId: req.auth!.id, lastReadAt: membership.joinedAt },
          update: {},
        });
        const last = await prisma.message.findFirst({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true, username: true } } } });
        if (last) lastMessage = { preview: last.deletedAt ? 'Message removed' : last.kind === 'TEXT' || last.kind === 'ANNOUNCEMENT' ? last.body.slice(0, 100) : `[${last.kind.toLowerCase()}]`, author: last.author.username ? `@${last.author.username}` : last.author.name.split(' ')[0], createdAt: last.createdAt };
        unread = await prisma.message.count({ where: { conversationId: conversation.id, userId: { not: req.auth!.id }, createdAt: { gt: seat.lastReadAt ?? membership.joinedAt } } });
      }
      items.push({
        id: group.id,
        slug: group.slug,
        name: group.name,
        kind: group.kind,
        subject: group.subject,
        coverImage: group.coverImage,
        private: group.accessType === 'PRIVATE',
        role: membership.role,
        memberCount: group._count.members,
        conversationId: conversation?.id ?? null,
        lastMessage,
        unread,
        updatedAt: lastMessage?.createdAt ?? membership.joinedAt,
      });
    }
    items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json({ items });
  }),
);

/* ---------------------------------- Search ---------------------------------- */

/**
 * Meaning-aware search over study groups (and communities with ?kind=COMMUNITY).
 * Private groups are matched on their public basics only — never on their
 * chat, resources or members.
 */
groupsPublic.get(
  '/groups/search',
  route(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
    const kind = req.query.kind === 'COMMUNITY' ? 'COMMUNITY' : 'STUDY_GROUP';
    const rows = await prisma.community.findMany({
      where: { kind, status: 'PUBLISHED' },
      include: { category: true, city: true, country: true, _count: { select: { members: { where: { status: 'ACTIVE' } } } } },
      take: 500,
    });
    const card = (row: (typeof rows)[number]) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      summary: row.summary,
      subject: row.subject,
      topic: row.topic,
      course: row.course,
      institution: row.institution,
      mode: row.mode,
      private: row.accessType === 'PRIVATE',
      official: row.official,
      isDemo: row.isDemo,
      coverImage: row.coverImage,
      tags: parseList(row.tags),
      memberCount: row._count.members,
      city: row.city?.name ?? null,
      country: row.country?.name ?? null,
    });
    if (!q) {
      return res.json({ items: rows.sort((a, b) => b._count.members - a._count.members).slice(0, 60).map((row) => ({ ...card(row), score: 0, matchedIn: [] })), expanded: [] });
    }
    const query = expandQuery(q);
    const publicIds = rows.filter((row) => row.accessType !== 'PRIVATE').map((row) => row.id);
    // Public groups only: resource titles and recent chat messages count too.
    const [resources, conversations] = await Promise.all([
      prisma.groupResource.findMany({ where: { communityId: { in: publicIds }, deletedAt: null }, select: { communityId: true, title: true } }),
      prisma.conversation.findMany({ where: { subjectType: 'COMMUNITY', subjectId: { in: publicIds } }, select: { id: true, subjectId: true } }),
    ]);
    const messages = conversations.length
      ? await prisma.message.findMany({ where: { conversationId: { in: conversations.map((c) => c.id) }, deletedAt: null, kind: { in: ['TEXT', 'ANNOUNCEMENT'] } }, select: { conversationId: true, body: true }, orderBy: { createdAt: 'desc' }, take: 3000 })
      : [];
    const subjectOf = new Map(conversations.map((c) => [c.id, c.subjectId!]));
    const resourceText = new Map<string, string>();
    for (const item of resources) resourceText.set(item.communityId, `${resourceText.get(item.communityId) ?? ''} ${item.title}`);
    const discussionText = new Map<string, string>();
    for (const item of messages) {
      const id = subjectOf.get(item.conversationId)!;
      discussionText.set(id, `${discussionText.get(id) ?? ''} ${item.body}`.slice(0, 20_000));
    }
    const scored = rows
      .map((row) => {
        const parts: [string, number][] = [
          ['name', scoreText(row.name, query, 5)],
          ['subject', scoreText(`${row.subject ?? ''} ${row.topic ?? ''}`, query, 4)],
          ['course', scoreText(row.course, query, 4)],
          ['tags', scoreText(parseList(row.tags).join(' '), query, 3)],
          ['institution', scoreText(row.institution, query, 2)],
          ['objectives', scoreText(row.objectives, query, 2)],
          ['description', scoreText(`${row.summary ?? ''} ${row.description ?? ''}`, query, 1)],
          ['category', scoreText(row.category?.name, query, 1)],
        ];
        if (row.accessType !== 'PRIVATE') {
          parts.push(['resources', scoreText(resourceText.get(row.id), query, 2)]);
          parts.push(['discussions', Math.min(6, scoreText(discussionText.get(row.id), query, 1))]);
        }
        return { row, score: parts.reduce((sum, [, value]) => sum + value, 0), matchedIn: parts.filter(([, value]) => value > 0).map(([name]) => name) };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.row._count.members - a.row._count.members)
      .slice(0, 60);
    res.json({ items: scored.map((item) => ({ ...card(item.row), score: item.score, matchedIn: item.matchedIn })), expanded: query.related.slice(0, 12) });
  }),
);

/** Sends due session reminders (called every few minutes by the server). */
export async function sendSessionReminders() {
  const soon = new Date(Date.now() + 60 * 60 * 1000);
  const due = await prisma.groupSession.findMany({
    where: { cancelledAt: null, reminderSentAt: null, startsAt: { gt: new Date(), lte: soon } },
    include: { rsvps: { where: { status: { in: ['GOING', 'MAYBE'] } } }, community: { select: { name: true, slug: true, kind: true } } },
    take: 100,
  });
  for (const session of due) {
    const claimed = await prisma.groupSession.updateMany({ where: { id: session.id, reminderSentAt: null }, data: { reminderSentAt: new Date() } });
    if (claimed.count === 0) continue;
    for (const rsvp of session.rsvps) {
      await notify({
        userId: rsvp.userId,
        type: 'SESSION_REMINDER',
        title: `Starting within the hour · ${session.community.name}`,
        body: `${session.title}${session.mode === 'ONLINE' ? ' (online)' : session.location ? ` · ${session.location}` : ''}`,
        link: `/experiences/communities/${session.community.slug}#sessions`,
        dedupeKey: `session-reminder:${session.id}`,
      });
    }
  }
}
