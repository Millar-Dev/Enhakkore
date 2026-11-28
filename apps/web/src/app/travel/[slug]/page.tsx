import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TRIP_STAGE_LABELS, formatMoney } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { CopyButton, SaveButton } from '@/components/public/Actions';
import { ApplyForm } from '@/components/public/ApplyForm';
import { TripRequest } from '@/components/public/TripRequest';
import { Facts, Gallery, Prose, VideoBlock } from '@/components/public/Cards';
import { tripDates } from '@/components/public/listings';
import { SmartImage } from '@/components/public/SmartImage';
import { ShareButton, TrackView } from '@/components/public/Track';
import { SocialIcon } from '@/components/site/SocialIcon';
import { apiGet } from '@/lib/api';
import { getSite, waHref, waNumbers } from '@/lib/site';

export const revalidate = 60;

interface Trip {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string;
  description: string;
  destinationLabel: string | null;
  departureCity: string | null;
  meetingPoint: string | null;
  durationDays: number;
  durationNights: number;
  basePrice: number;
  currency: string;
  priceTiers: { label: string; note?: string; amount: number; currency: string }[];
  depositAmount?: number | null;
  heroImage: string;
  accommodation: string | null;
  transport: string | null;
  minParticipants: number | null;
  maxParticipants?: number | null;
  stage?: string;
  includes: string[];
  excludes: string[];
  toConfirm: string[];
  requirements: string[];
  paymentInstructions: string | null;
  paymentOptions: { method?: string; kind?: string; number?: string; name?: string }[];
  cancellationPolicy: string | null;
  galleryItems: { src: string; alt?: string; credit?: string; licence?: string; source?: string }[];
  videoUrl: string | null;
  isPast: boolean;
  departures: { id: string; startDate: string; endDate: string; seatsLeft: number; bookable: boolean; price: number; bookingDeadline: string | null; past: boolean; capacity: number }[];
  itinerary: { dayNumber: number; title: string; label: string | null; summary: string | null; accommodation: string | null; stops: { name: string; detail?: string; provisional?: boolean }[] }[];
}

const load = (slug: string) => apiGet<Trip>(`/public/trips/${slug}`, 60);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const trip = await load((await params).slug);
  return trip ? { title: trip.title, description: trip.summary, openGraph: { images: [{ url: trip.heroImage }] } } : { title: 'Trip' };
}

