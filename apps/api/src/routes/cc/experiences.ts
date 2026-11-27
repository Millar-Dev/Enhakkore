import { Router } from 'express';
import { z } from 'zod';
import { ENTRY_STATUSES, SESSION_STATUSES, localToUtc } from '@enhakkore/shared';
import { ApiError, pageParams, paginated, route } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { assertPermission } from '../../middleware/auth';
import { audit } from '../../services/audit';
import { notify, notifyMany } from '../../services/notifications';
import { engagementTotals } from '../../services/popularity';
import { whatsappConfigured } from '../../services/whatsapp';

/**
 * Control-centre operations for Experiences and the platform's plumbing:
 * recurring sessions and attendance, tournament entries, community
 * announcements, trip group chats, notification deliveries and analytics.
 */
export const ccExperiencesRouter = Router();

/* ----------------------------- Activity sessions --------------------------- */

const sessionSchema = z.object({
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'Choose a date and time.'),
  endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/).optional().or(z.literal('')),
  meetingPoint: z.string().trim().max(200).optional().or(z.literal('')),
  route: z.string().trim().max(500).optional().or(z.literal('')),
  capacity: z.number().int().min(1).max(100000).optional().nullable(),
  status: z.enum(SESSION_STATUSES).default('SCHEDULED'),
  notice: z.string().trim().max(1000).optional().or(z.literal('')),
});

ccExperiencesRouter.get(
  '/activities/:id/sessions',
  route(async (req, res) => {
    assertPermission(req, 'activities.view');
    const activity = await prisma.activity.findUniqueOrThrow({ where: { id: req.params.id } });
    const sessions = await prisma.activitySession.findMany({
      where: { activityId: activity.id },
      include: { registrations: { include: { user: { select: { id: true, name: true, phone: true } } }, orderBy: { createdAt: 'asc' } } },
      orderBy: { startsAt: 'desc' },
    });
    res.json({ timezone: activity.timezone, items: sessions });
  }),
);

/** Adds one session, or a weekly series (`repeatWeeks`) in the activity's local time. */
ccExperiencesRouter.post(
  '/activities/:id/sessions',
  route(async (req, res) => {
    assertPermission(req, 'activities.edit');
    const input = sessionSchema.extend({ repeatWeeks: z.number().int().min(1).max(26).default(1) }).parse(req.body);
    const activity = await prisma.activity.findUniqueOrThrow({ where: { id: req.params.id } });
    const created = [];
    for (let week = 0; week < input.repeatWeeks; week += 1) {
      const start = localToUtc(input.startsAt.slice(0, 16), activity.timezone);
      if (!start) throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', { startsAt: 'Choose a date and time.' });
      const end = input.endsAt ? localToUtc(input.endsAt.slice(0, 16), activity.timezone) : null;
      const shift = week * 7 * 86400000;
      created.push(
        await prisma.activitySession.create({
          data: {
            activityId: activity.id,
            startsAt: new Date(start.getTime() + shift),
            endsAt: end ? new Date(end.getTime() + shift) : null,
            meetingPoint: input.meetingPoint || null,
            route: input.route || null,
            capacity: input.capacity ?? null,
            status: input.status,
            notice: input.notice || null,
          },
        }),
      );
    }
    await audit(req, { action: 'create', entityType: 'activities', entityId: activity.id, summary: `Added ${created.length} session(s) to ${activity.title}` });
    res.status(201).json({ items: created });
  }),
);

