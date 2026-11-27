import Link from 'next/link';
import { SmartImage } from './SmartImage';
import { ACTIVITY_MODE_LABELS, EXPERIENCE_LEVEL_LABELS, INFO_SOURCE_LABELS, formatMoney } from '@enhakkore/shared';
import { placeLabel, priceLabel, whenLabel, type Listing } from '@/lib/public';
import { ListingCard } from './Cards';

/* One mapper per kind of listing, so every page shows a card the same way. */

export function ActivityCard({ item }: { item: Listing }) {
  const past = item.status === 'COMPLETED';
  const badges = [
    item.status === 'FULL' ? { label: 'Full', tone: 'muted' as const } : null,
    item.status === 'CANCELLED' ? { label: 'Cancelled', tone: 'muted' as const } : null,
    past ? { label: 'Past', tone: 'muted' as const } : null,
    item.source === 'COMMUNITY' ? { label: 'Community', tone: 'cream' as const } : { label: 'Enhakkore', tone: 'navy' as const },
    item.mode === 'ONLINE' ? { label: 'Online', tone: 'gold' as const } : null,
  ].filter(Boolean) as { label: string; tone: 'muted' | 'cream' | 'navy' | 'gold' | 'demo' }[];
  if (item.isDemo) badges.unshift({ label: 'Demo', tone: 'demo' });
  const spaces = typeof item.spacesLeft === 'number' && item.status === 'PUBLISHED' ? `${item.spacesLeft} space${item.spacesLeft === 1 ? '' : 's'} left` : null;
  return (
    <ListingCard
      href={`/activities/${item.slug}`}
      image={item.coverImage}
      kicker={[item.category?.icon, item.category?.name].filter(Boolean).join(' ')}
      title={String(item.title)}
      tone={past ? 'past' : 'default'}
      badges={badges}
      meta={[
        whenLabel(item.startsAt, item.timezone) ?? (item.recurrence as string | null),
        item.mode === 'ONLINE' ? (item.platformName as string) || ACTIVITY_MODE_LABELS.ONLINE : placeLabel(item),
        [EXPERIENCE_LEVEL_LABELS[String(item.level)] , spaces].filter(Boolean).join(' · '),
      ]}
      price={priceLabel(item.price, item.currency)}
    />
  );
}

export function PlaceCard({ item }: { item: Listing }) {
  const badges = [
    item.sponsored ? { label: 'Sponsored', tone: 'gold' as const } : null,
    item.hiddenGem ? { label: 'Hidden gem', tone: 'navy' as const } : null,
    item.infoSource === 'VERIFIED' ? { label: 'Verified', tone: 'green' as const } : null,
    item.isDemo ? { label: 'Demo', tone: 'demo' as const } : null,
  ].filter(Boolean) as { label: string; tone: 'gold' | 'navy' | 'green' | 'demo' }[];
  return (
    <ListingCard
      href={`/explore/${item.slug}`}
      image={item.coverImage}
      kicker={[item.category?.icon, item.category?.name].filter(Boolean).join(' ')}
      title={String(item.name)}
      badges={badges}
      meta={[[item.area as string, placeLabel(item)].filter(Boolean).join(' · '), item.infoSource !== 'VERIFIED' ? INFO_SOURCE_LABELS[String(item.infoSource)] : null]}
      price={(item.priceRange as string) || null}
    />
  );
}

export function ExperienceCard({ item }: { item: Listing }) {
  return (
    <ListingCard
      href={`/experiences/${item.slug}`}
      image={item.coverImage}
      kicker={[item.category?.icon, item.category?.name].filter(Boolean).join(' ')}
      title={String(item.title)}
      badges={item.provider === 'Enhakkore' ? [{ label: 'By Enhakkore', tone: 'navy' }] : []}
      meta={[placeLabel(item), [item.durationText as string, (item.schedule as string) || whenLabel(item.startsAt, item.timezone, 'date')].filter(Boolean).join(' · ')]}
      price={priceLabel(item.price, item.currency) ? `${priceLabel(item.price, item.currency)}${item.priceNote ? ` ${item.priceNote}` : ''}` : 'Price on request'}
    />
  );
}

export function EventCard({ item }: { item: Listing }) {
  const tickets = (item.tickets as { price: number; currency: string }[] | undefined) ?? [];
  const cheapest = tickets.length ? tickets.reduce((min, ticket) => (ticket.price < min.price ? ticket : min)) : null;
  const ended = new Date(String(item.endsAt ?? item.startsAt)).getTime() < Date.now() || item.status === 'COMPLETED';
  return (
    <ListingCard
      href={`/events/${item.slug}`}
      image={(item.poster as string) ?? item.coverImage}
      kicker={[item.category?.icon, item.category?.name].filter(Boolean).join(' ')}
      title={String(item.title)}
      tone={ended ? 'past' : 'default'}
      badges={[
        item.host === 'ENHAKKORE' ? { label: 'Enhakkore event', tone: 'navy' as const } : { label: 'Listed event', tone: 'cream' as const },
        ...(item.status === 'SOLD_OUT' ? [{ label: 'Sold out', tone: 'muted' as const }] : []),
        ...(item.status === 'CANCELLED' ? [{ label: 'Cancelled', tone: 'muted' as const }] : []),
        ...(ended && item.status !== 'CANCELLED' ? [{ label: 'Past', tone: 'muted' as const }] : []),
      ]}
      meta={[whenLabel(item.startsAt, item.timezone), [item.venue as string, placeLabel(item)].filter(Boolean).join(' · ')]}
      price={cheapest ? (cheapest.price === 0 ? 'Free entry' : `From ${formatMoney({ amount: cheapest.price, currency: cheapest.currency })}`) : null}
    />
  );
}

