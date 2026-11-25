'use client';

import { useState } from 'react';
import {
  DIVISIONS,
  DIVISION_LABELS,
  EXPENSE_CATEGORIES,
  FINANCE_CATEGORY_LABELS,
  INCOME_CATEGORIES,
  PAYMENT_RECORD_METHODS,
  PAYMENT_RECORD_METHOD_LABELS,
  SUPPORTED_CURRENCIES,
} from '@enhakkore/shared';
import { ApiError, api } from '@/lib/api';
import { uploadFile } from '@/lib/upload';
import { btn } from './AdminShell';

/** One line in the books: income, expense or refund, optionally tied to a trip date or an event. */
export function TransactionForm({
  defaults = {},
  onDone,
  onCancel,
}: {
  defaults?: { type?: string; division?: string; currency?: string; relatedType?: string; relatedId?: string; category?: string };
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [type, setType] = useState(defaults.type ?? 'EXPENSE');
  const [receipt, setReceipt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const categories = type === 'INCOME' ? INCOME_CATEGORIES : type === 'EXPENSE' ? EXPENSE_CATEGORIES : (['REFUND'] as const);

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setErrors({});
        setMessage(null);
        try {
          await api.post('/cc/finance/transactions', {
            type,
            date: String(form.get('date')),
            amount: Number(form.get('amount')),
            currency: String(form.get('currency')),
            division: String(form.get('division')),
            category: String(form.get('category')),
            relatedType: defaults.relatedType ?? 'NONE',
            relatedId: defaults.relatedId ?? null,
            paymentMethod: String(form.get('paymentMethod') ?? '') || null,
            reference: String(form.get('reference') ?? '') || null,
            counterparty: String(form.get('counterparty') ?? '') || null,
            notes: String(form.get('notes') ?? '') || null,
            status: form.get('verified') ? 'VERIFIED' : 'PENDING',
            receiptUrl: receipt,
          });
          onDone();
        } catch (caught) {
          if (caught instanceof ApiError) {
            setErrors(caught.fields);
            setMessage(caught.message);
          } else setMessage('Could not save.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex gap-2 sm:col-span-2">
        {['INCOME', 'EXPENSE', 'REFUND'].map((value) => (
          <button key={value} type="button" onClick={() => setType(value)} className={`chip ${type === value ? 'chip-active' : ''}`}>{value === 'INCOME' ? 'Income' : value === 'EXPENSE' ? 'Expense' : 'Refund'}</button>
        ))}
      </div>
      <label className="grid gap-1 text-xs font-semibold">Date<input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="field" /></label>
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <label className="grid gap-1 text-xs font-semibold">Amount<input name="amount" type="number" step="any" min="0" required className="field" />{errors.amount && <span className="text-danger">{errors.amount}</span>}</label>
        <label className="grid gap-1 text-xs font-semibold">Currency<select name="currency" defaultValue={defaults.currency ?? 'TZS'} className="field">{SUPPORTED_CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select></label>
      </div>
      <label className="grid gap-1 text-xs font-semibold">Category<select name="category" key={type} defaultValue={defaults.category} className="field">{categories.map((value) => <option key={value} value={value}>{FINANCE_CATEGORY_LABELS[value]}</option>)}</select>{errors.category && <span className="text-danger">{errors.category}</span>}</label>
      <label className="grid gap-1 text-xs font-semibold">Business division<select name="division" defaultValue={defaults.division ?? 'TRAVEL'} className="field">{DIVISIONS.map((value) => <option key={value} value={value}>{DIVISION_LABELS[value]}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-semibold">{type === 'INCOME' ? 'Customer' : 'Supplier / paid to'}<input name="counterparty" className="field" /></label>
      <label className="grid gap-1 text-xs font-semibold">Payment method<select name="paymentMethod" className="field"><option value="">—</option>{PAYMENT_RECORD_METHODS.map((value) => <option key={value} value={value}>{PAYMENT_RECORD_METHOD_LABELS[value]}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-semibold">Transaction reference<input name="reference" className="field" /></label>
      <label className="grid gap-1 text-xs font-semibold">Receipt or document (private)
        <input
          type="file"
          accept="image/*,application/pdf"
          className="text-xs"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setMessage('Uploading receipt…');
            try {
              const uploaded = await uploadFile('RECEIPT', file);
              setReceipt(`private:${uploaded.assetId}.${uploaded.format}`);
              setMessage('Receipt attached.');
            } catch (caught) {
              setMessage(caught instanceof ApiError ? caught.message : 'Could not upload the receipt.');
            }
          }}
        />
      </label>
      <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Notes<textarea name="notes" className="field" /></label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="verified" defaultChecked /> I have checked this — mark as verified (counts in reports)</label>
      {message && <p className="text-sm text-ink-soft sm:col-span-2">{message}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button className={btn.primary} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        {onCancel && <button type="button" className={btn.secondary} onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
