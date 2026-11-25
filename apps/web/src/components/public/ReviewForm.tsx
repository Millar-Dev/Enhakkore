'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

/** A member's review of a place. Held for moderation before it shows. */
export function ReviewForm({ slug }: { slug: string }) {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState<string | null>(null);
  if (status !== 'authenticated') {
    return <Link href={`/signin?next=/discover/${slug}`} className="text-sm font-semibold text-acacia-600 underline">Sign in to write a review</Link>;
  }
  if (message) return <p className="text-sm text-safari-700">{message}</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="chip">Write a review</button>;
  return (
    <form
      className="grid gap-3 rounded-xl border border-line bg-white p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const body = String(new FormData(event.currentTarget).get('body'));
        try {
          const result = await api.post<{ message: string }>(`/community/places/${slug}/reviews`, { rating, body });
          setMessage(result.message);
        } catch (caught) {
          setMessage(caught instanceof ApiError ? caught.message : 'Could not send.');
        }
      }}
    >
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} type="button" aria-label={`${value} stars`} onClick={() => setRating(value)} className={`text-2xl ${value <= rating ? 'text-clay-400' : 'text-line-strong'}`}>
            ★
          </button>
        ))}
      </div>
      <textarea name="body" required minLength={20} className="field" placeholder="What was it like? (20 characters at least)" />
      <button className="h-11 rounded-full bg-acacia-600 text-sm font-bold text-white">Submit review</button>
    </form>
  );
}
