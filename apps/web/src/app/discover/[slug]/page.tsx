import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { INFO_SOURCE_LABELS } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { EnquiryForm, ReportButton, SaveButton } from '@/components/public/Actions';
import { Facts, Gallery, Prose, VideoBlock } from '@/components/public/Cards';
import { ReviewForm } from '@/components/public/ReviewForm';
import { SmartImage } from '@/components/public/SmartImage';
import { SocialIcon } from '@/components/site/SocialIcon';
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
  const mapLink = place.latitude && place.longitude ? `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}` : place.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.address}`)}` : null;

  return (
    <PublicShell>
      <section className="relative">
        <div className="relative h-[42vh] min-h-[280px] w-full overflow-hidden bg-acacia-600 md:h-[52vh]">
          {place.coverImage && <SmartImage src={place.coverImage} alt="" fill priority sizes="100vw" className="object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-acacia-900/80 via-acacia-900/10 to-transparent" />
          <div className="shell absolute inset-x-0 bottom-0 pb-8 text-white">
            <Link href={`/discover?category=${place.category?.slug ?? ''}`} className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-clay-400">
              {place.category?.icon} {place.category?.name}
            </Link>
            <h1 className="display-lg mt-2">{String(place.name)}</h1>
            <p className="mt-2 text-white/80">{[place.area as string, placeLabel(place)].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
      </section>

      <section className="shell grid gap-10 py-10 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-8">
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
          </div>
          {source !== 'VERIFIED' && (
            <p className="rounded-xl bg-[color:var(--color-cream)] p-4 text-sm leading-relaxed text-ink-soft">
              {source === 'BUSINESS_SUBMITTED'
                ? 'These details were provided by the business and have not been checked by Enhakkore. Confirm prices, opening hours and availability directly.'
                : 'These details have not yet been verified. Confirm prices, opening hours and availability directly with the place before you go.'}
            </p>
          )}
          {place.summary && <p className="font-display text-2xl leading-snug text-acacia-700">{place.summary}</p>}
          <Prose text={place.description} />
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
            {place.bookingMode === 'EXTERNAL' && place.bookingUrl ? (
              <a href={String(place.bookingUrl)} target="_blank" rel="noreferrer noopener" className="mb-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-acacia-600 font-bold text-white">
                Book on their website
              </a>
            ) : null}
            {place.bookingMode === 'ENQUIRY' ? (
              <>
                <EnquiryForm
                  type={enquiryType}
                  subjectType="PLACE"
                  subjectId={place.id}
                  subjectTitle={String(place.name)}
                  heading={enquiryType === 'ROOM' ? 'Ask about a stay' : enquiryType === 'TABLE' ? 'Ask about a table' : 'Ask about this place'}
                  withDates={enquiryType !== 'PLACE'}
                  withPeople={enquiryType !== 'PLACE'}
                  whatsappHref={waHref(settings, 'place', String(place.name))}
                />
                <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                  {enquiryType === 'ROOM'
                    ? 'Live room availability is not connected for this property. Availability and prices must be confirmed with the property.'
                    : 'The place confirms any booking itself. Enhakkore does not take payment on its behalf.'}
                </p>
              </>
            ) : null}
            <a href={waHref(settings, 'place', String(place.name))} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1f9d55] text-sm font-bold text-white">
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
    </PublicShell>
  );
}
