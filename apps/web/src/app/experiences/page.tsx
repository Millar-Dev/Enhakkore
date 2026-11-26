import type { Metadata } from 'next';
import Link from 'next/link';
import type { HubData } from '@/components/home/types';
import { CommunityTile, sectionHref } from '@/components/public/experience';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Empty, SectionTitle } from '@/components/public/Cards';
import { ExperienceCard } from '@/components/public/listings';
import { UpcomingGrid } from '@/components/public/UpcomingGrid';
import { apiGet, query } from '@/lib/api';
import { getCatalogue, pick } from '@/lib/public';

export const metadata: Metadata = {
  title: 'Experiences',
  description: 'Events, activities, communities, sports, gaming and more — discover what is on, plan an event, or publish your own activity.',
};
export const revalidate = 60;

export default async function ExperiencesHub({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pick(await searchParams, ['q', 'country', 'city']);
  const [hub, catalogue] = await Promise.all([apiGet<HubData>(`/public/experiences-hub${query(params)}`, 60), getCatalogue()]);
  const country = catalogue.countries.find((item) => item.code.toLowerCase() === params.country?.toLowerCase() || item.slug === params.country);

  return (
    <PublicShell>
      <section className="bg-acacia-700 text-white">
        <div className="shell py-12 md:py-16">
          <p className="kicker !text-clay-400">Experiences</p>
          <h1 className="display-lg mt-3 max-w-3xl">Events, activities and communities</h1>
          <p className="mt-4 max-w-2xl text-white/80">Parties, sport, gaming, art, the outdoors and more — organised by Enhakkore and by members, reviewed before they are published. Browsing and joining is free.</p>
          <form action="/experiences" className="mt-7 grid gap-2 rounded-[1.2rem] bg-white p-3 text-ink sm:grid-cols-[2fr_1fr_1fr_auto]">
            <input name="q" defaultValue={params.q} placeholder="Search — e.g. “Free Fire”, “basketball”, “jogging”" className="field h-12" aria-label="Search experiences" />
            <select name="country" defaultValue={country?.code ?? ''} className="field h-12" aria-label="Country">
              <option value="">Everywhere</option>
              {catalogue.countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select>
            <select name="city" defaultValue={params.city ?? ''} className="field h-12" aria-label="City">
              <option value="">Any city</option>
              {(country?.cities ?? catalogue.countries.flatMap((item) => item.cities)).map((city) => <option key={city.slug} value={city.slug}>{city.name}</option>)}
            </select>
            <button className="h-12 rounded-[var(--radius-field)] bg-clay-400 px-6 font-bold text-acacia-700 hover:bg-clay-500 hover:text-white">Search</button>
          </form>
        </div>
      </section>

      <section className="shell py-10 md:py-14">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { href: '#upcoming', title: 'Discover experiences', body: 'Browse what is on, register, join communities and save what you like. Free.', cta: 'See what’s on' },
            { href: '/experiences/plan', title: 'Plan an event', body: 'A birthday, a launch, a wedding, a team day — tell us what you need and our team will get back to you. Sending a request is free.', cta: 'Start planning' },
            { href: '/experiences/publish', title: 'Publish an event or activity', body: 'Run a meetup, a game night or a weekly jog? Submit it — the team reviews it before it goes live.', cta: 'Publish yours' },
          ].map((card) => (
            <Link key={card.title} href={card.href} className="card-lift rounded-[1.3rem] border border-line bg-white p-6">
              <p className="font-display text-2xl text-acacia-700">{card.title}</p>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{card.body}</p>
              <span className="mt-4 inline-block text-sm font-bold text-clay-600">{card.cta} →</span>
            </Link>
          ))}
        </div>

        <div className="mt-14">
          <SectionTitle kicker="Browse" title="Browse by category" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(hub?.sections ?? []).map((section) => (
              <Link key={section.key} href={sectionHref(section.key)} className="card-lift rounded-[1.1rem] border border-line bg-white p-4">
                <span className="text-2xl" aria-hidden>{section.icon}</span>
                <p className="mt-2 font-semibold leading-tight text-acacia-700">{section.label}</p>
                <p className="mt-1 text-xs text-ink-muted">{section.count ? `${section.count} listed` : section.blurb}</p>
              </Link>
            ))}
          </div>
        </div>

        <div id="upcoming" className="mt-14 scroll-mt-28">
          <SectionTitle kicker="Upcoming" title={params.q ? `Upcoming: “${params.q}”` : 'Upcoming experiences'} />
          {hub?.upcoming.length ? (
            <UpcomingGrid items={hub.upcoming} />
          ) : (
            <Empty
              title={params.q || params.country ? 'Nothing matches yet' : 'Nothing scheduled yet'}
              body="New activities, events and tournaments appear here as soon as they are published. You can also publish your own."
              action={<Link href="/experiences/publish" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Publish an activity</Link>}
            />
          )}
        </div>

        {hub?.popular.length ? (
          <div className="mt-14">
            <SectionTitle kicker="Popular" title="Popular and most visited" subtitle="Ranked by real members’ views, saves and registrations — not by who paid." />
            <UpcomingGrid items={hub.popular} />
          </div>
        ) : null}

        {hub?.communities.length ? (
          <div className="mt-14">
            <SectionTitle kicker="Communities" title="Find your community" action={<Link href="/experiences/communities" className="chip w-fit">All communities →</Link>} />
            <CardGrid>{hub.communities.map((community) => <CommunityTile key={community.id} community={community} />)}</CardGrid>
          </div>
        ) : null}

        {hub?.guided.length ? (
          <div className="mt-14">
            <SectionTitle kicker="Guided" title="Guided experiences and tours" action={<Link href="/experiences/guided" className="chip w-fit">See all →</Link>} />
            <CardGrid>{hub.guided.map((item) => <ExperienceCard key={item.id} item={item} />)}</CardGrid>
          </div>
        ) : null}
      </section>
    </PublicShell>
  );
}
