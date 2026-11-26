import Link from 'next/link';
import type { HomepageSectionKey } from '@enhakkore/shared';
import { EXPERIENCE_SECTIONS } from '@enhakkore/shared';
import { Globe } from '@/components/home/Globe';
import type { HomeData, HubData, TrendingItem } from '@/components/home/types';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, ListingCard, SectionTitle } from '@/components/public/Cards';
import { ExperienceCard, TripCard } from '@/components/public/listings';
import { SmartImage } from '@/components/public/SmartImage';
import { UpcomingGrid } from '@/components/public/UpcomingGrid';
import { WscLogo } from '@/components/site/BrandLogo';
import { apiGet } from '@/lib/api';
import { getCatalogue, type Catalogue } from '@/lib/public';
import { getSite, type Site } from '@/lib/site';

export const revalidate = 60;

const More = ({ href, label = 'See all' }: { href: string; label?: string }) => (
  <Link href={href} className="chip w-fit">
    {label} →
  </Link>
);

/** The four ways into Enhakkore — icons and words, no photographs. */
const PILLARS = [
  {
    href: '/explore',
    title: 'Explore',
    body: 'Stays, food and dining, venues and places worth visiting — chosen and checked by our team.',
    icon: <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z M12 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  },
  {
    href: '/experiences',
    title: 'Experiences',
    body: 'Events, activities, communities and gaming — join in, or publish your own.',
    icon: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z" />,
  },
  {
    href: '/travel',
    title: 'Travel',
    body: 'Group and private trips, safaris and journeys — travel together, with a private group for every departure.',
    icon: <path d="M2.5 19h19M4 15l6-1 7-9 2 .5-3.5 8.5 4.5-.5 1 2-14 3-3-3.5Z" />,
  },
  {
    href: '/impact',
    title: 'Impact',
    body: 'Community projects with WSC — We Save Children. See what was done, volunteer, or donate.',
    icon: <path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 3.9 4 7.2 4c2 0 3.6 1.2 4.8 3 1.2-1.8 2.8-3 4.8-3 3.3 0 5.6 3.3 4.4 6.7C19.5 15.4 12 20 12 20Z" />,
  },
];

