import type { Metadata } from 'next';
import Link from 'next/link';
import { EXPLORE_SECTIONS } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Empty, PageHero } from '@/components/public/Cards';
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

const SORTS = [
  { value: '', label: 'Featured' },
  { value: 'popular', label: 'Popular' },
  { value: 'recent', label: 'Recently added' },
];

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pick(await searchParams, ['section', 'country', 'city', 'category', 'q', 'page', 'hiddenGem', 'verified', 'sort']);
  const [, catalogue, list] = await Promise.all([getSite(), getCatalogue(), getList('/public/places', params)]);
  const active = EXPLORE_SECTIONS.find((section) => section.key === params.section);
  const subcategories = catalogue.categories.filter((item) => item.kind === 'PLACE' && (!active || item.section === active.key));
  const href = (changes: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, page: undefined, ...changes })) if (value) search.set(key, value);
    const text = search.toString();
    return text ? `/explore?${text}` : '/explore';
  };

  return (
    <PublicShell>
      <PageHero
        kicker="Explore"
        title={active ? active.label : 'Places worth knowing'}
        intro="Where to stay, eat, celebrate and explore. Every listing is published by the Enhakkore team and says who provided its details — verified by us, submitted by the business, or not yet verified. Sponsored listings are always labelled."
      />
      <section className="shell py-8 md:py-12">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {EXPLORE_SECTIONS.map((section) => (
            <Link
              key={section.key}
              href={href({ section: active?.key === section.key ? undefined : section.key, category: undefined })}
              className={cx(
                'rounded-[1rem] border p-4 transition',
                active?.key === section.key ? 'border-acacia-600 bg-acacia-600 text-white' : 'border-line bg-white text-acacia-700 hover:border-acacia-600',
              )}
            >
              <span className="text-2xl" aria-hidden>{section.icon}</span>
              <p className="mt-2 font-display text-lg leading-tight">{section.label}</p>
              <p className={cx('mt-1 text-xs', active?.key === section.key ? 'text-white/75' : 'text-ink-muted')}>{section.kinds.slice(0, 4).join(' · ')}</p>
            </Link>
          ))}
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

        <div className="mt-5">
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

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">{list.total} place{list.total === 1 ? '' : 's'}</p>
          <div className="flex gap-1.5">
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
