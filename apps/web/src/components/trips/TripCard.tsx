import Image from 'next/image';
import Link from 'next/link';
import type { TripSummary } from '@enhakkore/shared';
import { TRIP_TYPE_LABELS } from '@enhakkore/shared';
import { Badge, Icon, RatingLine, VerifiedBadge, cx } from '@/components/ui';
import { dateRange, duration, price } from '@/lib/format';

/**
 * The trip card.
 *
 * The same card everywhere — home rails, search results, organizer profiles —
 * so a trip looks like itself wherever it appears. It carries the four things
 * a traveller decides on: what it is, when it goes, what it costs, and who else
 * is already on it.
 */
export function TripCard({
  trip,
  priority = false,
  className,
}: {
  trip: TripSummary;
  priority?: boolean;
  className?: string;
}) {
  const departure = trip.nextDeparture;
  const seatsLeft = departure?.seatsRemaining ?? null;
  const isFull = departure?.status === 'FULL';
  const almostFull = departure?.status === 'ALMOST_FULL';

  return (
    <article className={cx('group', className)}>
      <Link href={`/trips/${trip.slug}`} className="block focus-visible:outline-none">
        <div className="media aspect-[4/3] rounded-[--radius-card]">
          <Image
            src={trip.heroImage}
            alt=""
            fill
            sizes="(max-width: 640px) 84vw, (max-width: 1024px) 46vw, 33vw"
            className="object-cover"
            priority={priority}
          />

          {/* Demo disclosure lives on the operator's verified badge below, not
              here — repeating it on every card buries the trip itself. */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3.5">
            <Badge tone="dark" className="bg-ink/75 backdrop-blur-sm">
              {TRIP_TYPE_LABELS[trip.type]}
            </Badge>
          </div>

          {/* Availability sits on the image — it is the most time-sensitive fact. */}
          {departure && (
            <div className="absolute inset-x-0 bottom-0 p-3.5">
              <div className="flex items-center justify-between gap-2 rounded-[0.625rem] bg-white/94 px-3 py-2 backdrop-blur-sm">
                <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-ink">
                  <Icon.users size={13} className="text-ink-muted" />
                  {departure.seatsBooked}/{departure.capacity} joined
                </span>
                <span
                  className={cx(
                    'text-[0.75rem] font-semibold',
                    isFull ? 'text-ink-muted' : almostFull ? 'text-clay-600' : 'text-acacia-700',
                  )}
                >
                  {isFull
                    ? 'Full'
                    : seatsLeft === 1
                      ? '1 spot left'
                      : `${seatsLeft} spots left`}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4">
          <div className="flex items-center gap-2 text-[0.75rem] font-medium text-ink-muted">
            <Icon.pin size={13} />
            <span className="truncate">
              {trip.destination.name}
              {trip.destination.country !== 'Tanzania' && ` · ${trip.destination.country}`}
            </span>
          </div>

          <h3 className="mt-1.5 text-[1.0625rem] font-bold leading-snug tracking-tight text-ink transition-colors group-hover:text-acacia-700">
            {trip.title}
          </h3>

          <p className="mt-1 text-[0.8125rem] text-ink-muted">
            {duration(trip.durationDays, trip.durationNights)}
            {departure && <> · {dateRange(departure.startDate, departure.endDate)}</>}
          </p>

          <div className="mt-3.5 flex items-end justify-between gap-3 border-t border-line pt-3.5">
            <div>
              <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-faint">From</p>
              <p className="text-[1.0625rem] font-bold tracking-tight text-ink">{price(trip.fromPrice)}</p>
            </div>
            <RatingLine rating={trip.rating} count={trip.reviewCount} />
          </div>
        </div>
      </Link>

      <div className="mt-2.5 flex items-center gap-2">
        <Link
          href={`/operators/${trip.organizer.slug}`}
          className="truncate text-[0.75rem] text-ink-muted transition-colors hover:text-ink"
        >
          {trip.organizer.companyName}
        </Link>
        {trip.organizer.verificationStatus === 'VERIFIED' && (
          <VerifiedBadge isDemo={trip.organizer.isDemo} className="shrink-0 text-[0.6875rem]" />
        )}
      </div>
    </article>
  );
}

/**
 * A wider card for the "upcoming departures" rail, where the date and the
 * remaining seats matter more than the photograph.
 */
export function DepartureCard({ trip }: { trip: TripSummary }) {
  const departure = trip.nextDeparture;
  if (!departure) return null;

  const pct = departure.capacity > 0 ? (departure.seatsBooked / departure.capacity) * 100 : 0;

  return (
    <Link
      href={`/trips/${trip.slug}`}
      className="group flex gap-4 rounded-[--radius-card] border border-line bg-white p-3 transition-all duration-200 hover:border-line-strong hover:shadow-[--shadow-card]"
    >
      <div className="media relative h-28 w-28 shrink-0 rounded-[0.75rem] sm:h-32 sm:w-32">
        <Image src={trip.heroImage} alt="" fill sizes="128px" className="object-cover" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <p className="text-[0.75rem] font-medium text-ink-muted">
            {dateRange(departure.startDate, departure.endDate)}
          </p>
          <h3 className="mt-1 truncate text-[0.9375rem] font-bold tracking-tight text-ink group-hover:text-acacia-700">
            {trip.title}
          </h3>
          <p className="truncate text-[0.8125rem] text-ink-muted">{trip.destination.name}</p>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[0.75rem] font-semibold text-ink">
              {departure.seatsBooked}/{departure.capacity} joined
            </span>
            <span
              className={cx(
                'text-[0.75rem] font-semibold',
                departure.status === 'FULL'
                  ? 'text-ink-muted'
                  : departure.status === 'ALMOST_FULL'
                    ? 'text-clay-600'
                    : 'text-acacia-700',
              )}
            >
              {departure.status === 'FULL' ? 'Full' : `${departure.seatsRemaining} left`}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand-deep">
            <div
              className={cx(
                'h-full rounded-full',
                departure.status === 'ALMOST_FULL' || departure.status === 'FULL'
                  ? 'bg-clay-500'
                  : 'bg-acacia-600',
              )}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
