'use client';

import { useState } from 'react';
import { PAYMENT_RECORD_METHODS, PAYMENT_RECORD_METHOD_LABELS } from '@enhakkore/shared';
import { ApiError, api } from '@/lib/api';
import { btn } from './AdminShell';

/** Records a payment that a person has checked arrived. Writes the books too. */
export function PaymentForm({ endpoint, currency, onDone, label = 'Record a verified payment' }: { endpoint: string; currency: string; onDone: () => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return <button className={btn.green} onClick={() => setOpen(true)}>{label}</button>;
  return (
    <form
      className="grid gap-2 rounded-xl border border-safari-100 bg-safari-50 p-3 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        if (!window.confirm(`Record ${form.get('amount')} ${currency} as received and verified?`)) return;
        setBusy(true);
        setError(null);
        try {
          await api.post(endpoint, {
            amount: Number(form.get('amount')),
            method: String(form.get('method')),
            reference: String(form.get('reference') ?? '') || undefined,
            date: String(form.get('date') ?? '') || undefined,
            note: String(form.get('note') ?? '') || undefined,
          });
          setOpen(false);
          onDone();
        } catch (caught) {
          setError(caught instanceof ApiError ? Object.values(caught.fields)[0] ?? caught.message : 'Could not record.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="grid gap-1 text-xs font-semibold">Amount ({currency})<input name="amount" type="number" step="any" min="0" required className="field" /></label>
      <label className="grid gap-1 text-xs font-semibold">Method<select name="method" className="field">{PAYMENT_RECORD_METHODS.map((method) => <option key={method} value={method}>{PAYMENT_RECORD_METHOD_LABELS[method]}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-semibold">Transaction reference<input name="reference" className="field" placeholder="e.g. M-Pesa code" /></label>
      <label className="grid gap-1 text-xs font-semibold">Date received<input name="date" type="date" className="field" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
      <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Note<input name="note" className="field" /></label>
      {error && <p className="text-xs text-danger sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button className={btn.green} disabled={busy}>{busy ? 'Saving…' : 'Save payment'}</button>
        <button type="button" className={btn.secondary} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
