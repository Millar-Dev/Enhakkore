'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { APPLICATION_STATUS_LABELS, FINANCE_CATEGORY_LABELS, formatMoney } from '@enhakkore/shared';
import { AdminShell, Panel, StatusPill, btn } from '@/components/admin/AdminShell';
import { sums } from '@/components/admin/ResourceExtras';
import { TransactionForm } from '@/components/admin/TransactionForm';
import { can } from '@/lib/admin';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/useApi';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** One departure: participants, who has paid, the costs, and the profit — per currency. */
export default function DepartureBudget({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useSession();
  const { data, reload } = useApi<any>(`/cc/departures/${id}`);
  const [adding, setAdding] = useState(false);
  const departure = data?.departure;
  return (
    <AdminShell title={departure ? `${departure.trip.title} · ${departure.startDate.slice(0, 10)}` : 'Departure'} permission="bookings.view" actions={departure ? <Link className={btn.secondary} href={`/admin/applications?departureId=${id}`}>Manage applications</Link> : undefined}>
      {!data ? <p className="text-ink-muted">Loading…</p> : (
        <div className="grid gap-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ['Expected', data.summary.expectedParticipants ?? '—'],
              ['Applied (live)', data.summary.applied],
              ['Confirmed', data.summary.confirmedParticipants],
              ['Seats left', data.summary.seatsLeft],
              ['Minimum', departure.trip.minParticipants ?? '—'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-ink-muted">{label}</p><p className="mt-1 font-display text-3xl text-acacia-700">{value}</p></div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-ink-muted">Paid by participants</p><p className="mt-1 text-lg font-bold text-safari-700">{sums(data.summary.paid)}</p></div>
            <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-ink-muted">Outstanding balances</p><p className="mt-1 text-lg font-bold text-warning">{sums(data.summary.outstanding)}</p></div>
          </div>

          <Panel title="Participants">
            {departure.bookings.length === 0 ? <p className="text-sm text-ink-muted">No applications yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs text-ink-muted"><tr><th className="py-2">Reference</th><th>Name</th><th>Travellers</th><th>Status</th><th className="text-right">Paid</th><th className="text-right">Balance</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {departure.bookings.map((booking: any) => (
                      <tr key={booking.id}>
                        <td className="py-2 font-mono text-xs">{booking.reference}</td>
                        <td>{booking.user.name}<span className="block text-xs text-ink-muted">{booking.travellerList.map((t: any) => t.fullName).join(', ')}</span></td>
                        <td>{booking.travellers}</td>
                        <td><StatusPill status={booking.status} /><span className="sr-only">{APPLICATION_STATUS_LABELS[booking.status]}</span></td>
                        <td className="text-right">{formatMoney({ amount: booking.amountPaid, currency: booking.currency })}</td>
                        <td className="text-right">{formatMoney({ amount: Math.max(0, booking.totalAmount - booking.amountPaid), currency: booking.currency })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {departure.conversation && <Link href={`/account/groups/${departure.conversation.id}`} className="mt-3 inline-block text-sm font-semibold text-acacia-600 underline">Open this departure’s private group →</Link>}
          </Panel>

          {data.finance ? (
            <Panel title="Budget & profit" actions={can(user, 'finance.create') && !adding ? <button className={btn.gold} onClick={() => setAdding(true)}>+ Add a cost or income</button> : undefined}>
              {adding && (
                <div className="mb-5 rounded-xl bg-[#faf8f3] p-4">
                  <TransactionForm defaults={{ type: 'EXPENSE', division: 'TRAVEL', currency: departure.trip.currency, relatedType: 'TRIP_DEPARTURE', relatedId: id }} onDone={() => { setAdding(false); void reload(); }} onCancel={() => setAdding(false)} />
                </div>
              )}
              <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div><dt className="text-xs text-ink-muted">Expected revenue (live applications)</dt><dd className="font-bold">{sums(data.finance.expectedRevenue)}</dd></div>
                <div><dt className="text-xs text-ink-muted">Revenue received (verified)</dt><dd className="font-bold">{sums(data.finance.income)}</dd></div>
                <div><dt className="text-xs text-ink-muted">Refunds</dt><dd className="font-bold">{sums(data.finance.refunds)}</dd></div>
                <div><dt className="text-xs text-ink-muted">Actual expenses (verified)</dt><dd className="font-bold">{sums(data.finance.expenses)}</dd></div>
                <div><dt className="text-xs text-ink-muted">Planned expenses (not yet verified)</dt><dd className="font-bold">{sums(data.finance.pendingExpenses)}</dd></div>
                <div><dt className="text-xs text-ink-muted">Estimated profit</dt><dd className="font-bold text-acacia-700">{sums(data.finance.estimatedProfit)}</dd></div>
                <div><dt className="text-xs text-ink-muted">Actual profit</dt><dd className="text-lg font-bold text-safari-700">{sums(data.finance.actualProfit)}</dd></div>
              </dl>
              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-ink-muted">Costs by category</h3>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {Object.entries(data.finance.expensesByCategory).map(([category, totals]: any) => <li key={category} className="flex justify-between rounded-lg bg-[#faf8f3] px-3 py-2"><span>{FINANCE_CATEGORY_LABELS[category] ?? category}</span><strong>{sums(totals)}</strong></li>)}
                {Object.keys(data.finance.expensesByCategory).length === 0 && <li className="text-ink-muted">No costs recorded yet — transport, accommodation, meals, activities…</li>}
              </ul>
              <p className="mt-3 text-xs text-ink-muted">Estimated profit = expected revenue − all recorded costs (verified and planned). Actual profit = verified revenue − refunds − verified costs.</p>
            </Panel>
          ) : <p className="text-sm text-ink-muted">Your role does not include finance, so costs and profit are hidden.</p>}
        </div>
      )}
    </AdminShell>
  );
}
