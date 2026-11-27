import type { Metadata } from 'next';
import Link from 'next/link';
import { DemoNotice } from '@/components/public/DemoNotice';
import { notFound } from 'next/navigation';
import { INFO_SOURCE_LABELS } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { EnquiryForm, ReportButton, SaveButton } from '@/components/public/Actions';
import { Facts, Gallery, Prose, VideoBlock } from '@/components/public/Cards';
import { ReviewForm } from '@/components/public/ReviewForm';
import { SmartImage } from '@/components/public/SmartImage';
import { SocialIcon } from '@/components/site/SocialIcon';
import { HotelEnquiryForm, RestaurantReservationForm } from '@/components/public/Reservations';
import { ShareButton, TrackView } from '@/components/public/Track';
import { apiGet } from '@/lib/api';
import { placeLabel, type Listing } from '@/lib/public';
import { getSite, waHref } from '@/lib/site';

export const revalidate = 60;

interface PlaceResponse {
  place: Listing;
  rating: { average: number; count: number } | null;
  reviews: { id: string; rating: number; body: string; createdAt: string; author: { name: string; country: string | null } }[];
  deals: Listing[];
}

const load = (slug: string) => apiGet<PlaceResponse>(`/public/places/${slug}`, 60);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await load((await params).slug);
  return data ? { title: String(data.place.name), description: data.place.summary ?? undefined } : { title: 'Place' };
}

const SOURCE_TONE: Record<string, string> = {
  VERIFIED: 'bg-safari-50 text-safari-700 ring-safari-100',
  BUSINESS_SUBMITTED: 'bg-clay-50 text-clay-700 ring-clay-100',
  UNVERIFIED: 'bg-sand text-ink-muted ring-line',
};

