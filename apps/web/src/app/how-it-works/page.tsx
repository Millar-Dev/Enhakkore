import type { Metadata } from 'next';
import Image from 'next/image';
import { PublicShell } from '@/components/layout/PublicShell';
import { ButtonLink, Card, Eyebrow, Icon, SectionHead } from '@/components/ui';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Discover, join, connect, travel, give back — how booking on Enhakkore works, for travellers and for tour operators.',
};

const TRAVELLER_STEPS = [
  {
    number: '01',
    title: 'Discover',
    body: 'Search by destination, dates, budget or the kind of travel you like. Every listing shows the real price, the real dates, and how many people have already joined.',
    detail: 'Filters that matter: trip type, duration, group size, travel style, and whether seats are still open.',
    image: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&h=900&q=80',
    alt: 'A map, camera and notebook laid out for planning',
  },
  {
    number: '02',
    title: 'Join',
    body: 'Book a seat on an existing group departure, or ask for a private trip built around your dates and your people.',
    detail: 'Group trips are capped, so you always know the size. Private trips run whenever suits you.',
    image: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=1200&h=900&q=80',
    alt: 'A group of friends together outdoors',
  },
  {
    number: '03',
    title: 'Connect',
    body: 'The moment your booking confirms, you are in that departure’s private group with everyone else going and the organizer running it.',
    detail: 'Ask what to pack, sort out shared transport, and arrive already knowing a few names.',
    image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&h=900&q=80',
    alt: 'A crowd gathered at an outdoor event',
  },
  {
    number: '04',
    title: 'Travel',
    body: 'Your organizer handles logistics, permits and guiding. Announcements land in the group so nothing important gets lost in a thread.',
    detail: 'Everything you need — itinerary, inclusions, meeting point — stays in one place on your phone.',
    image: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&h=900&q=80',
    alt: 'A safari vehicle on open grassland at sunset',
  },
  {
    number: '05',
    title: 'Give back',
    body: 'Add a contribution to a project you choose, at checkout or any time after. You get the updates as the work happens.',
    detail: 'One hundred percent goes to the project. Enhakkore takes no commission on contributions.',
    image: 'https://images.unsplash.com/photo-1538300342682-cf57afb97285?auto=format&fit=crop&w=1200&h=900&q=80',
    alt: 'Clean water running into open hands',
  },
];

const PROTECTIONS = [
  {
    title: 'Operators are checked before they list',
    body: 'Registration documents, a current tour operator licence, and a phone call to the contact number. A human decides — there is no automatic approval.',
  },
  {
    title: 'Every listing is reviewed separately',
    body: 'Verification covers the company. Each trip is read on its own before it publishes: itinerary against price, inclusions written plainly, images the operator has the right to use.',
  },
  {
    title: 'Reviews come from completed bookings only',
    body: 'A review must be tied to a booking that actually happened. There is no way to post one otherwise, which is why there are fewer of them and why they mean more.',
  },
  {
    title: 'Your group is private',
    body: 'Trip groups are visible only to travellers with a confirmed booking on that departure and the organizer running it. Nobody else can find or read them.',
  },
];

