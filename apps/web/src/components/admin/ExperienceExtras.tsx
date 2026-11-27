'use client';

import { useCallback, useEffect, useState } from 'react';
import { ENTRY_STATUSES, SESSION_STATUSES, formatInZone, utcToLocalInput } from '@enhakkore/shared';
import { ApiError, api } from '@/lib/api';
import { Panel, StatusPill, btn } from './AdminShell';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The dated sessions of a recurring activity, each with its own list and attendance. */
export function ActivitySessions({ activityId }: { activityId: string }) {
  const [data, setData] = useState<{ timezone: string; items: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => api.get<typeof data>(`/cc/activities/${activityId}/sessions`).then(setData).catch(() => setData({ timezone: 'Africa/Dar_es_Salaam', items: [] })), [activityId]);
  useEffect(() => {
    void load();
  }, [load]);
  const run = async (work: () => Promise<unknown>) => {
    setError(null);
    try {
      await work();
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? Object.values(caught.fields)[0] ?? caught.message : 'Could not save.');
    }
  };
  return (
    <Panel title="Sessions (recurring activity)">
      <p className="mb-3 text-xs text-ink-muted">Each session has its own date, meeting point, route, capacity and registration list. Times are in {data?.timezone ?? 'local time'}. Changing or cancelling a session tells everyone registered.</p>
      <form
        className="grid gap-2 rounded-xl bg-[#faf8f3] p-3 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const get = (name: string) => String(form.get(name) ?? '').trim();
          void run(() =>
            api.post(`/cc/activities/${activityId}/sessions`, {
              startsAt: get('startsAt'),
              meetingPoint: get('meetingPoint'),
              route: get('route'),
              capacity: get('capacity') ? Number(get('capacity')) : null,
              repeatWeeks: Number(get('repeatWeeks') || 1),
            }),
          );
          event.currentTarget.reset();
        }}
      >
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">First session<input name="startsAt" type="datetime-local" required className="field" /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Meeting point<input name="meetingPoint" className="field" placeholder="Leave empty to use the activity’s" /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Route<input name="route" className="field" /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Capacity<input name="capacity" type="number" min={1} className="field" /></label>
        <label className="grid gap-1 text-xs font-semibold text-ink-muted">Repeat weekly for<select name="repeatWeeks" className="field" defaultValue="1">{[1, 2, 4, 8, 12].map((n) => <option key={n} value={n}>{n === 1 ? 'Just this one' : `${n} weeks`}</option>)}</select></label>
        <button className={`${btn.primary} self-end`}>Add session(s)</button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {!data ? <p className="mt-3 text-sm text-ink-muted">Loading…</p> : data.items.length === 0 ? <p className="mt-3 text-sm text-ink-muted">No sessions yet.</p> : (
        <ul className="mt-3 divide-y divide-line">
          {data.items.map((session) => (
            <li key={session.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <button className="font-semibold text-acacia-700" onClick={() => setOpen(open === session.id ? null : session.id)}>{formatInZone(session.startsAt, data.timezone, 'full')}</button>
                <StatusPill status={session.status} />
                <span className="text-xs text-ink-muted">{session.registrations.filter((row: any) => row.status === 'REGISTERED').length} registered{session.capacity ? ` / ${session.capacity}` : ''}</span>
              </div>
              {open === session.id && (
                <div className="mt-3 grid gap-3 rounded-xl bg-[#faf8f3] p-3 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold text-ink-muted">Date & time<input type="datetime-local" className="field" defaultValue={utcToLocalInput(session.startsAt, data.timezone)} onBlur={(event) => event.target.value && void run(() => api.patch(`/cc/sessions/${session.id}`, { startsAt: event.target.value }))} /></label>
                    <label className="grid gap-1 text-xs font-semibold text-ink-muted">Meeting point<input className="field" defaultValue={session.meetingPoint ?? ''} onBlur={(event) => event.target.value !== (session.meetingPoint ?? '') && void run(() => api.patch(`/cc/sessions/${session.id}`, { meetingPoint: event.target.value }))} /></label>
                    <label className="grid gap-1 text-xs font-semibold text-ink-muted">Route<input className="field" defaultValue={session.route ?? ''} onBlur={(event) => event.target.value !== (session.route ?? '') && void run(() => api.patch(`/cc/sessions/${session.id}`, { route: event.target.value }))} /></label>
                    <label className="grid gap-1 text-xs font-semibold text-ink-muted">Notice to participants<input className="field" defaultValue={session.notice ?? ''} onBlur={(event) => event.target.value !== (session.notice ?? '') && void run(() => api.patch(`/cc/sessions/${session.id}`, { notice: event.target.value }))} /></label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SESSION_STATUSES.map((value) => <button key={value} type="button" className={`chip ${session.status === value ? 'chip-active' : ''}`} onClick={() => void run(() => api.patch(`/cc/sessions/${session.id}`, { status: value }))}>{value.toLowerCase()}</button>)}
                    <button type="button" className="chip text-danger" onClick={() => window.confirm('Delete this session?') && void run(() => api.delete(`/cc/sessions/${session.id}`))}>Delete</button>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Registration list & attendance</p>
                    {session.registrations.length === 0 ? <p className="mt-1 text-xs text-ink-muted">Nobody registered yet.</p> : (
                      <ul className="mt-2 grid gap-1">
                        {session.registrations.map((row: any) => (
                          <li key={row.id} className="flex items-center justify-between gap-2">
                            <span>{row.user.name}{row.user.phone ? ` · ${row.user.phone}` : ''} {row.status === 'CANCELLED' && <em className="text-xs text-ink-muted">(cancelled)</em>}</span>
                            <label className="flex items-center gap-1 text-xs"><input type="checkbox" defaultChecked={row.attended} onChange={(event) => void api.patch(`/cc/session-registrations/${row.id}`, { attended: event.target.checked })} /> attended</label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Registrations for a tournament: players, teams, game IDs (team only), status. */
export function TournamentEntries({ tournamentId }: { tournamentId: string }) {
  const [data, setData] = useState<{ items: any[]; tournament: any } | null>(null);
  const load = useCallback(() => api.get<typeof data>(`/cc/tournaments/${tournamentId}/entries`).then(setData).catch(() => undefined), [tournamentId]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <Panel title={`Registrations${data ? ` (${data.items.filter((row) => ['REGISTERED', 'CONFIRMED'].includes(row.status)).length}${data.tournament.slots ? ` / ${data.tournament.slots}` : ''})` : ''}`}>
      {!data ? <p className="text-sm text-ink-muted">Loading…</p> : data.items.length === 0 ? <p className="text-sm text-ink-muted">No registrations yet.</p> : (
        <ul className="divide-y divide-line">
          {data.items.map((entry) => (
            <li key={entry.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{entry.teamName ?? entry.playerName}</span>
                <StatusPill status={entry.status} />
                <span className="text-xs text-ink-muted">{entry.reference}</span>
              </div>
              <p className="text-xs text-ink-muted">Captain: {entry.captain.name} · {entry.playerName} · UID {entry.gameUid}{entry.server ? ` · ${entry.server}` : ''}{entry.captain.phone ? ` · ${entry.captain.phone}` : ''}</p>
              {entry.members.length > 0 && <p className="text-xs text-ink-muted">Squad: {entry.members.map((member: any) => `${member.playerName} (UID ${member.gameUid})`).join(', ')}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ENTRY_STATUSES.map((value) => <button key={value} className={`chip ${entry.status === value ? 'chip-active' : ''}`} onClick={async () => { await api.patch(`/cc/entries/${entry.id}`, { status: value }); await load(); }}>{value.toLowerCase()}</button>)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Community members and announcements. */
export function CommunityPanel({ communityId }: { communityId: string }) {
  const [data, setData] = useState<{ members: any[]; announcements: any[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(() => api.get<typeof data>(`/cc/communities/${communityId}/members`).then(setData).catch(() => undefined), [communityId]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <Panel title={`Members & announcements${data ? ` (${data.members.filter((m) => !m.status || m.status === 'ACTIVE').length} members${data.members.some((m) => m.status === 'PENDING') ? `, ${data.members.filter((m) => m.status === 'PENDING').length} waiting` : ''})` : ''}`}>
      <form
        className="grid gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const values = new FormData(form);
          try {
            await api.post(`/cc/communities/${communityId}/announcements`, { title: String(values.get('title')), body: String(values.get('body')) });
            setMessage('Announcement posted — every member gets a notification.');
            form.reset();
            await load();
          } catch (caught) {
            setMessage(caught instanceof ApiError ? caught.message : 'Could not post.');
          }
        }}
      >
        <input name="title" required minLength={3} className="field" placeholder="Announcement title" />
        <textarea name="body" required minLength={3} className="field" placeholder="Message to all members" />
        <button className={btn.primary}>Post announcement</button>
        {message && <p className="text-xs text-safari-700">{message}</p>}
      </form>
      {data && data.announcements.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">{data.announcements.map((item) => <li key={item.id}><strong>{item.title}</strong> <span className="text-xs text-ink-muted">· {new Date(item.createdAt).toLocaleDateString('en-GB')}</span></li>)}</ul>
      )}
      {data && data.members.length > 0 && (
        <ul className="mt-4 divide-y divide-line text-sm">
          {data.members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {member.user.name}{member.user.username ? ` · @${member.user.username}` : ''} <span className="text-xs text-ink-muted">{member.user.email}{member.role === 'MODERATOR' ? ' · moderator' : ''}</span>
                {member.status && member.status !== 'ACTIVE' && <span className={`ml-2 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${member.status === 'PENDING' ? 'bg-[#fff1c9] text-[#7a5a14]' : 'bg-sand text-ink-muted'}`}>{member.status === 'PENDING' ? 'Request' : 'Declined'}</span>}
                {member.message && <span className="block text-xs text-ink-muted">“{member.message}”</span>}
              </span>
              <span className="flex gap-2 text-xs">
                {member.status === 'PENDING' && (
                  <>
                    <button className="font-semibold text-safari-700" onClick={async () => { await api.post(`/cc/communities/${communityId}/members/${member.user.id}/role`, { role: 'APPROVE' }); await load(); }}>Approve</button>
                    <button className="font-semibold text-danger" onClick={async () => { await api.post(`/cc/communities/${communityId}/members/${member.user.id}/role`, { role: 'DECLINE' }); await load(); }}>Decline</button>
                  </>
                )}
                <button className="font-semibold text-acacia-600" onClick={async () => { await api.post(`/cc/communities/${communityId}/members/${member.user.id}/role`, { role: member.role === 'MODERATOR' ? 'MEMBER' : 'MODERATOR' }); await load(); }}>{member.role === 'MODERATOR' ? 'Make member' : 'Make moderator'}</button>
                <button className="font-semibold text-danger" onClick={async () => { if (window.confirm('Remove from the community?')) { await api.post(`/cc/communities/${communityId}/members/${member.user.id}/role`, { role: 'REMOVE' }); await load(); } }}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
