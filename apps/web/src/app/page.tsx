import Link from 'next/link';
import type { HomepageSectionKey } from '@enhakkore/shared';
import { formatInZone, formatMoney } from '@enhakkore/shared';
import { WorldMap } from '@/components/home/WorldMap';
import type { HomeData, HubData, TrendingItem } from '@/components/home/types';
import { PublicShell } from '@/components/layout/PublicShell';
import { ListingCard } from '@/components/public/Cards';
import { tripDates, type TripListing } from '@/components/public/listings';
import { SmartImage } from '@/components/public/SmartImage';
import { WscLogo } from '@/components/site/BrandLogo';
import { apiGet } from '@/lib/api';
import { getCatalogue, type Catalogue } from '@/lib/public';
import { getSite, type Site } from '@/lib/site';

export const revalidate = 60;

/** The four ways in — photographs from Enhakkore's own trips and projects. */
const PILLARS = [
  { href: '/explore', title: 'Explore', line: 'Stays, food & places', image: '/packages/arusha/arusha-city.webp', icon: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z M12 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' },
  { href: '/experiences', title: 'Experiences', line: 'Events, sport & gaming', image: '/packages/arusha/chemka-1.webp', icon: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z' },
  { href: '/travel', title: 'Travel', line: 'Group trips & safaris', image: '/packages/arusha/mount-meru.webp', icon: 'M2.5 19h19M4 15l6-1 7-9 2 .5-3.5 8.5 4.5-.5 1 2-14 3-3-3.5Z' },
  { href: '/impact', title: 'Impact', line: 'WSC & community projects', image: '/impact/mkuranga/cover.webp', icon: 'M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 3.9 4 7.2 4c2 0 3.6 1.2 4.8 3 1.2-1.8 2.8-3 4.8-3 3.3 0 5.6 3.3 4.4 6.7C19.5 15.4 12 20 12 20Z' },
];

const INTERESTS = [
  { label: 'Parties & social', icon: '🎉', href: '/experiences/c/parties' },
  { label: 'Sports & fitness', icon: '🏀', href: '/experiences/c/sports' },
  { label: 'Gaming', icon: '🎮', href: '/experiences/gaming' },
  { label: 'Art & culture', icon: '🎨', href: '/experiences/c/arts' },
  { label: 'Nature & adventure', icon: '🏞️', href: '/experiences/c/outdoor' },
  { label: 'Food & dining', icon: '🍽️', href: '/explore?section=FOOD' },
  { label: 'Travel', icon: '🧭', href: '/travel' },
  { label: 'Community & giving', icon: '🤝', href: '/impact' },
];

const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

type Tone = 'ivory' | 'white' | 'gold' | 'navy' | 'gaming';
const DARK: Tone[] = ['navy', 'gaming'];

/**
 * A titled row in its own colour band, so each part of the page reads as its
 * own place while scrolling. Scrolls sideways inside itself on phones (never
 * the page), a grid on larger screens.
 */
function Rail({ title, kicker, href, linkLabel = 'See all', tone = 'white', image, children }: { title: string; kicker?: string; href?: string; linkLabel?: string; tone?: Tone; image?: string; children: React.ReactNode }) {
  const dark = DARK.includes(tone);
  return (
    <section className={`band band-${tone}`}>
      {image && (
        <>
          <SmartImage src={image} alt="" fill sizes="100vw" className="object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b0a24]/80 to-[#04121e]/95" />
        </>
      )}
      <div className="shell relative py-7 md:py-12">
        <div className="mb-3 flex items-end justify-between gap-3 md:mb-5">
          <div className="min-w-0">
            {kicker && <p className={`band-kicker ${dark ? 'text-clay-400' : 'text-clay-600'}`}>{kicker}</p>}
            <h2 className={`font-display text-[1.45rem] leading-tight md:text-[2rem] ${dark ? 'text-white' : 'text-acacia-700'}`}>{title}</h2>
          </div>
          {href && <Link href={href} className={`shrink-0 text-[0.8125rem] font-semibold ${dark ? 'text-clay-400' : 'text-acacia-600'}`}>{linkLabel} →</Link>}
        </div>
        <div className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto overscroll-x-contain px-5 pb-1 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 lg:grid-cols-4 [&>*]:w-[44vw] [&>*]:max-w-[16rem] [&>*]:shrink-0 [&>*]:snap-start md:[&>*]:w-auto md:[&>*]:max-w-none">
          {children}
        </div>
      </div>
    </section>
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

  return (
    <PublicShell>
      {/* Hero: the live globe is the whole background; the words sit over it.
          Fills the screen on any phone, tablet or computer (svh = the visible
          height, so browser toolbars never push content off). */}
      <section className="band-hero relative isolate overflow-hidden text-white">
        <div className="relative h-[max(27rem,calc(100svh-10.5rem))] max-h-[60rem] md:h-[max(32rem,calc(100svh-9rem))]">
          <WorldMap catalogue={catalogue} home={homePoint} background />
          {/* Shade so the words stay readable over the globe. */}
          <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(4,18,30,0.92)_0%,rgba(4,18,30,0.55)_38%,rgba(4,18,30,0)_62%)] lg:bg-[linear-gradient(90deg,rgba(4,18,30,0.94)_0%,rgba(4,18,30,0.7)_34%,rgba(4,18,30,0)_58%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-16 bg-gradient-to-t from-[#04121e] to-transparent" />
          <div className="shell pointer-events-none relative z-[3] flex h-full flex-col pt-5 md:pt-10 lg:justify-center lg:pt-0">
            <div className="max-w-xl [&_a]:pointer-events-auto">
              <p className="text-[0.625rem] font-bold uppercase tracking-[0.22em] text-clay-400 md:text-xs">{hero.eyebrow}</p>
              <h1 className="mt-1.5 font-display text-[clamp(1.75rem,7.2vw,4.2rem)] leading-[1.04]">{hero.title}</h1>
              <p className="mt-2 line-clamp-3 max-w-lg text-[0.8125rem] leading-snug text-white/80 md:mt-3 md:text-lg md:leading-relaxed">{hero.subtitle}</p>
              <div className="mt-3.5 flex flex-wrap items-center gap-2 md:mt-6 md:gap-2.5">
                <Link href={hero.primaryHref} className="inline-flex h-10 items-center rounded-full bg-clay-400 px-4 text-[0.8125rem] font-bold text-acacia-700 shadow-lg transition hover:bg-clay-500 hover:text-white md:h-12 md:px-7 md:text-sm">
                  {hero.primaryLabel} →
                </Link>
                <Link href={hero.secondaryHref} className="inline-flex h-10 items-center rounded-full border border-white/40 bg-[#04121e]/30 px-4 text-[0.8125rem] font-semibold backdrop-blur hover:bg-white/10 md:h-12 md:px-7 md:text-sm">
                  {hero.secondaryLabel}
                </Link>
                <Link href="/donate" className="px-1 text-[0.8125rem] font-semibold text-clay-400 underline-offset-4 hover:underline md:text-sm">Donate</Link>
              </div>
              {/* WSC: part of the hero, not a sticker on it. */}
              <Link href="/impact" className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-[#04121e]/40 py-0.5 pl-0.5 pr-3 text-[0.6875rem] text-white/85 backdrop-blur transition hover:bg-white/[0.12] md:mt-5 md:text-[0.75rem]">
                <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5"><WscLogo src="/brand/refined/wsc-logo.png" height={16} /></span>
                <span className="truncate">Impact work with <strong className="font-semibold text-white">WSC — We Save Children</strong></span>
              </Link>
            </div>
          </div>
        </div>
        <div className="relative z-[3] border-t border-clay-400/30 bg-[#04121e]">
          <div className="shell grid grid-cols-3 divide-x divide-white/10 py-3 text-center">
            {[
              ['Explore', 'Travel further'],
              ['Connect', 'Meet, share, belong'],
              ['Create impact', 'Together, better'],
            ].map(([title, line]) => (
              <div key={title} className="min-w-0 px-2">
                <p className="truncate font-display text-[0.95rem] uppercase tracking-wide text-clay-400 md:text-lg">{title}</p>
                <p className="truncate text-[0.625rem] text-white/60 md:text-xs">{line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {homeBanners.map((banner) => (
        <section key={banner.id} className="shell pt-5">
          <div className="flex flex-col gap-2 rounded-2xl bg-[color:var(--color-cream)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-display text-xl text-acacia-700">{banner.message}</p>
            {banner.linkUrl && <Link href={banner.linkUrl} className="inline-flex h-10 shrink-0 items-center rounded-full bg-acacia-600 px-4 text-sm font-bold text-white">{banner.linkLabel || 'Find out more'}</Link>}
          </div>
        </section>
      ))}

      {settings.homepage.sections
        .filter((section) => section.enabled)
        .map((section) => (
          <HomeSection key={section.key} sectionKey={section.key} title={section.title} subtitle={section.subtitle} home={home} hub={hub} trending={trending?.items ?? []} site={site} catalogue={catalogue} />
        ))}
    </PublicShell>
  );
}

function TripFeature({ trip }: { trip: TripListing }) {
  const next = trip.nextDeparture;
  return (
    <Link href={`/travel/${trip.slug}`} className="card-lift group grid overflow-hidden rounded-2xl border border-line bg-white sm:grid-cols-[1.1fr_1fr]">
      <div className="relative aspect-[16/10] sm:aspect-auto sm:min-h-[13rem]">
        <SmartImage src={trip.heroImage} alt="" fill sizes="(max-width:640px) 100vw, 30vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
      </div>
      <div className="p-4">
        <p className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-clay-600">{trip.destinationLabel}</p>
        <h3 className="mt-1 font-display text-[1.35rem] leading-tight text-acacia-700">{trip.title}</h3>
        <ul className="mt-2 space-y-1 text-[0.8125rem] text-ink-soft">
          {next && <li>📅 {tripDates(next.startDate, next.endDate)}</li>}
          <li>⏱ {trip.durationDays} days{trip.durationNights ? ` / ${trip.durationNights} nights` : ''}</li>
          {next && <li>💳 {formatMoney({ amount: next.price, currency: trip.currency })} per person</li>}
          {next && <li>👥 {next.seatsLeft} places left</li>}
        </ul>
        <span className="mt-3 inline-flex h-9 items-center rounded-full bg-clay-400 px-4 text-[0.8125rem] font-bold text-acacia-700">View trip →</span>
      </div>
    </Link>
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
}: {
  sectionKey: HomepageSectionKey;
  title: string;
  subtitle: string;
  home: HomeData | null;
  hub: HubData | null;
  trending: TrendingItem[];
  site: Site;
  catalogue: Catalogue;
}) {
  const { settings } = site;
  switch (sectionKey) {
    case 'discover':
      return (
        <section className="band band-ivory">
          <div className="shell py-6 md:py-12">
          <p className="band-kicker mb-2.5 text-clay-600">Four ways in</p>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
            {PILLARS.map((pillar) => (
              <Link key={pillar.href} href={pillar.href} className="group relative block h-[8.5rem] overflow-hidden rounded-2xl md:h-[13rem]">
                <SmartImage src={pillar.image} alt="" fill sizes="(max-width:768px) 50vw, 25vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.06]" />
                <div className="absolute inset-0 bg-gradient-to-t from-acacia-900/90 via-acacia-900/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 text-white md:p-4">
                  <div>
                    <span className="text-clay-400"><Icon d={pillar.icon} /></span>
                    <p className="mt-0.5 font-display text-[1.25rem] leading-none md:text-[1.6rem]">{pillar.title}</p>
                    <p className="mt-1 text-[0.6875rem] text-white/75 md:text-xs">{pillar.line}</p>
                  </div>
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/50 text-sm transition group-hover:bg-clay-400 group-hover:text-acacia-700">→</span>
                </div>
              </Link>
            ))}
          </div>
          </div>
        </section>
      );
    case 'happening': {
      const trips = (home?.trips ?? []).filter((trip) => trip.nextDeparture);
      const events = hub?.upcoming ?? [];
      return (
        <section className="band band-white">
        <div className="shell grid grid-cols-[minmax(0,1fr)] gap-6 py-7 md:py-12 lg:grid-cols-2 lg:gap-10 [&>*]:min-w-0">
          <div>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-[1.45rem] text-acacia-700 md:text-[2rem]">✈ Upcoming trips</h2>
              <Link href="/travel" className="text-[0.8125rem] font-semibold text-acacia-600">See all trips →</Link>
            </div>
            {trips.length ? <div className="grid gap-3">{trips.slice(0, 2).map((trip) => <TripFeature key={trip.slug} trip={trip} />)}</div> : <p className="rounded-2xl bg-[color:var(--color-cream)] p-4 text-sm text-ink-muted">The next trip is being prepared.</p>}
          </div>
          <div>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-[1.45rem] text-acacia-700 md:text-[2rem]">📅 {title}</h2>
              <Link href="/experiences#upcoming" className="text-[0.8125rem] font-semibold text-acacia-600">See all →</Link>
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {events.slice(0, 5).map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link href={item.href} className="flex items-center gap-3 p-2.5 hover:bg-sand">
                    <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-lg bg-acacia-700">{item.image && <SmartImage src={item.image} alt="" fill sizes="64px" className="object-cover" />}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.625rem] font-bold uppercase tracking-wider text-clay-600">{item.kind}{item.category ? ` · ${item.category}` : ''}{item.isDemo ? ' · demo' : ''}</p>
                      <p className="truncate font-semibold text-ink">{item.title}</p>
                      <p className="truncate text-xs text-ink-muted">{item.startsAt ? formatInZone(item.startsAt, 'Africa/Dar_es_Salaam', 'datetime') : item.recurrence ?? ''}{item.where ? ` · ${item.where}` : ''}</p>
                    </div>
                    <span className="text-ink-faint">›</span>
                  </Link>
                </li>
              ))}
              {!events.length && <li className="p-4 text-sm text-ink-muted">Nothing scheduled yet. <Link href="/experiences/publish" className="font-semibold text-acacia-600 underline">Publish an activity</Link>.</li>}
            </ul>
          </div>
        </div>
        </section>
      );
    }
    case 'interests':
      return (
        <section className="band band-navy">
          <div className="shell py-6 md:py-9">
            <p className="band-kicker mb-2.5 text-clay-400">{title}</p>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto overscroll-x-contain px-5 md:mx-0 md:flex-wrap md:px-0">
              {INTERESTS.map((interest) => (
                <Link key={interest.href} href={interest.href} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-2 text-[0.8125rem] font-semibold text-white hover:border-clay-400">
                  <span aria-hidden>{interest.icon}</span>
                  {interest.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      );
    case 'destinations': {
      const countries = catalogue.countries.filter((country) => country.total > 0 || country.featured);
      const cities = countries.flatMap((country) => country.cities.filter((city) => city.total > 0).map((city) => ({ city, country }))).slice(0, 8);
      if (!cities.length && !countries.length) return null;
      return (
        <Rail title={title} kicker="Destinations" href="/destinations" tone="gold">
          {(cities.length ? cities : countries.map((country) => ({ city: null, country }))).map(({ city, country }) => (
            <Link key={city?.slug ?? country.slug} href={city ? `/destinations/${country.slug}/${city.slug}` : `/destinations/${country.slug}`} className="card-lift block rounded-2xl border border-line bg-white p-3.5">
              <p className="text-[0.625rem] font-bold uppercase tracking-wider text-clay-600">{country.name}</p>
              <p className="mt-0.5 font-display text-[1.25rem] leading-tight text-acacia-700">{city?.name ?? country.name}</p>
              <p className="mt-1 text-xs text-ink-muted">{(city ?? country).total} listing{(city ?? country).total === 1 ? '' : 's'}</p>
            </Link>
          ))}
        </Rail>
      );
    }
    case 'upcoming': {
      const places = home?.places ?? [];
      if (!places.length) return null;
      return (
        <Rail title="Featured places" kicker="Explore" href="/explore" tone="white">
          {places.slice(0, 8).map((item) => (
            <ListingCard
              key={item.id}
              href={`/explore/${item.slug}`}
              image={item.coverImage}
              kicker={item.category?.name}
              title={String(item.name)}
              meta={[[item.city?.name, item.country?.name].filter(Boolean).join(', '), item.infoSource === 'VERIFIED' ? 'Verified' : 'Not yet verified']}
              badges={item.isDemo ? [{ label: 'Demo', tone: 'demo' }] : item.sponsored ? [{ label: 'Sponsored', tone: 'gold' }] : []}
            />
          ))}
        </Rail>
      );
    }
    case 'trending': {
      const items = trending.length ? trending : [];
      const gaming = (hub?.upcoming ?? []).filter((item) => item.kind === 'Gaming').slice(0, 4);
      return (
        <>
          {items.length > 0 && (
            <Rail title={title} kicker="Trending" tone="ivory">
              {items.slice(0, 8).map((item) => (
                <ListingCard key={item.href} href={item.href} image={item.image} kicker={item.kind} title={item.title} meta={[item.where]} badges={item.sponsored ? [{ label: 'Sponsored', tone: 'gold' }] : []} />
              ))}
            </Rail>
          )}
          {gaming.length > 0 && (
            <Rail title="Gaming & esports" kicker="Free tournaments" href="/experiences/gaming" tone="gaming" image={settings.gaming.heroImage}>
              {gaming.map((item) => (
                <ListingCard key={item.id} href={item.href} image={item.image} kicker={item.category} title={item.title} meta={[item.startsAt ? formatInZone(item.startsAt, 'Africa/Dar_es_Salaam', 'datetime') : null, item.where]} badges={[...(item.isDemo ? [{ label: 'Demo', tone: 'demo' as const }] : []), { label: 'Free', tone: 'green' as const }]} />
              ))}
            </Rail>
          )}
        </>
      );
    }
    case 'impact': {
      const project = home?.impact?.[0];
      return (
        <section className="band band-impact">
          <div className="grid lg:grid-cols-[1fr_1.2fr_0.8fr]">
            <div className="relative h-44 sm:h-56 lg:h-auto">
              <SmartImage src={project?.heroImage ?? '/impact/mkuranga/cover.webp'} alt="Mkuranga outreach with WSC" fill sizes="(max-width:1024px) 100vw, 33vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#f3e3bd] via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[#f6e9c8]" />
            </div>
            <div className="px-5 py-7 text-center lg:py-12">
              <p className="band-kicker text-clay-700">Enhakkore Impact</p>
              <h2 className="mt-2 font-display text-[1.7rem] leading-tight text-acacia-700 md:text-[2.3rem]">{title}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{subtitle}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link href="/donate" className="inline-flex h-10 items-center rounded-full bg-acacia-700 px-5 text-sm font-bold text-white">Donate now →</Link>
                {project && <Link href={`/impact/${project.slug}`} className="inline-flex h-10 max-w-full items-center truncate rounded-full border border-acacia-700/30 px-5 text-sm font-semibold text-acacia-700">{project.title}</Link>}
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 border-t border-clay-400/40 px-5 py-5 lg:border-l lg:border-t-0">
              <span className="rounded-xl bg-white p-2 shadow-sm"><WscLogo src="/brand/refined/wsc-logo.png" height={44} /></span>
              <p className="text-sm text-ink-soft">In partnership with<br /><strong className="text-acacia-700">WSC — We Save Children</strong></p>
            </div>
          </div>
        </section>
      );
    }
    case 'join':
      return (
        <section className="band band-white">
          <div className="shell grid grid-cols-[minmax(0,1fr)] gap-4 py-8 md:grid-cols-2 md:items-center md:py-12">
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden>🤝</span>
              <div className="min-w-0">
                <p className="font-display text-xl text-acacia-700 md:text-2xl">Partner with Enhakkore</p>
                <p className="text-sm text-ink-muted">List your hotel, restaurant, venue or event.</p>
              </div>
              <Link href="/partner" className="ml-auto inline-flex h-10 shrink-0 items-center rounded-full bg-acacia-700 px-4 text-sm font-bold text-white">Partner →</Link>
            </div>
            <div className="flex items-center gap-3 md:border-l md:border-clay-400/40 md:pl-6">
              <span className="text-3xl" aria-hidden>✨</span>
              <div className="min-w-0">
                <p className="font-display text-xl text-acacia-700 md:text-2xl">{title}</p>
                <p className="text-sm text-ink-muted">Free — join activities, communities, trips and tournaments.</p>
              </div>
              <Link href="/join" className="ml-auto inline-flex h-10 shrink-0 items-center rounded-full bg-clay-400 px-4 text-sm font-bold text-acacia-700">Join →</Link>
            </div>
          </div>
        </section>
      );
    default:
      return null;
  }
}
