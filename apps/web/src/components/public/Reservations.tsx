'use client';

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
function withSummary(href: string, kind: 'ROOM' | 'TABLE', reference: string, summary: string) {
  try {
    const url = new URL(href);
    const intro = kind === 'ROOM' ? 'Hello Enhakkore, I sent a hotel enquiry' : 'Hello Enhakkore, I sent a table reservation request';
    url.searchParams.set('text', `${intro} — reference ${reference}.\n${summary}`.trim());
    return url.toString();
  } catch {
    return href;
  }
}

function Sent({ reference, kind, whatsappHref, notice, summary, duplicate, message }: { reference: string; kind: 'ROOM' | 'TABLE'; whatsappHref: string; notice: string | null; summary: string; duplicate?: boolean; message?: string }) {
  return (
    <div className="rounded-[1.1rem] border border-safari-100 bg-safari-50 p-5">
      <p className="font-display text-xl text-acacia-700">{kind === 'ROOM' ? 'Enquiry received' : 'Request received'}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        {duplicate && <>{message} </>}
        Reference <strong>{reference}</strong>.{' '}
        {kind === 'ROOM'
          ? 'This is a request, not a booking — no room is reserved until the property confirms availability and price.'
          : 'Your table is not confirmed until the restaurant accepts the request. We will tell you as soon as it does.'}
      </p>
      {notice !== 'SENT' && <p className="mt-2 text-xs text-ink-muted">For the quickest reply, send the reference to us on WhatsApp too. Opening WhatsApp does not send anything until you press send there.</p>}
      <p className="mt-2 text-xs text-ink-muted">Signed-in members can follow it under My account → Enquiries.</p>
      <a href={withSummary(whatsappHref, kind, reference, summary)} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex h-11 items-center rounded-full bg-[#1f9d55] px-5 text-sm font-bold text-white">
        Continue on WhatsApp
      </a>
    </div>
  );
}

function useSubmit(kind: 'ROOM' | 'TABLE') {
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
  const { user } = useSession();
  const { state, error, fields, result, submit } = useSubmit('ROOM');
  if (state === 'sent' && result) return <Sent {...result} kind="ROOM" whatsappHref={whatsappHref} />;
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
      <p className="font-display text-xl text-acacia-700">Hotel enquiry</p>
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
        <Input name="email" label="Email (optional)" type="email" defaultValue={user?.email} error={fields.email} />
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
        {state === 'sending' ? 'Sending…' : 'Send hotel enquiry'}
      </button>
    </form>
  );
}

export function RestaurantReservationForm({ placeId, placeName, whatsappHref }: Props) {
  const { user } = useSession();
  const { state, error, fields, result, submit } = useSubmit('TABLE');
  if (state === 'sent' && result) return <Sent {...result} kind="TABLE" whatsappHref={whatsappHref} />;
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
