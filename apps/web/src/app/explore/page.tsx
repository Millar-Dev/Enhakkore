import type { Metadata } from 'next';
import Link from 'next/link';
import { EXPLORE_SECTIONS } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { AppHero } from '@/components/public/AppHero';
import { CardGrid, Empty } from '@/components/public/Cards';
import { Filters, Pager } from '@/components/public/Filters';
import { PlaceCard } from '@/components/public/listings';
import { cx } from '@/components/ui';
import { getCatalogue, getList, pick } from '@/lib/public';
import { getSite } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Stays, food and dining, venues and event spaces, places and attractions — chosen by Enhakkore, with clear labels for what has been verified.',
};
export const revalidate = 60;

const SHORT: Record<string, string> = { STAYS: 'Stays', FOOD: 'Dining', VENUES: 'Venues', ATTRACTIONS: 'Attractions' };

const SORTS = [
  { value: '', label: 'Featured' },
  { value: 'popular', label: 'Popular' },
  { value: 'recent', label: 'Recently added' },
];

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pick(await searchParams, ['section', 'country', 'city', 'category', 'q', 'page', 'hiddenGem', 'verified', 'sort']);
  const [, catalogue, list] = await Promise.all([getSite(), getCatalogue(), getList('/public/places', params)]);
  const active = EXPLORE_SECTIONS.find((section) => section.key === params.section);
  const country = catalogue.countries.find((item) => item.code.toLowerCase() === params.country?.toLowerCase() || item.slug === params.country);
  const subcategories = catalogue.categories.filter((item) => item.kind === 'PLACE' && (!active || item.section === active.key));
  const href = (changes: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, page: undefined, ...changes })) if (value) search.set(key, value);
    const text = search.toString();
    return text ? `/explore?${text}` : '/explore';
  };

  return (
    <PublicShell>
      <AppHero
        title={active ? active.label : 'Explore'}
        subtitle="Stays, dining, venues and places worth knowing"
        search={{ action: '/explore', placeholder: 'Search places (hotels, restaurants…)', value: params.q, hidden: { section: params.section, category: params.category, country: params.country, city: params.city } }}
        pills={[
          { label: country?.name ?? 'Anywhere', icon: '📍', href: '#filters', active: !!params.country },
          { label: active ? SHORT[active.key] ?? active.label : 'All categories', icon: '☰', href: '#categories', active: !!active },
        ]}
      />
      <section className="shell py-5 md:py-10">
        {/* Four ways to browse: compact icon tiles on phones, described cards on larger screens. */}
        <div id="categories" className="grid scroll-mt-24 grid-cols-4 gap-2 md:gap-3">
          {EXPLORE_SECTIONS.map((section) => {
            const on = active?.key === section.key;
            return (
              <Link
                key={section.key}
                href={href({ section: on ? undefined : section.key, category: undefined })}
                aria-current={on ? 'page' : undefined}
                className={cx('group flex flex-col items-center gap-1.5 rounded-2xl p-1.5 text-center transition lg:flex-row lg:items-start lg:gap-3 lg:border lg:p-4 lg:text-left', on ? 'lg:border-acacia-600 lg:bg-acacia-600 lg:text-white' : 'lg:border-line lg:bg-white lg:hover:border-acacia-600')}
              >
                <span className={cx('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-2xl shadow-sm transition', on ? 'border-clay-400 bg-clay-50' : 'border-line bg-white group-hover:border-acacia-600')} aria-hidden>{section.icon}</span>
                <span className="min-w-0">
                  <span className={cx('block text-xs font-semibold md:text-sm lg:hidden', on ? 'text-clay-600' : 'text-acacia-700')}>{SHORT[section.key]}</span>
                  <span className="hidden font-display text-lg leading-tight lg:block">{section.label}</span>
                  <span className={cx('hidden text-xs lg:block', on ? 'text-white/75' : 'text-ink-muted')}>{section.kinds.slice(0, 4).join(' · ')}</span>
                </span>
              </Link>
            );
          })}
        </div>

        {subcategories.length > 0 && (
          <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
            <Link href={href({ category: undefined })} className={cx('chip', !params.category && 'chip-active')}>All</Link>
            {subcategories.map((item) => (
              <Link key={item.slug} href={href({ category: item.slug })} className={cx('chip', params.category === item.slug && 'chip-active')}>
                {item.icon && <span aria-hidden>{item.icon}</span>}
                {item.name}
              </Link>
            ))}
          </div>
        )}

        <details id="filters" className="mt-4 scroll-mt-24 rounded-2xl border border-line bg-white" open={!!(params.country || params.city || params.verified || params.hiddenGem)}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold text-acacia-700 [&::-webkit-details-marker]:hidden">
            <span>Filters{[params.city, params.country].filter(Boolean).join(', ') ? ` · ${[params.city, params.country].filter(Boolean).join(', ')}` : ''}</span>
            <span aria-hidden>▾</span>
          </summary>
          <div className="border-t border-line p-3">
          <Filters
            action="/explore"
            catalogue={catalogue}
            kind="PLACE"
            values={params}
            hidden={{ section: params.section, sort: params.sort }}
            extra={[
              { name: 'verified', label: 'Details', options: [{ value: '', label: 'All listings' }, { value: 'true', label: 'Verified only' }] },
              { name: 'hiddenGem', label: 'Type', options: [{ value: '', label: 'Everything' }, { value: 'true', label: 'Hidden gems' }] },
            ]}
          />
          </div>
        </details>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[1.15rem] font-bold text-acacia-700 md:text-2xl">{params.q ? `Results for “${params.q}”` : 'Featured places'}</h2>
            <p className="text-sm text-ink-muted">{list.total} place{list.total === 1 ? '' : 's'}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SORTS.map((sort) => (
              <Link key={sort.value} href={href({ sort: sort.value || undefined })} className={cx('chip', (params.sort ?? '') === sort.value && 'chip-active')}>
                {sort.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-4">
          {list.items.length ? (
            <CardGrid>
              {list.items.map((item) => (
                <PlaceCard key={item.id} item={item} />
              ))}
            </CardGrid>
          ) : (
            <Empty
              title="Nothing listed here yet"
              body="We only publish places we can describe honestly, so Explore grows over time. Own a business? Apply to be listed — every listing is reviewed by our team."
              action={
                <Link href="/partner" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">
                  Partner with Enhakkore
                </Link>
              }
            />
          )}
        </div>
        <Pager base="/explore" page={list.page} totalPages={list.totalPages} params={params} />
        <p className="mt-12 text-center text-sm text-ink-muted">
          Run a hotel, restaurant or venue? <Link className="font-semibold text-acacia-600 underline" href="/partner">List with Enhakkore</Link>.
        </p>
      </section>
    </PublicShell>
  );
}
