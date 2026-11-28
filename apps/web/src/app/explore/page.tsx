import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EXPLORE_SECTIONS } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Empty } from '@/components/public/Cards';
import { FilterSheet } from '@/components/public/FilterSheet';
import { Pager } from '@/components/public/Filters';
import { LocationSelector } from '@/components/public/LocationSelector';
import { PlaceCard } from '@/components/public/listings';
import { SmartImage } from '@/components/public/SmartImage';
import { cx } from '@/components/ui';
import { getCatalogue, getList, pick } from '@/lib/public';
import { getSite } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Stays, food and dining, venues and event spaces, places and attractions — with clear labels for what has been verified.',
};
export const revalidate = 60;

const ICON: Record<string, string> = {
  STAYS: 'M2 18V6 M2 11h20v7 M2 15h20 M6 11V8h5v3',
  FOOD: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2 M7 2v20 M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7',
  VENUES: 'M3 21h18 M5 21V10l7-6 7 6v11 M9 21v-6h6v6',
  ATTRACTIONS: 'm3 20 6.5-11 4 6 2.5-3.5L21 20Z M15.5 6.5a2 2 0 1 0 0-.01',
  ACTIVITIES: 'M13 4.5a1.5 1.5 0 1 0 0-.01 M9 20l3-6-3-3 4-4 3 3h3 M6 12l3-3 M12 14l3 6',
  GAMING: 'M6 12h4 M8 10v4 M15 13h.01 M18 11h.01 M17.3 5H6.7a4 4 0 0 0-4 3.6C2.6 9.4 2 14.5 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.4-1.4A2 2 0 0 1 9.8 16h4.4a2 2 0 0 1 1.4.6L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.5-.6-6.6-.7-7.3a4 4 0 0 0-4-3.7Z',
  COMMUNITIES: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19 M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4 M15.5 3.6a3.5 3.5 0 0 1 0 6.8',
  MORE: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
};

/** Explore has exactly four categories. Activities, gaming and communities live under Experiences. */
const TILES = [
  { key: 'STAYS', label: 'Stays & Accommodation' },
  { key: 'FOOD', label: 'Food & Dining' },
  { key: 'VENUES', label: 'Venues & Event Spaces' },
  { key: 'ATTRACTIONS', label: 'Places & Attractions' },
] as const;
/** A photograph from Enhakkore's own media when no listing in the section has one yet. */
const TILE_FALLBACK: Record<string, string | null> = { STAYS: null, FOOD: null, VENUES: null, ATTRACTIONS: '/packages/arusha/napuru-waterfalls.webp' };

const SORTS = [
  { value: '', label: 'Featured' },
  { value: 'popular', label: 'Popular' },
  { value: 'recent', label: 'Recently added' },
  { value: 'rating', label: 'Member rating' },
];
/** Common facilities to filter by — matched against what each listing states. */
const FACILITIES: Record<string, string[]> = {
  STAYS: ['Wi-Fi', 'Pool', 'Parking', 'Breakfast', 'Air conditioning', 'Beach'],
  FOOD: ['Outdoor seating', 'Parking', 'Wi-Fi', 'Live music', 'Delivery'],
  VENUES: ['Parking', 'Sound system', 'Catering', 'Air conditioning', 'Outdoor'],
  ATTRACTIONS: ['Parking', 'Guided tours', 'Toilets', 'Family friendly'],
};
const CUISINES = ['Swahili', 'Seafood', 'Indian', 'Italian', 'Chinese', 'Grill', 'Vegetarian', 'Café'];
const SECTION_INTRO: Record<string, string> = {
  STAYS: 'Hotels, lodges, guesthouses and apartments',
  FOOD: 'Restaurants, cafés and places to eat and drink',
  VENUES: 'Spaces for events, parties, meetings and celebrations',
  ATTRACTIONS: 'Beaches, parks, museums and things to see',
};

