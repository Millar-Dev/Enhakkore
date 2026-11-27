'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { STATUS_LABELS, EXPERIENCE_SECTIONS, EXPERIENCE_SECTION_NAMES, ORGANISER_APPLICATION_LABELS } from '@enhakkore/shared';
import { CountryCity } from '@/components/public/CountryCity';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

interface Application {
  id: string;
  legalName: string;
  phone: string;
  email: string;
  country: string | null;
  city: string | null;
  categories: string[];
  approvedCategories: string[];
  hasExperience: boolean;
  description: string;
  links: string | null;
  status: keyof typeof ORGANISER_APPLICATION_LABELS;
  reviewNotes: string | null;
  identityChecked: boolean;
}
interface Hosted { id: string; slug: string; title: string; status: string; startsAt: string | null; capacity: number | null; spotsTaken: number; verification: string; chatEnabled: boolean; checkedIn: number; reviewNotes: string | null; participants: { id: string; status: string }[] }

const STEPS = ['Submitted', 'Under review', 'Approved'];

/**
 * Host & Organise: how it works, the organiser application and its status,
 * and — once approved — the organiser dashboard.
 */
export function HostHub() {
  const { status, user } = useSession();
  const [application, setApplication] = useState<Application | null | undefined>(undefined);
  const [hosted, setHosted] = useState<Hosted[]>([]);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const [app, list] = await Promise.all([
      api.get<{ application: Application | null }>('/community/organiser-application').catch(() => ({ application: null })),
      api.get<Hosted[]>('/community/hosting').catch(() => []),
    ]);
    setApplication(app.application);
    setHosted(list);
  }, []);
  useEffect(() => {
    if (status === 'authenticated') void load();
  }, [status, load]);

  const intro = (
    <div className="grid gap-3 md:grid-cols-3">
      {[
        { n: '1', t: 'Apply once', b: 'Tell us who you are and what you want to organise. Approval is per category.' },
        { n: '2', t: 'We verify you', b: 'The team confirms your identity by phone, video call or in person. We never store ID numbers or document images on the website.' },
        { n: '3', t: 'Submit experiences', b: 'Every experience is still reviewed before it is published. Paid or large ones get enhanced review.' },
      ].map((step) => (
        <div key={step.n} className="rounded-2xl border border-line bg-white p-5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-clay-400 font-bold text-acacia-700">{step.n}</span>
          <p className="mt-3 font-bold text-ink">{step.t}</p>
          <p className="mt-1 text-sm text-ink-muted">{step.b}</p>
        </div>
      ))}
    </div>
  );

  if (status !== 'authenticated') {
    return (
      <div className="grid gap-6">
        {intro}
        <p className="rounded-2xl border border-line bg-white p-5 text-sm text-ink-soft">
          <Link href="/signin?next=/experiences/host" className="font-semibold text-acacia-700 underline">Sign in</Link> or <Link href="/join?next=/experiences/host" className="font-semibold text-acacia-700 underline">create a free account</Link> to apply as an organiser.
        </p>
      </div>
    );
  }
  if (application === undefined) return <p className="text-sm text-ink-muted">Loading…</p>;

  const approved = application?.status === 'APPROVED';
  const showForm = !application || editing || application.status === 'MORE_INFO' || application.status === 'REJECTED';
  const stepIndex = !application ? -1 : application.status === 'SUBMITTED' ? 0 : application.status === 'APPROVED' ? 2 : 1;

  return (
    <div className="grid gap-8">
      {!approved && intro}

      {application && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-ink">Your organiser application</h2>
            <span className="rounded-full bg-sand px-3 py-1 text-xs font-bold text-acacia-700">{ORGANISER_APPLICATION_LABELS[application.status]}</span>
          </div>
          {['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(application.status) && (
            <ol className="mt-4 flex gap-2" aria-label="Progress">
              {STEPS.map((label, index) => (
                <li key={label} className={`flex-1 rounded-full py-1 text-center text-xs font-semibold ${index <= stepIndex ? 'bg-acacia-700 text-white' : 'bg-sand text-ink-muted'}`}>{label}</li>
              ))}
            </ol>
          )}
          {application.reviewNotes && ['MORE_INFO', 'REJECTED', 'SUSPENDED'].includes(application.status) && <p className="mt-3 rounded-xl bg-[#fff8e6] p-3 text-sm text-ink-soft"><strong>From the team:</strong> {application.reviewNotes}</p>}
          {approved && (
            <p className="mt-3 text-sm text-ink-soft">
              Approved for: <strong>{application.approvedCategories.map((key) => EXPERIENCE_SECTION_NAMES[key as keyof typeof EXPERIENCE_SECTION_NAMES] ?? key).join(', ')}</strong>.
              {application.categories.some((key) => !application.approvedCategories.includes(key)) && ' Other categories you asked for are not approved yet.'}
            </p>
          )}
          {application.status === 'SUSPENDED' && <p className="mt-3 text-sm text-ink-soft">Your organiser access is suspended. Contact the Enhakkore team.</p>}
          {approved && !editing && <button type="button" onClick={() => setEditing(true)} className="mt-3 text-sm font-semibold text-acacia-700 underline">Apply for more categories</button>}
        </section>
      )}

      {showForm && application?.status !== 'SUSPENDED' && <ApplicationForm current={application ?? null} email={user?.email ?? ''} onDone={() => { setEditing(false); void load(); }} />}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink">Organiser dashboard</h2>
            <p className="text-sm text-ink-muted">{approved ? 'Your submissions and published experiences.' : 'Anyone can submit an activity for review; approved organisers get their submissions reviewed faster and can run paid or larger experiences.'}</p>
          </div>
          <Link href="/experiences/publish" className="inline-flex h-12 items-center rounded-full bg-acacia-600 px-6 text-sm font-bold text-white">＋ Create an experience</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Submissions', value: hosted.length },
            { label: 'Published', value: hosted.filter((row) => ['PUBLISHED', 'FULL'].includes(row.status)).length },
            { label: 'Registrations', value: hosted.reduce((sum, row) => sum + row.participants.filter((p) => p.status === 'APPROVED').length, 0) },
            { label: 'Checked in', value: hosted.reduce((sum, row) => sum + row.checkedIn, 0) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-line bg-white p-4">
              <p className="text-2xl font-bold text-acacia-700">{stat.value}</p>
              <p className="text-xs text-ink-muted">{stat.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link href="/account/hosting" className="chip">Requests & attendees</Link>
          <Link href="/account/scanner" className="chip">Check-in scanner</Link>
          <Link href="/account/chats" className="chip">Group chats</Link>
          <Link href="/account/notifications" className="chip">Notifications</Link>
        </div>
        {hosted.length > 0 && (
          <ul className="mt-4 grid gap-2">
            {hosted.map((row) => {
              const pending = row.participants.filter((p) => p.status === 'PENDING').length;
              return (
                <li key={row.id} className="rounded-xl border border-line bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/activities/${row.slug}`} className="font-semibold text-ink hover:underline">{row.title}</Link>
                      <p className="text-xs text-ink-muted">{row.startsAt ? new Date(row.startsAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'No date'} · {row.spotsTaken}{row.capacity ? `/${row.capacity}` : ''} going{pending ? ` · ${pending} waiting for you` : ''} · entry: {row.verification === 'NONE' ? 'open' : row.verification === 'QR' ? 'QR pass' : 'manual check-in'} · chat {row.chatEnabled ? 'on' : 'off'}</p>
                    </div>
                    <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-bold text-acacia-700">{STATUS_LABELS[row.status] ?? row.status}</span>
                  </div>
                  {row.reviewNotes && <p className="mt-2 rounded-lg bg-[#fff8e6] p-2 text-xs text-ink-soft"><strong>From the team:</strong> {row.reviewNotes}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
                    <Link href="/account/hosting" className="text-acacia-700">Manage attendees</Link>
                    {row.chatEnabled && <Link href={`/account/chats/open?type=ACTIVITY&id=${row.id}`} className="text-acacia-700">Open chat</Link>}
                    {row.verification !== 'NONE' && <Link href="/account/scanner" className="text-acacia-700">Check people in</Link>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ApplicationForm({ current, email, onDone }: { current: Application | null; email: string; onDone: () => void }) {
  const [form, setForm] = useState({
    legalName: current?.legalName ?? '',
    phone: current?.phone ?? '',
    email: current?.email ?? email,
    country: current?.country ?? '',
    city: current?.city ?? '',
    categories: current?.categories ?? ([] as string[]),
    hasExperience: current?.hasExperience ?? false,
    description: current?.description ?? '',
    links: current?.links ?? '',
    agreedRules: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get('section');
    if (section && !current) setForm((f) => (f.categories.includes(section) ? f : { ...f, categories: [...f.categories, section] }));
  }, [current]);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <form
      className="grid gap-4 rounded-2xl border border-line bg-white p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
          await api.post('/community/organiser-application', form);
          onDone();
        } catch (caught) {
          setError(caught instanceof ApiError ? caught.message : 'Could not send. Check your connection.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-lg font-bold text-ink">{current ? 'Update your application' : 'Apply as an organiser'}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-ink-soft">Full legal name<input required value={form.legalName} onChange={(e) => set('legalName', e.target.value)} className="field" autoComplete="name" /></label>
        <label className="grid gap-1 text-sm font-semibold text-ink-soft">Phone / WhatsApp<input required value={form.phone} onChange={(e) => set('phone', e.target.value)} className="field" autoComplete="tel" inputMode="tel" /></label>
        <label className="grid gap-1 text-sm font-semibold text-ink-soft sm:col-span-2">Email<input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="field" autoComplete="email" /></label>
      </div>
      <CountryCity required country={form.country} city={form.city} onChange={(next) => setForm((f) => ({ ...f, ...next }))} />
      <fieldset>
        <legend className="text-sm font-semibold text-ink-soft">What do you want to organise?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXPERIENCE_SECTIONS.map((section) => {
            const on = form.categories.includes(section.key);
            return (
              <button key={section.key} type="button" aria-pressed={on} onClick={() => set('categories', on ? form.categories.filter((key) => key !== section.key) : [...form.categories, section.key])} className={`chip ${on ? 'chip-active' : ''}`}>
                {section.icon} {EXPERIENCE_SECTION_NAMES[section.key]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={form.hasExperience} onChange={(e) => set('hasExperience', e.target.checked)} /> I have organised events or activities before</label>
      <label className="grid gap-1 text-sm font-semibold text-ink-soft">Tell us about it<textarea required minLength={30} maxLength={4000} rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} className="field" placeholder="What you would like to run, for whom, how often, and anything you have done before." /></label>
      <label className="grid gap-1 text-sm font-semibold text-ink-soft">Links (optional)<input value={form.links} onChange={(e) => set('links', e.target.value)} className="field" placeholder="Instagram, website, past events" /></label>
      <div className="rounded-xl bg-sand p-3 text-sm text-ink-soft">
        <p><strong>Identity check.</strong> The team will contact you to confirm your identity — usually a short call or video call where you show an ID. We record only that the check was done and how, never your ID number or a copy of the document.</p>
      </div>
      <label className="flex items-start gap-2 text-sm text-ink-soft">
        <input type="checkbox" required checked={form.agreedRules} onChange={(e) => set('agreedRules', e.target.checked)} className="mt-1" />
        <span>I agree to the <Link href="/legal/community" className="font-semibold text-acacia-700 underline">community guidelines</Link> and the organiser rules: honest listings, public meeting places, the safety of participants first, and no payments collected outside what the team approves.</span>
      </label>
      {error && <p role="alert" className="text-sm text-[#b42318]">{error}</p>}
      <button disabled={busy} className="h-12 w-fit rounded-full bg-acacia-600 px-8 font-bold text-white disabled:opacity-50">{busy ? 'Sending…' : current ? 'Send update' : 'Send application'}</button>
    </form>
  );
}
