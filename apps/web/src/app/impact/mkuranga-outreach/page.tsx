import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PublicShell } from '@/components/layout/PublicShell';
import { Reveal } from '@/components/packages/Reveal';
import { Badge, ButtonLink, Icon, SectionHead } from '@/components/ui';
import { MKURANGA } from '@/content/mkuranga';

/**
 * Mkuranga Community Outreach — a completed project.
 *
 * A record of a day that happened, not a fundraising page. There are no
 * progress bars, no totals and no "lives changed" counters, because no such
 * figures were supplied and inventing them would be the fastest way to lose
 * the trust this page exists to earn. The photographs carry it instead.
 */

export const metadata: Metadata = {
  title: `${MKURANGA.title} — Our Impact`,
  description: MKURANGA.summary,
};

export default function MkurangaPage() {
  return (
    <PublicShell transparentHeader>
      {/* Hero */}
      <section className="relative flex min-h-[32rem] items-end overflow-hidden pb-14 pt-40 md:min-h-[38rem]">
        <Image
          src={MKURANGA.cover.src}
          alt={MKURANGA.cover.alt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080a0b] via-[#080a0b]/60 to-[#080a0b]/25" />

        <div className="shell relative">
          <Reveal>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="dark" className="border-white/25 bg-white/15 text-white backdrop-blur-md">
                <Icon.check size={13} />
                {MKURANGA.status}
              </Badge>
              <span className="text-[0.8125rem] text-white/70">{MKURANGA.dateLabel}</span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-5 max-w-3xl text-[2.25rem] font-extrabold leading-[1.04] tracking-[-0.035em] text-white text-balance md:text-[3.25rem]">
              {MKURANGA.title}
            </h1>
            <p className="mt-4 flex items-center gap-2 text-[0.9375rem] text-white/75">
              <Icon.pin size={15} />
              {MKURANGA.location}
            </p>
          </Reveal>
        </div>
      </section>

      {/* What happened */}
      <section className="section">
        <div className="shell max-w-3xl">
          <Reveal>
            <p className="text-[1.25rem] font-semibold leading-snug tracking-[-0.01em] text-ink text-balance md:text-[1.5rem]">
              {MKURANGA.summary}
            </p>
          </Reveal>
          {MKURANGA.story.map((paragraph, index) => (
            <Reveal key={paragraph.slice(0, 24)} delay={60 + index * 60}>
              <p className="mt-6 text-[1.0625rem] leading-relaxed text-ink-soft">{paragraph}</p>
            </Reveal>
          ))}

          {MKURANGA.figures.length > 0 && (
            <Reveal delay={200}>
              <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-line pt-8 sm:grid-cols-4">
                {MKURANGA.figures.map((figure) => (
                  <div key={figure.label}>
                    <dd className="text-[1.75rem] font-bold leading-none tracking-tight text-clay-600">
                      {figure.value}
                    </dd>
                    <dt className="mt-2 text-[0.875rem] text-ink-muted">{figure.label}</dt>
                  </div>
                ))}
              </dl>
            </Reveal>
          )}
        </div>
      </section>

      {/* The day, in photographs */}
      <section className="section bg-sand">
        <div className="shell">
          <Reveal>
            <SectionHead eyebrow="The day" title="Photographs from Mkuranga" />
          </Reveal>

          <div className="mt-10 columns-2 gap-3 md:columns-3 md:gap-4 [&>figure]:mb-3 md:[&>figure]:mb-4">
            {MKURANGA.gallery.map((photo, index) => (
              <Reveal key={photo.src} delay={(index % 3) * 70}>
                <figure className="overflow-hidden rounded-[var(--radius-card)] bg-sand-deep">
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    width={1200}
                    height={1600}
                    sizes="(max-width: 768px) 50vw, 33vw"
                    loading="lazy"
                    className="h-auto w-full object-cover"
                  />
                </figure>
              </Reveal>
            ))}
          </div>

          {MKURANGA.video && (
            <Reveal delay={120}>
              <figure className="mt-8 overflow-hidden rounded-[var(--radius-card)] bg-ink">
                <video
                  controls
                  preload="none"
                  poster={MKURANGA.video.poster}
                  className="h-auto w-full"
                  playsInline
                >
                  <source src={MKURANGA.video.src} />
                  Your browser cannot play this video.
                </video>
                <figcaption className="px-5 py-4 text-[0.875rem] text-white/70">
                  {MKURANGA.video.caption}
                </figcaption>
              </figure>
            </Reveal>
          )}
        </div>
      </section>

      {/* Support future work */}
      <section className="section">
        <div className="shell max-w-3xl text-center">
          <Reveal>
            <h2 className="text-h2 text-balance">Be part of the impact</h2>
            <p className="mx-auto mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-ink-muted">
              Your support can help us continue community outreach and develop future initiatives. Tell us
              what you would like to support and we will come back to you about how.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/impact">
                See our impact work
                <Icon.arrow />
              </ButtonLink>
              <ButtonLink href="/contact" variant="secondary">
                Ask about supporting a project
              </ButtonLink>
            </div>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-6 text-[0.8125rem] leading-relaxed text-ink-faint">
              Contributions toward community work are kept separate from trip payments, and no donation
              details are published here until they have been confirmed.
            </p>
          </Reveal>
          <Reveal delay={180}>
            <p className="mt-8 border-t border-line pt-6 text-[0.8125rem] text-ink-muted">
              <Link href="/impact" className="font-semibold underline underline-offset-4 hover:text-ink">
                ← All impact work
              </Link>
            </p>
          </Reveal>
        </div>
      </section>
    </PublicShell>
  );
}
