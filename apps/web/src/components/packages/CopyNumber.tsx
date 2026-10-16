'use client';

import { useState } from 'react';
import { Icon, cx } from '@/components/ui';

/**
 * A payment number with a copy button.
 *
 * Numbers are typed into a phone keypad under time pressure, and a single
 * wrong digit sends money to a stranger. Copying removes that. The number is
 * also shown in full, in a monospaced face with the digits spaced, so it can
 * be read aloud or typed by anyone whose clipboard does not cooperate.
 */
export function CopyNumber({
  kind,
  number,
  name,
}: {
  kind: string;
  number: string;
  /** The account holder, where one has been given. */
  name?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard blocked (insecure context, or permission refused). The
      // number is on screen regardless, so there is nothing to recover from.
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-field)] border border-line-strong bg-white p-4">
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">{kind}</p>
        <p className="mt-1 font-mono text-[1.375rem] font-bold leading-none tracking-[0.06em] text-navy-700">
          {number}
        </p>
        {name && <p className="mt-1.5 text-[0.875rem] text-ink-muted">{name}</p>}
      </div>

      <button
        type="button"
        onClick={copy}
        className={cx(
          'inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-pill)] border px-4 py-2.5 text-[0.8125rem] font-semibold transition-colors duration-150',
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-gold-500/25',
          copied
            ? 'border-acacia-600 bg-acacia-50 text-acacia-700'
            : 'border-line-strong bg-white text-ink hover:border-ink',
        )}
      >
        {copied ? (
          <Icon.check size={14} />
        ) : (
          <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.8" />
            <path d="M10.5 3.5A1.5 1.5 0 0 0 9 2H4a2 2 0 0 0-2 2v5a1.5 1.5 0 0 0 1.5 1.5" strokeLinecap="round" />
          </svg>
        )}
        {copied ? 'Copied' : 'Copy number'}
      </button>
    </div>
  );
}
