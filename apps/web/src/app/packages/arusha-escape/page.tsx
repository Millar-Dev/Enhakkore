import type { Metadata } from 'next';
import Image from 'next/image';
import { PublicShell } from '@/components/layout/PublicShell';
import { PartnershipLockup } from '@/components/brand/Partner';
import { ItineraryTabs } from '@/components/packages/ItineraryTabs';
import { PackageEnquiry } from '@/components/packages/PackageEnquiry';
import { CopyNumber } from '@/components/packages/CopyNumber';
import { Reveal } from '@/components/packages/Reveal';
import { Alert, Card, Icon, SectionHead } from '@/components/ui';
import { ARUSHA } from '@/content/arusha';
import { price } from '@/lib/format';

/**
 * Arusha Escape — the package page.
 *
 * Everything shown here comes from src/content/arusha.ts. The page is a layout
 * for that content and holds no trip facts of its own, so updating the trip
 * never means editing this file.
 *
 * Two rules run through it. Nothing is presented as settled unless the brief
 * said it was — budgeted costs say "budgeted", and the unconfirmed
 * arrangements get a section of their own rather than a footnote. And the two
 * prices are never implied to be conversions of each other.
 */

export const metadata: Metadata = {
  title: `${ARUSHA.title} — ${ARUSHA.subtitle}`,
  description: `${ARUSHA.duration} from ${ARUSHA.departureCity} to ${ARUSHA.destination}, ${ARUSHA.datesLabel}. Waterfalls, Maasai market, Shanga and the Chemka hot springs — run by Enhakkore Travel & Impact with WSC.`,
};

