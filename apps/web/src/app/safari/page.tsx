import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { DestinationSummary, Paginated, TripSummary } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { TripCard } from '@/components/trips/TripCard';
import { SearchBar } from '@/components/trips/SearchBar';
import { ButtonLink, Card, EmptyState, Eyebrow, Icon, SectionHead } from '@/components/ui';
import { apiGet, query } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Safari',
  description:
    'Safari departures across Tanzania and East Africa — Serengeti, Ngorongoro, Mikumi, Ruaha — from operators reviewed by the Enhakkore team.',
};

export const revalidate = 120;

const SEASONS = [
  {
    months: 'June – October',
    title: 'Dry season',
    body: 'Grass is short and water is scarce, so animals gather at rivers and waterholes and are far easier to find. The busiest and most expensive months, for good reason.',
  },
  {
    months: 'November – February',
    title: 'Short rains and calving',
    body: 'Green, dramatic skies, fewer vehicles. Late January to February is calving season on the southern Serengeti plains — and predators follow.',
  },
  {
    months: 'March – May',
    title: 'Long rains',
    body: 'The quietest and cheapest time. Some camps close and roads get difficult, but the parks are empty and the light is extraordinary.',
  },
];

const FIRST_TIMER = [
  {
    title: 'Short trips are a real option',
    body: 'You do not need ten days and a five-figure budget. A three-day trip to Mikumi from Dar es Salaam shows you elephant, buffalo and often lion.',
  },
  {
    title: 'Vehicle time is most of the trip',
    body: 'Game drives are long and the roads are rough. Ask how many people share a vehicle — a guaranteed window seat matters more than the lodge.',
  },
  {
    title: 'Mornings are when it happens',
    body: 'Predators move at dawn and settle by mid-morning. A trip that leaves camp at 06:00 will show you more than one that leaves at 09:00.',
  },
  {
    title: 'Your guide makes the difference',
    body: 'The same park with a good guide is a different park. Look for operators whose guides are named and reviewed, not anonymous.',
  },
];

export default async function SafariPage() {
  const [trips, destinations] = await Promise.all([
    apiGet<Paginated<TripSummary>>(`/trips${query({ type: 'SAFARI', pageSize: 9, sort: 'recommended' })}`),
    apiGet<{ items: DestinationSummary[] }>('/destinations'),
  ]);

  const safariTrips = trips?.items ?? [];
  const parks = (destinations?.items ?? []).filter(
    (destination) => destination.country === 'Tanzania' && (destination.tripCount ?? 0) > 0,
  );

  return (
    <PublicShell transparentHeader>
      {/* Hero */}
      <section className="relative flex min-h-[34rem] items-end overflow-hidden pb-14 pt-40">
        <Image
          src="https://images.unsplash.com/photo-1535941339077-2dd1c7963098?auto=format&fit=crop&w=2400&h=1400&q=85"
          alt="An elephant crossing dry golden grass"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080a0b] via-[#080a0b]/55 to-[#080a0b]/25" />

        <div className="shell relative">
          <Eyebrow className="text-white/55">Safari</Eyebrow>
          <h1 className="mt-4 max-w-3xl text-[2.5rem] font-extrabold leading-[1.03] tracking-[-0.035em] text-white text-balance md:text-[3.75rem]">
            The oldest reason to come here.
          </h1>
          <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-white/78">
            From a weekend in Mikumi to a week following the migration — run by guides who grew up on
            these roads.
          </p>

          <div className="mt-10">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* Trips */}
      <section className="section">
        <div className="shell">
          <SectionHead
            eyebrow="Safari departures"
            title="Going out soon"
            description="Every one of these is run by an operator the Enhakkore team has reviewed."
            action={
              <ButtonLink href="/trips?type=SAFARI" variant="secondary">
                All safari trips
                <Icon.arrow />
              </ButtonLink>
            }
          />

          {safariTrips.length === 0 ? (
            <EmptyState
              className="mt-10"
              icon={<Icon.compass size={34} />}
              title="No safari departures listed right now"
              description="Nothing is scheduled at the moment. Tell us when you would like to go and we will pass it to operators who run these parks."
              action={<ButtonLink href="/private-trips">Request a safari</ButtonLink>}
            />
          ) : (
            <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {safariTrips.map((trip, index) => (
                <TripCard key={trip.id} trip={trip} priority={index < 3} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Parks */}
      {parks.length > 0 && (
        <section className="section bg-sand">
          <div className="shell">
            <SectionHead eyebrow="Where to go" title="The parks" />
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {parks.map((park) => (
                <Link key={park.id} href={`/trips?destination=${park.slug}`} className="group">
                  <div className="media aspect-[3/2] rounded-[--radius-card]">
                    {park.heroImage && (
                      <Image
                        src={park.heroImage}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover"
                      />
                    )}
                    <div className="absolute inset-0 scrim" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <h3 className="text-[1.125rem] font-bold tracking-tight text-white">{park.name}</h3>
                      <p className="mt-0.5 text-[0.8125rem] text-white/70">
                        {park.region} · {park.tripCount} {park.tripCount === 1 ? 'trip' : 'trips'}
                      </p>
                    </div>
                  </div>
                  {park.summary && (
                    <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-muted">{park.summary}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* When to go */}
      <section className="section">
        <div className="shell">
          <SectionHead
            eyebrow="When to go"
            title="There is no bad season, only trade-offs"
            description="What you gain in animal density in the dry months, you pay for in crowds and price."
          />

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {SEASONS.map((season) => (
              <Card key={season.months} className="p-6 md:p-7">
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-acacia-600">
                  {season.months}
                </p>
                <h3 className="mt-3 text-h3">{season.title}</h3>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">{season.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* First timer */}
      <section className="section bg-ink text-white">
        <div className="shell">
          <div className="max-w-2xl">
            <p className="text-eyebrow uppercase text-white/45">If it is your first one</p>
            <h2 className="mt-3 text-h2 text-white text-balance">
              Four things worth knowing before you book
            </h2>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {FIRST_TIMER.map((item, index) => (
              <div key={item.title} className="border-t border-white/12 pt-6">
                <span className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/40">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 text-[1.125rem] font-bold tracking-tight text-white">{item.title}</h3>
                <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-white/65">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-14">
            <ButtonLink href="/trips?type=SAFARI" variant="inverted" size="lg">
              Browse safari trips
              <Icon.arrow />
            </ButtonLink>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
