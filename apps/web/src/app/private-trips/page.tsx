'use client';

import Image from 'next/image';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TRAVEL_STYLES, TRAVEL_STYLE_LABELS } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { Alert, Button, Card, Eyebrow, Icon, cx } from '@/components/ui';
import { ChoiceGroup, Input, Select, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

/**
 * Private and custom trip requests.
 *
 * This is a demand-capture form, not a booking. It asks only what an operator
 * needs to quote — anything else is a question they can ask once a conversation
 * has started, and every extra field here costs completions.
 */

const ACTIVITIES = [
  'Game drives',
  'Walking safari',
  'Beach & swimming',
  'Snorkelling or diving',
  'Trekking',
  'Cultural visits',
  'Food & cooking',
  'Photography',
  'Birdwatching',
  'Hot air balloon',
  'Kitesurfing',
  'Wellness & rest',
];

const ACCOMMODATION = [
  'Camping',
  'Guesthouse',
  'Mid-range lodge',
  'Luxury lodge or camp',
  'Beach hotel',
  'Mixed — advise me',
];

const STYLE_HINTS: Record<string, string> = {
  BUDGET: 'Camping and guesthouses, shared transport, self-catering where it makes sense.',
  COMFORT: 'Good lodges, private vehicle, meals included. The middle of the market.',
  LUXURY: 'Premium camps and lodges, private guide, flights between parks where useful.',
};

function RequestForm() {
  const params = useSearchParams();
  const { user } = useSession();

  const [form, setForm] = useState({
    destination: params.get('destination') ?? '',
    startDate: '',
    endDate: '',
    travellers: 2,
    budget: '',
    accommodation: '',
    notes: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });
  const [style, setStyle] = useState<string>('COMFORT');
  const [activities, setActivities] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  // Prefill contact details from the session so a signed-in traveller does not
  // retype what we already know.
  const contactName = form.contactName || user?.name || '';
  const contactEmail = form.contactEmail || user?.email || '';

  function set(key: keyof typeof form, value: string | number) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleActivity(activity: string) {
    setActivities((current) =>
      current.includes(activity) ? current.filter((item) => item !== activity) : [...current, activity],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});

    try {
      await api.post('/requests', {
        destination: form.destination,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        travellers: Number(form.travellers),
        budget: form.budget ? Number(form.budget.replace(/[^0-9]/g, '')) : undefined,
        currency: 'TZS',
        style,
        accommodation: form.accommodation || undefined,
        activities,
        notes: form.notes || undefined,
        contactName,
        contactEmail,
        contactPhone: form.contactPhone || undefined,
      });
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFields(caught.fields);
      } else {
        setError('We could not send your request. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card className="p-8 text-center md:p-12">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-acacia-600 text-white">
          <Icon.check size={28} />
        </span>
        <h2 className="mt-6 text-h2 text-balance">Your request is in</h2>
        <p className="mx-auto mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-ink-muted">
          The Enhakkore team reviews every request and passes it to verified operators who run that route.
          You should hear back within two working days, at {contactEmail}.
        </p>
        <Alert tone="neutral" className="mx-auto mt-8 max-w-lg text-left">
          Operator matching is handled manually while the platform is pre-launch. The architecture already
          supports routing one request to several operators and collecting competing quotes — that is a
          later milestone, not something happening behind the scenes today.
        </Alert>
        <Button variant="secondary" className="mt-8" onClick={() => setDone(false)}>
          Send another request
        </Button>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {error && (
        <Alert tone="danger" title="We could not send your request" role="alert">
          {error}
        </Alert>
      )}

      {/* Where and when */}
      <Card className="p-6 md:p-8">
        <h2 className="text-h3">Where and when</h2>

        <div className="mt-6 space-y-5">
          <Input
            label="Where do you want to go?"
            required
            value={form.destination}
            onChange={(event) => set('destination', event.target.value)}
            error={fields.destination}
            placeholder="Serengeti and Zanzibar, Kilimanjaro, somewhere new…"
            hint="A country, a park, a region, or just a rough idea — operators will narrow it with you."
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Ideal start date"
              type="date"
              value={form.startDate}
              onChange={(event) => set('startDate', event.target.value)}
              error={fields.startDate}
            />
            <Input
              label="Ideal end date"
              type="date"
              value={form.endDate}
              onChange={(event) => set('endDate', event.target.value)}
              error={fields.endDate}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="How many travellers"
              type="number"
              min={1}
              max={60}
              required
              value={form.travellers}
              onChange={(event) => set('travellers', Number(event.target.value))}
              error={fields.travellers}
            />
            <Input
              label="Budget per person (TZS)"
              inputMode="numeric"
              value={form.budget}
              onChange={(event) => set('budget', event.target.value)}
              error={fields.budget}
              placeholder="e.g. 1500000"
              hint="A range is fine. It helps operators quote something realistic rather than guessing."
            />
          </div>
        </div>
      </Card>

      {/* How you travel */}
      <Card className="p-6 md:p-8">
        <h2 className="text-h3">How you like to travel</h2>

        <div className="mt-6">
          <p className="mb-3 text-[0.8125rem] font-semibold">Travel style</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {TRAVEL_STYLES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStyle(option)}
                aria-pressed={style === option}
                className={cx(
                  'rounded-[--radius-card] border p-4 text-left transition-all duration-150',
                  style === option
                    ? 'border-ink bg-ink/[0.03] ring-1 ring-ink'
                    : 'border-line-strong hover:border-ink',
                )}
              >
                <span className="block text-[0.9375rem] font-bold tracking-tight">
                  {TRAVEL_STYLE_LABELS[option]}
                </span>
                <span className="mt-1.5 block text-[0.75rem] leading-relaxed text-ink-muted">
                  {STYLE_HINTS[option]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Select
          containerClassName="mt-6"
          label="Accommodation preference"
          value={form.accommodation}
          onChange={(event) => set('accommodation', event.target.value)}
        >
          <option value="">No preference</option>
          {ACCOMMODATION.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>

        <div className="mt-6">
          <p className="mb-3 text-[0.8125rem] font-semibold">
            What would you like to do?{' '}
            <span className="font-normal text-ink-muted">Pick as many as you like</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {ACTIVITIES.map((activity) => {
              const active = activities.includes(activity);
              return (
                <button
                  key={activity}
                  type="button"
                  onClick={() => toggleActivity(activity)}
                  aria-pressed={active}
                  className={cx(
                    'min-h-10 rounded-[--radius-pill] border px-3.5 text-[0.8125rem] font-semibold transition-all',
                    active
                      ? 'border-ink bg-ink text-white'
                      : 'border-line-strong bg-white text-ink-soft hover:border-ink hover:text-ink',
                  )}
                >
                  {activity}
                </button>
              );
            })}
          </div>
        </div>

        <Textarea
          containerClassName="mt-6"
          label="Anything else"
          value={form.notes}
          onChange={(event) => set('notes', event.target.value)}
          placeholder="Who you are travelling with, ages, mobility or dietary needs, dates you cannot move, things you have already done…"
          error={fields.notes}
        />
      </Card>

      {/* Contact */}
      <Card className="p-6 md:p-8">
        <h2 className="text-h3">How to reach you</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Input
            label="Your name"
            required
            value={contactName}
            onChange={(event) => set('contactName', event.target.value)}
            error={fields.contactName}
          />
          <Input
            label="Email"
            type="email"
            required
            value={contactEmail}
            onChange={(event) => set('contactEmail', event.target.value)}
            error={fields.contactEmail}
          />
          <Input
            label="Phone or WhatsApp"
            value={form.contactPhone}
            onChange={(event) => set('contactPhone', event.target.value)}
            error={fields.contactPhone}
            placeholder="+255 7XX XXX XXX"
            containerClassName="sm:col-span-2"
            hint="Optional, but it usually gets you a faster answer."
          />
        </div>

        <Button type="submit" size="lg" full className="mt-8" disabled={busy}>
          {busy ? 'Sending…' : 'Request custom trip'}
          {!busy && <Icon.arrow />}
        </Button>

        <p className="mt-4 text-center text-[0.75rem] leading-relaxed text-ink-faint">
          No payment, no commitment. Your details go to the Enhakkore team and to operators who run this
          route — nobody else.
        </p>
      </Card>
    </form>
  );
}

export default function PrivateTripsPage() {
  return (
    <PublicShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="media relative h-64 md:h-80">
          <Image
            src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=2400&h=1000&q=85"
            alt="A boat on a still lake at dawn"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[#080a0b]/55" />
          <div className="shell absolute inset-0 flex flex-col justify-center">
            <Eyebrow className="text-white/55">Private &amp; custom</Eyebrow>
            <h1 className="mt-3 max-w-2xl text-[2.25rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-white text-balance md:text-[3.25rem]">
              Your trip. Your way.
            </h1>
            <p className="mt-4 max-w-xl text-[1rem] leading-relaxed text-white/78">
              Tell us where you want to go and how you like to travel. We pass it to verified operators who
              run that route, and they come back to you.
            </p>
          </div>
        </div>
      </section>

      <div className="shell py-12 md:py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_18rem] lg:gap-16">
          <div className="min-w-0">
            <Suspense fallback={null}>
              <RequestForm />
            </Suspense>
          </div>

          <aside className="lg:relative">
            <div className="space-y-5 lg:sticky lg:top-28">
              <Card className="p-6">
                <h2 className="text-[0.9375rem] font-bold tracking-tight">What happens next</h2>
                <ol className="mt-4 space-y-4">
                  {[
                    'We read your request and check it against operators who actually run that route.',
                    'Suitable operators put together an itinerary and a price.',
                    'You get their proposals and pick one, or ask for changes.',
                    'When you are happy, it becomes a booking on Enhakkore like any other.',
                  ].map((step, index) => (
                    <li key={index} className="flex gap-3 text-[0.8125rem] leading-relaxed text-ink-soft">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sand text-[0.6875rem] font-bold text-ink-muted">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </Card>

              <Card className="bg-sand/60 p-6">
                <h2 className="text-[0.9375rem] font-bold tracking-tight">Good to know</h2>
                <ul className="mt-4 space-y-3 text-[0.8125rem] leading-relaxed text-ink-muted">
                  <li>Private trips can run on any date — you are not tied to a scheduled departure.</li>
                  <li>Groups of two to sixty. Family trips, company trips, birthdays, anything.</li>
                  <li>
                    You can still add an impact contribution at checkout, exactly as on a group trip.
                  </li>
                </ul>
              </Card>
            </div>
          </aside>
        </div>
      </div>
    </PublicShell>
  );
}