/** Changes or cancels a session; registered members are told. */
ccExperiencesRouter.patch(
  '/sessions/:id',
  route(async (req, res) => {
    assertPermission(req, 'activities.edit');
    const input = sessionSchema.partial().parse(req.body);
    const before = await prisma.activitySession.findUniqueOrThrow({ where: { id: req.params.id }, include: { activity: true } });
    const zone = before.activity.timezone;
    const session = await prisma.activitySession.update({
      where: { id: before.id },
      data: {
        ...(input.startsAt ? { startsAt: localToUtc(input.startsAt.slice(0, 16), zone) ?? before.startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt ? localToUtc(input.endsAt.slice(0, 16), zone) : null } : {}),
        ...(input.meetingPoint !== undefined ? { meetingPoint: input.meetingPoint || null } : {}),
        ...(input.route !== undefined ? { route: input.route || null } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity ?? null } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.notice !== undefined ? { notice: input.notice || null } : {}),
      },
    });
    const changed = input.status === 'CANCELLED' || input.status === 'CHANGED' || !!input.startsAt || input.meetingPoint !== undefined;
    if (changed) {
      const registered = await prisma.sessionRegistration.findMany({ where: { sessionId: session.id, status: 'REGISTERED' }, select: { userId: true } });
      await notifyMany(
        registered.map((row) => row.userId),
        {
          type: 'EVENT_CHANGE',
          title: `${session.status === 'CANCELLED' ? 'Cancelled' : 'Changed'}: ${before.activity.title}`,
          body: session.notice ?? `The session on ${session.startsAt.toISOString().slice(0, 10)} was ${session.status === 'CANCELLED' ? 'cancelled' : 'changed'}.`,
          link: `/activities/${before.activity.slug}`,
        },
      );
    }
    await audit(req, { action: 'update', entityType: 'activities', entityId: before.activityId, summary: `Updated a session of ${before.activity.title}`, before: { startsAt: before.startsAt, status: before.status }, after: { startsAt: session.startsAt, status: session.status } });
    res.json(session);
  }),
);

ccExperiencesRouter.delete(
  '/sessions/:id',
  route(async (req, res) => {
    assertPermission(req, 'activities.delete');
    const session = await prisma.activitySession.findUniqueOrThrow({ where: { id: req.params.id }, include: { _count: { select: { registrations: true } } } });
    if (session._count.registrations > 0) throw ApiError.conflict('Members registered for this session. Cancel it instead, so they are told.');
    await prisma.activitySession.delete({ where: { id: session.id } });
    res.json({ deleted: true });
  }),
);

ccExperiencesRouter.patch(
  '/session-registrations/:id',
  route(async (req, res) => {
    assertPermission(req, 'activities.edit');
    const input = z.object({ attended: z.boolean() }).parse(req.body);
    const row = await prisma.sessionRegistration.update({ where: { id: req.params.id }, data: { attended: input.attended } });
    res.json(row);
  }),
);

/* ------------------------------ Tournament entries -------------------------- */

ccExperiencesRouter.get(
  '/tournaments/:id/entries',
  route(async (req, res) => {
    assertPermission(req, 'gaming.view');
    const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id } });
    const items = await prisma.tournamentEntry.findMany({
      where: { tournamentId: tournament.id },
      include: { captain: { select: { id: true, name: true, email: true, phone: true } }, members: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ tournament: { id: tournament.id, title: tournament.title, format: tournament.format, teamSize: tournament.teamSize, slots: tournament.slots }, items });
  }),
);

ccExperiencesRouter.patch(
  '/entries/:id',
  route(async (req, res) => {
    assertPermission(req, 'gaming.edit');
    const input = z.object({ status: z.enum(ENTRY_STATUSES).optional(), adminNotes: z.string().max(2000).optional() }).parse(req.body);
    const before = await prisma.tournamentEntry.findUniqueOrThrow({ where: { id: req.params.id }, include: { tournament: true, members: true } });
    const entry = await prisma.tournamentEntry.update({ where: { id: before.id }, data: input });
    if (input.status && input.status !== before.status) {
      await notifyMany([before.captainId, ...before.members.map((member) => member.userId)], {
        type: 'REGISTRATION_CONFIRMED',
        title: `${before.tournament.title}: ${input.status.toLowerCase()}`,
        body: before.teamName ? `Team ${before.teamName}` : `Reference ${before.reference}`,
        link: `/experiences/gaming/${before.tournament.slug}`,
      });
    }
    await audit(req, { action: 'update', entityType: 'tournaments', entityId: before.tournamentId, summary: `Entry ${before.reference} → ${entry.status}`, before: { status: before.status }, after: { status: entry.status } });
    res.json(entry);
  }),
);

/* --------------------------------- Communities ----------------------------- */

