'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type { BookingDto, Paginated, TripDetail } from '@enhakkore/shared';
import { TRIP_STATUS_LABELS, TRIP_TYPE_LABELS } from '@enhakkore/shared';
import { DashboardShell, ORGANIZER_NAV } from '@/components/layout/DashboardShell';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  Divider,
  EmptyState,
  Icon,
  Skeleton,
  StatTile,
  cx,
} from '@/components/ui';
import { Input, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api';
import { dateRange, formatDate, price } from '@/lib/format';

type Tab = 'overview' | 'departures' | 'travellers' | 'announce';

function TripManager() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const justCreated = search.get('created') === '1';

  const [tab, setTab] = useState<Tab>('overview');
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newDeparture, setNewDeparture] = useState({ startDate: '', endDate: '', capacity: '16', price: '' });
  const [announcement, setAnnouncement] = useState('');
  const [announceTo, setAnnounceTo] = useState('');
  const [pin, setPin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tripResult, bookingResult] = await Promise.all([
          api.get<TripDetail>(`/organizers/me/trips/${params.id}`),
          api.get<Paginated<BookingDto>>(`/organizers/me/bookings?tripId=${params.id}&pageSize=50`),
        ]);
        if (cancelled) return;
        setTrip(tripResult);
        setBookings(bookingResult.items);
        const firstUpcoming = tripResult.departures.find(
          (departure) => new Date(departure.startDate).getTime() > Date.now(),
        );
        if (firstUpcoming) setAnnounceTo(firstUpcoming.id);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'We could not load this trip.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function addDeparture() {
    if (!newDeparture.startDate || !newDeparture.endDate) {
      setError('Set both a departure and a return date.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(`/organizers/me/trips/${params.id}/departures`, {
        startDate: newDeparture.startDate,
        endDate: newDeparture.endDate,
        capacity: Number(newDeparture.capacity),
        price: newDeparture.price ? Number(newDeparture.price.replace(/[^0-9]/g, '')) : null,
      });
      const refreshed = await api.get<TripDetail>(`/organizers/me/trips/${params.id}`);
      setTrip(refreshed);
      setNewDeparture({ startDate: '', endDate: '', capacity: '16', price: '' });
      setNotice('Departure added.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'We could not add that departure.');
    } finally {
      setBusy(false);
    }
  }

  async function submitForReview() {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/organizers/me/trips/${params.id}`, { submit: true });
      const refreshed = await api.get<TripDetail>(`/organizers/me/trips/${params.id}`);
      setTrip(refreshed);
      setNotice('Submitted for review. We usually respond within two working days.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'We could not submit this trip.');
    } finally {
      setBusy(false);
    }
  }

  async function postAnnouncement() {
    if (!announcement.trim() || !announceTo) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/organizers/me/announcements', {
        tripDateId: announceTo,
        body: announcement.trim(),
        pin,
      });
      setAnnouncement('');
      setNotice('Announcement posted. Everyone on that departure has been notified.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'We could not post that announcement.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !trip) {
    return (
      <Alert tone="danger" title="We could not load this trip">
        {error}
        <div className="mt-4">
          <ButtonLink href="/organizer/trips" variant="secondary" size="sm">
            Back to my trips
          </ButtonLink>
        </div>
      </Alert>
    );
  }

  if (!trip) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const upcoming = trip.departures.filter((d) => new Date(d.startDate).getTime() > Date.now());
  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED');
  const grossRevenue = confirmed.reduce((sum, b) => sum + b.tripAmount.amount, 0);
  const impactRaised = confirmed.reduce((sum, b) => sum + b.impactAmount.amount, 0);
  const travellerCount = confirmed.reduce((sum, b) => sum + b.travellers, 0);

  return (
    <div>
      {justCreated && (
        <Alert tone="success" className="mb-6" title="Trip saved">
          {trip.status === 'PENDING_REVIEW'
            ? 'Your listing is with the Enhakkore team for review.'
            : 'Your draft is saved. Submit it for review when you are ready to publish.'}
        </Alert>
      )}
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

      {/* Header */}
      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          <div className="media relative h-40 shrink-0 sm:h-auto sm:w-56">
            <Image src={trip.heroImage} alt="" fill sizes="224px" className="object-cover" />
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-between gap-4 p-6">
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
              <h1 className="mt-3 text-h2">{trip.title}</h1>
              <p className="mt-1.5 text-[0.875rem] text-ink-muted">
                {trip.destination.name} · {price(trip.fromPrice)} per person
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {trip.status === 'PUBLISHED' && (
                <ButtonLink href={`/trips/${trip.slug}`} variant="secondary" size="sm">
                  View live listing
                </ButtonLink>
              )}
              {(trip.status === 'DRAFT' || trip.status === 'REJECTED') && (
                <Button size="sm" onClick={submitForReview} disabled={busy}>
                  Submit for review
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {trip.status === 'REJECTED' && (
        <Alert tone="danger" className="mt-6" title="This listing was not approved">
          Open the review notes in your email, make the changes, and submit again. If you are not sure what
          is needed, reply to that message and we will explain.
        </Alert>
      )}

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Bookings" value={confirmed.length} />
        <StatTile label="Travellers" value={travellerCount} />
        <StatTile label="Gross revenue" value={price({ amount: grossRevenue, currency: 'TZS' }, true)} />
        <StatTile
          label="Raised for impact"
          value={price({ amount: impactRaised, currency: 'TZS' }, true)}
          tone="impact"
        />
      </div>

      {/* Tabs */}
      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-line no-scrollbar">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'departures', label: `Departures (${trip.departures.length})` },
            { id: 'travellers', label: `Travellers (${confirmed.length})` },
            { id: 'announce', label: 'Announce' },
          ] as { id: Tab; label: string }[]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-current={tab === item.id ? 'page' : undefined}
            className={cx(
              'shrink-0 border-b-2 px-3.5 py-3 text-[0.875rem] font-semibold transition-colors',
              tab === item.id ? 'border-ink text-ink' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'overview' && (
          <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
            <div className="min-w-0">
              <h2 className="text-h3">Description</h2>
              <div className="prose-body mt-4">
                {trip.description.split('\n\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>

              <h2 className="mt-10 text-h3">Itinerary</h2>
              <ol className="mt-5 space-y-4">
                {trip.itinerary.map((day) => (
                  <li key={day.id} className="rounded-[--radius-card] border border-line p-5">
                    <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-ink-faint">
                      Day {day.dayNumber}
                    </p>
                    <h3 className="mt-1 text-[0.9375rem] font-bold tracking-tight">{day.title}</h3>
                    {day.activities.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {day.activities.map((activity, index) => (
                          <li key={index} className="text-[0.8125rem] text-ink-muted">
                            {activity}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            <aside className="space-y-5">
              <Card className="p-5">
                <h3 className="text-[0.8125rem] font-bold tracking-tight">Included</h3>
                <ul className="mt-3 space-y-2">
                  {trip.includes.map((item) => (
                    <li key={item} className="flex gap-2.5 text-[0.8125rem] text-ink-soft">
                      <Icon.check size={14} className="mt-0.5 shrink-0 text-acacia-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>

              {trip.impactProject && (
                <Card className="border-clay-100 p-5">
                  <h3 className="text-[0.8125rem] font-bold tracking-tight">Linked impact project</h3>
                  <Link
                    href={`/impact/${trip.impactProject.slug}`}
                    className="mt-2 block text-[0.875rem] font-semibold text-clay-600 hover:underline"
                  >
                    {trip.impactProject.title}
                  </Link>
                  <p className="mt-1 text-[0.75rem] text-ink-muted">
                    Travellers can contribute to this at checkout.
                  </p>
                </Card>
              )}

              <Card className="p-5">
                <h3 className="text-[0.8125rem] font-bold tracking-tight">Editing</h3>
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-muted">
                  Editing a published listing sends it back for review before the changes go live. Adding a
                  new departure date does not.
                </p>
              </Card>
            </aside>
          </div>
        )}

        {tab === 'departures' && (
          <div>
            <Card className="p-6">
              <h2 className="text-h3">Add a departure</h2>
              <div className="mt-5 grid items-end gap-4 sm:grid-cols-5">
                <Input
                  label="Departs"
                  type="date"
                  value={newDeparture.startDate}
                  onChange={(event) => setNewDeparture({ ...newDeparture, startDate: event.target.value })}
                />
                <Input
                  label="Returns"
                  type="date"
                  value={newDeparture.endDate}
                  onChange={(event) => setNewDeparture({ ...newDeparture, endDate: event.target.value })}
                />
                <Input
                  label="Capacity"
                  type="number"
                  min={1}
                  value={newDeparture.capacity}
                  onChange={(event) => setNewDeparture({ ...newDeparture, capacity: event.target.value })}
                />
                <Input
                  label="Price override"
                  inputMode="numeric"
                  value={newDeparture.price}
                  onChange={(event) => setNewDeparture({ ...newDeparture, price: event.target.value })}
                  placeholder="Optional"
                />
                <Button onClick={addDeparture} disabled={busy} className="mb-0.5">
                  <Icon.plus />
                  Add
                </Button>
              </div>
            </Card>

            <div className="mt-6 space-y-3">
              {trip.departures.map((departure) => {
                const past = new Date(departure.startDate).getTime() < Date.now();
                const fill = Math.round((departure.seatsBooked / departure.capacity) * 100);
                return (
                  <Card
                    key={departure.id}
                    className={cx('flex flex-wrap items-center justify-between gap-4 p-5', past && 'opacity-60')}
                  >
                    <div className="min-w-0">
                      <p className="text-[0.9375rem] font-bold tracking-tight">
                        {dateRange(departure.startDate, departure.endDate)}
                      </p>
                      <p className="mt-1 text-[0.8125rem] text-ink-muted">
                        {price(departure.price)} per person
                        {past && ' · departed'}
                      </p>
                    </div>

                    <div className="flex items-center gap-5">
                      <div className="w-32">
                        <div className="mb-1.5 flex justify-between text-[0.75rem]">
                          <span className="font-semibold">
                            {departure.seatsBooked}/{departure.capacity}
                          </span>
                          <span className="text-ink-muted">{fill}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand-deep">
                          <div
                            className={cx(
                              'h-full rounded-full',
                              fill >= 100 ? 'bg-ink' : fill >= 80 ? 'bg-clay-500' : 'bg-acacia-600',
                            )}
                            style={{ width: `${Math.min(100, fill)}%` }}
                          />
                        </div>
                      </div>
                      <Badge
                        tone={
                          departure.status === 'FULL'
                            ? 'dark'
                            : departure.status === 'ALMOST_FULL'
                              ? 'impact'
                              : 'success'
                        }
                      >
                        {departure.status.replace('_', ' ').toLowerCase()}
                      </Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'travellers' && (
          <div>
            {confirmed.length === 0 ? (
              <EmptyState
                icon={<Icon.users size={34} />}
                title="No bookings yet"
                description="Once travellers start booking, you will see who is coming on each departure here, along with anything they told you at checkout."
              />
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-left text-[0.875rem]">
                    <thead className="border-b border-line bg-sand/50">
                      <tr>
                        {['Reference', 'Travellers', 'Departure', 'Booked', 'Value'].map((heading) => (
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
                      {confirmed.map((booking) => (
                        <tr key={booking.id} className="border-b border-line last:border-0">
                          <td className="whitespace-nowrap px-5 py-4 font-mono text-[0.8125rem]">
                            {booking.reference}
                          </td>
                          <td className="px-5 py-4">
                            {booking.travellerDetails.map((traveller) => (
                              <p key={traveller.id} className="font-medium">
                                {traveller.fullName}
                              </p>
                            ))}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-ink-muted">
                            {dateRange(booking.departure.startDate, booking.departure.endDate)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-ink-muted">
                            {formatDate(booking.createdAt)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className="font-semibold">{price(booking.tripAmount)}</span>
                            {booking.impactAmount.amount > 0 && (
                              <span className="ml-2 text-[0.75rem] text-clay-600">
                                +{price(booking.impactAmount)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === 'announce' && (
          <div className="max-w-2xl">
            <Card className="p-6 md:p-8">
              <h2 className="text-h3">Post an announcement</h2>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">
                Announcements go into that departure&rsquo;s trip group and notify everyone on it. Use them
                for the things people must not miss — pickup times, kit lists, changes.
              </p>

              {upcoming.length === 0 ? (
                <Alert tone="neutral" className="mt-6">
                  No upcoming departures to announce to.
                </Alert>
              ) : (
                <>
                  <div className="mt-6">
                    <label
                      htmlFor="announce-departure"
                      className="mb-2 block text-[0.8125rem] font-semibold"
                    >
                      Which departure
                    </label>
                    <select
                      id="announce-departure"
                      value={announceTo}
                      onChange={(event) => setAnnounceTo(event.target.value)}
                      className="h-12 w-full rounded-[--radius-field] border border-line-strong px-3.5 text-[0.9375rem] focus:border-acacia-600 focus:outline-none"
                    >
                      {upcoming.map((departure) => (
                        <option key={departure.id} value={departure.id}>
                          {dateRange(departure.startDate, departure.endDate)} — {departure.seatsBooked}{' '}
                          travellers
                        </option>
                      ))}
                    </select>
                  </div>

                  <Textarea
                    containerClassName="mt-5"
                    label="Your announcement"
                    value={announcement}
                    onChange={(event) => setAnnouncement(event.target.value)}
                    placeholder="Departure is 6:00 AM sharp from the Mlimani City car park, north entrance. Please be there by 5:30 so we can load bags and leave on time."
                    className="min-h-32"
                  />

                  <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[0.875rem] text-ink-soft">
                    <input
                      type="checkbox"
                      checked={pin}
                      onChange={(event) => setPin(event.target.checked)}
                      className="h-4 w-4 accent-clay-500"
                    />
                    Pin to the top of the group
                  </label>

                  <Divider className="my-6" />

                  <Button
                    variant="impact"
                    onClick={postAnnouncement}
                    disabled={busy || !announcement.trim()}
                  >
                    {busy ? 'Posting…' : 'Post announcement'}
                  </Button>
                </>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrganizerTripPage() {
  return (
    <DashboardShell nav={ORGANIZER_NAV} allow={['ORGANIZER']}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <TripManager />
      </Suspense>
    </DashboardShell>
  );
}
