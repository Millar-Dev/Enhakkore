'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface Suggestion {
  label: string;
  kind: string;
  href: string;
}

const EXAMPLES = ['Free Fire tournaments', 'Basketball', 'Restaurants in Zanzibar', 'Hotels in Dar es Salaam', 'Arusha Escape', 'Beaches'];

/** The search that opens from the header: one field, live suggestions, nothing else until asked. */
export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);

  useEffect(() => {
    input.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) return setItems([]);
    const timer = setTimeout(() => {
      api.get<{ items: Suggestion[] }>(`/public/suggest?q=${encodeURIComponent(text)}`).then((data) => setItems(data.items)).catch(() => setItems([]));
    }, 180);
    return () => clearTimeout(timer);
  }, [q]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-acacia-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto mt-2 w-[calc(100%-1rem)] max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <form
          className="flex items-center gap-2 border-b border-line px-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink-muted" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={input}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search places, trips, activities, games…"
            className="h-14 flex-1 bg-transparent text-[1rem] outline-none"
            aria-label="Search Enhakkore"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls="search-suggestions"
          />
          <button type="button" onClick={onClose} className="text-sm font-semibold text-ink-muted">Close</button>
        </form>
        <ul id="search-suggestions" role="listbox" className="max-h-[60vh] overflow-y-auto">
          {items.map((item) => (
            <li key={`${item.kind}-${item.href}`} role="option" aria-selected="false">
              <button type="button" onClick={() => go(item.href)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-sand">
                <span className="truncate font-semibold text-ink">{item.label}</span>
                <span className="shrink-0 text-[0.6875rem] font-bold uppercase tracking-wider text-clay-600">{item.kind}</span>
              </button>
            </li>
          ))}
          {q.trim().length >= 2 && (
            <li>
              <button type="button" onClick={() => go(`/search?q=${encodeURIComponent(q.trim())}`)} className="w-full px-4 py-3 text-left text-sm font-semibold text-acacia-600 hover:bg-sand">
                See all results for “{q.trim()}” →
              </button>
            </li>
          )}
        </ul>
        {q.trim().length < 2 && (
          <div className="px-4 py-3">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-ink-muted">Try</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((example) => (
                <Link key={example} href={`/search?q=${encodeURIComponent(example)}`} onClick={onClose} className="chip">{example}</Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
