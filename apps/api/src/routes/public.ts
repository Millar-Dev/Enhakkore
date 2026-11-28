import { Router, type Request } from 'express';
import {
  ACTIVITY_PUBLIC_STATUSES,
  ACTIVITY_RESOURCE,
  CATERING_RESOURCE,
  CHALLENGE_RESOURCE,
  DEAL_RESOURCE,
  EVENT_PUBLIC_STATUSES,
  EVENT_RESOURCE,
  EXPERIENCE_RESOURCE,
  IMPACT_RESOURCE,
  PLACE_RESOURCE,
  POLL_RESOURCE,
  STORY_RESOURCE,
  isValidTimeZone,
  weekendWindow,
} from '@enhakkore/shared';
import { ApiError, pageParams, paginated, route } from '../lib/http';
import { parseList, parseObjects } from '../lib/json';
import { prisma } from '../lib/prisma';
import { textContains } from '../lib/search';
import { toPublic, type Row } from '../services/resources/engine';
import { ENHAKKORE_ORGANIZER_SLUG } from '../services/resources/hooks';
import { getSettings } from '../services/settings';
import { rankByPopularity } from '../services/popularity';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Everything the public website reads. No session needed, nothing private
 * returned: private fields are dropped by the resource definitions, drafts and
 * demonstration records are never included, and only genuine published
 * content appears — the site would rather show an honest empty state than
 * pad a city with invented listings.
 */
export const publicRouter = Router();

const TOURNAMENT_SEARCH_STATUSES = ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED'];
const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const GEO = { country: true, city: true, category: true };

/** Location filters shared by every listing: ?country=TZ or a slug, ?city=dar-es-salaam. */
function geoWhere(req: Request): Row {
  const where: Row = {};
  const country = str(req.query.country);
  if (country) where.country = { OR: [{ code: country.toUpperCase() }, { slug: country.toLowerCase() }] };
  const city = str(req.query.city);
  if (city) where.city = { slug: city.toLowerCase() };
  const category = str(req.query.category);
  if (category) where.category = { slug: category.toLowerCase() };
  const group = str(req.query.group);
  if (group) where.category = { ...(where.category ?? {}), group };
  const section = str(req.query.section);
  if (section) where.category = { ...(where.category ?? {}), section: section.toUpperCase() };
  return where;
}

function searchWhere(req: Request, fields: string[]): Row | undefined {
  const q = str(req.query.q);
  return q ? { OR: fields.map((field) => ({ [field]: textContains(q) })) } : undefined;
}

/* ------------------------------ Site settings ----------------------------- */

publicRouter.get(
  '/site',
  route(async (_req, res) => {
    const now = new Date();
    const [settings, banners, methods] = await Promise.all([
      getSettings(),
      prisma.banner.findMany({
        where: {
          status: 'PUBLISHED',
          AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: new Date(now.getTime() - 86400000) } }] }],
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.paymentMethod.findMany({ where: { status: 'ENABLED' }, orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }] }),
    ]);
    res.json({
      settings,
      banners,
      paymentMethods: methods.map((method) => ({
        id: method.id,
        name: method.name,
        kind: method.kind,
        provider: method.provider,
        accountName: method.accountName,
        accountNumber: method.accountNumber,
        extraDetails: method.extraDetails,
        instructions: method.instructions,
        referenceFormat: method.referenceFormat,
        currencies: parseList(method.currencies),
        scopes: parseList(method.scopes),
        isDefault: method.isDefault,
      })),
    });
  }),
);

/* -------------------------------- Catalogue -------------------------------- */

export const LIVE = {
  activity: { status: { in: ACTIVITY_PUBLIC_STATUSES } },
  place: { status: 'PUBLISHED' },
  experience: { status: 'PUBLISHED' },
  event: { status: { in: EVENT_PUBLIC_STATUSES } },
  trip: { status: 'PUBLISHED', organizer: { slug: ENHAKKORE_ORGANIZER_SLUG } },
};

/** Countries and cities that have something to show, with counts per division. */
publicRouter.get(
  '/catalogue',
  route(async (req, res) => {
    const [countries, categories] = await Promise.all([
      prisma.country.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          id: true,
          code: true,
          name: true,
          slug: true,
          region: true,
          latitude: true,
          longitude: true,
          heroImage: true,
          featured: true,
          timezone: true,
          _count: {
            select: {
              activities: { where: LIVE.activity },
              places: { where: LIVE.place },
              experiences: { where: LIVE.experience },
              events: { where: LIVE.event },
              trips: { where: LIVE.trip },
            },
          },
          cities: {
            where: { status: 'PUBLISHED' },
            select: {
              id: true,
              name: true,
              slug: true,
              featured: true,
              timezone: true,
              latitude: true,
              longitude: true,
              heroImage: true,
              _count: {
                select: {
                  activities: { where: LIVE.activity },
                  places: { where: LIVE.place },
                  experiences: { where: LIVE.experience },
                  events: { where: LIVE.event },
                  trips: { where: LIVE.trip },
                },
              },
            },
            orderBy: { name: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.category.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, kind: true, name: true, slug: true, group: true, icon: true, featured: true, description: true, section: true },
      }),
    ]);
    const total = (counts: Record<string, number>) => Object.values(counts).reduce((sum, value) => sum + value, 0);
    const withContent = countries
      .map((country) => ({
        ...country,
        counts: country._count,
        total: total(country._count),
        cities: country.cities.map((city) => ({ ...city, counts: city._count, total: total(city._count) })).filter((city) => city.total > 0 || city.featured),
      }))
      .filter((country) => req.query.all === '1' || country.total > 0 || country.featured);
    res.json({
      countries: withContent.map(({ _count, ...country }) => ({ ...country, cities: country.cities.map(({ _count: _c, ...city }) => city) })),
      categories,
    });
  }),
);

