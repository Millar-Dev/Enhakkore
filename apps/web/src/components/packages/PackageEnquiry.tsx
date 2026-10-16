'use client';

import { useState } from 'react';
import { ARUSHA, type PricingTier } from '@/content/arusha';
import { Alert, Button, Icon, cx } from '@/components/ui';
import { Input, Select, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api';
import { price } from '@/lib/format';

/* ==========================================================================
   Price, and asking about a place
   --------------------------------------------------------------------------
   The two prices are not a conversion of one another: TZS 270,000 is the
   resident price and USD 250 is the international price, each quoted in its
   own right. Choosing a category changes which one is shown AND which one is
   carried into the enquiry, so the organiser receives the figure the traveller
   was actually looking at.

   The form creates a real enquiry through the same endpoint the private-trip
   form uses, so submissions land in the admin queue rather than disappearing.
   It books nothing and takes no money — it says so, because a form that
   implies a confirmed seat is worse than no form.
   ========================================================================== */

const TIERS: { id: PricingTier; label: string; note: string }[] = [
  { id: 'resident', label: ARUSHA.pricing.resident.label, note: ARUSHA.pricing.resident.note },
  { id: 'nonResident', label: ARUSHA.pricing.nonResident.label, note: ARUSHA.pricing.nonResident.note },
];

export function PackageEnquiry() {
  const [tier, setTier] = useState<PricingTier>('resident');
  const [form, setForm] = useState({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    travellers: 1,
    preferredContact: 'Phone call',
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const chosen = ARUSHA.pricing[tier];
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
        destination: `${ARUSHA.title} — ${ARUSHA.destination}`,
        startDate: ARUSHA.startDate,
        endDate: ARUSHA.endDate,
        travellers: form.travellers,
        budget: chosen.amount.amount * form.travellers,
        currency: chosen.amount.currency,
        contactName: form.contactName,
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
        activities: ['Arusha Escape 18–20 December 2026'],
        notes: [
          `Package: ${ARUSHA.title} — ${ARUSHA.subtitle} (${ARUSHA.datesLabel})`,
          `Traveller category: ${chosen.label}`,
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
      <div className="rounded-[var(--radius-card)] border border-acacia-100 bg-acacia-50 p-7 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-acacia-600 text-white">
          <Icon.check size={22} />
        </span>
        <h3 className="mt-4 text-[1.125rem] font-bold tracking-tight">Your enquiry is with the organiser</h3>
        <p className="mx-auto mt-2 max-w-md text-[0.9375rem] leading-relaxed text-ink-muted">
          Nothing is reserved yet and no money has been taken. The organiser will be in touch to confirm
          whether places are still open, and how to pay.
        </p>
        <Button variant="secondary" className="mt-5" onClick={() => setDone(false)}>
          Send another enquiry
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 md:p-7">
      {/* ---- Price ---- */}
      <fieldset>
        <legend className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          I am travelling as
        </legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {TIERS.map((option) => {
            const selected = option.id === tier;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setTier(option.id)}
                className={cx(
                  'rounded-[var(--radius-field)] border px-3 py-3 text-left transition-all duration-200',
                  'focus:outline-none focus-visible:ring-4 focus-visible:ring-gold-500/25',
                  selected
                    ? 'border-navy-700 bg-navy-700 text-white shadow-sm'
                    : 'border-line-strong bg-white hover:border-navy-500',
                )}
              >
                <span className="block text-[0.875rem] font-bold leading-tight">{option.label}</span>
                <span
                  className={cx(
                    'mt-0.5 block text-[0.75rem] leading-tight',
                    selected ? 'text-white/70' : 'text-ink-muted',
                  )}
                >
                  {option.note}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5 rounded-[var(--radius-field)] bg-sand p-5">
        <p className="text-[2rem] font-bold leading-none tracking-tight text-navy-700 md:text-[2.25rem]">
          {price(chosen.amount)}
        </p>
        <p className="mt-1.5 text-[0.875rem] text-ink-muted">per person · {chosen.label}</p>
        {form.travellers > 1 && (
          <p className="mt-3 text-[0.875rem] text-ink">
            {form.travellers} travellers · <span className="font-bold">{price(total)}</span> total
          </p>
        )}

        {/* Both prices stay on screen. They are two separate prices, not one
            converted into the other, so neither is ever derived from the other
            or shown with an exchange rate. */}
        <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-[0.8125rem]">
          {TIERS.map((option) => (
            <div key={option.id} className="flex items-baseline justify-between gap-4">
              <dt className={cx('text-ink-muted', option.id === tier && 'font-semibold text-ink')}>
                {option.label}
              </dt>
              <dd className={cx('tabular-nums text-ink-muted', option.id === tier && 'font-bold text-ink')}>
                {price(ARUSHA.pricing[option.id].amount)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ---- Enquiry ---- */}
      <form onSubmit={submit} className="mt-6 space-y-4">
        <h3 className="text-[1rem] font-bold tracking-tight">Enquire about this package</h3>

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

        {/* Either one will do. Asking for an address someone does not use is
            how an enquiry gets abandoned halfway. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Email"
            type="email"
            value={form.contactEmail}
            onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
            error={fields.contactEmail}
            autoComplete="email"
            hint="Email or phone — whichever suits you."
          />
          <Input
            label="Phone"
            value={form.contactPhone}
            onChange={(event) => setForm({ ...form, contactPhone: event.target.value })}
            error={fields.contactPhone}
            placeholder="+255 7XX XXX XXX"
            autoComplete="tel"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Number of travellers"
            type="number"
            min={1}
            max={28}
            required
            value={form.travellers}
            onChange={(event) =>
              setForm({ ...form, travellers: Math.max(1, Math.min(28, Number(event.target.value) || 1)) })
            }
          />
          <Select
            label="Preferred contact method"
            value={form.preferredContact}
            onChange={(event) => setForm({ ...form, preferredContact: event.target.value })}
          >
            <option>Phone call</option>
            <option>WhatsApp</option>
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
          {busy ? 'Sending…' : 'Send enquiry'}
        </Button>

        <p className="text-[0.75rem] leading-relaxed text-ink-faint">
          This sends an enquiry to the trip organiser. It does not reserve a place and takes no payment.
        </p>
      </form>
    </div>
  );
}
