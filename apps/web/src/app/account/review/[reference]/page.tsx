'use client';

import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { BookingDto } from '@enhakkore/shared';
import { DashboardShell, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { Alert, Button, ButtonLink, Card, Icon, Skeleton, cx } from '@/components/ui';
import { Input, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api';
import { dateRange } from '@/lib/format';

/**
 * Write a review.
 *
 * Reachable only for a completed booking the viewer owns; the API refuses
 * anything else. That constraint is what makes ratings on this platform worth
 * reading, so it is stated on the page rather than hidden.
 */
export default function WriteReviewPage() {
  const params = useParams<{ reference: string }>();
  const router = useRouter();

  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (rating === 0) {
      setError('Choose a rating first.');
      return;
    }
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api.post('/me/reviews', {
        bookingReference: params.reference,
        rating,
        title: title.trim() || undefined,
        body: body.trim(),
        photos: [],
      });
      setDone(true);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFields(caught.fields);
      } else {
        setError('We could not publish your review. Try again in a moment.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={['TRAVELER', 'ORGANIZER', 'ADMIN']}>
      <div className="mx-auto max-w-2xl">
        {done ? (
          <Card className="p-8 text-center md:p-12">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-acacia-600 text-white">
              <Icon.check size={28} />
            </span>
            <h1 className="mt-6 text-h2">Thank you</h1>
            <p className="mx-auto mt-3 max-w-md text-[0.9375rem] leading-relaxed text-ink-muted">
              Your review is live on the trip page. It helps the next person decide, and it helps good
              operators get found.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {booking && (
                <ButtonLink href={`/trips/${booking.trip.slug}`} variant="secondary">
                  See it on the trip
                </ButtonLink>
              )}
              <ButtonLink href="/account/trips">My trips</ButtonLink>
            </div>
          </Card>
        ) : !booking ? (
          error ? (
            <Alert tone="danger" title="We could not load this booking">
              {error}
              <div className="mt-4">
                <ButtonLink href="/account/trips" variant="secondary" size="sm">
                  Back to my trips
                </ButtonLink>
              </div>
            </Alert>
          ) : (
            <Skeleton className="h-96 w-full" />
          )
        ) : (
          <>
            <h1 className="text-h1">How was it?</h1>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
              You travelled on this trip, so you can review it. Reviews on Enhakkore only come from
              completed bookings — which is exactly why other travellers read them.
            </p>

            <Card className="mt-8 flex items-center gap-4 p-4">
              <div className="media relative h-20 w-20 shrink-0 rounded-[0.625rem]">
                <Image src={booking.trip.heroImage} alt="" fill sizes="80px" className="object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-[1rem] font-bold tracking-tight">{booking.trip.title}</p>
                <p className="mt-0.5 text-[0.8125rem] text-ink-muted">
                  {dateRange(booking.departure.startDate, booking.departure.endDate)} ·{' '}
                  {booking.trip.organizer.companyName}
                </p>
              </div>
            </Card>

            <form onSubmit={submit} className="mt-8 space-y-6">
              {error && (
                <Alert tone="danger" role="alert">
                  {error}
                </Alert>
              )}

              <div>
                <p className="mb-3 text-[0.8125rem] font-semibold">Your rating</p>
                <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      onMouseEnter={() => setHovered(value)}
                      aria-label={`${value} out of 5`}
                      aria-pressed={rating === value}
                      className="p-1"
                    >
                      <svg
                        width="34"
                        height="34"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={cx(
                          'transition-colors',
                          value <= (hovered || rating) ? 'text-clay-500' : 'text-line-strong',
                        )}
                      >
                        <path d="M10 1.5l2.47 5.36 5.78.66-4.3 3.96 1.16 5.77L10 14.4l-5.11 2.85 1.16-5.77-4.3-3.96 5.78-.66z" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label="Headline"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                error={fields.title}
                placeholder="One line that sums it up"
                maxLength={120}
              />

              <Textarea
                label="Your review"
                required
                value={body}
                onChange={(event) => setBody(event.target.value)}
                error={fields.body}
                placeholder="What was the guiding like? Did the itinerary match the listing? What would you tell someone considering it? Be specific — that is what helps."
                className="min-h-44"
                hint={`${body.length} characters — at least 20`}
              />

              <Button type="submit" size="lg" full disabled={busy || rating === 0 || body.trim().length < 20}>
                {busy ? 'Publishing…' : 'Publish review'}
              </Button>

              <p className="text-center text-[0.75rem] leading-relaxed text-ink-faint">
                Your name and country appear with your review. Your email and booking details do not.
              </p>
            </form>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
