import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/ui';
import type { UpcomingTrip } from '@/content/packages';
import { price } from '@/lib/format';

/**
 * A card for one of our own departures.
 *
 * Deliberately not the marketplace TripCard: these trips carry a date rather
 * than a list of departures, sometimes two prices in two currencies, and no
 * operator byline — they are ours. Where a trip has no photograph yet the card
 * falls back to the navy and gold field rather than borrowing a picture of
 * somewhere it does not go.
 */
export function PackageCard({ trip, priority }: { trip: UpcomingTrip; priority?: boolean }) {
  return (
    <Link
      href={`/packages/${trip.slug}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white transition-transform duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-gold-500/25"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-navy-900">
        {trip.cover ? (
          <Image
            src={trip.cover.src}
            alt={trip.cover.alt}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            priority={priority}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(100% 80% at 15% 0%, #0e4269 0%, transparent 60%), radial-gradient(85% 80% at 90% 100%, rgba(212,175,83,0.42) 0%, transparent 62%)',
            }}
          />
        )}

        <span className="absolute left-3 top-3 rounded-[var(--radius-pill)] bg-white/92 px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-navy-700 backdrop-blur-sm">
          {trip.datesLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[1.125rem] font-bold leading-snug tracking-tight">{trip.title}</h3>
        <p className="mt-0.5 text-[0.875rem] font-semibold text-gold-600">{trip.subtitle}</p>

        <p className="mt-3 line-clamp-2 text-[0.875rem] leading-relaxed text-ink-muted">{trip.summary}</p>

        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem] text-ink-muted">
          <div className="flex items-center gap-1.5">
            <Icon.pin size={13} />
            {trip.destination}
          </div>
          <div className="flex items-center gap-1.5">
            <Icon.clock size={13} />
            {trip.duration}
          </div>
        </dl>

        <div className="mt-5 flex items-end justify-between gap-3 border-t border-line pt-4">
          <div>
            <p className="text-[1.25rem] font-bold leading-none tracking-tight text-navy-700">
              {price(trip.price)}
            </p>
            <p className="mt-1 text-[0.75rem] text-ink-muted">
              per person
              {trip.altPrice && ` · ${price(trip.altPrice)} ${trip.altPriceNote?.toLowerCase() ?? ''}`}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-acacia-700">
            Details
            <Icon.arrow />
          </span>
        </div>
      </div>
    </Link>
  );
}
