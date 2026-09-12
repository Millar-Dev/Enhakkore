import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ImpactProjectDetail } from '@enhakkore/shared';
import { IMPACT_CATEGORY_LABELS } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { DonatePanel } from '@/components/impact/DonatePanel';
import { TripCard } from '@/components/trips/TripCard';
import {
  Badge,
  ButtonLink,
  Card,
  DemoBadge,
  Divider,
  Eyebrow,
  Icon,
  SectionHead,
  cx,
} from '@/components/ui';
import { apiGet } from '@/lib/api';
import { formatDate, price } from '@/lib/format';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await apiGet<ImpactProjectDetail>(`/impact/projects/${slug}`);
  if (!project) return { title: 'Project not found' };
  return {
    title: project.title,
    description: project.summary,
    openGraph: { title: `${project.title} · Enhakkore`, description: project.summary, images: [project.heroImage] },
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await apiGet<ImpactProjectDetail>(`/impact/projects/${slug}`);
  if (!project) notFound();

  const remaining = Math.max(0, project.goal.amount - project.raised.amount);

  return (
    <PublicShell>
      <div className="shell py-8">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-[0.8125rem] text-ink-muted">
          <Link href="/impact" className="transition-colors hover:text-ink">
            Impact
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/impact?category=${project.category}`}
            className="transition-colors hover:text-ink"
          >
            {IMPACT_CATEGORY_LABELS[project.category]}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-ink">{project.title}</span>
        </nav>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone="impact">{IMPACT_CATEGORY_LABELS[project.category]}</Badge>
          {project.status === 'COMPLETED' && <Badge tone="success">Completed</Badge>}
          {project.isDemo && <DemoBadge />}
        </div>

        <h1 className="text-h1 text-balance">{project.title}</h1>
        <p className="mt-3 inline-flex items-center gap-2 text-[0.9375rem] text-ink-muted">
          <Icon.pin size={16} />
          {project.location}, {project.country}
        </p>

        <div className="media mt-8 aspect-[21/9] rounded-[--radius-card]">
          <Image
            src={project.heroImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
          <div className="min-w-0">
            {/* The three numbers that matter, stated together */}
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[--radius-card] border border-line bg-line">
              <Figure label="Goal" value={price(project.goal)} />
              <Figure label="Raised" value={price(project.raised)} tone="impact" />
              <Figure label="Progress" value={`${project.progress}%`} />
            </div>

            {remaining > 0 && project.status !== 'COMPLETED' && (
              <p className="mt-3 text-[0.875rem] text-ink-muted">
                {price({ amount: remaining, currency: project.goal.currency })} still needed ·{' '}
                {project.contributorCount.toLocaleString('en-GB')} contributors so far
              </p>
            )}

            {/* About */}
            <section className="mt-12">
              <Eyebrow>About the project</Eyebrow>
              <h2 className="mt-3 text-h2 text-balance">{project.summary}</h2>
              <div className="prose-body mt-5">
                {project.description.split('\n\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </section>

            {/* Allocation */}
            {project.allocation.length > 0 && (
              <section className="mt-14">
                <Eyebrow>Where your contribution goes</Eyebrow>
                <h2 className="mt-3 text-h2">The plan for the money</h2>
                <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-muted">
                  This is the intended allocation agreed with the local committee before work began. Actual
                  spend is reported in the updates below, including where it differs.
                </p>

                <div className="mt-8 space-y-5">
                  {project.allocation.map((line) => (
                    <div key={line.label}>
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="text-[0.9375rem] font-semibold">{line.label}</p>
                        <p className="shrink-0 text-[0.9375rem] font-bold tabular-nums text-clay-600">
                          {line.percent}%
                        </p>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sand-deep">
                        <div className="h-full rounded-full bg-clay-400" style={{ width: `${line.percent}%` }} />
                      </div>
                      {line.note && (
                        <p className="mt-1.5 text-[0.8125rem] text-ink-muted">{line.note}</p>
                      )}
                    </div>
                  ))}
                </div>

                {project.partnerNote && (
                  <Card className="mt-8 border-dashed p-5">
                    <p className="text-[0.875rem] leading-relaxed text-ink-muted">
                      <span className="font-semibold text-ink">Implementing partner: </span>
                      {project.partnerName ?? 'Not yet published.'} {project.partnerNote}
                    </p>
                  </Card>
                )}
              </section>
            )}

            {/* Updates */}
            <section className="mt-14">
              <Eyebrow>Project updates</Eyebrow>
              <h2 className="mt-3 text-h2">What has actually happened</h2>

              {project.updates.length === 0 ? (
                <p className="mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-ink-muted">
                  No updates have been published yet. The first one goes up as soon as work begins on the
                  ground, and everyone who has contributed is notified.
                </p>
              ) : (
                <ol className="mt-8">
                  {project.updates.map((update, index) => (
                    <li key={update.id} className="relative flex gap-5 pb-10 last:pb-0">
                      {index < project.updates.length - 1 && (
                        <span
                          className="absolute left-[0.9375rem] top-9 bottom-0 w-px bg-line"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={cx(
                          'relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-white',
                          update.milestone ? 'border-clay-500 text-clay-500' : 'border-line text-ink-faint',
                        )}
                      >
                        {update.milestone ? (
                          <Icon.check size={15} />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <time className="text-[0.8125rem] font-semibold text-ink-muted">
                            {formatDate(update.publishedAt, 'long')}
                          </time>
                          {update.milestone && <Badge tone="impact">Milestone</Badge>}
                        </div>
                        <h3 className="mt-1.5 text-[1.0625rem] font-bold tracking-tight">{update.title}</h3>
                        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{update.body}</p>

                        {update.images.length > 0 && (
                          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {update.images.map((image) => (
                              <div key={image} className="media relative aspect-[4/3] rounded-[0.625rem]">
                                <Image src={image} alt="" fill sizes="220px" className="object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* Recent contributions */}
            {project.recentContributions.length > 0 && (
              <section className="mt-14">
                <Eyebrow>Recent contributions</Eyebrow>
                <Card className="mt-5 divide-y divide-line">
                  {project.recentContributions.map((contribution) => (
                    <div key={contribution.id} className="flex items-start justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="text-[0.875rem] font-semibold">
                          {contribution.donorName ?? 'Anonymous'}
                        </p>
                        {contribution.message && (
                          <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">
                            “{contribution.message}”
                          </p>
                        )}
                        <p className="mt-1 text-[0.75rem] text-ink-faint">
                          {formatDate(contribution.createdAt, 'long')}
                        </p>
                      </div>
                      <p className="shrink-0 text-[0.875rem] font-bold tabular-nums text-clay-600">
                        {price(contribution.amount)}
                      </p>
                    </div>
                  ))}
                </Card>
              </section>
            )}
          </div>

          {/* Donate rail */}
          <aside className="lg:relative">
            <div className="lg:sticky lg:top-28">
              <DonatePanel project={project} />
            </div>
          </aside>
        </div>
      </div>

      {/* Linked trips */}
      {project.linkedTrips.length > 0 && (
        <section className="section bg-sand">
          <div className="shell">
            <SectionHead
              eyebrow="Travel and support it"
              title="Trips that channel contributions here"
              description="Book one of these and you can add a contribution to this project at checkout."
            />
            <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {project.linkedTrips.slice(0, 3).map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section-tight">
        <div className="shell text-center">
          <ButtonLink href="/impact" variant="secondary">
            ← All impact projects
          </ButtonLink>
        </div>
      </section>
    </PublicShell>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'impact';
}) {
  return (
    <div className="bg-white p-5 text-center md:p-6">
      <p className="text-eyebrow uppercase text-ink-muted">{label}</p>
      <p
        className={cx(
          'mt-2.5 text-[1.125rem] font-bold leading-tight tracking-tight md:text-[1.375rem]',
          tone === 'impact' ? 'text-clay-600' : 'text-ink',
        )}
      >
        {value}
      </p>
    </div>
  );
}
