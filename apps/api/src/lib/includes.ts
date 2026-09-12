import type { Prisma } from '@prisma/client';

/**
 * Shared Prisma include shapes.
 *
 * `toTripSummary` and `toOrganizerSummary` expect an organizer that carries its
 * published-trip count. Defining that once here stops a route from quietly
 * serving `tripCount: 0` because it forgot the `_count`.
 */

export const ORGANIZER_WITH_COUNT = {
  include: { _count: { select: { trips: { where: { status: 'PUBLISHED' } } } } },
} satisfies { include: Prisma.OrganizerInclude };

/** Everything `toTripSummary` needs, and nothing it does not. */
export const TRIP_SUMMARY_INCLUDE = {
  destination: true,
  organizer: ORGANIZER_WITH_COUNT,
  departures: { orderBy: { startDate: 'asc' } },
} satisfies Prisma.TripInclude;
