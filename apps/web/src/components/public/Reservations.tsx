'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

/**
 * Enhakkore Enquiries & Reservations — the hotel enquiry and the restaurant
 * reservation request. Both are saved with a reference and sent to the team;
 * neither ever claims a room or a table is available. That is confirmed by the
 * property and passed on to the customer.
 */

interface Props {
  placeId: string;
  placeName: string;
  roomTypes?: string[];
  whatsappHref: string;
}

type Kind = 'ROOM' | 'TABLE' | 'VENUE';
const KIND_TEXT: Record<Kind, { sent: string; note: string; intro: string }> = {
  ROOM: { sent: 'Hotel request submitted', note: 'This is a request, not a booking — no room is reserved until the hotel confirms availability and price to the Enhakkore team.', intro: 'Hello Enhakkore, I sent a hotel reservation request' },
  TABLE: { sent: 'Reservation request submitted', note: 'Your table is not confirmed until the restaurant accepts it. You will be notified as soon as it does.', intro: 'Hello Enhakkore, I sent a table reservation request' },
  VENUE: { sent: 'Venue enquiry submitted', note: 'The venue is not reserved until the team confirms the date, price and terms with the venue.', intro: 'Hello Enhakkore, I sent a venue enquiry' },
};

/** Reservation requests need an account so they can be followed in the Account Centre. */
function SignInFirst({ what }: { what: string }) {
  const path = usePathname();
  const next = encodeURIComponent(`${path}#book`);
  return (
    <div className="rounded-[1.1rem] border border-line bg-[color:var(--color-cream)] p-5">
      <p className="font-display text-xl text-acacia-700">{what}</p>
      <p className="mt-2 text-sm text-ink-soft">Sign in or create a free account to send a request. You can then follow its status, reference and confirmation in your Account Centre.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/signin?next=${next}`} className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Sign in</Link>
        <Link href={`/join?next=${next}`} className="inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-semibold text-acacia-700">Create account</Link>
      </div>
    </div>
  );
}

function Input({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
      {label}
      <input className="field" {...props} />
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}

/** The WhatsApp link, with the reference and a short summary written into the message. */
function withSummary(href: string, kind: Kind, reference: string, summary: string) {
  try {
    const url = new URL(href);
    const intro = KIND_TEXT[kind].intro;
    url.searchParams.set('text', `${intro} — reference ${reference}.\n${summary}`.trim());
    return url.toString();
  } catch {
    return href;
  }
}

function Sent({ reference, kind, whatsappHref, summary, duplicate, message }: { reference: string; kind: Kind; whatsappHref: string; notice: string | null; summary: string; duplicate?: boolean; message?: string }) {
  return (
    <div className="rounded-[1.1rem] border border-safari-100 bg-safari-50 p-5" role="status">
      <p className="font-display text-xl text-acacia-700">{KIND_TEXT[kind].sent}</p>
      <p className="mt-2 text-sm text-ink-soft">Reference <strong className="font-mono">{reference}</strong> · Status: <strong>Request submitted</strong></p>
      {duplicate && <p className="mt-1 text-sm text-ink-soft">{message}</p>}
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{KIND_TEXT[kind].note}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/account/enquiries" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">View in My Reservations</Link>
        <a href={withSummary(whatsappHref, kind, reference, summary)} target="_blank" rel="noreferrer noopener" className="inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-semibold text-[#14653a]">
          Optional: follow up on WhatsApp
        </a>
      </div>
      <p className="mt-2 text-xs text-ink-muted">The team has already received your request. WhatsApp is only for follow-up questions; opening it sends nothing until you press send.</p>
    </div>
  );
}

function useSubmit(kind: Kind) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ reference: string; notice: string | null; duplicate?: boolean; message?: string; summary: string } | null>(null);
  const sending = useRef(false);
  const submit = async (body: Record<string, unknown>) => {
    // One request at a time: a double tap must not send it twice.
    if (sending.current) return;
    sending.current = true;
    setError(null);
    setFields({});
    setState('sending');
    try {
      const response = await api.post<{ reference: string; notice: string | null; duplicate?: boolean; message?: string }>('/community/enquiries', { type: kind, subjectType: 'PLACE', ...body });
      const summary = [body.subjectTitle, body.startDate && `Date: ${body.startDate}${body.endDate ? ` to ${body.endDate}` : ''}`, body.people && `People: ${body.people}`, body.name && `Name: ${body.name}`].filter(Boolean).join('\n');
      setResult({ ...response, summary });
      setState('sent');
    } catch (caught) {
      setState('idle');
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFields(caught.fields);
      } else setError('Could not send. Check your connection, or message us on WhatsApp.');
    } finally {
      sending.current = false;
    }
  };
  return { state, error, fields, result, submit };
}

export function HotelEnquiryForm({ placeId, placeName, roomTypes = [], whatsappHref }: Props) {
  const { user, status } = useSession();
  const { state, error, fields, result, submit } = useSubmit('ROOM');
  if (state === 'sent' && result) return <Sent {...result} kind="ROOM" whatsappHref={whatsappHref} />;
  if (status !== 'authenticated') return <SignInFirst what="Request a hotel reservation" />;
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const get = (name: string) => String(form.get(name) ?? '').trim();
        const adults = Number(get('adults') || 0);
        const children = Number(get('children') || 0);
        void submit({
          subjectId: placeId,
          subjectTitle: placeName,
          name: get('name'),
          phone: get('phone'),
          email: get('email'),
          startDate: get('checkIn'),
          endDate: get('checkOut'),
          people: adults + children || null,
          message: get('requests') || `Hotel enquiry for ${placeName}.`,
          details: {
            adults: String(adults),
            children: String(children),
            rooms: get('rooms'),
            roomType: get('roomType'),
            additional: get('additional'),
          },
          website: get('website'),
        });
      }}
    >
      <p className="font-display text-xl text-acacia-700">Request a reservation</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="checkIn" label="Check-in" type="date" required error={fields.startDate} />
        <Input name="checkOut" label="Check-out" type="date" required error={fields.endDate} />
        <Input name="adults" label="Adults" type="number" min={1} max={100} defaultValue={2} required />
        <Input name="children" label="Children" type="number" min={0} max={100} defaultValue={0} />
        <Input name="rooms" label="Rooms" type="number" min={1} max={50} defaultValue={1} required />
        <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
          Preferred room type
          {roomTypes.length ? (
            <select name="roomType" className="field" defaultValue="">
              <option value="">No preference</option>
              {roomTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          ) : (
            <input name="roomType" className="field" placeholder="e.g. Double, twin, family" />
          )}
        </label>
        <Input name="name" label="Full name" defaultValue={user?.name} required error={fields.name} />
        <Input name="phone" label="Phone / WhatsApp" type="tel" defaultValue={user?.phone ?? ''} required error={fields.phone} />
        <Input name="email" label="Email" type="email" defaultValue={user?.email} required error={fields.email} />
      </div>
      <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
        Special requests
        <textarea name="requests" className="field" placeholder="Sea view, airport pick-up, accessible room…" />
      </label>
      <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
        Anything else
        <textarea name="additional" className="field" />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs leading-relaxed text-ink-muted">Sending an enquiry is free. It is not a booking: availability and price are confirmed by the property.</p>
      <button type="submit" disabled={state === 'sending'} className="h-12 rounded-full bg-acacia-600 font-bold text-white transition hover:bg-acacia-500 disabled:opacity-50">
        {state === 'sending' ? 'Sending…' : 'Submit request'}
      </button>
    </form>
  );
}

export function RestaurantReservationForm({ placeId, placeName, whatsappHref }: Props) {
  const { user, status } = useSession();
  const { state, error, fields, result, submit } = useSubmit('TABLE');
  if (state === 'sent' && result) return <Sent {...result} kind="TABLE" whatsappHref={whatsappHref} />;
  if (status !== 'authenticated') return <SignInFirst what="Reserve a table" />;
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const get = (name: string) => String(form.get(name) ?? '').trim();
        void submit({
          subjectId: placeId,
          subjectTitle: placeName,
          name: get('name'),
          phone: get('phone'),
          email: get('email'),
          startDate: get('date'),
          people: get('guests') ? Number(get('guests')) : null,
          message: get('requests') || `Table reservation request at ${placeName}.`,
          details: { time: get('time') },
          website: get('website'),
        });
      }}
    >
      <p className="font-display text-xl text-acacia-700">Reserve a table</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="date" label="Preferred date" type="date" required error={fields.startDate} />
        <Input name="time" label="Preferred time" type="time" required error={fields.time} />
        <Input name="guests" label="Number of guests" type="number" min={1} max={500} defaultValue={2} required error={fields.people} />
        <Input name="name" label="Full name" defaultValue={user?.name} required error={fields.name} />
        <Input name="phone" label="Phone / WhatsApp" type="tel" defaultValue={user?.phone ?? ''} required error={fields.phone} />
        <Input name="email" label="Email (optional)" type="email" defaultValue={user?.email} error={fields.email} />
      </div>
      <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
        Special requests
        <textarea name="requests" className="field" placeholder="Birthday, high chair, outdoor table…" />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs leading-relaxed text-ink-muted">A request is not a confirmed table until the restaurant accepts it.</p>
      <button type="submit" disabled={state === 'sending'} className="h-12 rounded-full bg-acacia-600 font-bold text-white transition hover:bg-acacia-500 disabled:opacity-50">
        {state === 'sending' ? 'Sending…' : 'Request a table'}
      </button>
    </form>
  );
}

const EVENT_TYPES = ['Wedding', 'Conference / meeting', 'Birthday', 'Party', 'Corporate event', 'Graduation', 'Other'];

/** Venue enquiry: event type, date, guests, location, budget and requirements. */
export function VenueEnquiryForm({ placeId, placeName, whatsappHref }: Props) {
  const { user, status } = useSession();
  const { state, error, fields, result, submit } = useSubmit('VENUE');
  if (state === 'sent' && result) return <Sent {...result} kind="VENUE" whatsappHref={whatsappHref} />;
  if (status !== 'authenticated') return <SignInFirst what="Enquire about this venue" />;
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const get = (name: string) => String(form.get(name) ?? '').trim();
        void submit({
          subjectId: placeId,
          subjectTitle: placeName,
          name: get('name'),
          phone: get('phone'),
          email: get('email'),
          startDate: get('date'),
          people: get('guests') ? Number(get('guests')) : null,
          message: get('requirements') || `Venue enquiry for ${placeName}.`,
          details: { eventType: get('eventType'), location: get('location'), budget: get('budget') },
          website: get('website'),
        });
      }}
    >
      <p className="font-display text-xl text-acacia-700">Venue enquiry</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
          Event type
          <select name="eventType" className="field" required defaultValue="">
            <option value="" disabled>Choose</option>
            {EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
          {fields.eventType && <span className="text-xs text-danger">{fields.eventType}</span>}
        </label>
        <Input name="date" label="Event date" type="date" required error={fields.startDate} />
        <Input name="guests" label="Number of guests" type="number" min={1} max={100000} required error={fields.people} />
        <Input name="location" label="Location" defaultValue={placeName} />
        <Input name="budget" label="Budget (optional)" placeholder="e.g. TZS 5,000,000" />
        <Input name="name" label="Full name" defaultValue={user?.name} required error={fields.name} />
        <Input name="phone" label="Phone / WhatsApp" type="tel" defaultValue={user?.phone ?? ''} required error={fields.phone} />
        <Input name="email" label="Email" type="email" defaultValue={user?.email} required error={fields.email} />
      </div>
      <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
        Venue requirements
        <textarea name="requirements" className="field" placeholder="Layout, catering, sound system, decoration, parking…" />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs leading-relaxed text-ink-muted">An enquiry is not a booking. The team confirms availability, price and terms with the venue.</p>
      <button type="submit" disabled={state === 'sending'} className="h-12 rounded-full bg-acacia-600 font-bold text-white transition hover:bg-acacia-500 disabled:opacity-50">
        {state === 'sending' ? 'Sending…' : 'Send venue enquiry'}
      </button>
    </form>
  );
}
