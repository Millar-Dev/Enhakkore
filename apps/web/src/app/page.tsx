import Link from 'next/link';
import type { ReactNode } from 'react';
import type { HomepageSectionKey } from '@enhakkore/shared';
import { formatInZone, formatMoney } from '@enhakkore/shared';
import { WorldMap } from '@/components/home/WorldMap';
import type { HomeData, HubData, TrendingItem, UpcomingCard } from '@/components/home/types';
import { PublicShell } from '@/components/layout/PublicShell';
import { ListingCard } from '@/components/public/Cards';
import { tripDates, type TripListing } from '@/components/public/listings';
import { SmartImage } from '@/components/public/SmartImage';
import { WscLogo } from '@/components/site/BrandLogo';
import { SocialIcon } from '@/components/site/SocialIcon';
import { StayConnected } from '@/components/public/StayConnected';
import { apiGet } from '@/lib/api';
import { getCatalogue, type Catalogue } from '@/lib/public';
import { getSite, type Site } from '@/lib/site';

export const revalidate = 60;

/**
 * The homepage — one dark navy design that rearranges itself for each screen:
 * a single column with sideways rails on phones, two or three columns on
 * tablets, and full grids on computers. Nothing is a desktop page shrunk to a
 * phone, or a phone page stretched across a monitor.
 */

const ICON = {
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z M12 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19 M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4 M15.5 3.6a3.5 3.5 0 0 1 0 6.8',
  plane: 'M2.5 19h19M4 15l6-1 7-9 2 .5-3.5 8.5 4.5-.5 1 2-14 3-3-3.5Z',
  heart: 'M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 3.9 4 7.2 4c2 0 3.6 1.2 4.8 3 1.2-1.8 2.8-3 4.8-3 3.3 0 5.6 3.3 4.4 6.7C19.5 15.4 12 20 12 20Z',
  calendar: 'M4 6.5h16v13H4z M4 10.5h16 M8 3.5v4 M16 3.5v4',
  fire: 'M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.4 3.9-8.3.5 1.7 1.4 2.8 2.6 3.4.2-2.8 1.6-5 3.3-6.4-.2 2.6.9 4.4 2.2 6.1 1 1.3 1.9 2.9 1.9 5.2C19.4 18.4 16 21 12 21Z',
  sparkle: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z',
  handshake: 'M3 11l4-4 5 2 5-2 4 4-7 7-2-2 M8 13l3 3 M10.5 11.5l3 3',
  send: 'M21 3 3 10.5l7 2.5 2.5 7L21 3Z M10 13l4.5-4.5',
};

function Icon({ d, size = 20, className }: { d: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d={d} />
    </svg>
  );
}

/** The four ways in. Each has its own colour so they can be told apart at a glance. */
const PILLARS = [
  { href: '/explore', title: 'Explore', line: 'Places, stays, dining & attractions', image: '/packages/arusha/arusha-city.webp', icon: ICON.pin, tint: 'from-[#0b3a78]/95 via-[#0b3a78]/55' },
  { href: '/experiences', title: 'Experiences', line: 'Events, activities, communities & gaming', image: '/media/gaming/gaming-hero.jpg', icon: ICON.users, tint: 'from-[#4a1f7a]/95 via-[#4a1f7a]/55' },
  { href: '/travel', title: 'Travel', line: 'Group trips, safaris & custom journeys', image: '/packages/arusha/mount-meru.webp', icon: ICON.plane, tint: 'from-[#0b5c5a]/95 via-[#0b5c5a]/55' },
  { href: '/impact', title: 'Impact', line: 'WSC, community projects & giving', image: '/impact/mkuranga/cover.webp', icon: ICON.heart, tint: 'from-[#6b4310]/95 via-[#6b4310]/55' },
];

