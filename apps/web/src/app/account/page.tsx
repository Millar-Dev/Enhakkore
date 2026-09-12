'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { BookingDto, Paginated, TravellerStats } from '@enhakkore/shared';
import { DashboardShell, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import {
  Alert,
  Avatar,
  Button,
  ButtonLink,
  Card,
  Divider,
  Icon,
  Skeleton,
  StatTile,
} from '@/components/ui';
import { Input, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api';
import { dateRange, formatDate, price } from '@/lib/format';
import { useSession } from '@/lib/session';

/**
 * The traveller profile.
 *
 * Built as a travel identity rather than a social profile: where you have been,
 * what is next, and what your contributions have gone to. No follower counts,
 * no feed.
 */
export default function ProfilePage() {
  const { user, updateUser } = useSession();
  const [stats, setStats] = useState<TravellerStats | null>(null);
  const [upcoming, setUpcoming] = useState<BookingDto[]>([]);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', country: '', bio: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name,
      city: user.city ?? '',
      country: user.country ?? '',
      bio: user.bio ?? '',
      phone: '',
    });
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statsResult, bookingsResult] = await Promise.all([
          api.get<TravellerStats>('/me/stats'),
          api.get<Paginated<BookingDto>>('/bookings?scope=upcoming&pageSize=3'),
        ]);
        if (cancelled) return;
        setStats(statsResult);
        setUpcoming(bookingsResult.items);
      } catch {
        /* the page still renders with the account details it already has */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.patch<typeof user>('/me', {
        name: form.name,
        city: form.city,
        country: form.country,
        bio: form.bio,
        phone: form.phone || undefined,
      });
      if (updated) updateUser(updated);
      setMessage('Your profile is updated.');
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'We could not save your changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={['TRAVELER', 'ORGANIZER', 'ADMIN']}>
      {!user ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="mx-auto max-w-4xl">
          {/* Identity */}
          <Card className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex items-center gap-5">
                <Avatar name={user.name} src={user.avatarUrl} size="xl" />
                <div>
                  <h1 className="text-h2">{user.name}</h1>
                  <p className="mt-1.5 text-[0.9375rem] text-ink-muted">
                    {[user.city, user.country].filter(Boolean).join(', ') || 'Add where you are based'}
                  </p>
                  <p className="mt-1 text-[0.8125rem] text-ink-faint">
                    On Enhakkore since {formatDate(user.createdAt, 'long')}
                  </p>
                </div>
              </div>
              {!editing && (
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  Edit profile
                </Button>
              )}
            </div>

            {user.bio && !editing && (
              <p className="mt-6 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-soft">{user.bio}</p>
            )}

            {message && (
              <Alert tone="success" className="mt-6">
                {message}
              </Alert>
            )}

            {editing && (
              <form onSubmit={save} className="mt-8 space-y-4">
                {error && <Alert tone="danger">{error}</Alert>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Name"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    required
                  />
                  <Input
                    label="Phone"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="+255 7XX XXX XXX"
                    hint="Shared with your organizer only for trips you book."
                  />
                  <Input
                    label="City"
                    value={form.city}
                    onChange={(event) => setForm({ ...form, city: event.target.value })}
                  />
                  <Input
                    label="Country"
                    value={form.country}
                    onChange={(event) => setForm({ ...form, country: event.target.value })}
                  />
                </div>
                <Textarea
                  label="About you"
                  value={form.bio}
                  onChange={(event) => setForm({ ...form, bio: event.target.value })}
                  placeholder="A line or two your fellow travellers will see in trip groups."
                  maxLength={600}
                />
                <div className="flex gap-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </Card>

          {/* Travel record */}
          <h2 className="mt-10 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
            Your travel record
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Trips completed" value={stats?.tripsCompleted ?? '—'} />
            <StatTile label="Destinations" value={stats?.destinationsVisited ?? '—'} />
            <StatTile label="Countries" value={stats?.countriesVisited ?? '—'} />
            <StatTile
              label="Impact contributed"
              value={stats ? price(stats.impactContributed, true) : '—'}
              tone="impact"
              hint={stats ? `across ${stats.projectsSupported} projects` : undefined}
            />
          </div>

          {/* Next up */}
          <div className="mt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
                Coming up
              </h2>
              <Link href="/account/trips" className="text-[0.8125rem] font-semibold text-acacia-700 hover:underline">
                All trips
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <Card className="mt-4 p-8 text-center">
                <p className="text-[0.9375rem] text-ink-muted">Nothing booked yet.</p>
                <ButtonLink href="/trips" className="mt-5" size="sm">
                  Find a trip
                </ButtonLink>
              </Card>
            ) : (
              <div className="mt-4 space-y-3">
                {upcoming.map((booking) => (
                  <Card key={booking.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <Link
                        href={`/account/bookings/${booking.reference}`}
                        className="text-[0.9375rem] font-bold tracking-tight hover:text-acacia-700"
                      >
                        {booking.trip.title}
                      </Link>
                      <p className="mt-1 text-[0.8125rem] text-ink-muted">
                        {dateRange(booking.departure.startDate, booking.departure.endDate)} ·{' '}
                        {booking.trip.destination.name}
                      </p>
                    </div>
                    {booking.conversationId && (
                      <ButtonLink href={`/account/groups/${booking.conversationId}`} size="sm" variant="secondary">
                        <Icon.chat size={14} />
                        Group
                      </ButtonLink>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Divider className="my-10" />

          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/account/impact" variant="secondary" size="sm">
              Your impact history
            </ButtonLink>
            <ButtonLink href="/account/saved" variant="secondary" size="sm">
              Saved trips
            </ButtonLink>
            <ButtonLink href="/private-trips" variant="secondary" size="sm">
              Request a custom trip
            </ButtonLink>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
