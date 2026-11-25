import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatMoney, progressPercent } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { Facts, Gallery, Prose, VideoBlock } from '@/components/public/Cards';
import type { Project } from '@/components/public/impact';
import { SmartImage } from '@/components/public/SmartImage';
import { WscLogo } from '@/components/site/BrandLogo';
import { apiGet } from '@/lib/api';
import { getSite } from '@/lib/site';

export const revalidate = 60;
const load = (slug: string) => apiGet<Project>(`/public/impact/${slug}`, 60);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const project = await load((await params).slug);
  return project ? { title: project.title, description: project.summary } : { title: 'Impact' };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [project, { settings }] = await Promise.all([load(slug), getSite()]);
  if (!project) notFound();
  const withWsc = /wsc|we save children/i.test(project.partnerName ?? '');
  return (
    <PublicShell>
      <section className="relative">
        <div className="relative h-[52vh] min-h-[320px] overflow-hidden bg-acacia-700 md:h-[64vh]">
          <SmartImage src={project.heroImage} alt={project.title} fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-acacia-900/90 via-acacia-900/30 to-transparent" />
          <div className="shell absolute inset-x-0 bottom-0 pb-10 text-white">
            <p className="kicker !text-clay-400">{project.status === 'COMPLETED' ? 'Completed project' : 'Impact project'}</p>
            <h1 className="display-xl mt-3">{project.title}</h1>
            <p className="mt-3 text-white/80">{project.location}</p>
          </div>
        </div>
      </section>
      <section className="shell grid gap-10 py-10 md:py-14 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          <p className="font-display text-[1.6rem] leading-snug text-acacia-700">{project.summary}</p>
          <Prose text={project.description} />
          <Facts items={[
            { label: 'For', value: project.beneficiaryGroup },
            { label: 'Where', value: project.location },
            { label: 'Planned reach', value: project.beneficiaries ? `${project.beneficiaries} people (stated plan)` : null },
            { label: 'Completed', value: project.completedAt ? new Date(project.completedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : null },
          ]} />
          <VideoBlock url={project.videoUrl} />
          <div>
            <p className="kicker">Photographs</p>
            <div className="mt-4"><Gallery images={project.gallery.map((src) => ({ src, alt: project.title }))} /></div>
            <p className="mt-3 text-xs text-ink-muted">Photographs are published with consent. No child is named.</p>
          </div>
          {(project.updates ?? []).length > 0 && (
            <div>
              <p className="display-md text-acacia-700">Updates</p>
              <ol className="mt-4 space-y-4">
                {project.updates!.map((update) => (
                  <li key={update.id} className="rounded-xl border border-line bg-white p-5">
                    <p className="text-xs text-ink-muted">{new Date(update.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <p className="mt-1 font-display text-xl text-acacia-700">{update.title}</p>
                    <Prose text={update.body} className="mt-2 text-[0.9375rem]" />
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          {project.funding && (
            <div className="rounded-[1.2rem] border border-line bg-white p-5">
              <p className="text-sm text-ink-muted">Verified donations</p>
              <p className="font-display text-3xl text-acacia-700">{formatMoney({ amount: project.funding.raised, currency: project.funding.currency })}</p>
              {project.funding.goal ? (
                <>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand"><div className="h-full rounded-full bg-safari-500" style={{ width: `${progressPercent(project.funding.raised, project.funding.goal)}%` }} /></div>
                  <p className="mt-2 text-sm text-ink-soft">of {formatMoney({ amount: project.funding.goal, currency: project.funding.currency })} goal</p>
                </>
              ) : null}
              <p className="mt-2 text-xs text-ink-muted">Only donations checked by the team are counted.</p>
            </div>
          )}
          {project.partnerName && (
            <div className="rounded-[1.2rem] border border-line bg-white p-5">
              {withWsc && <WscLogo src={settings.brand.wscLogoUrl} height={52} />}
              <p className="mt-3 font-bold text-acacia-700">With {project.partnerName}</p>
              {project.partnerNote && <p className="mt-1 text-sm text-ink-soft">{project.partnerNote}</p>}
            </div>
          )}
          <Link href={`/donate?project=${project.slug}`} className="inline-flex h-12 w-full items-center justify-center rounded-full bg-safari-500 font-bold text-white">Donate</Link>
        </aside>
      </section>
    </PublicShell>
  );
}