/** Explore by interest: where each interest leads. */
const INTERESTS = [
  { label: 'Parties & socialising', icon: '🎉', href: '/experiences/c/parties' },
  { label: 'Sports & fitness', icon: '🏀', href: '/experiences/c/sports' },
  { label: 'Gaming', icon: '🎮', href: '/experiences/gaming' },
  { label: 'Art & creativity', icon: '🎨', href: '/experiences/c/arts' },
  { label: 'Nature & adventure', icon: '🏞️', href: '/experiences/c/outdoor' },
  { label: 'Food & dining', icon: '🍽️', href: '/explore?section=FOOD' },
  { label: 'Travel & exploration', icon: '🧭', href: '/travel' },
  { label: 'Community & giving', icon: '🤝', href: '/impact' },
];

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
  const markers = catalogue.countries
    .filter((country) => (country.total > 0 || country.featured) && country.latitude !== null && country.longitude !== null)
    .map((country) => ({ lat: country.latitude!, lng: country.longitude!, label: country.name, href: `/destinations/${country.slug}` }));
  const homePoint = launch?.latitude != null && launch.longitude != null ? { lat: launch.latitude, lng: launch.longitude } : { lat: -6.8, lng: 39.28 };

  return (
    <PublicShell>
      {/* Hero: the interactive globe is the visual. */}
      <section className="relative isolate overflow-hidden bg-[radial-gradient(ellipse_at_70%_40%,#0f4a76_0%,#082b45_45%,#04182a_100%)]">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:44px_44px]" aria-hidden />
        <div className="shell relative z-10 grid items-center gap-6 pb-12 pt-10 md:pt-16 lg:min-h-[82vh] lg:grid-cols-[1.05fr_1fr] lg:pb-16">
          <div className="order-1">
            <p className="kicker !text-clay-400 animate-hero">{hero.eyebrow}</p>
            <h1 className="display-xl mt-5 max-w-3xl text-white animate-hero" style={{ animationDelay: '120ms' }}>
              {hero.title}
            </h1>
            <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-white/85 md:text-lg animate-hero" style={{ animationDelay: '240ms' }}>
              {hero.subtitle}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap animate-hero" style={{ animationDelay: '360ms' }}>
              <Link href={hero.primaryHref} className="inline-flex h-14 items-center justify-center rounded-full bg-clay-400 px-8 text-[0.9375rem] font-bold text-acacia-700 shadow-lg transition hover:bg-clay-500 hover:text-white">
                {hero.primaryLabel}
              </Link>
              <Link href={hero.secondaryHref} className="inline-flex h-14 items-center justify-center rounded-full border border-white/40 px-8 text-[0.9375rem] font-semibold text-white backdrop-blur hover:bg-white/10">
                {hero.secondaryLabel}
              </Link>
              <Link href="/donate" className="inline-flex h-14 items-center justify-center rounded-full px-6 text-[0.9375rem] font-semibold text-clay-400 underline-offset-4 hover:underline">
                Donate now
              </Link>
            </div>
            <Link href="/impact" className="mt-10 inline-flex items-center gap-3 rounded-full bg-white/95 py-1.5 pl-2 pr-4 text-[0.8125rem] font-semibold text-acacia-700 shadow-sm">
              <WscLogo src={settings.brand.wscLogoUrl} height={28} />
              Our impact work is with WSC — We Save Children
            </Link>
          </div>
          <div className="order-2 mx-auto w-full max-w-[19rem] sm:max-w-[26rem] lg:max-w-[34rem]">
            <Globe markers={markers} home={homePoint} tone="dark" initialLng={-homePoint.lng + 10} />
          </div>
        </div>
      </section>

      {homeBanners.map((banner) => (
        <section key={banner.id} className="shell pt-10">
          <div className="flex flex-col gap-4 overflow-hidden rounded-[1.4rem] bg-[color:var(--color-cream)] sm:flex-row sm:items-center">
            {banner.imageUrl && (
              <div className="relative aspect-[16/9] sm:aspect-auto sm:h-40 sm:w-64 sm:shrink-0">
                <SmartImage src={banner.imageUrl} alt="" fill sizes="256px" className="object-cover" />
              </div>
            )}
            <div className="flex flex-1 flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-display text-2xl text-acacia-700">{banner.message}</p>
              {banner.linkUrl && <Link href={banner.linkUrl} className="inline-flex h-11 shrink-0 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">{banner.linkLabel || 'Find out more'}</Link>}
            </div>
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
        <section className="shell py-14 md:py-20">
          <SectionTitle kicker="Enhakkore" title={title} subtitle={subtitle} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((pillar) => (
              <Link key={pillar.href} href={pillar.href} className="card-lift group rounded-[1.3rem] border border-line bg-white p-6">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-acacia-600 text-clay-400">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {pillar.icon}
                  </svg>
                </span>
                <p className="mt-5 font-display text-2xl text-acacia-700">{pillar.title}</p>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{pillar.body}</p>
                <span className="mt-4 inline-block text-sm font-bold text-clay-600 transition group-hover:translate-x-1">Enter →</span>
              </Link>
            ))}
          </div>
        </section>
      );
    case 'happening': {
      const trips = (home?.trips ?? []).filter((trip) => trip.nextDeparture).slice(0, 2);
      const upcoming = hub?.upcoming ?? [];
      if (!upcoming.length && !trips.length) {
        return (
          <section className="shell py-10">
            <SectionTitle kicker="Now" title={title} />
            <p className="rounded-[1.1rem] border border-dashed border-line-strong bg-white p-6 text-ink-muted">
              Nothing is scheduled just yet. New activities, events and trips appear here as soon as they are published — or{' '}
              <Link href="/experiences/publish" className="font-semibold text-acacia-600 underline">publish your own activity</Link>.
            </p>
          </section>
        );
      }
      return (
        <section className="shell py-14 md:py-20">
          <SectionTitle kicker="Now" title={title} subtitle={subtitle} action={<More href="/experiences#upcoming" />} />
          <UpcomingGrid items={upcoming} limit={trips.length ? 4 : 6} />
          {trips.length > 0 && <CardGrid className="mt-5">{trips.map((trip) => <TripCard key={trip.slug} trip={trip} />)}</CardGrid>}
        </section>
      );
    }
    case 'interests':
      return (
        <section className="bg-[color:var(--color-cream)]">
          <div className="shell py-14 md:py-20">
            <SectionTitle kicker="Interests" title={title} subtitle={subtitle} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {INTERESTS.map((interest) => (
                <Link key={interest.href} href={interest.href} className="card-lift flex items-center gap-3 rounded-[1rem] border border-line bg-white p-4">
                  <span className="text-2xl" aria-hidden>{interest.icon}</span>
                  <span className="font-semibold leading-tight text-acacia-700">{interest.label}</span>
                </Link>
              ))}
            </div>
            <p className="mt-6 text-sm text-ink-muted">
              All eight parts of Experiences: {EXPERIENCE_SECTIONS.map((section) => section.label).join(' · ')}.
            </p>
          </div>
        </section>
      );
    case 'destinations': {
      const countries = catalogue.countries.filter((country) => country.heroImage && (country.total > 0 || country.featured)).slice(0, 6);
      if (!countries.length) return null;
      return (
        <section className="shell py-14 md:py-20">
          <SectionTitle kicker="Destinations" title={title} subtitle={subtitle} action={<More href="/destinations" />} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {countries.map((country) => (
              <Link key={country.code} href={`/destinations/${country.slug}`} className="group relative block aspect-[4/3] overflow-hidden rounded-[1.2rem]">
                <SmartImage src={country.heroImage!} alt="" fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                <div className="absolute inset-0 bg-gradient-to-t from-acacia-900/80 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <p className="font-display text-2xl">{country.name}</p>
                  <p className="text-sm text-white/80">{country.cities.filter((city) => city.total > 0).map((city) => city.name).slice(0, 3).join(' · ') || country.region}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      );
    }
    case 'upcoming': {
      const trips = home?.trips ?? [];
      const guided = hub?.guided ?? home?.experiences ?? [];
      if (!trips.length && !guided.length) return null;
      return (
        <section className="shell py-14 md:py-20">
          <SectionTitle kicker="Travel & Experiences" title={title} subtitle={subtitle} action={<More href="/travel" label="All trips" />} />
          <CardGrid>
            {trips.slice(0, 3).map((trip) => <TripCard key={trip.slug} trip={trip} />)}
            {guided.slice(0, Math.max(0, 6 - Math.min(3, trips.length))).map((item) => <ExperienceCard key={item.id} item={item} />)}
          </CardGrid>
          {home?.pastTrips.length ? (
            <div className="mt-8">
              <p className="text-sm font-semibold text-ink-muted">Where we have been</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {home.pastTrips.map((trip) => <Link key={trip.slug} href={`/travel/${trip.slug}`} className="chip">{trip.title}</Link>)}
              </div>
            </div>
          ) : null}
        </section>
      );
    }
    case 'trending':
      // Only genuine engagement; when there is none yet, the section is left out rather than faked.
      if (!trending.length) return null;
      return (
        <section className="shell py-14 md:py-20">
          <SectionTitle kicker="Trending" title={title} subtitle={subtitle} />
          <CardGrid>
            {trending.slice(0, 6).map((item) => (
              <ListingCard
                key={item.href}
                href={item.href}
                image={item.image}
                kicker={item.kind}
                title={item.title}
                meta={[item.where]}
                badges={item.sponsored ? [{ label: 'Sponsored', tone: 'gold' }] : []}
              />
            ))}
          </CardGrid>
        </section>
      );
    case 'impact':
      return (
        <section className="bg-[color:var(--color-cream)]">
          <div className="shell py-14 md:py-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
              <div>
                <WscLogo src={settings.brand.wscLogoUrl} height={68} />
                <p className="kicker mt-6">Enhakkore Impact</p>
                <h2 className="display-lg mt-3 text-acacia-700">{title}</h2>
                <p className="mt-4 text-ink-soft">{subtitle} {settings.impact.wscIntro}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/impact" className="inline-flex h-12 items-center rounded-full bg-acacia-600 px-6 font-bold text-white">Our impact</Link>
                  <Link href="/donate" className="inline-flex h-12 items-center rounded-full bg-safari-500 px-6 font-bold text-white">Donate</Link>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {(home?.impact ?? []).slice(0, 2).map((project) => (
                  <ListingCard key={project.slug} href={`/impact/${project.slug}`} image={project.heroImage} kicker={project.status === 'COMPLETED' ? 'Completed' : 'Project'} title={project.title} meta={[project.location]} />
                ))}
              </div>
            </div>
          </div>
        </section>
      );
    case 'join':
      return (
        <section className="shell py-14 md:py-20">
          <div className="overflow-hidden rounded-[1.6rem] bg-acacia-700 p-8 text-white md:p-14">
            <p className="kicker !text-clay-400">Membership is free</p>
            <h2 className="display-lg mt-3 max-w-2xl">{title}</h2>
            <p className="mt-4 max-w-2xl text-white/80">{subtitle}</p>
            <ul className="mt-6 grid gap-2 text-[0.9375rem] text-white/85 sm:grid-cols-2">
              <li>✓ Register for activities, events and free gaming tournaments</li>
              <li>✓ Join communities and get their announcements</li>
              <li>✓ Apply for trips and, once confirmed, join the private trip group</li>
              <li>✓ Save places, follow your enquiries and reservations</li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/join" className="inline-flex h-12 items-center rounded-full bg-clay-400 px-7 font-bold text-acacia-700 hover:bg-clay-500 hover:text-white">Join Enhakkore</Link>
              <Link href="/signin" className="inline-flex h-12 items-center rounded-full border border-white/40 px-7 font-semibold text-white hover:bg-white/10">Sign in</Link>
            </div>
          </div>
        </section>
      );
    default:
      return null;
  }
}
