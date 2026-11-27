'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ENQUIRY_TYPE_LABELS } from '@enhakkore/shared';
import { AdminShell, Panel } from '@/components/admin/AdminShell';
import { useApi } from '@/lib/useApi';

/* eslint-disable @typescript-eslint/no-explicit-any */

const KINDS = ['VIEW', 'SAVE', 'SHARE', 'ENQUIRY', 'REGISTER'];

/** What people actually look at, save and sign up for. Counts are unique visitors per day. */
export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data } = useApi<any>(`/cc/analytics?days=${days}`);
  return (
    <AdminShell title="Reports & analytics" permission="analytics.view">
      <div className="mb-4 flex flex-wrap gap-2">{[7, 30, 90].map((value) => <button key={value} className={`chip ${days === value ? 'chip-active' : ''}`} onClick={() => setDays(value)}>Last {value} days</button>)}</div>
      {!data ? <p className="text-sm text-ink-muted">Loading…</p> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <Panel><p className="break-words text-xs text-ink-muted">New members</p><p className="font-display text-3xl text-acacia-700">{data.newMembers}</p></Panel>
            <Panel><p className="break-words text-xs text-ink-muted">Event registrations</p><p className="font-display text-3xl text-acacia-700">{data.eventRegistrations}</p></Panel>
            {KINDS.map((kind) => <Panel key={kind}><p className="break-words text-xs text-ink-muted">{kind.toLowerCase()}s</p><p className="font-display text-3xl text-acacia-700">{data.byKind[kind] ?? 0}</p></Panel>)}
          </div>
          <Panel title="Enquiries by type">
            {Object.keys(data.enquiries).length === 0 ? <p className="text-sm text-ink-muted">None in this period.</p> : (
              <ul className="grid gap-1 text-sm sm:grid-cols-2">{Object.entries(data.enquiries).map(([type, count]) => <li key={type} className="flex justify-between"><span>{ENQUIRY_TYPE_LABELS[type] ?? type}</span><strong>{String(count)}</strong></li>)}</ul>
            )}
          </Panel>
          <Panel title="Most engaged listings">
            {data.items.length === 0 ? <p className="text-sm text-ink-muted">No engagement recorded yet. Views are counted once per visitor per day; refreshing does not count.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-ink-muted"><tr><th className="py-2">Listing</th>{KINDS.map((kind) => <th key={kind} className="px-2 py-2 text-right">{kind.toLowerCase()}</th>)}</tr></thead>
                  <tbody>
                    {data.items.map((item: any) => (
                      <tr key={`${item.subjectType}-${item.subjectId}`} className="border-t border-line">
                        <td className="py-2"><span className="text-xs text-ink-muted">{item.subjectType.toLowerCase()} · </span>{item.href ? <Link href={item.href} target="_blank" className="font-semibold text-acacia-700">{item.title}</Link> : item.title}</td>
                        {KINDS.map((kind) => <td key={kind} className="px-2 py-2 text-right">{item.counts[kind] ?? 0}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <p className="text-xs text-ink-muted">
            Visitor totals for the whole website come from Vercel Web Analytics{data.visitorsDashboard ? <> — <a href={data.visitorsDashboard} target="_blank" rel="noreferrer" className="underline">open the dashboard</a></> : ' (switch it on in Vercel → Analytics, then set ANALYTICS_DASHBOARD_URL on the API to link it here)'}. Sponsored listings never influence these rankings.
          </p>
        </div>
      )}
    </AdminShell>
  );
}
