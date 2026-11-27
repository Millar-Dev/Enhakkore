import { Router } from 'express';
import { formatMoney } from '@enhakkore/shared';
import { route } from '../lib/http';
import { prisma } from '../lib/prisma';
import { LIVE } from './public';

/**
 * Everything published that has a place on the map, for the homepage globe's
 * Locate mode. Each item is pinned at its own coordinates, else at its city,
 * else at its country. Demonstration records are included but flagged, so the
 * globe can label them. Nothing is invented: no ratings, counts or prices that
 * the records do not hold.
 */
export const globePublic = Router();

/** The globe's categories. Keys are stable; labels live in the web app. */
export const GLOBE_CATEGORIES = ['experiences', 'travel', 'sports', 'gaming', 'events', 'food', 'stays', 'venues', 'attractions', 'communities', 'impact'] as const;
type GlobeCategory = (typeof GLOBE_CATEGORIES)[number];

interface GeoRow {
  latitude?: number | null;
  longitude?: number | null;
  city?: { name: string; slug: string; latitude: number | null; longitude: number | null } | null;
  country?: { name: string; code: string; latitude: number | null; longitude: number | null } | null;
}

function point(row: GeoRow): { lat: number; lng: number } | null {
  if (row.latitude != null && row.longitude != null) return { lat: row.latitude, lng: row.longitude };
  if (row.city?.latitude != null && row.city.longitude != null) return { lat: row.city.latitude, lng: row.city.longitude };
  if (row.country?.latitude != null && row.country.longitude != null) return { lat: row.country.latitude, lng: row.country.longitude };
  return null;
}

const GEO = { city: { select: { name: true, slug: true, latitude: true, longitude: true } }, country: { select: { name: true, code: true, latitude: true, longitude: true } } };
const PLACE_SECTION: Record<string, GlobeCategory> = { FOOD: 'food', STAYS: 'stays', VENUES: 'venues', ATTRACTIONS: 'attractions' };
const EXPERIENCE_SECTION: Record<string, GlobeCategory[]> = { SPORTS: ['sports'], GAMING: ['gaming'], PARTIES: ['events'], COMMUNITIES: ['communities'] };