publicRouter.get(
  '/countries',
  route(async (_req, res) => {
    // Every country, for pickers (profile, member search). Names only.
    res.json(await prisma.country.findMany({ where: { status: 'PUBLISHED' }, select: { id: true, code: true, name: true, slug: true, timezone: true }, orderBy: { name: 'asc' } }));
  }),
);

publicRouter.get(
  '/countries/:slug',
  route(async (req, res) => {
    const slug = req.params.slug.toLowerCase();
    const country = await prisma.country.findFirst({
      where: { status: 'PUBLISHED', OR: [{ slug }, { code: slug.toUpperCase() }] },
      include: { cities: { where: { status: 'PUBLISHED' }, orderBy: { name: 'asc' } } },
    });
    if (!country) throw ApiError.notFound('We do not have that country.');
    res.json(country);
  }),
);

/* ------------------------------- Activities ------------------------------- */

function activityWhen(req: Request): Row {
  const now = new Date();
  const when = str(req.query.when) ?? 'upcoming';
  if (when === 'past') return { OR: [{ status: 'COMPLETED' }, { AND: [{ startsAt: { lt: now } }, { OR: [{ endsAt: null }, { endsAt: { lt: now } }] }, { recurrence: null }] }] };
  if (when === 'all') return {};
  return {
    status: { in: ['PUBLISHED', 'FULL', 'CANCELLED'] },
    OR: [{ startsAt: null }, { startsAt: { gte: now } }, { endsAt: { gte: now } }, { recurrence: { not: null } }],
  };
}

function dateRange(req: Request, field: string): Row | undefined {
  const from = str(req.query.from);
  const to = str(req.query.to);
  if (!from && !to) return undefined;
  return {
    [field]: {
      ...(from && /^\d{4}-\d{2}-\d{2}/.test(from) ? { gte: new Date(`${from.slice(0, 10)}T00:00:00Z`) } : {}),
      ...(to && /^\d{4}-\d{2}-\d{2}/.test(to) ? { lte: new Date(`${to.slice(0, 10)}T23:59:59Z`) } : {}),
    },
  };
}

export function toActivity(row: Row): Row {
  const out = toPublic(ACTIVITY_RESOURCE, row);
  out.spacesLeft = row.capacity === null ? null : Math.max(0, row.capacity - row.spotsTaken);
  delete out.organiserUserId;
  return out;
}

publicRouter.get(
  '/activities',
  route(async (req, res) => {
    const page = pageParams(req.query as Record<string, unknown>, 24, 60);
    const and: Row[] = [{ status: { in: ACTIVITY_PUBLIC_STATUSES } }, geoWhere(req), activityWhen(req)];
    const mode = str(req.query.mode);
    if (mode) and.push({ mode });
    const level = str(req.query.level);
    if (level) and.push({ level: { in: [level, 'ALL'] } });
    const source = str(req.query.source);
    if (source) and.push({ source });
    if (req.query.available === 'true') and.push({ status: 'PUBLISHED' });
    const range = dateRange(req, 'startsAt');
    if (range) and.push(range);
    const search = searchWhere(req, ['title', 'summary', 'organiserName']);
    if (search) and.push(search);
    const where = { AND: and };
    const [rows, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        include: GEO,
        orderBy: str(req.query.when) === 'past' ? { startsAt: 'desc' } : [{ featured: 'desc' }, { startsAt: 'asc' }],
        skip: page.skip,
        take: page.take,
      }),
      prisma.activity.count({ where }),
    ]);
    res.json(paginated(rows.map(toActivity), total, page));
  }),
);

publicRouter.get(
  '/activities/:slug',
  route(async (req, res) => {
    const row = await prisma.activity.findFirst({
      where: { slug: req.params.slug, status: { in: ACTIVITY_PUBLIC_STATUSES } },
      include: GEO,
    });
    if (!row) throw ApiError.notFound('That activity is not available.');
    const activity = toActivity(row);
    let viewer: Row | null = null;
    if (req.auth) {
      const request = await prisma.activityParticipant.findUnique({ where: { activityId_userId: { activityId: row.id, userId: req.auth.id } } });
      viewer = {
        requestStatus: request?.status ?? null,
        isOrganiser: row.organiserUserId === req.auth.id,
        // Joining details only reach the people who are going.
        onlineDetails: request?.status === 'APPROVED' || row.organiserUserId === req.auth.id ? row.onlineDetails : null,
      };
    }
    const approved = await prisma.activityParticipant.count({ where: { activityId: row.id, status: 'APPROVED' } });
    res.json({ activity, viewer, approvedCount: approved });
  }),
);

/* --------------------------------- Places --------------------------------- */

