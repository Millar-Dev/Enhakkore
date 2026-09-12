'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { TripDateDto, TripDetail } from '@enhakkore/shared';
import { Alert, Badge, Button, Icon, cx } from '@/components/ui';
import { dateRange, daysUntil, price } from '@/lib/format';
import { useSession } from '@/lib/session';

/**
 * Departure picker and the primary call to action.
 *
 * Sticky on desktop, a fixed bar on phones. It only ever offers departures that
 * are genuinely bookable — past dates and sold-out departures are shown but
 * disabled, because hiding them makes a half-empty trip look abandoned.
 */
export function BookingPanel({ trip }: { trip: TripDetail }) {
  const router = useRouter();
  const { status } = useSession();

  const upcoming = useMemo(
    () => trip.departures.filter((departure) => new Date(departure.startDate).getTime() > Date.now()),
    [trip.departures],
  );

  const firstOpen = upcoming.find((departure) => departure.status !== 'FULL' && departure.status !== 'CLOSED');
  const [selectedId, setSelectedId] = useState<string | null>(firstOpen?.id ?? upcoming[0]?.id ?? null);
  const selected = upcoming.find((departure) => departure.id === selectedId) ?? null;

  const bookable = selected && selected.status !== 'FULL' && selected.status !== 'CLOSED';

  function goToCheckout() {
    if (!selected) return;
    if (status !== 'authenticated') {
      // Send them back here after signing in rather than dropping them on the
      // homepage — losing your place mid-booking is how bookings get abandoned.
      router.push(`/signin?next=${encodeURIComponent(`/book/${selected.id}`)}`);
      return;
    }
    router.push(`/book/${selected.id}`);
  }

  if (upcoming.length === 0) {
    return (
      <div className="rounded-[--radius-card] border border-line bg-white p-6">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">From</p>
        <p className="mt-2 text-h2">{price(trip.fromPrice)}</p>
        <p className="mt-1 text-[0.8125rem] text-ink-muted">per traveller</p>

        <Alert tone="neutral" className="mt-6">
          There are no dates scheduled for this trip right now. Ask{' '}
          {trip.organizer.companyName} to run it on dates that suit you.
        </Alert>

        <Button
          variant="secondary"
          size="lg"
          full
          className="mt-4"
          onClick={() => router.push(`/private-trips?destination=${encodeURIComponent(trip.destination.name)}`)}
        >
          Request these dates
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-[--radius-card] border border-line bg-white p-5 md:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">From</p>
            <p className="mt-1.5 text-[2rem] font-bold leading-none tracking-tight">
              {price(selected?.price ?? trip.fromPrice)}
            </p>
            <p className="mt-1.5 text-[0.8125rem] text-ink-muted">per traveller</p>
          </div>
          {trip.rating !== null && (
            <div className="text-right">
              <p className="inline-flex items-center gap-1 text-[1.0625rem] font-bold">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" className="text-clay-500">
                  <path d="M10 1.5l2.47 5.36 5.78.66-4.3 3.96 1.16 5.77L10 14.4l-5.11 2.85 1.16-5.77-4.3-3.96 5.78-.66z" />
                </svg>
                {trip.rating.toFixed(1)}
              </p>
              <p className="text-[0.75rem] text-ink-muted">{trip.reviewCount} reviews</p>
            </div>
          )}
        </div>

        <div className="mt-6">
          <p className="mb-3 text-[0.8125rem] font-bold tracking-tight">Choose a departure</p>
          <div className="space-y-2">
            {upcoming.slice(0, 5).map((departure) => (
              <DepartureOption
                key={departure.id}
                departure={departure}
                selected={departure.id === selectedId}
                onSelect={() => setSelectedId(departure.id)}
              />
            ))}
          </div>
        </div>

        {selected && (
          <div className="mt-5 rounded-[--radius-field] bg-sand p-4">
            <div className="flex items-center justify-between text-[0.875rem]">
              <span className="inline-flex items-center gap-2 font-semibold text-ink">
                <Icon.users size={15} className="text-ink-muted" />
                {selected.seatsBooked} of {selected.capacity} joined
              </span>
              <span
                className={cx(
                  'font-bold',
                  selected.status === 'FULL'
                    ? 'text-ink-muted'
                    : selected.status === 'ALMOST_FULL'
                      ? 'text-clay-600'
                      : 'text-acacia-700',
                )}
              >
                {selected.status === 'FULL' ? 'Fully booked' : `${selected.seatsRemaining} spots remaining`}
              </span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white">
              <div
                className={cx(
                  'h-full rounded-full transition-all duration-500',
                  selected.status === 'OPEN' ? 'bg-acacia-600' : 'bg-clay-500',
                )}
                style={{ width: `${Math.min(100, (selected.seatsBooked / selected.capacity) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <Button size="lg" full className="mt-5" onClick={goToCheckout} disabled={!bookable}>
          {bookable ? (
            <>
              {trip.type === 'PRIVATE' ? 'Book this journey' : 'Join this trip'}
              <Icon.arrow />
            </>
          ) : (
            'This departure is full'
          )}
        </Button>

        {!bookable && selected?.status === 'FULL' && (
          <p className="mt-3 text-center text-[0.8125rem] text-ink-muted">
            Pick another date above, or{' '}
            <a href="/private-trips" className="font-semibold text-acacia-700 hover:underline">
              request your own departure
            </a>
            .
          </p>
        )}

        <p className="mt-4 text-center text-[0.75rem] leading-relaxed text-ink-faint">
          You will not be charged yet. Review everything on the next screen.
        </p>
      </div>

      {/* Phone action bar — the primary action is always one thumb away. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/97 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[1.0625rem] font-bold leading-none tracking-tight">
              {price(selected?.price ?? trip.fromPrice)}
            </p>
            <p className="mt-1 truncate text-[0.75rem] text-ink-muted">
              {selected ? dateRange(selected.startDate, selected.endDate) : 'per traveller'}
            </p>
          </div>
          <Button size="md" onClick={goToCheckout} disabled={!bookable} className="shrink-0 px-7">
            {bookable ? 'Join trip' : 'Full'}
          </Button>
        </div>
      </div>
    </>
  );
}

function DepartureOption({
  departure,
  selected,
  onSelect,
}: {
  departure: TripDateDto;
  selected: boolean;
  onSelect: () => void;
}) {
  const full = departure.status === 'FULL' || departure.status === 'CLOSED';
  const days = daysUntil(departure.startDate);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={full}
      aria-pressed={selected}
      className={cx(
        'flex w-full items-center justify-between gap-3 rounded-[--radius-field] border px-4 py-3 text-left transition-all duration-150',
        full
          ? 'cursor-not-allowed border-line bg-sand/60 opacity-60'
          : selected
            ? 'border-ink bg-ink/[0.03] ring-1 ring-ink'
            : 'border-line-strong bg-white hover:border-ink',
      )}
    >
      <div className="min-w-0">
        <p className="text-[0.875rem] font-bold tracking-tight text-ink">
          {dateRange(departure.startDate, departure.endDate)}
        </p>
        <p className="mt-0.5 text-[0.75rem] text-ink-muted">
          {full ? 'Fully booked' : `${departure.seatsRemaining} of ${departure.capacity} spots left`}
          {!full && days !== null && days <= 21 && ` · in ${days} days`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {departure.status === 'ALMOST_FULL' && <Badge tone="impact">Almost full</Badge>}
        <span className="text-[0.875rem] font-bold text-ink">{price(departure.price)}</span>
      </div>
    </button>
  );
}
