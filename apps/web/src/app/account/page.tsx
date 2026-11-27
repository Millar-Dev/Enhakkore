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
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    api.get<Application[]>('/community/applications').then(setApplications).catch(() => setApplications([]));
    api
      .get<{ items: { read: boolean }[]; unread?: number }>('/me/notifications')
      .then((data) => setUnread(data.unread ?? data.items.filter((item) => !item.read).length))
      .catch(() => undefined);
  }, []);
  const openApplications = (applications ?? []).filter((item) => !['CANCELLED', 'DECLINED', 'COMPLETED'].includes(item.status)).length;

  /** The Account Centre, in groups — counts only where they are real. */
  const groups: { title: string; items: { href: string; label: string; icon: string; body: string; count?: number }[] }[] = [
    {
      title: 'My Enhakkore',
      items: [
        { href: '/account/experiences', label: 'My experiences', icon: '📋', body: 'Registrations, upcoming and past, teams and event plans.' },
        { href: '/account/passes', label: 'Enhakkore Pass', icon: '🎟️', body: 'Entry passes for confirmed events, trips and reservations.' },
        { href: '/account/applications', label: 'My trips', icon: '🧭', body: 'Trip applications, payment steps and status.', count: openApplications },
        { href: '/account/enquiries', label: 'Enquiries & reservations', icon: '✉️', body: 'Hotel enquiries, table requests and replies.' },
        { href: '/account/experiences#communities', label: 'My communities', icon: '👥', body: 'Communities you belong to or asked to join.' },
        { href: '/account/saved', label: 'Saved', icon: '🔖', body: 'Trips, places, events and activities you saved.' },
      ],
    },
    {
      title: 'Messages',
      items: [
        { href: '/account/chats', label: 'Group chats', icon: '💬', body: 'Chats for your events, activities and communities.' },
        { href: '/account/groups', label: 'Trip groups', icon: '🚌', body: 'Chat with the people on your confirmed departures.' },
        { href: '/account/notifications', label: 'Notifications', icon: '🔔', body: 'Updates, invitations and announcements.', count: unread },
      ],
    },
    {
      title: 'Host & organise',
      items: [
        { href: '/experiences/host', label: 'Host & Organise', icon: '🏁', body: 'Apply as an organiser and submit experiences.' },
        { href: '/account/hosting', label: 'Activities you host', icon: '🗂️', body: 'Approve people who asked to join.' },
        { href: '/account/scanner', label: 'Check-in scanner', icon: '📷', body: 'Check people in at the entrance.' },
        { href: '/experiences/plan', label: 'Plan an event with us', icon: '🎉', body: 'Ask the team to organise an event for you.' },
      ],
    },
    {
      title: 'Profile & settings',
      items: [
        { href: '/account/profile', label: 'Profile & privacy', icon: '👤', body: 'Photo, cover, username and who sees what.' },
        { href: '/account/settings', label: 'Notifications & Nearby', icon: '⚙️', body: 'Choose alerts, quiet hours and Nearby.' },
        { href: '/account/settings#security', label: 'Password & security', icon: '🔒', body: 'Change your password.' },
      ],
    },
  ];

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES}>
      {user && (
        <>
        {/* Phones: profile card and a simple menu list. */}
        <div className="-mx-5 -mt-5 md:hidden">
          <div className="bg-[#06152a] px-5 pb-6 pt-2 text-center text-white">
            <span className="inline-block rounded-full p-1 ring-2 ring-clay-400"><Avatar name={user.name} src={user.avatarUrl} size="xl" /></span>
            <p className="mt-2 text-xl font-bold">{user.name}</p>
            {user.username ? <p className="text-sm text-white/70">@{user.username}</p> : <Link href="/account/profile" className="text-sm text-clay-400 underline">Choose a username</Link>}
            <span className="mt-1 inline-block rounded-full bg-[#1f9a55] px-2.5 py-0.5 text-[0.6875rem] font-bold">{user.role === 'ADMIN' || user.role === 'STAFF' ? 'Team' : 'Member'}</span>
            {(user.role === 'ADMIN' || user.role === 'STAFF') && (
              <Link href="/admin" className="mx-auto mt-3 flex h-11 max-w-xs items-center justify-center rounded-full bg-clay-400 text-sm font-bold text-acacia-700">Open the control centre</Link>
            )}
          </div>
          {groups.map((group) => (
            <section key={group.title}>
              <h2 className="bg-sand px-5 pb-2 pt-5 text-xs font-bold uppercase tracking-wider text-ink-muted">{group.title}</h2>
              <ul className="divide-y divide-line bg-white">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="flex min-h-14 items-center gap-3 px-5 text-[0.9375rem] font-medium text-ink hover:bg-sand">
                      <span className="w-6 text-center text-lg" aria-hidden>{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.count ? <span className="min-w-6 rounded-full bg-clay-400 px-2 text-center text-xs font-bold leading-6 text-acacia-700">{item.count}</span> : null}
                      <span className="text-ink-faint" aria-hidden>›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="hidden space-y-8 md:block">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={user.name} src={user.avatarUrl} size="xl" />
            <div>
              <h1 className="font-display text-3xl text-acacia-700">Hello, {user.name.split(' ')[0]}</h1>
              {user.username ? <p className="text-sm font-semibold text-ink-soft">@{user.username}</p> : <Link href="/account/profile" className="text-sm font-semibold text-acacia-700 underline">Choose a username</Link>}
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

          {groups.map((group) => (
            <section key={group.title}>
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-muted">{group.title}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((tile) => (
                  <Link key={tile.href} href={tile.href} className="card-lift flex gap-3 rounded-xl border border-line bg-white p-5">
                    <span className="text-xl" aria-hidden>{tile.icon}</span>
                    <span>
                      <span className="flex items-center gap-2 text-lg font-bold text-acacia-700">{tile.label}{tile.count ? <span className="rounded-full bg-clay-400 px-2 text-xs leading-5 text-acacia-700">{tile.count}</span> : null}</span>
                      <span className="mt-1 block text-sm text-ink-muted">{tile.body}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-xl bg-[color:var(--color-cream)] p-5 text-sm text-ink-soft">
            Looking for something to do? <Link href="/activities" className="font-semibold text-acacia-600 underline">Browse activities</Link>, <Link href="/events" className="font-semibold text-acacia-600 underline">see events</Link> or <Link href="/experiences/host" className="font-semibold text-acacia-600 underline">host your own</Link>.
          </section>
        </div>
        </>
      )}
    </DashboardShell>
  );
}
