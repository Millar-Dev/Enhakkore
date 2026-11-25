import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, PageHero, SectionTitle } from '@/components/public/Cards';
import { ActivityCard, EventCard, ExperienceCard, PlaceCard } from '@/components/public/listings';
import { apiGet } from '@/lib/api';
import { getList } from '@/lib/public';

export const revalidate = 120;

interface CountryDetail { code: string; name: string; slug: string; cities: { id: string; name: string; slug: string; summary: string | null; heroImage: string | null }[] }

export async function generateMetadata({ params }: { params: Promise<{ country: string; city: string }> }): Promise<Metadata> {
  const { country, city } = await params;
  const detail = await apiGet<CountryDetail>(`/public/countries/${country}`, 120);
  const found = detail?.cities.find((item) => item.slug === city);
  return { title: found ? `${found.name}, ${detail!.name}` : 'City' };
}

export default async function CityPage({ params }: { params: Promise<{ country: string; city: string }> }) {
  const { country, city: citySlug } = await params;
  const detail = await apiGet<CountryDetail>(`/public/countries/${country}`, 120);
  const city = detail?.cities.find((item) => item.slug === citySlug);
  if (!detail || !city) notFound();
  const filter = { country: detail.code, city: city.slug, pageSize: 6 };
  const [activities, places, experiences, events] = await Promise.all([
    getList('/public/activities', filter),
    getList('/public/places', filter),
    getList('/public/experiences', filter),
    getList('/public/events', filter),
  ]);
  const empty = !activities.total && !places.total && !experiences.total && !events.total;
  return (
    <PublicShell>
      <PageHero kicker={detail.name} title={city.name} intro={city.summary} image={city.heroImage}>
        <div className="flex flex-wrap gap-2">
          <Link className="chip" href={`/weekend?city=${city.slug}`}>This weekend in {city.name}</Link>
          <Link className="chip" href={`/destinations/${detail.slug}`}>All of {detail.name}</Link>
        </div>
      </PageHero>
      <div className="shell space-y-16 py-12">
        {empty && <p className="rounded-xl bg-[color:var(--color-cream)] p-6 text-center text-ink-soft">Nothing is listed in {city.name} yet. <Link className="font-semibold text-acacia-600 underline" href="/activities/host">Host the first activity here</Link>.</p>}
        {activities.total ? <section><SectionTitle kicker="Activities" title={`In ${city.name}`} action={<Link className="chip" href={`/activities?country=${detail.code}&city=${city.slug}`}>All {activities.total}</Link>} /><CardGrid>{activities.items.map((item) => <ActivityCard key={item.id} item={item} />)}</CardGrid></section> : null}
        {events.total ? <section><SectionTitle kicker="Events" title="What’s on" /><CardGrid>{events.items.map((item) => <EventCard key={item.id} item={item} />)}</CardGrid></section> : null}
        {places.total ? <section><SectionTitle kicker="Discover" title="Places" /><CardGrid>{places.items.map((item) => <PlaceCard key={item.id} item={item} />)}</CardGrid></section> : null}
        {experiences.total ? <section><SectionTitle kicker="Experiences" title="Worth trying" /><CardGrid>{experiences.items.map((item) => <ExperienceCard key={item.id} item={item} />)}</CardGrid></section> : null}
      </div>
    </PublicShell>
  );
}