publicRouter.get(
  '/places',
  route(async (req, res) => {
    const page = pageParams(req.query as Record<string, unknown>, 24, 60);
    const and: Row[] = [{ status: 'PUBLISHED' }, geoWhere(req)];
    if (req.query.hiddenGem === 'true') and.push({ hiddenGem: true });
    if (req.query.verified === 'true') and.push({ infoSource: 'VERIFIED' });
    const search = searchWhere(req, ['name', 'summary', 'area', 'address']);
    if (search) and.push(search);
    // Filters read only what a listing states: its facilities, amenities, menu and price range.
    const facility = str(req.query.facility);
    if (facility) and.push({ OR: [{ facilities: textContains(facility) }, { amenities: textContains(facility) }] });
    const cuisine = str(req.query.cuisine);
    if (cuisine) and.push({ OR: [{ category: { name: textContains(cuisine) } }, { summary: textContains(cuisine) }, { menu: textContains(cuisine) }] });
    const price = str(req.query.price);
    if (price) and.push({ priceRange: price });
    const where = { AND: and };
    const [rows, total] = await Promise.all([
      prisma.place.findMany({
        where,
        include: GEO,
        orderBy:
          str(req.query.sort) === 'recent'
            ? [{ publishedAt: 'desc' }]
            : [{ featured: 'desc' }, { name: 'asc' }],
        // Rating order is worked out over every match, then paged.
        skip: str(req.query.sort) === 'rating' ? 0 : page.skip,
        take: str(req.query.sort) === 'rating' ? 500 : page.take,
      }),
      prisma.place.count({ where }),
    ]);
    // Sponsored listings are labelled and never ranked by popularity; organic order comes from real engagement.
    let ordered = str(req.query.sort) === 'popular' ? await rankByPopularity('PLACE', rows) : rows;
    // Rating: the average of published member reviews only. Places without reviews come last, unrated.
    const ratings = await prisma.placeReview.groupBy({ by: ['placeId'], where: { placeId: { in: rows.map((row) => row.id) }, status: 'PUBLISHED' }, _avg: { rating: true }, _count: { _all: true } });
    const rated = new Map(ratings.map((row) => [row.placeId, { rating: Math.round((row._avg.rating ?? 0) * 10) / 10, count: row._count._all }]));
    if (str(req.query.sort) === 'rating') ordered = [...rows].sort((a, b) => (rated.get(b.id)?.rating ?? -1) - (rated.get(a.id)?.rating ?? -1)).slice(page.skip, page.skip + page.take);
    res.json(paginated(ordered.map((row) => { const out = toPublic(PLACE_RESOURCE, row); delete out.managerId; out.memberRating = rated.get(row.id) ?? null; return out; }), total, page));
  }),
);

publicRouter.get(
  '/places/:slug',
  route(async (req, res) => {
    const row = await prisma.place.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' }, include: GEO });
    if (!row) throw ApiError.notFound('That place is not listed.');
    const today = new Date();
    const [reviews, deals, aggregate] = await Promise.all([
      prisma.placeReview.findMany({
        where: { placeId: row.id, status: 'PUBLISHED' },
        include: { user: { select: { name: true, avatarUrl: true, country: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.deal.findMany({ where: { placeId: row.id, status: 'PUBLISHED', verified: true, OR: [{ validUntil: null }, { validUntil: { gte: today } }] } }),
      prisma.placeReview.aggregate({ where: { placeId: row.id, status: 'PUBLISHED' }, _avg: { rating: true }, _count: { _all: true } }),
    ]);
    const place = toPublic(PLACE_RESOURCE, row);
    delete place.managerId;
    res.json({
      place,
      // Ratings only from real, moderated member reviews; none means none.
      rating: aggregate._count._all > 0 ? { average: Math.round((aggregate._avg.rating ?? 0) * 10) / 10, count: aggregate._count._all } : null,
      reviews: reviews.map((review) => ({ id: review.id, rating: review.rating, body: review.body, createdAt: review.createdAt, author: { name: review.user.name.split(' ')[0], avatarUrl: review.user.avatarUrl, country: review.user.country } })),
      deals: deals.map((deal) => toPublic(DEAL_RESOURCE, deal)),
    });
  }),
);

/* ------------------------------- Experiences ------------------------------ */

publicRouter.get(
  '/experiences',
  route(async (req, res) => {
    const page = pageParams(req.query as Record<string, unknown>, 24, 60);
    const and: Row[] = [{ status: 'PUBLISHED' }, geoWhere(req)];
    const search = searchWhere(req, ['title', 'summary', 'provider']);
    if (search) and.push(search);
    const where = { AND: and };
    const [rows, total] = await Promise.all([
      prisma.experience.findMany({ where, include: GEO, orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }], skip: page.skip, take: page.take }),
      prisma.experience.count({ where }),
    ]);
    res.json(paginated(rows.map((row) => { const out = toPublic(EXPERIENCE_RESOURCE, row); delete out.managerId; return out; }), total, page));
  }),
);

publicRouter.get(
  '/experiences/:slug',
  route(async (req, res) => {
    const row = await prisma.experience.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' }, include: GEO });
    if (!row) throw ApiError.notFound('That experience is not available.');
    const out = toPublic(EXPERIENCE_RESOURCE, row);
    delete out.managerId;
    res.json(out);
  }),
);

/* --------------------------------- Events --------------------------------- */

export function toEvent(row: Row): Row {
  const out = toPublic(EVENT_RESOURCE, row);
  delete out.managerId;
  if (row.tickets) {
    out.tickets = row.tickets
      .filter((ticket: Row) => ticket.active)
      .map((ticket: Row) => ({
        id: ticket.id,
        name: ticket.name,
        description: ticket.description,
        price: ticket.price,
        currency: ticket.currency,
        remaining: ticket.capacity === null ? null : Math.max(0, ticket.capacity - ticket.sold),
      }));
    const sold = row.tickets.reduce((sum: number, ticket: Row) => sum + ticket.sold, 0);
    out.remaining = row.capacity === null ? null : Math.max(0, row.capacity - sold);
  }
  return out;
}

publicRouter.get(
  '/events',
  route(async (req, res) => {
    const page = pageParams(req.query as Record<string, unknown>, 24, 60);
    const now = new Date();
    const when = str(req.query.when) ?? 'upcoming';
    const and: Row[] = [{ status: { in: EVENT_PUBLIC_STATUSES } }, geoWhere(req)];
    if (when === 'upcoming') and.push({ OR: [{ startsAt: { gte: now } }, { endsAt: { gte: now } }] });
    if (when === 'past') and.push({ OR: [{ status: 'COMPLETED' }, { AND: [{ startsAt: { lt: now } }, { OR: [{ endsAt: null }, { endsAt: { lt: now } }] }] }] });
    const host = str(req.query.host);
    if (host) and.push({ host });
    const range = dateRange(req, 'startsAt');
    if (range) and.push(range);
    const search = searchWhere(req, ['title', 'summary', 'venue']);
    if (search) and.push(search);
    const where = { AND: and };
    const [rows, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: { ...GEO, tickets: true },
        orderBy: { startsAt: when === 'past' ? 'desc' : 'asc' },
        skip: page.skip,
        take: page.take,
      }),
      prisma.event.count({ where }),
    ]);
    res.json(paginated(rows.map(toEvent), total, page));
  }),
);

