'use client';

import { useEffect, useState } from 'react';
import type { BookingDto, Paginated } from '@enhakkore/shared';
import { BOOKING_STATUS_LABELS } from '@enhakkore/shared';
import { DashboardShell, ORGANIZER_NAV } from '@/components/layout/DashboardShell';
import { Badge, ButtonLink, Card, EmptyState, Icon, Skeleton, StatTile, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { dateRange, formatDate, price } from '@/lib/format';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'PENDING_PAYMENT', label: 'Awaiting payment' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

export default function OrganizerBookingsPage() {
  const [status, setStatus] = useState('all');
  const [bookings, setBookings] = useState<BookingDto[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBookings(null);
    (async () => {
      try {
        const result = await api.get<Paginated<BookingDto>>(
          `/organizers/me/bookings?status=${status}&pageSize=50`,
        );
        if (!cancelled) setBookings(result.items);
      } catch {
        if (!cancelled) setBookings([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const confirmed = (bookings ?? []).filter((b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED');
  const gross = confirmed.reduce((sum, b) => sum + b.tripAmount.amount, 0);
  const fees = confirmed.reduce((sum, b) => sum + b.platformFee.amount, 0);
  const impact = confirmed.reduce((sum, b) => sum + b.impactAmount.amount, 0);

  return (
    <DashboardShell nav={ORGANIZER_NAV} allow={['ORGANIZER']} title="Bookings">
      {bookings !== null && bookings.length > 0 && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Bookings" value={confirmed.length} />
          <StatTile label="Gross" value={price({ amount: gross, currency: 'TZS' }, true)} />
          <StatTile
            label="Net to you"
            value={price({ amount: gross - fees, currency: 'TZS' }, true)}
            hint={`after ${price({ amount: fees, currency: 'TZS' }, true)} platform fees`}
          />
          <StatTile
            label="Raised for impact"
            value={price({ amount: impact, currency: 'TZS' }, true)}
            tone="impact"
            hint="passes through in full"
          />
        </div>
      )}

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setStatus(filter.id)}
            aria-pressed={status === filter.id}
            className={cx(
              'h-10 shrink-0 rounded-[--radius-pill] border px-4 text-[0.8125rem] font-semibold transition-all',
              status === filter.id
                ? 'border-ink bg-ink text-white'
                : 'border-line-strong bg-white text-ink-soft hover:border-ink',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {bookings === null ? (
        <Skeleton className="h-80 w-full" />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<Icon.ticket size={34} />}
          title="No bookings here yet"
          description="Bookings appear as soon as a traveller confirms a seat on one of your departures. Publishing a trip with dates is the first step."
          action={
            <ButtonLink href="/organizer/trips">
              Manage my trips
              <Icon.arrow />
            </ButtonLink>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-[0.875rem]">
              <thead className="border-b border-line bg-sand/50">
                <tr>
                  {['Reference', 'Trip', 'Departure', 'Travellers', 'Booked', 'Status', 'Value'].map(
                    (heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-5 py-3 text-[0.75rem] font-semibold text-ink-muted"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-[0.8125rem]">
                      {booking.reference}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{booking.trip.title}</p>
                      <p className="mt-0.5 text-[0.75rem] text-ink-muted">
                        {booking.trip.destination.name}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-ink-muted">
                      {dateRange(booking.departure.startDate, booking.departure.endDate)}
                    </td>
                    <td className="px-5 py-4">
                      {booking.travellerDetails.map((traveller) => (
                        <p key={traveller.id} className="whitespace-nowrap">
                          {traveller.fullName}
                        </p>
                      ))}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-ink-muted">
                      {formatDate(booking.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        tone={
                          booking.status === 'CONFIRMED'
                            ? 'success'
                            : booking.status === 'COMPLETED'
                              ? 'brand'
                              : booking.status === 'PENDING_PAYMENT'
                                ? 'warning'
                                : 'danger'
                        }
                      >
                        {BOOKING_STATUS_LABELS[booking.status]}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <p className="font-semibold tabular-nums">{price(booking.tripAmount)}</p>
                      {booking.impactAmount.amount > 0 && (
                        <p className="text-[0.75rem] text-clay-600">
                          +{price(booking.impactAmount)} impact
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </DashboardShell>
  );
}
