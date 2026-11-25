'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminShell, Panel, btn } from '@/components/admin/AdminShell';
import { sums } from '@/components/admin/ResourceExtras';
import { api } from '@/lib/api';
import { can } from '@/lib/admin';
import { useSession } from '@/lib/session';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The owner's morning view: what needs attention, what is live, and this month's money. */
export default function AdminOverview() {
  const { user } = useSession();
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    if (user) api.get('/cc/overview').then(setData).catch(() => undefined);
  }, [user]);

  const tile = (label: string, value: number | string | undefined, href: string, permission: string, highlight = false) =>
    can(user, permission) ? (
      <Link key={label} href={href} className={`rounded-2xl border p-4 transition hover:border-acacia-600 ${highlight && Number(value) > 0 ? 'border-clay-400 bg-clay-50' : 'border-line bg-white'}`}>
        <p className="text-xs font-semibold text-ink-muted">{label}</p>
        <p className="mt-1 font-display text-3xl text-acacia-700">{value ?? '…'}</p>
      </Link>
    ) : null;

  const c = data?.counts ?? {};
  return (
    <AdminShell title={`Welcome${user ? `, ${user.name.split(' ')[0]}` : ''}`}>
      {data?.alerts?.length > 0 && (
        <div className="mb-5 grid gap-2">
          {data.alerts.map((alert: any) => (
            <Link key={alert.message} href={alert.href} className="rounded-xl border border-[#f2e2c0] bg-[#fdf8ec] p-3 text-sm text-warning">⚠ {alert.message}</Link>
          ))}
        </div>
      )}

      <Panel title="Quick actions" className="mb-5">
        <div className="flex flex-wrap gap-2">
          {can(user, 'activities.create') && <Link className={btn.gold} href="/admin/r/activities/new">+ Activity</Link>}
          {can(user, 'events.create') && <Link className={btn.secondary} href="/admin/r/events/new">+ Event</Link>}
          {can(user, 'trips.create') && <Link className={btn.secondary} href="/admin/r/trips/new">+ Trip</Link>}
          {can(user, 'places.create') && <Link className={btn.secondary} href="/admin/r/places/new">+ Place</Link>}
          {can(user, 'finance.create') && <Link className={btn.secondary} href="/admin/finance?add=INCOME">+ Income</Link>}
          {can(user, 'finance.create') && <Link className={btn.secondary} href="/admin/finance?add=EXPENSE">+ Expense</Link>}
          {can(user, 'media.create') && <Link className={btn.secondary} href="/admin/media">Upload photos</Link>}
        </div>
      </Panel>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-muted">Needs attention</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tile('New enquiries', c.newEnquiries, '/admin/enquiries', 'enquiries.view', true)}
        {tile('Activity submissions to review', c.pendingActivities, '/admin/r/activities?status=PENDING_REVIEW', 'activities.view', true)}
        {tile('Trip applications open', c.openApplications, '/admin/applications', 'bookings.view', true)}
        {tile('Unpaid event registrations', c.unpaidRegistrations, '/admin/registrations?status=PENDING_PAYMENT', 'events.view', true)}
        {tile('Donations to verify', c.unverifiedDonations, '/admin/donations?status=PENDING', 'donations.view', true)}
        {tile('Stories to review', c.pendingStories, '/admin/r/stories', 'stories.view', true)}
        {tile('Reviews to check', c.pendingReviews, '/admin/moderation', 'reviews.view', true)}
        {tile('Open safety reports', c.openReports, '/admin/moderation', 'reviews.view', true)}
      </div>

      <h2 className="mb-3 mt-7 text-sm font-bold uppercase tracking-wider text-ink-muted">On the website</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tile('Registered members', c.members, '/admin/members', 'members.view')}
        {tile('Live activities', c.liveActivities, '/admin/r/activities?status=PUBLISHED', 'activities.view')}
        {tile('All activities', c.activities, '/admin/r/activities', 'activities.view')}
        {tile('Upcoming departures', c.upcomingDepartures, '/admin/r/trips', 'trips.view')}
        {tile('Confirmed trip bookings', c.confirmedBookings, '/admin/applications?status=CONFIRMED', 'bookings.view')}
        {tile('Upcoming events', c.upcomingEvents, '/admin/r/events', 'events.view')}
        {tile('Published places', c.places, '/admin/r/places', 'places.view')}
        {can(user, 'settings.view') && (
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold text-ink-muted">Website visitors</p>
            {data?.visitors?.dashboardUrl ? <a className="mt-2 inline-block text-sm font-semibold text-acacia-600 underline" href={data.visitors.dashboardUrl} target="_blank" rel="noreferrer">Open analytics ↗</a> : <p className="mt-1 text-xs text-ink-muted">Analytics is not connected yet. See the handover notes.</p>}
          </div>
        )}
      </div>

      {(data?.money?.income || data?.money?.donations) && (
        <>
          <h2 className="mb-3 mt-7 text-sm font-bold uppercase tracking-wider text-ink-muted">This month (verified)</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {data.money.income && <Link href="/admin/finance" className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-ink-muted">Income</p><p className="mt-1 text-lg font-bold text-safari-700">{sums(Object.fromEntries(data.money.income.map((row: any) => [row.currency, row.amount])))}</p></Link>}
            {data.money.expenses && <Link href="/admin/finance" className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-ink-muted">Expenses & refunds</p><p className="mt-1 text-lg font-bold text-danger">{sums(Object.fromEntries(data.money.expenses.map((row: any) => [row.currency, row.amount])))}</p></Link>}
            {data.money.donations && <Link href="/admin/donations" className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-ink-muted">Donations (kept separate)</p><p className="mt-1 text-lg font-bold text-acacia-700">{sums(Object.fromEntries(data.money.donations.map((row: any) => [row.currency, row.amount])))}</p></Link>}
          </div>
          <p className="mt-2 text-xs text-ink-muted">Each currency is shown on its own; amounts in different currencies are never added together.</p>
        </>
      )}

      {data?.recent?.length > 0 && (
        <Panel title="Recent changes" className="mt-7">
          <ul className="divide-y divide-line text-sm">
            {data.recent.map((entry: any) => (
              <li key={entry.id} className="py-2.5">
                <p className="text-ink">{entry.summary}</p>
                <p className="text-xs text-ink-muted">{entry.actorName} · {new Date(entry.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </AdminShell>
  );
}
