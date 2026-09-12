'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { BookingDto, Paginated } from '@enhakkore/shared';
import { BOOKING_STATUS_LABELS } from '@enhakkore/shared';
import { DashboardShell, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Icon,
  Skeleton,
  cx,
} from '@/components/ui';
import { api } from '@/lib/api';
import { dateRange, daysUntil, price } from '@/lib/format';

type Scope = 'upcoming' | 'past' | 'all';

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All bookings' },
];

export default function MyTripsPage() {
  const [scope, setScope] = useState<Scope>('upcoming');
  const [bookings, setBookings] = useState<BookingDto[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBookings(null);
    (async () => {
      try {
        const result = await api.get<Paginated<BookingDto>>(`/bookings?scope=${scope}&pageSize=30`);
        if (!cancelled) setBookings(result.items);
      } catch {
        if (!cancelled) setBookings([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={['TRAVELER', 'ORGANIZER', 'ADMIN']} title="My trips">
      <div className="mb-7 flex gap-2">
        {SCOPES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setScope(item.id)}
            aria-pressed={scope === item.id}
            className={cx(
              'h-10 rounded-[--radius-pill] border px-4 text-[0.8125rem] font-semibold transition-all',
              scope === item.id
                ? 'border-ink bg-ink text-white'
                : 'border-line-strong bg-white text-ink-soft hover:border-ink',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {bookings === null ? (
        <div className="space-y-4">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-36 w-full" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<Icon.ticket size={34} />}
          title={scope === 'upcoming' ? 'No trips booked yet' : 'Nothing here yet'}
          description={
            scope === 'upcoming'
              ? 'When you join a trip it appears here, along with its private group and everything you need before you travel.'
              : 'Trips you have completed will show up here once they are done.'
          }
          action={
            <ButtonLink href="/trips">
              Find your next journey
              <Icon.arrow />
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <BookingRow key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function BookingRow({ booking }: { booking: BookingDto }) {
  const countdown = daysUntil(booking.departure.startDate);
  const cancelled = booking.status === 'CANCELLED' || booking.status === 'REFUNDED';

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-[--shadow-card]">
      <div className="flex flex-col sm:flex-row">
        <Link
          href={`/trips/${booking.trip.slug}`}
          className="media relative h-40 shrink-0 sm:h-auto sm:w-52"
        >
          <Image
            src={booking.trip.heroImage}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 208px"
            className={cx('object-cover', cancelled && 'grayscale')}
          />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  booking.status === 'CONFIRMED'
                    ? 'success'
                    : booking.status === 'COMPLETED'
                      ? 'brand'
                      : cancelled
                        ? 'danger'
                        : 'warning'
                }
              >
                {BOOKING_STATUS_LABELS[booking.status]}
              </Badge>
              {countdown !== null && countdown <= 14 && booking.status === 'CONFIRMED' && (
                <Badge tone="impact">
                  {countdown === 0 ? 'Departing today' : `In ${countdown} days`}
                </Badge>
              )}
            </div>

            <Link
              href={`/account/bookings/${booking.reference}`}
              className="mt-2.5 block text-[1.0625rem] font-bold leading-snug tracking-tight hover:text-acacia-700"
            >
              {booking.trip.title}
            </Link>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem] text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <Icon.calendar size={13} />
                {dateRange(booking.departure.startDate, booking.departure.endDate)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon.users size={13} />
                {booking.travellers} {booking.travellers === 1 ? 'traveller' : 'travellers'}
              </span>
              <span className="font-mono text-ink-faint">{booking.reference}</span>
            </div>

            {booking.impactAmount.amount > 0 && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[0.8125rem] text-clay-600">
                <Icon.ripple size={13} />
                {price(booking.impactAmount)} to {booking.impactProject?.title ?? 'an impact project'}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
            <p className="w-full text-[0.9375rem] font-bold sm:text-right">{price(booking.totalAmount)}</p>
            <div className="flex gap-2">
              {booking.conversationId && !cancelled && (
                <ButtonLink href={`/account/groups/${booking.conversationId}`} size="sm">
                  <Icon.chat size={14} />
                  Group
                </ButtonLink>
              )}
              <ButtonLink href={`/account/bookings/${booking.reference}`} variant="secondary" size="sm">
                Details
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
