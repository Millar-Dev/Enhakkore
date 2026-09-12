'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { DestinationSummary } from '@enhakkore/shared';
import { Button, Icon, cx } from '@/components/ui';
import { api, query } from '@/lib/api';

/**
 * The hero search.
 *
 * Three inputs — where, when, how many — because those are the three questions
 * a traveller can actually answer before they know what exists. Everything else
 * belongs on the results page, where they can see what they are narrowing.
 */
export function SearchBar({ variant = 'hero' }: { variant?: 'hero' | 'inline' }) {
  const router = useRouter();
  const [destination, setDestination] = useState('');
  const [from, setFrom] = useState('');
  const [travellers, setTravellers] = useState('1');
  const [suggestions, setSuggestions] = useState<DestinationSummary[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLFormElement>(null);

  // Debounced typeahead. Short enough to feel instant, long enough not to fire
  // a request per keystroke.
  useEffect(() => {
    if (destination.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const result = await api.get<{ items: DestinationSummary[] }>(
          `/destinations/search${query({ q: destination.trim() })}`,
          { token: null },
        );
        setSuggestions(result.items);
        setOpen(result.items.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [destination]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    router.push(
      `/trips${query({
        q: destination.trim() || undefined,
        from: from || undefined,
        minGroup: travellers !== '1' ? travellers : undefined,
      })}`,
    );
  }

  const hero = variant === 'hero';

  return (
    <form
      onSubmit={submit}
      ref={wrapRef}
      className={cx(
        'relative w-full',
        hero
          ? 'rounded-[1.25rem] bg-white/97 p-2 shadow-[--shadow-float] backdrop-blur-xl md:rounded-[--radius-pill] md:p-2.5'
          : 'rounded-[--radius-card] border border-line bg-white p-2',
      )}
    >
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-0">
        {/* Where */}
        <div className="relative flex-[1.6] md:px-5">
          <label htmlFor="search-destination" className="block px-3.5 pt-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-ink-muted md:px-0 md:pt-0">
            Where do you want to go?
          </label>
          <input
            id="search-destination"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Serengeti, Zanzibar, anywhere…"
            autoComplete="off"
            className="h-11 w-full bg-transparent px-3.5 text-[0.9375rem] font-medium text-ink placeholder:font-normal placeholder:text-ink-faint focus:outline-none md:px-0"
          />

          {open && (
            <ul className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-[--radius-card] border border-line bg-white py-2 shadow-[--shadow-raised] md:left-2">
              {suggestions.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setDestination(item.name);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-sand"
                  >
                    <Icon.pin size={15} className="shrink-0 text-ink-faint" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.875rem] font-semibold text-ink">{item.name}</span>
                      <span className="block truncate text-[0.75rem] text-ink-muted">{item.country}</span>
                    </span>
                    {item.tripCount !== undefined && item.tripCount > 0 && (
                      <span className="shrink-0 text-[0.75rem] text-ink-faint">{item.tripCount} trips</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="hidden h-9 w-px bg-line md:block" />

        {/* When */}
        <div className="flex-1 border-t border-line md:border-0 md:px-5">
          <label htmlFor="search-from" className="block px-3.5 pt-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-ink-muted md:px-0 md:pt-0">
            Dates
          </label>
          <input
            id="search-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-11 w-full bg-transparent px-3.5 text-[0.9375rem] font-medium text-ink focus:outline-none md:px-0"
          />
        </div>

        <div className="hidden h-9 w-px bg-line md:block" />

        {/* How many */}
        <div className="border-t border-line md:w-40 md:border-0 md:px-5">
          <label htmlFor="search-travellers" className="block px-3.5 pt-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-ink-muted md:px-0 md:pt-0">
            Travellers
          </label>
          <select
            id="search-travellers"
            value={travellers}
            onChange={(event) => setTravellers(event.target.value)}
            className="h-11 w-full cursor-pointer appearance-none bg-transparent px-3.5 text-[0.9375rem] font-medium text-ink focus:outline-none md:px-0"
          >
            {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((count) => (
              <option key={count} value={count}>
                {count} {count === 1 ? 'traveller' : 'travellers'}
              </option>
            ))}
          </select>
        </div>

        <div className="p-1.5 md:p-0">
          <Button type="submit" size={hero ? 'lg' : 'md'} full className="md:w-auto md:rounded-[--radius-pill] md:px-8">
            <Icon.search size={17} />
            Search trips
          </Button>
        </div>
      </div>
    </form>
  );
}
