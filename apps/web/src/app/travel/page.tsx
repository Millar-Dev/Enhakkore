import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/layout/PublicShell';
import { AppHero } from '@/components/public/AppHero';
import { Empty } from '@/components/public/Cards';
import { TripPackageCard, type TripListing } from '@/components/public/listings';
import { apiGet } from '@/lib/api';
import { getSite, waHref } from '@/lib/site';

export const metadata: Metadata = { title: 'Enhakkore Travel', description: 'Group trips, private journeys, safaris and holidays run by Enhakkore.' };
export const revalidate = 60;

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'private', label: 'Private trip' },
];

export default async function TravelPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const tab = String((await searchParams).tab ?? 'upcoming');
  const [{ settings }, upcoming, past] = await Promise.all([
    getSite(),
    apiGet<{ items: TripListing[] }>('/public/trips', 60),
    apiGet<{ items: TripListing[] }>('/public/trips?when=past', 60),
  ]);
  const list = tab === 'completed' ? past?.items ?? [] : upcoming?.items ?? [];
  return (
    <PublicShell>
      <AppHero
        title="Travel"
        subtitle="Group trips, safaris & custom journeys"
        search={{ action: '/search', placeholder: 'Search trips or destinations…', hidden: { type: 'trip' } }}
        pills={[
          { label: 'All destinations', icon: '🌍', href: '/destinations' },
          { label: 'Custom dates', icon: '📅', href: '/private-trips' },
        ]}
      >
        <nav aria-label="Trips" className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
          {TABS.map((item) => (
            <Link
              key={item.key}
              href={item.key === 'private' ? '/private-trips' : item.key === 'upcoming' ? '/travel' : `/travel?tab=${item.key}`}
              aria-current={tab === item.key ? 'page' : undefined}
              className={`inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold ${tab === item.key ? 'bg-clay-400 text-acacia-700' : 'bg-white/10 text-white hover:bg-white/15'}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </AppHero>
      <section className="band band-dark-b">
        <div className="shell py-6 md:py-12">
          {list.length ? (
            <div className="grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">{list.map((trip) => <TripPackageCard key={trip.slug} trip={trip} />)}</div>
          ) : (
            <Empty
              title={tab === 'completed' ? 'No completed trips yet' : 'No upcoming trips right now'}
              body="The next one is being planned. Follow us, or tell us where you would like to go."
              action={<a href={waHref(settings, 'general')} target="_blank" rel="noreferrer noopener" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Message us</a>}
            />
          )}
        </div>
      </section>
      <section className="shell py-10 md:py-16">
        <div className="grid gap-6 rounded-[1.4rem] bg-acacia-600 p-6 text-white md:grid-cols-[1.4fr_1fr] md:items-center md:p-12">
          <div>
            <p className="kicker !text-clay-400">Private & custom</p>
            <h2 className="display-md mt-3">Your dates, your people, your pace</h2>
            <p className="mt-3 text-white/75">Safaris, holidays, family trips, team retreats and international journeys — tell us what you have in mind and we will plan it with you.</p>
          </div>
          <div className="flex flex-col gap-3">
            <a href={waHref(settings, 'privateTrip')} target="_blank" rel="noreferrer noopener" className="inline-flex h-12 items-center justify-center rounded-full bg-clay-400 font-bold text-acacia-700">Plan on WhatsApp</a>
            <Link href="/private-trips" className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 font-semibold">Send a trip request</Link>
            <Link href="/catering" className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 font-semibold">Catering & lunchboxes</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
