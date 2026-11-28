import { Router } from 'express';
import { z } from 'zod';
import { textContains } from '../lib/search';
import { publicVapidKey, sendPush } from '../services/push';
import { ADULT_AGE, MEMBER_ACTIVITY_LABELS, OPTIONAL_NOTIFICATIONS, PROFILE_FIELDS, VISIBILITY_LEVELS, ageFrom } from '@enhakkore/shared';
import { ApiError, route } from '../lib/http';
import { stringify } from '../lib/json';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { travellerStats } from '../services/stats';
import { usernameProblem } from '../services/usernames';
import { refreshRatings } from '../services/stats';
import { toDonation, toNotification, toPublicUser, toReview, toTripSummary } from '../serializers';
import { TRIP_SUMMARY_INCLUDE } from '../lib/includes';

export const meRouter = Router();

meRouter.use(requireAuth);

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional(),
  country: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(600).optional(),
  headline: z.string().trim().max(120).optional(),
  interests: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  activityPrefs: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  profileVisibility: z.enum(['MEMBERS', 'HIDDEN']).optional(),
  username: z.string().trim().toLowerCase().max(20).optional(),
  coverImage: z.string().max(600).optional().or(z.literal('')),
  profileFields: z.record(z.enum(PROFILE_FIELDS), z.enum(VISIBILITY_LEVELS)).optional(),
  /** Can be added once; to correct it afterwards the member contacts support (age protections depend on it). */
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Is this username free? */
meRouter.get(
  '/username-available',
  route(async (req, res) => {
    const username = String(req.query.u ?? '').trim().toLowerCase();
    const problem = await usernameProblem(username, req.auth!.id);
    res.json({ username, available: !problem, reason: problem });
  }),
);

/** Enhakkore Nearby preference. Off by default; detection itself needs the mobile app (see the page). */
meRouter.put(
  '/nearby',
  route(async (req, res) => {
    const { mode } = z.object({ mode: z.enum(['OFF', 'M4', 'M10']) }).parse(req.body);
    await prisma.user.update({ where: { id: req.auth!.id }, data: { nearbyMode: mode } });
    res.json({ mode, active: false, reason: 'Nearby discovery needs the Enhakkore mobile app. Web browsers cannot detect nearby phones.' });
  }),
);

/** Which optional notifications to receive, and quiet hours. Essential notices are always sent. */
meRouter.put(
  '/notification-prefs',
  route(async (req, res) => {
    const keys = OPTIONAL_NOTIFICATIONS.map((item) => item.key) as [string, ...string[]];
    const input = z
      .object({
        off: z.array(z.enum(keys)).max(20).default([]),
        quietStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
        quietEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
        channels: z.object({ push: z.boolean().default(true), email: z.boolean().default(false), whatsapp: z.boolean().default(false) }).optional(),
      })
      .parse(req.body);
    await prisma.user.update({ where: { id: req.auth!.id }, data: { notificationPrefs: JSON.stringify(input) } });
    res.json(input);
  }),
);

meRouter.patch(
  '/',
  route(async (req, res) => {
    const input = profileSchema.parse(req.body);
    if (input.username) {
      const problem = await usernameProblem(input.username, req.auth!.id);
      if (problem) throw ApiError.conflict(problem, 'username_unavailable');
    }
    let dateOfBirth: Date | undefined;
    if (input.dateOfBirth) {
      const current = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.id }, select: { dateOfBirth: true } });
      if (current.dateOfBirth) throw ApiError.badRequest('Your date of birth is already saved. Contact support to correct it.');
      const age = ageFrom(input.dateOfBirth);
      if (age === null || age > 120) throw ApiError.badRequest('Enter a real date of birth.');
      dateOfBirth = new Date(`${input.dateOfBirth}T00:00:00Z`);
    }
    const user = await prisma.user.update({
      where: { id: req.auth!.id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.headline !== undefined ? { headline: input.headline || null } : {}),
        ...(input.interests ? { interests: JSON.stringify(Array.from(new Set(input.interests))) } : {}),
        ...(input.activityPrefs ? { activityPrefs: JSON.stringify(Array.from(new Set(input.activityPrefs))) } : {}),
        ...(input.profileVisibility ? { profileVisibility: input.profileVisibility } : {}),
        ...(input.username ? { username: input.username } : {}),
        ...(input.coverImage !== undefined ? { coverImage: input.coverImage || null } : {}),
        ...(input.profileFields ? { profileFields: JSON.stringify(input.profileFields) } : {}),
        ...(dateOfBirth ? { dateOfBirth, ...((ageFrom(input.dateOfBirth!) ?? 0) < ADULT_AGE ? { profileVisibility: 'HIDDEN', nearbyGaming: false } : {}) } : {}),
      },
      include: { organizer: { select: { id: true } } },
    });
    res.json(toPublicUser(user));
  }),
);

meRouter.get(
  '/stats',
  route(async (req, res) => {
    res.json(await travellerStats(req.auth!.id));
  }),
);

/* -------------------------------- Impact ---------------------------------- */

