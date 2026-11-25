'use client';

import Link from 'next/link';
import { useState } from 'react';
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, formatMoney } from '@enhakkore/shared';
import { AdminShell, Panel, StatusPill, btn } from '@/components/admin/AdminShell';
import { PaymentForm } from '@/components/admin/PaymentForm';
import { ApiError, api } from '@/lib/api';
import { can } from '@/lib/admin';
import { useSession } from '@/lib/session';
import { useApi, useQueryParam } from '@/lib/useApi';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Trip applications: review, approve, record payments, confirm — and the traveller joins the group. */
export default function ApplicationsAdmin() {
  const { user } = useSession();
  const departureId = useQueryParam('departureId');
  const initialStatus = useQueryParam('status');
  const [status, setStatus] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const current = status ?? initialStatus ?? '';
  const { data, reload } = useApi<{ items: any[]; statusCounts: Record<string, number> }>(`/cc/applications?pageSize=100${current ? `&status=${current}` : ''}${departureId ? `&departureId=${departureId}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const edit = can(user, 'bookings.edit');

  const decide = async (id: string, action: string, ask?: string) => {
    let reason: string | undefined;
    if (ask) {
      const answer = window.prompt(ask);
      if (answer === null) return;
      reason = answer || undefined;
    } else if (!window.confirm(`${action[0]!.toUpperCase()}${action.slice(1)} this application?`)) return;
    setError(null);
    try {
      await api.post(`/cc/applications/${id}/decision`, { action, reason });
      await reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update.');
    }
  };

  return (
    <AdminShell title="Trip applications" permission="bookings.view" actions={departureId ? <Link className={btn.secondary} href={`/admin/departures/${departureId}`}>Departure roster & budget</Link> : undefined}>
      <div className="no-scrollbar -mx-3 mb-3 flex gap-2 overflow-x-auto px-3">
        <button className={`chip ${current === '' ? 'chip-active' : ''}`} onClick={() => setStatus('')}>All</button>
        {APPLICATION_STATUSES.map((item) => <button key={item} className={`chip ${current === item ? 'chip-active' : ''}`} onClick={() => setStatus(item)}>{APPLICATION_STATUS_LABELS[item]} {data?.statusCounts[item] ? `(${data.statusCounts[item]})` : ''}</button>)}
      </div>
      <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name, email, phone or reference" className="field mb-4" />
      {error && <p className="mb-3 rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <Panel className="!p-0">
        {!data ? <p className="p-5 text-sm text-ink-muted">Loading…</p> : data.items.length === 0 ? <p className="p-5 text-sm text-ink-muted">No applications yet.</p> : (
          <ul className="divide-y divide-line">
            {data.items.map((item) => (
              <li key={item.id} className="p-4">
                <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen(open === item.id ? null : item.id)}>
                  <div className="min-w-0">
                    <p className="font-semibold">{item.user.name} · {item.travellers} traveller{item.travellers === 1 ? '' : 's'}</p>
                    <p className="text-sm text-ink-muted">{item.trip.title} · {item.departure.startDate.slice(0, 10)} · {item.reference}</p>
                    <p className="text-xs text-ink-muted">Paid {formatMoney({ amount: item.amountPaid, currency: item.currency })} of {formatMoney({ amount: item.totalAmount, currency: item.currency })}{item.outstanding ? ` · ${formatMoney({ amount: item.outstanding, currency: item.currency })} outstanding` : ''}</p>
                  </div>
                  <StatusPill status={item.status} />
                </button>
                {open === item.id && (
                  <div className="mt-3 grid gap-3 rounded-xl bg-[#faf8f3] p-4 text-sm">
                    <div className="grid gap-1 sm:grid-cols-2">
                      <p><span className="text-ink-muted">Email:</span> {item.user.email}</p>
                      <p><span className="text-ink-muted">Phone:</span> {item.contactPhone ?? item.user.phone ?? '—'}</p>
                      {item.priceTier && <p><span className="text-ink-muted">Price:</span> {item.priceTier}</p>}
                      <p><span className="text-ink-muted">Applied:</span> {new Date(item.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-ink-muted">Travellers</p>
                      <ul className="mt-1 list-disc pl-5">{item.travellerList.map((traveller: any) => <li key={traveller.id}>{traveller.fullName}{traveller.notes ? ` — ${traveller.notes}` : ''}</li>)}</ul>
                    </div>
                    {item.notes && <p className="rounded-lg bg-white p-2">“{item.notes}”</p>}
                    {item.payments.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-ink-muted">Payments</p>
                        <ul className="mt-1 text-xs">{item.payments.map((payment: any) => <li key={payment.id}>{new Date(payment.settledAt ?? payment.createdAt).toLocaleDateString('en-GB')} · {formatMoney({ amount: payment.amount, currency: payment.currency })} · {payment.method} · {payment.providerRef}</li>)}</ul>
                      </div>
                    )}
                    {edit && (
                      <div className="flex flex-wrap gap-2">
                        {(item.contactPhone || item.user.phone) && <a className={btn.secondary} target="_blank" rel="noreferrer" href={`https://wa.me/${String(item.contactPhone ?? item.user.phone).replace(/\D/g, '')}`}>WhatsApp</a>}
                        {item.status === 'APPLIED' && <button className={btn.primary} onClick={() => decide(item.id, 'approve')}>Approve</button>}
                        {['APPLIED', 'PENDING_PAYMENT'].includes(item.status) && <button className={btn.gold} onClick={() => decide(item.id, 'confirm')}>Confirm booking</button>}
                        {['APPLIED', 'PENDING_PAYMENT'].includes(item.status) && <button className={btn.secondary} onClick={() => decide(item.id, 'decline', 'Reason for declining (shown to the applicant):')}>Decline</button>}
                        {['APPLIED', 'PENDING_PAYMENT', 'CONFIRMED'].includes(item.status) && <button className={btn.danger} onClick={() => decide(item.id, 'cancel', 'Reason for cancelling (shown to the traveller):')}>Cancel</button>}
                        {item.status === 'CONFIRMED' && <button className={btn.secondary} onClick={() => decide(item.id, 'complete')}>Mark completed</button>}
                      </div>
                    )}
                    {edit && ['APPLIED', 'PENDING_PAYMENT', 'CONFIRMED'].includes(item.status) && <PaymentForm endpoint={`/cc/applications/${item.id}/payments`} currency={item.currency} onDone={reload} />}
                    {edit && can(user, 'finance.create') && item.amountPaid > 0 && (
                      <button
                        className="w-fit text-xs font-semibold text-danger underline"
                        onClick={async () => {
                          const amount = window.prompt(`Refund how much (${item.currency})? Paid so far: ${formatMoney({ amount: item.amountPaid, currency: item.currency })}`);
                          if (!amount) return;
                          try {
                            await api.post(`/cc/applications/${item.id}/refund`, { amount: Number(amount), reason: window.prompt('Reason (optional)') ?? undefined, cancel: window.confirm('Also cancel the booking and release the seats?') });
                            await reload();
                          } catch (caught) {
                            setError(caught instanceof ApiError ? caught.message : 'Could not refund.');
                          }
                        }}
                      >
                        Record a refund
                      </button>
                    )}
                    <Link className="text-xs font-semibold text-acacia-600 underline" href={`/admin/departures/${item.tripDateId}`}>This departure’s roster & budget →</Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AdminShell>
  );
}
