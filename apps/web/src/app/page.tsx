import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatInZone, formatMoney, normaliseHomepageSections, type HomepageSection } from '@enhakkore/shared';
import { GlobeHero } from '@/components/home/GlobeHero';
import type { HomeData, HubData, TrendingItem, UpcomingCard } from '@/components/home/types';
import { PublicShell } from '@/components/layout/PublicShell';
import { ListingCard } from '@/components/public/Cards';
import { tripDates, type TripListing } from '@/components/public/listings';
import { SmartImage } from '@/components/public/SmartImage';
import { WscLogo } from '@/components/site/BrandLogo';
import { apiGet } from '@/lib/api';
import { getCatalogue, type Catalogue } from '@/lib/public';
import { getSite, type Site } from '@/lib/site';

export const revalidate = 60;

/**
 * The homepage. The globe hero first; below it, sections in the order the
 * team sets in the Homepage editor, alternating navy and ivory bands so each
 * part reads as its own place. Layouts change with the screen — sideways rails
 * on phones, grids on larger screens — rather than shrinking one design.
 * Everything shown is real, published content; empty sections are left out.
 */

const ICON = {
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z M12 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19 M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4 M15.5 3.6a3.5 3.5 0 0 1 0 6.8',
  plane: 'M2.5 19h19M4 15l6-1 7-9 2 .5-3.5 8.5 4.5-.5 1 2-14 3-3-3.5Z',
  heart: 'M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 3.9 4 7.2 4c2 0 3.6 1.2 4.8 3 1.2-1.8 2.8-3 4.8-3 3.3 0 5.6 3.3 4.4 6.7C19.5 15.4 12 20 12 20Z',
  calendar: 'M4 6.5h16v13H4z M4 10.5h16 M8 3.5v4 M16 3.5v4',
  fire: 'M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.4 3.9-8.3.5 1.7 1.4 2.8 2.6 3.4.2-2.8 1.6-5 3.3-6.4-.2 2.6.9 4.4 2.2 6.1 1 1.3 1.9 2.9 1.9 5.2C19.4 18.4 16 21 12 21Z',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  run: 'M13 4.5a1.5 1.5 0 1 0 0-.01 M9 20l3-6-3-3 4-4 3 3h3 M6 12l3-3 M12 14l3 6',
  game: 'M6 12h4 M8 10v4 M15 13h.01 M18 11h.01 M17.3 5H6.7a4 4 0 0 0-4 3.6C2.6 9.4 2 14.5 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.4-1.4A2 2 0 0 1 9.8 16h4.4a2 2 0 0 1 1.4.6L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.5-.6-6.6-.7-7.3a4 4 0 0 0-4-3.7Z',
  food: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2 M7 2v20 M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7',
  bed: 'M2 18V6 M2 11h20v7 M2 15h20 M6 11V8h5v3',
  cup: 'M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z M16 10h2a2 2 0 0 1 0 4h-2 M8 2v3 M12 2v3',
  palette: 'M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22Z M7.5 10.5h.01 M10.5 7.5h.01 M14.5 7.5h.01 M17.5 10.5h.01',
  handshake: 'M3 11l4-4 5 2 5-2 4 4-7 7-2-2 M8 13l3 3 M10.5 11.5l3 3',
};

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Explore Our World: photographs where Enhakkore has its own, otherwise an icon. */
const WORLD = [
  { label: 'Experiences', href: '/experiences', image: '/packages/arusha/chemka-1.webp', icon: ICON.users },
  { label: 'Travel & Trips', href: '/travel', image: '/packages/arusha/mount-meru.webp', icon: ICON.plane },
  { label: 'Discover', sub: 'Places, hotels & more', href: '/explore', image: '/packages/arusha/arusha-city.webp', icon: ICON.pin },
  { label: 'Food & Dining', href: '/explore?section=FOOD', image: null, icon: ICON.food },
  { label: 'Sports', href: '/experiences/c/sports', image: null, icon: ICON.run },
  { label: 'Gaming', href: '/experiences/gaming', image: '/media/gaming/gaming-hero.jpg', icon: ICON.game },
  { label: 'Community', href: '/experiences/communities', image: '/impact/mkuranga/together.webp', icon: ICON.users },
  { label: 'More', href: '/search', image: null, icon: ICON.grid },
];

