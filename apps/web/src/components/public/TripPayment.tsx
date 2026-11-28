'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatMoney } from '@enhakkore/shared';
import { CopyButton } from '@/components/public/Actions';
import { ApiError, api } from '@/lib/api';
import { uploadFile } from '@/lib/upload';

interface Summary { total: number; deposit: number | null; balanceAfterDeposit: number | null; paid: number; outstanding: number; depositOutstanding: number | null; currency: string }
interface PaymentData {
  reference: string;
  status: string;
  paymentStatus: string;
  paymentStatusLabel: string;
  summary: Summary;
  currencies: { code: string; available: boolean; rate: number; note: string }[];
  mobileMoney: { available: boolean; provider: string; note: string | null };
  methods: { name: string; kind: string; provider: string | null; accountName: string | null; accountNumber: string | null; instructions: string | null; referenceFormat: string | null; currencies: string[] }[];
  receipts: { reference: string; amount: number; currency: string; methodName: string; transactionRef: string | null; status: string; reviewNote: string | null; createdAt: string }[];
}

const RECEIPT_LABEL: Record<string, string> = { SUBMITTED: 'Receipt submitted', UNDER_VERIFICATION: 'Under verification', APPROVED: 'Payment approved', REJECTED: 'Payment rejected' };
const money = (amount: number, currency: string) => formatMoney({ amount, currency });

/**
 * Paying for a trip place: deposit and balance, the payment currency, and the
 * two ways to pay. Automatic mobile money is offered only when a real gateway
 * is connected; otherwise the traveller pays by an authorised method and
 * uploads the receipt, which the team verifies before anything is confirmed.
 */
