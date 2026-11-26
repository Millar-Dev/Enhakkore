'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** Counts one view of a listing for the popularity engine (once per visitor per day, server-side). */
export function TrackView({ subjectType, subjectId }: { subjectType: string; subjectId: string }) {
  useEffect(() => {
    api.post('/public/track', { subjectType, subjectId, kind: 'VIEW' }).catch(() => undefined);
  }, [subjectType, subjectId]);
  return null;
}

/** Native share on phones, copy-the-link elsewhere. Counts a share. */
export function ShareButton({ subjectType, subjectId, title }: { subjectType: string; subjectId: string; title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = window.location.href;
        try {
          if (navigator.share) await navigator.share({ title, url });
          else {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
          api.post('/public/track', { subjectType, subjectId, kind: 'SHARE' }).catch(() => undefined);
        } catch {
          /* the person cancelled the share sheet */
        }
      }}
      className="inline-flex h-9 items-center rounded-full border border-line-strong bg-white px-3.5 text-xs font-bold text-acacia-700 hover:border-acacia-600"
    >
      {copied ? 'Link copied ✓' : 'Share'}
    </button>
  );
}
