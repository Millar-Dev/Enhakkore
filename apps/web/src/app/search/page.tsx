import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/layout/PublicShell';
import { SmartImage } from '@/components/public/SmartImage';
import { apiGet, query } from '@/lib/api';
import { getCatalogue, pick } from '@/lib/public';

export const metadata: Metadata = { title: 'Search' };

interface Result { kind: string; type: string; title: string; href: string; where: string; image: string | null; isDemo?: boolean; past?: boolean }
interface Data {
  results: Result[];
  interpreted: { keyword: string; categories: string[]; city: string | null; country: string | null } | null;
}

const TYPES = [
  { value: '', label: 'Everything' },
  { value: 'trip', label: 'Trips' },
  { value: 'place', label: 'Places' },
  { value: 'activity', label: 'Activities' },
  { value: 'event', label: 'Events' },
  { value: 'tournament', label: 'Gaming' },
  { value: 'community', label: 'Communities' },
  { value: 'experience', label: 'Experiences' },
];

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pick(await searchParams, ['q', 'type', 'country', 'city', 'from', 'to', 'filters']);
  const q = (params.q ?? '').trim();
  const active = q.length >= 2 || !!params.country || !!params.city || !!params.type;
  const [data, catalogue] = await Promise.all([active ? apiGet<Data>(`/public/search${query({ q, type: params.type, country: params.country, city: params.city, from: params.from, to: params.to })}`, 30) : null, getCatalogue()]);
  const showFilters = params.filters === '1' || !!params.country || !!params.city || !!params.from || !!params.to;
  const country = catalogue.countries.find((item) => item.code === params.country);
  const link = (changes: Record<string, string | undefined>) => `/search${query({ ...params, ...changes })}`;
  const where = data?.interpreted ? [data.interpreted.city, data.interpreted.country].filter(Boolean).join(', ') : '';

  return (
    <PublicShell>
      <section className="bg-acacia-700 text-white">
        <div className="shell max-w-3xl py-5 md:py-8">
          <form action="/search" className="flex items-center gap-1 rounded-full bg-white p-1 pl-4 text-ink">
            {params.type && <input type="hidden" name="type" value={params.type} />}
            <input name="q" defaultValue={q} placeholder="Search — e.g. restaurants in Arusha" className="h-10 min-w-0 flex-1 bg-transparent outline-none" aria-label="Search" />
            <button className="h-10 rounded-full bg-acacia-600 px-4 text-sm font-bold text-white">Search</button>
          </form>
          <div className="mt-3 flex items-center gap-3 text-xs">
            <Link href={link({ filters: showFilters ? undefined : '1' })} className="inline-flex min-h-10 items-center font-semibold text-clay-400">{showFilters ? 'Hide filters' : 'Filters'}</Link>
            {active && <Link href="/search" className="inline-flex min-h-10 min-w-10 items-center justify-center px-2 text-white/70 underline">Clear</Link>}
          </div>
          {showFilters && (
            <form action="/search" className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-white/10 p-2 sm:grid-cols-4">
              <input type="hidden" name="q" value={q} />
              <input type="hidden" name="filters" value="1" />
              {params.type && <input type="hidden" name="type" value={params.type} />}
              <select name="country" defaultValue={params.country ?? ''} className="field h-10 text-ink" aria-label="Country">
                <option value="">Any country</option>
                {catalogue.countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              </select>
              <select name="city" defaultValue={params.city ?? ''} className="field h-10 text-ink" aria-label="City">
                <option value="">Any city</option>
                {(country?.cities ?? catalogue.countries.flatMap((item) => item.cities)).map((city) => <option key={city.slug} value={city.slug}>{city.name}</option>)}
              </select>
              <input type="date" name="from" defaultValue={params.from} className="field h-10 text-ink" aria-label="From date" />
              <input type="date" name="to" defaultValue={params.to} className="field h-10 text-ink" aria-label="To date" />
              <button className="col-span-2 h-10 rounded-full bg-clay-400 text-sm font-bold text-acacia-700 sm:col-span-4">Apply filters</button>
            </form>
          )}
        </div>
      </section>
      <section className="shell max-w-3xl py-5 md:py-8">
        <div className="no-scrollbar -mx-5 mb-4 flex gap-1.5 overflow-x-auto px-5 md:mx-0 md:px-0">
          {TYPES.map((type) => (
            <Link key={type.value} href={link({ type: type.value || undefined })} className={`chip shrink-0 ${(params.type ?? '') === type.value ? 'chip-active' : ''}`}>{type.label}</Link>
          ))}
        </div>
        {!active ? (
          <p className="text-ink-muted">Search trips, places, activities, events, tournaments, communities and destinations. Try “Free Fire tournaments”, “hotels in Dar es Salaam” or “safaris in Tanzania”.</p>
        ) : (
          <>
            {data?.interpreted && (where || data.interpreted.categories.length > 0) && (
              <p className="mb-3 text-sm text-ink-muted">
                Showing {data.interpreted.categories.length ? <strong className="text-ink">{data.interpreted.categories.slice(0, 3).join(', ').toLowerCase()}</strong> : <>results for <strong className="text-ink">“{data.interpreted.keyword}”</strong></>}
                {where && <> in <strong className="text-ink">{where}</strong></>}
              </p>
            )}
            {!data?.results.length ? (
              <p className="text-ink-muted">Nothing found. Try a different word, a city or a country — or clear the filters.</p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
                {data.results.map((result) => (
                  <li key={result.href}>
                    <Link href={result.href} className="flex items-center gap-3 p-3 hover:bg-sand">
                      <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-lg bg-acacia-700">{result.image && <SmartImage src={result.image} alt="" fill sizes="64px" className="object-cover" />}</div>
                      <div className="min-w-0">
                        <p className="text-[0.625rem] font-bold uppercase tracking-wider text-clay-600">{result.kind}{result.isDemo ? ' · demo' : ''}{result.past ? ' · past' : ''}</p>
                        <p className="truncate font-semibold text-ink">{result.title}</p>
                        <p className="truncate text-xs text-ink-muted">{result.where}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </PublicShell>
  );
}