function Svg({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Row({ title, href, children, seeAll = 'See all' }: { title: string; href?: string; children: ReactNode; seeAll?: string }) {
  return (
    <section className="mt-8 first:mt-0">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-[1.15rem] font-bold text-acacia-700 md:text-[1.5rem]">{title}</h2>
        {href && <Link href={href} className="inline-flex min-h-10 items-center text-sm font-semibold text-clay-600">{seeAll} →</Link>}
      </div>
      {children}
    </section>
  );
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pick(await searchParams, ['section', 'country', 'city', 'category', 'q', 'page', 'hiddenGem', 'verified', 'sort', 'facility', 'cuisine', 'price']);
  const filtering = !!(params.section || params.country || params.city || params.category || params.q || params.hiddenGem || params.verified || params.sort || params.page || params.facility || params.cuisine || params.price);
  const [{ settings }, catalogue, list, popular, recent] = await Promise.all([
    getSite(),
    getCatalogue(),
    getList('/public/places', params),
    filtering ? null : getList('/public/places', { sort: 'popular' }),
    filtering ? null : getList('/public/places', { sort: 'recent' }),
  ]);
  // Each tile shows a real listing photo from that section, where one exists.
  const tileImages = await Promise.all(
    TILES.map(async (tile) => {
      const sample = await getList('/public/places', { section: tile.key, pageSize: '6' });
      return sample.items.find((item) => item.coverImage)?.coverImage ?? TILE_FALLBACK[tile.key] ?? null;
    }),
  );
  const active = EXPLORE_SECTIONS.find((section) => section.key === params.section);
  const subcategories = catalogue.categories.filter((item) => item.kind === 'PLACE' && (!active || item.section === active.key));
  const country = catalogue.countries.find((item) => item.code.toLowerCase() === params.country?.toLowerCase() || item.slug === params.country);
  const cityName = country?.cities.find((item) => item.slug === params.city)?.name ?? (params.city ? params.city.replace(/-/g, ' ') : null);
  const href = (changes: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, page: undefined, ...changes })) if (value) search.set(key, value);
    const text = search.toString();
    return text ? `/explore?${text}` : '/explore';
  };
  const activeFilters = [params.category, params.verified, params.hiddenGem, params.sort, params.facility, params.cuisine, params.price].filter(Boolean).length;
  const where = cityName ?? country?.name;

  return (
    <PublicShell>
      {/* Hero: a destination photograph, the title, search and location. */}
      <section className="relative isolate overflow-hidden bg-[#06172b] text-white">
        <SmartImage src={settings.pages.exploreHeroImage} alt="" fill priority sizes="100vw" className="object-cover object-center opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#06172b]/40 via-[#06172b]/55 to-[#06172b]" />
        <div className="shell relative flex min-h-[min(26rem,62svh)] flex-col items-center justify-end pb-6 pt-14 text-center md:min-h-[24rem] md:pb-10">
          <h1 className="font-display text-[clamp(2.2rem,10vw,4.4rem)] leading-none text-balance">{active ? active.label : 'Explore Places Worth Knowing'}</h1>
          <p className="mt-2 max-w-md text-[0.9375rem] text-white/85 md:text-lg">{active ? SECTION_INTRO[active.key] ?? '' : 'Stays, dining, venues and attractions'}{where ? ` in ${where}` : ' worldwide'}.</p>
          <span className="mt-3 h-[3px] w-12 rounded-full bg-clay-400" aria-hidden />
          <form action="/explore" role="search" className="mt-5 flex h-12 w-full max-w-xl items-center gap-2 rounded-full bg-white pl-4 pr-1 text-ink shadow-xl">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-ink-muted" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            {Object.entries({ section: params.section, country: params.country, city: params.city, category: params.category }).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
            <input name="q" defaultValue={params.q} placeholder="Search places, restaurants, hotels…" aria-label="Search places" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
            <button className="h-10 shrink-0 rounded-full bg-acacia-700 px-4 text-xs font-bold text-white">Search</button>
          </form>
          <div className="mt-3 flex w-full max-w-xl items-center gap-2">
            <LocationSelector country={params.country} city={params.city} className="min-w-0 flex-1" />
            <FilterSheet active={activeFilters} resetHref="/explore">
              <form action="/explore" className="grid gap-5">
                {params.q && <input type="hidden" name="q" value={params.q} />}
                {params.country && <input type="hidden" name="country" value={params.country} />}
                {params.city && <input type="hidden" name="city" value={params.city} />}
                <fieldset>
                  <legend className="mb-2 text-sm font-bold">Section</legend>
                  <div className="flex flex-wrap gap-2">
                    <label className="enh-choice"><input type="radio" name="section" value="" defaultChecked={!params.section} /> All</label>
                    {EXPLORE_SECTIONS.map((section) => (
                      <label key={section.key} className="enh-choice"><input type="radio" name="section" value={section.key} defaultChecked={params.section === section.key} /> {section.label}</label>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-sm font-bold">Category</legend>
                  <div className="flex flex-wrap gap-2">
                    <label className="enh-choice"><input type="radio" name="category" value="" defaultChecked={!params.category} /> Any</label>
                    {catalogue.categories.filter((item) => item.kind === 'PLACE').map((item) => (
                      <label key={item.slug} className="enh-choice"><input type="radio" name="category" value={item.slug} defaultChecked={params.category === item.slug} /> {item.name}</label>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-sm font-bold">Details</legend>
                  <div className="flex flex-wrap gap-2">
                    <label className="enh-choice"><input type="checkbox" name="verified" value="true" defaultChecked={params.verified === 'true'} /> Verified by Enhakkore only</label>
                    <label className="enh-choice"><input type="checkbox" name="hiddenGem" value="true" defaultChecked={params.hiddenGem === 'true'} /> Hidden gems</label>
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-sm font-bold">Facilities</legend>
                  <div className="flex flex-wrap gap-2">
                    <label className="enh-choice"><input type="radio" name="facility" value="" defaultChecked={!params.facility} /> Any</label>
                    {(FACILITIES[active?.key ?? ''] ?? [...new Set(Object.values(FACILITIES).flat())]).map((item) => (
                      <label key={item} className="enh-choice"><input type="radio" name="facility" value={item} defaultChecked={params.facility === item} /> {item}</label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs opacity-70">Matched against what each place lists. Ask the place to confirm.</p>
                </fieldset>
                {(!active || active.key === 'FOOD') && (
                  <fieldset>
                    <legend className="mb-2 text-sm font-bold">Cuisine</legend>
                    <div className="flex flex-wrap gap-2">
                      <label className="enh-choice"><input type="radio" name="cuisine" value="" defaultChecked={!params.cuisine} /> Any</label>
                      {CUISINES.map((item) => <label key={item} className="enh-choice"><input type="radio" name="cuisine" value={item} defaultChecked={params.cuisine === item} /> {item}</label>)}
                    </div>
                  </fieldset>
                )}
                <fieldset>
                  <legend className="mb-2 text-sm font-bold">Price range</legend>
                  <div className="flex flex-wrap gap-2">
                    {['', '$', '$$', '$$$'].map((item) => <label key={item || 'any'} className="enh-choice"><input type="radio" name="price" value={item} defaultChecked={(params.price ?? '') === item} /> {item || 'Any'}</label>)}
                  </div>
                </fieldset>
                <label className="grid gap-2 text-sm font-bold">
                  Sort by
                  <select name="sort" defaultValue={params.sort ?? ''} className="field h-12 text-ink">
                    {SORTS.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}
                  </select>
                </label>
                <button className="h-12 rounded-full bg-clay-400 text-sm font-bold text-acacia-700">Show results</button>
              </form>
            </FilterSheet>
          </div>
        </div>
      </section>

      {/* Category tiles */}
      <section className="band-dark-a">
        <div className="shell pb-6 pt-1 md:pb-10">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            {TILES.map((tile, index) => {
              const on = params.section === tile.key;
              const image = tileImages[index];
              return (
                <Link key={tile.key} href={href({ section: on ? undefined : tile.key, category: undefined })} aria-current={on ? 'page' : undefined} className={cx('card-lift group relative flex min-h-[10rem] flex-col justify-end overflow-hidden rounded-2xl border bg-gradient-to-br from-[#16456b] to-[#06172b] text-white sm:min-h-0 sm:aspect-[4/3]', on ? 'border-clay-400 ring-2 ring-clay-400' : 'border-white/10')}>
                  {image && <SmartImage src={image} alt="" fill sizes="(max-width:1024px) 50vw, 25vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.06]" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#06172b]/95 via-[#06172b]/25 to-transparent" />
                  <div className="relative flex items-end justify-between gap-2 p-3 sm:absolute sm:inset-x-0 sm:bottom-0 sm:p-4">
                    <span>
                      <span className="block text-clay-400"><Svg d={ICON[tile.key]!} size={24} /></span>
                      <span className="mt-1 block text-[0.9375rem] font-bold leading-tight [overflow-wrap:anywhere] sm:text-lg">{tile.label}</span>
                    </span>
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/60 text-sm" aria-hidden>→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="band band-ivory">
        <div className="shell py-7 md:py-12">
          {subcategories.length > 0 && (active || params.category) && (
            <div className="no-scrollbar -mx-5 mb-6 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
              <Link href={href({ category: undefined })} className={cx('chip', !params.category && 'chip-active')}>All</Link>
              {subcategories.map((item) => (
                <Link key={item.slug} href={href({ category: item.slug })} className={cx('chip', params.category === item.slug && 'chip-active')}>
                  {item.icon && <span aria-hidden>{item.icon}</span>}
                  {item.name}
                </Link>
              ))}
            </div>
          )}

          {!filtering ? (
            <>
              {list.items.length > 0 && (
                <Row title={`Featured${where ? ` in ${where}` : ''}`} href={href({ sort: undefined, page: '1' })} seeAll="See all places">
                  <CardGrid>{list.items.slice(0, 6).map((item) => <PlaceCard key={item.id} item={item} />)}</CardGrid>
                </Row>
              )}
              {popular && popular.items.length > 0 && (
                <Row title="Popular" href={href({ sort: 'popular' })}>
                  <CardGrid>{popular.items.slice(0, 3).map((item) => <PlaceCard key={item.id} item={item} />)}</CardGrid>
                </Row>
              )}
              {recent && recent.items.length > 0 && (
                <Row title="Recently added" href={href({ sort: 'recent' })}>
                  <CardGrid>{recent.items.slice(0, 3).map((item) => <PlaceCard key={item.id} item={item} />)}</CardGrid>
                </Row>
              )}
              {list.items.length === 0 && <EmptyPlaces />}
            </>
          ) : (
            <Row title={params.q ? `Results for “${params.q}”` : `${active?.label ?? 'Places'}${where ? ` in ${where}` : ''}`}>
              <p className="-mt-2 mb-4 text-sm text-ink-muted">{list.total} place{list.total === 1 ? '' : 's'}</p>
              {list.items.length ? <CardGrid>{list.items.map((item) => <PlaceCard key={item.id} item={item} />)}</CardGrid> : <EmptyPlaces />}
              <Pager base="/explore" page={list.page} totalPages={list.totalPages} params={params} />
            </Row>
          )}

          <p className="mt-12 text-center text-sm text-ink-muted">
            Every listing says who provided its details — verified by Enhakkore, submitted by the business, or not yet verified. Run a hotel, restaurant or venue?{' '}
            <Link className="font-semibold text-acacia-600 underline" href="/partner">List with Enhakkore</Link>.
          </p>
        </div>
      </section>
    </PublicShell>
  );
}

function EmptyPlaces() {
  return (
    <Empty
      title="Nothing listed here yet"
      body="We only publish places we can describe honestly, so Explore grows over time. Try another location or category."
      action={<Link href="/explore" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Show everything</Link>}
    />
  );
}
