'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { localToUtc } from '@enhakkore/shared';
import { ApiError, api } from '@/lib/api';
import { uploadFile } from '@/lib/upload';
import { useSession } from '@/lib/session';

interface Country {
  id: string;
  code: string;
  name: string;
  slug: string;
  timezone: string;
}

/**
 * A member submits an event or activity. It goes to the team as "Pending
 * review" and is published only once approved. Large or paid ones are flagged
 * for enhanced review, including organiser verification.
 */
export function PublishActivityForm({ categories }: { categories: { id: string; name: string; group: string | null }[] }) {
  const { status, user } = useSession();
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryId, setCountryId] = useState('');
  const [cities, setCities] = useState<{ id: string; name: string; timezone: string | null }[]>([]);
  const [mode, setMode] = useState<'IN_PERSON' | 'ONLINE'>('IN_PERSON');
  const [cover, setCover] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Country[]>('/public/countries').then((rows) => {
      setCountries(rows);
      const tz = rows.find((row) => row.code === 'TZ');
      if (tz) setCountryId(tz.id);
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    const country = countries.find((row) => row.id === countryId);
    if (!country) return setCities([]);
    api.get<{ cities: { id: string; name: string; timezone: string | null }[] }>(`/public/countries/${country.slug}`).then((data) => setCities(data.cities)).catch(() => setCities([]));
  }, [countryId, countries]);

  if (status !== 'authenticated') {
    return (
      <div className="rounded-[1.2rem] border border-line bg-[color:var(--color-cream)] p-6 text-center">
        <p className="font-display text-2xl text-acacia-700">Members can publish activities</p>
        <p className="mt-2 text-ink-soft">Create a free member account, then submit your activity for review.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/join?next=/experiences/publish" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Join Enhakkore</Link>
          <Link href="/signin?next=/experiences/publish" className="inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-semibold">Sign in</Link>
        </div>
      </div>
    );
  }
  if (result) {
    return (
      <div className="rounded-[1.2rem] border border-safari-100 bg-safari-50 p-6">
        <p className="font-display text-2xl text-acacia-700">Submitted for review</p>
        <p className="mt-2 text-ink-soft">{result.message}</p>
        <Link href="/account/experiences" className="mt-4 inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">My published activities</Link>
      </div>
    );
  }

  const zoneFor = (cityId: string) => cities.find((city) => city.id === cityId)?.timezone || countries.find((row) => row.id === countryId)?.timezone || 'Africa/Dar_es_Salaam';

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const get = (name: string) => String(form.get(name) ?? '').trim();
        const zone = zoneFor(get('cityId'));
        const toIso = (value: string) => (value ? localToUtc(value, zone)?.toISOString() ?? '' : '');
        setBusy(true);
        setError(null);
        setFields({});
        try {
          const response = await api.post<{ message: string }>('/community/activities/submit', {
            title: get('title'),
            description: get('description'),
            categoryId: get('categoryId'),
            mode,
            countryId,
            cityId: get('cityId'),
            meetingPoint: get('meetingPoint'),
            startsAt: toIso(get('startsAt')),
            endsAt: toIso(get('endsAt')),
            registrationDeadline: toIso(get('deadline')),
            timezone: zone,
            capacity: get('capacity') ? Number(get('capacity')) : null,
            eligibility: get('eligibility'),
            rules: get('rules'),
            cancellationTerms: get('cancellation'),
            organiserPhone: get('phone'),
            coverImage: cover,
            paid: form.get('paid') === 'on',
            acceptedRules: form.get('acceptedRules') === 'on',
          });
          setResult(response);
        } catch (caught) {
          if (caught instanceof ApiError) {
            setError(caught.message);
            setFields(caught.fields);
          } else setError('Could not submit. Check your connection and try again.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <L label="Title" error={fields.title}><input name="title" className="field" required minLength={4} maxLength={160} placeholder="Saturday pickup basketball" /></L>
      <L label="Category" error={fields.categoryId}>
        <select name="categoryId" className="field" required defaultValue="">
          <option value="" disabled>Choose a category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.group ? `${category.group} — ` : ''}{category.name}</option>)}
        </select>
      </L>
      <L label="Description" error={fields.description}><textarea name="description" className="field min-h-32" required minLength={20} placeholder="What happens, who it is for, what to bring." /></L>
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode('IN_PERSON')} className={`chip ${mode === 'IN_PERSON' ? 'chip-active' : ''}`}>In person</button>
        <button type="button" onClick={() => setMode('ONLINE')} className={`chip ${mode === 'ONLINE' ? 'chip-active' : ''}`}>Online</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <L label="Country" error={fields.countryId}>
          <select className="field" value={countryId} onChange={(event) => setCountryId(event.target.value)} required>
            <option value="">Choose a country</option>
            {countries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}
          </select>
        </L>
        <L label="City">
          <select name="cityId" className="field" defaultValue="">
            <option value="">{cities.length ? 'Choose a city' : 'No cities listed yet'}</option>
            {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
          </select>
        </L>
        {mode === 'IN_PERSON' && <L label="Meeting place (public place, never a home address)"><input name="meetingPoint" className="field" maxLength={200} /></L>}
        <L label="Starts (local time)" error={fields.startsAt}><input name="startsAt" type="datetime-local" className="field" required /></L>
        <L label="Ends (optional)"><input name="endsAt" type="datetime-local" className="field" /></L>
        <L label="Registration closes (optional)"><input name="deadline" type="datetime-local" className="field" /></L>
        <L label="Capacity (optional)"><input name="capacity" type="number" min={1} className="field" /></L>
        <L label="Your phone / WhatsApp (for the team only)" error={fields.organiserPhone}><input name="phone" type="tel" className="field" required defaultValue={user?.phone ?? ''} /></L>
      </div>
      <L label="Who can take part"><input name="eligibility" className="field" placeholder="Ages 16+, all levels…" /></L>
      <L label="Rules"><textarea name="rules" className="field" /></L>
      <L label="Cancellation conditions"><textarea name="cancellation" className="field" /></L>
      <L label="Cover photo (optional)">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setUploading(true);
            try {
              const stored = await uploadFile('TRIP_IMAGE', file);
              setCover(stored.url ?? '');
            } catch {
              setError('The photo could not be uploaded. You can submit without it.');
            } finally {
              setUploading(false);
            }
          }}
        />
        {uploading && <span className="text-xs text-ink-muted">Uploading…</span>}
        {cover && <span className="text-xs text-safari-700">Photo added ✓</span>}
      </L>
      <label className="flex items-start gap-2 text-sm text-ink-soft">
        <input type="checkbox" name="paid" className="mt-1" />
        <span>This activity is paid, or I plan to charge participants. (Paid and large events need enhanced review and organiser verification. No payment is collected through Enhakkore at launch.)</span>
      </label>
      <label className="flex items-start gap-2 text-sm text-ink-soft">
        <input type="checkbox" name="acceptedRules" className="mt-1" required />
        <span>I accept the <Link href="/legal/activityRules" className="underline">event and activity rules</Link> and the <Link href="/legal/community" className="underline">community guidelines</Link>.</span>
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button disabled={busy || uploading} className="h-12 rounded-full bg-acacia-600 font-bold text-white disabled:opacity-50">{busy ? 'Submitting…' : 'Submit for review'}</button>
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