export interface TripListing {
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string;
  destinationLabel: string | null;
  durationDays: number;
  durationNights: number;
  basePrice: number;
  currency: string;
  priceTiers: { label: string; amount: number; currency: string; note?: string }[];
  heroImage: string;
  isPast: boolean;
  nextDeparture: { startDate: string; endDate: string; seatsLeft: number; bookable: boolean; price: number } | null;
  departures: { startDate: string; endDate: string }[];
}

export function tripDates(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', timeZone: 'UTC' };
  if (s.toISOString().slice(0, 10) === e.toISOString().slice(0, 10)) return s.toLocaleDateString('en-GB', { ...opts, year: 'numeric' });
  return `${s.toLocaleDateString('en-GB', opts)} – ${e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
}

/** The large trip card used on Travel: picture, the key facts and a clear button. */
export function TripPackageCard({ trip }: { trip: TripListing }) {
  const next = trip.nextDeparture;
  const last = trip.departures[trip.departures.length - 1];
  const dates = next ? tripDates(next.startDate, next.endDate) : last ? tripDates(last.startDate, last.endDate) : null;
  return (
    <Link href={`/travel/${trip.slug}`} className="card-lift group block overflow-hidden rounded-2xl border border-line bg-white shadow-[0_10px_30px_-18px_rgba(4,18,30,0.5)]">
      <div className="relative aspect-[16/9] overflow-hidden bg-acacia-700">
        <SmartImage src={trip.heroImage} alt="" fill sizes="(max-width:768px) 100vw, (max-width:1280px) 50vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        <span className="absolute left-3 top-3 rounded-full bg-[#0b2547] px-2.5 py-1 text-[0.6875rem] font-bold text-clay-400">{trip.isPast ? 'Completed trip' : 'Group trip'}</span>
      </div>
      <div className="p-4">
        <h3 className="text-[1.25rem] font-bold leading-tight text-acacia-700">{trip.title}</h3>
        <ul className="mt-2 space-y-1.5 text-[0.875rem] text-ink-soft">
          {dates && <li className="flex gap-2"><span aria-hidden>📅</span>{dates} · {trip.durationDays} day{trip.durationDays === 1 ? '' : 's'}{trip.durationNights ? ` / ${trip.durationNights} night${trip.durationNights === 1 ? '' : 's'}` : ''}</li>}
          {trip.destinationLabel && <li className="flex gap-2"><span aria-hidden>📍</span>{trip.destinationLabel}</li>}
          {next && <li className="flex gap-2"><span aria-hidden>👥</span>{next.seatsLeft} place{next.seatsLeft === 1 ? '' : 's'} left</li>}
          {!trip.isPast && <li className="flex gap-2 text-base font-bold text-ink"><span aria-hidden>💳</span>{formatMoney({ amount: next?.price ?? trip.basePrice, currency: trip.currency })}<span className="self-end text-xs font-normal text-ink-muted">/ person</span></li>}
        </ul>
        <span className={`mt-4 flex h-12 items-center justify-center rounded-full text-sm font-bold ${trip.isPast ? 'border border-line text-acacia-700' : 'bg-clay-400 text-acacia-700'}`}>{trip.isPast ? 'See the trip' : 'View package →'}</span>
      </div>
    </Link>
  );
}

export function TripCard({ trip }: { trip: TripListing }) {
  const next = trip.nextDeparture;
  const last = trip.departures[trip.departures.length - 1];
  return (
    <ListingCard
      href={`/travel/${trip.slug}`}
      image={trip.heroImage}
      kicker={trip.destinationLabel}
      title={trip.title}
      tone={trip.isPast ? 'past' : 'default'}
      badges={trip.isPast ? [{ label: 'Past trip', tone: 'muted' }] : next && !next.bookable ? [{ label: next.seatsLeft === 0 ? 'Full' : 'Applications closed', tone: 'muted' }] : next ? [{ label: 'Open for applications', tone: 'gold' }] : []}
      meta={[
        next ? tripDates(next.startDate, next.endDate) : last ? tripDates(last.startDate, last.endDate) : null,
        `${trip.durationDays} day${trip.durationDays === 1 ? '' : 's'}${trip.durationNights ? `, ${trip.durationNights} night${trip.durationNights === 1 ? '' : 's'}` : ''}`,
      ]}
      price={trip.isPast ? null : formatMoney({ amount: next?.price ?? trip.basePrice, currency: trip.currency })}
    />
  );
}
