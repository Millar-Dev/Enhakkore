import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Empty, PageHero, SectionTitle } from '@/components/public/Cards';
import { TripCard, type TripListing } from '@/components/public/listings';
import { apiGet } from '@/lib/api';
import { getSite, waHref } from '@/lib/site';

export const metadata: Metadata = { title: 'Enhakkore Travel', description: 'Group trips, private journeys, safaris and holidays run by Enhakkore.' };
export const revalidate = 60;

export default async function TravelPage() {
  const [{ settings }, upcoming, past] = await Promise.all([
    getSite(),
    apiGet<{ items: TripListing[] }>('/public/trips', 60),
    apiGet<{ items: TripListing[] }>('/public/trips?when=past', 60),
  ]);
  return (
    <PublicShell>
      <PageHero
        kicker="Enhakkore Travel"
        title="Travel together"
        intro="Group trips, safaris and journeys run by Enhakkore. Apply for a place, pay when your application is approved, and meet the people you are travelling with in your departure’s private group."
        image="/packages/arusha/mount-meru.webp"
      >
        <div className="flex flex-wrap gap-3">
          <a href={waHref(settings, 'privateTrip')} target="_blank" rel="noreferrer noopener" className="inline-flex h-12 items-center rounded-full bg-acacia-600 px-6 font-bold text-white">Plan a private trip</a>
          <Link href="/catering" className="inline-flex h-12 items-center rounded-full border border-acacia-600/30 bg-white px-6 font-semibold text-acacia-600">Catering & lunchboxes</Link>
        </div>
      </PageHero>
      <section className="shell py-12 md:py-16">
        <SectionTitle kicker="Upcoming" title="Trips open for applications" />
        {upcoming?.items.length ? (
          <CardGrid>{upcoming.items.map((trip) => <TripCard key={trip.slug} trip={trip} />)}</CardGrid>
        ) : (
          <Empty title="No upcoming trips right now" body="The next one is being planned. Follow us, or tell us where you would like to go." action={<a href={waHref(settings, 'general')} target="_blank" rel="noreferrer noopener" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Message us</a>} />
        )}
      </section>
      {past?.items.length ? (
        <section className="bg-[color:var(--color-cream)]">
          <div className="shell py-12 md:py-16">
            <SectionTitle kicker="Where we have been" title="Past trips" subtitle="Trips that have already taken place — not open for booking." />
            <CardGrid>{past.items.map((trip) => <TripCard key={trip.slug} trip={trip} />)}</CardGrid>
          </div>
        </section>
      ) : null}
      <section className="shell py-12 md:py-16">
        <div className="grid gap-6 rounded-[1.4rem] bg-acacia-600 p-8 text-white md:grid-cols-[1.4fr_1fr] md:items-center md:p-12">
          <div>
            <p className="kicker !text-clay-400">Private & custom</p>
            <h2 className="display-md mt-3">Your dates, your people, your pace</h2>
            <p className="mt-3 text-white/75">Safaris, holidays, family trips, team retreats and international journeys — tell us what you have in mind and we will plan it with you.</p>
          </div>
          <div className="flex flex-col gap-3">
            <a href={waHref(settings, 'privateTrip')} target="_blank" rel="noreferrer noopener" className="inline-flex h-12 items-center justify-center rounded-full bg-clay-400 font-bold text-acacia-700">Plan on WhatsApp</a>
            <Link href="/private-trips" className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 font-semibold">Send a trip request</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
