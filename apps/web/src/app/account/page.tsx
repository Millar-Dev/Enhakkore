'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { APPLICATION_STATUS_LABELS } from '@enhakkore/shared';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { Avatar } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

interface Application {
  reference: string;
  status: string;
  trip: { title: string };
  departure: { startDate: string };
}

/** A member's home: profile at a glance, open applications, and shortcuts. */
export default function AccountHome() {
  const { user } = useSession();
  const [applications, setApplications] = useState<Application[] | null>(null);
  useEffect(() => {
    api.get<Application[]>('/community/applications').then(setApplications).catch(() => setApplications([]));
  }, []);

  const tiles = [
    { href: '/account/applications', title: 'Trip applications', body: 'Follow your applications and see how to pay.' },
    { href: '/account/groups', title: 'Trip groups', body: 'Chat with the people on your confirmed departures.' },
    { href: '/account/hosting', title: 'Activities you host', body: 'Approve people who asked to join.' },
    { href: '/account/saved', title: 'Wishlist', body: 'Trips, places, events and activities you saved.' },
    { href: '/connect/requests', title: 'Connections', body: 'Requests and the people you are connected with.' },
    { href: '/account/profile', title: 'Your profile', body: 'Photo, city and interests other members see.' },
  ];

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES}>
      {user && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={user.name} src={user.avatarUrl} size="xl" />
            <div>
              <h1 className="font-display text-3xl text-acacia-700">Hello, {user.name.split(' ')[0]}</h1>
              <p className="text-sm text-ink-muted">{[user.city, user.country].filter(Boolean).join(', ') || 'Add your city to your profile so people nearby can find you.'}</p>
            </div>
            {(user.role === 'ADMIN' || user.role === 'STAFF') && (
              <Link href="/admin" className="ml-auto inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Open the control centre</Link>
            )}
          </div>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink-muted">Your trip applications</h2>
            {applications === null ? (
              <p className="mt-3 text-sm text-ink-muted">Loading…</p>
            ) : applications.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">None yet. <Link href="/travel" className="font-semibold text-acacia-600 underline">See upcoming trips</Link>.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {applications.slice(0, 4).map((application) => (
                  <li key={application.reference}>
                    <Link href={`/account/applications/${application.reference}`} className="flex items-center justify-between rounded-xl border border-line bg-white p-4 text-sm">
                      <span className="font-semibold">{application.trip.title} · {new Date(application.departure.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</span>
                      <span className="text-xs font-bold text-acacia-700">{APPLICATION_STATUS_LABELS[application.status] ?? application.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tiles.map((tile) => (
              <Link key={tile.href} href={tile.href} className="card-lift rounded-xl border border-line bg-white p-5">
                <p className="font-display text-xl text-acacia-700">{tile.title}</p>
                <p className="mt-1 text-sm text-ink-muted">{tile.body}</p>
              </Link>
            ))}
          </section>

          <section className="rounded-xl bg-[color:var(--color-cream)] p-5 text-sm text-ink-soft">
            Looking for something to do? <Link href="/activities" className="font-semibold text-acacia-600 underline">Browse activities</Link>, <Link href="/events" className="font-semibold text-acacia-600 underline">see events</Link> or <Link href="/activities/host" className="font-semibold text-acacia-600 underline">host your own</Link>.
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
