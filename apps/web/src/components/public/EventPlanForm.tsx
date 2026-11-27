'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

const SERVICES = ['Catering', 'Decoration', 'Photography / video', 'Entertainment', 'Equipment (sound, lights, tents)', 'Venue booking', 'Transport', 'Other services'];

/** The guided event-planning request. Sending it is free; planning services may be chargeable. */
export function EventPlanForm({ whatsappHref }: { whatsappHref: string }) {
  const { user } = useSession();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  if (state === 'sent') {
    return (
      <div className="rounded-[1.2rem] border border-safari-100 bg-safari-50 p-6">
        <p className="font-display text-2xl text-acacia-700">Request received — {reference}</p>
        <p className="mt-2 text-ink-soft">The Enhakkore events team will contact you to talk through your event and, if you would like, prepare a quotation. Nothing is booked or charged yet.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={whatsappHref} target="_blank" rel="noreferrer noopener" className="inline-flex h-11 items-center rounded-full bg-[#1f9d55] px-5 text-sm font-bold text-white">Continue on WhatsApp</a>
          {user && <Link href="/account/experiences" className="inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-semibold">My event plans</Link>}
        </div>
      </div>
    );
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const get = (name: string) => String(form.get(name) ?? '').trim();
        setState('sending');
        setError(null);
        setFields({});
        try {
          const result = await api.post<{ reference: string }>('/community/enquiries', {
            type: 'EVENT_PLAN',
            subjectTitle: get('eventType') || 'Event planning',
            name: get('name'),
            phone: get('phone'),
            email: get('email'),
            startDate: get('date'),
            people: get('guests') ? Number(get('guests')) : null,
            message: get('requirements') || `Help planning: ${get('eventType')}.`,
            details: {
              eventType: get('eventType'),
              location: get('location'),
              duration: get('duration'),
              budget: get('budget'),
              style: get('style'),
              haveVenue: get('haveVenue'),
              services: form.getAll('services').map(String).join(', '),
            },
            website: get('website'),
          });
          setReference(result.reference);
          setState('sent');
        } catch (caught) {
          setState('idle');
          if (caught instanceof ApiError) {
            setError(caught.message);
            setFields(caught.fields);
          } else setError('Could not send. Check your connection, or message us on WhatsApp.');
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <L label="What kind of event?">
          <select name="eventType" className="field" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {['Birthday', 'Wedding or engagement', 'Corporate / team event', 'Product launch', 'Party', 'Conference or workshop', 'Graduation', 'Community event', 'Other'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </L>
        <L label="Where (city or area)"><input name="location" className="field" required placeholder="Dar es Salaam, Masaki" /></L>
        <L label="Preferred date" error={fields.startDate}><input name="date" type="date" className="field" /></L>
        <L label="How long?"><input name="duration" className="field" placeholder="An evening, a full day, a weekend…" /></L>
        <L label="Number of guests" error={fields.people}><input name="guests" type="number" min={1} className="field" /></L>
        <L label="Budget (with currency)"><input name="budget" className="field" placeholder="e.g. TZS 2,000,000" /></L>
        <L label="Do you already have a venue?">
          <select name="haveVenue" className="field" defaultValue="">
            <option value="">Not sure</option>
            <option>Yes</option>
            <option>No — please suggest one</option>
          </select>
        </L>
        <L label="Style and theme"><input name="style" className="field" placeholder="Elegant, beach, traditional, neon…" /></L>
      </div>
      <fieldset>
        <legend className="text-[0.8125rem] font-semibold text-ink-soft">Services you may need</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SERVICES.map((service) => (
            <label key={service} className="chip h-auto min-h-10 max-w-full cursor-pointer whitespace-normal py-1.5">
              <input type="checkbox" name="services" value={service} className="mr-1.5" /> {service}
            </label>
          ))}
        </div>
      </fieldset>
      <L label="Anything else we should know" error={fields.message}><textarea name="requirements" className="field" placeholder="Requirements, ideas, must-haves…" /></L>
      <div className="grid gap-3 sm:grid-cols-3">
        <L label="Your name" error={fields.name}><input name="name" className="field" required defaultValue={user?.name} /></L>
        <L label="Phone / WhatsApp" error={fields.phone}><input name="phone" type="tel" className="field" defaultValue={user?.phone ?? ''} /></L>
        <L label="Email (optional)" error={fields.email}><input name="email" type="email" className="field" defaultValue={user?.email} /></L>
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs leading-relaxed text-ink-muted">Sending this request is free. Enhakkore’s event planning and hosting services may be chargeable — any price is agreed with you before work starts.</p>
      <button disabled={state === 'sending'} className="h-12 rounded-full bg-acacia-600 font-bold text-white disabled:opacity-50">{state === 'sending' ? 'Sending…' : 'Send my event request'}</button>
    </form>
  );
}

function L({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
      {label}
      {children}
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}