const PLACE_PHOTOS: Record<string, string> = { arusha: '/packages/arusha/arusha-city.webp', tanzania: '/packages/arusha/mount-meru.webp', mkuranga: '/impact/mkuranga/village.webp' };
const flag = (code: string) => (/^[A-Z]{2}$/i.test(code) ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '');

/** Section shell: navy or ivory. */
function Band({ tone, children, id, className = '' }: { tone: 'navy' | 'ivory'; children: ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={`band ${tone === 'navy' ? 'band-dark-a text-white' : 'band-ivory text-ink'} ${className}`}>
      <div className="shell py-8 md:py-14 xl:py-16">{children}</div>
    </section>
  );
}

function Head({ title, gold, href, linkLabel = 'View all', sub, tone }: { title: string; gold?: string; href?: string; linkLabel?: string; sub?: string; tone: 'navy' | 'ivory' }) {
  const dark = tone === 'navy';
  return (
    <div className="mb-4 flex items-end justify-between gap-3 md:mb-7">
      <div className="min-w-0">
        <h2 className={`text-[clamp(1.3rem,5vw,2.1rem)] font-bold leading-tight tracking-tight ${dark ? 'text-white' : 'text-acacia-700'}`}>
          {title}
          {gold && <span className="text-clay-400"> {gold}</span>}
        </h2>
        {sub && <p className={`mt-1 max-w-2xl text-[0.875rem] md:text-[0.9375rem] ${dark ? 'text-white/65' : 'text-ink-muted'}`}>{sub}</p>}
      </div>
      {href && (
        <Link href={href} className={`inline-flex min-h-10 shrink-0 items-center text-sm font-semibold ${dark ? 'text-clay-400 hover:text-white' : 'text-clay-600 hover:text-acacia-700'}`}>
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

/** Sideways on phones (inside itself), a grid from tablets up. */
function Rail({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={`no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:grid md:gap-5 md:overflow-visible md:px-0 [&>*]:shrink-0 [&>*]:snap-start md:[&>*]:w-auto md:[&>*]:max-w-none ${wide ? 'md:grid-cols-2 [&>*]:w-[86vw] [&>*]:max-w-[26rem]' : 'md:grid-cols-3 xl:grid-cols-4 [&>*]:w-[70vw] [&>*]:max-w-[17rem] sm:[&>*]:w-[44vw]'}`}>
      {children}
    </div>
  );
}

const when = (item: { startsAt?: string | null; recurrence?: string | null }) => (item.startsAt ? formatInZone(item.startsAt, 'Africa/Dar_es_Salaam', 'date') : item.recurrence ?? '');

/** An experience card in the reference's style: picture, status tag, facts and a gold arrow. */
function ExperienceTile({ item, dark = false }: { item: UpcomingCard; dark?: boolean }) {
  const tag = item.kind === 'Gaming' ? 'Gaming' : item.kind === 'Event' ? 'Event' : item.category === 'Communities' ? 'Community' : 'Upcoming';
  return (
    <Link href={item.href} className={`card-lift group block overflow-hidden rounded-2xl border ${dark ? 'border-white/10 bg-[#0d2240] text-white' : 'border-line bg-white text-ink shadow-[0_10px_28px_-18px_rgba(6,23,43,0.45)]'}`}>
      <div className="relative aspect-[16/10] overflow-hidden bg-acacia-700">
        {item.image && <SmartImage src={item.image} alt="" fill sizes="(max-width:768px) 70vw, (max-width:1280px) 33vw, 25vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.05]" />}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1">
          <span className="rounded-full bg-clay-400 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-acacia-700">{tag}</span>
          {item.isDemo && <span className="rounded-full bg-white/90 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-[#4b2a8a]">Demo</span>}
        </div>
        <p className="absolute inset-x-3 bottom-2 line-clamp-2 text-[1.05rem] font-bold leading-tight text-white">{item.title}</p>
      </div>
      <div className="flex items-end gap-2 p-3">
        <div className="min-w-0 flex-1 text-xs">
          <p className={`truncate ${dark ? 'text-white/70' : 'text-ink-muted'}`}>📅 {when(item)}{item.where ? ` · ${item.where}` : ''}</p>
          <p className={`mt-0.5 font-bold ${dark ? 'text-clay-400' : 'text-clay-600'}`}>{item.free ? 'Free' : item.category ?? item.kind}</p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clay-400 text-acacia-700" aria-hidden>→</span>
      </div>
    </Link>
  );
}

function TripBanner({ trip }: { trip: TripListing }) {
  const next = trip.nextDeparture;
  return (
    <Link href={`/travel/${trip.slug}`} className="card-lift group relative block min-h-[15rem] overflow-hidden rounded-2xl border border-line sm:min-h-[18rem]">
      <SmartImage src={trip.heroImage} alt="" fill sizes="(max-width:768px) 86vw, 50vw" className="object-cover object-[center_35%] transition-transform duration-700 group-hover:scale-[1.04]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#04121e] via-[#04121e]/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 text-white md:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[clamp(1.2rem,5vw,1.7rem)] font-bold leading-tight">{trip.title}</h3>
            <span className="rounded-full bg-[#5b3aa8] px-2.5 py-0.5 text-[0.6875rem] font-bold">Group trip</span>
          </div>
          <ul className="mt-1.5 space-y-0.5 text-[0.8125rem] text-white/85">
            {next && <li>📅 {tripDates(next.startDate, next.endDate)} · {trip.destinationLabel ?? ''}</li>}
            {next && <li>👥 {next.seatsLeft} places left</li>}
            {next && <li className="text-base font-bold text-clay-400">{formatMoney({ amount: next.price, currency: trip.currency })} <span className="text-xs font-normal text-white/70">/ person</span></li>}
          </ul>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clay-400 text-lg text-acacia-700" aria-hidden>→</span>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const site = await getSite();
  const { settings } = site;
  const [home, catalogue, hub, trending] = await Promise.all([
    apiGet<HomeData>(`/public/home?city=${settings.launch.citySlug}`, 60),
    getCatalogue(),
    apiGet<HubData>('/public/experiences-hub', 60),
    apiGet<{ items: TrendingItem[] }>('/public/trending', 300),
  ]);
  const hero = settings.homepage.hero;
  const homeBanners = site.banners.filter((banner) => banner.placement === 'HOME');
  const launch = catalogue.countries.find((country) => country.code === settings.launch.countryCode);
  const homePoint = launch?.latitude != null && launch.longitude != null ? { lat: launch.latitude, lng: launch.longitude } : { lat: -6.8, lng: 39.28 };
  const experiencesHere = launch ? launch.counts.experiences + launch.counts.activities + launch.counts.events : 0;
  const launchFacts = launch ? [experiencesHere > 0 && `${experiencesHere} experiences`, launch.counts.trips > 0 && `${launch.counts.trips} trip${launch.counts.trips === 1 ? '' : 's'}`, launch.counts.places > 0 && `${launch.counts.places} places`].filter(Boolean).join(' · ') : '';

  // Sections in the team's order; "Travel with purpose" and "Impact" pair up when next to each other.
  const sections = normaliseHomepageSections(settings.homepage.sections).filter((section) => section.enabled);
  const shownExperiences = (hub?.upcoming ?? []).slice(0, 8);
  const ctx: Ctx = { home, hub, trending: (trending?.items ?? []).filter((item) => !shownExperiences.some((shown) => shown.href === item.href)), site, catalogue, shownExperiences };
  const blocks: ReactNode[] = [];
  let tone: 'navy' | 'ivory' = 'navy';
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!;
    const next = sections[i + 1];
    if (section.key === 'purpose' && next?.key === 'impact') {
      blocks.push(<PurposeImpact key="purpose-impact" purpose={section} impact={next} ctx={ctx} />);
      i++;
      continue;
    }
    const block = renderSection(section, ctx, tone);
    if (block) {
      blocks.push(<div key={section.key}>{block}</div>);
      if (!['purpose', 'impact', 'join'].includes(section.key)) tone = tone === 'navy' ? 'ivory' : 'navy';
    }
  }

  return (
    <PublicShell>
      <GlobeHero
        hero={hero}
        home={homePoint}
        categories={settings.globe.categories}
        launch={launch ? { name: launch.name, slug: launch.slug, flag: flag(launch.code), facts: launchFacts } : null}
      />
      {homeBanners.map((banner) => (
        <section key={banner.id} className="band band-dark-b text-white">
          <div className="shell flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-display text-xl">{banner.message}</p>
            {banner.linkUrl && <Link href={banner.linkUrl} className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700">{banner.linkLabel || 'Find out more'}</Link>}
          </div>
        </section>
      ))}
      {blocks}
    </PublicShell>
  );
}

interface Ctx {
  home: HomeData | null;
  hub: HubData | null;
  trending: TrendingItem[];
  site: Site;
  catalogue: Catalogue;
  shownExperiences: UpcomingCard[];
}

function renderSection(section: HomepageSection, ctx: Ctx, tone: 'navy' | 'ivory'): ReactNode {
  const { title, subtitle } = section;
  switch (section.key) {
    case 'explore': {
      const words = title.split(' ');
      return (
        <Band tone={tone}>
          <Head tone={tone} title={words.slice(0, -1).join(' ')} gold={words.length > 1 ? words[words.length - 1] : undefined} sub={subtitle} />
          <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
            {WORLD.map((tile) => (
              <Link key={tile.label} href={tile.href} className="card-lift group relative block aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#123a63] to-[#06172b] sm:aspect-[4/4.4]">
                {tile.image && <SmartImage src={tile.image} alt="" fill sizes="(max-width:1024px) 25vw, 12vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.07]" />}
                {!tile.image && <span className="absolute inset-0 flex items-center justify-center pb-6 text-clay-400"><Icon d={tile.icon} size={34} /></span>}
                <div className="absolute inset-0 bg-gradient-to-t from-[#06172b]/95 via-[#06172b]/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-1.5 text-center sm:p-2.5">
                  <p className="text-[0.6875rem] font-bold leading-tight text-white [overflow-wrap:anywhere] sm:text-sm">{tile.label}</p>
                  {tile.sub && <p className="hidden text-[0.625rem] text-white/70 sm:block">{tile.sub}</p>}
                </div>
              </Link>
            ))}
          </div>
        </Band>
      );
    }
    case 'experiences': {
      if (!ctx.shownExperiences.length) return null;
      return (
        <Band tone={tone}>
          <Head tone={tone} title={title} href="/experiences#upcoming" sub={subtitle || undefined} />
          <Rail>{ctx.shownExperiences.map((item) => <ExperienceTile key={`${item.kind}-${item.id}`} item={item} dark={tone === 'navy'} />)}</Rail>
        </Band>
      );
    }
    case 'happening': {
      if (!ctx.trending.length) return null;
      return (
        <Band tone={tone}>
          <Head tone={tone} title={title} sub={subtitle} />
          <Rail>
            {ctx.trending.slice(0, 8).map((item) => (
              <ListingCard key={item.href} href={item.href} image={item.image} kicker={item.kind} title={item.title} meta={[item.where]} badges={item.sponsored ? [{ label: 'Sponsored', tone: 'gold' }] : []} />
            ))}
          </Rail>
        </Band>
      );
    }
    case 'trips': {
      const trips = (ctx.home?.trips ?? []).filter((trip) => trip.nextDeparture);
      if (!trips.length) return null;
      return (
        <Band tone={tone}>
          <Head tone={tone} title={title} href="/travel" sub={subtitle || undefined} />
          <Rail wide>{trips.slice(0, 4).map((trip) => <TripBanner key={trip.slug} trip={trip} />)}</Rail>
        </Band>
      );
    }
    case 'destinations': {
      const cities = ctx.catalogue.countries
        .flatMap((country) => country.cities.filter((city) => city.total > 0 || city.featured).map((city) => ({ city, country })))
        .sort((a, b) => b.city.total - a.city.total)
        .slice(0, 8);
      if (!cities.length) return null;
      return (
        <Band tone={tone}>
          <Head tone={tone} title={title} href="/destinations" sub={subtitle || undefined} />
          <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 xl:grid-cols-8 [&>*]:w-[30vw] [&>*]:max-w-[9rem] [&>*]:shrink-0 md:[&>*]:w-auto md:[&>*]:max-w-none">
            {cities.map(({ city, country }) => {
              const photo = city.heroImage ?? PLACE_PHOTOS[city.slug] ?? country.heroImage ?? null;
              return (
                <Link key={city.slug} href={`/destinations/${country.slug}/${city.slug}`} className="card-lift group relative block aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#16456b] to-[#0a1a2e]">
                  {photo && <SmartImage src={photo} alt="" fill sizes="(max-width:768px) 30vw, 12vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.06]" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#04121e]/95 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
                    <p className="truncate font-semibold leading-tight">{city.name}</p>
                    <p className="truncate text-[0.625rem] text-white/70">{country.name} · {city.total} listing{city.total === 1 ? '' : 's'}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </Band>
      );
    }
    case 'purpose':
      return <PurposeImpact purpose={section} ctx={ctx} />;
    case 'impact':
      return <PurposeImpact impact={section} ctx={ctx} />;
    case 'review': {
      const tiles = [
        { label: 'Hotels', href: '/explore?section=STAYS', icon: ICON.bed },
        { label: 'Restaurants', href: '/explore?category=restaurants', icon: ICON.food },
        { label: 'Cafés', href: '/explore?category=cafes', icon: ICON.cup },
        { label: 'Attractions', href: '/explore?section=ATTRACTIONS', icon: ICON.pin },
      ];
      return (
        <Band tone="ivory">
          <div className="grid gap-5 lg:grid-cols-[1fr_2fr] lg:items-center">
            <Head tone="ivory" title={title} sub={subtitle} />
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {tiles.map((tile) => (
                <Link key={tile.label} href={tile.href} className="card-lift flex aspect-[4/4.4] flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-white p-2 text-center text-acacia-700 shadow-[0_8px_22px_-16px_rgba(6,23,43,0.5)]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-clay-50 text-clay-600 ring-1 ring-clay-400/40"><Icon d={tile.icon} size={22} /></span>
                  <span className="text-[0.75rem] font-bold sm:text-sm">{tile.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </Band>
      );
    }
    case 'join': {
      return (
        <section className="band band-ivory">
          <div className="shell py-8 md:py-12">
            <div className="relative overflow-hidden rounded-3xl bg-[#06172b] text-white">
              <SmartImage src="/impact/mkuranga/group-photo.webp" alt="" fill sizes="100vw" className="object-cover opacity-35" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#06172b] via-[#06172b]/85 to-[#06172b]/40" />
              <div className="relative grid gap-6 p-6 md:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
                <div>
                  <h2 className="text-[clamp(1.4rem,5vw,2.2rem)] font-bold leading-tight">{title}</h2>
                  <p className="mt-2 max-w-lg text-[0.9375rem] text-white/80">{subtitle}</p>
                  <Link href="/experiences/communities" className="mt-5 inline-flex h-12 items-center rounded-full bg-clay-400 px-6 text-sm font-bold text-acacia-700">Join a community →</Link>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-[0.6875rem] font-semibold sm:text-xs">
                  {[
                    { label: 'Sports & Fitness', href: '/experiences/c/sports', d: ICON.run },
                    { label: 'Gaming & Esports', href: '/experiences/gaming', d: ICON.game },
                    { label: 'Arts & Culture', href: '/experiences/c/arts', d: ICON.palette },
                    { label: 'Travel Lovers', href: '/travel', d: ICON.plane },
                  ].map((item) => (
                    <Link key={item.label} href={item.href} className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl p-1.5 [overflow-wrap:anywhere] hover:bg-white/10">
                      <span className="text-clay-400"><Icon d={item.d} size={28} /></span>
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }
    case 'partner':
      return (
        <section className="band band-dark-a text-white">
          <div className="shell flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between md:py-10">
            <div className="flex items-start gap-3">
              <span className="text-clay-400"><Icon d={ICON.handshake} size={32} /></span>
              <div>
                <h2 className="text-[1.25rem] font-bold md:text-[1.6rem]">{title}</h2>
                <p className="text-sm text-white/70">{subtitle}</p>
              </div>
            </div>
            <Link href="/partner" className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-clay-400 px-6 text-sm font-bold text-acacia-700">Become a partner →</Link>
          </div>
        </section>
      );
    default:
      return null;
  }
}

/** "Travel with purpose" and "Enhakkore Impact" — two picture banners, side by side on large screens. */
function PurposeImpact({ purpose, impact, ctx }: { purpose?: HomepageSection; impact?: HomepageSection; ctx: Ctx }) {
  const project = ctx.home?.impact?.[0];
  return (
    <section className="band bg-[#06172b] text-white">
      <div className={`grid ${purpose && impact ? 'lg:grid-cols-2' : ''}`}>
        {purpose && (
          <div className="relative isolate min-h-[18rem] overflow-hidden md:min-h-[22rem]">
            <SmartImage src="/packages/arusha/mount-meru.webp" alt="Mount Meru, Arusha" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#06172b]/95 via-[#06172b]/65 to-transparent" />
            <div className="relative flex h-full min-h-[inherit] flex-col justify-center p-6 md:p-10">
              <span className="text-clay-400"><Icon d={ICON.plane} size={30} /></span>
              <h2 className="mt-2 text-[clamp(1.5rem,5vw,2.3rem)] font-bold leading-tight">{purpose.title}</h2>
              <p className="mt-2 max-w-md text-[0.9375rem] text-white/80">{purpose.subtitle}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/private-trips" className="inline-flex h-12 items-center rounded-full bg-clay-400 px-6 text-sm font-bold text-acacia-700">Plan a trip →</Link>
                <Link href="/travel" className="inline-flex h-12 items-center rounded-full border border-white/40 px-5 text-sm font-semibold">See trips</Link>
              </div>
            </div>
          </div>
        )}
        {impact && (
          <div className="relative isolate min-h-[18rem] overflow-hidden md:min-h-[22rem]">
            <SmartImage src={project?.heroImage ?? '/impact/mkuranga/cover.webp'} alt="WSC community outreach" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#06172b]/95 via-[#06172b]/65 to-[#06172b]/10" />
            <div className="relative flex h-full min-h-[inherit] flex-col justify-center p-6 md:p-10">
              <span className="w-fit rounded-xl bg-white p-1.5"><WscLogo src="/brand/refined/wsc-logo.png" height={34} /></span>
              <h2 className="mt-3 text-[clamp(1.5rem,5vw,2.3rem)] font-bold leading-tight">{impact.title}</h2>
              <p className="mt-2 max-w-md text-[0.9375rem] text-white/80">{impact.subtitle}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/impact" className="inline-flex h-12 items-center rounded-full bg-clay-400 px-6 text-sm font-bold text-acacia-700">See our projects →</Link>
                <Link href="/donate" className="inline-flex h-12 items-center rounded-full border border-white/40 px-5 text-sm font-semibold">Donate</Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
