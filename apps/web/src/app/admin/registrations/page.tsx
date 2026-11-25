'use client';

import { useState } from 'react';
import { formatMoney } from '@enhakkore/shared';
import { AdminShell, Panel, StatusPill, btn } from '@/components/admin/AdminShell';
import { PaymentForm } from '@/components/admin/PaymentForm';
import { ApiError, api } from '@/lib/api';
import { useApi, useQueryParam } from '@/lib/useApi';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Event registrations: payments, confirmation and door check-in by reference. */
export default function RegistrationsAdmin() {
  const eventId = useQueryParam('eventId');
  const initial = useQueryParam('status');
  const [status, setStatus] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const current = status ?? initial ?? '';
  const { data, reload } = useApi<{ items: any[] }>(`/cc/registrations?pageSize=200${eventId ? `&eventId=${eventId}` : ''}${current ? `&status=${current}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  const [checkIn, setCheckIn] = useState('');
  const [result, setResult] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  return (
    <AdminShell title="Event registrations" permission="events.view">
      <Panel title="Door check-in" className="mb-5">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              const row = await api.post<any>('/cc/registrations/check-in', { reference: checkIn.trim(), count: 1, eventId: eventId ?? undefined });
              setResult({ tone: 'ok', text: `✓ ${row.name} — ${row.ticket?.name ?? 'ticket'} · ${row.checkedInCount} of ${row.quantity} in` });
              setCheckIn('');
              await reload();
            } catch (caught) {
              setResult({ tone: 'error', text: caught instanceof ApiError ? caught.message : 'Could not check in.' });
            }
          }}
        >
          <input value={checkIn} onChange={(event) => setCheckIn(event.target.value.toUpperCase())} placeholder="Reference, e.g. EVT-4K7Q2M" className="field font-mono text-lg" autoCapitalize="characters" />
          <button className={btn.gold}>Check in one person</button>
        </form>
        {result && <p className={`mt-2 text-sm font-semibold ${result.tone === 'ok' ? 'text-safari-700' : 'text-danger'}`}>{result.text}</p>}
      </Panel>
      <div className="mb-3 flex flex-wrap gap-2">
        {['', 'PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED'].map((value) => <button key={value} className={`chip ${current === value ? 'chip-active' : ''}`} onClick={() => setStatus(value)}>{value ? value.replace('_', ' ').toLowerCase() : 'All'}</button>)}
      </div>
      <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name, phone or reference" className="field mb-4" />
      <Panel className="!p-0">
        {!data ? <p className="p-5 text-sm text-ink-muted">Loading…</p> : data.items.length === 0 ? <p className="p-5 text-sm text-ink-muted">No registrations.</p> : (
          <ul className="divide-y divide-line">
            {data.items.map((row) => (
              <li key={row.id} className="grid gap-2 p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{row.name} · {row.quantity} × {row.ticket?.name ?? 'ticket'}</p>
                    <p className="text-xs text-ink-muted">{row.event.title} · <span className="font-mono">{row.reference}</span> · {row.phone}</p>
                    <p className="text-xs text-ink-muted">Paid {formatMoney({ amount: row.amountPaid, currency: row.currency })} of {formatMoney({ amount: row.amountDue, currency: row.currency })} · checked in {row.checkedInCount}/{row.quantity}</p>
                  </div>
                  <StatusPill status={row.status} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.status === 'PENDING_PAYMENT' && <PaymentForm endpoint={`/cc/registrations/${row.id}/payments`} currency={row.currency} onDone={reload} label="Record payment" />}
                  {row.status === 'PENDING_PAYMENT' && <button className={btn.secondary} onClick={async () => { if (window.confirm('Confirm without a recorded payment (e.g. a complimentary ticket)?')) { await api.post(`/cc/registrations/${row.id}/status`, { status: 'CONFIRMED' }); await reload(); } }}>Confirm</button>}
                  {row.status !== 'CANCELLED' && <button className={btn.danger} onClick={async () => { if (window.confirm('Cancel this registration and release its tickets?')) { await api.post(`/cc/registrations/${row.id}/status`, { status: 'CANCELLED' }); await reload(); } }}>Cancel</button>}
                  <a className={btn.secondary} target="_blank" rel="noreferrer" href={`https://wa.me/${row.phone.replace(/\D/g, '')}`}>WhatsApp</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AdminShell>
  );
}
