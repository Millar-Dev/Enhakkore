'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

export function StoryForm() {
  const { status } = useSession();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (status !== 'authenticated') return <Link href="/signin?next=/stories/new" className="inline-flex h-12 items-center rounded-full bg-acacia-600 px-6 font-bold text-white">Sign in to share a story</Link>;
  if (done) return <p className="rounded-xl bg-safari-50 p-5 text-acacia-700">{done}</p>;
  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          const result = await api.post<{ message: string }>('/community/stories', {
            title: String(form.get('title')),
            body: String(form.get('body')),
            cityName: String(form.get('city') ?? ''),
            countryCode: String(form.get('country') ?? '').toUpperCase().slice(0, 2),
          });
          setDone(result.message);
        } catch (caught) {
          setError(caught instanceof ApiError ? Object.values(caught.fields)[0] ?? caught.message : 'Could not send.');
        }
      }}
    >
      <label className="grid gap-1 text-sm font-semibold text-ink-soft">Title<input name="title" required minLength={4} maxLength={160} className="field" /></label>
      <label className="grid gap-1 text-sm font-semibold text-ink-soft">Your story<textarea name="body" required minLength={40} rows={10} className="field" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-ink-soft">City (optional)<input name="city" className="field" /></label>
        <label className="grid gap-1 text-sm font-semibold text-ink-soft">Country code (optional, e.g. TZ)<input name="country" maxLength={2} className="field" /></label>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button className="h-12 w-fit rounded-full bg-acacia-600 px-8 font-bold text-white">Send for review</button>
    </form>
  );
}
