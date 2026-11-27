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
      {/* Hero: a real outreach photograph, WSC, and two clear actions. */}
      <section className="relative isolate overflow-hidden bg-acacia-900 text-white">
        <SmartImage src={featured?.heroImage ?? '/impact/mkuranga/cover.webp'} alt="" fill priority sizes="100vw" className="object-cover object-[center_35%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06152a] via-[#06152a]/70 to-[#06152a]/25 md:bg-gradient-to-r md:from-[#06152a]/95 md:via-[#06152a]/60 md:to-transparent" />
        <div className="shell relative flex min-h-[min(32rem,76svh)] flex-col items-center justify-end py-7 text-center md:min-h-[30rem] md:items-start md:justify-center md:py-16 md:text-left">
          <span className="rounded-2xl bg-white p-2 shadow-lg"><WscLogo src="/brand/refined/wsc-logo.png" height={52} /></span>
          <p className="mt-2 text-sm font-semibold text-white/85">We Save Children — with Enhakkore</p>
          <h1 className="mt-3 max-w-xl font-display text-[clamp(1.7rem,6.5vw,3.4rem)] leading-[1.08]">Supporting children and communities to create brighter futures.</h1>
          <p className="mt-2 max-w-md text-[0.875rem] text-white/80 md:text-base">Recorded as it happened — real photographs, no invented figures.</p>
          <div className="mt-5 grid w-full max-w-xs gap-2.5 sm:max-w-md sm:grid-cols-2">
            <Link href="/donate" className="inline-flex h-12 items-center justify-center rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700">Donate now →</Link>
            <Link href="#volunteer" className="inline-flex h-12 items-center justify-center rounded-full border border-white/60 px-5 text-sm font-semibold hover:bg-white/10">Get involved</Link>
          </div>
        </div>
      </section>

      {/* Three ways in. */}
      <section className="bg-white">
        <div className="shell grid grid-cols-3 gap-2 py-6 text-center md:max-w-3xl md:py-10">
          {[
            { href: '#projects', label: 'Our projects', icon: '🤝' },
            { href: '#volunteer', label: 'Volunteer', icon: '💛' },
            { href: '/donate', label: 'Donate', icon: '🎁' },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="flex flex-col items-center gap-2 rounded-2xl p-2 text-[0.8125rem] font-semibold text-acacia-700 hover:bg-sand">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-clay-50 text-3xl ring-1 ring-clay-400/40" aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          ))}
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
            <a href="https://www.instagram.com/_wsc2022" target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-acacia-600">
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

      <section id="projects" className="scroll-mt-20 bg-[color:var(--color-cream)]">
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
              <a href={href} {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer noopener' } : {})} className="mt-4 inline-flex min-h-10 items-center font-semibold text-acacia-600 underline underline-offset-4">{label}</a>
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