publicRouter.get(
  '/events/:slug',
  route(async (req, res) => {
    const row = await prisma.event.findFirst({
      where: { slug: req.params.slug, status: { in: EVENT_PUBLIC_STATUSES } },
      include: { ...GEO, tickets: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) throw ApiError.notFound('That event is not listed.');
    res.json(toEvent(row));
  }),
);

/* ------------------------------ Enhakkore trips ---------------------------- */

export const TRIP_PUBLIC_INCLUDE = {
  country: true,
  city: true,
  departures: { orderBy: { startDate: 'asc' as const } },
  itinerary: { orderBy: { dayNumber: 'asc' as const } },
};

export function toTrip(row: Row, full = false): Row {
  const now = Date.now();
  const departures = (row.departures ?? []).map((departure: Row) => {
    const deadline = departure.bookingDeadline ? new Date(departure.bookingDeadline).getTime() + 86400000 : null;
    const started = new Date(departure.startDate).getTime() < now;
    const seatsLeft = Math.max(0, departure.capacity - departure.seatsBooked);
    return {
      id: departure.id,
      startDate: departure.startDate,
      endDate: departure.endDate,
      capacity: departure.capacity,
      seatsLeft,
      price: departure.price ?? row.basePrice,
      bookingDeadline: departure.bookingDeadline,
      past: new Date(departure.endDate).getTime() < now,
      // Applications are taken only for a future, open departure with seats, before its deadline.
      bookable: !started && departure.status !== 'CLOSED' && seatsLeft > 0 && (deadline === null || deadline > now),
      status: departure.status,
    };
  });
  const upcoming = departures.filter((departure: Row) => !departure.past);
  const out: Row = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    // Per person, part of the price (deducted from it), or null.
    depositAmount: row.depositAmount ?? null,
    type: row.type,
    summary: row.summary,
    destinationLabel: row.destinationLabel ?? row.city?.name ?? row.country?.name ?? null,
    departureCity: row.departureCity,
    country: row.country ? { name: row.country.name, slug: row.country.slug, code: row.country.code } : null,
    city: row.city ? { name: row.city.name, slug: row.city.slug } : null,
    durationDays: row.durationDays,
    durationNights: row.durationNights,
    basePrice: row.basePrice,
    currency: row.currency,
    priceTiers: parseObjects(row.priceTiers),
    heroImage: row.heroImage,
    featured: row.featured,
    stage: row.stage ?? 'REGISTRATION_OPEN',
    departures,
    nextDeparture: upcoming[0] ?? null,
    isPast: departures.length > 0 && upcoming.length === 0,
  };
  if (full) {
    Object.assign(out, {
      description: row.description,
      meetingPoint: row.meetingPoint,
      accommodation: row.accommodation,
      transport: row.transport,
      minParticipants: row.minParticipants,
      maxParticipants: row.maxParticipants,
      includes: parseList(row.includes),
      excludes: parseList(row.excludes),
      toConfirm: parseList(row.toConfirm),
      requirements: parseList(row.requirements),
      paymentInstructions: row.paymentInstructions,
      paymentOptions: parseObjects(row.paymentOptions),
      cancellationPolicy: row.cancellationPolicy,
      galleryItems: parseObjects(row.galleryItems),
      videoUrl: row.videoUrl,
      itinerary: (row.itinerary ?? []).map((day: Row) => ({
        dayNumber: day.dayNumber,
        title: day.title,
        label: day.label,
        summary: day.summary,
        accommodation: day.accommodation,
        stops: parseObjects(day.stops),
      })),
    });
  }
  return out;
}

publicRouter.get(
  '/trips',
  route(async (req, res) => {
    const rows = await prisma.trip.findMany({
      where: { ...LIVE.trip, ...geoWhere(req) },
      include: TRIP_PUBLIC_INCLUDE,
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    const trips = rows.map((row) => toTrip(row));
    const when = str(req.query.when) ?? 'upcoming';
    const pick = when === 'past' ? trips.filter((trip) => trip.isPast) : when === 'all' ? trips : trips.filter((trip) => !trip.isPast);
    pick.sort((a, b) => {
      const da = new Date((a.nextDeparture ?? a.departures[a.departures.length - 1])?.startDate ?? 0).getTime();
      const db = new Date((b.nextDeparture ?? b.departures[b.departures.length - 1])?.startDate ?? 0).getTime();
      return when === 'past' ? db - da : da - db;
    });
    res.json({ items: pick });
  }),
);

publicRouter.get(
  '/trips/:slug',
  route(async (req, res) => {
    const row = await prisma.trip.findFirst({ where: { slug: req.params.slug, ...LIVE.trip }, include: TRIP_PUBLIC_INCLUDE });
    if (!row) throw ApiError.notFound('That trip is not available.');
    res.json(toTrip(row, true));
  }),
);

/* ----------------------- Catering, stories and more ----------------------- */

publicRouter.get(
  '/catering',
  route(async (_req, res) => {
    const rows = await prisma.cateringPackage.findMany({ where: { status: 'PUBLISHED' }, orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }] });
    res.json(rows.map((row) => toPublic(CATERING_RESOURCE, row)));
  }),
);

publicRouter.get(
  '/stories',
  route(async (req, res) => {
    const page = pageParams(req.query as Record<string, unknown>, 12, 48);
    const where = { status: 'PUBLISHED', ...geoWhere(req) };
    delete (where as Row).category;
    const [rows, total] = await Promise.all([
      prisma.story.findMany({ where, include: { country: true, city: true }, orderBy: { publishedAt: 'desc' }, skip: page.skip, take: page.take }),
      prisma.story.count({ where }),
    ]);
    res.json(paginated(rows.map((row) => toPublic(STORY_RESOURCE, row)), total, page));
  }),
);

publicRouter.get(
  '/stories/:slug',
  route(async (req, res) => {
    const row = await prisma.story.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' }, include: { country: true, city: true } });
    if (!row) throw ApiError.notFound('That story is not published.');
    res.json(toPublic(STORY_RESOURCE, row));
  }),
);

publicRouter.get(
  '/deals',
  route(async (req, res) => {
    const today = new Date();
    const where: Row = {
      status: 'PUBLISHED',
      verified: true,
      AND: [{ OR: [{ validUntil: null }, { validUntil: { gte: new Date(today.getTime() - 86400000) } }] }],
      ...geoWhere(req),
    };
    delete where.category;
    const rows = await prisma.deal.findMany({ where, include: { country: true, city: true, place: { select: { slug: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 60 });
    res.json(rows.map((row) => ({ ...toPublic(DEAL_RESOURCE, row), place: row.place })));
  }),
);

publicRouter.get(
  '/polls',
  route(async (req, res) => {
    const rows = await prisma.poll.findMany({
      where: { status: { in: ['OPEN', 'CLOSED'] } },
      include: { country: true, city: true, votes: { select: { optionIndex: true, userId: true } } },
      orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });
    res.json(
      rows.map((row) => {
        const options = parseList(row.options);
        const tally = options.map((_, index) => row.votes.filter((vote) => vote.optionIndex === index).length);
        const mine = req.auth ? row.votes.find((vote) => vote.userId === req.auth!.id)?.optionIndex ?? null : null;
        const closed = row.status === 'CLOSED' || (row.closesAt !== null && row.closesAt.getTime() < Date.now());
        const { votes: _votes, ...rest } = row;
        return { ...toPublic(POLL_RESOURCE, rest), tally, totalVotes: row.votes.length, myVote: mine, closed };
      }),
    );
  }),
);

publicRouter.get(
  '/challenges',
  route(async (_req, res) => {
    const rows = await prisma.challenge.findMany({ where: { status: 'PUBLISHED' }, include: { country: true, city: true }, orderBy: { createdAt: 'desc' }, take: 20 });
    res.json(rows.map((row) => toPublic(CHALLENGE_RESOURCE, row)));
  }),
);

/* --------------------------------- Impact --------------------------------- */

function toProject(row: Row): Row {
  const out = toPublic(IMPACT_RESOURCE, row);
  // Totals appear only once the owner has switched verified funding on for the project.
  if (row.showFunding) {
    out.funding = { goal: row.goal || null, raised: row.raised, currency: row.currency, contributors: row.contributorCount };
  }
  delete out.goal;
  return out;
}

publicRouter.get(
  '/impact',
  route(async (_req, res) => {
    const rows = await prisma.impactProject.findMany({
      where: { isDemo: false, status: { in: ['ACTIVE', 'PAUSED', 'COMPLETED', 'FUNDED'] } },
      orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }],
    });
    res.json(rows.map(toProject));
  }),
);

publicRouter.get(
  '/impact/:slug',
  route(async (req, res) => {
    const row = await prisma.impactProject.findFirst({
      where: { slug: req.params.slug, isDemo: false, status: { in: ['ACTIVE', 'PAUSED', 'COMPLETED', 'FUNDED'] } },
      include: { updates: { where: { published: true }, orderBy: { publishedAt: 'desc' } } },
    });
    if (!row) throw ApiError.notFound('That project is not published.');
    res.json({
      ...toProject(row),
      updates: row.updates.map((update) => ({ id: update.id, title: update.title, body: update.body, images: parseList(update.images), milestone: update.milestone, publishedAt: update.publishedAt })),
    });
  }),
);

/* ------------------------------ Home and search ---------------------------- */

/**
 * The homepage in one request. Weekend Radar is worked out in the launch
 * city's time zone (or the city asked for), so "this weekend" means the same
 * Friday-to-Sunday for everyone looking at that city.
 */
publicRouter.get(
  '/home',
  route(async (req, res) => {
    const settings = await getSettings();
    const citySlug = str(req.query.city);
    const city = citySlug ? await prisma.city.findFirst({ where: { slug: citySlug }, include: { country: true } }) : null;
    const zone = city?.timezone && isValidTimeZone(city.timezone) ? city.timezone : city?.country.timezone && isValidTimeZone(city.country.timezone) ? city.country.timezone : 'Africa/Dar_es_Salaam';
    const { start, end } = weekendWindow(zone);
    const now = new Date();
    const cityWhere = city ? { cityId: city.id } : {};

    const [weekendActivities, weekendEvents, weekendExperiences, activities, events, experiences, places, trips, stories, projects, catering, newest] = await Promise.all([
      prisma.activity.findMany({ where: { status: { in: ['PUBLISHED', 'FULL'] }, startsAt: { gte: start, lte: end }, ...cityWhere }, include: GEO, orderBy: { startsAt: 'asc' }, take: 8 }),
      prisma.event.findMany({ where: { status: { in: ['PUBLISHED', 'SOLD_OUT'] }, startsAt: { lte: end }, OR: [{ startsAt: { gte: start } }, { endsAt: { gte: start } }], ...cityWhere }, include: { ...GEO, tickets: true }, orderBy: { startsAt: 'asc' }, take: 8 }),
      prisma.experience.findMany({ where: { status: 'PUBLISHED', startsAt: { gte: start, lte: end }, ...cityWhere }, include: GEO, take: 6 }),
      prisma.activity.findMany({
        where: { status: { in: ['PUBLISHED', 'FULL'] }, OR: [{ startsAt: null }, { startsAt: { gte: now } }, { recurrence: { not: null } }] },
        include: GEO,
        orderBy: [{ featured: 'desc' }, { startsAt: 'asc' }],
        take: 8,
      }),
      prisma.event.findMany({ where: { status: { in: ['PUBLISHED', 'SOLD_OUT'] }, OR: [{ startsAt: { gte: now } }, { endsAt: { gte: now } }] }, include: { ...GEO, tickets: true }, orderBy: { startsAt: 'asc' }, take: 6 }),
      prisma.experience.findMany({ where: { status: 'PUBLISHED' }, include: GEO, orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }], take: 6 }),
      prisma.place.findMany({ where: { status: 'PUBLISHED' }, include: GEO, orderBy: [{ sponsored: 'desc' }, { featured: 'desc' }, { updatedAt: 'desc' }], take: 8 }),
      prisma.trip.findMany({ where: LIVE.trip, include: TRIP_PUBLIC_INCLUDE, take: 40 }),
      prisma.story.findMany({ where: { status: 'PUBLISHED' }, include: { country: true, city: true }, orderBy: { publishedAt: 'desc' }, take: 3 }),
      prisma.impactProject.findMany({ where: { isDemo: false, status: { in: ['ACTIVE', 'COMPLETED', 'FUNDED'] } }, orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }], take: 3 }),
      prisma.cateringPackage.findMany({ where: { status: 'PUBLISHED' }, orderBy: { sortOrder: 'asc' }, take: 3 }),
      Promise.all([
        prisma.activity.findMany({ where: { status: { in: ['PUBLISHED', 'FULL'] }, publishedAt: { not: null } }, orderBy: { publishedAt: 'desc' }, take: 4, select: { title: true, slug: true, publishedAt: true, coverImage: true } }),
        prisma.place.findMany({ where: { status: 'PUBLISHED', publishedAt: { not: null } }, orderBy: { publishedAt: 'desc' }, take: 4, select: { name: true, slug: true, publishedAt: true, coverImage: true } }),
        prisma.event.findMany({ where: { status: { in: ['PUBLISHED', 'SOLD_OUT'] }, publishedAt: { not: null } }, orderBy: { publishedAt: 'desc' }, take: 4, select: { title: true, slug: true, publishedAt: true, poster: true } }),
        prisma.experience.findMany({ where: { status: 'PUBLISHED', publishedAt: { not: null } }, orderBy: { publishedAt: 'desc' }, take: 4, select: { title: true, slug: true, publishedAt: true, coverImage: true } }),
      ]),
    ]);

    const allTrips = trips.map((row) => toTrip(row));
    const [newActivities, newPlaces, newEvents, newExperiences] = newest;
    const whatsNew = [
      ...newActivities.map((row) => ({ kind: 'Activity', title: row.title, href: `/activities/${row.slug}`, at: row.publishedAt, image: row.coverImage })),
      ...newPlaces.map((row) => ({ kind: 'Place', title: row.name, href: `/explore/${row.slug}`, at: row.publishedAt, image: row.coverImage })),
      ...newEvents.map((row) => ({ kind: 'Event', title: row.title, href: `/events/${row.slug}`, at: row.publishedAt, image: row.poster })),
      ...newExperiences.map((row) => ({ kind: 'Experience', title: row.title, href: `/experiences/${row.slug}`, at: row.publishedAt, image: row.coverImage })),
    ]
      .sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime())
      .slice(0, 6);

    res.json({
      launch: settings.launch,
      weekend: {
        zone,
        start,
        end,
        city: city ? { name: city.name, slug: city.slug } : null,
        activities: weekendActivities.map(toActivity),
        events: weekendEvents.map(toEvent),
        experiences: weekendExperiences.map((row) => toPublic(EXPERIENCE_RESOURCE, row)),
      },
      activities: activities.map(toActivity),
      events: events.map(toEvent),
      experiences: experiences.map((row) => toPublic(EXPERIENCE_RESOURCE, row)),
      places: places.map((row) => toPublic(PLACE_RESOURCE, row)),
      trips: allTrips.filter((trip) => !trip.isPast).sort((a, b) => new Date(a.nextDeparture?.startDate ?? 0).getTime() - new Date(b.nextDeparture?.startDate ?? 0).getTime()),
      pastTrips: allTrips.filter((trip) => trip.isPast).slice(0, 4),
      stories: stories.map((row) => toPublic(STORY_RESOURCE, row)),
      impact: projects.map(toProject),
      catering: catering.map((row) => toPublic(CATERING_RESOURCE, row)),
      whatsNew,
    });
  }),
);

