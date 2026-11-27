'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { localToUtc } from '@enhakkore/shared';
import { ApiError, api } from '@/lib/api';
import { uploadFile } from '@/lib/upload';
import { SearchSelect, searchWorldCities } from '@/components/ui/SearchSelect';
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
  const [cityId, setCityId] = useState('');
  const countryCode = countries.find((row) => row.id === countryId)?.code;
  const [mode, setMode] = useState<'IN_PERSON' | 'ONLINE'>('IN_PERSON');
  const [cover, setCover] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [verification, setVerification] = useState<'NONE' | 'QR' | 'MANUAL'>('NONE');
  const [summary, setSummary] = useState<[string, string][]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  function next() {
    const container = stepRefs.current[step];
    const controls = container ? Array.from(container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')) : [];
    for (const control of controls) if (!control.checkValidity()) return control.reportValidity();
    if (step === 0 && !countryId) return setError('Choose a country.');
    setError(null);
    if (step === 2 && formRef.current) {
      const form = new FormData(formRef.current);
      const get = (name: string) => String(form.get(name) ?? '').trim();
      setSummary([
        ['Title', get('title')],
        ['Category', categories.find((c) => c.id === get('categoryId'))?.name ?? ''],
        ['Where', mode === 'ONLINE' ? 'Online' : [get('meetingPoint'), cities.find((c) => c.id === cityId)?.name, countries.find((c) => c.id === countryId)?.name].filter(Boolean).join(', ')],
        ['Starts', get('startsAt').replace('T', ' ')],
        ['Capacity', get('capacity') || 'No limit'],
        ['Paid', form.get('paid') === 'on' ? 'Yes — enhanced review' : 'Free'],
        ['Group chat', form.get('chatEnabled') === 'on' ? 'On' : 'Off'],
        ['Entry check', verification === 'NONE' ? 'None' : verification === 'QR' ? 'Enhakkore Pass with QR' : 'Manual check-in'],
      ]);
    }
    setStep(step + 1);
    window.scrollTo({ top: (formRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 90, behavior: 'smooth' });
  }

  const zoneFor = (cityId: string) => cities.find((city) => city.id === cityId)?.timezone || countries.find((row) => row.id === countryId)?.timezone || 'Africa/Dar_es_Salaam';

  return (
    <form
      ref={formRef}
      className="grid gap-4"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (step < STEPS.length - 1) return next();
        if (busy) return;
        const form = new FormData(event.currentTarget);
        const get = (name: string) => String(form.get(name) ?? '').trim();
        const zone = zoneFor(cityId);
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
            cityId,
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
            verification,
            chatEnabled: form.get('chatEnabled') === 'on',
            ageRestriction: get('age'),
            safetyNotes: get('safety'),
            acceptedRules: form.get('acceptedRules') === 'on',
          });
          setResult(response);
        } catch (caught) {
          if (caught instanceof ApiError) {
            setError(caught.message);
            setFields(caught.fields);
            const firstBad = Object.keys(caught.fields)[0];
            const where = firstBad ? STEP_OF[firstBad] : undefined;
            if (where !== undefined) setStep(where);
          } else setError('Could not submit. Check your connection and try again.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <ol className="grid grid-cols-4 gap-1" aria-label="Steps">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button type="button" onClick={() => index < step && setStep(index)} className={`w-full rounded-full px-1 py-1.5 text-[0.6875rem] font-semibold sm:text-xs ${index === step ? 'bg-acacia-700 text-white' : index < step ? 'bg-clay-400/40 text-acacia-700' : 'bg-sand text-ink-muted'}`} aria-current={index === step ? 'step' : undefined}>
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div ref={(el) => { stepRefs.current[0] = el; }} className={step === 0 ? 'grid gap-4' : 'hidden'}>
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
          <SearchSelect ariaLabel="Country" placeholder="Type a country…" value={countryId} options={countries.map((country) => ({ value: country.id, label: country.name }))} onChange={(next) => { setCountryId(next); setCityId(''); }} />
        </L>
        <L label="City">
          <SearchSelect
            ariaLabel="City"
            placeholder="Type a city…"
            value={cityId}
            emptyLabel="No particular city"
            options={cities.map((city) => ({ value: city.id, label: city.name }))}
            remote={countryCode ? (q) => searchWorldCities((path) => api.get(path), countryCode, q) : undefined}
            onChange={async (next) => {
              if (!next.startsWith('geo:')) return setCityId(next);
              try {
                const city = await api.post<{ id: string; name: string; timezone: string | null }>('/community/geo/city', { country: countryCode, geonameId: Number(next.slice(4)) });
                setCities((current) => [...current.filter((item) => item.id !== city.id), city]);
                setCityId(city.id);
              } catch {
                setError('Could not use that city — try another.');
              }
            }}
          />
        </L>
        {mode === 'IN_PERSON' && <L label="Meeting place (public place, never a home address)"><input name="meetingPoint" className="field" maxLength={200} /></L>}
        <L label="Starts (local time)" error={fields.startsAt}><input name="startsAt" type="datetime-local" className="field" required /></L>
        <L label="Ends (optional)"><input name="endsAt" type="datetime-local" className="field" /></L>
        <L label="Registration closes (optional)"><input name="deadline" type="datetime-local" className="field" /></L>
        <L label="Capacity (optional)"><input name="capacity" type="number" min={1} className="field" /></L>
        <L label="Your phone / WhatsApp (for the team only)" error={fields.organiserPhone}><input name="phone" type="tel" className="field" required defaultValue={user?.phone ?? ''} /></L>
      </div>
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
      </div>

      <div ref={(el) => { stepRefs.current[1] = el; }} className={step === 1 ? 'grid gap-4' : 'hidden'}>
      <L label="Who can take part"><input name="eligibility" className="field" placeholder="All levels, beginners welcome…" /></L>
      <L label="Age (optional)"><input name="age" className="field" maxLength={60} placeholder="16+, 18+, all ages…" /></L>
      <L label="Rules"><textarea name="rules" className="field" /></L>
      <L label="Safety: what participants should know or bring (optional)"><textarea name="safety" className="field" placeholder="Water, trainers, first-aid point, who to contact on the day…" /></L>
      <L label="Cancellation conditions"><textarea name="cancellation" className="field" /></L>
      <label className="flex items-start gap-2 text-sm text-ink-soft">
        <input type="checkbox" name="chatEnabled" className="mt-1" />
        <span>Open a group chat for confirmed participants (moderated; members can report and block). You can switch it off later.</span>
      </label>
      <label className="flex items-start gap-2 text-sm text-ink-soft">
        <input type="checkbox" name="paid" className="mt-1" />
        <span>This activity is paid, or I plan to charge participants. (Paid and large events need enhanced review and organiser verification. No payment is collected through Enhakkore at launch.)</span>
      </label>
      </div>

      <div ref={(el) => { stepRefs.current[2] = el; }} className={step === 2 ? 'grid gap-3' : 'hidden'}>
        <p className="text-sm text-ink-soft">How will people be checked in at the entrance? Most free activities do not need a check.</p>
        {([
          ['NONE', 'No entry check (recommended for free activities)', 'Anyone who registered can come. No pass is issued.'],
          ['QR', 'Enhakkore Pass with QR code', 'Each confirmed participant gets a pass with a QR code. You scan it at the entrance with your phone. The code holds no personal details.'],
          ['MANUAL', 'Manual check-in by name and reference', 'Each confirmed participant gets a pass reference. You check names off in the scanner page.'],
        ] as const).map(([value, title, body]) => (
          <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${verification === value ? 'border-acacia-600 bg-[#f1f6fb]' : 'border-line'}`}>
            <input type="radio" name="verification" value={value} checked={verification === value} onChange={() => setVerification(value)} className="mt-1" />
            <span><span className="block text-sm font-semibold text-ink">{title}</span><span className="text-xs text-ink-muted">{body}</span></span>
          </label>
        ))}
      </div>

      <div ref={(el) => { stepRefs.current[3] = el; }} className={step === 3 ? 'grid gap-4' : 'hidden'}>
      <dl className="grid gap-1 rounded-xl bg-sand p-4 text-sm">
        {summary.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[8rem_1fr] gap-2"><dt className="text-ink-muted">{label}</dt><dd className="text-ink [overflow-wrap:anywhere]">{value || '—'}</dd></div>
        ))}
      </dl>
      <p className="text-sm text-ink-soft">After you submit, it is saved as “Pending review”, seen only by you and the team. Nothing is published until the team approves it.</p>
      <label className="flex items-start gap-2 text-sm text-ink-soft">
        <input type="checkbox" name="acceptedRules" className="mt-1" required />
        <span>I accept the <Link href="/legal/activityRules" className="underline">event and activity rules</Link> and the <Link href="/legal/community" className="underline">community guidelines</Link>.</span>
      </label>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="h-12 rounded-full border border-line-strong px-6 font-semibold text-ink">Back</button>}
        <button disabled={busy || uploading} className="h-12 flex-1 rounded-full bg-acacia-600 font-bold text-white disabled:opacity-50">
          {step < STEPS.length - 1 ? 'Continue' : busy ? 'Submitting…' : 'Submit for review'}
        </button>
      </div>
    </form>
  );
}

const STEPS = ['Details', 'Participation & safety', 'Entry check', 'Review'];
/** Which step holds each field, to go back to it when the server reports a problem. */
const STEP_OF: Record<string, number> = { title: 0, categoryId: 0, description: 0, countryId: 0, startsAt: 0, organiserPhone: 0, eligibility: 1, rules: 1, cancellationTerms: 1, acceptedRules: 3 };

function L({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
      {label}
      {children}
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}
