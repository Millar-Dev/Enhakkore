import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  ACTIVITY_PUBLIC_STATUSES,
  COMMUNITY_RESOURCE,
  EVENT_PUBLIC_STATUSES,
  EXPERIENCE_SECTIONS,
  TOURNAMENT_PUBLIC_STATUSES,
  TOURNAMENT_RESOURCE,
  EXPERIENCE_RESOURCE,
  PLACE_RESOURCE,
  slugify,
} from '@enhakkore/shared';
import { env } from '../env';
import { ApiError, route } from '../lib/http';
import { shortCode } from '../lib/ids';
import { parseObjects } from '../lib/json';
import { prisma } from '../lib/prisma';
import { textContains } from '../lib/search';
import { requireAuth } from '../middleware/auth';
import { notify } from '../services/notifications';
import { ENGAGEMENT_KINDS, freshness, popularityScores, rankByPopularity, recordEngagement } from '../services/popularity';
import { toPublic, type Row } from '../services/resources/engine';
import { LIVE, TRIP_PUBLIC_INCLUDE, toActivity, toEvent, toTrip } from './public';
import { DEMO_MESSAGE } from './community';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Experiences: the eight sections, communities, gaming tournaments and
 * recurring sessions, plus the shared popularity signals.
 *
 * `experiencesPublic` is mounted at /public (no session needed, nothing
 * private returned); `experiencesMember` at /community (signed-in members).
 */
export const experiencesPublic = Router();
export const experiencesMember = Router();

const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const GEO = { country: true, city: true, category: true };

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProduction ? 40 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many requests from here. Please try again a little later.' } },
});

function geo(req: { query: Record<string, unknown> }): Row {
  const where: Row = {};
  const country = str(req.query.country);
  if (country) where.country = { OR: [{ code: country.toUpperCase() }, { slug: country.toLowerCase() }] };
  const city = str(req.query.city);
  if (city) where.city = { slug: city.toLowerCase() };
  return where;
}

function toCommunity(row: Row): Row {
  const out = toPublic(COMMUNITY_RESOURCE, row);
  out.memberCount = row._count?.members ?? 0;
  delete out.createdById;
  return out;
}

function toTournament(row: Row): Row {
  const out = toPublic(TOURNAMENT_RESOURCE, row);
  out.game = row.game ? { name: row.game.name, slug: row.game.slug, icon: row.game.icon, group: row.game.group } : null;
  out.entryCount = row._count?.entries ?? 0;
  out.slotsLeft = row.slots ? Math.max(0, row.slots - out.entryCount) : null;
  const deadline = row.registrationDeadline ? new Date(row.registrationDeadline).getTime() : null;
  out.registrationOpen = row.status === 'REGISTRATION_OPEN' && (deadline === null || deadline > Date.now()) && (out.slotsLeft === null || out.slotsLeft > 0);
  out.free = true;
  return out;
}

const TOURNAMENT_INCLUDE = { game: true, country: true, city: true, _count: { select: { entries: { where: { status: { in: ['REGISTERED', 'CONFIRMED'] } } } } } };
const COMMUNITY_INCLUDE = { category: true, country: true, city: true, _count: { select: { members: true } } };

/* ----------------------------- Popularity signals -------------------------- */

const trackSchema = z.object({
  subjectType: z.string().max(20),
  subjectId: z.string().min(5).max(60),
  kind: z.enum(['VIEW', 'SHARE']),
});

/** Views and shares from the browser. Saves, registrations and enquiries are recorded by the server itself. */
experiencesPublic.post(
  '/track',
  limiter,
  route(async (req, res) => {
    const input = trackSchema.parse(req.body);
    const counted = await recordEngagement(req, input.subjectType, input.subjectId, input.kind);
    res.json({ counted });
  }),
);

/** The most genuinely popular live items across Explore, Experiences and Travel. Expired items are excluded. */
experiencesPublic.get(
  '/trending',
  route(async (_req, res) => {
    res.json({ items: await trendingItems(8) });
  }),
);

