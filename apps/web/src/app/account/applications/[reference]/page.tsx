'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { APPLICATION_STATUS_LABELS, formatMoney } from '@enhakkore/shared';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { tripDates } from '@/components/public/listings';
import { TripPayment } from '@/components/public/TripPayment';
import { ApiError, api } from '@/lib/api';

interface Application {
  reference: string;
  status: string;
  travellers: { fullName: string }[];
  priceTier: string | null;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  cancelReason: string | null;
  trip: { title: string; slug: string; paymentInstructions: string | null; paymentOptions: { method?: string; kind?: string; number?: string; name?: string }[]; cancellationPolicy: string | null };
  departure: { startDate: string; endDate: string };
  groupId: string | null;
  payments: { amount: number; currency: string; method: string; settledAt: string; providerRef: string | null }[];
  paymentMethods: { name: string; accountName: string | null; accountNumber: string | null; instructions: string | null }[];
}

const STEPS = ['APPLIED', 'PENDING_PAYMENT', 'CONFIRMED'];

export default function ApplicationPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = use(params);
  const [data, setData] = useState<Application | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api.get<Application>(`/community/applications/${reference}`).then(setData).catch(() => setData(null)), [reference]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES}>
      {data === undefined ? <p className="text-ink-muted">Loading…</p> : data === null ? <p className="text-ink-muted">We could not find that application.</p> : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <div>
              <p className="kicker">Application {data.reference}</p>
              <h1 className="display-md mt-2 text-acacia-700">{data.trip.title}</h1>
              <p className="mt-1 text-ink-muted">{tripDates(data.departure.startDate, data.departure.endDate)}</p>
            </div>
            <ol className="flex gap-2">
              {STEPS.map((step, index) => {
                const reached = STEPS.indexOf(data.status) >= index || data.status === 'COMPLETED';
                return <li key={step} className={`flex-1 rounded-full px-3 py-2 text-center text-xs font-bold ${reached ? 'bg-acacia-600 text-white' : 'bg-sand text-ink-muted'}`}>{APPLICATION_STATUS_LABELS[step]}</li>;
              })}
            </ol>
            <div className="rounded-xl border border-line bg-white p-5">
              <p className="text-sm font-bold text-acacia-700">{APPLICATION_STATUS_LABELS[data.status]}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {data.status === 'APPLIED' && 'Your places are held. Pay the deposit (or the full price) by one of the methods below and upload your receipt — your place is confirmed once the team verifies it.'}
                {data.status === 'PENDING_PAYMENT' && 'Approved. Pay by one of the methods below and upload your receipt. Your booking is confirmed once the payment is verified.'}
                {data.status === 'CONFIRMED' && 'You are confirmed. Your departure’s private group is open to you.'}
                {['DECLINED', 'CANCELLED', 'REFUNDED'].includes(data.status) && (data.cancelReason ?? 'This application is closed.')}
              </p>
              {data.status === 'CONFIRMED' && data.amountPaid < data.totalAmount && <p className="mt-2 text-sm font-semibold text-acacia-700">Remaining balance: {formatMoney({ amount: data.totalAmount - data.amountPaid, currency: data.currency })}</p>}
              {data.groupId && <Link href={`/account/groups/${data.groupId}`} className="mt-4 inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Open the trip group</Link>}
            </div>
            <div className="rounded-xl border border-line bg-white p-5 text-sm">
              <p className="font-bold text-acacia-700">Travellers</p>
              <ul className="mt-2 list-disc pl-5 text-ink-soft">{data.travellers.map((traveller) => <li key={traveller.fullName}>{traveller.fullName}</li>)}</ul>
              {data.priceTier && <p className="mt-2 text-ink-muted">Price: {data.priceTier}</p>}
            </div>
            {data.trip.cancellationPolicy && <div className="rounded-xl border border-line bg-white p-5 text-sm"><p className="font-bold text-acacia-700">Cancellation & refunds</p><p className="mt-1 whitespace-pre-line text-ink-soft">{data.trip.cancellationPolicy}</p></div>}
          </div>
          <aside className="space-y-4">
            <div className="rounded-xl border border-line bg-white p-5">
              <p className="text-sm text-ink-muted">Total</p>
              <p className="font-display text-3xl text-acacia-700">{formatMoney({ amount: data.totalAmount, currency: data.currency })}</p>
              <p className="text-sm text-ink-soft">Verified so far: {formatMoney({ amount: data.amountPaid, currency: data.currency })}</p>
              {data.payments.length > 0 && <ul className="mt-3 space-y-1 text-xs text-ink-muted">{data.payments.map((payment, index) => <li key={index}>{new Date(payment.settledAt).toLocaleDateString('en-GB')} · {formatMoney({ amount: payment.amount, currency: payment.currency })}</li>)}</ul>}
            </div>
            <TripPayment reference={data.reference} onChanged={() => void load()} />
            {['APPLIED', 'PENDING_PAYMENT'].includes(data.status) && (
              <div className="rounded-xl border border-line bg-white p-5 text-sm">
                <button
                  className="text-xs font-semibold text-ink-muted underline"
                  onClick={async () => {
                    if (!window.confirm('Withdraw this application? Your places will be released.')) return;
                    try {
                      await api.post(`/community/applications/${data.reference}/withdraw`);
                      await load();
                    } catch (caught) {
                      setError(caught instanceof ApiError ? caught.message : 'Could not withdraw.');
                    }
                  }}
                >
                  Withdraw application
                </button>
                {error && <p className="mt-2 text-xs text-danger">{error}</p>}
              </div>
            )}
          </aside>
        </div>
      )}
    </DashboardShell>
  );
}