const INTERESTS = [
  { label: 'Parties', href: '/experiences/c/parties', colour: '#f472b6', d: 'M5.8 11.3 2 22l10.7-3.8 M4 3h.01 M22 8h.01 M15 2h.01 M22 20h.01 M22 2l-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10 M11 2l.33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7 M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z' },
  { label: 'Sports', href: '/experiences/c/sports', colour: '#34d399', d: 'M6.5 6.5 17.5 17.5 M21 21l-1-1 M3 3l1 1 M18 22l4-4 M2 6l4-4 M3 10l7-7 M14 21l7-7' },
  { label: 'Gaming', href: '/experiences/gaming', colour: '#a78bfa', d: 'M6 12h4 M8 10v4 M15 13h.01 M18 11h.01 M17.3 5H6.7a4 4 0 0 0-4 3.6C2.6 9.4 2 14.5 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.4-1.4A2 2 0 0 1 9.8 16h4.4a2 2 0 0 1 1.4.6L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.5-.6-6.6-.7-7.3a4 4 0 0 0-4-3.7Z' },
  { label: 'Adventure', href: '/experiences/c/outdoor', colour: '#2dd4bf', d: 'm8 3 4 8 5-5 5 15H2L8 3Z' },
  { label: 'Arts', href: '/experiences/c/arts', colour: '#fb923c', d: 'M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22Z M7.5 10.5h.01 M10.5 7.5h.01 M14.5 7.5h.01 M17.5 10.5h.01' },
  { label: 'Food', href: '/explore?section=FOOD', colour: '#fbbf24', d: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2 M7 2v20 M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7' },
  { label: 'Travel', href: '/travel', colour: '#60a5fa', d: 'M2.5 19h19M4 15l6-1 7-9 2 .5-3.5 8.5 4.5-.5 1 2-14 3-3-3.5Z' },
  { label: 'Community', href: '/impact', colour: '#f5b544', d: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19 M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4 M15.5 3.6a3.5 3.5 0 0 1 0 6.8' },
];

/** A country's flag, from its two-letter code. */
const flag = (code: string) => (/^[A-Z]{2}$/i.test(code) ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '');

/** Enhakkore's own photographs for places that have no picture set yet. */
const PLACE_PHOTOS: Record<string, string> = {
  arusha: '/packages/arusha/arusha-city.webp',
  tanzania: '/packages/arusha/mount-meru.webp',
  mkuranga: '/impact/mkuranga/village.webp',
};

/** A dark section band. Two navy shades alternate, with a gold line between. */
function Band({ tone, children, id }: { tone: 'a' | 'b'; children: ReactNode; id?: string }) {
  return (
    <section id={id} className={`band band-dark-${tone} text-white`}>
      <div className="shell py-7 md:py-12 xl:py-16">{children}</div>
    </section>
  );
}

function Head({ icon, title, href, linkLabel = 'See all', sub, underline = false }: { icon?: string; title: string; href?: string; linkLabel?: string; sub?: string; underline?: boolean }) {
  return (
    <div className="mb-3.5 flex items-end justify-between gap-3 md:mb-6">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[clamp(1.15rem,4.8vw,1.9rem)] font-bold leading-tight tracking-tight">
          {icon && <span className="shrink-0 text-clay-400"><Icon d={icon} size={22} /></span>}
          <span className="min-w-0">{title}</span>
        </h2>
        {underline && <span className="mt-1.5 block h-[3px] w-9 rounded-full bg-clay-400" aria-hidden />}
        {sub && <p className="mt-1 text-[0.8125rem] text-white/60 md:text-sm">{sub}</p>}
      </div>
      {href && (
        <Link href={href} className="inline-flex min-h-10 shrink-0 items-center text-[0.8125rem] font-semibold text-clay-400 hover:text-white md:text-sm">
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

/**
 * Sideways rail on phones (it scrolls inside itself — the page never moves),
 * a grid from tablets up. Class names are written out in full so Tailwind
 * can see them.
 */
const RAIL = {
  cards: 'md:grid-cols-3 xl:grid-cols-4 [&>*]:w-[72vw] [&>*]:max-w-[17rem] sm:[&>*]:w-[46vw]',
  listings: 'md:grid-cols-3 xl:grid-cols-4 [&>*]:w-[60vw] [&>*]:max-w-[15rem] sm:[&>*]:w-[40vw]',
  tiles: 'md:grid-cols-4 xl:grid-cols-8 [&>*]:w-[30vw] [&>*]:max-w-[9rem] sm:[&>*]:w-[22vw]',
};
function Rail({ children, kind = 'cards' }: { children: ReactNode; kind?: keyof typeof RAIL }) {
  return (
    <div className={`no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:grid md:gap-5 md:overflow-visible md:px-0 [&>*]:shrink-0 [&>*]:snap-start md:[&>*]:w-auto md:[&>*]:max-w-none ${RAIL[kind]}`}>
      {children}
    </div>
  );
}

function when(item: { startsAt?: string | null; recurrence?: string | null }) {
  return item.startsAt ? formatInZone(item.startsAt, 'Africa/Dar_es_Salaam', 'datetime') : item.recurrence ?? '';
}

/** A picture card for something on the calendar. */
function HappeningCard({ item }: { item: UpcomingCard }) {
  return (
    <Link href={item.href} className="card-lift group block overflow-hidden rounded-2xl border border-white/10 bg-[#0d2240]">
      <div className="relative aspect-[16/10] overflow-hidden bg-[#0a1a2e]">
        {item.image && <SmartImage src={item.image} alt="" fill sizes="(max-width:768px) 72vw, (max-width:1280px) 33vw, 25vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.05]" />}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1">
          <span className="rounded-full bg-[#4b2a8a]/90 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-white">{item.kind}</span>
          {item.isDemo && <span className="rounded-full bg-white/90 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-[#4b2a8a]">Demo</span>}
        </div>
      </div>
      <div className="flex items-end gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold leading-snug">{item.title}</p>
          <p className="mt-1 truncate text-xs text-white/65">📅 {when(item)}</p>
          {item.where && <p className="truncate text-xs text-white/55">📍 {item.where}</p>}
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clay-400 text-acacia-700" aria-hidden>→</span>
      </div>
    </Link>
  );
}

/** The featured trip: a large picture card with the facts that matter. */
function TripBanner({ trip }: { trip: TripListing }) {
  const next = trip.nextDeparture;
  return (
    <Link href={`/travel/${trip.slug}`} className="card-lift group relative block min-h-[15rem] overflow-hidden rounded-2xl border border-white/10 sm:min-h-[18rem]">
      <SmartImage src={trip.heroImage} alt="" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover object-[center_35%] transition-transform duration-700 group-hover:scale-[1.04]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#04121e] via-[#04121e]/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 md:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[clamp(1.25rem,5vw,1.75rem)] font-bold leading-tight">{trip.title}</h3>
            <span className="rounded-full bg-[#5b3aa8] px-2.5 py-0.5 text-[0.6875rem] font-bold">Group trip</span>
          </div>
          <ul className="mt-1.5 space-y-0.5 text-[0.8125rem] text-white/85">
            {next && <li>📅 {tripDates(next.startDate, next.endDate)} · {trip.durationDays} days{trip.durationNights ? ` / ${trip.durationNights} nights` : ''}</li>}
            {next && <li>👥 {next.seatsLeft} places left</li>}
            {next && <li className="text-base font-bold text-white">💳 {formatMoney({ amount: next.price, currency: trip.currency })} <span className="text-xs font-normal text-white/70">/ person</span></li>}
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
  // "Travel Further. Connect Deeper. Create Impact." — the last sentence in gold.
  const sentences = hero.title.split(/(?<=\.)\s+/);
  const gold = sentences.length > 1 ? sentences[sentences.length - 1] : null;
  const experiencesHere = launch ? launch.counts.experiences + launch.counts.activities + launch.counts.events : 0;
  const launchFacts = launch
    ? [experiencesHere > 0 && `${experiencesHere} experiences`, launch.counts.trips > 0 && `${launch.counts.trips} trip${launch.counts.trips === 1 ? '' : 's'}`, launch.counts.places > 0 && `${launch.counts.places} places`].filter(Boolean).join(' · ')
    : '';
  let tone = 0;
  const nextTone = () => (tone++ % 2 === 0 ? 'a' : 'b') as 'a' | 'b';

  return (
    <PublicShell>
      {/* Hero: the live globe is the whole background. Phones and tablets:
          headline above, globe between, buttons below. Computers: words left,
          globe right. The height follows the visible screen (svh) but grows
          when the content needs more room, so nothing is ever cut off. */}
      <section className="band-hero relative isolate overflow-hidden text-white">
        <div className="relative flex min-h-[max(34rem,calc(100svh-7rem))] md:min-h-[max(38rem,calc(100svh-4.5rem))] lg:min-h-[max(34rem,min(calc(100svh-4.5rem),56rem))]">
          <WorldMap catalogue={catalogue} home={homePoint} background />
          <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(4,18,30,0.95)_0%,rgba(4,18,30,0.55)_26%,rgba(4,18,30,0)_42%,rgba(4,18,30,0)_58%,rgba(4,18,30,0.8)_74%,rgba(4,18,30,0.97)_100%)] lg:bg-[linear-gradient(90deg,rgba(4,18,30,0.95)_0%,rgba(4,18,30,0.75)_34%,rgba(4,18,30,0)_56%)]" />
          <div className="shell pointer-events-none relative z-[3] flex w-full flex-col justify-between gap-[clamp(9rem,34svh,22rem)] py-6 text-center md:py-10 lg:justify-center lg:gap-8 lg:py-12 lg:text-left [&_a]:pointer-events-auto">
            <div className="mx-auto max-w-xl lg:mx-0">
              <p className="hidden text-xs font-bold uppercase tracking-[0.22em] text-clay-400 md:block">{hero.eyebrow}</p>
              <h1 className="font-display text-[clamp(1.8rem,8.4vw,4.4rem)] leading-[1.06] md:mt-2">
                {sentences.map((sentence, index) => (
                  <span key={sentence + index} className={`block ${gold && index === sentences.length - 1 ? 'text-clay-400' : ''}`}>{sentence}</span>
                ))}
              </h1>
              <p className="mx-auto mt-2.5 max-w-md text-[0.875rem] leading-snug text-white/80 md:text-lg md:leading-relaxed lg:mx-0">{hero.subtitle}</p>
            </div>
            <div className="mx-auto grid w-full max-w-sm gap-2.5 sm:max-w-xl lg:mx-0">
              {launch && (
                <Link href={`/destinations/${launch.slug}`} className="flex items-center gap-3 rounded-full border border-white/15 bg-[#04121e]/60 py-1.5 pl-1.5 pr-4 text-left backdrop-blur hover:border-clay-400 sm:w-fit">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl leading-none" aria-hidden>{flag(launch.code) || '📍'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-tight">{launch.name}</span>
                    <span className="block truncate text-[0.6875rem] text-white/65">{launchFacts || 'Our home — see what is on'}</span>
                  </span>
                  <span aria-hidden>→</span>
                </Link>
              )}
              <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-2">
                <Link href={hero.primaryHref} className="inline-flex h-12 items-center justify-center rounded-full bg-clay-400 px-4 text-sm font-bold text-acacia-700 shadow-lg transition hover:bg-clay-500 hover:text-white">
                  {hero.primaryLabel} →
                </Link>
                <Link href={hero.secondaryHref} className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/45 bg-[#04121e]/40 px-4 text-sm font-semibold backdrop-blur hover:bg-white/10">
                  <Icon d={ICON.users} size={17} /> {hero.secondaryLabel}
                </Link>
                <Link href="/impact" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/45 bg-[#04121e]/40 px-4 text-sm font-semibold backdrop-blur hover:bg-white/10">
                  <Icon d={ICON.heart} size={16} /> Support WSC →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {homeBanners.map((banner) => (
        <section key={banner.id} className="band band-dark-b text-white">
          <div className="shell flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-display text-xl">{banner.message}</p>
            {banner.linkUrl && <Link href={banner.linkUrl} className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700">{banner.linkLabel || 'Find out more'}</Link>}
          </div>
        </section>
      ))}

      {settings.homepage.sections
        .filter((section) => section.enabled)
        .map((section) => (
          <HomeSection key={section.key} sectionKey={section.key} title={section.title} subtitle={section.subtitle} home={home} hub={hub} trending={trending?.items ?? []} site={site} catalogue={catalogue} tone={nextTone} />
        ))}
    </PublicShell>
  );
}

function HomeSection({
  sectionKey,
  title,
  subtitle,
  home,
  hub,
  trending,
  site,
  catalogue,
  tone,
}: {
  sectionKey: HomepageSectionKey;
  title: string;
  subtitle: string;
  home: HomeData | null;
  hub: HubData | null;
  trending: TrendingItem[];
  site: Site;
  catalogue: Catalogue;
  tone: () => 'a' | 'b';
}) {
  const { settings } = site;
  switch (sectionKey) {
    case 'discover':
      return (
        <Band tone={tone()}>
          <Head title="Discover Enhakkore" underline />
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-5">
            {PILLARS.map((pillar) => (
              <Link key={pillar.href} href={pillar.href} className="card-lift group relative block aspect-[4/3.6] overflow-hidden rounded-2xl border border-white/15 bg-[#0b2142] sm:aspect-[16/10] lg:aspect-[4/4.4]">
                <div className="absolute inset-y-0 right-0 w-[78%]">
                  <SmartImage src={pillar.image} alt="" fill sizes="(max-width:1024px) 40vw, 20vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.06]" />
                </div>
                <div className={`absolute inset-0 bg-gradient-to-t ${pillar.tint} to-transparent`} />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0b2142] via-[#0b2142]/45 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-between p-3 md:p-5">
                  <span className="text-clay-400"><Icon d={pillar.icon} size={30} /></span>
                  <div>
                    <p className="text-[clamp(1.05rem,4.4vw,1.75rem)] font-bold leading-none [overflow-wrap:anywhere]">{pillar.title}</p>
                    <p className="mt-1 line-clamp-2 text-[0.6875rem] leading-snug text-white/85 md:text-sm">{pillar.line}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Band>
      );
    case 'happening': {
      const trips = (home?.trips ?? []).filter((trip) => trip.nextDeparture);
      const events = hub?.upcoming ?? [];
      return (
        <>
          <Band tone={tone()}>
            <Head icon={ICON.calendar} title={title} href="/experiences#upcoming" />
            {events.length ? (
              <Rail>{events.slice(0, 8).map((item) => <HappeningCard key={`${item.kind}-${item.id}`} item={item} />)}</Rail>
            ) : (
              <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/70">Nothing scheduled yet. <Link href="/experiences/publish" className="font-semibold text-clay-400 underline">Publish an activity</Link>.</p>
            )}
          </Band>
          <Band tone={tone()}>
            <Head icon={ICON.plane} title="Upcoming trips" href="/travel" />
            {trips.length ? (
              <div className="grid gap-3 lg:grid-cols-2 lg:gap-5">{trips.slice(0, 2).map((trip) => <TripBanner key={trip.slug} trip={trip} />)}</div>
            ) : (
              <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/70">The next trip is being prepared.</p>
            )}
          </Band>
        </>
      );
    }
    case 'interests':
      return (
        <Band tone={tone()}>
          <Head icon={ICON.sparkle} title={title} />
          <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
            {INTERESTS.map((interest) => (
              <Link key={interest.label} href={interest.href} style={{ borderColor: `${interest.colour}55` }} className="flex aspect-square min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl border bg-[#0d2240] p-1 transition hover:bg-[#123059] sm:aspect-[5/4]">
                <span style={{ color: interest.colour }}><Icon d={interest.d} size={26} /></span>
                <span className="w-full truncate text-center text-[0.6875rem] font-semibold sm:text-sm">{interest.label}</span>
              </Link>
            ))}
          </div>
        </Band>
      );
    case 'destinations': {
      const cities = catalogue.countries
        .flatMap((country) => country.cities.filter((city) => city.total > 0 || city.featured).map((city) => ({ city, country })))
        .sort((a, b) => b.city.total - a.city.total)
        .slice(0, 8);
      if (!cities.length) return null;
      return (
        <Band tone={tone()}>
          <Head icon={ICON.pin} title={title} href="/destinations" />
          <Rail kind="tiles">
            {cities.map(({ city, country }) => {
              const photo = city.heroImage ?? PLACE_PHOTOS[city.slug] ?? country.heroImage ?? null;
              return (
                <Link key={city.slug} href={`/destinations/${country.slug}/${city.slug}`} className="card-lift group relative block aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#16456b] to-[#0a1a2e]">
                  {photo && <SmartImage src={photo} alt="" fill sizes="(max-width:768px) 30vw, 12vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.06]" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#04121e]/95 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-2.5">
                    <p className="truncate font-semibold leading-tight">{city.name}</p>
                    <p className="truncate text-[0.625rem] text-white/65">{country.name} · {city.total} listing{city.total === 1 ? '' : 's'}</p>
                  </div>
                </Link>
              );
            })}
          </Rail>
        </Band>
      );
    }
    case 'upcoming': {
      const places = home?.places ?? [];
      if (!places.length) return null;
      return (
        <Band tone={tone()}>
          <Head icon={ICON.pin} title="Featured places" href="/explore" />
          <Rail kind="listings">
            {places.slice(0, 8).map((item) => (
              <ListingCard
                key={item.id}
                href={`/explore/${item.slug}`}
                image={item.coverImage}
                kicker={item.category?.name}
                title={String(item.name)}
                meta={[[item.city?.name, item.country?.name].filter(Boolean).join(', '), item.infoSource === 'VERIFIED' ? 'Verified by Enhakkore' : 'Not yet verified']}
                badges={item.isDemo ? [{ label: 'Demo', tone: 'demo' }] : item.sponsored ? [{ label: 'Sponsored', tone: 'gold' }] : []}
              />
            ))}
          </Rail>
        </Band>
      );
    }
    case 'trending': {
      const gaming = (hub?.upcoming ?? []).filter((item) => item.kind === 'Gaming').slice(0, 4);
      return (
        <>
          {trending.length > 0 && (
            <Band tone={tone()}>
              <Head icon={ICON.fire} title={title} sub="Ranked by what members actually view, save and join." />
              <Rail kind="listings">
                {trending.slice(0, 8).map((item) => (
                  <ListingCard key={item.href} href={item.href} image={item.image} kicker={item.kind} title={item.title} meta={[item.where]} badges={item.sponsored ? [{ label: 'Sponsored', tone: 'gold' }] : []} />
                ))}
              </Rail>
            </Band>
          )}
          {gaming.length > 0 && (
            <section className="band band-gaming relative text-white">
              <SmartImage src={settings.gaming.heroImage} alt="" fill sizes="100vw" className="object-cover opacity-25" />
              <div className="absolute inset-0 bg-gradient-to-b from-[#0b0a24]/80 to-[#04121e]/95" />
              <div className="shell relative py-7 md:py-12">
                <Head icon={ICON.sparkle} title="Gaming & esports" href="/experiences/gaming" sub="Free tournaments, squads and console nights." />
                <Rail>{gaming.map((item) => <HappeningCard key={item.id} item={item} />)}</Rail>
              </div>
            </section>
          )}
        </>
      );
    }
    case 'impact': {
      const project = home?.impact?.[0];
      return (
        <Band tone={tone()}>
          <Head icon={ICON.heart} title={title} sub="WSC — We Save Children" />
          <div className="grid overflow-hidden rounded-2xl border border-clay-400/40 bg-[#0d2240] md:grid-cols-[1.1fr_1fr]">
            <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[18rem]">
              <SmartImage src={project?.heroImage ?? '/impact/mkuranga/cover.webp'} alt="Community outreach with WSC" fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d2240] to-transparent md:bg-gradient-to-r md:from-transparent md:to-[#0d2240]" />
            </div>
            <div className="flex flex-col justify-center gap-3 p-5 md:p-8">
              <span className="w-fit rounded-xl bg-white p-1.5"><WscLogo src="/brand/refined/wsc-logo.png" height={38} /></span>
              <p className="text-[0.9375rem] leading-relaxed text-white/85 md:text-lg">{subtitle}</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/impact" className="inline-flex h-11 items-center rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700">See our impact →</Link>
                <Link href="/donate" className="inline-flex h-11 items-center rounded-full border border-white/40 px-5 text-sm font-semibold">Donate</Link>
              </div>
            </div>
          </div>
        </Band>
      );
    }
    case 'join':
      return (
        <Band tone={tone()}>
          <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
            <div className="rounded-2xl border border-white/10 bg-[#0d2240] p-5">
              <Head icon={ICON.users} title={title} />
              <p className="text-sm text-white/75">Free — join activities, communities, trips and tournaments.</p>
              <div className="mt-4 grid grid-cols-3 divide-x divide-white/10 text-center text-xs">
                {[
                  [ICON.sparkle, 'Discover more'],
                  [ICON.users, 'Meet people'],
                  [ICON.heart, 'Create impact'],
                ].map(([d, label]) => (
                  <div key={label} className="flex flex-col items-center gap-1 px-1">
                    <span className="text-clay-400"><Icon d={d!} size={22} /></span>
                    {label}
                  </div>
                ))}
              </div>
              <Link href="/join" className="mt-4 flex h-12 items-center justify-center rounded-full bg-clay-400 text-sm font-bold text-acacia-700">Create free account →</Link>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 p-5">
              <SmartImage src="/packages/arusha/cultural-heritage-centre.webp" alt="" fill sizes="(max-width:1024px) 100vw, 33vw" className="object-cover opacity-40" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0d2240] via-[#0d2240]/85 to-[#0d2240]/40" />
              <div className="relative">
                <Head icon={ICON.handshake} title="Partner with us" />
                <p className="text-sm text-white/80">Hotels, restaurants, venues, event organisers and sponsors — list your business or work with us.</p>
                <Link href="/partner" className="mt-4 inline-flex h-11 items-center rounded-full border border-white/50 px-5 text-sm font-semibold hover:bg-white/10">Partner with Enhakkore →</Link>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0d2240] p-5">
              <Head icon={ICON.send} title="Stay connected" />
              <p className="text-sm text-white/75">Get trip updates, new events and impact stories.</p>
              <StayConnected />
              <ul className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start" aria-label="Social media">
                {settings.social.map((link) => (
                  <li key={link.url}>
                    <a href={link.url} target="_blank" rel="noreferrer noopener" aria-label={link.handle || link.label} title={link.handle || link.label} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] hover:border-clay-400">
                      <SocialIcon platform={link.platform} size={20} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Band>
      );
    default:
      return null;
  }
}
