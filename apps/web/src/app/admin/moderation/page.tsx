'use client';

import Link from 'next/link';
import { AdminShell, Panel, StatusPill, btn } from '@/components/admin/AdminShell';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function ModerationPage() {
  const reviews = useApi<any[]>('/cc/reviews?status=PENDING');
  const reports = useApi<any[]>('/cc/reports?status=OPEN');
  return (
    <AdminShell title="Reviews & reports" permission="reviews.view">
      <div className="grid gap-5">
        <Panel title="Safety & content reports">
          {!reports.data ? <p className="text-sm text-ink-muted">Loading…</p> : reports.data.length === 0 ? <p className="text-sm text-ink-muted">No open reports.</p> : (
            <ul className="divide-y divide-line text-sm">
              {reports.data.map((row) => (
                <li key={row.id} className="grid gap-2 py-3">
                  <p className="font-semibold">{row.reason} <span className="text-xs font-normal text-ink-muted">· {row.targetType.toLowerCase()} · reported by {row.reporter?.name ?? 'a member'} · {new Date(row.createdAt).toLocaleDateString('en-GB')}</span></p>
                  {row.details && <p className="text-ink-soft">{row.details}</p>}
                  {row.targetUser && <p className="text-xs">About: <Link className="underline" href={`/admin/members?id=${row.targetUser.id}`}>{row.targetUser.name}</Link> ({row.targetUser.status})</p>}
                  <div className="flex flex-wrap gap-2">
                    {['REVIEWING', 'RESOLVED', 'DISMISSED'].map((status) => <button key={status} className={btn.secondary} onClick={async () => { const resolution = status === 'REVIEWING' ? undefined : window.prompt('What was done? (kept for the record)') ?? undefined; await api.post(`/cc/reports/${row.id}`, { status, resolution }); await reports.reload(); }}>{status.toLowerCase()}</button>)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Place reviews waiting">
          {!reviews.data ? <p className="text-sm text-ink-muted">Loading…</p> : reviews.data.length === 0 ? <p className="text-sm text-ink-muted">Nothing to check.</p> : (
            <ul className="divide-y divide-line text-sm">
              {reviews.data.map((row) => (
                <li key={row.id} className="grid gap-2 py-3">
                  <p className="font-semibold">{'★'.repeat(row.rating)} · {row.place.name} <span className="text-xs font-normal text-ink-muted">by {row.user.name}</span> <StatusPill status={row.status} /></p>
                  <p className="text-ink-soft">{row.body}</p>
                  <div className="flex gap-2">
                    <button className={btn.green} onClick={async () => { await api.post(`/cc/reviews/${row.id}`, { status: 'PUBLISHED' }); await reviews.reload(); }}>Publish</button>
                    <button className={btn.secondary} onClick={async () => { await api.post(`/cc/reviews/${row.id}`, { status: 'HIDDEN' }); await reviews.reload(); }}>Hide</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}
