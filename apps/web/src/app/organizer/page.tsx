'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { BookingDto, OrganizerStats, Paginated, TripSummary } from '@enhakkore/shared';
import { TRIP_STATUS_LABELS, VERIFICATION_STATUS_LABELS } from '@enhakkore/shared';
import { DashboardShell, ORGANIZER_NAV } from '@/components/layout/DashboardShell';
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Icon,
  Skeleton,
  StatTile,
  cx,
} from '@/components/ui';
import { api } from '@/lib/api';
import { dateRange, price } from '@/lib/format';
import { useSession } from '@/lib/session';

export default function OrganizerDashboard() {
  const { organizer } = useSession();
  const [stats, setStats] = useState<OrganizerStats | null>(null);
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [bookings, setBookings] = useState<BookingDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statsResult, tripsResult, bookingsResult] = await Promise.all([
          api.get<OrganizerStats>('/organizers/me/stats'),
          api.get<Paginated<TripSummary>>('/organizers/me/trips?pageSize=8'),
          api.get<Paginated<BookingDto>>('/organizers/me/bookings?pageSize=5'),
        ]);
        if (cancelled) return;
        setStats(statsResult);
        setTrips(tripsResult.items);
        setBookings(bookingsResult.items);
      } catch {
        if (!cancelled) setTrips([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const unverified = organizer && organizer.verificationStatus !== 'VERIFIED';

  return (
    <DashboardShell
      nav={ORGANIZER_NAV}
      allow={['ORGANIZER']}
      title={organizer ? `Welcome, ${organizer.companyName}` : 'Dashboard'}
      action={
        <ButtonLink href="/organizer/trips/new">
          <Icon.plus />
          Create trip
        </ButtonLink>
      }
    >
      {/* Verification is the gate on everything else, so it leads. */}
      {unverified && (
        <Alert
          tone={organizer.verificationStatus === 'REJECTED' ? 'danger' : 'neutral'}
          className="mb-8"
          title={`Verification: ${VERIFICATION_STATUS_LABELS[organizer.verificationStatus]}`}
        >
          {organizer.verificationStatus === 'UNSUBMITTED' &&
            'Submit your business details and licensing before you can publish a listing. You can build drafts in the meantime.'}
          {organizer.verificationStatus === 'PENDING' &&
            'Your documents are with the Enhakkore team. We usually review within three working days.'}
          {organizer.verificationStatus === 'REJECTED' &&
            'We need more information before we can verify this account. Open verification to see what is missing.'}
          {organizer.verificationStatus === 'SUSPENDED' &&
            'This account is suspended and its listings are unpublished. Contact support@enhakkore.com.'}
          <div className="mt-4">
            <ButtonLink href="/organizer/verification" size="sm" variant="secondary">
              Open verification
            </ButtonLink>
          </div>
        </Alert>
      )}

      {/* Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Bookings"
          value={stats?.totalBookings ?? '—'}
          hint={stats ? `${stats.upcomingTravellers} travellers upcoming` : undefined}
        />
        <StatTile label="Active trips" value={stats?.activeTrips ?? '—'} hint={stats && stats.pendingTrips > 0 ? `${stats.pendingTrips} awaiting review` : undefined} />
        <StatTile
          label="Net revenue"
          value={stats ? price(stats.netRevenue, true) : '—'}
          hint={stats ? `after ${price(stats.platformFees, true)} platform fees` : undefined}
        />
        <StatTile
          label="Raised for impact"
          value={stats ? price(stats.impactRaised, true) : '—'}
          tone="impact"
          hint="through your trips"
        />
      </div>

      {/* Trips */}
      <div className="mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
            My trips
          </h2>
          <Link href="/organizer/trips" className="text-[0.8125rem] font-semibold text-acacia-700 hover:underline">
            Manage all
          </Link>
        </div>

        {trips === null ? (
          <Skeleton className="h-64 w-full" />
        ) : trips.length === 0 ? (
          <EmptyState
            icon={<Icon.compass size={34} />}
            title="No trips yet"
            description="Create your first listing — add the itinerary, set your dates and capacity, then submit it for review."
            action={
              <ButtonLink href="/organizer/trips/new">
                <Icon.plus />
                Create your first trip
              </ButtonLink>
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-[0.875rem]">
                <thead className="border-b border-line bg-sand/50">
                  <tr>
                    {['Trip', 'Next date', 'Joined', 'Capacity', 'Status', ''].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-5 py-3 text-[0.75rem] font-semibold text-ink-muted"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trips.map((trip) => {
                    const departure = trip.nextDeparture;
                    const fill = departure
                      ? Math.round((departure.seatsBooked / departure.capacity) * 100)
                      : 0;
                    return (
                      <tr key={trip.id} className="border-b border-line last:border-0">
                        <td className="px-5 py-4">
                          <Link
                            href={`/organizer/trips/${trip.id}`}
                            className="font-semibold hover:text-acacia-700"
                          >
                            {trip.title}
                          </Link>
                          <p className="mt-0.5 text-[0.75rem] text-ink-muted">{trip.destination.name}</p>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-ink-muted">
                          {departure ? dateRange(departure.startDate, departure.endDate) : 'No dates set'}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          {departure ? (
                            <span className="font-semibold tabular-nums">
                              {departure.seatsBooked}/{departure.capacity}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {departure ? (
                            <div className="w-24">
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand-deep">
                                <div
                                  className={cx(
                                    'h-full rounded-full',
                                    fill >= 100 ? 'bg-ink' : fill >= 80 ? 'bg-clay-500' : 'bg-acacia-600',
                                  )}
                                  style={{ width: `${Math.min(100, fill)}%` }}
                                />
                              </div>
                              <p className="mt-1 text-[0.6875rem] text-ink-muted">
                                {departure.status === 'FULL'
                                  ? 'Full'
                                  : departure.status === 'ALMOST_FULL'
                                    ? 'Almost full'
                                    : 'Open'}
                              </p>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <Badge
                            tone={
                              trip.status === 'PUBLISHED'
                                ? 'success'
                                : trip.status === 'PENDING_REVIEW'
                                  ? 'warning'
                                  : trip.status === 'REJECTED'
                                    ? 'danger'
                                    : 'neutral'
                            }
                          >
                            {TRIP_STATUS_LABELS[trip.status]}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <Link
                            href={`/organizer/trips/${trip.id}`}
                            className="text-[0.8125rem] font-semibold text-acacia-700 hover:underline"
                          >
                            Manage
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Recent bookings */}
      {bookings.length > 0 && (
        <div className="mt-10">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
              Recent bookings
            </h2>
            <Link
              href="/organizer/bookings"
              className="text-[0.8125rem] font-semibold text-acacia-700 hover:underline"
            >
              All bookings
            </Link>
          </div>

          <Card className="divide-y divide-line">
            {bookings.map((booking) => (
              <div key={booking.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="text-[0.9375rem] font-semibold">{booking.trip.title}</p>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-muted">
                    <span className="font-mono">{booking.reference}</span> ·{' '}
                    {dateRange(booking.departure.startDate, booking.departure.endDate)} ·{' '}
                    {booking.travellers} {booking.travellers === 1 ? 'traveller' : 'travellers'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[0.9375rem] font-bold">{price(booking.tripAmount)}</p>
                  {booking.impactAmount.amount > 0 && (
                    <p className="text-[0.75rem] text-clay-600">
                      +{price(booking.impactAmount)} impact
                    </p>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}
