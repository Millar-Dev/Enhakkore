import type { Metadata } from 'next';
import Image from 'next/image';
import { PublicShell } from '@/components/layout/PublicShell';
import { BookingPanel } from '@/components/packages/BookingPanel';
import { CopyNumber } from '@/components/packages/CopyNumber';
import { Reveal } from '@/components/packages/Reveal';
import { Alert, Icon, SectionHead } from '@/components/ui';
import { CONTACT } from '@/content/contact';
import { NAPURU } from '@/content/napuru';
import { price } from '@/lib/format';

/**
 * Napuru Gateway — the next departure.
 *
 * Short page, because it is a one-day trip and there is not much to say that
 * is actually known. What is known is stated; what is not is listed as not yet
 * set, rather than filled in with a plausible-sounding guess.
 *
 * The booking steps describe a process a person carries out — a team member
 * checks the payment and then sends the group link by hand. The site does not
 * verify payments and does not gate the group link itself, and the page says
 * so, because claiming otherwise would be a lie about the one step where
 * someone's money is involved.
 */

export const metadata: Metadata = {
  title: `${NAPURU.title} — ${NAPURU.datesLabel}`,
  description: `${NAPURU.overview} ${price(NAPURU.price)} per person, ${NAPURU.datesLabel}.`,
};

const STEPS = [
  { title: 'Read what the package covers', body: 'Check the inclusions and the points still to be confirmed.' },
  { title: 'Send your booking request', body: 'Fill in the form so the organiser knows who you are and how to reach you.' },
  { title: 'Pay using the number below', body: 'Follow the payment instructions, then keep your transaction reference.' },
  { title: 'Send your payment confirmation', body: 'Share the reference or confirmation with the organiser on the booking contact.' },
  { title: 'Your place is confirmed', body: 'Once the team has checked the payment, they confirm your place and send you the private participant group.' },
];

