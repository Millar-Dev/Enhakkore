'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type { BookingDto } from '@enhakkore/shared';
import { BOOKING_STATUS_LABELS } from '@enhakkore/shared';
import { DashboardShell, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { ProjectMini } from '@/components/impact/ProjectCard';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  Divider,
  Icon,
  Skeleton,
  cx,
} from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { dateRange, duration, formatDate, price } from '@/lib/format';

/**
 * Booking detail — and the page a traveller lands on straight after paying.
 *
 * The `just_booked` flag turns it into a confirmation: the celebration, the
 * booking reference, and the single next action, which is opening the trip
 * group. On a later visit it is simply the record of the booking.
 */
function BookingContent() {
  const params = useParams<{ reference: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const justBooked = search.get('just_booked') === '1';

  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.get<BookingDto>(`/bookings/${params.reference}`);
        if (!cancelled) setBooking(result);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'We could not load this booking.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.reference]);

  async function cancel() {
    if (!booking) return;
    const confirmed = window.confirm(
      `Cancel booking ${booking.reference}? Your seats are released and, in this build, the simulated payment is reversed.`,
    );
    if (!confirmed) return;

    setCancelling(true);
    try {
      const result = await api.post<{ booking: BookingDto }>(`/bookings/${booking.reference}/cancel`, {
        reason: 'Cancelled by traveller',
      });
      setBooking(result.booking);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'We could not cancel this booking.');
    } finally {
      setCancelling(false);
    }
  }

  if (error) {
    return (
      <Alert tone="danger" title="We could not load this booking">
        {error}
        <div className="mt-4">
          <ButtonLink href="/account/trips" variant="secondary" size="sm">
            Back to my trips
          </ButtonLink>
        </div>
      </Alert>
    );
  }

  if (!booking) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const cancelled = booking.status === 'CANCELLED' || booking.status === 'REFUNDED';
  const upcoming = new Date(booking.departure.endDate).getTime() > Date.now();

  return (
    <div className="mx-auto max-w-3xl">
      {justBooked && booking.status === 'CONFIRMED' && (
        <div className="mb-8 animate-rise overflow-hidden rounded-[--radius-card] border border-acacia-100 bg-acacia-50">
          <div className="p-7 text-center md:p-10">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-acacia-600 text-white">
              <Icon.check size={28} />
            </span>
            <h2 className="mt-5 text-h2 text-acacia-900 text-balance">
              You&rsquo;re going to {booking.trip.destination.name}!
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[0.9375rem] leading-relaxed text-acacia-700">
              Your seat on {booking.trip.title} is confirmed. Your trip group is open — say hello to the
              people you will be travelling with.
            </p>
            {booking.conversationId && (
              <ButtonLink href={`/account/groups/${booking.conversationId}`} className="mt-7" size="lg">
                <Icon.chat size={17} />
                Open trip group
              </ButtonLink>
            )}
          </div>
        </div>
      )}

      {booking.status === 'PENDING_PAYMENT' && (
        <Alert tone="neutral" className="mb-8" title="Awaiting payment">
          We are waiting for your payment to clear. Your seats are held in the meantime. You will get a
          notification as soon as it is confirmed.
        </Alert>
      )}

      {cancelled && (
        <Alert tone="danger" className="mb-8" title={`This booking was ${booking.status.toLowerCase()}`}>
          Your seats have been released.{' '}
          {booking.status === 'REFUNDED' && 'The payment was reversed.'}{' '}
          <Link href={`/trips/${booking.trip.slug}`} className="font-semibold underline">
            View the trip
          </Link>{' '}
          if you would like to book again.
        </Alert>
      )}

      {/* Trip */}
      <Card className="overflow-hidden">
        <div className="media relative aspect-[21/9]">
          <Image
            src={booking.trip.heroImage}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className={cx('object-cover', cancelled && 'grayscale')}
          />
        </div>

        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                href={`/trips/${booking.trip.slug}`}
                className="text-h3 hover:text-acacia-700"
              >
                {booking.trip.title}
              </Link>
              <p className="mt-1.5 text-[0.875rem] text-ink-muted">
                {booking.trip.destination.name}, {booking.trip.destination.country} ·{' '}
                {booking.trip.organizer.companyName}
              </p>
            </div>
            <Badge
              tone={
                booking.status === 'CONFIRMED'
                  ? 'success'
                  : booking.status === 'COMPLETED'
                    ? 'brand'
                    : cancelled
                      ? 'danger'
                      : 'warning'
              }
            >
              {BOOKING_STATUS_LABELS[booking.status]}
            </Badge>
          </div>

          <dl className="mt-7 grid gap-5 sm:grid-cols-3">
            <Detail label="Booking reference" value={<span className="font-mono">{booking.reference}</span>} />
            <Detail label="Dates" value={dateRange(booking.departure.startDate, booking.departure.endDate)} />
            <Detail
              label="Duration"
              value={duration(booking.trip.durationDays, booking.trip.durationNights)}
            />
          </dl>

          <Divider className="my-7" />

          <h3 className="text-[0.9375rem] font-bold tracking-tight">
            {booking.travellers === 1 ? 'Traveller' : `${booking.travellers} travellers`}
          </h3>
          <ul className="mt-3 space-y-1.5">
            {booking.travellerDetails.map((traveller) => (
              <li key={traveller.id} className="text-[0.875rem] text-ink-soft">
                {traveller.fullName}
              </li>
            ))}
          </ul>

          <Divider className="my-7" />

          <h3 className="text-[0.9375rem] font-bold tracking-tight">Payment</h3>
          <dl className="mt-4 space-y-3 text-[0.875rem]">
            <PriceRow label={`Trip price × ${booking.travellers}`} value={price(booking.tripAmount)} />
            {booking.impactAmount.amount > 0 && (
              <PriceRow
                label="Impact contribution"
                value={price(booking.impactAmount)}
                tone="impact"
              />
            )}
            <Divider />
            <div className="flex items-baseline justify-between">
              <dt className="font-bold">Total paid</dt>
              <dd className="text-[1.25rem] font-bold tracking-tight">{price(booking.totalAmount)}</dd>
            </div>
          </dl>

          {booking.payment && (
            <div className="mt-5 rounded-[--radius-field] bg-sand px-4 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[0.8125rem]">
                <span className="text-ink-muted">
                  {booking.payment.method.replace('_', ' ').toLowerCase()} ·{' '}
                  <span className="font-mono">{booking.payment.providerRef}</span>
                </span>
                <span className="font-semibold text-ink">{booking.payment.status.toLowerCase()}</span>
              </div>
              {booking.payment.simulated && (
                <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-muted">
                  Simulated transaction. No payment provider is connected in this build and no money has
                  moved.
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Impact */}
      {booking.impactProject && (
        <div className="mt-6">
          <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
            Your contribution supports
          </h2>
          <ProjectMini project={booking.impactProject} />
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-muted">
            You will get a notification whenever this project publishes an update.
          </p>
        </div>
      )}

      {/* Next steps */}
      {!cancelled && (
        <Card className="mt-6 p-6">
          <h2 className="text-[0.9375rem] font-bold tracking-tight">What happens next</h2>
          <ol className="mt-4 space-y-3.5">
            {[
              'Your organizer posts departure details and a kit list in the trip group.',
              'You will get a reminder three days before you travel.',
              'Meet at the pickup point on the day — bring your ID and your booking reference.',
              'After the trip you can review it, and reviews only come from completed bookings.',
            ].map((step, index) => (
              <li key={index} className="flex gap-3.5 text-[0.875rem] leading-relaxed text-ink-soft">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sand text-[0.6875rem] font-bold text-ink-muted">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <div className="mt-7 flex flex-wrap gap-3">
            {booking.conversationId && (
              <ButtonLink href={`/account/groups/${booking.conversationId}`}>
                <Icon.chat size={16} />
                Open trip group
              </ButtonLink>
            )}
            <ButtonLink href={`/trips/${booking.trip.slug}`} variant="secondary">
              View trip details
            </ButtonLink>
          </div>
        </Card>
      )}

      {/* Cancel */}
      {!cancelled && upcoming && (
        <div className="mt-8 text-center">
          <Button variant="danger" size="sm" onClick={cancel} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel this booking'}
          </Button>
          <p className="mt-2 text-[0.75rem] text-ink-faint">
            Cancellation terms are set by the operator running this trip.
          </p>
        </div>
      )}

      {/* Review */}
      {booking.status === 'COMPLETED' && !booking.reviewed && (
        <Card className="mt-6 p-6 text-center">
          <h2 className="text-h3">How was it?</h2>
          <p className="mx-auto mt-2 max-w-md text-[0.9375rem] leading-relaxed text-ink-muted">
            You travelled on this trip, so you can review it. Other travellers rely on reviews from people
            who actually went.
          </p>
          <ButtonLink href={`/account/review/${booking.reference}`} className="mt-6">
            Write a review
          </ButtonLink>
        </Card>
      )}

      <div className="mt-10 text-center">
        <Link
          href="/account/trips"
          className="text-[0.875rem] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          ← All my trips
        </Link>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="mt-1.5 text-[0.9375rem] font-semibold text-ink">{value}</dd>
    </div>
  );
}

function PriceRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'impact';
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cx('font-semibold tabular-nums', tone === 'impact' ? 'text-clay-600' : 'text-ink')}>
        {value}
      </dd>
    </div>
  );
}

export default function BookingPage() {
  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={['TRAVELER', 'ADMIN', 'ORGANIZER']}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <BookingContent />
      </Suspense>
    </DashboardShell>
  );
}