export async function trendingItems(limit: number) {
  const now = new Date();
  const [places, activities, events, trips, tournaments, experiences] = await Promise.all([
    prisma.place.findMany({ where: { ...LIVE.place, isDemo: false }, include: GEO, take: 200 }),
    prisma.activity.findMany({ where: { isDemo: false, status: { in: ['PUBLISHED', 'FULL'] }, OR: [{ startsAt: null }, { startsAt: { gte: now } }, { recurrence: { not: null } }] }, include: GEO, take: 200 }),
    prisma.event.findMany({ where: { isDemo: false, status: { in: ['PUBLISHED'] }, OR: [{ startsAt: { gte: now } }, { endsAt: { gte: now } }] }, include: GEO, take: 200 }),
    prisma.trip.findMany({ where: LIVE.trip, include: TRIP_PUBLIC_INCLUDE, take: 50 }),
    prisma.tournament.findMany({ where: { isDemo: false, status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS'] } }, include: TOURNAMENT_INCLUDE, take: 100 }),
    prisma.experience.findMany({ where: { ...LIVE.experience, isDemo: false }, include: GEO, take: 200 }),
  ]);
  const where = (row: Row) => [row.city?.name, row.country?.name].filter(Boolean).join(', ');
  const liveTrips = trips.map((row) => ({ row, trip: toTrip(row) })).filter(({ trip }) => !trip.isPast && trip.nextDeparture?.bookable);
  const groups: { type: string; items: { id: string; publishedAt?: Date | null; card: Row }[] }[] = [
    { type: 'PLACE', items: places.map((row) => ({ id: row.id, publishedAt: row.publishedAt, card: { kind: 'Place', title: row.name, href: `/explore/${row.slug}`, where: where(row), image: row.coverImage, sponsored: row.sponsored } })) },
    { type: 'ACTIVITY', items: activities.map((row) => ({ id: row.id, publishedAt: row.publishedAt, card: { kind: 'Activity', title: row.title, href: `/activities/${row.slug}`, where: where(row), image: row.coverImage, startsAt: row.startsAt } })) },
    { type: 'EVENT', items: events.map((row) => ({ id: row.id, publishedAt: row.publishedAt, card: { kind: 'Event', title: row.title, href: `/events/${row.slug}`, where: where(row), image: row.poster, startsAt: row.startsAt } })) },
    { type: 'TRIP', items: liveTrips.map(({ row, trip }) => ({ id: row.id, publishedAt: row.publishedAt, card: { kind: 'Trip', title: row.title, href: `/travel/${row.slug}`, where: trip.destinationLabel, image: row.heroImage, startsAt: trip.nextDeparture?.startDate } })) },
    { type: 'TOURNAMENT', items: tournaments.map((row) => ({ id: row.id, publishedAt: row.publishedAt, card: { kind: 'Gaming', title: row.title, href: `/experiences/gaming/${row.slug}`, where: row.game?.name ?? '', image: row.coverImage, startsAt: row.startsAt } })) },
    { type: 'EXPERIENCE', items: experiences.map((row) => ({ id: row.id, publishedAt: row.publishedAt, card: { kind: 'Experience', title: row.title, href: `/experiences/${row.slug}`, where: where(row), image: row.coverImage } })) },
  ];
  const scored: { score: number; card: Row }[] = [];
  for (const group of groups) {
    const scores = await popularityScores(group.type, group.items.map((item) => item.id));
    for (const item of group.items) {
      const score = (scores.get(item.id) ?? 0) + freshness(item.publishedAt);
      if (score > 0) scored.push({ score, card: { ...item.card, subjectType: group.type, subjectId: item.id } });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, card }) => ({ ...card, popularity: Math.round(score * 10) / 10 }));
}

/* ------------------------------- Experiences hub --------------------------- */

/** Activities, events, communities and tournaments of one of the eight sections. */
async function sectionContent(section: string | undefined, req: { query: Record<string, unknown> }) {
  const now = new Date();
  const q = str(req.query.q);
  const categorySlug = str(req.query.category);
  const categoryFilter = section ? { category: { section, ...(categorySlug ? { slug: categorySlug } : {}) } } : categorySlug ? { category: { slug: categorySlug } } : {};
  const location = geo(req);
  const activityText = q ? { OR: [{ title: textContains(q) }, { summary: textContains(q) }, { platformName: textContains(q) }, { category: { name: textContains(q) } }] } : {};
  const eventText = q ? { OR: [{ title: textContains(q) }, { summary: textContains(q) }, { venue: textContains(q) }, { category: { name: textContains(q) } }] } : {};
  const includeTournaments = !section || section === 'GAMING';
  const [activities, events, communities, tournaments] = await Promise.all([
    prisma.activity.findMany({
      where: { AND: [{ status: { in: ['PUBLISHED', 'FULL'] } }, { OR: [{ startsAt: null }, { startsAt: { gte: now } }, { recurrence: { not: null } }] }, categoryFilter, location, activityText] },
      include: GEO,
      orderBy: [{ featured: 'desc' }, { startsAt: 'asc' }],
      take: 60,
    }),
    prisma.event.findMany({
      where: { AND: [{ status: { in: ['PUBLISHED', 'SOLD_OUT'] } }, { OR: [{ startsAt: { gte: now } }, { endsAt: { gte: now } }] }, categoryFilter, location, eventText] },
      include: { ...GEO, tickets: true },
      orderBy: { startsAt: 'asc' },
      take: 60,
    }),
    prisma.community.findMany({
      where: { AND: [{ status: 'PUBLISHED' }, section ? { category: { section } } : {}, location, q ? { OR: [{ name: textContains(q) }, { summary: textContains(q) }] } : {}] },
      include: COMMUNITY_INCLUDE,
      orderBy: [{ featured: 'desc' }, { name: 'asc' }],
      take: 30,
    }),
    includeTournaments
      ? prisma.tournament.findMany({
          where: {
            AND: [
              { status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS'] } },
              location,
              q ? { OR: [{ title: textContains(q) }, { summary: textContains(q) }, { game: { name: textContains(q) } }] } : {},
            ],
          },
          include: TOURNAMENT_INCLUDE,
          orderBy: { startsAt: 'asc' },
          take: 60,
        })
      : Promise.resolve([]),
  ]);
  return { activities, events, communities, tournaments };
}

function upcomingCards(content: Awaited<ReturnType<typeof sectionContent>>) {
  const where = (row: Row) => [row.city?.name, row.country?.name].filter(Boolean).join(', ');
  return [
    ...content.activities.map((row) => ({ kind: 'Activity', id: row.id, subjectType: 'ACTIVITY', title: row.title, href: `/activities/${row.slug}`, image: row.coverImage, startsAt: row.startsAt, where: where(row), recurrence: row.recurrence, category: row.category?.name, free: !row.price, publishedAt: row.publishedAt, isDemo: row.isDemo })),
    ...content.events.map((row) => ({ kind: 'Event', id: row.id, subjectType: 'EVENT', title: row.title, href: `/events/${row.slug}`, image: row.poster, startsAt: row.startsAt, where: where(row), category: row.category?.name, publishedAt: row.publishedAt, isDemo: row.isDemo })),
    ...content.tournaments.map((row) => ({ kind: 'Gaming', id: row.id, subjectType: 'TOURNAMENT', title: row.title, href: `/experiences/gaming/${row.slug}`, image: row.coverImage, startsAt: row.startsAt, where: row.kind === 'ONLINE' ? `Online${row.server ? ` · ${row.server}` : ''}` : row.venue ?? where(row), category: row.game?.name, free: true, publishedAt: row.publishedAt, isDemo: row.isDemo })),
  ].sort((a, b) => (a.startsAt ? new Date(a.startsAt).getTime() : Infinity) - (b.startsAt ? new Date(b.startsAt).getTime() : Infinity));
}

experiencesPublic.get(
  '/experiences-hub',
  route(async (req, res) => {
    const content = await sectionContent(undefined, req);
    const upcoming = upcomingCards(content);
    const counts = await Promise.all(
      EXPERIENCE_SECTIONS.map(async (section) => {
        const [activities, events, communities] = await Promise.all([
          prisma.activity.count({ where: { status: { in: ['PUBLISHED', 'FULL'] }, category: { section: section.key } } }),
          prisma.event.count({ where: { status: { in: EVENT_PUBLIC_STATUSES }, category: { section: section.key } } }),
          prisma.community.count({ where: { status: 'PUBLISHED', category: { section: section.key } } }),
        ]);
        const tournaments = section.key === 'GAMING' ? await prisma.tournament.count({ where: { status: { in: TOURNAMENT_PUBLIC_STATUSES } } }) : 0;
        return { key: section.key, count: activities + events + communities + tournaments };
      }),
    );
    // Popular: ranked by genuine engagement among upcoming items only.
    const popular = (
      await Promise.all(
        (['ACTIVITY', 'EVENT', 'TOURNAMENT'] as const).map(async (type) => {
          const items = upcoming.filter((item) => item.subjectType === type);
          return rankByPopularity(type, items);
        }),
      )
    )
      .flat()
      .filter((item) => item.popularity > 0 && !item.isDemo)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 8);
    const guided = await prisma.experience.findMany({ where: LIVE.experience, include: GEO, orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }], take: 6 });
    res.json({
      sections: EXPERIENCE_SECTIONS.map((section) => ({ ...section, count: counts.find((row) => row.key === section.key)?.count ?? 0 })),
      upcoming: upcoming.slice(0, 18),
      popular,
      communities: content.communities.slice(0, 6).map(toCommunity),
      guided: guided.map((row) => toPublic(EXPERIENCE_RESOURCE, row)),
    });
  }),
);

