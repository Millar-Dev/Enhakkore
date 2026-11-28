'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CountryCity } from '@/components/public/CountryCity';
import { CropUpload } from '@/components/uploads/CropUpload';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

const COMMUNITY_CATEGORIES = ['Sports and Fitness', 'Gaming', 'Study and Learning', 'Arts and Culture', 'Social Activities', 'Other interests'];

/**
 * Create a community or a study group. Published straight away; the creator
 * becomes its admin. Private groups are joined by invitation link or password.
 */
export function NewGroupForm({ kind }: { kind: 'COMMUNITY' | 'STUDY_GROUP' }) {
  const { status, user } = useSession();
  const router = useRouter();
  const study = kind === 'STUDY_GROUP';
  const back = study ? '/experiences/study-groups' : '/experiences/communities';
  const next = study ? '/experiences/study-groups/new' : '/experiences/communities/new';
  const [place, setPlace] = useState({ country: user?.country ?? '', city: user?.city ?? '' });
  const [cover, setCover] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (study) return;
    api.get<{ id: string; name: string }[]>('/public/groups/categories', { token: null }).then((rows) => setCategories(Array.isArray(rows) ? rows : [])).catch(() => setCategories([]));
  }, [study]);

  return (
    <section className="shell max-w-2xl py-8 md:py-12">
      <Link href={back} className="text-sm font-semibold text-acacia-700">‹ {study ? 'Study groups' : 'Communities'}</Link>
      <h1 className="mt-2 font-display text-3xl text-acacia-700">{study ? 'Create a study group' : 'Create a community'}</h1>
      <p className="mt-2 text-sm text-ink-muted">It is published straight away — no waiting for approval. The Enhakkore team is told and looks into anything that is reported.</p>
      {status !== 'authenticated' ? (
        <p className="mt-4 rounded-2xl border border-line bg-white p-5 text-sm text-ink-soft">
          <Link href={`/signin?next=${next}`} className="font-semibold text-acacia-700 underline">Sign in</Link> or <Link href={`/join?next=${next}`} className="font-semibold text-acacia-700 underline">create a free account</Link> first.
        </p>
      ) : (
        <form
          className="mt-6 grid gap-4 rounded-2xl border border-line bg-white p-5"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const form = new FormData(event.currentTarget);
            const get = (name: string) => String(form.get(name) ?? '').trim();
            setBusy(true);
            setError(null);
            try {
              const result = await api.post<{ slug: string }>('/community/groups', {
                kind,
                name: get('name'),
                summary: get('summary'),
                description: get('description'),
                categoryId: get('categoryId'),
                subject: get('subject'),
                topic: get('topic'),
                course: get('course'),
                institution: get('institution'),
                objectives: get('objectives'),
                tags: get('tags').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 15),
                country: place.country,
                city: place.city,
                mode: get('mode') || 'ONLINE',
                visibility,
                password: visibility === 'PRIVATE' ? get('password') : '',
                schedule: get('schedule'),
                rules: get('rules'),
                coverImage: cover ?? '',
                contactName: get('contactName'),
                contactPhone: get('contactPhone'),
              });
              router.push(`/experiences/communities/${result.slug}`);
            } catch (caught) {
              setError(caught instanceof ApiError ? Object.values(caught.fields)[0] ?? caught.message : 'Could not create the group.');
              setBusy(false);
            }
          }}
        >
          <label className="grid gap-1 text-sm font-semibold text-ink-soft">Name<input name="name" required minLength={4} maxLength={100} className="field" placeholder={study ? 'Medical Students — Cardiology' : 'Dar Weekend Cyclists'} /></label>
          {study ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold text-ink-soft">Subject or field<input name="subject" required maxLength={120} className="field" placeholder="Clinical Medicine" /></label>
                <label className="grid gap-1 text-sm font-semibold text-ink-soft">Topic<input name="topic" maxLength={120} className="field" placeholder="Cardiovascular physiology" /></label>
                <label className="grid gap-1 text-sm font-semibold text-ink-soft">Course (optional)<input name="course" maxLength={160} className="field" placeholder="MD year 3" /></label>
                <label className="grid gap-1 text-sm font-semibold text-ink-soft">School, college or university (optional)<input name="institution" maxLength={160} className="field" /></label>
              </div>
              <label className="grid gap-1 text-sm font-semibold text-ink-soft">Learning objectives (optional)<textarea name="objectives" maxLength={2000} rows={2} className="field" placeholder="Read ECGs confidently; revise past papers before finals." /></label>
            </>
          ) : (
            <label className="grid gap-1 text-sm font-semibold text-ink-soft">
              Category
              <select name="categoryId" className="field" defaultValue="">
                <option value="">Choose…</option>
                {categories.length ? categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>) : COMMUNITY_CATEGORIES.map((name) => <option key={name} value="">{name}</option>)}
              </select>
            </label>
          )}
          <label className="grid gap-1 text-sm font-semibold text-ink-soft">One-line summary (optional)<input name="summary" maxLength={300} className="field" /></label>
          <label className="grid gap-1 text-sm font-semibold text-ink-soft">Description<textarea name="description" required minLength={20} maxLength={4000} rows={4} className="field" placeholder="What the group is about, how often you meet, who it is for." /></label>
          <label className="grid gap-1 text-sm font-semibold text-ink-soft">Search tags (comma separated, optional)<input name="tags" maxLength={500} className="field" placeholder={study ? 'ecg, anatomy, past papers' : 'cycling, weekends, beginners'} /></label>
          <CountryCity country={place.country} city={place.city} onChange={setPlace} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-ink-soft">
              Meets
              <select name="mode" className="field" defaultValue={study ? 'ONLINE' : 'IN_PERSON'}><option value="ONLINE">Online</option><option value="IN_PERSON">In person</option><option value="BOTH">Both</option></select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-ink-soft">Schedule (optional)<input name="schedule" maxLength={200} className="field" placeholder="Tuesdays 19:00" /></label>
          </div>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-ink-soft">Who can join</legend>
            {(['PUBLIC', 'PRIVATE'] as const).map((value) => (
              <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${visibility === value ? 'border-acacia-600 bg-[#f1f6fb]' : 'border-line'}`}>
                <input type="radio" name="visibility" checked={visibility === value} onChange={() => setVisibility(value)} className="mt-1" />
                <span>{value === 'PUBLIC' ? <><strong>Public</strong> — listed and anyone can join instantly.</> : <><strong>Private</strong> — still listed with its basic information, but chat, members, files and sessions are for members only. People join with an invitation link or the group password.</>}</span>
              </label>
            ))}
          </fieldset>
          {visibility === 'PRIVATE' && <label className="grid gap-1 text-sm font-semibold text-ink-soft">Group password (optional — you can use invitation links only)<input name="password" type="password" minLength={6} maxLength={100} className="field" autoComplete="new-password" /><span className="text-xs font-normal text-ink-muted">Stored scrambled. Nobody can read it back, including the Enhakkore team; you can reset it.</span></label>}
          <label className="grid gap-1 text-sm font-semibold text-ink-soft">Rules (optional)<textarea name="rules" maxLength={3000} rows={2} className="field" placeholder="Be respectful. No spam. Keep personal details private." /></label>
          <CropUpload label="Cover image (optional)" kind="AVATAR" aspect={3} outputWidth={1500} value={cover} onChange={setCover} />
          <fieldset className="grid gap-3 rounded-xl bg-sand p-3 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold text-ink-soft">Your contact (for the Enhakkore team only)</legend>
            <label className="grid gap-1 text-sm font-semibold text-ink-soft">Full name<input name="contactName" required minLength={2} maxLength={120} defaultValue={user?.name ?? ''} className="field bg-white" /></label>
            <label className="grid gap-1 text-sm font-semibold text-ink-soft">Phone<input name="contactPhone" type="tel" required minLength={7} maxLength={40} defaultValue={user?.phone ?? ''} className="field bg-white" /></label>
          </fieldset>
          <p className="rounded-xl bg-sand p-3 text-xs text-ink-soft">You become the group admin: you can appoint moderators, create invitation links, mute or remove members and remove messages. Members appear by username; phone numbers and emails are never shown to them.</p>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button disabled={busy} className="h-12 rounded-full bg-acacia-600 font-bold text-white disabled:opacity-50">{busy ? 'Creating…' : study ? 'Create study group' : 'Create community'}</button>
        </form>
      )}
    </section>
  );
}

export function NewStudyGroupForm() {
  return <NewGroupForm kind="STUDY_GROUP" />;
}
