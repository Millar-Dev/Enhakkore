import type { Metadata } from 'next';
import Link from 'next/link';
import type { HubData } from '@/components/home/types';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Empty, ListingCard, SectionTitle } from '@/components/public/Cards';
import { CommunityTile, sectionHref } from '@/components/public/experience';
import { ExperienceCard } from '@/components/public/listings';
import { SmartImage } from '@/components/public/SmartImage';
import { UpcomingGrid } from '@/components/public/UpcomingGrid';
import { apiGet, query } from '@/lib/api';
import { getCatalogue, pick } from '@/lib/public';
import { getSite } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Experiences',
  description: 'Events, activities, communities, sports, gaming and more — discover what is on, plan an event, or publish your own activity.',
};
export const revalidate = 60;

/** Photographs where Enhakkore has its own; otherwise a coloured tile. */
const TILE_IMAGES: Record<string, string> = {
  GAMING: '/media/gaming/gaming-hero.jpg',
  ARTS: '/packages/arusha/cultural-heritage-centre.webp',
  OUTDOOR: '/packages/arusha/napuru-waterfalls.webp',
};
const TILE_COLOURS: Record<string, string> = {
  PARTIES: 'from-[#3a1d5c] to-[#0a1a2e]',
  COMMUNITIES: 'from-[#0f4a76] to-[#0a1a2e]',
  SPORTS: 'from-[#1f6b3a] to-[#0a1a2e]',
  LEARNING: 'from-[#7a5a14] to-[#0a1a2e]',
  OTHER: 'from-[#28406b] to-[#0a1a2e]',
};

