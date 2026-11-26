'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { SocialIcon } from '@/components/site/SocialIcon';

interface Props {
  tripId: string;
  tripTitle: string;
  dates: { value: string; label: string }[];
  whatsapp: { display: string; digits: string }[];
}

/**
 * The two ways to ask about a trip. "Request this trip" saves a request with a
 * reference and sends the team a notice; "Chat with Enhakkore" opens WhatsApp
 * with a message already written. Neither is a booking.
 */
export function TripRequest({ tripId, tripTitle, dates, whatsapp }: Props) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [result, setResult] = useState<{ reference: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const waText = (extra = '') => encodeURIComponent(`Hello Enhakkore, I am interested in the trip "${tripTitle}".${extra} Could you tell me about availability and how to secure a place?`);

  if (state === 'sent' && result) {
    return (
      <div className="rounded-xl border border-safari-100 bg-safari-50 p-4">
        <p className="font-display text-xl text-acacia-700">Request received ✓</p>
        <p className="mt-1 text-sm text-ink-soft">Reference <strong>{result.reference}</strong>. {result.message}</p>
        {whatsapp[0] && (
          <a href={`https://wa.me/${whatsapp[0].digits}?text=${waText(` My request reference is ${result.reference}.`)}`} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-[#1f9d55] px-4 text-sm font-bold text-white">
            <SocialIcon platform="whatsapp" size={16} /> Send the reference on WhatsApp
          </a>
        )}
        {user && <p className="mt-2 text-xs text-ink-muted">You can follow it in <Link href="/account/enquiries" className="underline">My account → Enquiries</Link>.</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-2.5">
      <button type="button" onClick={() => setOpen((value) => !value)} className="h-12 rounded-full bg-acacia-600 font-bold text-white hover:bg-acacia-500" aria-expanded={open}>
        {open ? 'Close the form' : 'Request this trip'}
      </button>
      {open && (
        <form
          className="grid gap-2.5 rounded-xl border border-line bg-[#faf8f3] p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const get = (name: string) => String(form.get(name) ?? '').trim();
            setState('sending');
            setError(null);
            setFields({});
            try {
              const response = await api.post<{ reference: string; message: string }>('/community/enquiries', {
                type: 'TRIP',
                subjectType: 'TRIP',
                subjectId: tripId,
                subjectTitle: tripTitle,
                name: get('name'),
                phone: get('phone'),
                email: get('email'),
                people: get('people') ? Number(get('people')) : null,
                message: get('requests') || `Request for ${tripTitle}.`,
                details: { preferredDate: get('date'), additional: get('additional') },
                website: get('website'),
              });
              setResult(response);
              setState('sent');
            } catch (caught) {
              setState('idle');
              if (caught instanceof ApiError) {
                setError(caught.message);
                setFields(caught.fields);
              } else setError('Could not send. Check your connection, or use WhatsApp below.');
            }
          }}
        >
          <F label="Full name" name="name" defaultValue={user?.name} error={fields.name} required />
          <F label="Phone / WhatsApp" name="phone" type="tel" defaultValue={user?.phone ?? ''} error={fields.phone} required />
          <F label="Email (optional)" name="email" type="email" defaultValue={user?.email} error={fields.email} />
          <div className="grid grid-cols-2 gap-2.5">
            <F label="Travellers" name="people" type="number" min={1} max={100} defaultValue="1" error={fields.people} required />
            <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
              Preferred date
              <select name="date" className="field">
                {dates.map((date) => <option key={date.value} value={date.label}>{date.label}</option>)}
                <option value="Flexible">Flexible</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">Special requests<textarea name="requests" className="field" placeholder="Dietary needs, room sharing, accessibility…" /></label>
          <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">Additional information<textarea name="additional" className="field" /></label>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          {error && <p className="text-sm text-danger">{error}</p>}
          <p className="text-xs text-ink-muted">A request is not a booking. See the <Link href="/legal/travel" className="underline">travel booking terms</Link>.</p>
          <button disabled={state === 'sending'} className="h-11 rounded-full bg-clay-400 font-bold text-acacia-700 disabled:opacity-50">{state === 'sending' ? 'Sending…' : 'Send request'}</button>
        </form>
      )}
      <p className="pt-1 text-center text-xs font-semibold uppercase tracking-wider text-ink-muted">or chat with Enhakkore</p>
      {whatsapp.map((number) => (
        <a key={number.digits} href={`https://wa.me/${number.digits}?text=${waText()}`} target="_blank" rel="noreferrer noopener" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#1f9d55] text-sm font-bold text-white">
          <SocialIcon platform="whatsapp" size={18} /> WhatsApp {number.display}
        </a>
      ))}
    </div>
  );
}

function F({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
      {label}
      <input className="field" {...props} />
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}
