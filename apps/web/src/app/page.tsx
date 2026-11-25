import Link from 'next/link';
import type { HomepageSectionKey } from '@enhakkore/shared';
import { formatInZone } from '@enhakkore/shared';
import { HeroMedia, type HeroVideoSource } from '@/components/home/HeroMedia';
import { Globe } from '@/components/home/Globe';
import type { HomeData } from '@/components/home/types';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, ListingCard, SectionTitle } from '@/components/public/Cards';
import { ActivityCard, EventCard, ExperienceCard, PlaceCard, TripCard } from '@/components/public/listings';
import { SmartImage } from '@/components/public/SmartImage';
import { WscLogo } from '@/components/site/BrandLogo';
import { SocialIcon } from '@/components/site/SocialIcon';
import { apiGet } from '@/lib/api';
import { getCatalogue, type Catalogue } from '@/lib/public';
import { getSite, waHref, type Site } from '@/lib/site';

export const revalidate = 60;

/**
 * Pexels clip "Wildlife photography at Nairobi National Park" (In Old News LLC,
 * Pexels License), three renditions, smallest first. Shown only when the owner
 * leaves the hero video switched on, and never on slow connections or with
 * reduced motion (see HeroMedia).
 */
const HERO_VIDEOS: HeroVideoSource[] = [
  { src: '/media/hero/safari-tourist-360-v1.mp4', maxViewport: 767 },
  { src: '/media/hero/safari-tourist-540-v1.mp4', maxViewport: 1279 },
  { src: '/media/hero/safari-tourist-720-v1.mp4', maxViewport: Infinity },
];

const More = ({ href, label = 'See all' }: { href: string; label?: string }) => (
  <Link href={href} className="chip w-fit">
    {label} →
  </Link>
);

export default async function HomePage() {
  const site = await getSite();
  const { settings } = site;
  const [home, catalogue] = await Promise.all([apiGet<HomeData>(`/public/home?city=${settings.launch.citySlug}`, 60), getCatalogue()]);
  const hero = settings.homepage.hero;
  const homeBanners = site.banners.filter((banner) => banner.placement === 'HOME');

  return (
    <PublicShell>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-acacia-900">
        <HeroMedia poster={hero.imageUrl} alt="" videos={hero.videoEnabled ? HERO_VIDEOS : []} />
        <div className="absolute inset-0 -z-0 bg-gradient-to-r from-acacia-900/90 via-acacia-900/55 to-acacia-900/10" />
        <div className="shell relative z-10 flex min-h-[78vh] flex-col justify-end pb-14 pt-24 md:min-h-[86vh] md:pb-20">
          <p className="kicker !text-clay-400 animate-hero">{hero.eyebrow}</p>
          <h1 className="display-xl mt-5 max-w-4xl text-white animate-hero" style={{ animationDelay: '120ms' }}>
            {hero.title}
          </h1>
          <p className="mt-6 max-w-2xl text-[1.0625rem] leading-relaxed text-white/85 md:text-lg animate-hero" style={{ animationDelay: '240ms' }}>
            {hero.subtitle}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row animate-hero" style={{ animationDelay: '360ms' }}>
            <Link href={hero.primaryHref} className="inline-flex h-14 items-center justify-center rounded-full bg-clay-400 px-8 text-[0.9375rem] font-bold text-acacia-700 shadow-lg transition hover:bg-clay-500 hover:text-white">
              {hero.primaryLabel}
            </Link>
            <Link href={hero.secondaryHref} className="inline-flex h-14 items-center justify-center rounded-full border border-white/40 px-8 text-[0.9375rem] font-semibold text-white backdrop-blur hover:bg-white/10">
              {hero.secondaryLabel}
            </Link>
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
          <HomeSection key={section.key} sectionKey={section.key} title={section.title} subtitle={section.subtitle} home={home} site={site} catalogue={catalogue} />
        ))}
    </PublicShell>
  );
}

