import type { Metadata } from 'next';
import Link from 'next/link';
import type { ImpactProjectSummary, Money, Paginated } from '@enhakkore/shared';
import { IMPACT_CATEGORIES, IMPACT_CATEGORY_LABELS } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { ProjectCard } from '@/components/impact/ProjectCard';
import { Card, DemoBadge, Eyebrow, Progress, SectionHead, cx } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { price } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Impact dashboard',
  description: 'Contributions, projects and communities across the Enhakkore platform.',
};

export const revalidate = 120;

interface ImpactSummary {
  totalContributions: Money;
  contributionCount: number;
  travellersInvolved: number;
  projectsSupported: number;
  projectsCompleted: number;
  communitiesReached: number;
  countries: number;
  byCategory: Record<string, number>;
  isDemoData: boolean;
}

export default async function ImpactDashboardPage() {
  const [summary, projects] = await Promise.all([
    apiGet<ImpactSummary>('/impact/summary'),
    apiGet<Paginated<ImpactProjectSummary>>('/impact/projects?pageSize=24'),
  ]);

  const items = projects?.items ?? [];
  const active = items.filter((project) => project.status === 'ACTIVE');
  const completed = items.filter((project) => project.status === 'COMPLETED');

  const totalGoal = items.reduce((sum, project) => sum + project.goal.amount, 0);
  const totalRaised = items.reduce((sum, project) => sum + project.raised.amount, 0);
  const overallProgress = totalGoal > 0 ? Math.round((totalRaised / totalGoal) * 100) : 0;

  // Locations are the closest thing to a map this build has. A real map with
  // project coordinates is a later milestone — the data model already stores
  // latitude and longitude for it.
  const locations = [...new Set(items.map((project) => `${project.location}, ${project.country}`))];

  return (
    <PublicShell>
      <div className="border-b border-line bg-sand/50">
        <div className="shell py-12 md:py-16">
          <Eyebrow>Impact dashboard</Eyebrow>
          <h1 className="mt-3 text-h1 text-balance">Everything, in one place</h1>
          <p className="mt-4 max-w-2xl text-[1rem] leading-relaxed text-ink-muted">
            Totals across every project on the platform, derived from the contribution ledger rather than
            entered by hand.
          </p>

          {summary?.isDemoData && (
            <div className="mt-7 flex flex-wrap items-center gap-3 rounded-[--radius-card] border border-dashed border-line-strong bg-white p-4">
              <DemoBadge label="Demonstration figures" />
              <p className="text-[0.8125rem] leading-relaxed text-ink-muted">
                Every number on this page comes from the development seed. Nothing here has been raised,
                disbursed or delivered.
              </p>
            </div>
          )}
        </div>
      </div>

      {summary && (
        <section className="section-tight">
          <div className="shell">
            <dl className="grid gap-px overflow-hidden rounded-[--radius-card] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Total contributions', value: price(summary.totalContributions), tone: 'impact' },
                { label: 'Contributions made', value: summary.contributionCount.toLocaleString('en-GB') },
                { label: 'Travellers involved', value: summary.travellersInvolved.toLocaleString('en-GB') },
                { label: 'Projects supported', value: summary.projectsSupported.toLocaleString('en-GB') },
                { label: 'Projects completed', value: summary.projectsCompleted.toLocaleString('en-GB') },
                { label: 'Communities reached', value: summary.communitiesReached.toLocaleString('en-GB') },
                { label: 'Countries', value: summary.countries.toLocaleString('en-GB') },
                { label: 'Average contribution', value: summary.contributionCount > 0 ? price({ amount: Math.round(summary.totalContributions.amount / summary.contributionCount), currency: summary.totalContributions.currency }) : '—' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white p-6">
                  <dt className="text-eyebrow uppercase text-ink-muted">{stat.label}</dt>
                  <dd
                    className={cx(
                      'mt-3 text-[1.5rem] font-bold leading-none tracking-tight',
                      stat.tone === 'impact' ? 'text-clay-600' : 'text-ink',
                    )}
                  >
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Combined funding position */}
            <Card className="mt-8 p-6 md:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <h2 className="text-h3">Combined funding across all projects</h2>
                <p className="text-[1.25rem] font-bold text-clay-600">{overallProgress}%</p>
              </div>
              <Progress percent={overallProgress} className="mt-5" />
              <p className="mt-3 text-[0.9375rem] text-ink-muted">
                <span className="font-bold text-clay-600">
                  {price({ amount: totalRaised, currency: summary.totalContributions.currency })}
                </span>{' '}
                raised toward{' '}
                {price({ amount: totalGoal, currency: summary.totalContributions.currency })} in stated
                goals
              </p>
            </Card>

            {/* By category */}
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
              <Card className="p-6 md:p-8">
                <h2 className="text-h3">By category</h2>
                <ul className="mt-6 space-y-4">
                  {IMPACT_CATEGORIES.map((category) => {
                    const count = summary.byCategory[category] ?? 0;
                    const share =
                      summary.projectsSupported > 0
                        ? Math.round((count / summary.projectsSupported) * 100)
                        : 0;
                    return (
                      <li key={category}>
                        <div className="flex items-baseline justify-between gap-3">
                          <Link
                            href={`/impact?category=${category}`}
                            className="text-[0.9375rem] font-semibold hover:text-clay-600"
                          >
                            {IMPACT_CATEGORY_LABELS[category]}
                          </Link>
                          <span className="text-[0.875rem] text-ink-muted">
                            {count} {count === 1 ? 'project' : 'projects'}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sand-deep">
                          <div className="h-full rounded-full bg-clay-400" style={{ width: `${share}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              <Card className="p-6 md:p-8">
                <h2 className="text-h3">Where the work is</h2>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">
                  Project locations across the platform. A map view is planned — coordinates are already
                  recorded against every project.
                </p>
                <ul className="mt-5 space-y-2.5">
                  {locations.map((location) => (
                    <li
                      key={location}
                      className="flex items-center gap-2.5 text-[0.875rem] text-ink-soft"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-clay-400" />
                      {location}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section className="section">
          <div className="shell">
            <SectionHead eyebrow="Live now" title="Projects taking contributions" />
            <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section className="section bg-sand">
          <div className="shell">
            <SectionHead
              eyebrow="Finished"
              title="Completed projects"
              description="Completed work stays published, including the final accounting."
            />
            <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {completed.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </section>
      )}
    </PublicShell>
  );
}
