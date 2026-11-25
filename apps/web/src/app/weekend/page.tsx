import type { Metadata } from 'next';
import Link from 'next/link';
import { formatInZone } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Empty, PageHero } from '@/components/public/Cards';
import { ActivityCard, EventCard, ExperienceCard } from '@/components/public/listings';
import type { HomeData } from '@/components/home/types';
import { apiGet } from '@/lib/api';
import { getCatalogue } from '@/lib/public';
import { getSite } from '@/lib/site';

export const metadata: Metadata = { title: 'This weekend', description: 'Activities, events and experiences happening this weekend.' };
export const revalidate = 60;

export default async function WeekendPage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { settings } = await getSite();
  const city = (await searchParams).city ?? settings.launch.citySlug;
  const [home, catalogue] = await Promise.all([apiGet<HomeData>(`/public/home?city=${encodeURIComponent(city)}`, 60), getCatalogue()]);
  const weekend = home?.weekend;
  const items = weekend ? weekend.activities.length + weekend.events.length + weekend.experiences.length : 0;
  const cities = catalogue.countries.flatMap((country) => country.cities.map((entry) => ({ ...entry, country: country.name })));
  return (
    <PublicShell>
      <PageHero
        kicker="Weekend Radar"
        title={`This weekend${weekend?.city ? ` in ${weekend.city.name}` : ''}`}
        intro={weekend ? `${formatInZone(weekend.start, weekend.zone, 'weekday')} – ${formatInZone(weekend.end, weekend.zone, 'weekday')}, local time.` : null}
      >
        <div className="flex flex-wrap gap-2">{cities.map((entry) => <Link key={`${entry.country}-${entry.slug}`} href={`/weekend?city=${entry.slug}`} className={`chip ${entry.slug === city ? 'chip-active' : ''}`}>{entry.name}</Link>)}</div>
      </PageHero>
      <section className="shell space-y-10 py-12">
        {!weekend || items === 0 ? (
          <Empty title="Nothing listed for this weekend yet" body="Have a look at what is coming up, or start something yourself." action={<><Link href="/activities" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Upcoming activities</Link><Link href="/activities/host" className="inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-semibold">Host an activity</Link></>} />
        ) : (
          <CardGrid>
            {weekend.events.map((item) => <EventCard key={item.id} item={item} />)}
            {weekend.activities.map((item) => <ActivityCard key={item.id} item={item} />)}
            {weekend.experiences.map((item) => <ExperienceCard key={item.id} item={item} />)}
          </CardGrid>
        )}
      </section>
    </PublicShell>
  );
}