experiencesPublic.get(
  '/experiences-section/:key',
  route(async (req, res) => {
    const section = EXPERIENCE_SECTIONS.find((item) => item.key === req.params.key.toUpperCase());
    if (!section) throw ApiError.notFound('That section does not exist.');
    const content = await sectionContent(section.key, req);
    const categories = await prisma.category.findMany({ where: { status: 'PUBLISHED', section: section.key }, orderBy: { sortOrder: 'asc' } });
    const games = section.key === 'GAMING' ? await prisma.category.findMany({ where: { status: 'PUBLISHED', kind: 'GAME' }, orderBy: { sortOrder: 'asc' } }) : [];
    res.json({
      section,
      categories: categories.map((row) => ({ name: row.name, slug: row.slug, icon: row.icon })),
      games: games.map((row) => ({ name: row.name, slug: row.slug, icon: row.icon, group: row.group })),
      upcoming: upcomingCards(content),
      communities: content.communities.map(toCommunity),
    });
  }),
);

/* -------------------------------- Communities ----------------------------- */

experiencesPublic.get(
  '/communities',
  route(async (req, res) => {
    const q = str(req.query.q);
    const rows = await prisma.community.findMany({
      where: { AND: [{ status: 'PUBLISHED' }, geo(req), q ? { OR: [{ name: textContains(q) }, { summary: textContains(q) }] } : {}] },
      include: COMMUNITY_INCLUDE,
      orderBy: [{ featured: 'desc' }, { name: 'asc' }],
    });
    res.json({ items: rows.map(toCommunity) });
  }),
);