export default async function TripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [trip, { settings, paymentMethods }] = await Promise.all([load(slug), getSite()]);
  if (!trip) notFound();
  const upcoming = trip.departures.filter((departure) => !departure.past);
  const wa = waHref(settings, 'trip', trip.title);
  // Which WhatsApp number(s) take trip enquiries — Settings → Contacts → routing.
  const allNumbers = waNumbers(settings);
  const route = settings.contact.routing?.TRIP ?? 'all';
  const routed = /^\d+$/.test(route) && allNumbers[Number(route) - 1] ? [allNumbers[Number(route) - 1]!] : allNumbers;
  const tripNumbers = routed.map((number) => ({ display: number.display, digits: number.digits }));
  const tripMethods = paymentMethods.filter((method) => method.scopes.includes('TRIPS'));
  const paymentOptions = trip.paymentOptions.filter((option) => option.number);

  return (
    <PublicShell>
      <section className="relative">
        <div className="relative h-[38svh] min-h-[15rem] overflow-hidden bg-acacia-700 md:h-[66vh] md:min-h-[340px]">
          <SmartImage src={trip.heroImage} alt="" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-acacia-900/40 to-transparent md:from-acacia-900/90 md:via-acacia-900/25" />
          <a href="/travel" aria-label="Back to Travel" className="absolute left-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur md:hidden">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <div className="shell absolute inset-x-0 bottom-0 hidden pb-10 text-white md:block">
            <p className="kicker !text-clay-400">{trip.destinationLabel ?? 'Enhakkore Travel'}</p>
            <h1 className="display-xl mt-3">{trip.title}</h1>
            {trip.subtitle && <p className="mt-2 font-display text-2xl text-white/85">{trip.subtitle}</p>}
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              {trip.isPast ? (
                <span className="rounded-full bg-white/20 px-3 py-1.5 font-bold">Past trip — this journey has taken place</span>
              ) : upcoming[0] ? (
                <span className="rounded-full bg-clay-400 px-3 py-1.5 font-bold text-acacia-700">{tripDates(upcoming[0].startDate, upcoming[0].endDate)}</span>
              ) : null}
              <span className="rounded-full bg-white/15 px-3 py-1.5 font-semibold">
                {trip.durationDays} day{trip.durationDays === 1 ? '' : 's'}
                {trip.durationNights ? `, ${trip.durationNights} night${trip.durationNights === 1 ? '' : 's'}` : ''}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Phones: the essentials on a sheet over the picture, then quick links. */}
      <section className="relative -mt-6 rounded-t-[1.75rem] bg-white px-5 pb-1 pt-5 md:hidden">
        <h1 className="text-[1.6rem] font-bold leading-tight text-acacia-700">{trip.title}</h1>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-[#fff1c9] px-2.5 py-0.5 text-xs font-bold text-[#7a5a14]">{trip.isPast ? 'Past trip' : 'Group trip'}</span>
          {trip.stage && <span className="rounded-full bg-[#fdf4e3] px-2.5 py-0.5 text-xs font-bold text-warning">{TRIP_STAGE_LABELS[trip.stage] ?? trip.stage}</span>}
        </div>
        <ul className="mt-3 space-y-1.5 text-[0.9375rem] text-ink-soft">
          {upcoming[0] && <li className="flex gap-2"><span aria-hidden>📅</span>{tripDates(upcoming[0].startDate, upcoming[0].endDate)} <span className="text-ink-muted">({trip.durationDays} days{trip.durationNights ? ` / ${trip.durationNights} nights` : ''})</span></li>}
          {trip.destinationLabel && <li className="flex gap-2"><span aria-hidden>📍</span>{trip.destinationLabel}</li>}
          {upcoming[0] && <li className="flex gap-2"><span aria-hidden>👥</span>{upcoming[0].seatsLeft} of {upcoming[0].capacity} places left</li>}
          {!trip.isPast && <li className="flex gap-2 text-lg font-bold text-ink"><span aria-hidden>💳</span>{formatMoney({ amount: upcoming[0]?.price ?? trip.basePrice, currency: trip.currency })} <span className="self-end text-xs font-normal text-ink-muted">/ person</span></li>}
        </ul>
        <nav aria-label="On this page" className="no-scrollbar -mx-5 mt-4 flex gap-1 overflow-x-auto border-b border-line px-5">
          {[['#overview', 'Overview'], ['#itinerary', 'Itinerary'], ['#package', 'Package'], ['#group', 'Group']].map(([href, label]) => (
            <a key={href} href={href} className="inline-flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-sm font-semibold text-ink-soft first:border-clay-400 first:text-acacia-700">{label}</a>
          ))}
        </nav>
      </section>

      <section className="shell grid gap-10 py-6 md:py-14 lg:grid-cols-[1.5fr_1fr]">
        <div id="overview" className="scroll-mt-20 space-y-10">
          <div className="flex flex-wrap items-center gap-2">
            <SaveButton itemType="TRIP" itemId={trip.id} />
            <ShareButton subjectType="TRIP" subjectId={trip.id} title={trip.title} />
            <TrackView subjectType="TRIP" subjectId={trip.id} />
            {trip.stage && (
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${trip.stage === 'TRIP_CONFIRMED' || trip.stage === 'DEPARTURE_READY' ? 'bg-safari-50 text-safari-700' : trip.stage === 'CANCELLED' ? 'bg-danger-soft text-danger' : 'bg-[#fdf4e3] text-warning'}`}>
                {TRIP_STAGE_LABELS[trip.stage] ?? trip.stage}
              </span>
            )}
          </div>
          <p className="font-display text-[1.4rem] leading-snug text-acacia-700 md:text-[1.65rem]">{trip.summary}</p>
          {/* The description often opens with the summary; show only what it adds. */}
          <Prose text={trip.description.startsWith(trip.summary) ? trip.description.slice(trip.summary.length).trim() : trip.description} />

          <Facts items={[
            { label: 'Departs from', value: trip.departureCity },
            { label: 'Meeting point', value: trip.meetingPoint },
            { label: 'Group', value: upcoming[0] ? `${upcoming[0].capacity} places` : null },
            { label: 'Minimum', value: trip.minParticipants ? `${trip.minParticipants} travellers` : null },
            { label: 'Maximum', value: trip.maxParticipants ? `${trip.maxParticipants} travellers` : null },
            { label: 'Accommodation', value: trip.accommodation },
            { label: 'Transport', value: trip.transport },
          ]} />

          {trip.itinerary.length > 0 && (
            <div id="itinerary" className="scroll-mt-20">
              <p className="kicker">Day by day</p>
              <h2 className="display-md mt-3 text-acacia-700">Itinerary</h2>
              <ol className="mt-6 space-y-5">
                {trip.itinerary.map((day) => (
                  <li key={day.dayNumber} className="rounded-[1.1rem] border border-line bg-white p-5">
                    <p className="text-[0.75rem] font-bold uppercase tracking-[0.14em] text-clay-600">Day {day.dayNumber}{day.label ? ` · ${day.label}` : ''}</p>
                    <p className="mt-1 font-display text-2xl text-acacia-700">{day.title}</p>
                    {day.summary && <p className="mt-1 text-ink-muted">{day.summary}</p>}
                    {day.stops.length > 0 && (
                      <ul className="mt-4 space-y-3 border-l-2 border-clay-100 pl-4">
                        {day.stops.map((stop) => (
                          <li key={stop.name}>
                            <p className="font-semibold text-ink">
                              {stop.name}
                              {stop.provisional && <span className="ml-2 rounded-full bg-[#fdf4e3] px-2 py-0.5 text-[0.6875rem] font-bold text-warning">To be confirmed</span>}
                            </p>
                            {stop.detail && <p className="text-sm text-ink-muted">{stop.detail}</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {day.accommodation && <p className="mt-3 text-sm text-ink-soft">Overnight: {day.accommodation}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div id="package" className="grid scroll-mt-20 gap-6 sm:grid-cols-2">
            {trip.includes.length > 0 && (
              <div className="rounded-[1.1rem] bg-[color:var(--color-cream)] p-5">
                <p className="font-display text-xl text-acacia-700">Included</p>
                <ul className="mt-3 space-y-2 text-[0.9375rem] text-ink-soft">{trip.includes.map((line) => <li key={line} className="flex gap-2"><span className="text-safari-500">✓</span>{line}</li>)}</ul>
              </div>
            )}
            <div className="rounded-[1.1rem] border border-line p-5">
              <p className="font-display text-xl text-acacia-700">Not included</p>
              {trip.excludes.length > 0 ? (
                <ul className="mt-3 space-y-2 text-[0.9375rem] text-ink-soft">{trip.excludes.map((line) => <li key={line}>— {line}</li>)}</ul>
              ) : (
                <p className="mt-3 text-[0.9375rem] text-ink-muted">Not listed yet. Anything not under “Included” is not covered — ask the team if you are unsure.</p>
              )}
            </div>
          </div>
          {trip.toConfirm.length > 0 && (
            <div className="rounded-[1.1rem] border border-[#f2e2c0] bg-[#fdf8ec] p-5">
              <p className="font-bold text-warning">Still being confirmed</p>
              <ul className="mt-2 space-y-1 text-[0.9375rem] text-ink-soft">{trip.toConfirm.map((line) => <li key={line}>{line}</li>)}</ul>
            </div>
          )}
          {trip.requirements.length > 0 && (
            <div><p className="font-display text-xl text-acacia-700">What to bring</p><ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">{trip.requirements.map((line) => <li key={line}>{line}</li>)}</ul></div>
          )}
          <VideoBlock url={trip.videoUrl} />
          <Gallery images={trip.galleryItems} />
          {trip.cancellationPolicy && (
            <div><p className="font-display text-xl text-acacia-700">Cancellation & refunds</p><Prose text={trip.cancellationPolicy} className="mt-2 text-[0.9375rem]" /></div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[1.2rem] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
            {!trip.isPast && (
              <div className="mb-4">
                <p className="text-sm text-ink-muted">From</p>
                <p className="font-display text-3xl text-acacia-700">{formatMoney({ amount: upcoming[0]?.price ?? trip.basePrice, currency: trip.currency })}</p>
                {trip.priceTiers.filter((tier) => tier.currency !== trip.currency).map((tier) => (
                  <p key={tier.label} className="text-sm text-ink-soft">{tier.label}: <strong>{formatMoney({ amount: tier.amount, currency: tier.currency })}</strong></p>
                ))}
                <p className="mt-1 text-xs text-ink-muted">Per person. Each price is set separately — not a currency conversion.</p>
                {trip.depositAmount ? (
                  <div className="mt-3 rounded-xl border border-clay-400/50 bg-[#fff8e6] p-3 text-sm">
                    <p className="font-semibold text-ink">Booking deposit: {formatMoney({ amount: trip.depositAmount, currency: trip.currency })} <span className="font-normal text-ink-muted">/ person</span></p>
                    <p className="text-ink-soft">Deducted from the total price. Balance after the deposit: <strong>{formatMoney({ amount: Math.max(0, (upcoming[0]?.price ?? trip.basePrice) - trip.depositAmount), currency: trip.currency })}</strong></p>
                  </div>
                ) : null}
              </div>
            )}
            {trip.isPast ? (
              <>
                <p className="text-sm text-ink-soft">This trip has taken place. Message us to hear about the next one.</p>
                <a href={wa} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1f9d55] text-sm font-bold text-white">
                  <SocialIcon platform="whatsapp" size={18} /> Ask on WhatsApp
                </a>
              </>
            ) : (
              <div id="request" className="scroll-mt-20">
                <TripRequest
                  tripId={trip.id}
                  tripTitle={trip.title}
                  dates={upcoming.map((departure) => ({ value: departure.startDate, label: tripDates(departure.startDate, departure.endDate) }))}
                  whatsapp={tripNumbers}
                />
              </div>
            )}
          </div>
          {!trip.isPast && (
            <details className="rounded-[1.2rem] border border-line bg-white p-5" open={false}>
              <summary className="cursor-pointer font-display text-xl text-acacia-700">Ready to go? Apply for a place</summary>
              <p className="mt-2 text-sm text-ink-soft">Members apply for a place on a departure. Once the team confirms your place and payment, you join the trip’s private group.</p>
              <div className="mt-4"><ApplyForm slug={trip.slug} title={trip.title} departures={trip.departures} currency={trip.currency} tiers={trip.priceTiers} deposit={trip.depositAmount ?? null} /></div>
            </details>
          )}
          <div id="group" className="scroll-mt-20 rounded-[1.2rem] border border-acacia-600/20 bg-acacia-700 p-5 text-white">
            <p className="font-display text-xl">🔒 Private trip group</p>
            <p className="mt-1 text-sm text-white/80">Confirmed participants get access to this departure’s private group chat — live messages, the itinerary, documents, photos and announcements from the trip leader. Sign in with your member account to open it once your place is confirmed. Creating an account alone does not give access.</p>
            <a href="/account/groups" className="mt-3 inline-flex h-9 items-center rounded-full bg-clay-400 px-4 text-sm font-bold text-acacia-700">My trip groups →</a>
          </div>

          {!trip.isPast && (paymentOptions.length > 0 || tripMethods.length > 0 || trip.paymentInstructions) && (
            <div className="rounded-[1.2rem] border border-line bg-white p-5 text-sm">
              <p className="font-display text-xl text-acacia-700">How payment works</p>
              <p className="mt-2 leading-relaxed text-ink-soft">{trip.paymentInstructions ?? 'Apply first. Once your application is approved, pay using the details below and send your confirmation on WhatsApp.'}</p>
              <div className="mt-3 grid gap-2">
                {paymentOptions.map((option) => (
                  <div key={option.number} className="rounded-xl bg-[color:var(--color-cream)] p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-clay-600">{[option.method, option.kind].filter(Boolean).join(' · ') || 'Payment number'}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-base font-bold text-acacia-700">{option.number} <CopyButton value={String(option.number)} /></p>
                    {option.name && <p className="text-ink-soft">Name: {option.name}</p>}
                  </div>
                ))}
                {paymentOptions.length === 0 && tripMethods.map((method) => (
                  <div key={method.id} className="rounded-xl bg-[color:var(--color-cream)] p-3">
                    <p className="font-bold text-acacia-700">{method.name}</p>
                    {method.accountName && <p>Name: {method.accountName}</p>}
                    {method.accountNumber && <p className="flex items-center gap-2 font-mono font-bold">{method.accountNumber} <CopyButton value={method.accountNumber} /></p>}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink-muted">Confirm availability with us before sending money. A WhatsApp message is an enquiry, not a confirmed booking.</p>
            </div>
          )}
        </aside>
      </section>

      {/* Phones: the two actions always within reach. */}
      <div className="h-24 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-line bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
        {!trip.isPast && <a href="#request" className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-acacia-700 text-sm font-bold text-white">Request this trip</a>}
        <a href={wa} target="_blank" rel="noreferrer noopener" className={`inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#1f9d55] px-5 text-sm font-bold text-white ${trip.isPast ? 'flex-1' : ''}`}>
          <SocialIcon platform="whatsapp" size={18} /> WhatsApp
        </a>
      </div>
    </PublicShell>
  );
}
