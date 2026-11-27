import { Router } from 'express';
import { z } from 'zod';
import { slugify } from '@enhakkore/shared';
import { ApiError, route } from '../lib/http';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

/**
 * Worldwide places for location pickers.
 *
 * Cities come from GeoNames (via the `all-the-cities` package: every populated
 * place with at least 1,000 inhabitants, about 135,000 worldwide, including
 * Tanzania's regional capitals, municipalities and towns). GeoNames data is
 * licensed CC BY 4.0 — the attribution is shown under every location picker.
 *
 * Pickers search this list; when a city is chosen it is copied into the
 * City table (with its coordinates) the first time, so every listing points
 * at one consistent record. Places missing from GeoNames are added by the team
 * under Countries / Cities.
 */
export const geoPublic = Router();
export const geoMember = Router();

interface GeoCity {
  id: number;
  name: string;
  ascii: string;
  population: number;
  lat: number;
  lng: number;
  capital: boolean;
}

let index: Map<string, GeoCity[]> | null = null;

const fold = (value: string) => value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

function cities(): Map<string, GeoCity[]> {
  if (index) return index;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const all = require('all-the-cities') as {
    cityId: number;
    name: string;
    altName: string;
    country: string;
    featureCode: string;
    population: number;
    loc: { coordinates: [number, number] };
  }[];
  index = new Map();
  for (const row of all) {
    const list = index.get(row.country) ?? [];
    list.push({
      id: row.cityId,
      name: row.name,
      ascii: fold(`${row.name} ${row.altName ?? ''}`),
      population: row.population,
      lng: row.loc.coordinates[0],
      lat: row.loc.coordinates[1],
      capital: row.featureCode === 'PPLC' || row.featureCode === 'PPLA',
    });
    index.set(row.country, list);
  }
  for (const list of index.values()) list.sort((a, b) => b.population - a.population);
  return index;
}

/** Search a country's cities by name: prefix matches first, then larger places. */
geoPublic.get(
  '/geo/cities',
  route(async (req, res) => {
    const country = String(req.query.country ?? '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) throw ApiError.badRequest('Choose a country first.');
    const q = fold(String(req.query.q ?? '').trim());
    const list = cities().get(country) ?? [];
    const matches = q
      ? [...list.filter((city) => city.ascii.startsWith(q)), ...list.filter((city) => !city.ascii.startsWith(q) && city.ascii.includes(q))]
      : list;
    res.json({
      country,
      total: list.length,
      items: matches.slice(0, 25).map((city) => ({ geonameId: city.id, name: city.name, population: city.population, latitude: city.lat, longitude: city.lng, regionalCapital: city.capital })),
      attribution: 'City data © GeoNames (geonames.org), CC BY 4.0',
    });
  }),
);

/** The nearest city to a point — for "Use my current location". */
geoPublic.get(
  '/geo/nearest',
  route(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw ApiError.badRequest('A valid location is needed.');
    let best: { country: string; city: GeoCity; d: number } | null = null;
    const cos = Math.cos((lat * Math.PI) / 180);
    for (const [country, list] of cities()) {
      for (const city of list) {
        // Equirectangular distance is plenty to find the closest town.
        const dx = (city.lng - lng) * cos;
        const dy = city.lat - lat;
        const d = dx * dx + dy * dy;
        if (!best || d < best.d) best = { country, city, d };
      }
    }
    if (!best) throw ApiError.notFound('No place found.');
    res.json({ country: best.country, city: { geonameId: best.city.id, name: best.city.name, latitude: best.city.lat, longitude: best.city.lng } });
  }),
);

const ensureSchema = z.object({ country: z.string().length(2), geonameId: z.number().int().positive() });

/** Returns the platform's City record for a GeoNames city, creating it the first time. */
export async function ensureCity(countryCode: string, geonameId: number) {
  const country = await prisma.country.findUnique({ where: { code: countryCode.toUpperCase() } });
  if (!country) throw ApiError.badRequest('Unknown country.');
  const existing = await prisma.city.findFirst({ where: { countryId: country.id, geonameId } });
  if (existing) return existing;
  const geo = (cities().get(country.code) ?? []).find((city) => city.id === geonameId);
  if (!geo) throw ApiError.badRequest('Choose a city from the list.');
  let slug = slugify(geo.name) || `city-${geonameId}`;
  const sameSlug = await prisma.city.findUnique({ where: { countryId_slug: { countryId: country.id, slug } } });
  if (sameSlug) {
    // The team may have added this city by hand before: link it instead of duplicating.
    if (!sameSlug.geonameId) return prisma.city.update({ where: { id: sameSlug.id }, data: { geonameId, latitude: sameSlug.latitude ?? geo.lat, longitude: sameSlug.longitude ?? geo.lng } });
    slug = `${slug}-${geonameId}`;
  }
  return prisma.city.create({
    data: { countryId: country.id, name: geo.name, slug, latitude: geo.lat, longitude: geo.lng, geonameId, status: 'PUBLISHED' },
  });
}

geoMember.post(
  '/geo/city',
  requireAuth,
  route(async (req, res) => {
    const input = ensureSchema.parse(req.body);
    const city = await ensureCity(input.country, input.geonameId);
    res.json({ id: city.id, name: city.name, slug: city.slug, countryId: city.countryId, timezone: city.timezone, latitude: city.latitude, longitude: city.longitude });
  }),
);
