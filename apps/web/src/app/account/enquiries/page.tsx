'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ENQUIRY_TYPE_LABELS, RESERVATION_TYPES, enquiryStatusLabel } from '@enhakkore/shared';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { ApiError, api } from '@/lib/api';

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
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(() => {
    api.get<{ items: Row[] }>('/community/my-enquiries').then((data) => setRows(data.items)).catch(() => setRows([]));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const reservations = (rows ?? []).filter((row) => (RESERVATION_TYPES as readonly string[]).includes(row.type));
  const others = (rows ?? []).filter((row) => !(RESERVATION_TYPES as readonly string[]).includes(row.type));
  const cancel = async (row: Row) => {
    if (!window.confirm(`Cancel request ${row.reference}?`)) return;
    try {
      await api.post(`/community/enquiries/${row.reference}/cancel`);
      setMessage(`Request ${row.reference} cancelled. The team has been told.`);
      load();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not cancel.');
    }
  };
  const list = (items: Row[]) => (
    <ul className="mt-3 grid gap-2">
      {items.map((row) => {
        const closed = ['CANCELLED', 'DECLINED', 'UNSUCCESSFUL', 'CLOSED', 'SPAM'].includes(row.status);
        return (
          <li key={row.reference} className="rounded-xl border border-line bg-white p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-clay-600">{ENQUIRY_TYPE_LABELS[row.type] ?? row.type} · <span className="font-mono">{row.reference}</span></span>
                <span className="font-semibold text-ink">{row.subjectTitle ?? 'Enquiry'}</span>
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.status === 'CONFIRMED' ? 'bg-safari-50 text-safari-700' : closed ? 'bg-danger-soft text-danger' : 'bg-[#fdf4e3] text-warning'}`}>
                {enquiryStatusLabel(row.type, row.status)}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              {[row.startDate ? `${day(row.startDate)}${row.endDate ? ` → ${day(row.endDate)}` : ''}` : null, row.people ? `${row.people} people` : null, `sent ${day(row.createdAt)}`, row.updatedAt !== row.createdAt ? `updated ${day(row.updatedAt)}` : null].filter(Boolean).join(' · ')}
            </p>
            {row.status === 'CONFIRMED' && (RESERVATION_TYPES as readonly string[]).includes(row.type) && <p className="mt-2 text-xs text-safari-700">Confirmed by the team with the business. Your pass is under <Link href="/account/passes" className="font-semibold underline">Enhakkore Pass</Link>.</p>}
            {!closed && <button type="button" onClick={() => cancel(row)} className="mt-2 min-h-10 text-xs font-semibold text-danger">Cancel request</button>}
          </li>
        );
      })}
    </ul>
  );
  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES}>
      <h1 className="font-display text-3xl text-acacia-700">My reservations & requests</h1>
      <p className="mt-2 text-sm text-ink-muted">A request is not a booking until it shows “Confirmed” — only the Enhakkore team can confirm, after the hotel, restaurant or venue accepts.</p>
      {message && <p role="status" className="mt-4 rounded-xl bg-sand p-3 text-sm text-ink-soft">{message}</p>}
      {rows === null ? (
        <p className="mt-4 text-ink-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-ink-soft">No requests yet. <Link href="/explore" className="font-semibold text-acacia-700 underline">Explore places</Link>.</p>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink-muted">My reservations</h2>
            {reservations.length ? list(reservations) : <p className="mt-2 text-sm text-ink-soft">No hotel, restaurant or venue requests.</p>}
          </section>
          {others.length > 0 && (
            <section id="other" className="mt-8 scroll-mt-24">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-muted">Other requests</h2>
              {list(others)}
            </section>
          )}
        </>
      )}
    </DashboardShell>
  );
}