/* --------------------------------- Search --------------------------------- */

/** Words people type, mapped to the category names they mean. */
const CATEGORY_WORDS: Record<string, string[]> = {
  hotel: ['Hotels', 'Resorts', 'Lodges', 'Guesthouses', 'Villas', 'Apartments', 'Holiday homes'],
  stay: ['Hotels', 'Resorts', 'Lodges', 'Guesthouses', 'Villas', 'Apartments', 'Holiday homes'],
  accommodation: ['Hotels', 'Resorts', 'Lodges', 'Guesthouses', 'Villas', 'Apartments', 'Holiday homes'],
  restaurant: ['Restaurants', 'Cafés', 'Food outlets'],
  food: ['Restaurants', 'Cafés', 'Food outlets', 'Catering'],
  cafe: ['Cafés'],
  beach: ['Beaches', 'Beach clubs'],
  venue: ['Wedding venues', 'Conference halls', 'Party venues', 'Gardens', 'Rooftops', 'Private event spaces', 'Entertainment venues'],
  attraction: ['Attractions', 'Cultural sites', 'Nature destinations', 'Places worth visiting', 'Recreation centres'],
  museum: ['Cultural sites', 'Attractions'],
  safari: ['Safaris'],
};

const stem = (word: string) => word.toLowerCase().replace(/(ies)$/, 'y').replace(/(es|s)$/, '');