ccExperiencesRouter.get(
  '/communities/:id/members',
  route(async (req, res) => {
    assertPermission(req, 'communities.view');
    const community = await prisma.community.findUniqueOrThrow({ where: { id: req.params.id } });
    const [members, announcements] = await Promise.all([
      prisma.communityMember.findMany({ where: { communityId: community.id }, include: { user: { select: { id: true, name: true, username: true, email: true, city: true } } }, orderBy: { joinedAt: 'asc' } }),
      prisma.communityAnnouncement.findMany({ where: { communityId: community.id }, orderBy: { createdAt: 'desc' } }),
    ]);
    res.json({ community: { id: community.id, name: community.name, slug: community.slug }, members, announcements });
  }),
);

ccExperiencesRouter.post(
  '/communities/:id/announcements',
  route(async (req, res) => {
    assertPermission(req, 'communities.edit');
    const input = z.object({ title: z.string().trim().min(3).max(160), body: z.string().trim().min(3).max(4000) }).parse(req.body);
    const community = await prisma.community.findUniqueOrThrow({ where: { id: req.params.id } });
    const announcement = await prisma.communityAnnouncement.create({ data: { communityId: community.id, authorId: req.auth!.id, title: input.title, body: input.body } });
    const members = await prisma.communityMember.findMany({ where: { communityId: community.id, status: 'ACTIVE' }, select: { userId: true } });
    await notifyMany(members.map((row) => row.userId), { type: 'COMMUNITY_ANNOUNCEMENT', title: `${community.name}: ${input.title}`, body: input.body.slice(0, 160), link: `/experiences/communities/${community.slug}` });
    await audit(req, { action: 'create', entityType: 'communities', entityId: community.id, summary: `Announcement in ${community.name}: ${input.title}` });
    res.status(201).json(announcement);
  }),
);

ccExperiencesRouter.post(
  '/communities/:id/members/:userId/role',
  route(async (req, res) => {
    assertPermission(req, 'communities.edit');
    const input = z.object({ role: z.enum(['MEMBER', 'MODERATOR', 'REMOVE', 'APPROVE', 'DECLINE']) }).parse(req.body);
    if (input.role === 'APPROVE' || input.role === 'DECLINE') {
      const community = await prisma.community.findUniqueOrThrow({ where: { id: req.params.id } });
      const status = input.role === 'APPROVE' ? 'ACTIVE' : 'DECLINED';
      const changed = await prisma.communityMember.updateMany({ where: { communityId: community.id, userId: req.params.userId, status: { not: status } }, data: { status } });
      if (changed.count) {
        await notify({
          userId: req.params.userId,
          type: 'ENQUIRY_UPDATE',
          title: input.role === 'APPROVE' ? `Welcome to ${community.name}` : `${community.name}: request not approved`,
          body: input.role === 'APPROVE' ? 'Your membership request was approved.' : 'The community team did not approve your request this time.',
          link: `/experiences/communities/${community.slug}`,
        });
      }
    } else if (input.role === 'REMOVE') {
      await prisma.communityMember.deleteMany({ where: { communityId: req.params.id, userId: req.params.userId } });
    } else {
      await prisma.communityMember.updateMany({ where: { communityId: req.params.id, userId: req.params.userId }, data: { role: input.role } });
    }
    await audit(req, { action: 'update', entityType: 'communities', entityId: req.params.id, summary: `Community member ${input.role === 'REMOVE' ? 'removed' : `set to ${input.role}`}` });
    res.json({ ok: true });
  }),
);

/* -------------------------------- Trip chats ------------------------------- */

