import { ADULT_AGE, ageFrom } from '@enhakkore/shared';
import { prisma } from '../lib/prisma';

/** True when either member blocked the other. */
export async function blockedEither(a: string, b: string) {
  const row = await prisma.block.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { id: true } });
  return !!row;
}

/** Everyone the member blocked or who blocked them. */
export async function blockedSet(userId: string) {
  const rows = await prisma.block.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] }, select: { blockerId: true, blockedId: true } });
  return new Set(rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId)));
}

export async function areFriends(a: string, b: string) {
  const row = await prisma.connection.findFirst({
    where: { status: 'ACCEPTED', OR: [{ requesterId: a, addresseeId: b }, { requesterId: b, addresseeId: a }] },
    select: { id: true },
  });
  return !!row;
}

export async function friendIds(userId: string) {
  const rows = await prisma.connection.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((row) => (row.requesterId === userId ? row.addresseeId : row.requesterId));
}

export async function mutualFollow(a: string, b: string) {
  const count = await prisma.follow.count({ where: { OR: [{ followerId: a, followingId: b }, { followerId: b, followingId: a }] } });
  return count === 2;
}

/** Unknown age counts as not an adult for features that need one (nearby discovery). */
export function isAdult(dateOfBirth: Date | null | undefined) {
  const age = ageFrom(dateOfBirth ?? null);
  return age !== null && age >= ADULT_AGE;
}
export function isMinor(dateOfBirth: Date | null | undefined) {
  const age = ageFrom(dateOfBirth ?? null);
  return age !== null && age < ADULT_AGE;
}

/** Rounds a position to a ~500 m grid. Exact GPS is never stored. */
export function toGrid(lat: number, lng: number) {
  const step = 0.005;
  return { lat: Math.round(lat / step) * step, lng: Math.round(lng / step) * step };
}

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** A distance band — never an exact figure. */
export function distanceBand(km: number) {
  if (km < 1) return 'Under 1 km';
  if (km < 2) return '1–2 km';
  if (km < 5) return '2–5 km';
  if (km < 20) return '5–20 km';
  return 'More than 20 km';
}

/** A recent position: approximate locations older than this are ignored. */
export const LOCATION_FRESH_MS = 2 * 60 * 60 * 1000;

export const PUBLIC_MEMBER = { id: true, name: true, username: true, avatarUrl: true, city: true, country: true, headline: true } as const;
