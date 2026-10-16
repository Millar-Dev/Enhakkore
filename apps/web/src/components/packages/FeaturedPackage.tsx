import Link from 'next/link';
import { PartnershipLockup } from '@/components/brand/Partner';
import { Icon } from '@/components/ui';
import { ARUSHA } from '@/content/arusha';
import { price } from '@/lib/format';

/**
 * The Arusha departure, surfaced on the homepage.
 *
 * One band rather than a card in the trip rail, because this package is run by
 * Enhakkore with WSC rather than listed by an operator, and it carries two
 * prices — neither of which fits the shape of a marketplace card.
 */
export function FeaturedPackage() {
  return (
    <section className="section">
      <div className="shell">
        <Link
          href={`/packages/${ARUSHA.slug}`}
          className="group relative block overflow-hidden rounded-[var(--radius-card)] bg-navy-900 p-7 text-white transition-transform duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-gold-500/30 md:p-10"
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-80 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              backgroundImage:
                'radial-gradient(100% 70% at 10% 0%, #1b2a5c 0%, transparent 60%), radial-gradient(80% 90% at 95% 100%, rgba(199,154,63,0.4) 0%, transparent 60%)',
            }}
          />

          <div className="relative flex flex-wrap items-end justify-between gap-8">
            <div className="min-w-0">
              <PartnershipLockup size="sm" />

              <p className="mt-6 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-gold-300">
                {ARUSHA.datesLabel} · {ARUSHA.departureCity.split(',')[0]} →{' '}
                {ARUSHA.destination.split(',')[0]}
              </p>
              <h2 className="mt-2.5 text-[1.875rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-balance md:text-[2.5rem]">
                {ARUSHA.title}
                <span className="block text-gold-300">{ARUSHA.subtitle}</span>
              </h2>
              <p className="mt-3 max-w-md text-[0.9375rem] leading-relaxed text-white/70">
                {ARUSHA.duration} · planned for {ARUSHA.groupSize} travellers
              </p>
            </div>

            <div className="shrink-0">
              <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-white/55">From</p>
              <p className="mt-1 text-[1.75rem] font-bold leading-none">
                {price(ARUSHA.pricing.resident.amount)}
              </p>
              <p className="mt-1 text-[0.8125rem] text-white/60">
                per person · {price(ARUSHA.pricing.nonResident.amount)} non-resident
              </p>
              <span className="mt-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-gold-500 px-6 py-3 text-[0.875rem] font-bold text-navy-900 transition-colors duration-200 group-hover:bg-gold-300">
                See the trip
                <Icon.arrow />
              </span>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
