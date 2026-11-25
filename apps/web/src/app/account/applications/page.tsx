'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { APPLICATION_STATUS_LABELS, formatMoney } from '@enhakkore/shared';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { tripDates } from '@/components/public/listings';
import { api } from '@/lib/api';

interface Row {
  reference: string;
  status: string;
  travellers: number;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  trip: { title: string; slug: string };
  departure: { startDate: string; endDate: string };
}

export default function ApplicationsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    api.get<Row[]>('/community/applications').then(setRows).catch(() => setRows([]));
  }, []);
  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title="Trip applications">
      {rows === null ? (
        <p className="text-ink-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl bg-[color:var(--color-cream)] p-8 text-center">
          <p className="font-display text-2xl text-acacia-700">No applications yet</p>
          <Link href="/travel" className="mt-4 inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">See upcoming trips</Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => (
            <li key={row.reference}>
              <Link href={`/account/applications/${row.reference}`} className="flex flex-col gap-1 rounded-xl border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-display text-xl text-acacia-700">{row.trip.title}</p>
                  <p className="text-sm text-ink-muted">{tripDates(row.departure.startDate, row.departure.endDate)} · {row.travellers} traveller{row.travellers === 1 ? '' : 's'} · {row.reference}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-acacia-700">{APPLICATION_STATUS_LABELS[row.status] ?? row.status}</p>
                  <p className="text-xs text-ink-muted">Paid {formatMoney({ amount: row.amountPaid, currency: row.currency })} of {formatMoney({ amount: row.totalAmount, currency: row.currency })}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
