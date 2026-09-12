import { Router } from 'express';
import { z } from 'zod';
import { TRAVEL_STYLES, TRIP_TYPES } from '@enhakkore/shared';
import type { Prisma } from '@prisma/client';
import { ApiError, pageParams, paginated, route } from '../lib/http';
import { prisma } from '../lib/prisma';
import { toTripDetail, toTripSummary } from '../serializers';

export const tripsRouter = Router();

const listQuery = z.object({
  q: z.string().trim().max(120).optional(),
  destination: z.string().trim().optional(),
  country: z.string().trim().optional(),
  type: z.string().trim().optional(),
  style: z.string().trim().optional(),
  organizer: z.string().trim().optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  minDuration: z.coerce.number().int().positive().optional(),
  maxDuration: z.coerce.number().int().positive().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  minGroup: z.coerce.number().int().positive().optional(),
  maxGroup: z.coerce.number().int().positive().optional(),
  availableOnly: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  sort: z.enum(['recommended', 'price_asc', 'price_desc', 'date', 'rating', 'newest']).default('recommended'),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

const TRIP_INCLUDE = {
  destination: true,
  organizer: true,
  departures: { orderBy: { startDate: 'asc' } },
} satisfies Prisma.TripInclude;

tripsRouter.get(
  '/',
  route(async (req, res) => {
    const query = listQuery.parse(req.query);
    const page = pageParams(query as Record<string, unknown>, 12, 48);

    // Only published listings are ever visible on the public marketplace.
    const where: Prisma.TripWhereInput = { status: 'PUBLISHED' };
    const and: Prisma.TripWhereInput[] = [];

    if (query.q) {
      and.push({
        OR: [
          { title: { contains: query.q } },
          { summary: { contains: query.q } },
          { destination: { name: { contains: query.q } } },
          { destination: { country: { contains: query.q } } },
          { organizer: { companyName: { contains: query.q } } },
        ],
      });
    }
    if (query.destination) {
      and.push({ destination: { OR: [{ slug: query.destination }, { name: { contains: query.destination } }] } });
    }
    if (query.country) and.push({ destination: { country: { contains: query.country } } });
    if (query.organizer) and.push({ organizer: { slug: query.organizer } });

    const types = splitList(query.type).filter((t) => TRIP_TYPES.includes(t as never));
    if (types.length) and.push({ type: { in: types } });

    const styles = splitList(query.style).filter((s) => TRAVEL_STYLES.includes(s as never));
    if (styles.length) and.push({ style: { in: styles } });

    if (query.minPrice != null) and.push({ basePrice: { gte: query.minPrice } });
    if (query.maxPrice != null) and.push({ basePrice: { lte: query.maxPrice } });
    if (query.minDuration != null) and.push({ durationDays: { gte: query.minDuration } });
    if (query.maxDuration != null) and.push({ durationDays: { lte: query.maxDuration } });
    if (query.featured) and.push({ featured: true });

    // Date and availability filters constrain the departures, not the listing —
    // a trip matches when at least one of its departures qualifies.
    const departureWhere: Prisma.TripDateWhereInput = {};
    if (query.from) departureWhere.startDate = { gte: startOfDay(query.from) };
    if (query.to) departureWhere.endDate = { lte: endOfDay(query.to) };
    if (query.minGroup != null) departureWhere.capacity = { gte: query.minGroup };
    if (query.maxGroup != null) {
      departureWhere.capacity = { ...(departureWhere.capacity as object), lte: query.maxGroup };
    }
    if (query.availableOnly) {
      departureWhere.status = { in: ['OPEN', 'ALMOST_FULL'] };
      departureWhere.startDate = { ...(departureWhere.startDate as object), gte: new Date() };
    }
    if (Object.keys(departureWhere).length > 0) {
      and.push({ departures: { some: departureWhere } });
    }

    if (and.length) where.AND = and;

    const orderBy = sortOrder(query.sort);

    const [rows, total] = await Promise.all([
      prisma.trip.findMany({ where, include: TRIP_INCLUDE, orderBy, skip: page.skip, take: page.take }),
      prisma.trip.count({ where }),
    ]);

    res.json(paginated(rows.map(toTripSummary), total, page));
  }),
);

/** Homepage rail: published trips with an upcoming departure, soonest first. */
tripsRouter.get(
  '/upcoming',
  route(async (req, res) => {
    const take = Math.min(12, Number(req.query.limit ?? 6) || 6);
    const rows = await prisma.trip.findMany({
      where: {
        status: 'PUBLISHED',
        departures: { some: { startDate: { gte: new Date() }, status: { in: ['OPEN', 'ALMOST_FULL'] } } },
      },
      include: TRIP_INCLUDE,
      take,
    });

    const sorted = rows
      .map(toTripSummary)
      .filter((trip) => trip.nextDeparture)
      .sort((a, b) => (a.nextDeparture!.startDate < b.nextDeparture!.startDate ? -1 : 1));

    res.json({ items: sorted });
  }),
);

tripsRouter.get(
  '/:slug',
  route(async (req, res) => {
    const trip = await prisma.trip.findUnique({
      where: { slug: req.params.slug },
      include: {
        ...TRIP_INCLUDE,
        itinerary: { orderBy: { dayNumber: 'asc' } },
        impactProject: true,
        reviews: {
          where: { published: true },
          include: { user: true },
          orderBy: { createdAt: 'desc' },
          take: 8,
        },
      },
    });

    if (!trip) throw ApiError.notFound('We could not find that trip.');

    // Drafts and listings under review are visible only to their organizer and
    // to admins — never to the public.
    const viewer = req.auth;
    const isOwner = viewer?.organizerId === trip.organizerId;
    const isAdmin = viewer?.role === 'ADMIN';
    if (trip.status !== 'PUBLISHED' && !isOwner && !isAdmin) {
      throw ApiError.notFound('We could not find that trip.');
    }

    // "Who's coming" shows only travellers with a confirmed booking, and only
    // their name, avatar and country.
    const travellerRows = await prisma.booking.findMany({
      where: { tripId: trip.id, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      select: { user: { select: { id: true, name: true, avatarUrl: true, country: true } } },
      distinct: ['userId'],
      take: 24,
    });

    res.json(toTripDetail(trip, travellerRows.map((row) => row.user)));
  }),
);

tripsRouter.get(
  '/:slug/reviews',
  route(async (req, res) => {
    const trip = await prisma.trip.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!trip) throw ApiError.notFound('We could not find that trip.');

    const page = pageParams(req.query as Record<string, unknown>, 10, 50);
    const where = { tripId: trip.id, published: true };

    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
      prisma.review.count({ where }),
    ]);

    const { toReview } = await import('../serializers');
    res.json(paginated(rows.map(toReview), total, page));
  }),
);

/* -------------------------------------------------------------------------- */

function splitList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
}

function sortOrder(sort: string): Prisma.TripOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_asc':
      return [{ basePrice: 'asc' }];
    case 'price_desc':
      return [{ basePrice: 'desc' }];
    case 'rating':
      return [{ rating: 'desc' }, { reviewCount: 'desc' }];
    case 'newest':
      return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
    case 'date':
      return [{ createdAt: 'asc' }];
    default:
      // "Recommended" leads with featured listings, then social proof.
      return [{ featured: 'desc' }, { rating: 'desc' }, { reviewCount: 'desc' }];
  }
}

function startOfDay(value: string): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: string): Date {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}
