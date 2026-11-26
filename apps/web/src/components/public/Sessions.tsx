'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatInZone } from '@enhakkore/shared';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

interface Session {
  id: string;
  startsAt: string;
  meetingPoint: string | null;
  route: string | null;
  status: string;
  notice: string | null;
  registered: number;
  spacesLeft: number | null;
  past: boolean;
  viewerRegistered: boolean;
}

/** The dated sessions of a recurring activity — register for each one separately. */
export function Sessions({ slug }: { slug: string }) {
  const { status } = useSession();
  const [data, setData] = useState<{ upcoming: Session[]; past: Session[]; timezone: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(() => api.get<typeof data>(`/public/activities/${slug}/sessions`).then(setData).catch(() => setData(null)), [slug]);
  useEffect(() => {
    if (status !== 'loading') void load();
  }, [status, load]);
  if (!data || (data.upcoming.length === 0 && data.past.length === 0)) return null;
  const when = (value: string) => formatInZone(value, data.timezone, 'full');

  return (
    <div>
      <p className="font-display text-2xl text-acacia-700">Sessions</p>
      <p className="mt-1 text-sm text-ink-muted">Each session has its own list — register for the ones you will come to. Times are local ({data.timezone.replace('_', ' ')}).</p>
      <ul className="mt-4 space-y-3">
        {data.upcoming.map((session) => (
          <li key={session.id} className="rounded-xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-acacia-700">{when(session.startsAt)}</p>
                <p className="text-sm text-ink-soft">{[session.meetingPoint, session.route].filter(Boolean).join(' · ')}</p>
                <p className="text-xs text-ink-muted">{session.registered} registered{session.spacesLeft !== null ? ` · ${session.spacesLeft} spaces left` : ''}</p>
                {session.status !== 'SCHEDULED' && <p className={`mt-1 text-sm font-semibold ${session.status === 'CANCELLED' ? 'text-danger' : 'text-warning'}`}>{session.status === 'CANCELLED' ? 'Cancelled' : 'Changed'}{session.notice ? ` — ${session.notice}` : ''}</p>}
              </div>
              {session.status !== 'CANCELLED' &&
                (status !== 'authenticated' ? (
                  <Link href={`/signin?next=/activities/${slug}`} className="inline-flex h-10 items-center rounded-full border border-line-strong px-4 text-sm font-semibold">Sign in to register</Link>
                ) : session.viewerRegistered ? (
                  <button
                    onClick={async () => {
                      await api.post(`/community/sessions/${session.id}/cancel`, {});
                      setMessage('Registration cancelled.');
                      void load();
                    }}
                    className="inline-flex h-10 items-center rounded-full bg-safari-50 px-4 text-sm font-bold text-safari-700"
                  >
                    Registered ✓ · cancel
                  </button>
                ) : (
                  <button
                    disabled={session.spacesLeft === 0}
                    onClick={async () => {
                      try {
                        await api.post(`/community/sessions/${session.id}/register`, {});
                        setMessage('You are registered. See you there!');
                      } catch (caught) {
                        setMessage(caught instanceof ApiError ? caught.message : 'Could not register.');
                      }
                      void load();
                    }}
                    className="inline-flex h-10 items-center rounded-full bg-acacia-600 px-4 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {session.spacesLeft === 0 ? 'Full' : 'Register'}
                  </button>
                ))}
            </div>
          </li>
        ))}
      </ul>
      {message && <p className="mt-3 text-sm text-safari-700">{message}</p>}
      {data.past.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink-muted">Past sessions ({data.past.length})</summary>
          <ul className="mt-2 space-y-1 text-sm text-ink-muted">
            {data.past.map((session) => <li key={session.id}>{when(session.startsAt)} · {session.registered} registered{session.status === 'CANCELLED' ? ' · cancelled' : ''}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
