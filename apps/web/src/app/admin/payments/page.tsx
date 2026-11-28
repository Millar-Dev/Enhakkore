'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatMoney } from '@enhakkore/shared';
import { AdminShell, Panel } from '@/components/admin/AdminShell';
import { ApiError, api } from '@/lib/api';
import { useApi } from '@/lib/useApi';

interface Row {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  methodName: string;
  payerPhone: string | null;
  transactionRef: string | null;
  hasFile: boolean;
  status: string;
  reviewNote: string | null;
  createdAt: string;
  booking: {
    id: string;
    reference: string;
    status: string;
    paymentStatus: string;
    travellers: number;
    trip: string;
    startDate: string;
    customer: { name: string; username: string | null; phone: string | null; email: string };
    summary: { total: number; deposit: number | null; paid: number; outstanding: number; currency: string };
  };
}

const FILTERS = [
  ['', 'All'],
  ['SUBMITTED', 'Receipt submitted'],
  ['UNDER_VERIFICATION', 'Under verification'],
  ['APPROVED', 'Approved'],
  ['REJECTED', 'Rejected'],
] as const;

/**
 * Trip payment receipts uploaded by travellers. A receipt is evidence, not
 * proof: check the money arrived in the account (M-Pesa statement, bank),
 * then approve. Every decision is recorded in the audit log.
 */
export default function PaymentsPage() {
  const [status, setStatus] = useState('SUBMITTED');
  const { data, reload } = useApi<{ items: Row[]; counts: Record<string, number> }>(`/cc/receipts?pageSize=100${status ? `&status=${status}` : ''}`);
  const [message, setMessage] = useState<string | null>(null);

  async function act(row: Row, action: 'verify' | 'approve' | 'reject') {
    let body: Record<string, unknown> = { action };
    if (action === 'approve') {
      const amount = window.prompt(`Amount that actually arrived (${row.currency}). Approve only after checking your statement.`, String(row.amount));
      if (!amount) return;
      body = { ...body, amount: Number(amount), method: /bank/i.test(row.methodName) ? 'BANK_TRANSFER' : 'MOBILE_MONEY' };
    }
    if (action === 'reject') {
      const note = window.prompt('Reason (the traveller sees this):');
      if (!note) return;
      body = { ...body, note };
    }
    try {
      await api.post(`/cc/receipts/${row.id}/decision`, body);
      setMessage(`${row.reference}: ${action === 'approve' ? 'approved and recorded' : action === 'reject' ? 'rejected' : 'marked under verification'}. The traveller has been notified.`);
      await reload();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'That did not work.');
    }
  }

  async function open(row: Row) {
    try {
      const result = await api.get<{ url: string }>(`/cc/receipts/${row.id}/file`);
      window.open(result.url, '_blank', 'noopener');
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not open the file.');
    }
  }

  return (
    <AdminShell title="Payments & receipts" permission="bookings.view">
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(([value, label]) => (
          <button key={value} type="button" onClick={() => setStatus(value)} className={`chip ${status === value ? 'chip-active' : ''}`}>
            {label}{value && data?.counts[value] ? ` (${data.counts[value]})` : ''}
          </button>
        ))}
      </div>
      {message && <p role="status" className="mb-4 rounded-xl bg-sand p-3 text-sm text-ink-soft">{message}</p>}
      <Panel className="!p-0">
        {!data ? <p className="p-5 text-sm text-ink-muted">Loading…</p> : data.items.length === 0 ? <p className="p-5 text-sm text-ink-muted">Nothing here.</p> : (
          <ul className="divide-y divide-line">
            {data.items.map((row) => (
              <li key={row.id} className="grid gap-2 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{formatMoney({ amount: row.amount, currency: row.currency })} · {row.methodName}</p>
                    <p className="text-xs text-ink-muted">{row.reference} · {new Date(row.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}{row.transactionRef ? ` · transaction ${row.transactionRef}` : ''}{row.payerPhone ? ` · from ${row.payerPhone}` : ''}</p>
                  </div>
                  <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-bold text-acacia-700">{row.status.replace('_', ' ').toLowerCase()}</span>
                </div>
                <p className="text-xs text-ink-soft">
                  <Link href="/admin/applications" className="font-semibold text-acacia-700 underline">{row.booking.reference}</Link> · {row.booking.trip} · {row.booking.customer.name}{row.booking.customer.username ? ` (@${row.booking.customer.username})` : ''} · {row.booking.travellers} traveller{row.booking.travellers === 1 ? '' : 's'}
                </p>
                <p className="text-xs text-ink-muted">
                  Price {formatMoney({ amount: row.booking.summary.total, currency: row.booking.summary.currency })}
                  {row.booking.summary.deposit !== null ? ` · deposit ${formatMoney({ amount: row.booking.summary.deposit, currency: row.booking.summary.currency })}` : ''} · verified {formatMoney({ amount: row.booking.summary.paid, currency: row.booking.summary.currency })} · outstanding {formatMoney({ amount: row.booking.summary.outstanding, currency: row.booking.summary.currency })}
                </p>
                {row.reviewNote && <p className="text-xs text-ink-soft">Note: {row.reviewNote}</p>}
                <div className="flex flex-wrap gap-2">
                  {row.hasFile && <button type="button" onClick={() => open(row)} className="h-10 rounded-full border border-line-strong px-4 text-xs font-semibold">Open receipt</button>}
                  {row.status === 'SUBMITTED' && <button type="button" onClick={() => act(row, 'verify')} className="h-10 rounded-full border border-line-strong px-4 text-xs font-semibold">Start verifying</button>}
                  {['SUBMITTED', 'UNDER_VERIFICATION'].includes(row.status) && (
                    <>
                      <button type="button" onClick={() => act(row, 'approve')} className="h-10 rounded-full bg-acacia-600 px-4 text-xs font-bold text-white">Approve payment</button>
                      <button type="button" onClick={() => act(row, 'reject')} className="h-10 rounded-full border border-danger px-4 text-xs font-semibold text-danger">Reject</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <p className="mt-4 text-xs text-ink-muted">Approve only after the money shows in the receiving account. Approving records the payment in Finance, and confirms the place once the deposit is covered — the traveller then joins the trip group chat. Rejected receipts are kept for the record.</p>
    </AdminShell>
  );
}
