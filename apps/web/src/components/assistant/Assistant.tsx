'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { SUGGESTIONS } from '@/lib/assistant/knowledge';
import { cx } from '@/components/ui';

/* ==========================================================================
   Ask Enhakkore
   --------------------------------------------------------------------------
   A question box, bottom right. It answers from what is published on this
   site and nothing else, and when it does not know it says so and gives a
   phone number rather than inventing a departure time.

   It is deliberately quiet: closed it is one small button, it never opens
   itself, and it does not follow anyone around the page. The panel traps
   focus while open, closes on Escape, and announces new replies to a screen
   reader.
   ========================================================================== */

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  href?: string;
}

const GREETING: Turn = {
  role: 'assistant',
  content:
    'Ask me about our trips, what a price covers, how booking and payment work, or the community work. If I do not know, I will say so and point you to someone who does.',
};

export function Assistant() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([GREETING]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  // Escape closes, and focus goes back to the button that opened it.
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        opener.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Keep the latest reply in view.
  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;

    const history = turns
      .filter((turn) => turn !== GREETING)
      .map(({ role, content }) => ({ role, content }));

    setTurns((current) => [...current, { role: 'user', content: text }]);
    setDraft('');
    setBusy(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      const body = (await response.json()) as { reply?: string; href?: string; error?: string };
      setTurns((current) => [
        ...current,
        {
          role: 'assistant',
          content:
            body.reply ??
            body.error ??
            'Something went wrong at my end. Please try again, or call us.',
          href: body.href,
        },
      ]);
    } catch {
      setTurns((current) => [
        ...current,
        {
          role: 'assistant',
          content:
            'I could not reach the server just then. Check your connection and try again — or call us on +255 745 341 440.',
          href: '/contact',
        },
      ]);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  return (
    <>
      {/* Opener */}
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="assistant-panel"
        className={cx(
          'fixed bottom-20 right-4 z-40 inline-flex items-center gap-2.5 rounded-[var(--radius-pill)] py-3 pl-4 pr-5 shadow-lg transition-all duration-300 md:bottom-6 md:right-6',
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-gold-500/30',
          open
            ? 'pointer-events-none scale-90 opacity-0'
            : 'scale-100 bg-acacia-600 text-white opacity-100 hover:-translate-y-0.5 hover:bg-acacia-700',
        )}
      >
        <SparkGlyph />
        <span className="text-[0.875rem] font-bold">Ask us</span>
      </button>

      {/* Panel */}
      <div
        id="assistant-panel"
        ref={panel}
        role="dialog"
        aria-label="Ask Enhakkore"
        aria-modal="false"
        className={cx(
          'fixed bottom-20 right-3 z-40 flex w-[calc(100vw-1.5rem)] max-w-[23rem] flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper shadow-2xl transition-all duration-300 md:bottom-6 md:right-6',
          open
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-4 scale-95 opacity-0',
        )}
        style={{ maxHeight: 'min(32rem, calc(100svh - 7rem))' }}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line bg-acacia-600 px-4 py-3 text-white">
          <span className="flex items-center gap-2">
            <SparkGlyph />
            <span className="text-[0.9375rem] font-bold">Ask Enhakkore</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              opener.current?.focus();
            }}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div ref={thread} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {turns.map((turn, index) => (
            <div
              key={index}
              className={cx('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cx(
                  'max-w-[85%] rounded-[var(--radius-card)] px-3.5 py-2.5 text-[0.875rem] leading-relaxed',
                  turn.role === 'user'
                    ? 'bg-acacia-600 text-white'
                    : 'bg-sand text-ink',
                )}
              >
                {turn.content}
                {turn.href && (
                  <Link
                    href={turn.href}
                    onClick={() => setOpen(false)}
                    className="mt-2 block font-semibold text-acacia-700 underline underline-offset-4"
                  >
                    Open the page →
                  </Link>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-[var(--radius-card)] bg-sand px-3.5 py-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint"
                    style={{ animationDelay: `${i * 140}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          <p aria-live="polite" className="sr-only">
            {busy ? 'Thinking' : turns[turns.length - 1]?.content}
          </p>

          {turns.length === 1 && (
            <ul className="space-y-2 pt-1">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => void ask(suggestion)}
                    className="w-full rounded-[var(--radius-field)] border border-line-strong px-3 py-2 text-left text-[0.8125rem] font-medium text-ink transition-colors hover:border-ink hover:bg-sand"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void ask(draft);
          }}
          className="flex items-center gap-2 border-t border-line p-3"
        >
          <input
            ref={input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask a question…"
            maxLength={500}
            aria-label="Your question"
            className="h-11 flex-1 rounded-[var(--radius-field)] border border-line-strong bg-white px-3 text-[0.875rem] text-ink placeholder:text-ink-faint focus:border-acacia-600 focus:outline-none focus:ring-4 focus:ring-acacia-600/10"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="Send"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-field)] bg-acacia-600 text-white transition-colors hover:bg-acacia-700 disabled:bg-line-strong disabled:text-ink-faint"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 10h12M10 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}

/** A small four-point spark — an assistant, without a robot face. */
function SparkGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M10 1.5l1.7 4.9 4.8 1.7-4.8 1.7L10 14.7 8.3 9.8 3.5 8.1l4.8-1.7L10 1.5z" />
      <path d="M15.6 12.8l.8 2.2 2.1.8-2.1.8-.8 2.2-.8-2.2-2.1-.8 2.1-.8.8-2.2z" opacity="0.65" />
    </svg>
  );
}
