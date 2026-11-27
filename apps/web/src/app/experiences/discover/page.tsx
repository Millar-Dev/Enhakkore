import type { Metadata } from 'next';
import Link from 'next/link';
import { EXPERIENCE_SECTION_NAMES } from '@enhakkore/shared';
import type { UpcomingCard } from '@/components/home/types';
import { PublicShell } from '@/components/layout/PublicShell';
import { AppHero } from '@/components/public/AppHero';
import { Empty } from '@/components/public/Cards';
import { UpcomingGrid } from '@/components/public/UpcomingGrid';
import { apiGet, query } from '@/lib/api';
import { pick } from '@/lib/public';
import { getSite } from '@/lib/site';

export const metadata: Metadata = { title: 'Discover experiences', description: 'Every upcoming event, activity and tournament, with filters.' };
export const revalidate = 60;

interface DiscoverData {
  total: number;
  items: UpcomingCard[];
  categories: { name: string; slug: string }[];
  sections: { key: string; label: string; icon: string }[];
}

const KEYS = ['q', 'country', 'city', 'section', 'category', 'from', 'to', 'price', 'mode', 'age', 'availability', 'sort'] as const;

/** Discover: filter by date, category, subcategory, free or paid, online or in person, age and availability. */
export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pick(await searchParams, [...KEYS]);
  const [data, { settings }] = await Promise.all([apiGet<DiscoverData>(`/public/experiences-discover${query(params)}`, 60), getSite()]);
  const selectClass = 'field h-12 w-full';
  const active = KEYS.filter((key) => !['q', 'country', 'city', 'sort'].includes(key) && params[key]).length;
  return (
    <PublicShell>
      <AppHero
        title="Discover Experiences"
        subtitle="Everything coming up — filter it your way"
        image={settings.pages.experiencesHeroImage}
        search={{ action: '/experiences/discover', placeholder: 'Search events, activities, tournaments…', value: params.q, hidden: { country: params.country, city: params.city } }}
        location={{ country: params.country, city: params.city }}
      />
      <section className="band band-ivory">
        <div className="shell py-6 md:py-10">
          <form action="/experiences/discover" className="grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
            {params.q && <input type="hidden" name="q" value={params.q} />}
            {params.country && <input type="hidden" name="country" value={params.country} />}
            {params.city && <input type="hidden" name="city" value={params.city} />}
            <label className="grid gap-1 text-xs font-semibold text-ink-soft">Category
              <select name="section" defaultValue={params.section ?? ''} className={selectClass}>
                <option value="">All categories</option>
                {(data?.sections ?? []).map((section) => <option key={section.key} value={section.key}>{EXPERIENCE_SECTION_NAMES[section.key as keyof typeof EXPERIENCE_SECTION_NAMES] ?? section.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-ink-soft">Subcategory
              <select name="category" defaultValue={params.category ?? ''} className={selectClass} disabled={!data?.categories.length}>
                <option value="">{params.section ? 'All' : 'Choose a category first'}</option>
                {(data?.categories ?? []).map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-ink-soft">From<input type="date" name="from" defaultValue={params.from} className={selectClass} /></label>
            <label className="grid gap-1 text-xs font-semibold text-ink-soft">To<input type="date" name="to" defaultValue={params.to} className={selectClass} /></label>
            <label className="grid gap-1 text-xs font-semibold text-ink-soft">Price
              <select name="price" defaultValue={params.price ?? ''} className={selectClass}><option value="">Free or paid</option><option value="free">Free</option><option value="paid">Paid</option></select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-ink-soft">Format
              <select name="mode" defaultValue={params.mode ?? ''} className={selectClass}><option value="">Online or in person</option><option value="in-person">In person</option><option value="online">Online</option></select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-ink-soft">Age
              <select name="age" defaultValue={params.age ?? ''} className={selectClass}><option value="">Any</option><option value="all">No age limit stated</option><option value="adults">Adults only (18+)</option></select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-ink-soft">Availability
              <select name="availability" defaultValue={params.availability ?? ''} className={selectClass}><option value="">Everything</option><option value="open">Places still open</option></select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-ink-soft">Sort
              <select name="sort" defaultValue={params.sort ?? 'soonest'} className={selectClass}><option value="soonest">Soonest first</option><option value="newest">Recently added</option><option value="popular">Popular</option></select>
            </label>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <button className="h-12 rounded-full bg-acacia-600 px-6 font-bold text-white">Show results</button>
              {active > 0 && <Link href={`/experiences/discover${query({ q: params.q, country: params.country, city: params.city })}`} className="inline-flex h-12 items-center px-3 text-sm font-semibold text-acacia-700 underline">Clear {active} filter{active === 1 ? '' : 's'}</Link>}
            </div>
          </form>
          <p className="mt-5 text-sm text-ink-muted">{data ? `${data.total} result${data.total === 1 ? '' : 's'}` : 'Could not load results right now.'}</p>
          <div className="mt-3">
            {data?.items.length ? (
              <UpcomingGrid items={data.items} limit={60} />
            ) : (
              <Empty title="Nothing matches these filters" body="Try fewer filters or another place. New experiences appear as soon as they are published." action={<Link href="/experiences/host" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Host an experience</Link>} />
            )}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