meRouter.get(
  '/donations',
  route(async (req, res) => {
    const donations = await prisma.donation.findMany({
      where: { userId: req.auth!.id, status: 'SUCCEEDED' },
      include: { project: true, booking: { select: { reference: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items: donations.map(toDonation) });
  }),
);

/* ------------------------------ Saved trips -------------------------------- */

meRouter.get(
  '/saved',
  route(async (req, res) => {
    const saved = await prisma.savedTrip.findMany({
      where: { userId: req.auth!.id },
      include: {
        trip: {
          include: TRIP_SUMMARY_INCLUDE,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items: saved.map((row) => toTripSummary(row.trip)) });
  }),
);

meRouter.post(
  '/saved/:tripId',
  route(async (req, res) => {
    const existing = await prisma.savedTrip.findUnique({
      where: { userId_tripId: { userId: req.auth!.id, tripId: req.params.tripId } },
    });

    if (existing) {
      await prisma.savedTrip.delete({ where: { id: existing.id } });
      return res.json({ saved: false });
    }

    await prisma.savedTrip.create({ data: { userId: req.auth!.id, tripId: req.params.tripId } });
    res.json({ saved: true });
  }),
);

/* ----------------------------- Notifications ------------------------------ */

const TABS = ['all', 'unread', 'messages', 'requests', 'updates', 'archived'] as const;

/** My Notifications: tabs, search and paging. Counts are unread per tab (archived excluded). */
meRouter.get(
  '/notifications',
  route(async (req, res) => {
    const tab = z.enum(TABS).catch('all').parse(req.query.tab ?? 'all');
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
    const take = Math.min(60, Number(req.query.limit ?? 40) || 40);
    const before = typeof req.query.before === 'string' ? new Date(req.query.before) : undefined;
    const base = { userId: req.auth!.id };
    const where = {
      ...base,
      ...(tab === 'archived' ? { archivedAt: { not: null } } : { archivedAt: null }),
      ...(tab === 'unread' ? { read: false } : {}),
      ...(tab === 'messages' ? { category: 'MESSAGES' } : tab === 'requests' ? { category: 'REQUESTS' } : tab === 'updates' ? { category: 'UPDATES' } : {}),
      ...(q ? { OR: [{ title: textContains(q) }, { body: textContains(q) }] } : {}),
      ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}),
    };
    const [items, unread, messages, requests, updates] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take }),
      prisma.notification.count({ where: { ...base, read: false, archivedAt: null } }),
      prisma.notification.count({ where: { ...base, read: false, archivedAt: null, category: 'MESSAGES' } }),
      prisma.notification.count({ where: { ...base, read: false, archivedAt: null, category: 'REQUESTS' } }),
      prisma.notification.count({ where: { ...base, read: false, archivedAt: null, category: 'UPDATES' } }),
    ]);
    res.json({
      items: items.map((item) => ({ ...toNotification(item), category: item.category, archived: !!item.archivedAt })),
      unread,
      counts: { unread, messages, requests, updates },
      hasMore: items.length === take,
    });
  }),
);

meRouter.post(
  '/notifications/read',
  route(async (req, res) => {
    const input = z.object({ ids: z.array(z.string()).max(200).optional(), read: z.boolean().default(true) }).parse(req.body ?? {});
    await prisma.notification.updateMany({
      where: { userId: req.auth!.id, ...(input.ids ? { id: { in: input.ids } } : {}) },
      data: { read: input.read },
    });
    res.json({ ok: true });
  }),
);

/** Archive (clear from the inbox) or bring back. Archiving also marks as read. */
meRouter.post(
  '/notifications/archive',
  route(async (req, res) => {
    const input = z.object({ ids: z.array(z.string()).max(200).optional(), archive: z.boolean().default(true), allRead: z.boolean().optional() }).parse(req.body ?? {});
    await prisma.notification.updateMany({
      where: { userId: req.auth!.id, ...(input.ids ? { id: { in: input.ids } } : {}), ...(input.allRead ? { read: true } : {}) },
      data: input.archive ? { archivedAt: new Date(), read: true } : { archivedAt: null },
    });
    res.json({ ok: true });
  }),
);

/* ------------------------------ Activity Centre ----------------------------- */