experiencesPublic.get(
  '/communities/:slug',
  route(async (req, res) => {
    const row = await prisma.community.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' }, include: COMMUNITY_INCLUDE });
    if (!row) throw ApiError.notFound('That community is not listed.');
    const now = new Date();
    const [announcements, activities, membership] = await Promise.all([
      prisma.communityAnnouncement.findMany({ where: { communityId: row.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.activity.findMany({
        where: { communityId: row.id, status: { in: ACTIVITY_PUBLIC_STATUSES }, OR: [{ startsAt: null }, { startsAt: { gte: now } }, { recurrence: { not: null } }] },
        include: GEO,
        orderBy: { startsAt: 'asc' },
        take: 20,
      }),
      req.auth ? prisma.communityMember.findUnique({ where: { communityId_userId: { communityId: row.id, userId: req.auth.id } } }) : Promise.resolve(null),
    ]);
    // Members are listed to signed-in members only, and only those whose profile is not hidden. No contact details.
    const members = req.auth
      ? await prisma.communityMember.findMany({
          where: { communityId: row.id, user: { profileVisibility: { not: 'HIDDEN' }, status: 'ACTIVE' } },
          include: { user: { select: { id: true, name: true, avatarUrl: true, city: true } } },
          orderBy: { joinedAt: 'asc' },
          take: 100,
        })
      : [];
    res.json({
      community: toCommunity(row),
      announcements: announcements.map((item) => ({ id: item.id, title: item.title, body: item.body, createdAt: item.createdAt })),
      activities: activities.map(toActivity),
      members: members.map((item) => ({ id: item.user.id, name: item.user.name, avatarUrl: item.user.avatarUrl, city: item.user.city, role: item.role })),
      viewer: req.auth ? { isMember: !!membership, role: membership?.role ?? null } : null,
    });
  }),
);

experiencesMember.post(
  '/communities/:slug/join',
  requireAuth,
  route(async (req, res) => {
    const community = await prisma.community.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' } });
    if (!community) throw ApiError.notFound('That community is not listed.');
    if (community.isDemo) throw ApiError.conflict('This is an example (DEMO) community, so it cannot be joined.');
    await prisma.communityMember.upsert({
      where: { communityId_userId: { communityId: community.id, userId: req.auth!.id } },
      create: { communityId: community.id, userId: req.auth!.id },
      update: {},
    });
    await recordEngagement(req, 'COMMUNITY', community.id, 'REGISTER');
    res.json({ joined: true });
  }),
);

experiencesMember.post(
  '/communities/:slug/leave',
  requireAuth,
  route(async (req, res) => {
    const community = await prisma.community.findFirst({ where: { slug: req.params.slug } });
    if (!community) throw ApiError.notFound('That community is not listed.');
    await prisma.communityMember.deleteMany({ where: { communityId: community.id, userId: req.auth!.id } });
    res.json({ joined: false });
  }),
);

const communityApplySchema = z.object({
  name: z.string().trim().min(3, 'Give the community a name.').max(120),
  summary: z.string().trim().min(10, 'Describe it in a sentence or two.').max(400),
  description: z.string().trim().max(4000).optional(),
  categoryId: z.string().max(60).optional().or(z.literal('')),
  countryId: z.string().max(60).optional().or(z.literal('')),
  cityId: z.string().max(60).optional().or(z.literal('')),
  rules: z.string().trim().max(3000).optional(),
});

/** A member applies to start a community. Nothing is public until the team approves it. */
experiencesMember.post(
  '/communities/apply',
  requireAuth,
  limiter,
  route(async (req, res) => {
    const input = communityApplySchema.parse(req.body);
    let slug = slugify(input.name) || `community-${shortCode(4).toLowerCase()}`;
    if (await prisma.community.findUnique({ where: { slug } })) slug = `${slug}-${shortCode(4).toLowerCase()}`;
    const community = await prisma.community.create({
      data: {
        slug,
        name: input.name,
        summary: input.summary,
        description: input.description ?? null,
        categoryId: input.categoryId || null,
        countryId: input.countryId || null,
        cityId: input.cityId || null,
        rules: input.rules ?? null,
        status: 'PENDING_REVIEW',
        createdById: req.auth!.id,
      },
    });
    res.status(201).json({ id: community.id, status: community.status, message: 'Thank you — the Enhakkore team will review your community before it is published.' });
  }),
);

/* ---------------------------------- Gaming -------------------------------- */

experiencesPublic.get(
  '/tournaments',
  route(async (req, res) => {
    const q = str(req.query.q);
    const kind = str(req.query.kind);
    const game = str(req.query.game);
    const past = req.query.when === 'past';
    const rows = await prisma.tournament.findMany({
      where: {
        AND: [
          { status: { in: past ? ['COMPLETED'] : ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS'] } },
          kind ? { kind: kind.toUpperCase() } : {},
          game ? { game: { slug: game } } : {},
          q ? { OR: [{ title: textContains(q) }, { summary: textContains(q) }, { game: { name: textContains(q) } }] } : {},
        ],
      },
      include: TOURNAMENT_INCLUDE,
      orderBy: { startsAt: past ? 'desc' : 'asc' },
      take: 60,
    });
    const games = await prisma.category.findMany({ where: { status: 'PUBLISHED', kind: 'GAME' }, orderBy: { sortOrder: 'asc' } });
    res.json({ items: rows.map(toTournament), games: games.map((row) => ({ name: row.name, slug: row.slug, icon: row.icon, group: row.group })) });
  }),
);

experiencesPublic.get(
  '/tournaments/:slug',
  route(async (req, res) => {
    const row = await prisma.tournament.findFirst({ where: { slug: req.params.slug, status: { in: TOURNAMENT_PUBLIC_STATUSES } }, include: TOURNAMENT_INCLUDE });
    if (!row) throw ApiError.notFound('That tournament is not listed.');
    const entries = await prisma.tournamentEntry.findMany({
      where: { tournamentId: row.id, status: { in: ['REGISTERED', 'CONFIRMED'] } },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'asc' },
    });
    let viewer: Row | null = null;
    if (req.auth) {
      const own = await prisma.tournamentEntry.findFirst({
        where: { tournamentId: row.id, OR: [{ captainId: req.auth.id }, { members: { some: { userId: req.auth.id } } }] },
        include: { members: { select: { playerName: true, gameUid: true, userId: true } } },
      });
      viewer = own
        ? {
            reference: own.reference,
            status: own.status,
            isCaptain: own.captainId === req.auth.id,
            teamName: own.teamName,
            // The invite code only reaches the captain.
            inviteCode: own.captainId === req.auth.id ? own.inviteCode : null,
            members: own.members.map((member) => ({ playerName: member.playerName })),
          }
        : { reference: null };
    }
    res.json({
      tournament: { ...toTournament(row), bracket: parseObjects(row.bracket) },
      // Public line-up: player or team names only — never game IDs or contacts.
      lineup: entries.map((entry) => ({ name: entry.teamName || entry.playerName, players: entry._count.members + 1, status: entry.status })),
      viewer,
    });
  }),
);

const entrySchema = z.object({
  playerName: z.string().trim().min(2, 'Your in-game name.').max(60),
  gameUid: z.string().trim().min(3, 'Your game UID / player ID.').max(60),
  server: z.string().trim().max(60).optional(),
  teamName: z.string().trim().max(60).optional(),
  agreedRules: z.literal(true, { errorMap: () => ({ message: 'Please agree to the rules.' }) }),
});

/** Registers a solo player, or creates a team with the member as captain. Free. */
experiencesMember.post(
  '/tournaments/:slug/register',
  requireAuth,
  limiter,
  route(async (req, res) => {
    const input = entrySchema.parse(req.body);
    const tournament = await prisma.tournament.findFirst({ where: { slug: req.params.slug }, include: TOURNAMENT_INCLUDE });
    if (!tournament) throw ApiError.notFound('That tournament is not listed.');
    const view = toTournament(tournament);
    if (tournament.isDemo) throw ApiError.conflict(DEMO_MESSAGE);
    if (!view.registrationOpen) throw ApiError.conflict('Registration for this tournament is closed.');
    const team = tournament.format !== 'SOLO' && tournament.teamSize > 1;
    if (team && !input.teamName) throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', { teamName: 'Give your team a name.' });
    const already = await prisma.tournamentEntry.findFirst({
      where: { tournamentId: tournament.id, OR: [{ captainId: req.auth!.id }, { members: { some: { userId: req.auth!.id } } }] },
    });
    if (already) throw ApiError.conflict('You are already registered for this tournament.');
    const entry = await prisma.tournamentEntry.create({
      data: {
        reference: `GAM-${shortCode(6)}`,
        tournamentId: tournament.id,
        captainId: req.auth!.id,
        playerName: input.playerName,
        gameUid: input.gameUid,
        server: input.server ?? null,
        teamName: team ? input.teamName! : null,
        inviteCode: team ? shortCode(8) : null,
        agreedRules: true,
      },
    });
    await recordEngagement(req, 'TOURNAMENT', tournament.id, 'REGISTER');
    await notify({
      userId: req.auth!.id,
      type: 'REGISTRATION_RECEIVED',
      title: `Registered: ${tournament.title}`,
      body: team ? `Share your team code ${entry.inviteCode} with your squad so they can join.` : `Your reference is ${entry.reference}.`,
      link: `/experiences/gaming/${tournament.slug}`,
    });
    res.status(201).json({ reference: entry.reference, inviteCode: entry.inviteCode });
  }),
);

const joinTeamSchema = z.object({
  inviteCode: z.string().trim().min(4).max(20),
  playerName: z.string().trim().min(2, 'Your in-game name.').max(60),
  gameUid: z.string().trim().min(3, 'Your game UID / player ID.').max(60),
  agreedRules: z.literal(true, { errorMap: () => ({ message: 'Please agree to the rules.' }) }),
});

experiencesMember.post(
  '/tournaments/:slug/join-team',
  requireAuth,
  limiter,
  route(async (req, res) => {
    const input = joinTeamSchema.parse(req.body);
    const entry = await prisma.tournamentEntry.findUnique({ where: { inviteCode: input.inviteCode.toUpperCase() }, include: { tournament: true, _count: { select: { members: true } } } });
    if (!entry || entry.tournament.slug !== req.params.slug) throw ApiError.notFound('That team code is not right for this tournament.');
    if (entry.tournament.isDemo) throw ApiError.conflict(DEMO_MESSAGE);
    if (!['REGISTERED', 'CONFIRMED'].includes(entry.status)) throw ApiError.conflict('That team is no longer in the tournament.');
    if (entry._count.members + 1 >= entry.tournament.teamSize) throw ApiError.conflict('That team is already full.');
    const already = await prisma.tournamentEntry.findFirst({
      where: { tournamentId: entry.tournamentId, OR: [{ captainId: req.auth!.id }, { members: { some: { userId: req.auth!.id } } }] },
    });
    if (already) throw ApiError.conflict('You are already registered for this tournament.');
    await prisma.tournamentTeamMember.create({ data: { entryId: entry.id, userId: req.auth!.id, playerName: input.playerName, gameUid: input.gameUid } });
    await notify({ userId: entry.captainId, type: 'REGISTRATION_RECEIVED', title: `${input.playerName} joined ${entry.teamName ?? 'your team'}`, body: entry.tournament.title, link: `/experiences/gaming/${entry.tournament.slug}` });
    res.status(201).json({ joined: true, teamName: entry.teamName });
  }),
);

experiencesMember.post(
  '/tournaments/:slug/withdraw',
  requireAuth,
  route(async (req, res) => {
    const entry = await prisma.tournamentEntry.findFirst({ where: { tournament: { slug: req.params.slug }, captainId: req.auth!.id } });
    if (entry) {
      await prisma.tournamentEntry.update({ where: { id: entry.id }, data: { status: 'WITHDRAWN' } });
      return res.json({ withdrawn: true });
    }
    const removed = await prisma.tournamentTeamMember.deleteMany({ where: { userId: req.auth!.id, entry: { tournament: { slug: req.params.slug } } } });
    if (removed.count === 0) throw ApiError.notFound('You are not registered for this tournament.');
    res.json({ withdrawn: true });
  }),
);

/* ---------------------------- Recurring sessions --------------------------- */

experiencesPublic.get(
  '/activities/:slug/sessions',
  route(async (req, res) => {
    const activity = await prisma.activity.findFirst({ where: { slug: req.params.slug, status: { in: ACTIVITY_PUBLIC_STATUSES } } });
    if (!activity) throw ApiError.notFound('That activity is not available.');
    const sessions = await prisma.activitySession.findMany({
      where: { activityId: activity.id },
      include: { _count: { select: { registrations: { where: { status: 'REGISTERED' } } } } },
      orderBy: { startsAt: 'asc' },
    });
    const mine = req.auth
      ? new Set((await prisma.sessionRegistration.findMany({ where: { userId: req.auth.id, status: 'REGISTERED', session: { activityId: activity.id } }, select: { sessionId: true } })).map((row) => row.sessionId))
      : new Set<string>();
    const now = Date.now();
    const shaped = sessions.map((session) => {
      const taken = session._count.registrations;
      const capacity = session.capacity ?? activity.capacity;
      return {
        id: session.id,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        meetingPoint: session.meetingPoint ?? activity.meetingPoint,
        route: session.route,
        status: session.status,
        notice: session.notice,
        registered: taken,
        spacesLeft: capacity ? Math.max(0, capacity - taken) : null,
        past: new Date(session.startsAt).getTime() < now,
        viewerRegistered: mine.has(session.id),
      };
    });
    res.json({ upcoming: shaped.filter((item) => !item.past), past: shaped.filter((item) => item.past).reverse(), timezone: activity.timezone });
  }),
);

experiencesMember.post(
  '/sessions/:id/register',
  requireAuth,
  route(async (req, res) => {
    const session = await prisma.activitySession.findUnique({ where: { id: req.params.id }, include: { activity: true } });
    if (!session || !ACTIVITY_PUBLIC_STATUSES.includes(session.activity.status as any)) throw ApiError.notFound('That session is not available.');
    if (session.activity.isDemo) throw ApiError.conflict(DEMO_MESSAGE);
    if (session.status === 'CANCELLED' || session.startsAt.getTime() < Date.now()) throw ApiError.conflict('Registration for this session is closed.');
    const capacity = session.capacity ?? session.activity.capacity;
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.sessionRegistration.findUnique({ where: { sessionId_userId: { sessionId: session.id, userId: req.auth!.id } } });
      if (existing?.status === 'REGISTERED') return existing;
      if (capacity) {
        const taken = await tx.sessionRegistration.count({ where: { sessionId: session.id, status: 'REGISTERED' } });
        if (taken >= capacity) throw ApiError.conflict('This session is full.');
      }
      return existing
        ? tx.sessionRegistration.update({ where: { id: existing.id }, data: { status: 'REGISTERED' } })
        : tx.sessionRegistration.create({ data: { sessionId: session.id, userId: req.auth!.id } });
    });
    await recordEngagement(req, 'ACTIVITY', session.activityId, 'REGISTER');
    await notify({
      userId: req.auth!.id,
      type: 'REGISTRATION_CONFIRMED',
      title: `You are registered: ${session.activity.title}`,
      body: `Session on ${session.startsAt.toISOString().slice(0, 10)}.`,
      link: `/activities/${session.activity.slug}`,
    });
    res.status(201).json({ registered: true, id: result.id });
  }),
);

experiencesMember.post(
  '/sessions/:id/cancel',
  requireAuth,
  route(async (req, res) => {
    await prisma.sessionRegistration.updateMany({ where: { sessionId: req.params.id, userId: req.auth!.id }, data: { status: 'CANCELLED' } });
    res.json({ registered: false });
  }),
);

/* ----------------------- Members publish an activity ----------------------- */

const submitSchema = z.object({
  title: z.string().trim().min(4, 'Give it a title.').max(160),
  description: z.string().trim().min(20, 'Describe it in a few sentences.').max(8000),
  categoryId: z.string().min(5, 'Choose a category.'),
  mode: z.enum(['IN_PERSON', 'ONLINE']).default('IN_PERSON'),
  countryId: z.string().min(5, 'Choose a country.'),
  cityId: z.string().max(60).optional().or(z.literal('')),
  meetingPoint: z.string().trim().max(200).optional(),
  startsAt: z.string().datetime({ message: 'Choose a date and time.' }),
  endsAt: z.string().datetime().optional().or(z.literal('')),
  timezone: z.string().max(60).default('Africa/Dar_es_Salaam'),
  capacity: z.number().int().min(1).max(100000).optional().nullable(),
  registrationDeadline: z.string().datetime().optional().or(z.literal('')),
  eligibility: z.string().trim().max(1000).optional(),
  rules: z.string().trim().max(3000).optional(),
  cancellationTerms: z.string().trim().max(2000).optional(),
  organiserPhone: z.string().trim().min(7, 'A phone or WhatsApp number for the team (never shown).').max(30),
  coverImage: z.string().url().optional().or(z.literal('')),
  gallery: z.array(z.string().url()).max(12).optional(),
  videoUrl: z.string().url().optional().or(z.literal('')),
  paid: z.boolean().default(false),
  acceptedRules: z.literal(true, { errorMap: () => ({ message: 'Please accept the activity rules.' }) }),
});

/**
 * A member submits an activity or event. It is saved as "Pending review" and
 * shown nowhere until the team publishes it. Large, paid or higher-risk
 * submissions are flagged for enhanced review and organiser verification.
 */
experiencesMember.post(
  '/activities/submit',
  requireAuth,
  limiter,
  route(async (req, res) => {
    const input = submitSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.id } });
    if (user.status !== 'ACTIVE') throw ApiError.forbidden('Your account cannot submit activities.');
    let slug = slugify(input.title) || `activity-${shortCode(4).toLowerCase()}`;
    if (await prisma.activity.findUnique({ where: { slug } })) slug = `${slug}-${shortCode(4).toLowerCase()}`;
    const enhanced = input.paid || (input.capacity ?? 0) > 50;
    const activity = await prisma.activity.create({
      data: {
        slug,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        mode: input.mode,
        countryId: input.countryId,
        cityId: input.cityId || null,
        meetingPoint: input.meetingPoint ?? null,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        timezone: input.timezone,
        capacity: input.capacity ?? null,
        registrationDeadline: input.registrationDeadline ? new Date(input.registrationDeadline) : null,
        eligibility: input.eligibility ?? null,
        rules: input.rules ?? null,
        cancellationTerms: input.cancellationTerms ?? null,
        organiserName: user.name,
        organiserPhone: input.organiserPhone,
        organiserUserId: user.id,
        source: 'COMMUNITY',
        status: 'PENDING_REVIEW',
        reviewLevel: enhanced ? 'ENHANCED' : 'STANDARD',
        reviewNotes: input.paid ? 'The organiser says this is a paid activity — verify the organiser and the payment arrangements before publishing.' : null,
        coverImage: input.coverImage || null,
        gallery: JSON.stringify(input.gallery ?? []),
        videoUrl: input.videoUrl || null,
        createdById: user.id,
      },
    });
    res.status(201).json({
      id: activity.id,
      status: activity.status,
      reviewLevel: activity.reviewLevel,
      message: enhanced
        ? 'Thank you — your submission needs enhanced review because it is large or paid. The team will contact you to verify the details before anything is published.'
        : 'Thank you — the Enhakkore team will review your activity before it is published. You can follow it under My Experiences.',
    });
  }),
);