ccExperiencesRouter.get(
  '/chats',
  route(async (req, res) => {
    assertPermission(req, 'trips.view');
    const rows = await prisma.conversation.findMany({
      include: {
        departure: { include: { trip: { select: { title: true, slug: true } } } },
        _count: { select: { members: true, messages: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const openReports = await prisma.report.count({ where: { targetType: 'MESSAGE', status: 'OPEN' } });
    res.json({
      openReports,
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        kind: row.departure ? 'TRIP' : row.subjectType,
        trip: row.departure?.trip.title ?? row.title,
        startDate: row.departure?.startDate ?? null,
        endDate: row.departure?.endDate ?? null,
        members: row._count.members,
        messages: row._count.messages,
        lastMessageAt: row.messages[0]?.createdAt ?? null,
        archivedAt: row.archivedAt,
      })),
    });
  }),
);

/* --------------------------- Notification deliveries ----------------------- */

ccExperiencesRouter.get(
  '/deliveries',
  route(async (req, res) => {
    assertPermission(req, 'enquiries.view');
    const page = pageParams(req.query as Record<string, unknown>, 50, 200);
    const status = typeof req.query.status === 'string' && req.query.status !== 'all' ? req.query.status : undefined;
    const where = status ? { status } : {};
    const [items, total, grouped] = await Promise.all([
      prisma.notificationDelivery.findMany({ where, orderBy: { createdAt: 'desc' }, skip: page.skip, take: page.take }),
      prisma.notificationDelivery.count({ where }),
      prisma.notificationDelivery.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    res.json({
      ...paginated(items, total, page),
      statusCounts: Object.fromEntries(grouped.map((row) => [row.status, row._count._all])),
      configuration: {
        whatsapp: whatsappConfigured(),
        email: !!process.env.RESEND_API_KEY,
      },
    });
  }),
);

/* -------------------------------- Analytics -------------------------------- */

const SUBJECT_MODELS: Record<string, { model: string; title: string; path: (row: any) => string }> = {
  PLACE: { model: 'place', title: 'name', path: (row) => `/explore/${row.slug}` },
  ACTIVITY: { model: 'activity', title: 'title', path: (row) => `/activities/${row.slug}` },
  EVENT: { model: 'event', title: 'title', path: (row) => `/events/${row.slug}` },
  EXPERIENCE: { model: 'experience', title: 'title', path: (row) => `/experiences/${row.slug}` },
  TRIP: { model: 'trip', title: 'title', path: (row) => `/travel/${row.slug}` },
  TOURNAMENT: { model: 'tournament', title: 'title', path: (row) => `/experiences/gaming/${row.slug}` },
  COMMUNITY: { model: 'community', title: 'name', path: (row) => `/experiences/communities/${row.slug}` },
};

ccExperiencesRouter.get(
  '/analytics',
  route(async (req, res) => {
    assertPermission(req, 'analytics.view');
    const days = Math.min(365, Math.max(1, Number(req.query.days ?? 30) || 30));
    const totals = await engagementTotals(days);
    const byItem = new Map<string, { subjectType: string; subjectId: string; counts: Record<string, number> }>();
    const byKind: Record<string, number> = {};
    for (const row of totals) {
      const key = `${row.subjectType}:${row.subjectId}`;
      const item = byItem.get(key) ?? { subjectType: row.subjectType, subjectId: row.subjectId, counts: {} };
      item.counts[row.kind] = (item.counts[row.kind] ?? 0) + row.count;
      byItem.set(key, item);
      byKind[row.kind] = (byKind[row.kind] ?? 0) + row.count;
    }
    const top = [...byItem.values()].sort((a, b) => Object.values(b.counts).reduce((x, y) => x + y, 0) - Object.values(a.counts).reduce((x, y) => x + y, 0)).slice(0, 40);
    const items = await Promise.all(
      top.map(async (item) => {
        const def = SUBJECT_MODELS[item.subjectType];
        const row = def ? await (prisma as any)[def.model].findUnique({ where: { id: item.subjectId } }) : null;
        return { ...item, title: row ? row[def!.title] : '(removed)', href: row ? def!.path(row) : null };
      }),
    );
    const since = new Date(Date.now() - days * 86400000);
    const [newMembers, enquiries, registrations] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: since }, role: 'TRAVELER', isDemo: false } }),
      prisma.enquiry.groupBy({ by: ['type'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      prisma.eventRegistration.count({ where: { createdAt: { gte: since } } }),
    ]);
    res.json({
      days,
      byKind,
      items,
      newMembers,
      eventRegistrations: registrations,
      enquiries: Object.fromEntries(enquiries.map((row) => [row.type, row._count._all])),
      visitorsDashboard: process.env.ANALYTICS_DASHBOARD_URL ?? null,
    });
  }),
);