export function TripPayment({ reference, onChanged }: { reference: string; onChanged?: () => void }) {
  const [data, setData] = useState<PaymentData | null>(null);
  const [method, setMethod] = useState<'mobile' | 'receipt'>('receipt');
  const [currency, setCurrency] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<{ assetId: string; format: string; name: string } | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const next = await api.get<PaymentData>(`/community/applications/${reference}/payment`);
    setData(next);
    setCurrency((value) => value || next.summary.currency);
  }, [reference]);
  useEffect(() => {
    void load().catch(() => setData(null));
  }, [load]);

  if (!data) return null;
  const { summary } = data;
  const closed = !['APPLIED', 'PENDING_PAYMENT', 'CONFIRMED'].includes(data.status);
  const suggested = summary.depositOutstanding && summary.depositOutstanding > 0 ? summary.depositOutstanding : summary.outstanding;
  const pending = data.receipts.some((receipt) => receipt.status === 'SUBMITTED' || receipt.status === 'UNDER_VERIFICATION');

  return (
    <section className="rounded-2xl border border-line bg-white p-5" aria-labelledby="pay-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="pay-heading" className="text-lg font-bold text-ink">Payment</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${data.paymentStatus === 'APPROVED' ? 'bg-safari-50 text-safari-700' : data.paymentStatus === 'REJECTED' ? 'bg-danger-soft text-danger' : 'bg-[#fdf4e3] text-warning'}`}>{data.paymentStatusLabel}</span>
      </div>

      <dl className="mt-3 grid gap-1 rounded-xl bg-[color:var(--color-cream)] p-4 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-ink-muted">Trip price</dt><dd className="font-semibold">{money(summary.total, summary.currency)}</dd></div>
        {summary.deposit !== null && (
          <>
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Booking deposit (part of the price)</dt><dd className="font-semibold">{money(summary.deposit, summary.currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Balance after the deposit</dt><dd className="font-semibold">{money(summary.balanceAfterDeposit ?? 0, summary.currency)}</dd></div>
          </>
        )}
        <div className="flex justify-between gap-3 border-t border-line pt-1"><dt className="text-ink-muted">Verified so far</dt><dd className="font-semibold text-safari-700">{money(summary.paid, summary.currency)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="font-semibold text-ink">Remaining balance</dt><dd className="font-bold text-acacia-700">{money(summary.outstanding, summary.currency)}</dd></div>
      </dl>
      {summary.deposit !== null && <p className="mt-2 text-xs text-ink-muted">The deposit is deducted from the trip price — it is not an extra charge. Your place is confirmed once the deposit is verified.</p>}

      {!closed && summary.outstanding > 0 && (
        <div className="mt-5 grid gap-4">
          <label className="grid gap-1 text-sm font-semibold text-ink-soft">
            Payment currency
            <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="field">
              {data.currencies.map((item) => <option key={item.code} value={item.code} disabled={!item.available}>{item.code}{item.available ? '' : ' — not available yet'}</option>)}
            </select>
            <span className="text-xs font-normal text-ink-muted">{data.currencies.find((item) => item.code === currency)?.note}</span>
          </label>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold text-ink-soft">How would you like to pay?</legend>
            <label className={`flex items-start gap-3 rounded-xl border p-3 ${data.mobileMoney.available ? 'cursor-pointer' : 'opacity-60'} ${method === 'mobile' ? 'border-clay-400 bg-[#fff8e6]' : 'border-line'}`}>
              <input type="radio" name="method" checked={method === 'mobile'} disabled={!data.mobileMoney.available} onChange={() => setMethod('mobile')} className="mt-1" />
              <span><span className="block font-semibold text-ink">Mobile money (prompt on your phone)</span><span className="text-xs text-ink-muted">{data.mobileMoney.available ? 'You approve the payment on your phone. Your booking updates when the provider confirms it.' : data.mobileMoney.note}</span></span>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${method === 'receipt' ? 'border-clay-400 bg-[#fff8e6]' : 'border-line'}`}>
              <input type="radio" name="method" checked={method === 'receipt'} onChange={() => setMethod('receipt')} className="mt-1" />
              <span><span className="block font-semibold text-ink">Pay & upload receipt</span><span className="text-xs text-ink-muted">Pay with your mobile-money app or bank using the details below, then upload the receipt for verification.</span></span>
            </label>
          </fieldset>

          {method === 'receipt' && (
            <form
              className="grid gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                if (busy || uploading) return;
                const form = new FormData(event.currentTarget);
                setBusy(true);
                setMessage(null);
                try {
                  await api.post(`/community/applications/${reference}/receipts`, {
                    amount: Number(form.get('amount')),
                    methodName: String(form.get('methodName')),
                    payerPhone: String(form.get('payerPhone') ?? ''),
                    transactionRef: String(form.get('transactionRef') ?? ''),
                    fileAssetId: file?.assetId ?? '',
                    fileFormat: file?.format ?? '',
                    acceptedTerms: form.get('terms') === 'on',
                  });
                  setMessage({ tone: 'ok', text: 'Receipt submitted. The team will check that the money arrived — your place is confirmed only after they approve it. You will get a notification.' });
                  setFile(null);
                  (event.target as HTMLFormElement).reset();
                  await load();
                  onChanged?.();
                } catch (caught) {
                  setMessage({ tone: 'error', text: caught instanceof ApiError ? Object.values(caught.fields)[0] ?? caught.message : 'Could not submit. Check your connection.' });
                } finally {
                  setBusy(false);
                }
              }}
            >
              {data.methods.length === 0 ? (
                <p className="rounded-xl bg-sand p-3 text-sm text-ink-soft">The team has not published payment details yet. Please wait for them to contact you.</p>
              ) : (
                <div className="grid gap-2">
                  {data.methods.map((item) => (
                    <div key={item.name} className="rounded-xl border border-line p-3 text-sm">
                      <p className="text-xs font-bold uppercase tracking-wider text-clay-600">{item.name}</p>
                      {item.accountNumber && <p className="mt-1 flex items-center gap-2 font-mono text-base font-bold">{item.accountNumber} <CopyButton value={item.accountNumber} /></p>}
                      {item.accountName && <p className="text-ink-soft">Name: {item.accountName}</p>}
                      {item.instructions && <p className="mt-1 whitespace-pre-line text-xs text-ink-muted">{item.instructions}</p>}
                    </div>
                  ))}
                  <p className="text-xs text-ink-muted">Use your booking reference <strong className="font-mono">{reference}</strong> as the payment reference where possible.</p>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold text-ink-soft">Amount paid ({summary.currency})<input name="amount" type="number" min={1} required defaultValue={suggested} className="field" /></label>
                <label className="grid gap-1 text-sm font-semibold text-ink-soft">
                  Paid with
                  <select name="methodName" required className="field" defaultValue={data.methods[0]?.name ?? ''}>
                    {data.methods.map((item) => <option key={item.name}>{item.name}</option>)}
                    <option>Other</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-ink-soft">Transaction ID (from your payment message)<input name="transactionRef" maxLength={120} className="field" /></label>
                <label className="grid gap-1 text-sm font-semibold text-ink-soft">Phone number you paid from<input name="payerPhone" type="tel" maxLength={30} className="field" /></label>
              </div>
              <label className="grid gap-1 text-sm font-semibold text-ink-soft">
                Receipt screenshot or PDF
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="text-sm font-normal"
                  onChange={async (event) => {
                    const chosen = event.target.files?.[0];
                    if (!chosen) return;
                    setUploading(true);
                    setMessage(null);
                    try {
                      const stored = await uploadFile('PAYMENT_RECEIPT', chosen);
                      setFile({ assetId: stored.assetId, format: stored.format, name: chosen.name });
                    } catch (caught) {
                      setMessage({ tone: 'error', text: caught instanceof ApiError ? caught.message : 'The file could not be uploaded.' });
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
                <span className="text-xs font-normal text-ink-muted">{uploading ? 'Uploading…' : file ? `Attached: ${file.name}` : 'Kept private: only you and the team who verify payments can open it.'}</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-ink-soft">
                <input type="checkbox" name="terms" required className="mt-1" />
                <span>I have read the trip’s booking and cancellation terms. I understand my place is confirmed only after the team verifies this payment.</span>
              </label>
              {pending && <p className="text-xs text-ink-muted">You already have a receipt waiting to be checked. Send another only for a separate payment.</p>}
              <button disabled={busy || uploading} className="h-12 rounded-full bg-clay-400 font-bold text-acacia-700 disabled:opacity-50">{busy ? 'Submitting…' : 'Submit receipt for verification'}</button>
            </form>
          )}

          {method === 'mobile' && data.mobileMoney.available && <p className="rounded-xl bg-sand p-3 text-sm text-ink-soft">Mobile-money prompts are not offered yet.</p>}
        </div>
      )}

      {message && <p role="status" className={`mt-4 rounded-xl p-3 text-sm ${message.tone === 'ok' ? 'bg-safari-50 text-safari-700' : 'bg-danger-soft text-danger'}`}>{message.text}</p>}

      {data.receipts.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Your receipts</p>
          <ul className="mt-2 divide-y divide-line text-sm">
            {data.receipts.map((receipt) => (
              <li key={receipt.reference} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span><span className="font-mono text-xs">{receipt.reference}</span> · {money(receipt.amount, receipt.currency)} · {receipt.methodName}</span>
                  <span className="text-xs font-bold text-acacia-700">{RECEIPT_LABEL[receipt.status] ?? receipt.status}</span>
                </div>
                {receipt.reviewNote && <p className="mt-1 text-xs text-danger">{receipt.reviewNote}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
