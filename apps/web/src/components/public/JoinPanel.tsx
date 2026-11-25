'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

interface Viewer {
  requestStatus: string | null;
  isOrganiser: boolean;
  onlineDetails: string | null;
}

const STATUS_TEXT: Record<string, string> = {
  REQUESTED: 'Request sent — waiting for the organiser to approve it.',
  APPROVED: 'You are going. See you there!',
  WAITLIST: 'You are on the waitlist. We will let you know if a space opens.',
  DECLINED: 'Your request was not accepted this time.',
  CANCELLED: 'You withdrew your request.',
};

/** Request to join an activity. Signed-in members only, so organisers know who is coming. */
export function JoinPanel({ slug, open, whatsappHref }: { slug: string; open: boolean; whatsappHref: string }) {
  const { status } = useSession();
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api
      .get<{ viewer: Viewer | null }>(`/public/activities/${slug}`)
      .then((result) => setViewer(result.viewer))
      .catch(() => undefined);

  useEffect(() => {
    if (status === 'authenticated') void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, slug]);

  if (!open) {
    return <p className="text-sm text-ink-muted">This activity is not taking requests.</p>;
  }
  if (status !== 'authenticated') {
    return (
      <div className="grid gap-3">
        <Link href={`/signin?next=/activities/${slug}`} className="inline-flex h-12 items-center justify-center rounded-full bg-acacia-600 font-bold text-white">
          Sign in to request to join
        </Link>
        <a href={whatsappHref} target="_blank" rel="noreferrer noopener" className="inline-flex h-12 items-center justify-center rounded-full border border-line-strong bg-white text-sm font-semibold">
          Ask about it on WhatsApp
        </a>
      </div>
    );
  }
  if (viewer?.isOrganiser) {
    return (
      <Link href="/account/hosting" className="inline-flex h-12 items-center justify-center rounded-full bg-acacia-600 font-bold text-white">
        Manage participants
      </Link>
    );
  }

  const current = viewer?.requestStatus;
  const live = current && ['REQUESTED', 'APPROVED', 'WAITLIST'].includes(current);

  return (
    <div className="grid gap-3">
      {current && <p className="rounded-xl bg-[color:var(--color-cream)] p-3 text-sm font-medium text-acacia-700">{STATUS_TEXT[current]}</p>}
      {viewer?.onlineDetails && (
        <div className="rounded-xl border border-safari-100 bg-safari-50 p-3 text-sm">
          <p className="font-bold text-acacia-700">How to join online</p>
          <p className="mt-1 whitespace-pre-line text-ink-soft">{viewer.onlineDetails}</p>
        </div>
      )}
      {!live && (
        <>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder="A short note to the organiser (optional)" className="field" />
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api.post(`/community/activities/${slug}/join`, { message: message || undefined });
                await load();
              } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : 'Could not send your request.');
              } finally {
                setBusy(false);
              }
            }}
            className="h-12 rounded-full bg-clay-400 font-bold text-acacia-700 hover:bg-clay-500 hover:text-white disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Request to join'}
          </button>
        </>
      )}
      {live && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.post(`/community/activities/${slug}/leave`);
              await load();
            } finally {
              setBusy(false);
            }
          }}
          className="h-11 rounded-full border border-line-strong text-sm font-semibold text-ink-muted"
        >
          Withdraw my request
        </button>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
