import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, PageHero, SectionTitle } from '@/components/public/Cards';
import { ActivityCard, EventCard, ExperienceCard, PlaceCard, TripCard, type TripListing } from '@/components/public/listings';
import { SaveButton } from '@/components/public/Actions';
import { apiGet } from '@/lib/api';
import { getCatalogue, getList } from '@/lib/public';

export const revalidate = 120;

export async function generateMetadata({ params }: { params: Promise<{ country: string }> }): Promise<Metadata> {
  const { country } = await params;
  const catalogue = await getCatalogue();
  const found = catalogue.countries.find((item) => item.slug === country);
  return { title: found ? `${found.name} — destinations` : 'Destination' };
}

export default async function CountryPage({ params }: { params: Promise<{ country: string }> }) {
  const { country: slug } = await params;
  const detail = await apiGet<{ id: string; code: string; name: string; slug: string; summary: string | null; heroImage: string | null }>(`/public/countries/${slug}`, 120);
  if (!detail) notFound();
  const catalogue = await getCatalogue();
  const entry = catalogue.countries.find((item) => item.code === detail.code);
  const filter = { country: detail.code, pageSize: 6 };
  const [activities, places, experiences, events, trips] = await Promise.all([
    getList('/public/activities', filter),
    getList('/public/places', filter),
    getList('/public/experiences', filter),
    getList('/public/events', filter),
    apiGet<{ items: TripListing[] }>(`/public/trips?country=${detail.code}`, 60),
  ]);
  const empty = !activities.total && !places.total && !experiences.total && !events.total && !trips?.items.length;
  return (
    <PublicShell>
      <PageHero kicker="Destination" title={detail.name} intro={detail.summary} image={detail.heroImage}>
        <div className="flex flex-wrap gap-2">
          {(entry?.cities ?? []).map((city) => <Link key={city.slug} href={`/destinations/${detail.slug}/${city.slug}`} className="chip">{city.name}</Link>)}
          <SaveButton itemType="COUNTRY" itemId={detail.id} />
        </div>
      </PageHero>
      <div className="shell space-y-16 py-12">
        {empty && <p className="rounded-xl bg-[color:var(--color-cream)] p-6 text-center text-ink-soft">Nothing is listed in {detail.name} yet. Browse <Link className="font-semibold text-acacia-600 underline" href="/destinations">other destinations</Link>, or tell us what you know about {detail.name}.</p>}
        {trips?.items.length ? <section><SectionTitle kicker="Enhakkore Travel" title="Trips" /><CardGrid>{trips.items.map((trip) => <TripCard key={trip.slug} trip={trip} />)}</CardGrid></section> : null}
        {activities.total ? <section><SectionTitle kicker="Activities" title={`Things to do with people in ${detail.name}`} action={<Link className="chip" href={`/activities?country=${detail.code}`}>All {activities.total}</Link>} /><CardGrid>{activities.items.map((item) => <ActivityCard key={item.id} item={item} />)}</CardGrid></section> : null}
        {events.total ? <section><SectionTitle kicker="Events" title="What’s on" action={<Link className="chip" href={`/events?country=${detail.code}`}>All {events.total}</Link>} /><CardGrid>{events.items.map((item) => <EventCard key={item.id} item={item} />)}</CardGrid></section> : null}
        {places.total ? <section><SectionTitle kicker="Discover" title="Places" action={<Link className="chip" href={`/explore?country=${detail.code}`}>All {places.total}</Link>} /><CardGrid>{places.items.map((item) => <PlaceCard key={item.id} item={item} />)}</CardGrid></section> : null}
        {experiences.total ? <section><SectionTitle kicker="Experiences" title="Worth trying" action={<Link className="chip" href={`/experiences?country=${detail.code}`}>All {experiences.total}</Link>} /><CardGrid>{experiences.items.map((item) => <ExperienceCard key={item.id} item={item} />)}</CardGrid></section> : null}
      </div>
    </PublicShell>
  );
}