globePublic.get(
  '/globe',
  route(async (_req, res) => {
    const now = new Date();
    const [activities, events, experiences, trips, places, tournaments, communities, projects] = await Promise.all([
      prisma.activity.findMany({ where: { ...LIVE.activity, OR: [{ startsAt: null }, { startsAt: { gte: now } }, { recurrence: { not: null } }] }, include: { ...GEO, category: { select: { name: true, section: true } } }, take: 300 }),
      prisma.event.findMany({ where: { ...LIVE.event, startsAt: { gte: now } }, include: { ...GEO, category: { select: { name: true, section: true } } }, take: 200 }),
      prisma.experience.findMany({ where: LIVE.experience, include: { ...GEO, category: { select: { name: true, section: true } } }, take: 200 }),
      prisma.trip.findMany({ where: LIVE.trip, include: { ...GEO, departures: { where: { startDate: { gte: now } }, orderBy: { startDate: 'asc' }, take: 1 } }, take: 100 }),
      prisma.place.findMany({ where: LIVE.place, include: { ...GEO, category: { select: { name: true, section: true } } }, take: 500 }),
      prisma.tournament.findMany({ where: { status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS'] } }, include: { ...GEO, game: { select: { name: true } } }, take: 100 }),
      prisma.community.findMany({ where: { status: 'PUBLISHED' }, include: { ...GEO, category: { select: { name: true } } }, take: 100 }),
      prisma.impactProject.findMany({ where: { isDemo: false, status: { in: ['ACTIVE', 'PAUSED', 'COMPLETED', 'FUNDED'] } }, take: 50 }),
    ]);

    const items: {
      id: string;
      type: string;
      categories: GlobeCategory[];
      label: string;
      title: string;
      summary: string | null;
      href: string;
      image: string | null;
      lat: number;
      lng: number;
      city: string | null;
      country: string | null;
      startsAt: string | null;
      price: string | null;
      isDemo: boolean;
    }[] = [];
    const push = (row: GeoRow, item: Omit<(typeof items)[number], 'lat' | 'lng' | 'city' | 'country'> & { place?: string | null }) => {
      const at = point(row);
      if (!at) return;
      const { place, ...rest } = item;
      items.push({ ...rest, ...at, city: row.city?.name ?? place ?? null, country: row.country?.name ?? null });
    };
    const money = (amount: number | null | undefined, currency: string | null | undefined) => (amount && amount > 0 && currency ? formatMoney({ amount, currency }) : amount === 0 ? 'Free' : null);

    for (const row of activities) {
      push(row, {
        id: row.id, type: 'Activity', label: row.category?.name ?? 'Activity',
        categories: ['experiences', ...(EXPERIENCE_SECTION[row.category?.section ?? ''] ?? [])],
        title: row.title, summary: row.summary ?? null, href: `/activities/${row.slug}`, image: row.coverImage, startsAt: row.startsAt?.toISOString() ?? null,
        price: row.price ? money(row.price, row.currency) : 'Free', isDemo: row.isDemo,
      });
    }
    for (const row of events) {
      push(row, {
        id: row.id, type: 'Event', label: row.category?.name ?? 'Event',
        categories: ['experiences', 'events', ...(EXPERIENCE_SECTION[row.category?.section ?? ''] ?? []).filter((key) => key !== 'events')],
        title: row.title, summary: row.summary ?? null, href: `/events/${row.slug}`, image: row.poster, startsAt: row.startsAt.toISOString(), price: null, isDemo: row.isDemo,
      });
    }
    for (const row of experiences) {
      push(row, {
        id: row.id, type: 'Experience', label: row.category?.name ?? 'Guided experience', categories: ['experiences'],
        title: row.title, summary: row.summary ?? null, href: `/experiences/${row.slug}`, image: row.coverImage, startsAt: row.startsAt?.toISOString() ?? null,
        price: row.price ? money(row.price, row.currency) : row.priceNote ?? null, isDemo: row.isDemo,
      });
    }
    for (const row of trips) {
      const next = row.departures[0];
      push(row, {
        id: row.id, type: 'Trip', label: 'Group trip', categories: ['travel'],
        title: row.title, summary: row.summary ?? null, href: `/travel/${row.slug}`, image: row.heroImage, startsAt: next?.startDate.toISOString() ?? null,
        price: money(next?.price ?? row.basePrice, row.currency), isDemo: row.isDemo,
      });
    }
    for (const row of places) {
      const section = PLACE_SECTION[row.category?.section ?? ''];
      push(row, {
        id: row.id, type: 'Place', label: row.category?.name ?? 'Place', categories: section ? [section] : ['attractions'],
        title: row.name, summary: row.summary ?? null, href: `/explore/${row.slug}`, image: row.coverImage, startsAt: null, price: row.priceRange ?? null, isDemo: row.isDemo,
      });
    }
    for (const row of tournaments) {
      push(row, {
        id: row.id, type: 'Tournament', label: row.game?.name ?? 'Gaming', categories: ['gaming'],
        title: row.title, summary: null, href: `/experiences/gaming/${row.slug}`, image: row.coverImage, startsAt: row.startsAt?.toISOString() ?? null,
        price: 'Free', isDemo: row.isDemo, place: row.kind === 'ONLINE' ? 'Online' : null,
      });
    }
    for (const row of communities) {
      push(row, {
        id: row.id, type: 'Community', label: row.category?.name ?? 'Community', categories: ['communities'],
        title: row.name, summary: row.summary ?? null, href: `/experiences/communities/${row.slug}`, image: row.coverImage, startsAt: null, price: null, isDemo: row.isDemo,
      });
    }
    for (const row of projects) {
      push({ latitude: row.latitude, longitude: row.longitude }, {
        id: row.id, type: 'Impact project', label: 'Enhakkore Impact', categories: ['impact'],
        title: row.title, summary: row.summary ?? null, href: `/impact/${row.slug}`, image: row.heroImage, startsAt: null, price: null, isDemo: row.isDemo, place: row.location,
      });
    }
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ items, categories: GLOBE_CATEGORIES });
  }),
);
