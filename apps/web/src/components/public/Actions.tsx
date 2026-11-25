'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { cx } from '@/components/ui';

/** Heart-style wishlist toggle. Signed-out visitors are sent to sign in first. */
export function SaveButton({ itemType, itemId, className }: { itemType: string; itemId: string; className?: string }) {
  const { status } = useSession();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    api
      .get<string[]>('/community/saved/ids')
      .then((ids) => setSaved(ids.includes(`${itemType}:${itemId}`)))
      .catch(() => undefined);
  }, [status, itemType, itemId]);

  if (status !== 'authenticated') {
    return (
      <Link href="/signin" className={cx('chip', className)}>
        ♡ Save to wishlist
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const result = await api.post<{ saved: boolean }>('/community/saved', { itemType, itemId });
          setSaved(result.saved);
        } finally {
          setBusy(false);
        }
      }}
      className={cx('chip', saved && 'chip-active', className)}
      aria-pressed={saved}
    >
      {saved ? '♥ Saved' : '♡ Save to wishlist'}
    </button>
  );
}

export interface EnquiryFormProps {
  type: string;
  subjectType?: string;
  subjectId?: string;
  subjectTitle?: string;
  heading?: string;
  /** Ask for dates (stays, tables, catering). */
  withDates?: boolean;
  withPeople?: boolean;
  extraFields?: { name: string; label: string; placeholder?: string }[];
  messagePlaceholder?: string;
  whatsappHref: string;
}

/**
 * An enquiry to the Enhakkore team. Says plainly, before and after sending,
 * that it is not a confirmed booking.
 */
export function EnquiryForm({ type, subjectType, subjectId, subjectTitle, heading = 'Send an enquiry', withDates, withPeople, extraFields = [], messagePlaceholder, whatsappHref }: EnquiryFormProps) {
  const { user } = useSession();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [reference, setReference] = useState('');

  if (state === 'sent') {
    return (
      <div className="rounded-[1.1rem] border border-safari-100 bg-safari-50 p-5">
        <p className="font-display text-xl text-acacia-700">Enquiry received</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Reference <strong>{reference}</strong>. This is not a confirmed booking — the team will reply to confirm availability and details. For a faster answer, message us on WhatsApp.
        </p>
        <a href={whatsappHref} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex h-11 items-center rounded-full bg-[#1f9d55] px-5 text-sm font-bold text-white">
          Continue on WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError(null);
        setFields({});
        setState('sending');
        const details: Record<string, string> = {};
        for (const extra of extraFields) {
          const value = String(form.get(extra.name) ?? '').trim();
          if (value) details[extra.label] = value;
        }
        try {
          const result = await api.post<{ reference: string }>('/community/enquiries', {
            type,
            subjectType,
            subjectId,
            subjectTitle,
            name: String(form.get('name') ?? ''),
            phone: String(form.get('phone') ?? ''),
            email: String(form.get('email') ?? ''),
            startDate: String(form.get('startDate') ?? ''),
            endDate: String(form.get('endDate') ?? ''),
            people: form.get('people') ? Number(form.get('people')) : null,
            message: String(form.get('message') ?? ''),
            details,
            website: String(form.get('website') ?? ''),
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
      <p className="font-display text-xl text-acacia-700">{heading}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" label="Your name" defaultValue={user?.name} error={fields.name} required />
        <Input name="phone" label="Phone / WhatsApp" type="tel" defaultValue={user?.phone ?? ''} error={fields.phone} />
        <Input name="email" label="Email (optional)" type="email" defaultValue={user?.email} error={fields.email} />
        {withPeople && <Input name="people" label="Number of people" type="number" min={1} error={fields.people} />}
        {withDates && <Input name="startDate" label="From" type="date" error={fields.startDate} />}
        {withDates && <Input name="endDate" label="To" type="date" error={fields.endDate} />}
        {extraFields.map((extra) => (
          <Input key={extra.name} name={extra.name} label={extra.label} placeholder={extra.placeholder} />
        ))}
      </div>
      <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
        Message
        <textarea name="message" required minLength={5} className="field" placeholder={messagePlaceholder ?? 'What would you like to know?'} />
        {fields.message && <span className="text-xs text-danger">{fields.message}</span>}
      </label>
      {/* Hidden from people; bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs leading-relaxed text-ink-muted">An enquiry is not a booking. We reply to confirm availability, prices and details.</p>
      <button type="submit" disabled={state === 'sending'} className="h-12 rounded-full bg-acacia-600 font-bold text-white transition hover:bg-acacia-500 disabled:opacity-50">
        {state === 'sending' ? 'Sending…' : 'Send enquiry'}
      </button>
    </form>
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

/** Copy a number to the clipboard, with confirmation. */
export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          /* clipboard blocked: the number is on screen to copy by hand */
        }
      }}
      className="inline-flex h-9 items-center rounded-full border border-acacia-600/30 bg-white px-3.5 text-xs font-bold text-acacia-600 hover:border-acacia-600"
    >
      {done ? 'Copied ✓' : label}
    </button>
  );
}

/** Report a member or listing to the community team. */
export function ReportButton({ targetType, targetId }: { targetType: string; targetId: string }) {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  if (status !== 'authenticated') return null;
  if (sent) return <p className="text-xs text-ink-muted">Reported. Thank you.</p>;
  return open ? (
    <form
      className="grid gap-2 rounded-xl border border-line p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        await api.post('/community/reports', { targetType, targetId, reason: String(form.get('reason')), details: String(form.get('details') ?? '') });
        setSent(true);
      }}
    >
      <select name="reason" className="field" required defaultValue="">
        <option value="" disabled>
          Why are you reporting this?
        </option>
        <option>Unsafe or suspicious</option>
        <option>Harassment or abuse</option>
        <option>Spam or scam</option>
        <option>Wrong or misleading information</option>
        <option>Something else</option>
      </select>
      <textarea name="details" className="field" placeholder="Anything we should know (optional)" />
      <button className="h-10 rounded-full bg-danger text-sm font-bold text-white">Send report</button>
    </form>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-ink-muted underline underline-offset-4 hover:text-danger">
      Report
    </button>
  );
}
