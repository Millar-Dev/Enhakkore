import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { TripDetail } from '@enhakkore/shared';
import { TRAVEL_STYLE_LABELS, TRIP_TYPE_LABELS } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { TripGallery } from '@/components/trips/TripGallery';
import { BookingPanel } from '@/components/trips/BookingPanel';
import { ProjectMini } from '@/components/impact/ProjectCard';
import {
  Avatar,
  AvatarStack,
  Badge,
  ButtonLink,
  Card,
  Divider,
  Eyebrow,
  Icon,
  RatingLine,
  Stars,
  VerifiedBadge,
  cx,
} from '@/components/ui';
import { apiGet } from '@/lib/api';
import { dateRange, duration, formatDate, price } from '@/lib/format';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trip = await apiGet<TripDetail>(`/trips/${slug}`);
  if (!trip) return { title: 'Trip not found' };

  return {
    title: trip.title,
    description: trip.summary,
    openGraph: {
      title: `${trip.title} · Enhakkore`,
      description: trip.summary,
      images: [trip.heroImage],
    },
  };
}

export default async function TripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = await apiGet<TripDetail>(`/trips/${slug}`);
  if (!trip) notFound();

  const images = [trip.heroImage, ...trip.gallery];
  const upcoming = trip.departures.filter((d) => new Date(d.startDate).getTime() > Date.now());
  const nextDeparture = upcoming[0] ?? null;
  const totalJoined = trip.departures.reduce((sum, d) => sum + d.seatsBooked, 0);

  return (
    <PublicShell>
      <div className="shell pb-28 pt-8 lg:pb-20">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-[0.8125rem] text-ink-muted">
          <Link href="/trips" className="transition-colors hover:text-ink">
            Explore
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/trips?destination=${trip.destination.slug}`}
            className="transition-colors hover:text-ink"
          >
            {trip.destination.name}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-ink">{trip.title}</span>
        </nav>

        {/* Title block */}
        <div className="mb-7">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="brand">{TRIP_TYPE_LABELS[trip.type]}</Badge>
            <Badge tone="neutral">{TRAVEL_STYLE_LABELS[trip.style]}</Badge>
            {trip.difficulty && <Badge tone="neutral">{trip.difficulty}</Badge>}
            {trip.impactProject && <Badge tone="impact">Supports an impact project</Badge>}
          </div>

          <h1 className="text-h1 text-balance">{trip.title}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.875rem] text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Icon.pin size={15} />
              {trip.destination.name}, {trip.destination.country}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon.clock size={15} />
              {duration(trip.durationDays, trip.durationNights)}
            </span>
            {nextDeparture && (
              <span className="inline-flex items-center gap-1.5">
                <Icon.calendar size={15} />
                Next: {dateRange(nextDeparture.startDate, nextDeparture.endDate)}
              </span>
            )}
            <RatingLine rating={trip.rating} count={trip.reviewCount} />
          </div>
        </div>

        <TripGallery images={images} title={trip.title} />

        {/* Body + booking rail */}
        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_23rem] lg:gap-16">
          <div className="min-w-0">
            {/* Organizer strip */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[--radius-card] border border-line bg-sand/50 p-4">
              <div className="flex items-center gap-3.5">
                <Avatar name={trip.organizerDetail.companyName} src={trip.organizerDetail.logoUrl} size="md" />
                <div>
                  <p className="text-[0.75rem] text-ink-muted">Organised by</p>
                  <Link
                    href={`/operators/${trip.organizer.slug}`}
                    className="text-[0.9375rem] font-bold tracking-tight text-ink hover:text-acacia-700"
                  >
                    {trip.organizerDetail.companyName}
                  </Link>
                </div>
              </div>
              {trip.organizer.verificationStatus === 'VERIFIED' && (
                <VerifiedBadge isDemo={trip.organizer.isDemo} />
              )}
            </div>

            {/* About */}
            <section className="mt-12">
              <Eyebrow>About this trip</Eyebrow>
              <h2 className="mt-3 text-h2 text-balance">{trip.summary}</h2>
              <div className="prose-body mt-5">
                {trip.description.split('\n\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>

              {trip.tags.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {trip.tags.map((tag) => (
                    <Badge key={tag} tone="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </section>

            {/* Itinerary */}
            {trip.itinerary.length > 0 && (
              <section className="mt-14">
                <Eyebrow>Itinerary</Eyebrow>
                <h2 className="mt-3 text-h2">Day by day</h2>

                <ol className="mt-8 space-y-0">
                  {trip.itinerary.map((day, index) => (
                    <li key={day.id} className="relative flex gap-5 pb-9 last:pb-0">
                      {/* Spine connecting the days */}
                      {index < trip.itinerary.length - 1 && (
                        <span
                          className="absolute left-[1.4375rem] top-12 bottom-0 w-px bg-line"
                          aria-hidden="true"
                        />
                      )}
                      <span className="relative z-10 flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border border-line bg-white">
                        <span className="text-[0.5625rem] font-bold uppercase tracking-wider text-ink-faint">
                          Day
                        </span>
                        <span className="text-[0.9375rem] font-bold leading-none">{day.dayNumber}</span>
                      </span>

                      <div className="min-w-0 flex-1 pt-1.5">
                        <h3 className="text-[1.0625rem] font-bold tracking-tight">{day.title}</h3>
                        {day.summary && (
                          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
                            {day.summary}
                          </p>
                        )}

                        {day.activities.length > 0 && (
                          <ul className="mt-4 space-y-2">
                            {day.activities.map((activity, activityIndex) => (
                              <li
                                key={activityIndex}
                                className="flex gap-3 text-[0.875rem] leading-relaxed text-ink-soft"
                              >
                                <span
                                  className="mt-[0.5rem] h-1 w-1 shrink-0 rounded-full bg-line-strong"
                                  aria-hidden="true"
                                />
                                {activity}
                              </li>
                            ))}
                          </ul>
                        )}

                        {(day.meals.length > 0 || day.accommodation) && (
                          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-[0.75rem] text-ink-muted">
                            {day.meals.length > 0 && (
                              <span>
                                <span className="font-semibold text-ink-soft">Meals:</span>{' '}
                                {day.meals.join(', ')}
                              </span>
                            )}
                            {day.accommodation && (
                              <span>
                                <span className="font-semibold text-ink-soft">Stay:</span>{' '}
                                {day.accommodation}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Included / not included */}
            <section className="mt-14 grid gap-8 sm:grid-cols-2">
              <div>
                <h3 className="text-h3">What&rsquo;s included</h3>
                <ul className="mt-5 space-y-3">
                  {trip.includes.map((item) => (
                    <li key={item} className="flex gap-3 text-[0.9375rem] leading-relaxed text-ink-soft">
                      <Icon.check size={17} className="mt-0.5 shrink-0 text-acacia-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-h3">What&rsquo;s not included</h3>
                <ul className="mt-5 space-y-3">
                  {trip.excludes.map((item) => (
                    <li key={item} className="flex gap-3 text-[0.9375rem] leading-relaxed text-ink-muted">
                      <Icon.close size={16} className="mt-0.5 shrink-0 text-ink-faint" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Requirements */}
            {trip.requirements.length > 0 && (
              <section className="mt-12">
                <Card className="bg-sand/50 p-6">
                  <h3 className="text-[1rem] font-bold tracking-tight">Before you travel</h3>
                  <ul className="mt-4 space-y-2.5">
                    {trip.requirements.map((item) => (
                      <li key={item} className="flex gap-3 text-[0.875rem] leading-relaxed text-ink-soft">
                        <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  {trip.minAge !== null && (
                    <p className="mt-4 text-[0.875rem] text-ink-muted">
                      Minimum age on this trip: <span className="font-semibold text-ink">{trip.minAge}</span>
                    </p>
                  )}
                </Card>
              </section>
            )}

            {/* Organizer */}
            <section className="mt-14">
              <Eyebrow>Meet your organizer</Eyebrow>
              <Card className="mt-5 p-6 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="flex items-center gap-4">
                    <Avatar
                      name={trip.organizerDetail.companyName}
                      src={trip.organizerDetail.logoUrl}
                      size="lg"
                    />
                    <div>
                      <h3 className="text-h3">{trip.organizerDetail.companyName}</h3>
                      <p className="mt-1 text-[0.875rem] text-ink-muted">
                        {trip.organizerDetail.city}
                        {trip.organizerDetail.country && `, ${trip.organizerDetail.country}`}
                        {trip.organizerDetail.yearFounded && ` · since ${trip.organizerDetail.yearFounded}`}
                      </p>
                      {trip.organizer.verificationStatus === 'VERIFIED' && (
                        <VerifiedBadge isDemo={trip.organizer.isDemo} className="mt-2" />
                      )}
                    </div>
                  </div>
                  <ButtonLink href={`/operators/${trip.organizer.slug}`} variant="secondary" size="sm">
                    View profile
                  </ButtonLink>
                </div>

                {trip.organizerDetail.bio && (
                  <p className="mt-6 text-[0.9375rem] leading-relaxed text-ink-soft">
                    {trip.organizerDetail.bio}
                  </p>
                )}

                <Divider className="my-6" />

                <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                  <div>
                    <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                      Rating
                    </dt>
                    <dd className="mt-1.5 text-[1.0625rem] font-bold">
                      {trip.organizer.rating ? trip.organizer.rating.toFixed(1) : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                      Trips listed
                    </dt>
                    <dd className="mt-1.5 text-[1.0625rem] font-bold">{trip.organizer.tripCount}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                      Replies in
                    </dt>
                    <dd className="mt-1.5 text-[1.0625rem] font-bold">
                      {trip.organizerDetail.responseTimeHours
                        ? `~${trip.organizerDetail.responseTimeHours}h`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                      Languages
                    </dt>
                    <dd className="mt-1.5 text-[0.875rem] font-semibold">
                      {trip.organizerDetail.languages.join(', ') || '—'}
                    </dd>
                  </div>
                </dl>
              </Card>
            </section>

            {/* Who's coming — the community hook */}
            {trip.travellers.length > 0 && (
              <section className="mt-14">
                <Eyebrow>Travellers joined</Eyebrow>
                <Card className="mt-5 p-6 md:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-6">
                    <div>
                      <h3 className="text-h3">
                        {totalJoined} {totalJoined === 1 ? 'traveller has' : 'travellers have'} joined this
                        trip
                      </h3>
                      <p className="mt-2 max-w-md text-[0.9375rem] leading-relaxed text-ink-muted">
                        Book a seat and you join this departure&rsquo;s private group straight away — ask
                        questions, sort out transport together, and know who you are travelling with before
                        you arrive.
                      </p>
                    </div>
                    <AvatarStack people={trip.travellers} max={6} size="md" />
                  </div>
                </Card>
              </section>
            )}

            {/* Impact */}
            {trip.impactProject && (
              <section className="mt-14">
                <div className="rounded-[--radius-card] border border-clay-100 bg-clay-50/50 p-6 md:p-8">
                  <div className="flex items-center gap-2">
                    <Icon.ripple size={18} className="text-clay-600" />
                    <Eyebrow className="text-clay-600">Impact opportunity</Eyebrow>
                  </div>
                  <h3 className="mt-3 text-h3">Want your journey to give back?</h3>
                  <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-soft">
                    {trip.organizerDetail.companyName} has linked this trip to a project near where you will
                    be travelling. At checkout you can add a contribution — 5,000, 10,000, 20,000 TZS or an
                    amount you choose. Enhakkore takes no commission on it.
                  </p>
                  <div className="mt-6">
                    <ProjectMini project={trip.impactProject} />
                  </div>
                </div>
              </section>
            )}

            {/* Reviews */}
            <section className="mt-14">
              <Eyebrow>Reviews</Eyebrow>
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-h2">
                  {trip.reviewCount > 0
                    ? `${trip.rating?.toFixed(1)} from ${trip.reviewCount} ${trip.reviewCount === 1 ? 'traveller' : 'travellers'}`
                    : 'No reviews yet'}
                </h2>
              </div>

              {trip.reviews.length === 0 ? (
                <p className="mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-ink-muted">
                  This trip has not been reviewed yet. Reviews on Enhakkore can only be written by travellers
                  who completed a booking, so they take a little time to appear on a new listing.
                </p>
              ) : (
                <div className="mt-8 grid gap-6 md:grid-cols-2">
                  {trip.reviews.map((review) => (
                    <Card key={review.id} className="flex flex-col p-6">
                      <Stars rating={review.rating} />
                      {review.title && (
                        <h3 className="mt-3.5 text-[1rem] font-bold leading-snug tracking-tight">
                          {review.title}
                        </h3>
                      )}
                      <p className="mt-2 flex-1 text-[0.9375rem] leading-relaxed text-ink-soft">
                        {review.body}
                      </p>
                      <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
                        <Avatar name={review.author.name} src={review.author.avatarUrl} size="sm" />
                        <div>
                          <p className="text-[0.875rem] font-semibold">{review.author.name}</p>
                          <p className="text-[0.75rem] text-ink-muted">
                            {review.author.country && `${review.author.country} · `}
                            {formatDate(review.createdAt, 'long')}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Booking rail */}
          <aside className="lg:relative">
            <div className="lg:sticky lg:top-28">
              <BookingPanel trip={trip} />
            </div>
          </aside>
        </div>
      </div>
    </PublicShell>
  );
}
