import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { COUNTRIES, slugify } from '@enhakkore/shared';
import { env } from '../env';
import { ApiError, route } from '../lib/http';
import { shortCode } from '../lib/ids';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { audit } from '../services/audit';
import { notify, notifyMany } from '../services/notifications';

/**
 * Study groups: any signed-in member can start one without prior approval.
 * The creator becomes the group admin and can appoint moderators, approve
 * members of a private group, mute or remove people and remove messages.
 * The Enhakkore team can step in on any group (Communities in the control
 * centre, reports and the group chats list).
 */
export const studyGroupsRouter = Router();
studyGroupsRouter.use(requireAuth);

const createLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: env.isProduction ? 5 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'You have started several groups today. Try again tomorrow.' } },
});

const groupSchema = z.object({
  name: z.string().trim().min(4, 'Give the group a name.').max(100),
  subject: z.string().trim().min(2, 'Give the subject or field.').max(120),
  topic: z.string().trim().max(120).optional().or(z.literal('')),
  description: z.string().trim().min(20, 'Describe the group in a sentence or two.').max(3000),
  institution: z.string().trim().max(160).optional().or(z.literal('')),
  country: z.string().trim().max(80).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  mode: z.enum(['IN_PERSON', 'ONLINE', 'BOTH']).default('ONLINE'),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  coverImage: z.string().url().optional().or(z.literal('')),
  schedule: z.string().trim().max(200).optional().or(z.literal('')),
  rules: z.string().trim().max(3000).optional().or(z.literal('')),
});

async function place(countryName?: string, cityName?: string) {
  const code = COUNTRIES.find((item) => item.name === countryName)?.code;
  const country = code ? await prisma.country.findUnique({ where: { code } }) : null;
  const city = country && cityName ? await prisma.city.findUnique({ where: { countryId_slug: { countryId: country.id, slug: slugify(cityName) } } }) : null;
  return { countryId: country?.id ?? null, cityId: city?.id ?? null };
}

/** Starts a study group. Published at once; the creator is its admin. */
studyGroupsRouter.post(
  '/',
  createLimiter,
  route(async (req, res) => {
    const input = groupSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.id } });
    if (user.status !== 'ACTIVE') throw ApiError.forbidden('Your account cannot create groups.');
    const category = await prisma.category.findFirst({ where: { kind: 'ACTIVITY', name: 'Study Groups' } });
    let slug = slugify(input.name) || `study-group-${shortCode(4).toLowerCase()}`;
    if (await prisma.community.findUnique({ where: { slug } })) slug = `${slug}-${shortCode(4).toLowerCase()}`;
    const geo = await place(input.country, input.city);
    const group = await prisma.community.create({
      data: {
        slug,
        kind: 'STUDY_GROUP',
        name: input.name,
        subject: input.subject,
        topic: input.topic || null,
        institution: input.institution || null,
        summary: [input.subject, input.topic].filter(Boolean).join(' — '),
        description: input.description,
        rules: input.rules || 'Stay on topic, be respectful, and keep personal details private. No sharing of material you are not allowed to share.',
        categoryId: category?.id ?? null,
        ...geo,
        mode: input.mode,
        accessType: input.visibility === 'PRIVATE' ? 'PRIVATE' : 'FREE',
        coverImage: input.coverImage || null,
        schedule: input.schedule || null,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        chatEnabled: true,
        createdById: user.id,
        members: { create: { userId: user.id, role: 'ADMIN', status: 'ACTIVE' } },
      },
    });
    res.status(201).json({ slug: group.slug, id: group.id });
  }),
);

/** The study groups the member belongs to, has asked to join, or runs. */
studyGroupsRouter.get(
  '/mine',
  route(async (req, res) => {
    const rows = await prisma.communityMember.findMany({
      where: { userId: req.auth!.id, community: { kind: 'STUDY_GROUP', status: { not: 'ARCHIVED' } }, status: { not: 'DECLINED' } },
      include: { community: { include: { _count: { select: { members: { where: { status: 'ACTIVE' } } } } } } },
      orderBy: { joinedAt: 'desc' },
    });
    res.json({
      items: rows.map((row) => ({
        id: row.community.id,
        slug: row.community.slug,
        name: row.community.name,
        subject: row.community.subject,
        topic: row.community.topic,
        role: row.role,
        status: row.status,
        private: row.community.accessType === 'PRIVATE',
        memberCount: row.community._count.members,
      })),
    });
  }),
);

/** Loads a group the viewer manages (group admin or moderator), or Enhakkore staff with communities.edit. */
async function managed(slug: string, auth: NonNullable<Express.Request['auth']>, needAdmin = false) {
  const group = await prisma.community.findFirst({ where: { slug, kind: 'STUDY_GROUP' } });
  if (!group) throw ApiError.notFound('Study group not found.');
  const me = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId: group.id, userId: auth.id } } });
  const staff = auth.permissions.includes('*') || auth.permissions.includes('communities.edit') || auth.permissions.includes('communities.*');
  const role = me?.status === 'ACTIVE' ? me.role : null;
  const allowed = staff || role === 'ADMIN' || (!needAdmin && role === 'MODERATOR');
  if (!allowed) throw ApiError.forbidden(needAdmin ? 'Only the group admin can do that.' : 'Only the group’s admin and moderators can do that.');
  return { group, role, staff };
}