/** "restaurants in Arusha" → keyword "restaurants", place "Arusha". */
async function parseQuery(raw: string) {
  let keyword = raw.trim();
  let city: { id: string; name: string } | null = null;
  let country: { id: string; name: string } | null = null;
  const match = /^(.*?)\s+(?:in|near|at)\s+(.+)$/i.exec(keyword);
  const tryPlace = async (text: string) => {
    const c = await prisma.city.findFirst({ where: { status: 'PUBLISHED', name: textContains(text) }, orderBy: { featured: 'desc' } });
    if (c) return { city: { id: c.id, name: c.name }, country: null };
    const k = await prisma.country.findFirst({ where: { status: 'PUBLISHED', name: textContains(text) } });
    return k ? { city: null, country: { id: k.id, name: k.name } } : null;
  };
  if (match) {
    const place = await tryPlace(match[2]!.trim());
    if (place) {
      keyword = match[1]!.trim();
      city = place.city;
      country = place.country;
    }
  }
  const words = keyword.split(/\s+/).filter(Boolean).map(stem);
  const categoryNames = [...new Set(words.flatMap((word) => CATEGORY_WORDS[word] ?? []))];
  // When the keyword was only a category word, search by category rather than by text.
  const textual = words.some((word) => !CATEGORY_WORDS[word]) ? keyword : '';
  return { keyword, textual, categoryNames, city, country };
}