export default function NapuruPage() {
  return (
    <PublicShell transparentHeader>
      {/* Hero */}
      <section className="relative flex min-h-[32rem] items-end overflow-hidden pb-14 pt-40 md:min-h-[38rem]">
        {NAPURU.cover ? (
          <Image src={NAPURU.cover.src} alt={NAPURU.cover.alt} fill priority sizes="100vw" className="object-cover" />
        ) : (
          <>
            {/* No Napuru photograph has been supplied. Rather than borrow a
                picture of somewhere else and call it Napuru, the type carries
                the hero until a real one arrives. */}
            <div aria-hidden className="absolute inset-0 bg-navy-900" />
            <div
              aria-hidden
              className="absolute inset-0 opacity-70"
              style={{
                backgroundImage:
                  'radial-gradient(110% 80% at 12% 0%, #3a2f22 0%, transparent 58%), radial-gradient(85% 70% at 92% 25%, rgba(197,164,109,0.33) 0%, transparent 62%)',
              }}
            />
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#15110c]/85 via-[#15110c]/45 to-transparent" />

        <div className="shell relative">
          <Reveal>
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-gold-300">
              Next departure · {NAPURU.datesLabel}
            </p>
            <h1 className="mt-3 max-w-3xl text-[2.75rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-white text-balance sm:text-[3.5rem]">
              {NAPURU.title}
              <span className="mt-2 block text-[1.375rem] font-semibold leading-tight tracking-[-0.02em] text-gold-300 sm:text-[1.75rem]">
                {NAPURU.subtitle}
              </span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <dl className="mt-9 flex flex-wrap gap-x-10 gap-y-5">
              {[
                { icon: <Icon.calendar size={15} />, label: 'Date', value: NAPURU.datesLabel },
                { icon: <Icon.clock size={15} />, label: 'Duration', value: NAPURU.duration },
                { icon: <Icon.pin size={15} />, label: 'Destination', value: NAPURU.destination },
                { icon: <Icon.ticket size={15} />, label: 'Price', value: `${price(NAPURU.price)} per person` },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-white/55">
                    {item.icon}
                    {item.label}
                  </dt>
                  <dd className="mt-1.5 text-[1rem] font-bold text-white">{item.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={200}>
            <a
              href="#book"
              className="mt-10 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-gold-500 px-7 py-4 text-[0.9375rem] font-bold text-navy-900 shadow-lg transition-transform duration-200 hover:-translate-y-0.5 hover:bg-gold-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-gold-300/40"
            >
              Join this trip
              <Icon.arrow />
            </a>
          </Reveal>
        </div>
      </section>

      {/* Overview, inclusions and the booking panel */}
      <section className="section">
        <div className="shell grid gap-12 lg:grid-cols-[1fr_24rem] lg:gap-16">
          <div>
            <Reveal>
              <h2 className="text-h2">The day</h2>
              <p className="mt-5 max-w-2xl text-[1.0625rem] leading-relaxed text-ink-soft">{NAPURU.overview}</p>
            </Reveal>

            <Reveal delay={80}>
              <h3 className="mt-10 text-h3">What&rsquo;s included</h3>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {NAPURU.included.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 rounded-[var(--radius-field)] border border-line bg-white p-4"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-acacia-600 text-white">
                      <Icon.check size={12} />
                    </span>
                    <span className="text-[0.9375rem] font-semibold">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-muted">
                Anything not on this list is not included in the price.
              </p>
            </Reveal>

            {NAPURU.notYetSet.length > 0 && (
              <Reveal delay={140}>
                <h3 className="mt-10 text-h3">Not yet announced</h3>
                <ul className="mt-5 space-y-2.5">
                  {NAPURU.notYetSet.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[0.9375rem] text-ink-muted">
                      <Icon.shield size={15} className="mt-0.5 shrink-0 text-warning" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-muted">
                  Ask the organiser — these will be shared with everyone travelling before the day.
                </p>
              </Reveal>
            )}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start" id="book">
            <Reveal delay={120}>
              <BookingPanel
                pkg={{
                  title: NAPURU.title,
                  subtitle: NAPURU.subtitle,
                  destination: NAPURU.destination,
                  datesLabel: NAPURU.datesLabel,
                  startDate: NAPURU.startDate,
                  endDate: NAPURU.endDate,
                  tiers: [{ id: 'standard', label: 'Per person', note: '', amount: NAPURU.price }],
                  maxTravellers: 20,
                }}
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* How booking works */}
      <section className="section bg-sand">
        <div className="shell">
          <Reveal>
            <SectionHead
              eyebrow="Booking"
              title="How to secure your place"
              description="Five steps, and a person at the end of them."
            />
          </Reveal>

          <ol className="mt-10 grid gap-5 md:grid-cols-5">
            {STEPS.map((step, index) => (
              <Reveal key={step.title} delay={index * 70}>
                <li className="h-full rounded-[var(--radius-card)] border border-line bg-white p-5">
                  <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-gold-500 text-[0.8125rem] font-bold text-navy-700">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-[0.9375rem] font-bold leading-snug tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">{step.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={240}>
            <Alert tone="info" className="mt-8">
              Sending the form or a screenshot does not confirm a place. A member of the team checks the
              payment first, and only then is your place confirmed and the private {NAPURU.group.platform}{' '}
              group shared with you. That group link is never published on this page.
            </Alert>
          </Reveal>
        </div>
      </section>

      {/* Payment */}
      <section className="section">
        <div className="shell max-w-3xl">
          <Reveal>
            <SectionHead
              eyebrow="Payment"
              title="Paying for this trip"
              description="Talk to the organiser first. Send money only once your place is agreed."
            />
          </Reveal>

          <Reveal delay={80}>
            <div className="mt-8">
              <CopyNumber kind={NAPURU.payment.label} number={NAPURU.payment.number} name="" />
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-sand p-6">
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Booking contact
              </h3>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">
                Confirm your place here, and send your payment confirmation to the same number.
              </p>
              <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                {CONTACT.phones.map((phone) => (
                  <li key={phone.dial}>
                    <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-faint">{phone.label}</p>
                    <a
                      href={`tel:${phone.dial}`}
                      className="font-mono text-[1.0625rem] font-bold tracking-[0.02em] text-navy-700 underline-offset-4 hover:underline"
                    >
                      {phone.display}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <p className="mt-5 text-[0.8125rem] leading-relaxed text-ink-muted">
              This is a collection number for this trip, not a company bank account. Enhakkore does not
              process this payment on the website, and no card details are ever taken here.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Mobile booking bar */}
      <div className="sticky bottom-0 z-30 border-t border-line bg-white/95 p-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[0.6875rem] uppercase tracking-[0.08em] text-ink-muted">
              {NAPURU.datesLabel}
            </p>
            <p className="truncate text-[1rem] font-bold leading-tight text-navy-700">{price(NAPURU.price)}</p>
          </div>
          <a
            href="#book"
            className="shrink-0 rounded-[var(--radius-pill)] bg-navy-700 px-6 py-3 text-[0.875rem] font-bold text-white"
          >
            Join this trip
          </a>
        </div>
      </div>
    </PublicShell>
  );
}
