import Link from 'next/link';
import { Icon } from '@/components/ui';
import { ARUSHA } from '@/content/arusha';
import { NAPURU } from '@/content/napuru';
import { price } from '@/lib/format';

/**
 * The next Enhakkore departure, surfaced on the homepage.
 *
 * One band rather than a card in the trip rail, because these packages are run
 * by Enhakkore itself rather than listed by an operator. The nearest departure
 * leads; the one after it is a line underneath rather than a second band
 * competing with the first.
 */
export function FeaturedPackage() {
  return (
    <section className="section">
      <div className="shell">
        <Link
          href={`/packages/${NAPURU.slug}`}
          className="group relative block overflow-hidden rounded-[var(--radius-card)] bg-navy-900 p-7 text-white transition-transform duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-gold-500/30 md:p-10"
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-80 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              backgroundImage:
                'radial-gradient(100% 70% at 10% 0%, #3a2f22 0%, transparent 60%), radial-gradient(80% 90% at 95% 100%, rgba(197,164,109,0.4) 0%, transparent 60%)',
            }}
          />

          <div className="relative flex flex-wrap items-end justify-between gap-8">
            <div className="min-w-0">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-gold-300">
                Next departure · {NAPURU.datesLabel}
              </p>
              <h2 className="mt-2.5 text-[1.875rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-balance md:text-[2.5rem]">
                {NAPURU.title}
                <span className="block text-gold-300">{NAPURU.subtitle}</span>
              </h2>
              <p className="mt-3 max-w-md text-[0.9375rem] leading-relaxed text-white/70">
                {NAPURU.duration} · {NAPURU.destination} · includes {NAPURU.included.length} things, listed
                in full
              </p>
            </div>

            <div className="shrink-0">
              <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-white/55">Per person</p>
              <p className="mt-1 text-[1.75rem] font-bold leading-none">{price(NAPURU.price)}</p>
              <span className="mt-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-gold-500 px-6 py-3 text-[0.875rem] font-bold text-navy-900 transition-colors duration-200 group-hover:bg-gold-300">
                Join this trip
                <Icon.arrow />
              </span>
            </div>
          </div>
        </Link>

        {/* The December departure, kept one click away rather than competing. */}
        <p className="mt-4 text-[0.875rem] text-ink-muted">
          Also coming up:{' '}
          <Link
            href={`/packages/${ARUSHA.slug}`}
            className="font-semibold text-ink underline underline-offset-4 hover:text-acacia-700"
          >
            {ARUSHA.title} — {ARUSHA.datesLabel}
          </Link>
        </p>
      </div>
    </section>
  );
}
