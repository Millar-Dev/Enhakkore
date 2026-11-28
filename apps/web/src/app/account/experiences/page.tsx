'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ENQUIRY_STATUS_LABELS, formatInZone } from '@enhakkore/shared';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { api } from '@/lib/api';

interface Item {
  kind: string;
  title: string;
  href: string;
  startsAt: string | null;
  status: string;
  reference?: string;
}

interface Data {
  upcoming: Item[];
  past: Item[];
  teams: { teamName: string | null; tournament: string; href: string; captain: boolean; inviteCode: string | null; members: string[] }[];
  communities: { name: string; href: string; role: string }[];
  eventPlans: { reference: string; status: string; createdAt: string; message: string }[];
  published: { title: string; href: string; status: string; startsAt: string | null }[];
  savedCount: number;
}

function List({ items, empty }: { items: Item[]; empty: React.ReactNode }) {
  if (!items.length) return <p className="mt-3 text-sm text-ink-soft">{empty}</p>;
  return (
    <ul className="mt-3 grid gap-2">
      {items.map((item, index) => (
        <li key={`${item.href}-${index}`}>
          <Link href={item.href} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-4 text-sm">
            <span>
              <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-clay-600">{item.kind}</span>
              <span className="font-semibold text-ink">{item.title}</span>
              {item.startsAt && <span className="block text-xs text-ink-muted">{formatInZone(item.startsAt, 'Africa/Dar_es_Salaam', 'datetime')}</span>}
            </span>
            <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-bold text-ink-muted">{item.status.replace(/_/g, ' ').toLowerCase()}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** My Experiences: everything a member has signed up for, joined or published. */
export default function MyExperiences() {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    api.get<Data>('/community/my-experiences').then(setData).catch(() => undefined);
  }, []);
  const heading = 'text-sm font-bold uppercase tracking-wider text-ink-muted';
  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES}>
      <h1 className="font-display text-3xl text-acacia-700">My experiences</h1>
      {!data ? (
        <p className="mt-4 text-ink-muted">Loading…</p>
      ) : (
        <div className="mt-6 space-y-9">
          <section id="registrations" className="scroll-mt-24">
            <h2 className={heading}>Upcoming</h2>
            <List items={data.upcoming} empty={<>Nothing booked yet. <Link href="/experiences" className="font-semibold text-acacia-600 underline">Find something to do</Link>.</>} />
          </section>
          <section id="teams" className="scroll-mt-24">
            <h2 className={heading}>Teams & squads</h2>
            {data.teams.length ? (
              <ul className="mt-3 grid gap-2">
                {data.teams.map((team, index) => (
                  <li key={index} className="rounded-xl border border-line bg-white p-4 text-sm">
                    <Link href={team.href} className="font-semibold text-acacia-700">{team.teamName ?? 'Team'} · {team.tournament}</Link>
                    <p className="text-xs text-ink-muted">{team.captain ? 'You are the captain' : 'Member'}{team.members.length ? ` · ${team.members.join(', ')}` : ''}</p>
                    {team.inviteCode && <p className="mt-1 text-xs">Team code: <strong className="font-mono">{team.inviteCode}</strong></p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">No teams. <Link href="/experiences/gaming" className="font-semibold text-acacia-600 underline">See gaming tournaments</Link>.</p>
            )}
          </section>
          <section id="communities" className="scroll-mt-24">
            <h2 className={heading}>My communities</h2>
            {data.communities.length ? (
              <div className="mt-3 flex flex-wrap gap-2">{data.communities.map((community) => <Link key={community.href} href={community.href} className="chip">{community.name}</Link>)}</div>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">None yet. <Link href="/experiences/communities" className="font-semibold text-acacia-600 underline">Find a community</Link>.</p>
            )}
          </section>
          <section id="plans" className="scroll-mt-24">
            <h2 className={heading}>My event plans</h2>
            {data.eventPlans.length ? (
              <ul className="mt-3 grid gap-2">
                {data.eventPlans.map((plan) => (
                  <li key={plan.reference} className="flex items-center justify-between rounded-xl border border-line bg-white p-4 text-sm">
                    <span><strong>{plan.reference}</strong> <span className="text-ink-muted">· {new Date(plan.createdAt).toLocaleDateString('en-GB')}</span></span>
                    <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-bold text-ink-muted">{ENQUIRY_STATUS_LABELS[plan.status] ?? plan.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">None. <Link href="/experiences/plan" className="font-semibold text-acacia-600 underline">Plan an event</Link>.</p>
            )}
          </section>
          <section id="published" className="scroll-mt-24">
            <h2 className={heading}>My published activities</h2>
            {data.published.length ? (
              <ul className="mt-3 grid gap-2">
                {data.published.map((item) => (
                  <li key={item.href} className="flex items-center justify-between rounded-xl border border-line bg-white p-4 text-sm">
                    {['PUBLISHED', 'FULL', 'COMPLETED'].includes(item.status) ? <Link href={item.href} className="font-semibold text-acacia-700">{item.title}</Link> : <span className="font-semibold">{item.title}</span>}
                    <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-bold text-ink-muted">{item.status.replace(/_/g, ' ').toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">None. <Link href="/experiences/publish" className="font-semibold text-acacia-600 underline">Publish an activity</Link>.</p>
            )}
          </section>
          <section id="past" className="scroll-mt-24">
            <h2 className={heading}>Past experiences</h2>
            <List items={data.past} empty="Nothing yet." />
          </section>
          <p className="text-sm text-ink-muted"><Link href="/account/saved" className="font-semibold text-acacia-600 underline">Saved items ({data.savedCount})</Link> · <Link href="/account/notifications" className="font-semibold text-acacia-600 underline">Notifications</Link> · <Link href="/account/profile" className="font-semibold text-acacia-600 underline">My profile</Link></p>
        </div>
      )}
    </DashboardShell>
  );
}
