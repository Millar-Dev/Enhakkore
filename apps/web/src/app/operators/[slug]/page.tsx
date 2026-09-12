import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { OrganizerDetail, TripSummary } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { TripCard } from '@/components/trips/TripCard';
import {
  Alert,
  Avatar,
  Badge,
  ButtonLink,
  Card,
  Divider,
  EmptyState,
  Eyebrow,
  Icon,
  RatingLine,
  VerifiedBadge,
} from '@/components/ui';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/format';

export const revalidate = 120;

interface OperatorResponse {
  organizer: OrganizerDetail;
  trips: TripSummary[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await apiGet<OperatorResponse>(`/organizers/${slug}`);
  if (!result) return { title: 'Operator not found' };
  return {
    title: result.organizer.companyName,
    description: result.organizer.bio ?? `Trips run by ${result.organizer.companyName} on Enhakkore.`,
  };
}

export default async function OperatorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await apiGet<OperatorResponse>(`/organizers/${slug}`);
  if (!result) notFound();

  const { organizer, trips } = result;
  const verified = organizer.verificationStatus === 'VERIFIED';

  return (
    <PublicShell>
      {/* Cover */}
      <div className="media relative h-48 md:h-64">
        <Image
          src={
            organizer.coverUrl ??
            'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=2000&h=700&q=80'
          }
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[#080a0b]/35" />
      </div>

      <div className="shell">
        <div className="-mt-14 md:-mt-16">
          <Card className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex items-start gap-5">
                <Avatar name={organizer.companyName} src={organizer.logoUrl} size="xl" />
                <div className="min-w-0">
                  <h1 className="text-h2">{organizer.companyName}</h1>
                  {organizer.tagline && (
                    <p className="mt-1.5 text-[0.9375rem] text-ink-soft">{organizer.tagline}</p>
                  )}
                  <p className="mt-2 inline-flex items-center gap-2 text-[0.875rem] text-ink-muted">
                    <Icon.pin size={15} />
                    {[organizer.city, organizer.country].filter(Boolean).join(', ') || 'Location not set'}
                    {organizer.yearFounded && ` · since ${organizer.yearFounded}`}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {verified ? (
                      <VerifiedBadge isDemo={organizer.isDemo} />
                    ) : (
                      <Badge tone="neutral">Verification in progress</Badge>
                    )}
                    <RatingLine rating={organizer.rating} count={organizer.reviewCount} />
                  </div>
                </div>
              </div>

              {organizer.websiteUrl && (
                <ButtonLink href={organizer.websiteUrl} variant="secondary" size="sm">
                  Visit website
                </ButtonLink>
              )}
            </div>

            {organizer.bio && (
              <p className="mt-7 max-w-3xl text-[0.9375rem] leading-relaxed text-ink-soft">{organizer.bio}</p>
            )}

            <Divider className="my-7" />

            <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div>
                <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                  Trips listed
                </dt>
                <dd className="mt-1.5 text-[1.125rem] font-bold">{organizer.tripCount}</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                  Rating
                </dt>
                <dd className="mt-1.5 text-[1.125rem] font-bold">
                  {organizer.rating ? organizer.rating.toFixed(1) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                  Replies in
                </dt>
                <dd className="mt-1.5 text-[1.125rem] font-bold">
                  {organizer.responseTimeHours ? `~${organizer.responseTimeHours}h` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                  On Enhakkore
                </dt>
                <dd className="mt-1.5 text-[0.9375rem] font-semibold">
                  {formatDate(organizer.memberSince, 'long')}
                </dd>
              </div>
            </dl>

            {organizer.languages.length > 0 && (
              <>
                <Divider className="my-6" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[0.8125rem] font-semibold text-ink-muted">Languages:</span>
                  {organizer.languages.map((language) => (
                    <Badge key={language} tone="neutral">
                      {language}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        {organizer.isDemo && (
          <Alert tone="neutral" className="mt-6">
            This is a demonstration operator profile created for development. The company, its licensing
            and its verified status are fictional.
          </Alert>
        )}

        {/* Trips */}
        <section className="section">
          <Eyebrow>Trips</Eyebrow>
          <h2 className="mt-3 text-h2">What {organizer.companyName} runs</h2>

          {trips.length === 0 ? (
            <EmptyState
              className="mt-8"
              icon={<Icon.compass size={34} />}
              title="No published trips right now"
              description="This operator does not have any live listings at the moment. Check back, or request a custom trip and we will pass it on."
              action={<ButtonLink href="/private-trips">Request a custom trip</ButtonLink>}
            />
          ) : (
            <div className="mt-8 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip, index) => (
                <TripCard key={trip.id} trip={trip} priority={index < 3} />
              ))}
            </div>
          )}
        </section>
      </div>
    </PublicShell>
  );
}