export default function ArushaPackagePage() {
  return (
    <PublicShell transparentHeader>
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative flex min-h-[38rem] items-end overflow-hidden pb-14 pt-40 md:min-h-[44rem]">
        {/* The campaign photograph belongs here. Until it is supplied, a deep
            navy field carries the type — which is honest, and still looks
            deliberate, rather than borrowing a stock photograph of somewhere
            this trip does not go. Drop the image in and this becomes an
            <Image fill /> with the same gradient over it. */}
        <div aria-hidden className="absolute inset-0 bg-navy-900" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(120% 80% at 15% 0%, #1b2a5c 0%, transparent 55%), radial-gradient(90% 70% at 90% 20%, rgba(199,154,63,0.35) 0%, transparent 60%), radial-gradient(130% 90% at 50% 110%, #0d1733 20%, transparent 70%)',
          }}
        />

        <div className="shell relative">
          <Reveal>
            <PartnershipLockup size="sm" />
          </Reveal>

          <Reveal delay={80}>
            <p className="mt-7 text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-gold-300">
              {ARUSHA.departureCity.split(',')[0]} → {ARUSHA.destination.split(',')[0]}
            </p>
            <h1 className="mt-3 max-w-3xl text-[2.75rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-white text-balance sm:text-[3.5rem] md:text-[4rem]">
              {ARUSHA.title}
              <span className="mt-2 block text-[1.5rem] font-semibold leading-tight tracking-[-0.02em] text-gold-300 sm:text-[1.875rem]">
                {ARUSHA.subtitle}
              </span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <dl className="mt-9 flex flex-wrap gap-x-10 gap-y-5">
              {[
                { icon: <Icon.calendar size={15} />, label: 'Dates', value: ARUSHA.datesLabel },
                { icon: <Icon.clock size={15} />, label: 'Duration', value: ARUSHA.duration },
                { icon: <Icon.pin size={15} />, label: 'Destination', value: ARUSHA.destination },
                { icon: <Icon.users size={15} />, label: 'Group', value: `Planned for ${ARUSHA.groupSize}` },
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

          <Reveal delay={240}>
            <a
              href="#enquire"
              className="mt-10 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-gold-500 px-7 py-4 text-[0.9375rem] font-bold text-navy-900 shadow-lg transition-transform duration-200 hover:-translate-y-0.5 hover:bg-gold-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-gold-300/40"
            >
              Book this trip
              <Icon.arrow />
            </a>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Overview + price, side by side                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="section">
        <div className="shell grid gap-12 lg:grid-cols-[1fr_24rem] lg:gap-16">
          <div>
            <Reveal>
              <h2 className="text-h2">The weekend</h2>
              <p className="mt-5 max-w-2xl text-[1.0625rem] leading-relaxed text-ink-soft">
                {ARUSHA.overview}
              </p>
            </Reveal>

            <Reveal delay={80}>
              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  { title: 'Waterfalls & hiking', body: 'Napuru Waterfalls and a nature walk below Mount Meru.' },
                  { title: 'Culture & craft', body: 'Cultural Heritage Centre, the Maasai Market and Shanga.' },
                  { title: 'Hot springs', body: 'Chemka / Kikuletwa — clear, warm water and no hurry.' },
                ].map((item) => (
                  <Card key={item.title} className="p-5">
                    <h3 className="text-[0.9375rem] font-bold tracking-tight">{item.title}</h3>
                    <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">{item.body}</p>
                  </Card>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Sticky on desktop: the price and the form follow you down the page. */}
          <div className="lg:sticky lg:top-24 lg:self-start" id="enquire">
            <Reveal delay={120}>
              <PackageEnquiry />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Itinerary                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="section bg-sand">
        <div className="shell">
          <Reveal>
            <SectionHead
              eyebrow="Day by day"
              title="Three days, Friday to Sunday"
              description="The route as planned. Anything still being confirmed is marked as such."
            />
          </Reveal>
          <Reveal delay={80} className="mt-10">
            <ItineraryTabs />
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Included / to confirm                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="section">
        <div className="shell grid gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal>
            <h2 className="text-h3">What the price covers</h2>
            <ul className="mt-6 space-y-4">
              {ARUSHA.included.map((item) => (
                <li key={item.title} className="flex gap-3.5">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-acacia-600 text-white">
                    <Icon.check size={12} />
                  </span>
                  <div>
                    <p className="text-[0.9375rem] font-semibold">{item.title}</p>
                    <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-muted">{item.detail}</p>
                    {'budget' in item && item.budget && (
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-warning">
                        {item.budget} — a planned figure, not a final quote
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={80}>
            <h2 className="text-h3">Still being confirmed</h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
              Listed here rather than left out. Ask the organiser before you plan around any of it.
            </p>
            <ul className="mt-6 space-y-4">
              {ARUSHA.toConfirm.map((item) => (
                <li key={item.title} className="rounded-[var(--radius-field)] border border-line bg-white p-4">
                  <p className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                    <Icon.shield size={14} className="text-warning" />
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-muted">{item.detail}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Gallery                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="section bg-sand">
        <div className="shell">
          <Reveal>
            <SectionHead eyebrow="The region" title="Northern Tanzania" />
          </Reveal>
          <Reveal delay={80}>
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {ARUSHA.gallery.map((photo, index) => (
                <div
                  key={photo.src}
                  className="group relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-sand-deep"
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    priority={index === 0}
                  />
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-5 text-[0.8125rem] leading-relaxed text-ink-muted">
              Illustrative photography of the wider region — not photographs of this route or of these
              venues. Pictures from the trip will replace them.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Payment                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="section">
        <div className="shell max-w-3xl">
          <Reveal>
            <SectionHead
              eyebrow="Payment"
              title={`Paying by ${ARUSHA.payment.method}`}
              description="Talk to the organiser first. Send money only once a place is confirmed."
            />
          </Reveal>

          <Reveal delay={80}>
            <Alert tone="info" className="mt-8">
              {ARUSHA.payment.instruction}
            </Alert>
          </Reveal>

          <Reveal delay={140}>
            <div className="mt-6 space-y-3">
              {ARUSHA.payment.options.map((option) => (
                <CopyNumber key={option.number} kind={option.kind} number={option.number} name={option.name} />
              ))}
            </div>
          </Reveal>

          <Reveal delay={200}>
            <p className="mt-5 text-[0.8125rem] leading-relaxed text-ink-muted">
              These are the trip organiser&rsquo;s collection details for this group, not a company bank
              account. Enhakkore does not process this payment on the website, and no card details are ever
              taken here.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Partnership                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="section bg-navy-900 text-white">
        <div className="shell max-w-4xl text-center">
          <Reveal>
            <div className="flex justify-center">
              <PartnershipLockup size="md" />
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-9 text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] text-balance md:text-[2.25rem]">
              A travel company and a children&rsquo;s charity, running this trip together
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <div className="mx-auto mt-7 grid max-w-2xl gap-6 text-left sm:grid-cols-2">
              <div className="rounded-[var(--radius-card)] bg-white/5 p-5">
                <h3 className="text-[0.9375rem] font-bold text-gold-300">Enhakkore Travel &amp; Impact</h3>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-white/75">
                  Plans and runs the travel: the route, the transport, the itinerary and the group.
                </p>
              </div>
              <div className="rounded-[var(--radius-card)] bg-white/5 p-5">
                <h3 className="text-[0.9375rem] font-bold text-gold-300">WSC — We Save Children</h3>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-white/75">
                  Our social-impact partner, working so that no child grows up in poverty.
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <p className="mx-auto mt-7 max-w-xl text-[0.875rem] leading-relaxed text-white/60">
              This is a travel experience delivered in partnership with a social-impact organisation. It is
              not a donation campaign, and WSC does not operate the travel.
            </p>
          </Reveal>
        </div>
      </section>

      {/* A way back to the form from the bottom of a long page, on phones. */}
      <div className="sticky bottom-0 z-30 border-t border-line bg-white/95 p-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[0.6875rem] uppercase tracking-[0.08em] text-ink-muted">From</p>
            <p className="truncate text-[1rem] font-bold leading-tight text-navy-700">
              {price(ARUSHA.pricing.resident.amount)}
            </p>
          </div>
          <a
            href="#enquire"
            className="shrink-0 rounded-[var(--radius-pill)] bg-navy-700 px-6 py-3 text-[0.875rem] font-bold text-white"
          >
            Book this trip
          </a>
        </div>
      </div>
    </PublicShell>
  );
}