publicRouter.get(
  '/search',
  route(async (req, res) => {
    const q = str(req.query.q) ?? '';
    const type = str(req.query.type);
    const parsed = q.length >= 2 ? await parseQuery(q) : { keyword: '', textual: '', categoryNames: [] as string[], city: null, country: null };
    const countryParam = str(req.query.country);
    const cityParam = str(req.query.city);
    const fromParam = str(req.query.from);
    const toParam = str(req.query.to);
    if (!q && !countryParam && !cityParam && !type) return res.json({ q, results: [], interpreted: null });

    const loc: Row = {};
    if (parsed.city) loc.cityId = parsed.city.id;
    else if (parsed.country) loc.countryId = parsed.country.id;
    if (countryParam) loc.country = { OR: [{ code: countryParam.toUpperCase() }, { slug: countryParam.toLowerCase() }] };
    if (cityParam) loc.city = { slug: cityParam.toLowerCase() };
    const dateRangeWhere = (field: string): Row => {
      const r: Row = {};
      if (fromParam && /^\d{4}-\d{2}-\d{2}/.test(fromParam)) r.gte = new Date(`${fromParam.slice(0, 10)}T00:00:00Z`);
      if (toParam && /^\d{4}-\d{2}-\d{2}/.test(toParam)) r.lte = new Date(`${toParam.slice(0, 10)}T23:59:59Z`);
      return Object.keys(r).length ? { [field]: r } : {};
    };
    const text = (fields: string[], categoryField = true): Row => {
      const or: Row[] = [];
      if (parsed.textual) or.push(...fields.map((field) => ({ [field]: textContains(parsed.textual) })), ...(categoryField ? [{ category: { name: textContains(parsed.textual) } }] : []));
      if (parsed.categoryNames.length && categoryField) or.push({ category: { name: { in: parsed.categoryNames } } });
      return or.length ? { OR: or } : {};
    };
    const want = (kind: string) => !type || type === kind;
    const take = 12;
    const now = new Date();
    const [activities, places, experiences, events, trips, tournaments, communities, cities, countries] = await Promise.all([
      want('activity') ? prisma.activity.findMany({ where: { AND: [{ status: { in: ACTIVITY_PUBLIC_STATUSES } }, loc, text(['title', 'summary', 'platformName']), dateRangeWhere('startsAt')] }, include: GEO, take }) : [],
      want('place') ? prisma.place.findMany({ where: { AND: [{ status: 'PUBLISHED' }, loc, text(['name', 'summary', 'area'])] }, include: GEO, take }) : [],
      want('experience') ? prisma.experience.findMany({ where: { AND: [{ status: 'PUBLISHED' }, loc, text(['title', 'summary'])] }, include: GEO, take }) : [],
      want('event') ? prisma.event.findMany({ where: { AND: [{ status: { in: EVENT_PUBLIC_STATUSES } }, loc, text(['title', 'summary', 'venue']), dateRangeWhere('startsAt')] }, include: GEO, take }) : [],
      want('trip')
        ? prisma.trip.findMany({
            where: {
              AND: [
                LIVE.trip,
                loc,
                parsed.textual || parsed.categoryNames.includes('Safaris')
                  ? { OR: [...(parsed.textual ? [{ title: textContains(parsed.textual) }, { summary: textContains(parsed.textual) }, { destinationLabel: textContains(parsed.textual) }] : []), ...(parsed.categoryNames.includes('Safaris') ? [{ type: 'SAFARI' }, { title: textContains('safari') }, { summary: textContains('safari') }] : [])] }
                  : {},
              ],
            },
            include: { country: true, city: true, departures: true },
            take,
          })
        : [],
      want('tournament') ? prisma.tournament.findMany({ where: { AND: [{ status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED'] } }, loc, parsed.textual ? { OR: [{ title: textContains(parsed.textual) }, { game: { name: textContains(parsed.textual) } }] } : {}, dateRangeWhere('startsAt')] }, include: { game: true, country: true, city: true }, take }) : [],
      want('community') ? prisma.community.findMany({ where: { AND: [{ status: 'PUBLISHED' }, loc, parsed.textual ? { OR: [{ name: textContains(parsed.textual) }, { summary: textContains(parsed.textual) }] } : {}] }, include: { country: true, city: true }, take }) : [],
      !type && parsed.textual ? prisma.city.findMany({ where: { status: 'PUBLISHED', name: textContains(parsed.textual) }, include: { country: true }, take: 6 }) : [],
      !type && parsed.textual ? prisma.country.findMany({ where: { status: 'PUBLISHED', name: textContains(parsed.textual) }, take: 4 }) : [],
    ]);
    const place = (row: Row) => [row.city?.name, row.country?.name].filter(Boolean).join(', ');
    const upcomingTrip = (row: Row) => (row.departures ?? []).some((d: Row) => new Date(d.endDate).getTime() >= now.getTime());
    res.json({
      q,
      interpreted: q ? { keyword: parsed.keyword, categories: parsed.categoryNames, city: parsed.city?.name ?? null, country: parsed.country?.name ?? null } : null,
      results: [
        ...trips.map((row) => ({ kind: 'Trip', type: 'trip', title: row.title, href: `/travel/${row.slug}`, where: row.destinationLabel ?? place(row), image: row.heroImage, past: !upcomingTrip(row) })),
        ...activities.map((row) => ({ kind: 'Activity', type: 'activity', title: row.title, href: `/activities/${row.slug}`, where: place(row), image: row.coverImage, startsAt: row.startsAt, isDemo: row.isDemo })),
        ...tournaments.map((row) => ({ kind: 'Gaming', type: 'tournament', title: row.title, href: `/experiences/gaming/${row.slug}`, where: row.game?.name ?? '', image: row.coverImage, startsAt: row.startsAt, isDemo: row.isDemo })),
        ...events.map((row) => ({ kind: 'Event', type: 'event', title: row.title, href: `/events/${row.slug}`, where: place(row), image: row.poster, startsAt: row.startsAt, isDemo: row.isDemo })),
        ...experiences.map((row) => ({ kind: 'Experience', type: 'experience', title: row.title, href: `/experiences/${row.slug}`, where: place(row), image: row.coverImage, isDemo: row.isDemo })),
        ...places.map((row) => ({ kind: row.category?.name ?? 'Place', type: 'place', title: row.name, href: `/explore/${row.slug}`, where: place(row), image: row.coverImage, isDemo: row.isDemo })),
        ...communities.map((row) => ({ kind: 'Community', type: 'community', title: row.name, href: `/experiences/communities/${row.slug}`, where: place(row), image: row.coverImage, isDemo: row.isDemo })),
        ...cities.map((row) => ({ kind: 'City', type: 'city', title: row.name, href: `/destinations/${row.country.slug}/${row.slug}`, where: row.country.name, image: row.heroImage })),
        ...countries.map((row) => ({ kind: 'Country', type: 'country', title: row.name, href: `/destinations/${row.slug}`, where: row.region ?? '', image: row.heroImage })),
      ],
    });
  }),
);

/** Quick suggestions as someone types: titles, places and categories. */
publicRouter.get(
  '/suggest',
  route(async (req, res) => {
    const q = str(req.query.q);
    if (!q || q.length < 2) return res.json({ items: [] });
    const take = 4;
    const [trips, activities, places, tournaments, cities, categories, games] = await Promise.all([
      prisma.trip.findMany({ where: { ...LIVE.trip, title: textContains(q) }, select: { title: true, slug: true }, take }),
      prisma.activity.findMany({ where: { status: { in: ['PUBLISHED', 'FULL'] }, title: textContains(q) }, select: { title: true, slug: true }, take }),
      prisma.place.findMany({ where: { status: 'PUBLISHED', name: textContains(q) }, select: { name: true, slug: true }, take }),
      prisma.tournament.findMany({ where: { status: { in: TOURNAMENT_SEARCH_STATUSES }, OR: [{ title: textContains(q) }, { game: { name: textContains(q) } }] }, select: { title: true, slug: true }, take }),
      prisma.city.findMany({ where: { status: 'PUBLISHED', name: textContains(q) }, include: { country: true }, take }),
      prisma.category.findMany({ where: { status: 'PUBLISHED', kind: { in: ['PLACE', 'ACTIVITY'] }, name: textContains(q) }, select: { name: true }, take }),
      prisma.category.findMany({ where: { status: 'PUBLISHED', kind: 'GAME', name: textContains(q) }, select: { name: true, slug: true }, take: 3 }),
    ]);
    res.json({
      items: [
        ...trips.map((row) => ({ label: row.title, kind: 'Trip', href: `/travel/${row.slug}` })),
        ...games.map((row) => ({ label: `${row.name} tournaments`, kind: 'Gaming', href: `/experiences/gaming?game=${row.slug}` })),
        ...tournaments.map((row) => ({ label: row.title, kind: 'Gaming', href: `/experiences/gaming/${row.slug}` })),
        ...activities.map((row) => ({ label: row.title, kind: 'Activity', href: `/activities/${row.slug}` })),
        ...places.map((row) => ({ label: row.name, kind: 'Place', href: `/explore/${row.slug}` })),
        ...categories.map((row) => ({ label: row.name, kind: 'Search', href: `/search?q=${encodeURIComponent(row.name)}` })),
        ...cities.map((row) => ({ label: `${row.name}, ${row.country.name}`, kind: 'City', href: `/destinations/${row.country.slug}/${row.slug}` })),
      ].slice(0, 10),
    });
  }),
);
