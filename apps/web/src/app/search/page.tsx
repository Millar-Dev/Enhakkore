import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/layout/PublicShell';
import { SmartImage } from '@/components/public/SmartImage';
import { apiGet } from '@/lib/api';

export const metadata: Metadata = { title: 'Search' };

interface Result { kind: string; title: string; href: string; where: string; image: string | null }

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim();
  const data = q.length >= 2 ? await apiGet<{ results: Result[] }>(`/public/search?q=${encodeURIComponent(q)}`, 30) : null;
  return (
    <PublicShell>
      <section className="bg-[color:var(--color-cream)]">
        <div className="shell max-w-3xl py-12">
          <h1 className="display-md text-acacia-700">Search Enhakkore</h1>
          <form action="/search" className="mt-5 flex gap-2">
            <input name="q" defaultValue={q} autoFocus placeholder="Basketball, Arusha, beach, Lagos…" className="field h-14 text-lg" />
            <button className="h-14 shrink-0 rounded-[var(--radius-field)] bg-acacia-600 px-6 font-bold text-white">Search</button>
          </form>
        </div>
      </section>
      <section className="shell max-w-3xl py-10">
        {q.length < 2 ? <p className="text-ink-muted">Search trips, activities, events, places, experiences and destinations.</p> : !data?.results.length ? (
          <p className="text-ink-muted">Nothing found for “{q}”. Try a city, a country or an activity.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {data.results.map((result) => (
              <li key={result.href}>
                <Link href={result.href} className="flex items-center gap-4 p-4 hover:bg-sand">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[color:var(--color-cream-deep)]">{result.image && <SmartImage src={result.image} alt="" fill sizes="56px" className="object-cover" />}</div>
                  <div className="min-w-0">
                    <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-clay-600">{result.kind}</p>
                    <p className="truncate font-semibold text-ink">{result.title}</p>
                    <p className="truncate text-sm text-ink-muted">{result.where}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PublicShell>
  );
}