export default async function ExperiencesHub({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pick(await searchParams, ['q', 'country', 'city', 'filters']);
  const [hub, catalogue, { settings }] = await Promise.all([apiGet<HubData>(`/public/experiences-hub${query({ q: params.q, country: params.country, city: params.city })}`, 60), getCatalogue(), getSite()]);
  const country = catalogue.countries.find((item) => item.code.toLowerCase() === params.country?.toLowerCase() || item.slug === params.country);
  const showFilters = params.filters === '1' || !!params.country || !!params.city;
  const upcoming = hub?.upcoming ?? [];
  const gaming = upcoming.filter((item) => item.kind === 'Gaming').slice(0, 4);
  const recurring = upcoming.filter((item) => item.recurrence).slice(0, 4);

  return (
    <PublicShell>
      {/* 1–2. Compact hero with search */}
      <section className="band band-navy relative overflow-hidden text-white">
        <SmartImage src={settings.gaming.heroImage} alt="" fill priority sizes="100vw" className="object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-acacia-900/95 via-acacia-900/70 to-acacia-900/30" />
        <div className="shell relative py-7 md:py-12">
          <span className="rounded-full bg-clay-400 px-3 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-acacia-700">Experiences</span>
          <h1 className="mt-3 max-w-2xl font-display text-[2rem] leading-[1.05] md:text-[3.2rem]">Discover. Join. Create. Experience more.</h1>
          <p className="mt-2 max-w-xl text-sm text-white/75 md:text-base">Events, activities, communities and gaming — in your city and beyond.</p>
          <form action="/experiences" className="mt-5 flex max-w-2xl items-center gap-1 rounded-full bg-white p-1 pl-4 text-ink shadow-xl">
            <input name="q" defaultValue={params.q} placeholder="Search experiences — e.g. Free Fire, basketball" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Search experiences" />
            {country && <input type="hidden" name="country" value={country.code} />}
            <Link href={`/experiences?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), filters: showFilters ? '0' : '1' }).toString()}`} className="hidden shrink-0 rounded-full px-3 py-2 text-xs font-semibold text-acacia-600 sm:block">📍 {country?.name ?? 'Anywhere'}</Link>
            <button className="h-10 shrink-0 rounded-full bg-acacia-600 px-4 text-sm font-bold text-white" aria-label="Search">Search</button>
          </form>
          <div className="mt-2 flex gap-3 text-xs">
            <Link href={`/experiences?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), filters: showFilters ? '0' : '1' }).toString()}`} className="inline-flex min-h-10 items-center font-semibold text-clay-400 underline-offset-4 hover:underline">{showFilters ? 'Hide filters' : 'Filters'}</Link>
            {(params.q || params.country || params.city) && <Link href="/experiences" className="text-white/70 underline">Clear</Link>}
          </div>
          {showFilters && (
            <form action="/experiences" className="mt-3 grid max-w-2xl grid-cols-2 gap-2 rounded-2xl bg-white/10 p-2 backdrop-blur">
              {params.q && <input type="hidden" name="q" value={params.q} />}
              <input type="hidden" name="filters" value="1" />
              <select name="country" defaultValue={country?.code ?? ''} className="field h-10 text-ink" aria-label="Country">
                <option value="">Any country</option>
                {catalogue.countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              </select>
              <select name="city" defaultValue={params.city ?? ''} className="field h-10 text-ink" aria-label="City">
                <option value="">Any city</option>
                {(country?.cities ?? catalogue.countries.flatMap((item) => item.cities)).map((city) => <option key={city.slug} value={city.slug}>{city.name}</option>)}
              </select>
              <button className="col-span-2 h-10 rounded-full bg-clay-400 text-sm font-bold text-acacia-700">Apply</button>
            </form>
          )}
        </div>
      </section>

      {/* 3. Three journeys */}
      <section className="band band-dark-a text-white">
        <div className="shell py-5 md:py-9">
        <p className="band-kicker mb-2.5 text-clay-400">Start here</p>
        {/* Three journeys: square tiles side by side on phones, wide cards on larger screens. */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
          {[
            { href: '#upcoming', title: 'Discover experiences', short: 'Discover', line: 'Find events, activities and communities', icon: '🔍', tone: 'bg-gradient-to-br from-[#6d35c9] to-[#3f1d86]' },
            { href: '/experiences/plan', title: 'Plan an event', short: 'Plan an event', line: 'Help with venue, catering and setup', icon: '🗓️', tone: 'bg-gradient-to-br from-[#e0701f] to-[#a3430c]' },
            { href: '/experiences/publish', title: 'Publish an event or activity', short: 'Publish activity', line: 'List your own — reviewed by our team', icon: '➕', tone: 'bg-gradient-to-br from-[#1f9a55] to-[#0f6236]' },
          ].map((card) => (
            <Link key={card.title} href={card.href} className={`card-lift flex min-h-[6.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl p-2.5 text-center text-white sm:flex-row sm:justify-start sm:gap-3 sm:p-4 sm:text-left ${card.tone}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/20 text-lg" aria-hidden>{card.icon}</span>
              <span className="min-w-0">
                <span className="block text-[0.8125rem] font-bold leading-tight sm:hidden">{card.short}</span>
                <span className="hidden font-display text-[1.15rem] leading-tight sm:block">{card.title} →</span>
                <span className="hidden text-xs opacity-85 sm:block">{card.line}</span>
              </span>
            </Link>
          ))}
        </div>
        </div>
      </section>

      {/* 4. Categories */}
      <section className="band band-dark-b text-white">
        <div className="shell py-6 md:py-10">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="band-kicker text-clay-400">Categories</p>
            <h2 className="font-display text-[1.45rem] text-white md:text-[2rem]">Browse by category</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3">
          {(hub?.sections ?? []).map((section) => (
            <Link key={section.key} href={sectionHref(section.key)} className={`group relative flex h-[4.5rem] items-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-br px-3 text-white md:h-24 ${TILE_COLOURS[section.key] ?? 'from-acacia-600 to-acacia-900'}`}>
              {TILE_IMAGES[section.key] && (
                <>
                  <SmartImage src={TILE_IMAGES[section.key]!} alt="" fill sizes="25vw" className="object-cover opacity-60 transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-r from-acacia-900/90 to-acacia-900/30" />
                </>
              )}
              <span className="relative text-2xl md:text-3xl" aria-hidden>{section.icon}</span>
              <span className="relative font-semibold leading-tight">{section.label}</span>
            </Link>
          ))}
        </div>
        </div>
      </section>

      {/* 5. Upcoming */}
      <section id="upcoming" className="band band-dark-a scroll-mt-24 text-white">
        <div className="shell py-6 md:py-10">
        <SectionTitle dark kicker="Upcoming" title={params.q ? `Upcoming: “${params.q}”` : 'Upcoming experiences'} />
        {upcoming.length ? (
          <UpcomingGrid items={upcoming} limit={9} />
        ) : (
          <Empty title="Nothing matches yet" body="New activities, events and tournaments appear here as soon as they are published." action={<Link href="/experiences/publish" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Publish an activity</Link>} />
        )}
        </div>
      </section>

      {/* 6. Popular */}
      {hub?.popular.length ? (
        <section className="band band-dark-b text-white">
          <div className="shell py-6 md:py-10">
          <SectionTitle dark kicker="Popular" title="Popular and most visited" subtitle="Ranked by members’ real views, saves and sign-ups — never by payment." />
          <UpcomingGrid items={hub.popular} />
          </div>
        </section>
      ) : null}

      {/* 7. Gaming hub */}
      <section className="band band-gaming relative overflow-hidden text-white">
        <SmartImage src={settings.gaming.heroImage} alt="" fill sizes="100vw" className="object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0a24]/70 to-[#04121e]/90" />
        <div className="shell relative py-7 md:py-12">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[0.625rem] font-bold uppercase tracking-[0.2em] text-clay-400">Gaming & esports hub</p>
              <h2 className="font-display text-[1.6rem] md:text-[2.2rem]">Tournaments, squads & console nights</h2>
            </div>
            <Link href="/experiences/gaming" className="inline-flex min-h-10 shrink-0 items-center text-sm font-semibold text-clay-400">Open hub →</Link>
          </div>
          {gaming.length ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 [&>*]:min-w-0">
              {gaming.map((item) => (
                <ListingCard key={item.id} href={item.href} image={item.image} kicker={item.category} title={item.title} meta={[item.where]} badges={[...(item.isDemo ? [{ label: 'Demo', tone: 'demo' as const }] : []), { label: 'Free', tone: 'green' as const }]} />
              ))}
            </div>
          ) : (
            <p className="text-white/70">Tournaments are announced here — all free to enter at launch.</p>
          )}
        </div>
      </section>

      {/* 8. Communities and recurring activities */}
      {(hub?.communities.length || recurring.length) ? (
        <section className="band band-dark-a text-white">
          <div className="shell py-7 md:py-10">
          {recurring.length > 0 && (
            <div className="mb-8">
              <SectionTitle dark kicker="Every week" title="Recurring activities" />
              <UpcomingGrid items={recurring} />
            </div>
          )}
          {hub?.communities.length ? (
            <div>
              <SectionTitle dark kicker="Communities" title="Find your community" action={<Link href="/experiences/communities" className="inline-flex h-10 w-fit items-center rounded-full border border-white/30 px-4 text-sm font-semibold text-clay-400">All communities →</Link>} />
              <CardGrid>{hub.communities.map((community) => <CommunityTile key={community.id} community={community} />)}</CardGrid>
            </div>
          ) : null}
          </div>
        </section>
      ) : null}

      {/* 9. Guided experiences */}
      {hub?.guided.length ? (
        <section className="band band-dark-b text-white">
          <div className="shell py-7 md:py-10">
          <SectionTitle dark kicker="Guided" title="Guided experiences and tours" action={<Link href="/experiences/guided" className="inline-flex h-10 w-fit items-center rounded-full border border-white/30 px-4 text-sm font-semibold text-clay-400">See all →</Link>} />
          <CardGrid>{hub.guided.map((item) => <ExperienceCard key={item.id} item={item} />)}</CardGrid>
          </div>
        </section>
      ) : null}
    </PublicShell>
  );
}