export default async function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [data, { settings }] = await Promise.all([load(slug), getSite()]);
  if (!data) notFound();
  const place = data.place;
  const hours = (place.openingHours as { days: string; hours: string }[]) ?? [];
  const socials = (place.socials as { label: string; url: string }[]) ?? [];
  const source = String(place.infoSource);
  const enquiryType = place.enquiryKind === 'ROOM' ? 'ROOM' : place.enquiryKind === 'TABLE' ? 'TABLE' : 'PLACE';
  const verifiedWhatsapp = !!place.whatsapp && source === 'VERIFIED';
  const roomTypes = ((place.roomTypes as string[] | undefined) ?? []).filter(Boolean);
  const mapLink = place.latitude && place.longitude ? `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}` : place.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.address}`)}` : null;

  return (
    <PublicShell>
      <section className="relative">
        <div className="relative h-[36svh] min-h-[14rem] w-full overflow-hidden bg-acacia-600 md:h-[52vh] md:min-h-[280px]">
          {place.coverImage && <SmartImage src={place.coverImage} alt="" fill priority sizes="100vw" className="object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-acacia-900/30 to-transparent md:from-acacia-900/80 md:via-acacia-900/10" />
          <Link href="/explore" aria-label="Back to Explore" className="absolute left-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur md:hidden">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
          </Link>
          <div className="shell absolute inset-x-0 bottom-0 hidden pb-8 text-white md:block">
            <Link href={`/explore?category=${place.category?.slug ?? ''}`} className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-clay-400">
              {place.category?.icon} {place.category?.name}
            </Link>
            <h1 className="display-lg mt-2">{String(place.name)}</h1>
            <p className="mt-2 text-white/80">{[place.area as string, placeLabel(place)].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
      </section>

      {/* Phones: name and essentials on a sheet over the picture, then quick links. */}
      <section className="relative -mt-6 rounded-t-[1.75rem] bg-white px-5 pb-1 pt-5 md:hidden">
        <h1 className="text-[1.5rem] font-bold leading-tight text-acacia-700">{String(place.name)}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {data.rating && <span className="font-bold text-ink">★ {data.rating.average} <span className="font-normal text-ink-muted">({data.rating.count})</span></span>}
          <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ring-1 ${SOURCE_TONE[source] ?? SOURCE_TONE.UNVERIFIED}`}>{INFO_SOURCE_LABELS[source]}</span>
        </p>
        <p className="mt-1.5 text-sm text-ink-muted">📍 {[place.area as string, placeLabel(place)].filter(Boolean).join(' · ')}</p>
        <nav aria-label="On this page" className="no-scrollbar -mx-5 mt-3 flex gap-1 overflow-x-auto border-b border-line px-5">
          {[['#overview', 'Overview'], ...(roomTypes.length ? [['#book', 'Rooms']] : []), ['#facilities', 'Facilities'], ['#location', 'Location']].map(([href, label]) => (
            <a key={href} href={href} className="inline-flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-sm font-semibold text-ink-soft first:border-clay-400 first:text-acacia-700">{label}</a>
          ))}
        </nav>
      </section>

      <section className="shell grid gap-10 py-6 md:py-10 lg:grid-cols-[1.45fr_1fr]">
        <div id="overview" className="scroll-mt-20 space-y-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${SOURCE_TONE[source] ?? SOURCE_TONE.UNVERIFIED}`}>
              {INFO_SOURCE_LABELS[source]}
              {place.lastVerifiedAt && source === 'VERIFIED' ? ` · ${new Date(String(place.lastVerifiedAt)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : ''}
            </span>
            {place.sponsored ? <span className="rounded-full bg-clay-400 px-3 py-1.5 text-xs font-bold text-acacia-700">Sponsored</span> : null}
            {place.hiddenGem ? <span className="rounded-full bg-acacia-600 px-3 py-1.5 text-xs font-bold text-white">Hidden gem</span> : null}
            {data.rating && (
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-acacia-700 ring-1 ring-line">
                ★ {data.rating.average} · {data.rating.count} member review{data.rating.count === 1 ? '' : 's'}
              </span>
            )}
            <SaveButton itemType="PLACE" itemId={place.id} />
            <ShareButton subjectType="PLACE" subjectId={place.id} title={String(place.name)} />
            <TrackView subjectType="PLACE" subjectId={place.id} />
          </div>
          {place.isDemo ? <DemoNotice what="listing" /> : null}
          {source !== 'VERIFIED' && (
            <p className="rounded-xl bg-[color:var(--color-cream)] p-4 text-sm leading-relaxed text-ink-soft">
              {source === 'BUSINESS_SUBMITTED'
                ? 'These details were provided by the business and have not been checked by Enhakkore. Confirm prices, opening hours and availability directly.'
                : 'These details have not yet been verified. Confirm prices, opening hours and availability directly with the place before you go.'}
            </p>
          )}
          {place.summary && <p className="font-display text-2xl leading-snug text-acacia-700">{place.summary}</p>}
          <Prose text={place.description} />
          <div id="facilities" className="scroll-mt-20" />
          <Facts
            items={[
              { label: 'Price range', value: place.priceRange as string },
              { label: 'Address', value: place.address as string },
              { label: 'Facilities', value: ((place.facilities as string[]) ?? []).join(', ') || null },
              { label: 'Amenities', value: ((place.amenities as string[]) ?? []).join(', ') || null },
            ]}
          />
          {hours.length > 0 && (
            <div>
              <p className="font-display text-xl text-acacia-700">Opening hours</p>
              <dl className="mt-3 divide-y divide-line rounded-xl border border-line bg-white">
                {hours.map((row) => (
                  <div key={row.days} className="flex justify-between px-4 py-2.5 text-sm">
                    <dt className="text-ink-muted">{row.days}</dt>
                    <dd className="font-semibold text-ink">{row.hours}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {place.availabilityNote ? (
            <p className="rounded-xl border border-safari-100 bg-safari-50 p-4 text-sm font-semibold text-safari-700">Availability (verified): {String(place.availabilityNote)}</p>
          ) : null}
          {place.menu || place.menuUrl ? (
            <div>
              <p className="font-display text-xl text-acacia-700">Menu</p>
              {place.menu ? <Prose text={String(place.menu)} className="mt-2 text-sm" /> : null}
              {place.menuUrl ? <a href={String(place.menuUrl)} target="_blank" rel="noreferrer noopener" className="mt-2 inline-block font-semibold text-acacia-600 underline">Open the menu ↗</a> : null}
            </div>
          ) : null}
          {place.offers ? (
            <div className="rounded-xl border border-clay-100 bg-clay-50 p-4">
              <p className="font-bold text-clay-700">Current offer</p>
              <Prose text={String(place.offers)} className="mt-1 text-sm" />
            </div>
          ) : null}
          {data.deals.map((deal) => (
            <div key={deal.id} className="rounded-xl border border-clay-100 bg-clay-50 p-4">
              <p className="font-bold text-clay-700">{String(deal.title)}</p>
              <Prose text={deal.description} className="mt-1 text-sm" />
            </div>
          ))}
          <div id="location" className="scroll-mt-20" />
          {place.latitude && place.longitude ? (
            <div className="overflow-hidden rounded-[1.1rem] border border-line">
              <iframe
                title={`Map: ${String(place.name)}`}
                loading="lazy"
                className="h-72 w-full"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(place.longitude) - 0.01}%2C${Number(place.latitude) - 0.006}%2C${Number(place.longitude) + 0.01}%2C${Number(place.latitude) + 0.006}&layer=mapnik&marker=${place.latitude}%2C${place.longitude}`}
              />
            </div>
          ) : null}
          <VideoBlock url={place.videoUrl} />
          <Gallery images={(place.gallery ?? []).map((src) => ({ src }))} />

          <div>
            <p className="font-display text-2xl text-acacia-700">Member reviews</p>
            {data.reviews.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No reviews yet. Reviews come only from Enhakkore members and are checked before they appear.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {data.reviews.map((review) => (
                  <li key={review.id} className="rounded-xl border border-line bg-white p-4">
                    <p className="text-sm font-bold text-acacia-700">{'★'.repeat(review.rating)}<span className="text-line-strong">{'★'.repeat(5 - review.rating)}</span></p>
                    <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{review.body}</p>
                    <p className="mt-2 text-xs text-ink-muted">{review.author.name}{review.author.country ? `, ${review.author.country}` : ''} · {new Date(review.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <ReviewForm slug={slug} />
            </div>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[1.2rem] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-clay-600">How to book</p>
            <ul className="mt-2 grid gap-1.5 text-sm">
              <li className={place.bookingMode === 'ENQUIRY' ? 'text-ink' : 'text-ink-muted line-through'}>① Send an enquiry through Enhakkore</li>
              <li className={verifiedWhatsapp ? 'text-ink' : 'text-ink-muted line-through'}>② Contact the business on its verified WhatsApp</li>
              <li className={place.bookingUrl ? 'text-ink' : 'text-ink-muted line-through'}>③ Use its own reservation link</li>
            </ul>
            <div id="book" className="mt-4 scroll-mt-20">
              {place.bookingMode === 'ENQUIRY' && enquiryType === 'ROOM' && (
                <HotelEnquiryForm placeId={place.id} placeName={String(place.name)} roomTypes={roomTypes} whatsappHref={waHref(settings, 'place', String(place.name))} />
              )}
              {place.bookingMode === 'ENQUIRY' && enquiryType === 'TABLE' && (
                <RestaurantReservationForm placeId={place.id} placeName={String(place.name)} whatsappHref={waHref(settings, 'place', String(place.name))} />
              )}
              {place.bookingMode === 'ENQUIRY' && enquiryType === 'PLACE' && (
                <EnquiryForm type="PLACE" subjectType="PLACE" subjectId={place.id} subjectTitle={String(place.name)} heading="Ask about this place" whatsappHref={waHref(settings, 'place', String(place.name))} />
              )}
            </div>
            {enquiryType === 'ROOM' && place.bookingMode === 'ENQUIRY' && (
              <p className="mt-3 text-xs leading-relaxed text-ink-muted">Live room availability is not connected. Availability and prices are confirmed with the property.</p>
            )}
            {verifiedWhatsapp && (
              <a href={`https://wa.me/${String(place.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#1f9d55] text-sm font-bold text-[#1f9d55]">
                <SocialIcon platform="whatsapp" size={18} /> WhatsApp the business (verified)
              </a>
            )}
            {place.bookingUrl ? (
              <a href={String(place.bookingUrl)} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full bg-acacia-600 text-sm font-bold text-white">
                Reserve on their website ↗
              </a>
            ) : null}
            <a href={waHref(settings, 'place', String(place.name))} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1f9d55] text-sm font-bold text-white">
              <SocialIcon platform="whatsapp" size={18} /> Ask Enhakkore on WhatsApp
            </a>
          </div>
          <div className="rounded-[1.2rem] border border-line bg-white p-5 text-sm">
            <p className="font-bold text-acacia-700">Contact the place</p>
            <div className="mt-3 grid gap-2">
              {place.phone ? <a className="font-semibold text-acacia-600" href={`tel:${String(place.phone).replace(/\s/g, '')}`}>{String(place.phone)}</a> : null}
              {place.whatsapp ? <a className="font-semibold text-acacia-600" target="_blank" rel="noreferrer noopener" href={`https://wa.me/${String(place.whatsapp).replace(/\D/g, '')}`}>WhatsApp {String(place.whatsapp)}</a> : null}
              {place.email ? <a className="font-semibold text-acacia-600" href={`mailto:${place.email}`}>{String(place.email)}</a> : null}
              {place.website ? <a className="font-semibold text-acacia-600" target="_blank" rel="noreferrer noopener" href={String(place.website)}>Website</a> : null}
              {socials.map((link) => (
                <a key={link.url} className="font-semibold text-acacia-600" target="_blank" rel="noreferrer noopener" href={link.url}>{link.label}</a>
              ))}
              {mapLink && <a className="font-semibold text-acacia-600" target="_blank" rel="noreferrer noopener" href={mapLink}>Open in Google Maps</a>}
              {!place.phone && !place.whatsapp && !place.email && !place.website && socials.length === 0 && <p className="text-ink-muted">No direct contact details listed — message Enhakkore and we will help.</p>}
            </div>
            <div className="mt-4"><ReportButton targetType="PLACE" targetId={place.id} /></div>
          </div>
        </aside>
      </section>

      {/* Phones: call, WhatsApp and enquire always within reach. */}
      <div className="h-24 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-line bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
        {place.phone ? (
          <a href={`tel:${String(place.phone).replace(/\s/g, '')}`} className="flex h-12 w-14 shrink-0 flex-col items-center justify-center text-[0.6875rem] font-semibold text-acacia-700">
            <span aria-hidden className="text-lg leading-none">📞</span>Call
          </a>
        ) : null}
        <a href={verifiedWhatsapp ? `https://wa.me/${String(place.whatsapp).replace(/\D/g, '')}` : waHref(settings, 'place', String(place.name))} target="_blank" rel="noreferrer noopener" className="flex h-12 w-16 shrink-0 flex-col items-center justify-center text-[0.6875rem] font-semibold text-[#1f9d55]">
          <SocialIcon platform="whatsapp" size={20} />WhatsApp
        </a>
        <a href={place.bookingMode === 'ENQUIRY' ? '#book' : place.bookingUrl ? String(place.bookingUrl) : '#book'} className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-clay-400 text-sm font-bold text-acacia-700">
          {enquiryType === 'ROOM' ? 'Enquire / book' : enquiryType === 'TABLE' ? 'Reserve a table' : 'Enquire'}
        </a>
      </div>
    </PublicShell>
  );
}