export default function HowItWorksPage() {
  return (
    <PublicShell>
      {/* Hero */}
      <section className="border-b border-line bg-sand/50">
        <div className="shell py-14 md:py-20">
          <Eyebrow>How it works</Eyebrow>
          <h1 className="mt-4 max-w-3xl text-h1 text-balance">
            Discover → Join → Connect → Travel → Give back
          </h1>
          <p className="mt-5 max-w-2xl text-[1.0625rem] leading-relaxed text-ink-muted">
            Enhakkore is a marketplace: independent tour operators list their trips, and travellers book
            them. What happens around that booking — the people you meet, and what your journey leaves
            behind — is the part we built the platform for.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/trips">
              Explore trips
              <Icon.arrow />
            </ButtonLink>
            <ButtonLink href="/operators" variant="secondary">
              I run trips
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="section">
        <div className="shell">
          <div className="space-y-20 md:space-y-28">
            {TRAVELLER_STEPS.map((step, index) => (
              <div
                key={step.number}
                className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                  index % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''
                }`}
              >
                <div>
                  <span className="text-[0.6875rem] font-bold tracking-[0.16em] text-acacia-600">
                    {step.number}
                  </span>
                  <h2 className="mt-3 text-h2 text-balance">{step.title}</h2>
                  <p className="mt-4 text-[1rem] leading-relaxed text-ink-soft">{step.body}</p>
                  <p className="mt-4 border-l-2 border-line pl-4 text-[0.9375rem] leading-relaxed text-ink-muted">
                    {step.detail}
                  </p>
                </div>

                <div className="media aspect-[4/3] rounded-[--radius-card]">
                  <Image
                    src={step.image}
                    alt={step.alt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="section bg-sand">
        <div className="shell">
          <SectionHead
            eyebrow="Trust"
            title="What stands behind a booking"
            description="You are handing money and several days of your life to a company you found online. This is what that rests on."
          />

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {PROTECTIONS.map((item) => (
              <Card key={item.title} className="p-6 md:p-7">
                <Icon.shield size={20} className="text-acacia-600" />
                <h3 className="mt-4 text-[1.0625rem] font-bold leading-snug tracking-tight">{item.title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">{item.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Money */}
      <section className="section">
        <div className="shell">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <Eyebrow>The money</Eyebrow>
              <h2 className="mt-3 text-h2 text-balance">Where your payment actually goes</h2>
              <div className="prose-body mt-5">
                <p>
                  The trip price goes to the operator running your trip, minus a platform commission —
                  ten percent by default, and the reason Enhakkore can exist without charging travellers a
                  booking fee.
                </p>
                <p>
                  An impact contribution is separate. It is not part of the trip price, no commission is
                  taken from it, and it goes to the project you picked rather than into a general fund.
                </p>
                <p>
                  You can see all of this broken out at checkout before you confirm anything, and again on
                  your booking afterwards.
                </p>
              </div>
            </div>

            <Card className="p-7 md:p-8">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
                Example booking
              </p>
              <dl className="mt-6 space-y-4 text-[0.9375rem]">
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-muted">Trip price</dt>
                  <dd className="font-semibold tabular-nums">TZS 450,000</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-muted">Impact contribution</dt>
                  <dd className="font-semibold tabular-nums text-clay-600">TZS 10,000</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-line pt-4">
                  <dt className="font-bold">You pay</dt>
                  <dd className="text-[1.25rem] font-bold tabular-nums">TZS 460,000</dd>
                </div>
              </dl>

              <hr className="my-7 border-line" />

              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
                Split
              </p>
              <dl className="mt-5 space-y-4 text-[0.9375rem]">
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-muted">To the operator</dt>
                  <dd className="font-semibold tabular-nums">TZS 405,000</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-muted">Enhakkore commission (10%)</dt>
                  <dd className="font-semibold tabular-nums">TZS 45,000</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-muted">To the impact project</dt>
                  <dd className="font-semibold tabular-nums text-clay-600">TZS 10,000</dd>
                </div>
              </dl>

              <p className="mt-6 text-[0.8125rem] leading-relaxed text-ink-faint">
                Illustrative figures. Commission rates are agreed per operator and shown to them in their
                dashboard.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-tight">
        <div className="shell">
          <Card className="p-8 text-center md:p-12">
            <h2 className="text-h2 text-balance">Ready when you are</h2>
            <p className="mx-auto mt-3 max-w-lg text-[0.9375rem] leading-relaxed text-ink-muted">
              Browse what is going out in the next few months, or tell us what you have in mind and we will
              find operators who run it.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/trips">Explore trips</ButtonLink>
              <ButtonLink href="/private-trips" variant="secondary">
                Request a custom trip
              </ButtonLink>
            </div>
          </Card>
        </div>
      </section>
    </PublicShell>
  );
}
