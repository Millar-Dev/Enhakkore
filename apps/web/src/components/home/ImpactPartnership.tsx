import Image from 'next/image';
import Link from 'next/link';
import { PARTNER } from '@/components/brand/Partner';
import { Icon } from '@/components/ui';
import { MKURANGA } from '@/content/mkuranga';

/**
 * Travel that goes beyond the journey.
 *
 * WSC's place on the homepage: near the bottom, with a section of its own
 * rather than a logo tucked beside the Enhakkore mark at the top. The two
 * organisations do different things and the copy says which is which — a
 * travel company and a children's charity, working together, not one wearing
 * the other's name.
 *
 * It leads with the outreach that actually happened, because a partnership
 * section with nothing behind it is a claim, and a photograph of a real day is
 * evidence.
 */
export function ImpactPartnership() {
  return (
    <section className="section bg-ink text-white">
      <div className="shell">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* The work */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] lg:order-last">
            <Image
              src={MKURANGA.cover.src}
              alt={MKURANGA.cover.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              loading="lazy"
              className="object-cover"
            />
            <Link
              href={`/impact/${MKURANGA.slug}`}
              className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/80 to-transparent p-5 pt-16"
            >
              <span>
                <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-white/65">
                  {MKURANGA.status} · {MKURANGA.location.split(',').slice(-2).join(',').trim()}
                </span>
                <span className="mt-1 block text-[1.0625rem] font-bold leading-snug">{MKURANGA.title}</span>
              </span>
              <span className="shrink-0 rounded-full bg-white/15 p-2 backdrop-blur-sm">
                <Icon.arrow />
              </span>
            </Link>
          </div>

          {/* The words */}
          <div>
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-gold-300">
              Our impact
            </p>
            <h2 className="mt-4 text-[2rem] font-extrabold leading-[1.06] tracking-[-0.03em] text-balance md:text-[2.75rem]">
              Travel That Goes Beyond the Journey
            </h2>
            <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-white/75">
              Through meaningful community initiatives and collaboration with We Save Children, we aim to
              connect experiences with opportunities to make a positive difference.
            </p>

            <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-white/70">
              We have seen what one day can do. Keeping it going takes more than good
              intentions — it takes people who decide to be part of it.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-6">
              {/* WSC's mark in ivory, directly on the dark — no tile. */}
              <Image
                src={PARTNER.logoLight}
                alt={`${PARTNER.fullName} logo`}
                width={140}
                height={79}
                loading="lazy"
                className="h-[52px] w-auto"
              />

              <Link
                href="/impact"
                className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-gold-500 px-6 py-3 text-[0.9375rem] font-bold text-navy-900 transition-colors duration-200 hover:bg-gold-300"
              >
                Be part of it
                <Icon.arrow />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
