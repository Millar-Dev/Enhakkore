'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { BookingDto, ImpactProjectSummary, TripDateDto } from '@enhakkore/shared';
import { formatMoney } from '@enhakkore/shared';
import { Logo } from '@/components/brand/Logo';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  Divider,
  Icon,
  Skeleton,
  cx,
} from '@/components/ui';
import { ChoiceGroup, Input, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api';
import { dateRange, duration, price } from '@/lib/format';
import { useSession } from '@/lib/session';

interface Quote {
  currency: string;
  unitPrice: number;
  travellers: number;
  tripAmount: number;
  impactAmount: number;
  total: number;
  seatsRemaining: number;
  trip: {
    id: string;
    slug: string;
    title: string;
    heroImage: string;
    durationDays: number;
    durationNights: number;
    destination: string;
    country: string;
    organizer: string;
    impactProjectId: string | null;
  };
  departure: TripDateDto;
  gateway: { name: string; isLive: boolean; supports: string[] };
}

const IMPACT_TIERS = [5_000, 10_000, 20_000];

type PaymentMethod = 'MOBILE_MONEY' | 'CARD' | 'BANK_TRANSFER';

const PAYMENT_METHODS: { value: PaymentMethod; label: string; detail: string }[] = [
  { value: 'MOBILE_MONEY', label: 'Mobile money', detail: 'M-Pesa, Airtel Money, Tigo Pesa, HaloPesa' },
  { value: 'CARD', label: 'Card', detail: 'Visa or Mastercard' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer', detail: 'Confirmed within 24 hours' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const routeParams = useParams<{ departureId: string }>();
  const departureId = routeParams.departureId;
  const { user, status } = useSession();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [travellers, setTravellers] = useState(1);
  const [names, setNames] = useState<string[]>(['']);
  const [impactTier, setImpactTier] = useState<number | null>(null);
  const [customImpact, setCustomImpact] = useState('');
  const [project, setProject] = useState<ImpactProjectSummary | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('MOBILE_MONEY');
  const [instrument, setInstrument] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  // Anyone who lands here without a session is sent to sign in and returned.
  useEffect(() => {
    if (status === 'anonymous') {
      router.replace(`/signin?next=${encodeURIComponent(`/book/${departureId}`)}`);
    }
  }, [status, router, departureId]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;

    (async () => {
      try {
        const result = await api.get<Quote & { tripSlug?: string }>(
          `/bookings/quote/${departureId}?travellers=1`,
        );
        if (cancelled) return;
        setQuote(result);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof ApiError ? error.message : 'We could not load this departure.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [departureId, status]);

  useEffect(() => {
    setNames((current) => {
      const next = [...current];
      while (next.length < travellers) next.push('');
      return next.slice(0, travellers);
    });
  }, [travellers]);

  // Prefill the lead traveller with the account holder's name.
  useEffect(() => {
    if (user && names[0] === '') {
      setNames((current) => [user.name, ...current.slice(1)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const impactAmount = useMemo(() => {
    if (impactTier !== null) return impactTier;
    const parsed = Number(customImpact.replace(/[^0-9]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [impactTier, customImpact]);

  const currency = quote?.currency ?? 'TZS';
  const tripAmount = (quote?.unitPrice ?? 0) * travellers;
  const total = tripAmount + impactAmount;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailure(null);
    setFields({});

    if (names.some((name) => name.trim().length < 2)) {
      setFailure('Add a full name for every traveller on this booking.');
      return;
    }
    if (impactAmount > 0 && !project) {
      setFailure('Choose a project for your contribution, or set the contribution back to none.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.post<{ booking: BookingDto; payment: { status: string; message: string } }>(
        '/bookings',
        {
          tripDateId: departureId,
          travellers,
          impactAmount,
          impactProjectId: project?.id ?? null,
          travellerDetails: names.map((name) => ({ fullName: name.trim() })),
          notes: notes.trim() || undefined,
          paymentMethod: method,
          paymentInstrument: instrument.trim() || undefined,
        },
      );
      router.push(`/account/bookings/${result.booking.reference}?just_booked=1`);
    } catch (error) {
      if (error instanceof ApiError) {
        setFailure(error.message);
        setFields(error.fields);
      } else {
        setFailure('We could not complete this booking. Please try again.');
      }
      setSubmitting(false);
    }
  }

  if (status === 'loading' || (!quote && !loadError)) {
    return <CheckoutSkeleton />;
  }

  if (loadError) {
    return (
      <CheckoutFrame>
        <Alert tone="danger" title="We could not load this departure">
          {loadError}
        </Alert>
        <ButtonLink href="/trips" className="mt-6">
          Back to trips
        </ButtonLink>
      </CheckoutFrame>
    );
  }

  return (
    <div className="min-h-screen bg-sand/40">
      <header className="border-b border-line bg-white">
        <div className="shell flex h-16 items-center justify-between md:h-[4.5rem]">
          <Link href="/" aria-label="Enhakkore — home">
            <Logo size="md" />
          </Link>
          <span className="inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-ink-muted">
            <Icon.shield size={16} className="text-acacia-600" />
            Secure checkout
          </span>
        </div>
      </header>

      <div className="shell py-8 md:py-12">
        <div className="mb-8">
          <Link
            href="/trips"
            className="inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <span aria-hidden="true">←</span> Back to trips
          </Link>
          <h1 className="mt-4 text-h1">Confirm your booking</h1>
        </div>

        <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
          <div className="min-w-0 space-y-8">
            {failure && (
              <Alert tone="danger" title="We could not complete this booking" role="alert">
                {failure}
              </Alert>
            )}

            {/* 1 — Who is going */}
            <Card className="p-6 md:p-7">
              <Step number={1} title="Who is travelling" />

              <div className="mt-6">
                <label htmlFor="traveller-count" className="text-[0.8125rem] font-semibold">
                  Number of travellers
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setTravellers((count) => Math.max(1, count - 1))}
                    disabled={travellers <= 1}
                    aria-label="Fewer travellers"
                    className="inline-flex h-12 w-12 items-center justify-center rounded-[--radius-field] border border-line-strong text-[1.25rem] font-semibold transition-colors hover:border-ink disabled:opacity-40"
                  >
                    −
                  </button>
                  <output
                    id="traveller-count"
                    className="w-14 text-center text-[1.25rem] font-bold tabular-nums"
                  >
                    {travellers}
                  </output>
                  <button
                    type="button"
                    onClick={() =>
                      setTravellers((count) => Math.min(quote?.seatsRemaining ?? 1, count + 1))
                    }
                    disabled={travellers >= (quote?.seatsRemaining ?? 1)}
                    aria-label="More travellers"
                    className="inline-flex h-12 w-12 items-center justify-center rounded-[--radius-field] border border-line-strong text-[1.25rem] font-semibold transition-colors hover:border-ink disabled:opacity-40"
                  >
                    +
                  </button>
                  <p className="ml-2 text-[0.8125rem] text-ink-muted">
                    {quote?.seatsRemaining} {quote?.seatsRemaining === 1 ? 'seat' : 'seats'} left on this
                    departure
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {names.map((name, index) => (
                  <Input
                    key={index}
                    label={index === 0 ? 'Lead traveller' : `Traveller ${index + 1}`}
                    required
                    value={name}
                    onChange={(event) =>
                      setNames((current) =>
                        current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)),
                      )
                    }
                    placeholder="Full name as on ID or passport"
                    error={fields[`travellerDetails.${index}.fullName`]}
                  />
                ))}
              </div>

              <Textarea
                containerClassName="mt-5"
                label="Anything the organizer should know"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Dietary requirements, mobility needs, pickup point, who you are travelling with…"
                hint="Shared only with the operator running this trip."
              />
            </Card>

            {/* 2 — Impact */}
            <Card className="border-clay-100 p-6 md:p-7">
              <Step
                number={2}
                title="Add an impact contribution"
                optional
                tone="impact"
                description="Optional. One hundred percent of what you add goes to the project — Enhakkore takes no commission on contributions."
              />

              <div className="mt-6">
                <ChoiceGroup
                  tone="impact"
                  value={impactTier}
                  onChange={(value) => {
                    setImpactTier(value === impactTier ? null : value);
                    setCustomImpact('');
                  }}
                  options={IMPACT_TIERS.map((tier) => ({
                    value: tier,
                    label: formatMoney({ amount: tier, currency }, { bare: true }),
                    sublabel: currency,
                  }))}
                />

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Or choose your own amount"
                    inputMode="numeric"
                    value={customImpact}
                    onChange={(event) => {
                      setCustomImpact(event.target.value);
                      setImpactTier(null);
                    }}
                    placeholder="e.g. 50000"
                  />
                </div>

                {impactAmount > 0 && (
                  <div className="mt-5">
                    <ProjectPicker selected={project} onSelect={setProject} currency={currency} />
                  </div>
                )}

                {impactAmount === 0 && (
                  <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-muted">
                    You can skip this and still add a contribution later from any project page. Nothing about
                    your booking changes either way.
                  </p>
                )}
              </div>
            </Card>

            {/* 3 — Payment */}
            <Card className="p-6 md:p-7">
              <Step number={3} title="Payment" />

              {quote && !quote.gateway.isLive && (
                <Alert tone="neutral" className="mt-5" title="No payment provider is connected">
                  This is a pre-launch build. Choosing a method below runs a simulated transaction so the
                  booking flow can be tested end to end — no money moves, and no real payment details should
                  be entered anywhere on this site.
                </Alert>
              )}

              <div className="mt-6 space-y-3">
                {PAYMENT_METHODS.map((option) => (
                  <label
                    key={option.value}
                    className={cx(
                      'flex cursor-pointer items-center gap-4 rounded-[--radius-field] border px-4 py-3.5 transition-all',
                      method === option.value
                        ? 'border-ink bg-ink/[0.03] ring-1 ring-ink'
                        : 'border-line-strong hover:border-ink',
                    )}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value={option.value}
                      checked={method === option.value}
                      onChange={() => setMethod(option.value)}
                      className="h-4 w-4 accent-ink"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-semibold text-ink">{option.label}</span>
                      <span className="block text-[0.8125rem] text-ink-muted">{option.detail}</span>
                    </span>
                  </label>
                ))}
              </div>

              {method === 'MOBILE_MONEY' && (
                <Input
                  containerClassName="mt-5"
                  label="Mobile money number"
                  inputMode="tel"
                  value={instrument}
                  onChange={(event) => setInstrument(event.target.value)}
                  placeholder="+255 7XX XXX XXX"
                  hint="Simulated in this build — a prompt is not sent to your phone."
                />
              )}

              {method === 'CARD' && (
                <Alert tone="neutral" className="mt-5">
                  Card details are never collected by Enhakkore or entered on this page. When a provider is
                  connected, card entry happens in the provider&rsquo;s own hosted form.
                </Alert>
              )}

              {method === 'BANK_TRANSFER' && (
                <Alert tone="neutral" className="mt-5">
                  Bank transfers are confirmed manually. Your booking is held as awaiting payment until the
                  transfer clears, and your seats stay reserved in the meantime.
                </Alert>
              )}
            </Card>
          </div>

          {/* Summary rail */}
          <aside className="lg:relative">
            <div className="lg:sticky lg:top-8">
              <Card className="overflow-hidden">
                {/* What you are actually buying, kept in view the whole way down. */}
                {quote && (
                  <div className="border-b border-line">
                    <div className="media relative aspect-[16/9]">
                      <Image
                        src={quote.trip.heroImage}
                        alt=""
                        fill
                        sizes="352px"
                        className="object-cover"
                      />
                    </div>
                    <div className="p-5">
                      <Link
                        href={`/trips/${quote.trip.slug}`}
                        className="text-[1.0625rem] font-bold leading-snug tracking-tight hover:text-acacia-700"
                      >
                        {quote.trip.title}
                      </Link>
                      <p className="mt-1.5 text-[0.8125rem] text-ink-muted">
                        {quote.trip.destination}, {quote.trip.country}
                      </p>
                      <div className="mt-3 space-y-1.5 text-[0.8125rem]">
                        <p className="inline-flex items-center gap-2 text-ink-soft">
                          <Icon.calendar size={14} className="text-ink-muted" />
                          {dateRange(quote.departure.startDate, quote.departure.endDate)}
                        </p>
                        <p className="inline-flex items-center gap-2 text-ink-soft">
                          <Icon.clock size={14} className="text-ink-muted" />
                          {duration(quote.trip.durationDays, quote.trip.durationNights)}
                        </p>
                        <p className="inline-flex items-center gap-2 text-ink-soft">
                          <Icon.users size={14} className="text-ink-muted" />
                          {quote.departure.seatsBooked}/{quote.departure.capacity} joined
                        </p>
                      </div>
                      <p className="mt-3 text-[0.75rem] text-ink-faint">
                        Organised by {quote.trip.organizer}
                      </p>
                    </div>
                  </div>
                )}

                <div className="p-6">
                  <h2 className="text-[1.0625rem] font-bold tracking-tight">Price</h2>

                  <dl className="mt-5 space-y-3.5 text-[0.875rem]">
                    <Row label="Travellers" value={String(travellers)} />
                    <Row
                      label={`Trip price × ${travellers}`}
                      value={price({ amount: tripAmount, currency })}
                    />
                    {impactAmount > 0 && (
                      <Row
                        label={
                          <span className="inline-flex items-center gap-1.5">
                            <Icon.ripple size={14} className="text-clay-600" />
                            Impact contribution
                          </span>
                        }
                        value={price({ amount: impactAmount, currency })}
                        tone="impact"
                      />
                    )}
                  </dl>

                  <Divider className="my-5" />

                  <div className="flex items-baseline justify-between">
                    <span className="text-[0.9375rem] font-bold">Total</span>
                    <span className="text-[1.5rem] font-bold tracking-tight">
                      {price({ amount: total, currency })}
                    </span>
                  </div>

                  {impactAmount > 0 && project && (
                    <p className="mt-3 rounded-[--radius-field] bg-clay-50 px-3.5 py-3 text-[0.8125rem] leading-relaxed text-clay-700">
                      {price({ amount: impactAmount, currency })} goes to{' '}
                      <span className="font-semibold">{project.title}</span>.
                    </p>
                  )}

                  <Button type="submit" size="lg" full className="mt-6" disabled={submitting}>
                    {submitting ? 'Confirming…' : `Confirm and pay ${price({ amount: total, currency })}`}
                  </Button>

                  <p className="mt-4 text-[0.75rem] leading-relaxed text-ink-faint">
                    By confirming you agree to Enhakkore&rsquo;s terms and to the operator&rsquo;s
                    cancellation policy for this trip.
                  </p>
                </div>
              </Card>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ProjectPicker({
  selected,
  onSelect,
  currency,
}: {
  selected: ImpactProjectSummary | null;
  onSelect: (project: ImpactProjectSummary) => void;
  currency: string;
}) {
  const [projects, setProjects] = useState<ImpactProjectSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.get<{ items: ImpactProjectSummary[] }>(
          '/impact/projects?pageSize=6',
          { token: null },
        );
        if (cancelled) return;
        setProjects(result.items);
        // Default to the first active project so a contribution is never
        // stranded without a destination.
        if (!selected && result.items[0]) onSelect(result.items[0]);
      } catch {
        /* the picker simply stays empty */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (projects.length === 0) return null;

  return (
    <div>
      <p className="mb-3 text-[0.8125rem] font-semibold">Choose where it goes</p>
      <div className="space-y-2">
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => onSelect(project)}
            aria-pressed={selected?.id === project.id}
            className={cx(
              'flex w-full items-center gap-3.5 rounded-[--radius-field] border p-3 text-left transition-all',
              selected?.id === project.id
                ? 'border-clay-500 bg-clay-50/60 ring-1 ring-clay-500'
                : 'border-line-strong hover:border-clay-400',
            )}
          >
            <div className="media relative h-14 w-14 shrink-0 rounded-[0.5rem]">
              <Image src={project.heroImage} alt="" fill sizes="56px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.875rem] font-bold tracking-tight">{project.title}</p>
              <p className="truncate text-[0.75rem] text-ink-muted">
                {project.location} · {project.progress}% of{' '}
                {formatMoney(project.goal, { compact: true })} raised
              </p>
            </div>
            {selected?.id === project.id && <Icon.check size={18} className="shrink-0 text-clay-600" />}
          </button>
        ))}
      </div>
      <Link
        href="/impact"
        target="_blank"
        className="mt-3 inline-block text-[0.8125rem] font-semibold text-clay-600 hover:underline"
      >
        See all projects and how they report →
      </Link>
    </div>
  );
}

function Step({
  number,
  title,
  description,
  optional,
  tone = 'ink',
}: {
  number: number;
  title: string;
  description?: string;
  optional?: boolean;
  tone?: 'ink' | 'impact';
}) {
  return (
    <div className="flex gap-4">
      <span
        className={cx(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.8125rem] font-bold',
          tone === 'impact' ? 'bg-clay-500 text-white' : 'bg-ink text-white',
        )}
      >
        {number}
      </span>
      <div className="min-w-0 pt-1">
        <h2 className="text-[1.0625rem] font-bold tracking-tight">
          {title}
          {optional && <span className="ml-2 text-[0.8125rem] font-medium text-ink-muted">Optional</span>}
        </h2>
        {description && (
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: React.ReactNode;
  value: string;
  tone?: 'impact';
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cx('font-semibold tabular-nums', tone === 'impact' ? 'text-clay-600' : 'text-ink')}>
        {value}
      </dd>
    </div>
  );
}

function CheckoutFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sand/40">
      <header className="border-b border-line bg-white">
        <div className="shell flex h-16 items-center md:h-[4.5rem]">
          <Link href="/">
            <Logo size="md" />
          </Link>
        </div>
      </header>
      <div className="shell-narrow py-16">{children}</div>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <CheckoutFrame>
      <Skeleton className="h-10 w-64" />
      <div className="mt-8 space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </CheckoutFrame>
  );
}