/* ------------------------------ My Experiences ----------------------------- */

experiencesMember.get(
  '/my-experiences',
  requireAuth,
  route(async (req, res) => {
    const userId = req.auth!.id;
    const now = Date.now();
    const [activityRequests, sessions, eventRegs, entries, teams, communities, enquiries, published, saved] = await Promise.all([
      prisma.activityParticipant.findMany({ where: { userId }, include: { activity: { include: GEO } }, orderBy: { createdAt: 'desc' } }),
      prisma.sessionRegistration.findMany({ where: { userId, status: 'REGISTERED' }, include: { session: { include: { activity: true } } } }),
      prisma.eventRegistration.findMany({ where: { userId }, include: { event: true }, orderBy: { createdAt: 'desc' } }),
      prisma.tournamentEntry.findMany({ where: { captainId: userId }, include: { tournament: { include: { game: true } }, members: { select: { playerName: true } } } }),
      prisma.tournamentTeamMember.findMany({ where: { userId }, include: { entry: { include: { tournament: { include: { game: true } } } } } }),
      prisma.communityMember.findMany({ where: { userId }, include: { community: true } }),
      prisma.enquiry.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.activity.findMany({ where: { organiserUserId: userId }, orderBy: { createdAt: 'desc' } }),
      prisma.savedItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    const registrations = [
      ...activityRequests.map((row) => ({ kind: 'Activity', title: row.activity.title, href: `/activities/${row.activity.slug}`, startsAt: row.activity.startsAt, status: row.status })),
      ...sessions.map((row) => ({ kind: 'Session', title: row.session.activity.title, href: `/activities/${row.session.activity.slug}`, startsAt: row.session.startsAt, status: row.session.status === 'CANCELLED' ? 'CANCELLED' : 'REGISTERED' })),
      ...eventRegs.map((row) => ({ kind: 'Event', title: row.event.title, href: `/events/${row.event.slug}`, startsAt: row.event.startsAt, status: row.status, reference: row.reference })),
      ...entries.map((row) => ({ kind: 'Gaming', title: row.tournament.title, href: `/experiences/gaming/${row.tournament.slug}`, startsAt: row.tournament.startsAt, status: row.status, reference: row.reference })),
      ...teams.map((row) => ({ kind: 'Gaming', title: row.entry.tournament.title, href: `/experiences/gaming/${row.entry.tournament.slug}`, startsAt: row.entry.tournament.startsAt, status: row.entry.status })),
    ];
    const isUpcoming = (item: { startsAt: Date | null }) => !item.startsAt || new Date(item.startsAt).getTime() >= now;
    res.json({
      upcoming: registrations.filter(isUpcoming).sort((a, b) => new Date(a.startsAt ?? 0).getTime() - new Date(b.startsAt ?? 0).getTime()),
      past: registrations.filter((item) => !isUpcoming(item)),
      teams: [
        ...entries.filter((row) => row.teamName).map((row) => ({ teamName: row.teamName, tournament: row.tournament.title, href: `/experiences/gaming/${row.tournament.slug}`, captain: true, inviteCode: row.inviteCode, members: row.members.map((m) => m.playerName) })),
        ...teams.map((row) => ({ teamName: row.entry.teamName, tournament: row.entry.tournament.title, href: `/experiences/gaming/${row.entry.tournament.slug}`, captain: false, inviteCode: null, members: [] })),
      ],
      communities: communities.map((row) => ({ name: row.community.name, href: `/experiences/communities/${row.community.slug}`, role: row.role })),
      eventPlans: enquiries.filter((row) => row.type === 'EVENT_PLAN').map((row) => ({ reference: row.reference, status: row.status, createdAt: row.createdAt, message: row.message })),
      published: published.map((row) => ({ title: row.title, href: `/activities/${row.slug}`, status: row.status, startsAt: row.startsAt })),
      savedCount: saved.length,
    });
  }),
);

experiencesMember.get(
  '/my-enquiries',
  requireAuth,
  route(async (req, res) => {
    const rows = await prisma.enquiry.findMany({ where: { userId: req.auth!.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({
      items: rows.map((row) => ({
        reference: row.reference,
        type: row.type,
        subjectTitle: row.subjectTitle,
        status: row.status,
        startDate: row.startDate,
        endDate: row.endDate,
        people: row.people,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    });
  }),
);

export { ENGAGEMENT_KINDS, PLACE_RESOURCE };
