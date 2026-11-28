'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { APPLICATION_STATUS_LABELS, formatMoney } from '@enhakkore/shared';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { tripDates } from '@/components/public/listings';
import { api } from '@/lib/api';

const PAYMENT_LABELS: Record<string, string> = { AWAITING_PAYMENT: 'Awaiting payment', RECEIPT_SUBMITTED: 'Receipt submitted', UNDER_VERIFICATION: 'Under verification', APPROVED: 'Payment approved', REJECTED: 'Payment rejected', REFUNDED: 'Refunded', CANCELLED: 'Cancelled' };

interface Row {
  reference: string;
  status: string;
  paymentStatus?: string;
  travellers: number;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  trip: { title: string; slug: string };
  departure: { startDate: string; endDate: string };
}

type Phase = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'PAYMENTS';
function phaseOf(row: Row): Exclude<Phase, 'PAYMENTS'> {
  const now = Date.now();
  if (['CANCELLED', 'DECLINED', 'COMPLETED', 'WITHDRAWN'].includes(row.status) || new Date(row.departure.endDate).getTime() < now) return 'COMPLETED';
  if (new Date(row.departure.startDate).getTime() <= now) return 'ACTIVE';
  return 'UPCOMING';
}

/** My Trips: upcoming, active (travelling now) and completed — and My Trip Payments. */
export default function ApplicationsPage() {
  const [all, setAll] = useState<Row[] | null>(null);
  const [phase, setPhase] = useState<Phase>('UPCOMING');
  useEffect(() => {
    api.get<Row[]>('/community/applications').then(setAll).catch(() => setAll([]));
    if (new URLSearchParams(window.location.search).get('view') === 'payments') setPhase('PAYMENTS');
  }, []);
  const rows = all === null ? null : phase === 'PAYMENTS' ? all.filter((row) => row.status !== 'CANCELLED') : all.filter((row) => phaseOf(row) === phase);
  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title={phase === 'PAYMENTS' ? 'My Trip Payments' : 'My Trips'}>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="tablist">
        {(['UPCOMING', 'ACTIVE', 'COMPLETED', 'PAYMENTS'] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={phase === key} onClick={() => setPhase(key)} className={`chip shrink-0 ${phase === key ? 'chip-active' : ''}`}>
            {key === 'UPCOMING' ? 'Upcoming' : key === 'ACTIVE' ? 'Active' : key === 'COMPLETED' ? 'Completed' : 'Payments'}{all && key !== 'PAYMENTS' ? ` (${all.filter((row) => phaseOf(row) === key).length})` : ''}
          </button>
        ))}
      </div>
      {phase === 'PAYMENTS' && <p className="mb-4 text-sm text-ink-muted">Open a trip to see the price, deposit, balance, payment methods and your receipts. A receipt is checked by the team before a payment is approved.</p>}
      {rows === null ? (
        <p className="text-ink-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl bg-[color:var(--color-cream)] p-8 text-center">
          <p className="font-display text-2xl text-acacia-700">{phase === 'COMPLETED' ? 'No completed trips yet' : phase === 'ACTIVE' ? 'No trip in progress' : 'No upcoming trips'}</p>
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
                  {row.paymentStatus && <p className="text-xs text-ink-muted">Payment: {PAYMENT_LABELS[row.paymentStatus] ?? row.paymentStatus}</p>}
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
