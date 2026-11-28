'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatMoney } from '@enhakkore/shared';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { tripDates } from './listings';

interface Departure {
  id: string;
  startDate: string;
  endDate: string;
  seatsLeft: number;
  bookable: boolean;
  price: number;
  bookingDeadline: string | null;
}

/**
 * Apply for places on a departure. The places are held at once; the team
 * reviews the application, the traveller pays by the method shown, and the
 * booking is confirmed when the payment has been checked.
 */
export function ApplyForm({ slug, title, departures, currency, tiers, deposit }: { slug: string; title: string; departures: Departure[]; currency: string; tiers: { label: string; amount: number; currency: string; note?: string }[]; deposit?: number | null }) {
  const { status, user } = useSession();
  const router = useRouter();
  const open = departures.filter((departure) => departure.bookable);
  const [departureId, setDepartureId] = useState(open[0]?.id ?? '');
  const [tier, setTier] = useState<string>('');
  const [names, setNames] = useState<string[]>([user?.name ?? '']);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (open.length === 0) {
    return <p className="rounded-xl bg-sand p-4 text-sm font-semibold text-ink-muted">Applications are not open for this trip right now. Message us on WhatsApp to be told about the next date.</p>;
  }
  if (status !== 'authenticated') {
    return (
      <div className="grid gap-2">
        <Link href={`/signin?next=/travel/${slug}`} className="inline-flex h-12 items-center justify-center rounded-full bg-clay-400 font-bold text-acacia-700">
          Sign in to apply
        </Link>
        <p className="text-xs text-ink-muted">An account lets you follow your application and, once confirmed, join the private group for your departure.</p>
      </div>
    );
  }

  const departure = open.find((item) => item.id === departureId);
  const chosenTier = tiers.find((item) => item.label === tier);
  const unit = chosenTier ? chosenTier.amount : (departure?.price ?? 0);
  const unitCurrency = chosenTier ? chosenTier.currency : currency;

  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setError(null);
        try {
          const result = await api.post<{ reference: string }>('/community/trips/apply', {
            departureId,
            priceTier: tier || null,
            contactPhone: String(form.get('phone')),
            notes: String(form.get('notes') ?? ''),
            travellers: names.map((name, index) => ({ fullName: name, notes: String(form.get(`notes-${index}`) ?? '') })),
          });
          router.push(`/account/applications/${result.reference}`);
        } catch (caught) {
          setError(caught instanceof ApiError ? Object.values(caught.fields)[0] ?? caught.message : 'Could not send your application.');
          setBusy(false);
        }
      }}
    >
      <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
        Date
        <select value={departureId} onChange={(event) => setDepartureId(event.target.value)} className="field">
          {open.map((item) => (
            <option key={item.id} value={item.id}>
              {tripDates(item.startDate, item.endDate)} · {item.seatsLeft} place{item.seatsLeft === 1 ? '' : 's'} left
            </option>
          ))}
        </select>
      </label>
      {tiers.length > 0 && (
        <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
          Price
          <select value={tier} onChange={(event) => setTier(event.target.value)} className="field">
            <option value="">Standard — {formatMoney({ amount: departure?.price ?? 0, currency })}</option>
            {tiers.filter((item) => !(item.currency === currency && item.amount === departure?.price)).map((item) => (
              <option key={item.label} value={item.label}>
                {item.label} — {formatMoney({ amount: item.amount, currency: item.currency })}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid gap-2">
        <p className="text-[0.8125rem] font-semibold text-ink-soft">Travellers</p>
        {names.map((name, index) => (
          <div key={index} className="flex gap-2">
            <input
              value={name}
              required
              onChange={(event) => setNames((list) => list.map((item, i) => (i === index ? event.target.value : item)))}
              placeholder={`Full name — traveller ${index + 1}`}
              className="field"
            />
            {names.length > 1 && (
              <button type="button" onClick={() => setNames((list) => list.filter((_, i) => i !== index))} className="px-2 text-sm text-ink-muted" aria-label="Remove traveller">
                ✕
              </button>
            )}
          </div>
        ))}
        {departure && names.length < Math.min(10, departure.seatsLeft) && (
          <button type="button" onClick={() => setNames((list) => [...list, ''])} className="w-fit text-sm font-semibold text-acacia-600">
            + Add a traveller
          </button>
        )}
      </div>
      <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
        Your phone / WhatsApp
        <input name="phone" type="tel" required defaultValue={user?.phone ?? ''} className="field" />
      </label>
      <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
        Anything we should know (dietary needs, medical, questions)
        <textarea name="notes" className="field" maxLength={2000} />
      </label>
      <dl className="grid gap-1 rounded-xl bg-[color:var(--color-cream)] p-3 text-sm">
        <div className="flex justify-between gap-2"><dt className="text-ink-muted">{names.length} × {formatMoney({ amount: unit, currency: unitCurrency })}</dt><dd className="font-bold text-acacia-700">{formatMoney({ amount: unit * names.length, currency: unitCurrency })}</dd></div>
        {deposit ? (
          <>
            <div className="flex justify-between gap-2"><dt className="text-ink-muted">Deposit to secure {names.length === 1 ? 'your place' : 'the places'}</dt><dd className="font-semibold">{formatMoney({ amount: Math.min(deposit * names.length, unit * names.length), currency: unitCurrency })}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-ink-muted">Balance after the deposit</dt><dd className="font-semibold">{formatMoney({ amount: Math.max(0, unit * names.length - deposit * names.length), currency: unitCurrency })}</dd></div>
            <p className="text-xs text-ink-muted">The deposit is deducted from the price — never charged on top.</p>
          </>
        ) : null}
      </dl>
      <label className="flex items-start gap-2 text-sm text-ink-soft">
        <input type="checkbox" required className="mt-1" />
        <span>I accept the trip’s booking and cancellation terms shown on this page.</span>
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button disabled={busy} className="h-12 rounded-full bg-clay-400 font-bold text-acacia-700 hover:bg-clay-500 hover:text-white disabled:opacity-50">
        {busy ? 'Sending…' : 'Join Trip — continue to payment'}
      </button>
      <p className="text-xs leading-relaxed text-ink-muted">
        Next you choose how to pay. Your places are held, but the booking is confirmed only once the team verifies your payment.
      </p>
    </form>
  );
}