function HomeSection({
  sectionKey,
  title,
  subtitle,
  home,
  site,
  catalogue,
}: {
  sectionKey: HomepageSectionKey;
  title: string;
  subtitle: string;
  home: HomeData | null;
  site: Site;
  catalogue: Catalogue;
}) {
  const { settings } = site;
  switch (sectionKey) {
    case 'search': {
      const activityCategories = catalogue.categories.filter((category) => category.kind === 'ACTIVITY' && category.featured).slice(0, 8);
      return (
        <section className="shell -mt-0 py-12 md:py-16">
          <div className="rounded-[1.6rem] border border-line bg-white p-5 shadow-[var(--shadow-raised)] md:p-8">
            <p className="font-display text-2xl text-acacia-700 md:text-3xl">{title}</p>
            <form action="/search" className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input name="q" placeholder="Search activities, places, events, trips, cities…" className="field h-14 text-base" />
              <button className="h-14 shrink-0 rounded-[var(--radius-field)] bg-acacia-600 px-8 font-bold text-white hover:bg-acacia-500">Search</button>
            </form>
            <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
              {activityCategories.map((category) => (
                <Link key={category.slug} href={`/activities?category=${category.slug}`} className="chip">
                  <span aria-hidden>{category.icon}</span> {category.name}
                </Link>
              ))}
              <Link href="/discover" className="chip">🏖️ Places</Link>
              <Link href="/events" className="chip">🎉 Events</Link>
              <Link href="/travel" className="chip">🧭 Trips</Link>
            </div>
          </div>
        </section>
      );
    }
    case 'weekend': {
      const weekend = home?.weekend;
      const items = weekend ? [...weekend.events.map((item) => ({ item, kind: 'event' })), ...weekend.activities.map((item) => ({ item, kind: 'activity' })), ...weekend.experiences.map((item) => ({ item, kind: 'experience' }))] : [];
      return (
        <section className="bg-[color:var(--color-cream)]">
          <div className="shell py-14 md:py-20">
            <SectionTitle
              kicker={`Weekend Radar · ${home?.launch.cityName ?? settings.launch.cityName}`}
              title={title}
              subtitle={weekend ? `${formatInZone(weekend.start, weekend.zone, 'weekday')} – ${formatInZone(weekend.end, weekend.zone, 'weekday')}` : subtitle}
              action={<More href={`/weekend?city=${settings.launch.citySlug}`} label="Weekend Radar" />}
            />
            {items.length ? (
              <CardGrid>
                {items.slice(0, 6).map(({ item, kind }) =>
                  kind === 'event' ? <EventCard key={item.id} item={item} /> : kind === 'activity' ? <ActivityCard key={item.id} item={item} /> : <ExperienceCard key={item.id} item={item} />,
                )}
              </CardGrid>
            ) : (
              <div className="flex flex-col gap-4 rounded-[1.2rem] border border-dashed border-line-strong bg-white p-6 md:flex-row md:items-center md:justify-between">
                <p className="text-ink-soft">Nothing is listed for this weekend yet. Be the one who starts something.</p>
                <div className="flex gap-2">
                  <Link href="/activities/host" className="inline-flex h-11 items-center rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700">Host an activity</Link>
                  <Link href="/activities" className="inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-semibold">Upcoming</Link>
                </div>
              </div>
            )}
          </div>
        </section>
      );
    }
    case 'activities': {
      const groups = ['Sports', 'Fitness & outdoors', 'Console gaming', 'Online & mobile gaming'];
      return (
        <section className="shell py-14 md:py-20">
          <SectionTitle kicker="Enhakkore Activities" title={title} subtitle={subtitle} action={<More href="/activities" />} />
          <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {groups.map((group) => {
              const items = catalogue.categories.filter((category) => category.kind === 'ACTIVITY' && category.group === group);
              if (!items.length) return null;
              return (
                <div key={group} className="rounded-[1.1rem] border border-line bg-white p-4">
                  <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-clay-600">{group}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {items.slice(0, 6).map((category) => (
                      <Link key={category.slug} href={`/activities?category=${category.slug}`} className={`rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold ${category.featured ? 'bg-acacia-600 text-white' : 'bg-[color:var(--color-cream)] text-acacia-700'}`}>
                        {category.icon} {category.name}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {home?.activities.length ? (
            <CardGrid>{home.activities.slice(0, 6).map((item) => <ActivityCard key={item.id} item={item} />)}</CardGrid>
          ) : null}
          <div className="mt-8 flex flex-col items-start gap-4 rounded-[1.4rem] bg-acacia-600 p-6 text-white md:flex-row md:items-center md:justify-between md:p-8">
            <div>
              <p className="font-display text-2xl">Got a game, a run or a gaming night in mind?</p>
              <p className="mt-1 text-white/75">Submitting an activity is free. Every activity is reviewed before it is published.</p>
            </div>
            <Link href="/activities/host" className="inline-flex h-12 shrink-0 items-center rounded-full bg-clay-400 px-6 font-bold text-acacia-700">Host an activity</Link>
          </div>
        </section>
      );
    }
    case 'people':
      return (
        <section className="bg-acacia-700 text-white">
          <div className="shell grid gap-8 py-14 md:grid-cols-[1.3fr_1fr] md:items-center md:py-20">
            <div>
              <p className="kicker !text-clay-400">Enhakkore Connect</p>
              <h2 className="display-lg mt-3">{title}</h2>
              <p className="mt-4 max-w-xl text-white/75">{subtitle}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/connect" className="inline-flex h-12 items-center rounded-full bg-clay-400 px-6 font-bold text-acacia-700">Find people</Link>
                <Link href="/join" className="inline-flex h-12 items-center rounded-full border border-white/30 px-6 font-semibold">Join free</Link>
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-3 text-sm">
              {['Basketball partners', 'Running buddies', 'FC & PlayStation', 'PUBG Mobile squads', 'Travel companions', 'Weekend explorers'].map((label) => (
                <li key={label} className="rounded-xl bg-white/5 px-4 py-3 font-semibold ring-1 ring-white/10">{label}</li>
              ))}
            </ul>
          </div>
        </section>
      );
    case 'places':
      return (
        <section className="shell py-14 md:py-20">
          <SectionTitle kicker="Enhakkore Discover" title={title} subtitle={subtitle} action={<More href="/discover" />} />
          {home?.places.length ? (
            <CardGrid>{home.places.slice(0, 6).map((item) => <PlaceCard key={item.id} item={item} />)}</CardGrid>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {catalogue.categories.filter((category) => category.kind === 'PLACE' && category.featured).map((category) => (
                <Link key={category.slug} href={`/discover?category=${category.slug}`} className="card-lift rounded-[1.1rem] border border-line bg-white p-4 text-center">
                  <p className="text-2xl">{category.icon}</p>
                  <p className="mt-1 text-sm font-semibold text-acacia-700">{category.name}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      );
    case 'trips':
      return (
        <section className="shell py-14 md:py-20">
          <SectionTitle kicker="Enhakkore Travel" title={title} subtitle={subtitle} action={<More href="/travel" />} />
          {home?.trips.length ? (
            <CardGrid>{home.trips.slice(0, 3).map((trip) => <TripCard key={trip.slug} trip={trip} />)}</CardGrid>
          ) : (
            <p className="text-ink-muted">The next trip is being planned.</p>
          )}
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
    case 'events':
      return home?.events.length ? (
        <section className="bg-[color:var(--color-cream)]">
          <div className="shell py-14 md:py-20">
            <SectionTitle kicker="Enhakkore Events" title={title} subtitle={subtitle} action={<More href="/events" />} />
            <CardGrid>{home.events.slice(0, 3).map((item) => <EventCard key={item.id} item={item} />)}</CardGrid>
          </div>
        </section>
      ) : null;
    case 'experiences':
      return home?.experiences.length ? (
        <section className="shell py-14 md:py-20">
          <SectionTitle kicker="Enhakkore Experiences" title={title} subtitle={subtitle} action={<More href="/experiences" />} />
          <CardGrid>{home.experiences.slice(0, 3).map((item) => <ExperienceCard key={item.id} item={item} />)}</CardGrid>
        </section>
      ) : null;
    case 'catering':
      return (
        <section className="shell py-14 md:py-20">
          <div className="grid overflow-hidden rounded-[1.6rem] bg-[color:var(--color-cream)] md:grid-cols-2">
            <div className="p-8 md:p-12">
              <p className="kicker">Catering & lunchboxes</p>
              <h2 className="display-md mt-3 text-acacia-700">{title}</h2>
              <p className="mt-3 text-ink-soft">{subtitle}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/catering" className="inline-flex h-12 items-center rounded-full bg-acacia-600 px-6 font-bold text-white">See catering</Link>
                <a href={waHref(settings, 'catering')} target="_blank" rel="noreferrer noopener" className="inline-flex h-12 items-center gap-2 rounded-full border border-line-strong bg-white px-5 font-semibold"><SocialIcon platform="whatsapp" size={18} /> Order</a>
              </div>
            </div>
            <div className="relative min-h-[220px]">
              <SmartImage src={home?.catering.find((item) => item.coverImage)?.coverImage ?? '/packages/arusha/chemka-1.webp'} alt="" fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
            </div>
          </div>
        </section>
      );
    case 'globe': {
      const markers = catalogue.countries.filter((country) => (country.total > 0 || country.featured) && country.latitude !== null).map((country) => ({ lat: country.latitude!, lng: country.longitude!, label: country.name, href: `/destinations/${country.slug}` }));
      return (
        <section className="shell grid gap-10 py-14 md:grid-cols-[1fr_1fr] md:items-center md:py-20">
          <div className="mx-auto w-full max-w-[26rem]">
            <Globe markers={markers} />
          </div>
          <div>
            <p className="kicker">International</p>
            <h2 className="display-lg mt-3 text-acacia-700">{title}</h2>
            <p className="mt-4 text-ink-soft">{subtitle} We start in {settings.launch.cityName} and add places as listings are confirmed — wherever you are, you can explore what is genuinely there.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {catalogue.countries.filter((country) => country.total > 0 || country.featured).slice(0, 8).map((country) => <Link key={country.code} href={`/destinations/${country.slug}`} className="chip">{country.name}</Link>)}
              <Link href="/destinations" className="chip chip-active">All destinations</Link>
            </div>
          </div>
        </section>
      );
    }
    case 'stories':
      return home?.stories.length || home?.whatsNew.length ? (
        <section className="shell py-14 md:py-20">
          <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <SectionTitle kicker="Community stories" title={title} action={<More href="/community" />} />
              {home.stories.length ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  {home.stories.slice(0, 2).map((story) => <ListingCard key={story.id} href={`/stories/${story.slug}`} image={story.coverImage} kicker={`By ${story.authorName}`} title={String(story.title)} meta={[(story.excerpt as string) ?? null]} />)}
                </div>
              ) : (
                <Link href="/stories/new" className="chip">Share the first story</Link>
              )}
            </div>
            <div>
              <SectionTitle kicker="What’s new" title="Recently added" />
              <ul className="divide-y divide-line rounded-[1.1rem] border border-line bg-white">
                {home.whatsNew.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-sand">
                      <span className="min-w-0">
                        <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-clay-600">{item.kind}</span>
                        <span className="block truncate font-semibold text-ink">{item.title}</span>
                      </span>
                      <span className="text-ink-faint">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null;
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
    case 'updates':
      return (
        <section className="shell py-14 md:py-20">
          <div className="rounded-[1.6rem] border border-line bg-white p-8 text-center md:p-12">
            <p className="kicker justify-center">Community updates</p>
            <h2 className="display-md mt-3 text-acacia-700">{title}</h2>
            <p className="mx-auto mt-3 max-w-xl text-ink-soft">{subtitle}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {settings.social.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noreferrer noopener" className="inline-flex h-12 items-center gap-2 rounded-full bg-acacia-600 px-5 font-semibold text-white">
                  <SocialIcon platform={link.platform} size={18} /> {link.label}
                </a>
              ))}
              <a href={waHref(settings, 'general')} target="_blank" rel="noreferrer noopener" className="inline-flex h-12 items-center gap-2 rounded-full bg-[#1f9d55] px-5 font-semibold text-white">
                <SocialIcon platform="whatsapp" size={18} /> WhatsApp
              </a>
            </div>
          </div>
        </section>
      );
    default:
      return null;
  }
}
