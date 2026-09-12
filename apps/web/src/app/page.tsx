import Image from 'next/image';
import Link from 'next/link';
import type { ImpactProjectSummary, Money, Paginated, TripSummary } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { DepartureCard, TripCard } from '@/components/trips/TripCard';
import { SearchBar } from '@/components/trips/SearchBar';
import { ProjectCard } from '@/components/impact/ProjectCard';
import {
  Badge,
  ButtonLink,
  Card,
  DemoBadge,
  Divider,
  Eyebrow,
  Icon,
  SectionHead,
  Stars,
  cx,
} from '@/components/ui';
import { apiGet, query } from '@/lib/api';
import { price } from '@/lib/format';

export const revalidate = 120;

interface PlatformCounters {
  travellersInvolved: number;
  projectsSupported: number;
  communitiesReached: number;
  totalContributions: Money;
  publishedTrips: number;
  activeOrganizers: number;
  isDemoData: boolean;
}

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=2400&h=1600&q=85';

const CATEGORIES = [
  { label: 'Safari', href: '/trips?type=SAFARI' },
  { label: 'Group Trips', href: '/trips?type=GROUP' },
  { label: 'Private Trips', href: '/private-trips' },
  { label: 'Beach & Island', href: '/trips?type=BEACH' },
  { label: 'Adventure', href: '/trips?type=ADVENTURE' },
  { label: 'International', href: '/trips?type=INTERNATIONAL' },
];

const STEPS = [
  {
    number: '01',
    title: 'Discover',
    body: 'Find a journey that fits you — by place, by date, by the kind of travel you actually enjoy.',
  },
  {
    number: '02',
    title: 'Join',
    body: 'Book a seat on an existing group departure, or ask for a private trip built around you.',
  },
  {
    number: '03',
    title: 'Connect',
    body: 'Meet the people you will travel with before you go, in your trip’s own private group.',
  },
  {
    number: '04',
    title: 'Travel',
    body: 'Go. Your organizer handles the logistics and stays reachable the whole way through.',
  },
  {
    number: '05',
    title: 'Give back',
    body: 'Add a contribution to a project you choose, and follow what happens with it afterwards.',
  },
];

const REASONS = [
  {
    title: 'Trusted organizers',
    body: 'Every operator submits identity, licensing and contact details before a single listing goes live. Nothing publishes without a human review.',
    icon: Icon.shield,
  },
  {
    title: 'Meaningful experiences',
    body: 'Trips run by people from the places they take you to — small groups, real guides, itineraries with room to breathe.',
    icon: Icon.compass,
  },
  {
    title: 'Travel communities',
    body: 'Every departure has its own private group. You know who you are travelling with long before you meet them.',
    icon: Icon.chat,
  },
  {
    title: 'Real-world impact',
    body: 'Contributions go to named projects with a stated goal, a public total and a dated record of what was done.',
    icon: Icon.ripple,
  },
];

