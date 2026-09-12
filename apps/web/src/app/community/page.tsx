import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { Money, Paginated, ReviewDto, TripSummary } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { DepartureCard } from '@/components/trips/TripCard';
import {
  Avatar,
  ButtonLink,
  Card,
  DemoBadge,
  Divider,
  Eyebrow,
  Icon,
  SectionHead,
  Stars,
} from '@/components/ui';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Community',
  description:
    'Upcoming group departures, traveller stories and the people you could be travelling with.',
};

export const revalidate = 120;

interface PlatformCounters {
  travellersInvolved: number;
  projectsSupported: number;
  publishedTrips: number;
  activeOrganizers: number;
  totalContributions: Money;
  isDemoData: boolean;
}

/**
 * The community page.
 *
 * Deliberately not a social network: no feed, no follows, no profiles to
 * browse. It shows the three things that actually help someone decide to travel
 * with strangers — who is going where, what previous travellers said, and how
 * the group chat works.
 */
export default async function CommunityPage() {
  const [upcoming, reviews, counters] = await Promise.all([
    apiGet<{ items: TripSummary[] }>('/trips/upcoming?limit=6'),
    apiGet<Paginated<ReviewDto>>('/trips/mikumi-adventure/reviews?pageSize=4'),
    apiGet<PlatformCounters>('/stats'),
  ]);

  const departures = upcoming?.items ?? [];
  const stories = reviews?.items ?? [];

  return (
    <PublicShell>
      {/* Hero */}
      <section className="border-b border-line bg-sand/50">
        <div className="shell py-14 md:py-20">
          <Eyebrow>Community</Eyebrow>
          <h1 className="mt-4 max-w-3xl text-h1 text-balance">
            Nobody remembers the itinerary. They remember who they were with.
          </h1>
          <p className="mt-5 max-w-2xl text-[1.0625rem] leading-relaxed text-ink-muted">
            Most people who book a group trip on Enhakkore are travelling alone. By the second evening they
            are not. This is how that works.
          </p>

          {counters && (
            <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-5">
              {[
                { label: 'Travellers', value: counters.travellersInvolved.toLocaleString('en-GB') },
                { label: 'Trips listed', value: counters.publishedTrips.toLocaleString('en-GB') },
                { label: 'Operators', value: counters.activeOrganizers.toLocaleString('en-GB') },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-[1.75rem] font-bold leading-none tracking-tight">{stat.value}</p>
                  <p className="mt-1.5 text-[0.8125rem] text-ink-muted">{stat.label}</p>
                </div>
              ))}
              {counters.isDemoData && <DemoBadge label="Demo figures" />}
            </div>
          )}
        </div>
      </section>

      {/* Upcoming */}
      {departures.length > 0 && (
        <section className="section">
          <div className="shell">
            <SectionHead
              eyebrow="Upcoming group trips"
              title="Who is going where"
              description="Group departures with seats still open. Join one and you are in its traveller group the same day."
              action={
                <ButtonLink href="/trips?type=GROUP&availableOnly=true" variant="secondary">
                  All group trips
                </ButtonLink>
              }
            />
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {departures.map((trip) => (
                <DepartureCard key={trip.id} trip={trip} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How the group works */}
      <section className="section bg-sand">
        <div className="shell">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
            <div>
              <Eyebrow>Trip groups</Eyebrow>
              <h2 className="mt-3 text-h2 text-balance">
                You do not buy a ticket and disappear until departure day.
              </h2>
              <div className="prose-body mt-5">
                <p>
                  The moment your booking confirms, you join that departure&rsquo;s private group — the
                  other travellers, and the organizer running the trip.
                </p>
                <p>
                  It is where the practical questions get answered: what to pack, what time the bus really
                  leaves, whether anyone else is flying in the night before. Organizers post announcements
                  that everyone gets notified about, so the things that matter do not get lost.
                </p>
                <p>
                  Groups are private. Only travellers with a confirmed booking on that departure and the
                  organizer can see or post in them.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/trips?type=GROUP">
                  Find a group trip
                  <Icon.arrow />
                </ButtonLink>
                <ButtonLink href="/how-it-works" variant="secondary">
                  How it works
                </ButtonLink>
              </div>
            </div>

            {/* A representative snippet of what a group looks like. */}
            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line bg-white px-5 py-4">
                <div className="media relative h-11 w-11 shrink-0 rounded-[0.5rem]">
                  <Image
                    src="https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=200&h=200&q=70"
                    alt=""
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[0.9375rem] font-bold tracking-tight">Mikumi Adventure</p>
                  <p className="text-[0.75rem] text-ink-muted">12–14 Sept · 16 members</p>
                </div>
              </div>

              <div className="space-y-4 bg-sand/30 p-5">
                <div className="rounded-[--radius-card] border border-clay-100 bg-clay-50 px-4 py-3">
                  <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-clay-600">
                    Announcement · Organizer
                  </p>
                  <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-soft">
                    Departure is 6:00 AM sharp from the Mlimani City car park, north entrance. Please be
                    there by 5:30 so we can load bags and leave on time.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Avatar name="Lena Fischer" size="sm" />
                  <div>
                    <p className="text-[0.75rem] font-bold">Lena</p>
                    <div className="mt-1 inline-block rounded-[--radius-card] bg-white px-3.5 py-2 text-[0.875rem] text-ink-soft">
                      First safari for me — any advice on what to actually bring?
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Avatar name="Michael Temba" size="sm" />
                  <div>
                    <p className="text-[0.75rem] font-bold">Michael</p>
                    <div className="mt-1 inline-block rounded-[--radius-card] bg-white px-3.5 py-2 text-[0.875rem] text-ink-soft">
                      Binoculars if you have them. Last time I borrowed a pair and regretted not having my
                      own.
                    </div>
                  </div>
                </div>
              </div>

              <p className="border-t border-line px-5 py-3 text-center text-[0.75rem] text-ink-faint">
                An illustration of a trip group. Real groups are private to their travellers.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Stories */}
      {stories.length > 0 && (
        <section className="section">
          <div className="shell">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <Eyebrow>Stories</Eyebrow>
                <h2 className="mt-3 text-h2 text-balance">From people who went</h2>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
                  Every review on Enhakkore is tied to a completed booking. There is no other way to post
                  one.
                </p>
              </div>
              <DemoBadge label="Demo reviews" />
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {stories.map((story) => (
                <Card key={story.id} className="flex flex-col p-6 md:p-7">
                  <Stars rating={story.rating} />
                  {story.title && (
                    <h3 className="mt-4 text-[1.0625rem] font-bold leading-snug tracking-tight">
                      {story.title}
                    </h3>
                  )}
                  <p className="mt-3 flex-1 text-[0.9375rem] leading-relaxed text-ink-soft">{story.body}</p>
                  <Divider className="my-5" />
                  <div className="flex items-center gap-3">
                    <Avatar name={story.author.name} src={story.author.avatarUrl} size="sm" />
                    <div>
                      <p className="text-[0.875rem] font-semibold">{story.author.name}</p>
                      <p className="text-[0.75rem] text-ink-muted">
                        {story.author.country && `${story.author.country} · `}
                        {formatDate(story.createdAt, 'long')}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Honest note about what this is not, yet */}
      <section className="section-tight">
        <div className="shell">
          <Card className="border-dashed p-6 md:p-8">
            <h2 className="text-h3">What this page is not</h2>
            <p className="mt-3 max-w-3xl text-[0.9375rem] leading-relaxed text-ink-muted">
              There is no public feed, no follower count and no profile browsing on Enhakkore, and there
              are no plans to add them. Discussion forums, shared photo albums and traveller-to-traveller
              recommendations are on the roadmap — but the community here exists to make trips better, not
              to become somewhere you spend your evenings.
            </p>
            <div className="mt-6">
              <Link href="/trips" className="text-[0.875rem] font-semibold text-acacia-700 hover:underline">
                Go and find a trip instead →
              </Link>
            </div>
          </Card>
        </div>
      </section>
    </PublicShell>
  );
}
