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
  const { user, signOut } = useSession();
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  useEffect(() => {
    api.get<Application[]>('/community/applications').then(setApplications).catch(() => setApplications([]));
    api
      .get<{ items: { read: boolean }[]; unread?: number }>('/me/notifications')
      .then((data) => setUnread(data.unread ?? data.items.filter((item) => !item.read).length))
      .catch(() => undefined);
    api.get<{ counts: { unread: number } }>('/messages').then((data) => setUnreadMessages(data.counts.unread)).catch(() => undefined);
  }, []);
  const openApplications = (applications ?? []).filter((item) => !['CANCELLED', 'DECLINED', 'COMPLETED'].includes(item.status)).length;

  /** The Account Centre, in groups — counts only where they are real. */
  const groups: { title: string; items: { href: string; label: string; icon: string; body: string; count?: number; badge?: string }[] }[] = [
    {
      title: 'Bookings & trips',
      items: [
        { href: '/account/enquiries', label: 'My reservations', icon: '🛎️', body: 'Hotel, restaurant and venue requests, with status and reference.' },
        { href: '/account/enquiries#other', label: 'My booking requests', icon: '✉️', body: 'Trip requests, event plans and other enquiries, with our replies.' },
        { href: '/account/applications', label: 'My trips', icon: '🧭', body: 'Upcoming, active and completed trips, with status and itinerary.', count: openApplications },
        { href: '/account/applications?view=payments', label: 'My trip payments', icon: '💳', body: 'Deposits, receipts, balances and payment status.' },
        { href: '/account/passes', label: 'My passes', icon: '🎟️', body: 'Enhakkore Pass for confirmed events, trips and reservations.' },
        { href: '/account/saved', label: 'Wishlist', icon: '❤️', body: 'Saved trips, places, events and activities.' },
      ],
    },
    {
      title: 'Experiences & groups',
      items: [
        { href: '/account/experiences', label: 'My experiences', icon: '📋', body: 'Upcoming and past experiences.' },
        { href: '/account/experiences#registrations', label: 'My registrations', icon: '📝', body: 'Activities, sessions, events and tournaments you registered for.' },
        { href: '/account/experiences#communities', label: 'My communities', icon: '👥', body: 'Communities you belong to.' },
        { href: '/account/study-groups', label: 'My study groups', icon: '📚', body: 'Your study group conversations, Discover and create.' },
        { href: '/account/gaming', label: 'Gaming Hub', icon: '🎮', body: 'My Tournaments and Game Friends.', badge: 'New' },
        { href: '/account/gaming?tab=friends&view=squads', label: 'My teams', icon: '🛡️', body: 'Squads, guilds and teams.' },
        { href: '/account/experiences#plans', label: 'My event plans', icon: '🎉', body: 'Events you asked Enhakkore to plan.' },
      ],
    },
    {
      title: 'Messages & conversations',
      items: [
        { href: '/account/messages', label: 'My messages', icon: '💬', body: 'Private one-to-one conversations.', count: unreadMessages },
        { href: '/account/chats', label: 'My group chats', icon: '🗨️', body: 'Communities, study groups, teams and tournaments.' },
        { href: '/account/groups', label: 'Trip group chats', icon: '🚌', body: 'Chat with the people on your confirmed trips.' },
        { href: '/account/notifications', label: 'My notifications', icon: '🔔', body: 'Updates, requests, activity and notification settings.', count: unread },
      ],
    },
    {
      title: 'Host & organise',
      items: [
        { href: '/experiences/host', label: 'Host & organise', icon: '🏁', body: 'Apply as an organiser and submit experiences.' },
        { href: '/account/hosting', label: 'Activities you host', icon: '🗂️', body: 'Approve people who asked to join.' },
        { href: '/account/scanner', label: 'Check-in scanner', icon: '📷', body: 'Check people in at the entrance.' },
      ],
    },
    {
      title: 'Profile & settings',
      items: [
        { href: user?.username ? `/u/${user.username}` : '/account/profile', label: 'Profile', icon: '🪪', body: 'Your public profile card.' },
        { href: '/account/profile', label: 'Edit profile', icon: '✏️', body: 'Photo, cover, introduction and interests.' },
        { href: '/account/profile#username', label: 'Username', icon: '@', body: 'Your public handle.' },
        { href: '/account/profile#privacy', label: 'Privacy settings', icon: '🛡️', body: 'Who sees each part of your profile.' },
        { href: '/account/settings', label: 'Settings', icon: '⚙️', body: 'Password, devices and preferences.' },
        { href: '/faq', label: 'Help & support', icon: '❓', body: 'Questions, contact and WhatsApp support.' },
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
                  <li key={item.label}>
                    <Link href={item.href} className="flex min-h-14 items-center gap-3 px-5 text-[0.9375rem] font-medium text-ink hover:bg-sand">
                      <span className="w-6 text-center text-lg" aria-hidden>{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge ? <span className="rounded-full bg-clay-400 px-2 text-[0.6875rem] font-bold leading-5 text-acacia-700">{item.badge}</span> : null}
                      {item.count ? <span className="min-w-6 rounded-full bg-clay-400 px-2 text-center text-xs font-bold leading-6 text-acacia-700">{item.count}</span> : null}
                      <span className="text-ink-faint" aria-hidden>›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <button type="button" onClick={signOut} className="flex min-h-14 w-full items-center gap-3 bg-white px-5 text-left text-[0.9375rem] font-semibold text-danger">
            <span className="w-6 text-center text-lg" aria-hidden>↪</span> Sign out
          </button>
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
                  <Link key={tile.label} href={tile.href} className="card-lift flex gap-3 rounded-xl border border-line bg-white p-5">
                    <span className="text-xl" aria-hidden>{tile.icon}</span>
                    <span>
                      <span className="flex items-center gap-2 text-lg font-bold text-acacia-700">{tile.label}{tile.badge ? <span className="rounded-full bg-clay-400 px-2 text-xs leading-5 text-acacia-700">{tile.badge}</span> : null}{tile.count ? <span className="rounded-full bg-clay-400 px-2 text-xs leading-5 text-acacia-700">{tile.count}</span> : null}</span>
                      <span className="mt-1 block text-sm text-ink-muted">{tile.body}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          <button type="button" onClick={signOut} className="inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-semibold text-danger">Sign out</button>
          <section className="rounded-xl bg-[color:var(--color-cream)] p-5 text-sm text-ink-soft">
            Looking for something to do? <Link href="/activities" className="font-semibold text-acacia-600 underline">Browse activities</Link>, <Link href="/events" className="font-semibold text-acacia-600 underline">see events</Link> or <Link href="/experiences/host" className="font-semibold text-acacia-600 underline">host your own</Link>.
          </section>
        </div>
        </>
      )}
    </DashboardShell>
  );
}
