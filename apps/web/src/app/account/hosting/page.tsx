'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatInZone } from '@enhakkore/shared';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { Avatar } from '@/components/ui';
import { ApiError, api } from '@/lib/api';

interface Hosted {
  id: string;
  slug: string;
  title: string;
  status: string;
  startsAt: string | null;
  timezone: string;
  capacity: number | null;
  spotsTaken: number;
  participants: { id: string; status: string; message: string | null; user: { id: string; name: string; avatarUrl: string | null; city: string | null; country: string | null } }[];
}

/** Organisers manage who joins their activities and send updates to everyone going. */
export default function HostingPage() {
  const [rows, setRows] = useState<Hosted[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(() => api.get<Hosted[]>('/community/hosting').then(setRows).catch(() => setRows([])), []);
  useEffect(() => {
    void load();
  }, [load]);
  const decide = async (id: string, status: string) => {
    try {
      await api.post(`/community/hosting/participants/${id}`, { status });
      await load();
    } catch (caught) {
      setNotice(caught instanceof ApiError ? caught.message : 'Could not update.');
    }
  };

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title="Activities you host">
      {notice && <p className="mb-4 rounded-lg bg-[#fdf4e3] p-3 text-sm text-warning">{notice}</p>}
      {rows === null ? <p className="text-ink-muted">Loading…</p> : rows.length === 0 ? (
        <div className="rounded-xl bg-[color:var(--color-cream)] p-8 text-center">
          <p className="font-display text-2xl text-acacia-700">You are not hosting anything yet</p>
          <p className="mt-2 text-sm text-ink-soft">When the Enhakkore team publishes an activity you organise and links it to your account, you can manage requests here.</p>
          <Link href="/activities/host" className="mt-4 inline-flex h-11 items-center rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700">Host an activity</Link>
        </div>
      ) : (
        <div className="grid gap-5">
          {rows.map((activity) => (
            <section key={activity.id} className="rounded-xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/activities/${activity.slug}`} className="font-display text-2xl text-acacia-700">{activity.title}</Link>
                <span className="text-sm text-ink-muted">{activity.startsAt ? formatInZone(activity.startsAt, activity.timezone) : ''} · {activity.spotsTaken}{activity.capacity ? ` / ${activity.capacity}` : ''} going</span>
              </div>
              {activity.participants.length === 0 ? <p className="mt-3 text-sm text-ink-muted">No requests yet.</p> : (
                <ul className="mt-4 divide-y divide-line">
                  {activity.participants.map((participant) => (
                    <li key={participant.id} className="flex flex-wrap items-center gap-3 py-3">
                      <Avatar name={participant.user.name} src={participant.user.avatarUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{participant.user.name} <span className="text-xs font-normal text-ink-muted">{[participant.user.city, participant.user.country].filter(Boolean).join(', ')}</span></p>
                        {participant.message && <p className="text-sm text-ink-soft">“{participant.message}”</p>}
                      </div>
                      <span className="text-xs font-bold text-clay-600">{participant.status}</span>
                      {participant.status !== 'APPROVED' && participant.status !== 'CANCELLED' && <button onClick={() => decide(participant.id, 'APPROVED')} className="h-9 rounded-full bg-acacia-600 px-3 text-xs font-bold text-white">Approve</button>}
                      {participant.status === 'REQUESTED' && <button onClick={() => decide(participant.id, 'WAITLIST')} className="h-9 rounded-full border border-line-strong px-3 text-xs">Waitlist</button>}
                      {participant.status !== 'DECLINED' && participant.status !== 'CANCELLED' && <button onClick={() => decide(participant.id, 'DECLINED')} className="h-9 rounded-full border border-line-strong px-3 text-xs">Decline</button>}
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="mt-4 flex gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const input = event.currentTarget.elements.namedItem('message') as HTMLInputElement;
                  const result = await api.post<{ sent: number }>(`/community/hosting/${activity.id}/update`, { message: input.value });
                  setNotice(`Update sent to ${result.sent} participant${result.sent === 1 ? '' : 's'}.`);
                  input.value = '';
                }}
              >
                <input name="message" required minLength={3} maxLength={600} placeholder="Send an update to everyone approved…" className="field" />
                <button className="h-11 shrink-0 rounded-[var(--radius-field)] bg-acacia-600 px-4 text-sm font-bold text-white">Send</button>
              </form>
            </section>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
