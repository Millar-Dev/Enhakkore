'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Paginated, TripSummary } from '@enhakkore/shared';
import { TRIP_STATUS_LABELS } from '@enhakkore/shared';
import { DashboardShell, ORGANIZER_NAV } from '@/components/layout/DashboardShell';
import { Badge, ButtonLink, Card, EmptyState, Icon, Skeleton, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { dateRange, price } from '@/lib/format';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'PUBLISHED', label: 'Published' },
  { id: 'PENDING_REVIEW', label: 'In review' },
  { id: 'DRAFT', label: 'Drafts' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'ARCHIVED', label: 'Archived' },
];

export default function OrganizerTripsPage() {
  const [status, setStatus] = useState('all');
  const [trips, setTrips] = useState<TripSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTrips(null);
    (async () => {
      try {
        const result = await api.get<Paginated<TripSummary>>(
          `/organizers/me/trips?status=${status}&pageSize=40`,
        );
        if (!cancelled) setTrips(result.items);
      } catch {
        if (!cancelled) setTrips([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <DashboardShell
      nav={ORGANIZER_NAV}
      allow={['ORGANIZER']}
      title="My trips"
      action={
        <ButtonLink href="/organizer/trips/new">
          <Icon.plus />
          Create trip
        </ButtonLink>
      }
    >
      <div className="mb-7 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
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

      {trips === null ? (
        <div className="space-y-4">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <EmptyState
          icon={<Icon.compass size={34} />}
          title={status === 'all' ? 'No trips yet' : 'Nothing with that status'}
          description={
            status === 'all'
              ? 'Create your first listing — add the itinerary, set your dates and capacity, then submit it for review.'
              : 'Try another filter, or create a new trip.'
          }
          action={
            <ButtonLink href="/organizer/trips/new">
              <Icon.plus />
              Create trip
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => (
            <Card key={trip.id} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                <div className="media relative h-36 shrink-0 sm:h-auto sm:w-44">
                  <Image
                    src={trip.heroImage}
                    alt=""
                    fill
                    sizes="176px"
                    className={cx('object-cover', trip.status === 'ARCHIVED' && 'grayscale')}
                  />
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
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
                      <span className="text-[0.75rem] text-ink-muted">{trip.destination.name}</span>
                    </div>

                    <Link
                      href={`/organizer/trips/${trip.id}`}
                      className="mt-2 block text-[1.0625rem] font-bold leading-snug tracking-tight hover:text-acacia-700"
                    >
                      {trip.title}
                    </Link>

                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem] text-ink-muted">
                      <span>{price(trip.fromPrice)} per person</span>
                      {trip.nextDeparture ? (
                        <>
                          <span className="inline-flex items-center gap-1.5">
                            <Icon.calendar size={13} />
                            {dateRange(trip.nextDeparture.startDate, trip.nextDeparture.endDate)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Icon.users size={13} />
                            {trip.nextDeparture.seatsBooked}/{trip.nextDeparture.capacity}
                          </span>
                        </>
                      ) : (
                        <span>No upcoming dates</span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {trip.status === 'PUBLISHED' && (
                      <ButtonLink href={`/trips/${trip.slug}`} variant="ghost" size="sm">
                        View live
                      </ButtonLink>
                    )}
                    <ButtonLink href={`/organizer/trips/${trip.id}`} variant="secondary" size="sm">
                      Manage
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
