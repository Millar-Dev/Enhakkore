import Image from 'next/image';
import Link from 'next/link';
import type { ImpactProjectSummary } from '@enhakkore/shared';
import { IMPACT_CATEGORY_LABELS } from '@enhakkore/shared';
import { Badge, DemoBadge, Progress, cx } from '@/components/ui';
import { price } from '@/lib/format';

/**
 * An impact project card.
 *
 * Goal, raised and percentage are always shown together. Showing a progress bar
 * without the amounts asks the reader to trust a shape; showing raised without
 * the goal hides the part that matters.
 */
export function ProjectCard({
  project,
  priority = false,
  className,
}: {
  project: ImpactProjectSummary;
  priority?: boolean;
  className?: string;
}) {
  const complete = project.status === 'COMPLETED';

  return (
    <article className={cx('group', className)}>
      <Link href={`/impact/${project.slug}`} className="block">
        <div className="media aspect-[16/10] rounded-[--radius-card]">
          <Image
            src={project.heroImage}
            alt=""
            fill
            sizes="(max-width: 640px) 84vw, (max-width: 1024px) 46vw, 33vw"
            className="object-cover"
            priority={priority}
          />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3.5">
            <Badge tone="impact" className="bg-white/94 backdrop-blur-sm">
              {IMPACT_CATEGORY_LABELS[project.category]}
            </Badge>
            {project.isDemo && <DemoBadge />}
          </div>
          {complete && (
            <div className="absolute inset-x-0 bottom-0 p-3.5">
              <Badge tone="success" className="bg-white/94 backdrop-blur-sm">
                Completed
              </Badge>
            </div>
          )}
        </div>

        <div className="pt-4">
          <p className="text-[0.75rem] font-medium text-ink-muted">
            {project.location}
            {project.country !== 'Tanzania' && `, ${project.country}`}
          </p>
          <h3 className="mt-1.5 text-[1.0625rem] font-bold leading-snug tracking-tight text-ink transition-colors group-hover:text-clay-600">
            {project.title}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-[0.875rem] leading-relaxed text-ink-muted">
            {project.summary}
          </p>

          <div className="mt-4">
            <Progress percent={project.progress} label={`${project.progress}% of goal raised`} />
            <div className="mt-2.5 flex items-baseline justify-between gap-3">
              <p className="text-[0.875rem]">
                <span className="font-bold text-clay-600">{price(project.raised, true)}</span>
                <span className="text-ink-muted"> raised of {price(project.goal, true)}</span>
              </p>
              <p className="text-[0.875rem] font-bold text-ink">{project.progress}%</p>
            </div>
            <p className="mt-1.5 text-[0.75rem] text-ink-faint">
              {project.contributorCount.toLocaleString('en-GB')} contributors
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}

/** Compact variant used inside a trip page and at checkout. */
export function ProjectMini({ project }: { project: ImpactProjectSummary }) {
  return (
    <Link
      href={`/impact/${project.slug}`}
      className="group flex gap-4 rounded-[--radius-card] border border-line bg-white p-3 transition-colors hover:border-clay-100 hover:bg-clay-50/40"
    >
      <div className="media relative h-20 w-20 shrink-0 rounded-[0.625rem]">
        <Image src={project.heroImage} alt="" fill sizes="80px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-clay-600">
          {IMPACT_CATEGORY_LABELS[project.category]}
        </p>
        <h4 className="mt-0.5 truncate text-[0.9375rem] font-bold tracking-tight text-ink">{project.title}</h4>
        <p className="truncate text-[0.75rem] text-ink-muted">{project.location}</p>
        <div className="mt-2">
          <Progress percent={project.progress} size="sm" />
          <p className="mt-1.5 text-[0.75rem] text-ink-muted">
            <span className="font-semibold text-clay-600">{price(project.raised, true)}</span> of{' '}
            {price(project.goal, true)} · {project.progress}%
          </p>
        </div>
      </div>
    </Link>
  );
}
