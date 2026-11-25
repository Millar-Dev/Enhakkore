'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatMoney } from '@enhakkore/shared';
import { Avatar } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { Panel, StatusPill, btn } from './AdminShell';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function sums(map: Record<string, number> | null | undefined): string {
  const entries = Object.entries(map ?? {}).filter(([, amount]) => amount !== 0);
  if (entries.length === 0) return '—';
  return entries.map(([currency, amount]) => formatMoney({ amount, currency })).join(' · ');
}

export function ActivityParticipants({ activityId }: { activityId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api.get<any[]>(`/cc/activities/${activityId}/participants`).then(setRows).catch(() => setRows([])), [activityId]);
  useEffect(() => {
    void load();
  }, [load]);
  const decide = async (id: string, status: string) => {
    setError(null);
    try {
      await api.post(`/cc/participants/${id}`, { status });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update.');
    }
  };
  return (
    <Panel title={`Participants${rows ? ` (${rows.filter((row) => row.status === 'APPROVED').length} approved)` : ''}`}>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {!rows ? <p className="text-sm text-ink-muted">Loading…</p> : rows.length === 0 ? <p className="text-sm text-ink-muted">No requests to join yet.</p> : (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar name={row.user.name} src={row.user.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">{row.user.name}</p>
                <p className="text-xs text-ink-muted">{row.user.email}{row.user.phone ? ` · ${row.user.phone}` : ''}</p>
                {row.message && <p className="text-xs text-ink-soft">“{row.message}”</p>}
              </div>
              <StatusPill status={row.status} />
              {row.status !== 'APPROVED' && <button className={btn.primary} onClick={() => decide(row.id, 'APPROVED')}>Approve</button>}
              {row.status === 'REQUESTED' && <button className={btn.secondary} onClick={() => decide(row.id, 'WAITLIST')}>Waitlist</button>}
              {!['DECLINED', 'CANCELLED'].includes(row.status) && <button className={btn.secondary} onClick={() => decide(row.id, 'DECLINED')}>Decline</button>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function TripDepartures({ tripValues }: { tripValues: Record<string, any> }) {
  const departures: any[] = tripValues.departures ?? [];
  return (
    <Panel title="Departures — participants, payments & profit">
      {departures.filter((row) => row.id).length === 0 ? (
        <p className="text-sm text-ink-muted">Save the trip with at least one departure date to manage its participants and budget.</p>
      ) : (
        <ul className="grid gap-2">
          {departures.filter((row) => row.id).map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
              <span className="text-sm font-semibold">{row.startDate} → {row.endDate} · {row.seatsBooked ?? 0}/{row.capacity} seats</span>
              <span className="flex gap-2">
                <Link className={btn.secondary} href={`/admin/applications?departureId=${row.id}`}>Applications</Link>
                <Link className={btn.primary} href={`/admin/departures/${row.id}`}>Roster & budget</Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function EventSales({ eventId }: { eventId: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api.get(`/cc/events/${eventId}/summary`).then(setData).catch(() => undefined);
  }, [eventId]);
  return (
    <Panel title="Tickets & money" actions={<Link className={btn.primary} href={`/admin/registrations?eventId=${eventId}`}>Registrations & check-in</Link>}>
      {!data ? <p className="text-sm text-ink-muted">Loading…</p> : (
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-ink-muted">Tickets held</dt><dd className="font-bold">{data.sold}</dd></div>
          <div><dt className="text-xs text-ink-muted">Confirmed</dt><dd className="font-bold">{data.confirmed}</dd></div>
          <div><dt className="text-xs text-ink-muted">Checked in</dt><dd className="font-bold">{data.checkedIn}</dd></div>
          <div><dt className="text-xs text-ink-muted">Ticket revenue (paid)</dt><dd className="font-bold">{sums(data.ticketRevenue)}</dd></div>
          <div><dt className="text-xs text-ink-muted">Outstanding</dt><dd className="font-bold">{sums(data.outstanding)}</dd></div>
          {data.finance && <div><dt className="text-xs text-ink-muted">Net profit (verified)</dt><dd className="font-bold">{sums(data.finance.net)}</dd></div>}
          {data.finance && <div><dt className="text-xs text-ink-muted">Event costs</dt><dd className="font-bold">{sums(data.finance.expenses)}</dd></div>}
        </dl>
      )}
      <p className="mt-3 text-xs text-ink-muted">Record event costs in Finance and link them to this event; they appear here.</p>
    </Panel>
  );
}
