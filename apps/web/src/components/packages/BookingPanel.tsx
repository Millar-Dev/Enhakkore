'use client';

import { useState } from 'react';
import type { Money } from '@enhakkore/shared';
import { Alert, Button, Icon, cx } from '@/components/ui';
import { Input, Select, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api';
import { price } from '@/lib/format';

/* ==========================================================================
   Price, and asking for a place
   --------------------------------------------------------------------------
   One panel for every package. A trip with a single price shows that price; a
   trip with more than one shows them all at once and lets the traveller say
   which they are — and whichever they chose travels with the enquiry, so the
   organiser receives the figure the traveller was actually looking at.

   Where a package quotes two currencies they are two prices, not a conversion
   of one another, and this never presents one as derived from the other.

   The form creates a real enquiry through the same endpoint the private-trip
   form uses, so submissions land in the admin queue rather than disappearing.
   It reserves nothing and takes no money, and it says so: a form that implies
   a confirmed seat is worse than no form at all.
   ========================================================================== */

export interface BookingTier {
  id: string;
  label: string;
  note: string;
  amount: Money;
}

export interface BookingPackage {
  title: string;
  subtitle?: string;
  destination: string;
  datesLabel: string;
  startDate?: string;
  endDate?: string;
  tiers: BookingTier[];
  /** Cap on the travellers field — the planned group size where there is one. */
  maxTravellers?: number;
}

export function BookingPanel({ pkg, className }: { pkg: BookingPackage; className?: string }) {
  const [tierId, setTierId] = useState(pkg.tiers[0]!.id);
  const [form, setForm] = useState({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    travellers: 1,
    preferredContact: 'WhatsApp',
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const max = pkg.maxTravellers ?? 20;
  const chosen = pkg.tiers.find((tier) => tier.id === tierId) ?? pkg.tiers[0]!;
  const total = { amount: chosen.amount.amount * form.travellers, currency: chosen.amount.currency };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.contactEmail.trim() && !form.contactPhone.trim()) {
      setFields({ contactEmail: 'Leave an email address or a phone number so we can reply.' });
      return;
    }

    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api.post('/requests', {
        destination: `${pkg.title} — ${pkg.destination}`,
        startDate: pkg.startDate,
        endDate: pkg.endDate,
        travellers: form.travellers,
        budget: chosen.amount.amount * form.travellers,
        currency: chosen.amount.currency,
        contactName: form.contactName,
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
        activities: [`${pkg.title} ${pkg.datesLabel}`],
        notes: [
          `Package: ${pkg.title}${pkg.subtitle ? ` — ${pkg.subtitle}` : ''} (${pkg.datesLabel})`,
          pkg.tiers.length > 1 && `Traveller category: ${chosen.label}`,
          `Price shown: ${price(chosen.amount)} per person`,
          `Preferred contact: ${form.preferredContact}`,
          form.notes && `Message: ${form.notes}`,
        ]
          .filter(Boolean)
          .join('\n'),
      });
      setDone(true);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFields(caught.fields);
      } else {
        setError('We could not send that enquiry. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div
        className={cx(
          'rounded-[var(--radius-card)] border border-acacia-100 bg-acacia-50 p-7 text-center',
          className,
        )}
      >
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-acacia-600 text-white">
          <Icon.check size={22} />
        </span>
        <h3 className="mt-4 text-[1.125rem] font-bold tracking-tight">Your enquiry is with the organiser</h3>
        <p className="mx-auto mt-2 max-w-md text-[0.9375rem] leading-relaxed text-ink-muted">
          Nothing is reserved yet and no money has been taken. The organiser will be in touch about whether
          places are still open, and how to pay.
        </p>
        <Button variant="secondary" className="mt-5" onClick={() => setDone(false)}>
          Send another enquiry
        </Button>
      </div>
    );
  }

  return (
    <div className={cx('rounded-[var(--radius-card)] border border-line bg-white p-6 md:p-7', className)}>
      {pkg.tiers.length > 1 && (
        <fieldset>
          <legend className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            I am travelling as
          </legend>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {pkg.tiers.map((tier) => {
              const selected = tier.id === tierId;
              return (
                <button
                  key={tier.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTierId(tier.id)}
                  className={cx(
                    'rounded-[var(--radius-field)] border px-3 py-3 text-left transition-all duration-200',
                    'focus:outline-none focus-visible:ring-4 focus-visible:ring-gold-500/25',
                    selected
                      ? 'border-navy-700 bg-navy-700 text-white shadow-sm'
                      : 'border-line-strong bg-white hover:border-navy-500',
                  )}
                >
                  <span className="block text-[0.875rem] font-bold leading-tight">{tier.label}</span>
                  <span
                    className={cx(
                      'mt-0.5 block text-[0.75rem] leading-tight',
                      selected ? 'text-white/70' : 'text-ink-muted',
                    )}
                  >
                    {tier.note}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className={cx('rounded-[var(--radius-field)] bg-sand p-5', pkg.tiers.length > 1 && 'mt-5')}>
        <p className="text-[2rem] font-bold leading-none tracking-tight text-navy-700 md:text-[2.25rem]">
          {price(chosen.amount)}
        </p>
        <p className="mt-1.5 text-[0.875rem] text-ink-muted">
          per person{pkg.tiers.length > 1 ? ` · ${chosen.label}` : ''}
        </p>

        {form.travellers > 1 && (
          <p className="mt-3 text-[0.875rem] text-ink">
            {form.travellers} travellers · <span className="font-bold">{price(total)}</span> total
          </p>
        )}

        {pkg.tiers.length > 1 && (
          <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-[0.8125rem]">
            {pkg.tiers.map((tier) => (
              <div key={tier.id} className="flex items-baseline justify-between gap-4">
                <dt className={cx('text-ink-muted', tier.id === tierId && 'font-semibold text-ink')}>
                  {tier.label}
                </dt>
                <dd className={cx('tabular-nums text-ink-muted', tier.id === tierId && 'font-bold text-ink')}>
                  {price(tier.amount)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <h3 className="text-[1rem] font-bold tracking-tight">Book your place</h3>

        {error && (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        )}

        <Input
          label="Full name"
          required
          value={form.contactName}
          onChange={(event) => setForm({ ...form, contactName: event.target.value })}
          error={fields.contactName}
          autoComplete="name"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Phone"
            value={form.contactPhone}
            onChange={(event) => setForm({ ...form, contactPhone: event.target.value })}
            error={fields.contactPhone}
            placeholder="+255 7XX XXX XXX"
            autoComplete="tel"
            hint="Phone or email — whichever suits you."
          />
          <Input
            label="Email"
            type="email"
            value={form.contactEmail}
            onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
            error={fields.contactEmail}
            autoComplete="email"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Number of travellers"
            type="number"
            min={1}
            max={max}
            required
            value={form.travellers}
            onChange={(event) =>
              setForm({ ...form, travellers: Math.max(1, Math.min(max, Number(event.target.value) || 1)) })
            }
          />
          <Select
            label="Preferred contact method"
            value={form.preferredContact}
            onChange={(event) => setForm({ ...form, preferredContact: event.target.value })}
          >
            <option>WhatsApp</option>
            <option>Phone call</option>
            <option>SMS</option>
            <option>Email</option>
          </Select>
        </div>

        <Textarea
          label="Message"
          hint="Optional — anything the organiser should know."
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          maxLength={1000}
          rows={3}
        />

        <Button type="submit" size="lg" full disabled={busy}>
          {busy ? 'Sending…' : 'Send booking request'}
        </Button>

        <p className="text-[0.75rem] leading-relaxed text-ink-faint">
          This sends your details to the trip organiser. It does not reserve a place and takes no payment —
          your place is confirmed once the organiser has checked your payment.
        </p>
      </form>
    </div>
  );
}
