import type { Money } from '@enhakkore/shared';
import { ARUSHA } from './arusha';
import { NAPURU } from './napuru';

/**
 * Enhakkore's own trips.
 *
 * These are the departures we run ourselves, as opposed to listings from
 * operators on the marketplace. They live in content files rather than the
 * database, so a trip can be published by editing one file and nothing else.
 *
 * Order is by date — the next departure first. Add a trip by writing its
 * content file and adding a line here.
 */

export interface UpcomingTrip {
  slug: string;
  title: string;
  subtitle: string;
  destination: string;
  datesLabel: string;
  /** ISO date, used only for ordering and for hiding a departure once it has gone. */
  startDate: string;
  duration: string;
  /** The headline price. */
  price: Money;
  /** A second price in another currency, where the trip quotes one. */
  altPrice?: Money;
  altPriceNote?: string;
  cover?: { src: string; alt: string };
  summary: string;
}

export const UPCOMING_TRIPS: UpcomingTrip[] = [
  {
    slug: NAPURU.slug,
    title: NAPURU.title,
    subtitle: NAPURU.subtitle,
    destination: NAPURU.destination,
    datesLabel: NAPURU.datesLabel,
    startDate: NAPURU.startDate,
    duration: NAPURU.duration,
    price: NAPURU.price,
    cover: NAPURU.cover ?? undefined,
    summary: NAPURU.overview,
  },
  {
    slug: ARUSHA.slug,
    title: ARUSHA.title,
    subtitle: ARUSHA.subtitle,
    destination: ARUSHA.destination,
    datesLabel: ARUSHA.datesLabel,
    startDate: ARUSHA.startDate,
    duration: ARUSHA.duration,
    price: ARUSHA.pricing.resident.amount,
    altPrice: ARUSHA.pricing.nonResident.amount,
    altPriceNote: ARUSHA.pricing.nonResident.label,
    cover: { src: ARUSHA.gallery[0].src, alt: ARUSHA.gallery[0].alt },
    summary: ARUSHA.overview,
  },
].sort((a, b) => a.startDate.localeCompare(b.startDate));
