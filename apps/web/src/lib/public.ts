import { formatInZone, formatMoney, type Money } from '@enhakkore/shared';
import { apiGet, query } from './api';

/* Shapes returned by /api/public. Loose on purpose: optional fields are optional. */

export interface Ref {
  id: string;
  name: string;
  slug: string;
  code?: string;
  group?: string | null;
  icon?: string | null;
}

export interface Listing {
  id: string;
  slug: string;
  title?: string;
  name?: string;
  summary?: string | null;
  description?: string | null;
  coverImage?: string | null;
  gallery?: string[];
  videoUrl?: string | null;
  country?: Ref | null;
  city?: Ref | null;
  category?: Ref | null;
  featured?: boolean;
  price?: number | null;
  currency?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  timezone?: string;
  status?: string;
  [key: string]: unknown;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CatalogueCountry {
  id: string;
  code: string;
  name: string;
  slug: string;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  heroImage: string | null;
  featured: boolean;
  timezone: string;
  total: number;
  counts: { activities: number; places: number; experiences: number; events: number; trips: number };
  cities: { id: string; name: string; slug: string; featured: boolean; total: number; counts: CatalogueCountry['counts'] }[];
}

export interface Catalogue {
  countries: CatalogueCountry[];
  categories: (Ref & { kind: string; featured: boolean; description: string | null; section?: string | null })[];
}

export async function getCatalogue(): Promise<Catalogue> {
  return (await apiGet<Catalogue>('/public/catalogue', 120)) ?? { countries: [], categories: [] };
}

export async function getList<T = Listing>(path: string, params: Record<string, string | number | undefined | null> = {}): Promise<Paged<T>> {
  return (await apiGet<Paged<T>>(`${path}${query(params)}`, 60)) ?? { items: [], total: 0, page: 1, totalPages: 1 };
}

/** "TZS 270,000", or null when no price was entered (never "free" unless it is 0). */
export function priceLabel(amount: number | null | undefined, currency: string | null | undefined): string | null {
  if (amount === null || amount === undefined || !currency) return null;
  if (amount === 0) return 'Free';
  return formatMoney({ amount, currency } as Money);
}

/** Date and time where the thing happens, with the zone shown when it differs from the reader's. */
export function whenLabel(startsAt: string | null | undefined, zone: string | undefined, style: 'datetime' | 'date' | 'full' = 'datetime'): string | null {
  if (!startsAt) return null;
  return formatInZone(startsAt, zone ?? 'Africa/Dar_es_Salaam', style);
}

export function placeLabel(item: { city?: { name: string } | null; country?: { name: string } | null }): string {
  return [item.city?.name, item.country?.name].filter(Boolean).join(', ');
}

/** Picks the search params a listing page passes through to the API. */
export function pick(searchParams: Record<string, string | string[] | undefined>, keys: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of keys) {
    const value = searchParams[key];
    out[key] = Array.isArray(value) ? value[0] : value;
  }
  return out;
}
