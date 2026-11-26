'use client';

import { useEffect, useState } from 'react';
import { ENQUIRY_STATUS_LABELS, ENQUIRY_TYPE_LABELS } from '@enhakkore/shared';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { api } from '@/lib/api';

interface Row {
  reference: string;
  type: string;
  subjectTitle: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  people: number | null;
  createdAt: string;
  updatedAt: string;
}

const day = (value: string | null) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null);

/** Hotel enquiries, restaurant requests and every other enquiry, with their current status. */
export default function MyEnquiries() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    api.get<{ items: Row[] }>('/community/my-enquiries').then((data) => setRows(data.items)).catch(() => setRows([]));
  }, []);
  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES}>
      <h1 className="font-display text-3xl text-acacia-700">Enquiries & reservations</h1>
      <p className="mt-2 text-sm text-ink-muted">A request is not confirmed until it shows “Confirmed”. Enquiries sent while signed in appear here.</p>
      {rows === null ? (
        <p className="mt-4 text-ink-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-ink-soft">No enquiries yet.</p>
      ) : (
        <ul className="mt-6 grid gap-2">
          {rows.map((row) => (
            <li key={row.reference} className="rounded-xl border border-line bg-white p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-clay-600">{ENQUIRY_TYPE_LABELS[row.type] ?? row.type} · {row.reference}</span>
                  <span className="font-semibold text-ink">{row.subjectTitle ?? 'Enquiry'}</span>
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.status === 'CONFIRMED' ? 'bg-safari-50 text-safari-700' : ['DECLINED', 'CANCELLED', 'UNSUCCESSFUL'].includes(row.status) ? 'bg-danger-soft text-danger' : 'bg-[#fdf4e3] text-warning'}`}>
                  {ENQUIRY_STATUS_LABELS[row.status] ?? row.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {[row.startDate ? `${day(row.startDate)}${row.endDate ? ` → ${day(row.endDate)}` : ''}` : null, row.people ? `${row.people} people` : null, `sent ${day(row.createdAt)}`, row.updatedAt !== row.createdAt ? `updated ${day(row.updatedAt)}` : null].filter(Boolean).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
