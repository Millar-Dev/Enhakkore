'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Paginated, TripSummary } from '@enhakkore/shared';
import { TRIP_STATUS_LABELS, TRIP_TYPE_LABELS } from '@enhakkore/shared';
import { DashboardShell, ADMIN_NAV } from '@/components/layout/DashboardShell';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Skeleton,
  VerifiedBadge,
  cx,
} from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { dateRange, duration, price } from '@/lib/format';

const FILTERS = [
  { id: 'PENDING_REVIEW', label: 'Awaiting review' },
  { id: 'all', label: 'All' },
  { id: 'PUBLISHED', label: 'Published' },
  { id: 'DRAFT', label: 'Drafts' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'ARCHIVED', label: 'Archived' },
];

function TripQueue() {
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? 'PENDING_REVIEW');
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setTrips(null);
    try {
      const result = await api.get<Paginated<TripSummary>>(`/admin/trips?status=${status}&pageSize=50`);
      setTrips(result.items);
    } catch {
      setTrips([]);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(trip: TripSummary, decision: 'PUBLISHED' | 'REJECTED' | 'ARCHIVED') {
    const note = notes[trip.id]?.trim();
    if (decision === 'REJECTED' && !note) {
      setError('Add a note saying what needs to change — the operator receives it.');
      return;
    }

    setBusyId(trip.id);
    setError(null);
    setNotice(null);
    try {
      await api.post(`/admin/trips/${trip.id}/review`, { decision, notes: note });
      setNotice(
        decision === 'PUBLISHED'
          ? `${trip.title} is live on the marketplace.`
          : `${trip.title} set to ${decision.toLowerCase()}.`,
      );
      setNotes((current) => ({ ...current, [trip.id]: '' }));
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That decision could not be saved.');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleFeature(trip: TripSummary) {
    setBusyId(trip.id);
    try {
      await api.post(`/admin/trips/${trip.id}/feature`, { featured: true });
      setNotice(`${trip.title} is now featured on the homepage.`);
      await load();
    } catch {
      setError('We could not change the featured state.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {notice && (
        <Alert tone="success" className="mb-6">
          {notice}
        </Alert>
      )}
      {error && (
        <Alert tone="danger" className="mb-6" role="alert">
          {error}
        </Alert>
      )}

      <Alert tone="neutral" className="mb-6">
        Check the itinerary against the price, that inclusions and exclusions are specific, and that the
        cover image is the operator&rsquo;s to use. A listing cannot be published while its operator is
        unverified.
      </Alert>

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

      {trips === null ? (
        <div className="space-y-4">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-48 w-full" />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <EmptyState
          icon={<Icon.check size={34} />}
          title={status === 'PENDING_REVIEW' ? 'The review queue is clear' : 'Nothing here'}
          description={
            status === 'PENDING_REVIEW'
              ? 'No listings are waiting for a decision right now.'
              : 'No trips match that filter.'
          }
        />
      ) : (
        <div className="space-y-5">
          {trips.map((trip) => (
            <Card key={trip.id} className="overflow-hidden">
              <div className="flex flex-col lg:flex-row">
                <div className="media relative h-44 shrink-0 lg:h-auto lg:w-60">
                  <Image src={trip.heroImage} alt="" fill sizes="240px" className="object-cover" />
                </div>

                <div className="flex-1 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
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
                        <Badge tone="neutral">{TRIP_TYPE_LABELS[trip.type]}</Badge>
                      </div>

                      <h2 className="mt-2.5 text-h3">{trip.title}</h2>

                      <p className="mt-1.5 text-[0.875rem] text-ink-muted">
                        {trip.destination.name}, {trip.destination.country} ·{' '}
                        {duration(trip.durationDays, trip.durationNights)} · {price(trip.fromPrice)}
                      </p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-3">
                        <Link
                          href={`/operators/${trip.organizer.slug}`}
                          className="text-[0.8125rem] font-semibold hover:text-acacia-700"
                        >
                          {trip.organizer.companyName}
                        </Link>
                        {trip.organizer.verificationStatus === 'VERIFIED' ? (
                          <VerifiedBadge isDemo={trip.organizer.isDemo} />
                        ) : (
                          <Badge tone="danger">Operator not verified</Badge>
                        )}
                      </div>
                    </div>

                    <Link
                      href={`/trips/${trip.slug}`}
                      target="_blank"
                      className="shrink-0 text-[0.8125rem] font-semibold text-acacia-700 hover:underline"
                    >
                      Preview listing →
                    </Link>
                  </div>

                  <p className="mt-4 max-w-3xl text-[0.875rem] leading-relaxed text-ink-soft">
                    {trip.summary}
                  </p>

                  <p className="mt-3 text-[0.8125rem] text-ink-muted">
                    {trip.nextDeparture
                      ? `Next departure ${dateRange(trip.nextDeparture.startDate, trip.nextDeparture.endDate)} · ${trip.nextDeparture.capacity} seats`
                      : 'No departure dates set'}
                  </p>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="flex-1">
                      <span className="mb-1.5 block text-[0.8125rem] font-semibold">
                        Review note <span className="font-normal text-ink-muted">— sent to the operator</span>
                      </span>
                      <input
                        value={notes[trip.id] ?? ''}
                        onChange={(event) =>
                          setNotes((current) => ({ ...current, [trip.id]: event.target.value }))
                        }
                        placeholder="e.g. Add park fees to inclusions or exclusions — it is unclear as written."
                        className="h-11 w-full rounded-[--radius-field] border border-line-strong px-3.5 text-[0.875rem] focus:border-acacia-600 focus:outline-none"
                      />
                    </label>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {trip.status !== 'PUBLISHED' && (
                        <Button
                          size="sm"
                          onClick={() => decide(trip, 'PUBLISHED')}
                          disabled={busyId === trip.id || trip.organizer.verificationStatus !== 'VERIFIED'}
                          title={
                            trip.organizer.verificationStatus === 'VERIFIED'
                              ? undefined
                              : 'Verify the operator first'
                          }
                        >
                          <Icon.check size={15} />
                          Publish
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => decide(trip, 'REJECTED')}
                        disabled={busyId === trip.id}
                      >
                        Reject
                      </Button>
                      {trip.status === 'PUBLISHED' && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => toggleFeature(trip)}
                            disabled={busyId === trip.id}
                          >
                            Feature
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => decide(trip, 'ARCHIVED')}
                            disabled={busyId === trip.id}
                          >
                            Archive
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export default function AdminTripsPage() {
  return (
    <DashboardShell nav={ADMIN_NAV} allow={['ADMIN']} title="Trip listings" wide>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <TripQueue />
      </Suspense>
    </DashboardShell>
  );
}