meRouter.get(
  '/activity',
  route(async (req, res) => {
    const filter = typeof req.query.filter === 'string' ? req.query.filter : 'all';
    const groups: Record<string, string[]> = {
      communities: ['JOINED_COMMUNITY', 'CREATED_COMMUNITY'],
      study: ['JOINED_STUDY_GROUP', 'CREATED_STUDY_GROUP'],
      gaming: ['TOURNAMENT_REGISTERED', 'TOURNAMENT_CREATED', 'TOURNAMENT_COMPLETED', 'FRIEND_ADDED', 'TEAM_CREATED', 'TEAM_JOINED', 'GAMING_SESSION_JOINED', 'GAMING_SESSION_CREATED'],
      trips: ['TRIP_JOINED'],
      events: ['EVENT_REGISTERED', 'HOSTED_ACTIVITY'],
      saved: ['SAVED'],
    };
    const before = typeof req.query.before === 'string' ? new Date(req.query.before) : undefined;
    const items = await prisma.memberActivity.findMany({
      where: { userId: req.auth!.id, ...(groups[filter] ? { action: { in: groups[filter] } } : {}), ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ items: items.map((item) => ({ id: item.id, action: item.action, label: MEMBER_ACTIVITY_LABELS[item.action] ?? item.action, title: item.title, link: item.link, createdAt: item.createdAt })), hasMore: items.length === 50 });
  }),
);

/* ---------------------------------- Push ----------------------------------- */

meRouter.get(
  '/push/key',
  route(async (_req, res) => {
    res.json({ publicKey: await publicVapidKey() });
  }),
);

meRouter.post(
  '/push/subscribe',
  route(async (req, res) => {
    const input = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(4).max(100) }) }).parse(req.body);
    await prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { userId: req.auth!.id, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: String(req.headers['user-agent'] ?? '').slice(0, 200) },
      update: { userId: req.auth!.id, p256dh: input.keys.p256dh, auth: input.keys.auth },
    });
    res.status(201).json({ ok: true });
  }),
);

meRouter.post(
  '/push/unsubscribe',
  route(async (req, res) => {
    const { endpoint } = z.object({ endpoint: z.string().url().max(1000) }).parse(req.body);
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.auth!.id } });
    res.json({ ok: true });
  }),
);

/** Sends a test push to this member's devices and says honestly what the push service answered. */
meRouter.post(
  '/push/test',
  route(async (req, res) => {
    const devices = await prisma.pushSubscription.count({ where: { userId: req.auth!.id } });
    if (devices === 0) return res.json({ devices: 0, accepted: 0, message: 'Push is not switched on for any of your devices yet.' });
    const result = await sendPush(req.auth!.id, { title: 'Enhakkore test notification', body: 'Push notifications are working on this device.', link: '/account/notifications' });
    res.json({ devices, accepted: result.accepted, message: result.accepted > 0 ? 'The push service accepted it. It should appear on your device shortly — browsers do not confirm when it is shown.' : 'The push service did not accept it. Try switching push off and on again.' });
  }),
);

/* -------------------------------- Reviews --------------------------------- */

const reviewSchema = z.object({
  bookingReference: z.string().trim().min(1),
  rating: z.number().int().min(1, 'Choose a rating.').max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(20, 'Tell other travellers a little more.').max(3000),
  photos: z.array(z.string().url()).max(6).default([]),
});

/**
 * Reviews are tied to a completed booking, never written freely. That link is
 * what makes ratings on this platform mean something.
 */
meRouter.post(
  '/reviews',
  route(async (req, res) => {
    const input = reviewSchema.parse(req.body);

    const booking = await prisma.booking.findUnique({
      where: { reference: input.bookingReference },
      include: { trip: true, departure: true, review: true },
    });

    if (!booking || booking.userId !== req.auth!.id) {
      throw ApiError.notFound('We could not find that booking.');
    }
    if (booking.review) {
      throw ApiError.conflict('You have already reviewed this trip.', 'already_reviewed');
    }
    if (booking.status === 'CANCELLED' || booking.status === 'REFUNDED') {
      throw ApiError.unprocessable('Cancelled bookings cannot be reviewed.', 'cancelled');
    }
    if (new Date(booking.departure.endDate).getTime() > Date.now()) {
      throw ApiError.unprocessable('You can review this trip once it has finished.', 'trip_not_finished');
    }

    const review = await prisma.review.create({
      data: {
        tripId: booking.tripId,
        organizerId: booking.trip.organizerId,
        userId: req.auth!.id,
        bookingId: booking.id,
        rating: input.rating,
        title: input.title ?? null,
        body: input.body,
        photos: stringify(input.photos),
      },
      include: { user: true, trip: { select: { title: true } } },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await refreshRatings(booking.tripId, booking.trip.organizerId);

    res.status(201).json(toReview(review));
  }),
);

meRouter.get(
  '/reviews',
  route(async (req, res) => {
    const reviews = await prisma.review.findMany({
      where: { userId: req.auth!.id },
      include: { user: true, trip: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items: reviews.map(toReview) });
  }),
);

/* --------------------------------- Sessions --------------------------------- */

/** The member's signed-in devices. */
meRouter.get(
  '/sessions',
  route(async (req, res) => {
    const rows = await prisma.session.findMany({ where: { userId: req.auth!.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: 'desc' }, take: 30 });
    res.json({ items: rows.map((row) => ({ id: row.id, userAgent: row.userAgent, createdAt: row.createdAt, lastSeenAt: row.lastSeenAt, current: row.id === req.auth!.sessionId })) });
  }),
);

meRouter.post(
  '/sessions/:id/revoke',
  route(async (req, res) => {
    const others = req.params.id === 'others';
    await prisma.session.updateMany({
      where: { userId: req.auth!.id, revokedAt: null, ...(others ? { id: { not: req.auth!.sessionId } } : { id: req.params.id }) },
      data: { revokedAt: new Date(), revokedBy: req.auth!.id },
    });
    res.json({ ok: true });
  }),
);
