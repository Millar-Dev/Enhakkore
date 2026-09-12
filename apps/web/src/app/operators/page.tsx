import type { Metadata } from 'next';
import Image from 'next/image';
import { PublicShell } from '@/components/layout/PublicShell';
import { ButtonLink, Card, Eyebrow, Icon, SectionHead } from '@/components/ui';

export const metadata: Metadata = {
  title: 'For tour operators',
  description:
    'List your trips on Enhakkore. No listing fee, no subscription — a commission on confirmed bookings only.',
};

const STEPS = [
  {
    number: '01',
    title: 'Create an operator account',
    body: 'Takes a minute. You can start building trip drafts straight away.',
  },
  {
    number: '02',
    title: 'Submit verification',
    body: 'Company registration, a current tour operator licence, and a contact number we can reach you on. A person reviews it — usually within three working days.',
  },
  {
    number: '03',
    title: 'Publish your first trip',
    body: 'Add the itinerary, set your dates, capacity and price. We review each listing before it goes live.',
  },
  {
    number: '04',
    title: 'Take bookings and run trips',
    body: 'Bookings, traveller details and your trip groups all live in one dashboard. Post announcements and everyone travelling gets notified.',
  },
];

const TERMS = [
  { label: 'Listing fee', value: 'None' },
  { label: 'Monthly subscription', value: 'None' },
  { label: 'Commission on confirmed bookings', value: '10%' },
  { label: 'Commission on impact contributions', value: 'None' },
  { label: 'Commission on cancelled bookings', value: 'Reversed' },
];

const FEATURES = [
  {
    title: 'You set everything',
    body: 'Your itinerary, your price, your capacity, your dates. Enhakkore does not repackage or rename your trips.',
    icon: Icon.compass,
  },
  {
    title: 'Travellers arrive prepared',
    body: 'Each departure has a private group where you post announcements and answer questions once instead of twenty times.',
    icon: Icon.chat,
  },
  {
    title: 'Reviews you can trust',
    body: 'Only travellers who completed a booking can review. Your rating reflects your actual work.',
    icon: Icon.shield,
  },
  {
    title: 'Impact built in',
    body: 'Link a trip to a community project and travellers can contribute at checkout. Nothing is deducted from your price.',
    icon: Icon.ripple,
  },
];

export default function OperatorsPage() {
  return (
    <PublicShell transparentHeader>
      {/* Hero */}
      <section className="relative flex min-h-[30rem] items-end overflow-hidden pb-14 pt-40">
        <Image
          src="https://images.unsplash.com/photo-1521651201144-634f700b36ef?auto=format&fit=crop&w=2400&h=1200&q=85"
          alt="An elephant with calf on open savannah"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080a0b] via-[#080a0b]/55 to-[#080a0b]/25" />

        <div className="shell relative">
          <Eyebrow className="text-white/55">For tour operators</Eyebrow>
          <h1 className="mt-4 max-w-3xl text-[2.5rem] font-extrabold leading-[1.03] tracking-[-0.035em] text-white text-balance md:text-[3.5rem]">
            Your trips, in front of travellers already looking.
          </h1>
          <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-white/78">
            List your own departures, manage bookings and talk to your travellers in one place. No listing
            fee, no subscription.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="/join?type=organizer" variant="inverted" size="lg">
              Create an operator account
              <Icon.arrow />
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Terms */}
      <section className="section-tight">
        <div className="shell">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
            <div>
              <Eyebrow>What it costs</Eyebrow>
              <h2 className="mt-3 text-h2 text-balance">One number, and nothing hidden behind it.</h2>
              <div className="prose-body mt-5">
                <p>
                  Enhakkore takes a commission on the travel value of confirmed bookings. That is the whole
                  model — there is no listing fee, no subscription, no charge for a booking that gets
                  cancelled, and nothing taken from a traveller&rsquo;s impact contribution.
                </p>
                <p>
                  Rates are negotiable for operators bringing volume. Whatever yours is, it is shown in your
                  dashboard and broken out on every booking.
                </p>
              </div>
            </div>

            <Card className="p-7 md:p-8">
              <dl className="divide-y divide-line">
                {TERMS.map((term) => (
                  <div key={term.label} className="flex items-baseline justify-between gap-4 py-4 first:pt-0 last:pb-0">
                    <dt className="text-[0.9375rem] text-ink-muted">{term.label}</dt>
                    <dd className="shrink-0 text-[0.9375rem] font-bold">{term.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 text-[0.8125rem] leading-relaxed text-ink-faint">
                Payouts are made after a trip departs. Payout scheduling and the provider handling it are
                confirmed during verification.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="section bg-sand">
        <div className="shell">
          <SectionHead eyebrow="Getting started" title="Four steps to your first booking" />
          <ol className="mt-10 grid gap-px overflow-hidden rounded-[--radius-card] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.number} className="bg-white p-6 md:p-7">
                <span className="text-[0.6875rem] font-bold tracking-[0.16em] text-acacia-600">
                  {step.number}
                </span>
                <h3 className="mt-3 text-[1rem] font-bold leading-snug tracking-tight">{step.title}</h3>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="section">
        <div className="shell">
          <SectionHead eyebrow="What you get" title="A dashboard that does the boring parts" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const FeatureIcon = feature.icon;
              return (
                <Card key={feature.title} className="p-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-[0.75rem] bg-acacia-50 text-acacia-700">
                    <FeatureIcon size={21} />
                  </span>
                  <h3 className="mt-5 text-[1rem] font-bold tracking-tight">{feature.title}</h3>
                  <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">{feature.body}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="section-tight">
        <div className="shell">
          <Card className="p-7 md:p-9">
            <h2 className="text-h3">What we will ask you for</h2>
            <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-muted">
              Travellers are handing you money and several days of their life. Verification is how they
              know that is reasonable.
            </p>

            <ul className="mt-7 grid gap-4 sm:grid-cols-2">
              {[
                'Certificate of incorporation or business registration',
                'Current tour operator licence for where you work (TALA in Tanzania)',
                'Tax identification certificate',
                'A contact number we will call',
                'A payout destination in the business name',
                'Public liability insurance, if you have it',
              ].map((item) => (
                <li key={item} className="flex gap-3 text-[0.9375rem] leading-relaxed text-ink-soft">
                  <Icon.check size={17} className="mt-0.5 shrink-0 text-acacia-600" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/join?type=organizer">
                Create an operator account
                <Icon.arrow />
              </ButtonLink>
              <ButtonLink href="mailto:operators@enhakkore.com" variant="secondary">
                Talk to us first
              </ButtonLink>
            </div>
          </Card>
        </div>
      </section>
    </PublicShell>
  );
}
