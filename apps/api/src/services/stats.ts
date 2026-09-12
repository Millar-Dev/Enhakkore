import type { OrganizerStats, PlatformStats, TravellerStats } from '@enhakkore/shared';
import { money } from '@enhakkore/shared';
import { prisma } from '../lib/prisma';

/** Whether the database still contains seeded demonstration content. */
export async function hasDemoData(): Promise<boolean> {
  const demoCount = await prisma.trip.count({ where: { isDemo: true } });
  return demoCount > 0;
}

export async function platformStats(): Promise<PlatformStats> {
  const [
    totalUsers,
    totalTravellers,
    activeOrganizers,
    pendingOrganizers,
    publishedTrips,
    pendingTrips,
    bookingAgg,
    commissionAgg,
    donationAgg,
    projectsSupported,
    communities,
    isDemoData,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'TRAVELER' } }),
    prisma.organizer.count({ where: { verificationStatus: 'VERIFIED' } }),
    prisma.organizer.count({ where: { verificationStatus: 'PENDING' } }),
    prisma.trip.count({ where: { status: 'PUBLISHED' } }),
    prisma.trip.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.booking.aggregate({
      where: { status: { in: ['CONFIRMED', 'COMPLETED'] } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.platformCommission.aggregate({ where: { status: 'EARNED' }, _sum: { amount: true } }),
    prisma.donation.aggregate({ where: { status: 'SUCCEEDED' }, _sum: { amount: true } }),
    prisma.impactProject.count({ where: { status: { in: ['ACTIVE', 'FUNDED', 'COMPLETED'] } } }),
    prisma.impactProject.findMany({
      where: { status: { in: ['ACTIVE', 'FUNDED', 'COMPLETED'] } },
      select: { location: true },
      distinct: ['location'],
    }),
    hasDemoData(),
  ]);

  return {
    totalUsers,
    totalTravellers,
    activeOrganizers,
    pendingOrganizers,
    publishedTrips,
    pendingTrips,
    totalBookings: bookingAgg._count,
    grossBookingValue: money(bookingAgg._sum.totalAmount ?? 0),
    platformRevenue: money(commissionAgg._sum.amount ?? 0),
    impactContributions: money(donationAgg._sum.amount ?? 0),
    projectsSupported,
    communitiesReached: communities.length,
    isDemoData,
  };
}

export async function travellerStats(userId: string): Promise<TravellerStats> {
  const bookings = await prisma.booking.findMany({
    where: { userId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
    include: { trip: { include: { destination: true } }, departure: true },
  });

  const now = Date.now();
  const completed = bookings.filter(
    (b) => b.status === 'COMPLETED' || new Date(b.departure.endDate).getTime() < now,
  );
  const upcoming = bookings.filter(
    (b) => b.status === 'CONFIRMED' && new Date(b.departure.endDate).getTime() >= now,
  );

  const destinations = new Set(completed.map((b) => b.trip.destinationId));
  const countries = new Set(completed.map((b) => b.trip.destination.country));

  const donations = await prisma.donation.findMany({
    where: { userId, status: 'SUCCEEDED' },
    select: { amount: true, projectId: true },
  });

  return {
    tripsCompleted: completed.length,
    upcomingTrips: upcoming.length,
    destinationsVisited: destinations.size,
    countriesVisited: countries.size,
    impactContributed: money(donations.reduce((sum, d) => sum + d.amount, 0)),
    projectsSupported: new Set(donations.map((d) => d.projectId)).size,
  };
}

export async function organizerStats(organizerId: string): Promise<OrganizerStats> {
  const [activeTrips, pendingTrips, bookings, organizer] = await Promise.all([
    prisma.trip.count({ where: { organizerId, status: 'PUBLISHED' } }),
    prisma.trip.count({ where: { organizerId, status: { in: ['PENDING_REVIEW', 'DRAFT'] } } }),
    prisma.booking.findMany({
      where: { trip: { organizerId }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      include: { departure: true },
    }),
    prisma.organizer.findUniqueOrThrow({ where: { id: organizerId } }),
  ]);

  const gross = bookings.reduce((sum, b) => sum + b.tripAmount, 0);
  const fees = bookings.reduce((sum, b) => sum + b.platformFee, 0);
  const impact = bookings.reduce((sum, b) => sum + b.impactAmount, 0);

  const now = Date.now();
  const upcomingTravellers = bookings
    .filter((b) => new Date(b.departure.startDate).getTime() >= now && b.status === 'CONFIRMED')
    .reduce((sum, b) => sum + b.travellers, 0);

  return {
    activeTrips,
    pendingTrips,
    totalBookings: bookings.length,
    upcomingTravellers,
    grossRevenue: money(gross),
    netRevenue: money(gross - fees),
    platformFees: money(fees),
    averageRating: organizer.rating ?? null,
    impactRaised: money(impact),
  };
}

/**
 * Recomputes an organizer's cached rating from published reviews. Called after
 * a review is created so the cached value never drifts.
 */
export async function refreshRatings(tripId: string, organizerId: string) {
  const [tripAgg, organizerAgg] = await Promise.all([
    prisma.review.aggregate({ where: { tripId, published: true }, _avg: { rating: true }, _count: true }),
    prisma.review.aggregate({ where: { organizerId, published: true }, _avg: { rating: true }, _count: true }),
  ]);

  await Promise.all([
    prisma.trip.update({
      where: { id: tripId },
      data: {
        rating: tripAgg._avg.rating ? round1(tripAgg._avg.rating) : null,
        reviewCount: tripAgg._count,
      },
    }),
    prisma.organizer.update({
      where: { id: organizerId },
      data: {
        rating: organizerAgg._avg.rating ? round1(organizerAgg._avg.rating) : null,
        reviewCount: organizerAgg._count,
      },
    }),
  ]);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
