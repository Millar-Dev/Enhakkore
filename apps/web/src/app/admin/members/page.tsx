'use client';

import { useEffect, useState } from 'react';
import { formatMoney } from '@enhakkore/shared';
import { AdminShell, Panel, StatusPill, btn } from '@/components/admin/AdminShell';
import { Avatar } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { can } from '@/lib/admin';
import { useSession } from '@/lib/session';
import { useApi, useQueryParam } from '@/lib/useApi';
import { downloadCsv } from '@/lib/download';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Customers and members. Opening a full record is logged; passwords and tokens are never shown. */
export default function MembersPage() {
  const { user } = useSession();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const list = useApi<{ items: any[]; total: number }>(`/cc/people/members?pageSize=50${q ? `&q=${encodeURIComponent(q)}` : ''}${status ? `&status=${status}` : ''}`);
  const linked = useQueryParam('id');
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => { if (linked) setOpenId(linked); }, [linked]);
  const detail = useApi<any>(openId ? `/cc/people/members/${openId}` : null);
  const [error, setError] = useState<string | null>(null);

  return (
    <AdminShell title="Customers & members" permission="members.view" actions={can(user, 'members.export') ? <button className={btn.secondary} onClick={() => downloadCsv('/cc/people/export/members.csv', 'enhakkore-members.csv')}>Export CSV</button> : undefined}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input className="field" placeholder="Search name, email, phone, city" value={q} onChange={(event) => setQ(event.target.value)} />
        <select className="field sm:w-48" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Panel className="!p-0">
          {!list.data ? <p className="p-5 text-sm text-ink-muted">Loading…</p> : (
            <ul className="divide-y divide-line">
              {list.data.items.map((row) => (
                <li key={row.id}>
                  <button className={`flex w-full items-center gap-3 p-3 text-left hover:bg-[#faf8f3] ${openId === row.id ? 'bg-[#faf8f3]' : ''}`} onClick={() => setOpenId(row.id)}>
                    <Avatar name={row.name} src={row.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1 text-sm"><p className="truncate font-semibold">{row.name}</p><p className="truncate text-xs text-ink-muted">{row.email} · {[row.city, row.country].filter(Boolean).join(', ')}</p></div>
                    {row.status !== 'ACTIVE' && <StatusPill status={row.status} />}
                  </button>
                </li>
              ))}
              {list.data.items.length === 0 && <li className="p-5 text-sm text-ink-muted">No members found.</li>}
            </ul>
          )}
        </Panel>
        {openId && (
          <Panel title="Member record">
            {!detail.data ? <p className="text-sm text-ink-muted">Loading…</p> : (
              <div className="grid gap-4 text-sm">
                <div className="flex items-center gap-3"><Avatar name={detail.data.user.name} src={detail.data.user.avatarUrl} size="lg" /><div><p className="text-lg font-bold">{detail.data.user.name}</p><p className="text-ink-muted">{detail.data.user.email}{detail.data.user.phone ? ` · ${detail.data.user.phone}` : ''}</p><p className="text-xs text-ink-muted">Joined {new Date(detail.data.user.createdAt).toLocaleDateString('en-GB')} · last sign-in {detail.data.user.lastLoginAt ? new Date(detail.data.user.lastLoginAt).toLocaleDateString('en-GB') : 'never'}</p></div></div>
                <div className="flex flex-wrap items-center gap-2"><StatusPill status={detail.data.user.status} />{detail.data.user.statusReason && <span className="text-xs text-ink-muted">{detail.data.user.statusReason}</span>}</div>
                {can(user, 'members.edit') && detail.data.user.role !== 'ADMIN' && (
                  <div className="flex gap-2">
                    <button
                      className={detail.data.user.status === 'ACTIVE' ? btn.danger : btn.green}
                      onClick={async () => {
                        const next = detail.data.user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
                        const reason = window.prompt(next === 'SUSPENDED' ? 'Reason for suspending (kept on record; they are signed out everywhere):' : 'Reason for reactivating:');
                        if (!reason) return;
                        try {
                          await api.post(`/cc/people/members/${openId}/status`, { status: next, reason });
                          await Promise.all([detail.reload(), list.reload()]);
                        } catch (caught) {
                          setError(caught instanceof ApiError ? caught.message : 'Could not change.');
                        }
                      }}
                    >
                      {detail.data.user.status === 'ACTIVE' ? 'Suspend account' : 'Reactivate account'}
                    </button>
                  </div>
                )}
                {error && <p className="text-danger">{error}</p>}
                <Section title="Trip bookings & applications" rows={detail.data.bookings.map((row: any) => `${row.reference} · ${row.trip.title} · ${row.status.toLowerCase()} · paid ${formatMoney({ amount: row.amountPaid, currency: row.currency })} of ${formatMoney({ amount: row.totalAmount, currency: row.currency })}`)} />
                <Section title="Event registrations" rows={detail.data.registrations.map((row: any) => `${row.reference} · ${row.event.title} · ${row.status.toLowerCase()}`)} />
                <Section title="Activity requests" rows={detail.data.activityRequests.map((row: any) => `${row.activity.title} · ${row.status.toLowerCase()}`)} />
                <Section title="Enquiries" rows={detail.data.enquiries.map((row: any) => `${row.reference} · ${row.type.toLowerCase()} · ${row.subjectTitle ?? ''} · ${row.status.toLowerCase()}`)} />
                <Section title="Reports about this member" rows={detail.data.reports.map((row: any) => `${row.reason} · ${row.status.toLowerCase()}`)} />
                {detail.data.sessions.length > 0 && <Section title="Signed in on" rows={detail.data.sessions.map((row: any) => `${row.userAgent?.slice(0, 60) ?? 'Unknown device'} · last seen ${new Date(row.lastSeenAt).toLocaleString('en-GB')}`)} />}
                <p className="text-xs text-ink-muted">Opening this record was written to the audit log.</p>
              </div>
            )}
          </Panel>
        )}
      </div>
    </AdminShell>
  );
}

function Section({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{title}</p>
      {rows.length === 0 ? <p className="text-xs text-ink-faint">None</p> : <ul className="mt-1 space-y-1">{rows.map((row, index) => <li key={index} className="rounded-lg bg-[#faf8f3] px-3 py-1.5 text-xs">{row}</li>)}</ul>}
    </div>
  );
}
