import type { Metadata } from 'next';
import Link from 'next/link';
import { IMPACT_CATEGORY_LABELS, type ImpactCategory } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Empty, ListingCard, SectionTitle } from '@/components/public/Cards';
import type { Project } from '@/components/public/impact';
import { SmartImage } from '@/components/public/SmartImage';
import { EnquiryForm } from '@/components/public/Actions';
import { WscLogo } from '@/components/site/BrandLogo';
import { SocialIcon } from '@/components/site/SocialIcon';
import { apiGet } from '@/lib/api';
import { getSite, waHref } from '@/lib/site';

export const metadata: Metadata = { title: 'Impact', description: 'Community projects and outreach carried out with WSC — We Save Children.' };
export const revalidate = 60;

export default async function ImpactPage() {
  const [{ settings }, projects] = await Promise.all([getSite(), apiGet<Project[]>('/public/impact', 60)]);
  const list = projects ?? [];
  const active = list.filter((project) => project.status !== 'COMPLETED');
  const completed = list.filter((project) => project.status === 'COMPLETED');
  const featured = completed[0] ?? list[0];

  return (
    <PublicShell>
      <section className="relative overflow-hidden bg-[color:var(--color-cream)]">
        <div className="shell grid gap-10 py-14 md:py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="kicker">Enhakkore Impact</p>
            <h1 className="display-xl mt-4 text-acacia-700">Create impact, together</h1>
            <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-ink-soft">
              Community outreach and projects with the people who travel with us. Recorded as they happened — with real photographs, and without invented figures.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/donate" className="inline-flex h-12 items-center rounded-full bg-safari-500 px-6 font-bold text-white hover:bg-safari-600">Donate</Link>
              <a href={waHref(settings, 'general')} target="_blank" rel="noreferrer noopener" className="inline-flex h-12 items-center rounded-full border border-acacia-600/30 bg-white px-6 font-semibold text-acacia-600">Volunteer or partner with us</a>
            </div>
          </div>
          {featured && (
            <div className="relative aspect-[4/3] overflow-hidden rounded-[1.6rem] shadow-[var(--shadow-float)]">
              <SmartImage src={featured.heroImage} alt={featured.title} fill priority sizes="(max-width:1024px) 100vw, 45vw" className="object-cover" />
            </div>
          )}
        </div>
      </section>

      {/* WSC — presented as its own organisation working with Enhakkore. */}
      <section className="shell py-14 md:py-20">
        <div className="grid gap-8 rounded-[1.6rem] border border-line bg-white p-7 md:grid-cols-[auto_1fr] md:items-center md:p-10">
          <WscLogo src={settings.brand.wscLogoUrl} height={96} />
          <div>
            <p className="kicker">Our impact partner</p>
            <h2 className="display-md mt-3 text-acacia-700">We Save Children (WSC)</h2>
            <p className="mt-3 max-w-2xl text-[1rem] leading-relaxed text-ink-soft">{settings.impact.wscIntro}</p>
            <a href="https://www.instagram.com/_wsc2022" target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-acacia-600">
              <SocialIcon platform="instagram" size={16} /> WSC on Instagram (@_wsc2022)
            </a>
          </div>
        </div>
      </section>

      {active.length > 0 && (
        <section className="shell pb-14">
          <SectionTitle kicker="Now" title="Current projects" />
          <CardGrid>
            {active.map((project) => (
              <ListingCard key={project.slug} href={`/impact/${project.slug}`} image={project.heroImage} kicker={IMPACT_CATEGORY_LABELS[project.category as ImpactCategory] ?? 'Community'} title={project.title} meta={[project.location, project.summary]} />
            ))}
          </CardGrid>
        </section>
      )}

      <section className="bg-[color:var(--color-cream)]">
        <div className="shell py-14 md:py-20">
          <SectionTitle kicker="Completed" title="What we have done" />
          {completed.length ? (
            <CardGrid>
              {completed.map((project) => (
                <ListingCard key={project.slug} href={`/impact/${project.slug}`} image={project.heroImage} kicker={project.location} title={project.title} meta={[project.summary]} badges={[{ label: 'Completed', tone: 'green' }]} />
              ))}
            </CardGrid>
          ) : (
            <Empty title="Projects will appear here" body="Completed outreach is recorded here with its photographs once it has happened." />
          )}
        </div>
      </section>

      <section className="shell py-14 md:py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            ['Donate', 'Give to a project, or to our outreach in general. Donations are recorded separately from travel income.', '/donate', 'Donate'],
            ['Volunteer', 'Join an outreach day, help prepare, or bring a skill. Message us and we will tell you what is coming up.', waHref(settings, 'general'), 'Message us'],
            ['Partner', 'Businesses and organisations can support specific projects. Talk to us about what would help most.', waHref(settings, 'general'), 'Talk to us'],
          ].map(([title, body, href, label]) => (
            <div key={title} className="rounded-[1.2rem] border border-line bg-white p-6">
              <p className="font-display text-2xl text-acacia-700">{title}</p>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{body}</p>
              <a href={href} {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer noopener' } : {})} className="mt-4 inline-flex font-semibold text-acacia-600 underline underline-offset-4">{label}</a>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-ink-muted">Not every Enhakkore trip supports a charity project. Where one does, its page says so.</p>
      </section>
      <section id="volunteer" className="shell max-w-3xl scroll-mt-28 pb-16">
        <div className="rounded-[1.4rem] border border-line bg-white p-5 md:p-8">
          <EnquiryForm
            type="VOLUNTEER"
            subjectType="IMPACT"
            subjectTitle="Volunteering with WSC"
            heading="Volunteer with us"
            messagePlaceholder="What would you like to help with? Any skills, and when you are free."
            extraFields={[{ name: 'skills', label: 'Skills (optional)', placeholder: 'Teaching, first aid, photography…' }]}
            whatsappHref={waHref(settings, 'general')}
          />
        </div>
      </section>
    </PublicShell>
  );
}
