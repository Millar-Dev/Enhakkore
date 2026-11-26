'use client';

import { useState } from 'react';
import { PARTNER_CATEGORIES } from '@enhakkore/shared';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

/** A business applies to be listed, promoted or to partner. Nothing is published by the business itself. */
export function PartnerForm({ whatsappHref }: { whatsappHref: string }) {
  const { user } = useSession();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  if (state === 'sent') {
    return (
      <div className="rounded-[1.2rem] border border-safari-100 bg-safari-50 p-6">
        <p className="font-display text-2xl text-acacia-700">Application received — {reference}</p>
        <p className="mt-2 text-ink-soft">Thank you. The Enhakkore team reviews every business before anything is published, and will contact you about verification and the next steps.</p>
        <a href={whatsappHref} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex h-11 items-center rounded-full bg-[#1f9d55] px-5 text-sm font-bold text-white">Continue on WhatsApp</a>
      </div>
    );
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const get = (name: string) => String(form.get(name) ?? '').trim();
        setState('sending');
        setError(null);
        setFields({});
        try {
          const result = await api.post<{ reference: string }>('/community/enquiries', {
            type: 'PARTNERSHIP',
            subjectTitle: get('businessName'),
            name: get('contactName'),
            phone: get('phone'),
            email: get('email'),
            message: get('description') || `Partnership enquiry from ${get('businessName')}.`,
            details: {
              businessName: get('businessName'),
              category: get('category'),
              location: get('location'),
              links: get('links'),
              interest: get('interest'),
              additional: get('additional'),
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
          } else setError('Could not send. Check your connection, or use WhatsApp.');
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <L label="Business name" error={fields.businessName}><input name="businessName" className="field" required maxLength={160} /></L>
        <L label="Business category">
          <select name="category" className="field" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {PARTNER_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
        </L>
        <L label="Contact person" error={fields.name}><input name="contactName" className="field" required defaultValue={user?.name} /></L>
        <L label="Phone / WhatsApp" error={fields.phone}><input name="phone" type="tel" className="field" required defaultValue={user?.phone ?? ''} /></L>
        <L label="Email" error={fields.email}><input name="email" type="email" className="field" defaultValue={user?.email} /></L>
        <L label="Business location"><input name="location" className="field" placeholder="City, area" /></L>
      </div>
      <L label="Website or social links"><input name="links" className="field" placeholder="https://…, @instagram" /></L>
      <L label="About the business" error={fields.message}><textarea name="description" className="field" required minLength={5} /></L>
      <L label="What are you interested in?">
        <select name="interest" className="field" defaultValue="">
          <option value="">Choose…</option>
          <option>Being listed on Explore</option>
          <option>Sponsored promotion (clearly labelled)</option>
          <option>Referral / booking partnership</option>
          <option>Venue partnership</option>
          <option>Gaming partnership or sponsorship</option>
          <option>Sponsoring Enhakkore or WSC</option>
          <option>Something else</option>
        </select>
      </L>
      <L label="Anything else"><textarea name="additional" className="field" /></L>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button disabled={state === 'sending'} className="h-12 rounded-full bg-acacia-600 font-bold text-white disabled:opacity-50">{state === 'sending' ? 'Sending…' : 'Send application'}</button>
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