export default async function HomePage() {
  // Every rail degrades to a hidden section rather than a broken page if the
  // API is unreachable.
  const [featured, upcoming, projects, counters] = await Promise.all([
    apiGet<Paginated<TripSummary>>(`/trips${query({ sort: 'recommended', pageSize: 6 })}`),
    apiGet<{ items: TripSummary[] }>('/trips/upcoming?limit=4'),
    apiGet<Paginated<ImpactProjectSummary>>(`/impact/projects${query({ pageSize: 3, featured: true })}`),
    apiGet<PlatformCounters>('/stats'),
  ]);

  const featuredTrips = featured?.items ?? [];
  const upcomingTrips = upcoming?.items ?? [];
  const impactProjects = projects?.items ?? [];

  return (
    <PublicShell transparentHeader>
      {/* ------------------------------------------------------------------ */}
      {/* 1. A place worth going                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative flex min-h-[calc(100svh-4rem)] flex-col justify-end overflow-hidden pb-10 pt-32 md:min-h-[42rem] md:pb-16">
        <Image
          src={HERO_IMAGE}
          alt="A safari vehicle on open grassland at sunset"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080a0b] via-[#080a0b]/55 to-[#080a0b]/35" />

        <div className="shell relative">
          <div className="max-w-3xl">
            <Badge tone="dark" className="border-white/25 bg-white/15 text-white backdrop-blur-md">
              <Icon.ripple size={13} />
              Travel with purpose
            </Badge>

            <h1 className="mt-6 text-[2.75rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-white text-balance sm:text-[3.5rem] md:text-display">
              Travel together.
              <br />
              Experience more.
              <br />
              <span className="text-acacia-300">Give back.</span>
            </h1>

            <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-white/80 md:text-[1.1875rem]">
              Discover unforgettable journeys, connect with fellow travellers, and make a meaningful
              impact along the way.
            </p>
          </div>

          <div className="mt-10 md:mt-12">
            <SearchBar />
          </div>

          {/* Quick discovery — the six ways people actually start looking. */}
          <div className="mt-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar md:mt-7">
            {CATEGORIES.map((category) => (
              <Link
                key={category.href}
                href={category.href}
                className="shrink-0 rounded-[--radius-pill] border border-white/25 bg-white/10 px-4 py-2.5 text-[0.8125rem] font-semibold text-white backdrop-blur-md transition-colors hover:border-white/50 hover:bg-white/20"
              >
                {category.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. What there is to join                                            */}
      {/* ------------------------------------------------------------------ */}
      {featuredTrips.length > 0 && (
        <section className="section">
          <div className="shell">
            <SectionHead
              eyebrow="Featured trips"
              title="Journeys worth clearing your calendar for"
              description="Hand-picked departures from operators on the platform, with real seats and real dates."
              action={
                <ButtonLink href="/trips" variant="secondary">
                  See all trips
                  <Icon.arrow />
                </ButtonLink>
              }
            />

            <div className="rail mt-10">
              {featuredTrips.slice(0, 6).map((trip, index) => (
                <TripCard key={trip.id} trip={trip} priority={index < 3} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. The thing that makes this different                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="section bg-sand">
        <div className="shell">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
            <div>
              <Eyebrow>Travel with purpose</Eyebrow>
              <h2 className="mt-3 text-h1 text-balance">
                Every journey can create a ripple beyond the traveller.
              </h2>
              <div className="prose-body mt-6 text-[1rem]">
                <p>
                  Travel already moves money into the places people visit. Enhakkore makes a part of that
                  deliberate: at checkout you can add a contribution to a project you choose, in the region
                  you are travelling to.
                </p>
                <p>
                  Each project states what it is for, what it costs, how much has been raised and what has
                  actually been done so far. You can follow it after you get home.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/impact" variant="impact">
                  Explore impact projects
                  <Icon.arrow />
                </ButtonLink>
                <ButtonLink href="/impact/dashboard" variant="secondary">
                  See the numbers
                </ButtonLink>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {impactProjects.slice(0, 2).map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>

          {impactProjects.length > 2 && (
            <div className="mt-12 grid gap-6 md:grid-cols-3 lg:hidden">
              {impactProjects.slice(2, 3).map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. How the whole thing works                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="section">
        <div className="shell">
          <SectionHead
            eyebrow="How it works"
            title="Discover → Join → Connect → Travel → Give back"
            description="One path from the first search to the update that arrives months after you get home."
            action={
              <ButtonLink href="/how-it-works" variant="secondary">
                In more detail
              </ButtonLink>
            }
          />

          <ol className="mt-12 grid gap-px overflow-hidden rounded-[--radius-card] border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((step) => (
              <li key={step.number} className="bg-white p-6 lg:p-7">
                <span className="text-[0.6875rem] font-bold tracking-[0.16em] text-acacia-600">
                  {step.number}
                </span>
                <h3 className="mt-3 text-[1.0625rem] font-bold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. Why trust it                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="section-tight">
        <div className="shell">
          <SectionHead eyebrow="Why Enhakkore" title="Built to be worth trusting" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {REASONS.map((reason) => {
              const ReasonIcon = reason.icon;
              return (
                <Card key={reason.title} className="p-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-[0.75rem] bg-acacia-50 text-acacia-700">
                    <ReasonIcon size={21} />
                  </span>
                  <h3 className="mt-5 text-[1rem] font-bold tracking-tight">{reason.title}</h3>
                  <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">{reason.body}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. Groups filling now                                               */}
      {/* ------------------------------------------------------------------ */}
      {upcomingTrips.length > 0 && (
        <section className="section bg-sand">
          <div className="shell">
            <SectionHead
              eyebrow="Upcoming group trips"
              title="These are filling now"
              description="Group departures with seats still open. Join one and you are in its traveller group the same day."
              action={
                <ButtonLink href="/trips?availableOnly=true&type=GROUP" variant="secondary">
                  All group departures
                </ButtonLink>
              }
            />
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {upcomingTrips.map((trip) => (
                <DepartureCard key={trip.id} trip={trip} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 7. What the platform adds up to                                     */}
      {/* ------------------------------------------------------------------ */}
      {counters && (
        <section className="section-tight">
          <div className="shell">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Eyebrow>Impact by the community</Eyebrow>
                <h2 className="mt-3 text-h2">What travellers have made possible</h2>
              </div>
              {counters.isDemoData && <DemoBadge label="Demonstration figures" />}
            </div>

            {counters.isDemoData && (
              <p className="mt-4 max-w-3xl text-[0.875rem] leading-relaxed text-ink-muted">
                These figures come from the demonstration database used while the platform is being built.
                They are not a record of money raised or work completed, and they will be replaced by real,
                auditable totals before launch.
              </p>
            )}

            <dl className="mt-8 grid gap-px overflow-hidden rounded-[--radius-card] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Travellers involved', value: counters.travellersInvolved.toLocaleString('en-GB') },
                { label: 'Projects supported', value: counters.projectsSupported.toLocaleString('en-GB') },
                { label: 'Communities reached', value: counters.communitiesReached.toLocaleString('en-GB') },
                { label: 'Total contributions', value: price(counters.totalContributions, true) },
              ].map((stat) => (
                <div key={stat.label} className="bg-white p-6 md:p-7">
                  <dt className="text-eyebrow uppercase text-ink-muted">{stat.label}</dt>
                  <dd className="mt-3 text-[2rem] font-bold leading-none tracking-tight text-ink md:text-[2.25rem]">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 8. People who went                                                  */}
      {/* ------------------------------------------------------------------ */}
      <StoriesSection />

      {/* ------------------------------------------------------------------ */}
      {/* 9. Operators                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="section-tight">
        <div className="shell">
          <Card className="overflow-hidden">
            <div className="grid lg:grid-cols-[1.3fr_1fr]">
              <div className="p-8 md:p-12">
                <Eyebrow>For tour operators</Eyebrow>
                <h2 className="mt-3 text-h2 text-balance">
                  Run trips? Put them in front of travellers who are already looking.
                </h2>
                <p className="mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-ink-muted">
                  List your own departures, manage bookings and talk to your travellers in one place.
                  Enhakkore takes a commission on confirmed bookings — no listing fee, no subscription,
                  and nothing charged on a traveller’s impact contribution.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <ButtonLink href="/operators">
                    How it works for operators
                    <Icon.arrow />
                  </ButtonLink>
                  <ButtonLink href="/join?type=organizer" variant="secondary">
                    Create an operator account
                  </ButtonLink>
                </div>
              </div>
              <div className="media relative min-h-64 lg:min-h-full">
                <Image
                  src="https://images.unsplash.com/photo-1521651201144-634f700b36ef?auto=format&fit=crop&w=1200&h=1200&q=80"
                  alt="An elephant and calf crossing open savannah"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 10. Go                                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden">
        <div className="relative">
          <Image
            src="https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=2000&h=1000&q=80"
            alt="A single acacia silhouetted against a sunset sky"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[#080a0b]/68" />
          <div className="shell relative py-24 text-center md:py-32">
            <h2 className="mx-auto max-w-3xl text-[2.25rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-white text-balance md:text-[3.25rem]">
              Your next journey can mean more.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-white/75">
              Find somewhere to go, meet the people going with you, and leave something behind that lasts
              longer than the trip.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/trips" variant="inverted" size="lg">
                Explore trips
                <Icon.arrow />
              </ButtonLink>
              <ButtonLink
                href="/impact"
                size="lg"
                className="border border-white/30 bg-transparent text-white hover:bg-white/10"
                variant="ghost"
              >
                Support a project
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Traveller stories.
 *
 * These quotes are the demonstration reviews from the seeded database, shown
 * with a demo label. They are not testimonials from real customers, and the
 * label says so rather than leaving the reader to assume.
 */
async function StoriesSection() {
  const reviews = await apiGet<{ items: { id: string; rating: number; title: string | null; body: string; author: { id: string; name: string; country: string | null } }[] }>(
    '/trips/mikumi-adventure/reviews?pageSize=3',
  );

  const stories = reviews?.items ?? [];
  if (stories.length === 0) return null;

  return (
    <section className="section bg-ink text-white">
      <div className="shell">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-eyebrow uppercase text-white/45">Stories</p>
            <h2 className="mt-3 text-h2 text-white text-balance">
              The part people talk about afterwards is usually the people.
            </h2>
          </div>
          <DemoBadge label="Demo reviews" className="border-white/25 bg-white/10 text-white/70" />
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {stories.map((story) => (
            <figure key={story.id} className="flex flex-col rounded-[--radius-card] border border-white/12 bg-white/[0.04] p-7">
              <Stars rating={story.rating} />
              {story.title && (
                <figcaption className="mt-4 text-[1.0625rem] font-bold leading-snug tracking-tight text-white">
                  {story.title}
                </figcaption>
              )}
              <blockquote className="mt-3 flex-1 text-[0.9375rem] leading-relaxed text-white/65">
                {story.body.length > 220 ? `${story.body.slice(0, 220).trimEnd()}…` : story.body}
              </blockquote>
              <Divider className="my-5 border-white/12" />
              <p className="text-[0.8125rem] text-white/55">
                <span className="font-semibold text-white/85">{story.author.name}</span>
                {story.author.country && <> · {story.author.country}</>}
              </p>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