/** Members and requests, for the group admin and moderators. Usernames only — no contact details. */
studyGroupsRouter.get(
  '/:slug/members',
  route(async (req, res) => {
    const { group, role, staff } = await managed(req.params.slug, req.auth!);
    const rows = await prisma.communityMember.findMany({
      where: { communityId: group.id, status: { not: 'DECLINED' } },
      include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
      orderBy: [{ status: 'desc' }, { joinedAt: 'asc' }],
    });
    res.json({
      viewerRole: role ?? (staff ? 'STAFF' : null),
      items: rows.map((row) => ({
        userId: row.user.id,
        name: row.user.username ? `@${row.user.username}` : row.user.name.split(' ')[0],
        avatarUrl: row.user.avatarUrl,
        role: row.role,
        status: row.status,
        message: row.message,
        mutedUntil: row.mutedUntil,
        joinedAt: row.joinedAt,
      })),
    });
  }),
);

const memberAction = z.object({
  action: z.enum(['approve', 'decline', 'remove', 'moderator', 'member', 'mute', 'unmute']),
  /** Hours, for mute. */
  hours: z.number().int().min(1).max(24 * 30).default(24),
});

studyGroupsRouter.post(
  '/:slug/members/:userId',
  route(async (req, res) => {
    const input = memberAction.parse(req.body);
    const needsAdmin = input.action === 'moderator' || input.action === 'member';
    const { group } = await managed(req.params.slug, req.auth!, needsAdmin);
    const target = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId: group.id, userId: req.params.userId } } });
    if (!target) throw ApiError.notFound('That person is not in this group.');
    if (target.role === 'ADMIN' && req.params.userId !== req.auth!.id) throw ApiError.forbidden('The group admin cannot be changed here. Ask the Enhakkore team.');
    const where = { communityId_userId: { communityId: group.id, userId: target.userId } };
    const link = `/experiences/communities/${group.slug}`;
    switch (input.action) {
      case 'approve':
        await prisma.communityMember.update({ where, data: { status: 'ACTIVE' } });
        await notify({ userId: target.userId, type: 'ENQUIRY_UPDATE', title: `Welcome to ${group.name}`, body: 'Your request to join was approved.', link });
        break;
      case 'decline':
        await prisma.communityMember.update({ where, data: { status: 'DECLINED' } });
        await notify({ userId: target.userId, type: 'ENQUIRY_UPDATE', title: `${group.name}: request not approved`, body: 'The group admin did not approve your request.', link });
        break;
      case 'remove':
        await prisma.communityMember.delete({ where });
        await prisma.conversationMember.deleteMany({ where: { userId: target.userId, conversation: { subjectType: 'COMMUNITY', subjectId: group.id } } });
        break;
      case 'moderator':
      case 'member':
        await prisma.communityMember.update({ where, data: { role: input.action === 'moderator' ? 'MODERATOR' : 'MEMBER' } });
        break;
      case 'mute':
        await prisma.communityMember.update({ where, data: { mutedUntil: new Date(Date.now() + input.hours * 3600000) } });
        break;
      case 'unmute':
        await prisma.communityMember.update({ where, data: { mutedUntil: null } });
        break;
    }
    await audit(req, { action: 'update', entityType: 'communities', entityId: group.id, summary: `Study group ${group.name}: ${input.action} member ${target.userId}` });
    res.json({ ok: true });
  }),
);

/** The group admin edits the group. */
studyGroupsRouter.patch(
  '/:slug',
  route(async (req, res) => {
    const { group } = await managed(req.params.slug, req.auth!, true);
    const input = groupSchema.partial().parse(req.body);
    const geo = input.country !== undefined ? await place(input.country, input.city) : {};
    await prisma.community.update({
      where: { id: group.id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.subject ? { subject: input.subject } : {}),
        ...(input.topic !== undefined ? { topic: input.topic || null } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.institution !== undefined ? { institution: input.institution || null } : {}),
        ...(input.mode ? { mode: input.mode } : {}),
        ...(input.visibility ? { accessType: input.visibility === 'PRIVATE' ? 'PRIVATE' : 'FREE' } : {}),
        ...(input.coverImage !== undefined ? { coverImage: input.coverImage || null } : {}),
        ...(input.schedule !== undefined ? { schedule: input.schedule || null } : {}),
        ...(input.rules ? { rules: input.rules } : {}),
        ...geo,
      },
    });
    res.json({ ok: true });
  }),
);

/** The group admin posts an announcement: every member is notified. */
studyGroupsRouter.post(
  '/:slug/announcements',
  route(async (req, res) => {
    const { group } = await managed(req.params.slug, req.auth!);
    const input = z.object({ title: z.string().trim().min(3).max(160), body: z.string().trim().min(3).max(4000) }).parse(req.body);
    const item = await prisma.communityAnnouncement.create({ data: { communityId: group.id, authorId: req.auth!.id, title: input.title, body: input.body } });
    const members = await prisma.communityMember.findMany({ where: { communityId: group.id, status: 'ACTIVE', userId: { not: req.auth!.id } }, select: { userId: true } });
    await notifyMany(members.map((row) => row.userId), { type: 'COMMUNITY_ANNOUNCEMENT', title: `${group.name}: ${input.title}`, body: input.body.slice(0, 160), link: `/experiences/communities/${group.slug}` });
    res.status(201).json(item);
  }),
);
