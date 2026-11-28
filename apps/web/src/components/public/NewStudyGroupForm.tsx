'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CountryCity } from '@/components/public/CountryCity';
import { CropUpload } from '@/components/uploads/CropUpload';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

/** Start a study group. Published straight away; the creator becomes its admin. */
export function NewStudyGroupForm() {
  const { status, user } = useSession();
  const router = useRouter();
  const [place, setPlace] = useState({ country: user?.country ?? '', city: user?.city ?? '' });
  const [cover, setCover] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
      <section className="shell max-w-2xl py-8 md:py-12">
        <Link href="/experiences/study-groups" className="text-sm font-semibold text-acacia-700">‹ Study groups</Link>
        <h1 className="mt-2 font-display text-3xl text-acacia-700">Create a study group</h1>
        {status !== 'authenticated' ? (
          <p className="mt-4 rounded-2xl border border-line bg-white p-5 text-sm text-ink-soft">
            <Link href="/signin?next=/experiences/study-groups/new" className="font-semibold text-acacia-700 underline">Sign in</Link> or <Link href="/join?next=/experiences/study-groups/new" className="font-semibold text-acacia-700 underline">create a free account</Link> to start a study group.
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
                const result = await api.post<{ slug: string }>('/community/study-groups', {
                  name: get('name'),
                  subject: get('subject'),
                  topic: get('topic'),
                  description: get('description'),
                  institution: get('institution'),
                  country: place.country,
                  city: place.city,
                  mode: get('mode'),
                  visibility: get('visibility'),
                  schedule: get('schedule'),
                  coverImage: cover ?? '',
                });
                router.push(`/experiences/communities/${result.slug}`);
              } catch (caught) {
                setError(caught instanceof ApiError ? Object.values(caught.fields)[0] ?? caught.message : 'Could not create the group.');
                setBusy(false);
              }
            }}
          >
            <label className="grid gap-1 text-sm font-semibold text-ink-soft">Group name<input name="name" required minLength={4} maxLength={100} className="field" placeholder="Medical Students — Anatomy" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-ink-soft">Subject or field<input name="subject" required maxLength={120} className="field" placeholder="Clinical Medicine" /></label>
              <label className="grid gap-1 text-sm font-semibold text-ink-soft">Specific topic<input name="topic" maxLength={120} className="field" placeholder="Pharmacology" /></label>
            </div>
            <label className="grid gap-1 text-sm font-semibold text-ink-soft">Description<textarea name="description" required minLength={20} maxLength={3000} rows={4} className="field" placeholder="What you will study, how often you meet, who it is for." /></label>
            <label className="grid gap-1 text-sm font-semibold text-ink-soft">School, college or university (optional)<input name="institution" maxLength={160} className="field" /></label>
            <CountryCity country={place.country} city={place.city} onChange={setPlace} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-ink-soft">
                Meets
                <select name="mode" className="field" defaultValue="ONLINE"><option value="ONLINE">Online</option><option value="IN_PERSON">In person</option><option value="BOTH">Both</option></select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-ink-soft">
                Who can join
                <select name="visibility" className="field" defaultValue="PUBLIC"><option value="PUBLIC">Public — anyone can join</option><option value="PRIVATE">Private — you approve each member</option></select>
              </label>
            </div>
            <label className="grid gap-1 text-sm font-semibold text-ink-soft">Schedule (optional)<input name="schedule" maxLength={200} className="field" placeholder="Tuesdays and Thursdays, 19:00" /></label>
            <CropUpload label="Cover image (optional)" kind="AVATAR" aspect={3} outputWidth={1500} value={cover} onChange={setCover} />
            <p className="rounded-xl bg-sand p-3 text-xs text-ink-soft">You become the group admin: you can appoint moderators, approve members of a private group, mute or remove members and remove messages. Members appear by username; phone numbers and emails are never shown. The Enhakkore team can step in on any reported group.</p>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button disabled={busy} className="h-12 rounded-full bg-acacia-600 font-bold text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create study group'}</button>
          </form>
        )}
      </section>
  );
}
