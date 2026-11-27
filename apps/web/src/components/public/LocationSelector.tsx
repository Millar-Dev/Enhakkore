'use client';

import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { COUNTRIES, slugify } from '@enhakkore/shared';
import { api } from '@/lib/api';

/**
 * One location picker for the whole site (Explore, Experiences, Travel,
 * Gaming, Communities, Search).
 *
 * 1. "Use my current location" — only if the visitor allows it; the nearest
 *    town is looked up on our own server (GeoNames data), nothing is sent to a
 *    third party. If permission is refused, choosing by hand works as normal.
 * 2. Countries: every recognised country and territory, searchable.
 * 3. Cities: once a country is chosen, its cities and towns (GeoNames, about
 *    135,000 worldwide), searchable; or "Any city".
 * 4. "Anywhere / Worldwide" clears the location.
 *
 * The choice goes into the page address (?country=TZ&city=dar-es-salaam) so
 * results can be shared, and is remembered on this device.
 */

const flag = (code: string) => String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
const fold = (value: string) => value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STORE = 'enh.location';

interface CityOption {
  name: string;
  slug: string;
}

export function LocationSelector({
  country,
  city,
  tone = 'dark',
  className = '',
  compact = false,
}: {
  /** Current country code (or slug) from the page address. */
  country?: string;
  /** Current city slug from the page address. */
  city?: string;
  tone?: 'dark' | 'light';
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'country' | 'city'>('country');
  const [query, setQuery] = useState('');
  const [chosenCountry, setChosenCountry] = useState<string>('');
  const [chosenCity, setChosenCity] = useState<CityOption | null>(null);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [locating, setLocating] = useState<'idle' | 'busy' | 'denied' | 'failed'>('idle');

  const current = COUNTRIES.find((item) => item.code.toLowerCase() === country?.toLowerCase() || slugify(item.name) === country?.toLowerCase());
  const cityName = city ? city.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') : '';
  const label = current ? (city ? `${cityName}, ${current.name}` : current.name) : 'Anywhere';

  // Open with the current choice selected.
  useEffect(() => {
    if (!open) return;
    setChosenCountry(current?.code ?? '');
    setChosenCity(city ? { name: cityName, slug: city } : null);
    setTab(current ? 'city' : 'country');
    setQuery('');
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cities of the chosen country, searched as you type.
  useEffect(() => {
    if (!open || tab !== 'city' || !chosenCountry) return;
    const timer = setTimeout(() => {
      setLoadingCities(true);
      api
        .get<{ items: { name: string }[] }>(`/public/geo/cities?country=${chosenCountry}&q=${encodeURIComponent(query)}`)
        .then((data) => setCities(data.items.map((item) => ({ name: item.name, slug: slugify(item.name) }))))
        .catch(() => setCities([]))
        .finally(() => setLoadingCities(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [open, tab, chosenCountry, query]);

  const countries = useMemo(() => {
    const q = fold(query.trim());
    const list = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
    return q ? list.filter((item) => fold(item.name).includes(q) || item.code.toLowerCase() === q) : list;
  }, [query]);

  const apply = (countryCode: string, citySlug: string | null) => {
    const params = new URLSearchParams(window.location.search);
    params.delete('page');
    if (countryCode) params.set('country', countryCode);
    else params.delete('country');
    if (citySlug) params.set('city', citySlug);
    else params.delete('city');
    try {
      localStorage.setItem(STORE, JSON.stringify({ country: countryCode, city: citySlug }));
    } catch {
      /* private mode */
    }
    setOpen(false);
    const text = params.toString();
    router.push(text ? `${pathname}?${text}` : pathname);
  };

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocating('failed');
      return;
    }
    setLocating('busy');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const found = await api.get<{ country: string; city: { name: string } }>(`/public/geo/nearest?lat=${position.coords.latitude}&lng=${position.coords.longitude}`);
          setLocating('idle');
          apply(found.country, slugify(found.city.name));
        } catch {
          setLocating('failed');
        }
      },
      (error) => setLocating(error.code === error.PERMISSION_DENIED ? 'denied' : 'failed'),
      { timeout: 10000, maximumAge: 600000 },
    );
  };

  const chosen = COUNTRIES.find((item) => item.code === chosenCountry);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`inline-flex h-11 max-w-full items-center gap-2 rounded-full border px-3.5 text-left text-[0.8125rem] font-semibold ${tone === 'dark' ? 'border-white/35 text-white hover:border-clay-400' : 'border-line-strong bg-white text-acacia-700 hover:border-acacia-600'} ${className}`}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
          <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </svg>
        <span className={`min-w-0 truncate ${compact ? 'max-w-[9rem]' : ''}`}>{label}</span>
        <span className="text-[0.625rem] opacity-70" aria-hidden>▾</span>
      </button>

      {open &&
        createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Choose location">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="enh-fade-in relative flex h-[min(42rem,92svh)] w-full flex-col overflow-hidden rounded-t-3xl bg-[#06172b] text-white shadow-2xl sm:max-w-md sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">✕</button>
              <p className="font-bold">Choose location</p>
              <button type="button" onClick={() => apply('', null)} className="inline-flex h-11 items-center px-2 text-xs font-semibold text-clay-400">Anywhere</button>
            </div>

            <div className="px-4 pt-3">
              <button type="button" onClick={useMyLocation} disabled={locating === 'busy'} className="flex w-full items-center gap-3 rounded-2xl border border-clay-400/70 bg-clay-400/10 px-4 py-3 text-left">
                <span className="text-clay-400" aria-hidden>◎</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{locating === 'busy' ? 'Finding you…' : 'Use my current location'}</span>
                  <span className="block text-xs text-white/65">
                    {locating === 'denied' ? 'Location permission was not given — choose below instead.' : locating === 'failed' ? 'Your location could not be found — choose below instead.' : 'Only if you allow it. Used once to pick the nearest town.'}
                  </span>
                </span>
              </button>

              <div className="mt-3 grid grid-cols-2 rounded-full bg-white/5 p-1 text-sm font-semibold" role="tablist">
                <button type="button" role="tab" aria-selected={tab === 'country'} onClick={() => { setTab('country'); setQuery(''); }} className={`h-10 rounded-full ${tab === 'country' ? 'bg-clay-400 text-acacia-700' : 'text-white/80'}`}>Country</button>
                <button type="button" role="tab" aria-selected={tab === 'city'} disabled={!chosenCountry} onClick={() => { setTab('city'); setQuery(''); }} className={`h-10 rounded-full disabled:opacity-40 ${tab === 'city' ? 'bg-clay-400 text-acacia-700' : 'text-white/80'}`}>City</button>
              </div>

              {tab === 'city' && chosen && (
                <button type="button" onClick={() => { setTab('country'); setQuery(''); }} className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-semibold">
                  <span className="text-lg" aria-hidden>{flag(chosen.code)}</span>
                  {chosen.name}
                  <span className="ml-auto text-xs text-clay-400">Change</span>
                </button>
              )}

              <label className="mt-3 flex h-11 items-center gap-2 rounded-full border border-white/20 px-4">
                <span aria-hidden className="text-white/60">⌕</span>
                <span className="sr-only">{tab === 'country' ? 'Search country' : 'Search city'}</span>
                <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === 'country' ? 'Search country…' : `Search city in ${chosen?.name ?? 'country'}…`} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/45" />
              </label>
            </div>

            <ul className="no-scrollbar mt-2 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
              {tab === 'country' ? (
                countries.map((item) => (
                  <li key={item.code}>
                    <button
                      type="button"
                      onClick={() => {
                        setChosenCountry(item.code);
                        setChosenCity(null);
                        setTab('city');
                        setQuery('');
                      }}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-white/5 ${chosenCountry === item.code ? 'bg-white/10 font-bold' : ''}`}
                    >
                      <span className="text-xl" aria-hidden>{flag(item.code)}</span>
                      <span className="flex-1">{item.name}</span>
                      {chosenCountry === item.code ? <span className="text-clay-400" aria-label="Chosen">✓</span> : <span className="text-white/35" aria-hidden>›</span>}
                    </button>
                  </li>
                ))
              ) : (
                <>
                  <li>
                    <button type="button" onClick={() => setChosenCity(null)} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-white/5 ${!chosenCity ? 'bg-white/10 font-bold' : ''}`}>
                      <span aria-hidden>🌐</span>
                      <span className="flex-1">Any city in {chosen?.name}</span>
                      {!chosenCity && <span className="text-clay-400">✓</span>}
                    </button>
                  </li>
                  {loadingCities && <li className="px-3 py-2 text-xs text-white/55">Searching…</li>}
                  {cities.map((item) => (
                    <li key={item.slug + item.name}>
                      <button type="button" onClick={() => setChosenCity(item)} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-white/5 ${chosenCity?.slug === item.slug ? 'bg-white/10 font-bold' : ''}`}>
                        <span className="text-clay-400" aria-hidden>📍</span>
                        <span className="flex-1">{item.name}</span>
                        {chosenCity?.slug === item.slug && <span className="text-clay-400">✓</span>}
                      </button>
                    </li>
                  ))}
                  {!loadingCities && cities.length === 0 && <li className="px-3 py-2 text-xs text-white/55">No match. Try another spelling, or choose “Any city”.</li>}
                  <li className="px-3 pb-2 pt-3 text-[0.625rem] text-white/40">City data © GeoNames (geonames.org), CC BY 4.0</li>
                </>
              )}
            </ul>

            <div className="border-t border-white/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button type="button" disabled={!chosenCountry} onClick={() => apply(chosenCountry, chosenCity?.slug ?? null)} className="h-12 w-full rounded-full bg-clay-400 text-sm font-bold text-acacia-700 disabled:opacity-50">
                {chosen ? `Apply — ${chosenCity ? `${chosenCity.name}, ` : ''}${chosen.name}` : 'Choose a country'}
              </button>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
