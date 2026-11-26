import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { env } from '../env';
import { prisma } from '../lib/prisma';

/**
 * The shared discovery engine for Explore, Experiences and Travel.
 *
 * Signals are genuine engagement — unique views, saves, shares, registrations
 * and enquiries — and each visitor counts once per signal, item and day, so
 * refreshing a page or a bot hammering it cannot push a listing up. Visitors
 * are identified only by a salted hash (account id, or address + browser).
 *
 * Sponsorship never enters the score: sponsored listings are labelled and
 * placed separately. New listings get a fading freshness boost so they have a
 * fair chance to be seen. Callers exclude expired or unavailable items.
 */

export const ENGAGEMENT_KINDS = ['VIEW', 'SAVE', 'SHARE', 'REGISTER', 'ENQUIRY'] as const;
export type EngagementKind = (typeof ENGAGEMENT_KINDS)[number];
export const ENGAGEMENT_SUBJECTS = ['PLACE', 'ACTIVITY', 'EVENT', 'EXPERIENCE', 'TRIP', 'TOURNAMENT', 'COMMUNITY'] as const;

const WEIGHTS: Record<EngagementKind, number> = { VIEW: 1, SHARE: 3, SAVE: 4, ENQUIRY: 6, REGISTER: 8 };
const HALF_LIFE_DAYS = 14;
const WINDOW_DAYS = 45;

function visitorKey(req: Request): string {
  const basis = req.auth?.id ? `u:${req.auth.id}` : `a:${req.ip ?? ''}|${String(req.headers['user-agent'] ?? '').slice(0, 200)}`;
  return createHash('sha256').update(`${env.jwtSecret}:${basis}`).digest('hex').slice(0, 32);
}

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;

/** Records one signal. Duplicates within the day are ignored. Never throws. */
export async function recordEngagement(req: Request, subjectType: string, subjectId: string, kind: EngagementKind): Promise<boolean> {
  const type = subjectType.toUpperCase();
  if (!(ENGAGEMENT_SUBJECTS as readonly string[]).includes(type)) return false;
  if (BOT.test(String(req.headers['user-agent'] ?? ''))) return false;
  try {
    await prisma.engagementEvent.create({
      data: { subjectType: type, subjectId, kind, visitor: visitorKey(req), day: new Date().toISOString().slice(0, 10) },
    });
    return true;
  } catch {
    return false; // already counted today
  }
}

/** Scores for the given items (or every item of the type). Higher is more popular. */
export async function popularityScores(subjectType: string, ids?: string[]): Promise<Map<string, number>> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
  const rows = await prisma.engagementEvent.findMany({
    where: { subjectType, createdAt: { gte: since }, ...(ids ? { subjectId: { in: ids } } : {}) },
    select: { subjectId: true, kind: true, createdAt: true },
  });
  const scores = new Map<string, number>();
  const now = Date.now();
  for (const row of rows) {
    const age = (now - row.createdAt.getTime()) / 86400000;
    const weight = (WEIGHTS[row.kind as EngagementKind] ?? 0) * Math.pow(0.5, age / HALF_LIFE_DAYS);
    scores.set(row.subjectId, (scores.get(row.subjectId) ?? 0) + weight);
  }
  return scores;
}

/** A fading boost for new listings: worth a few views on day one, nothing after a fortnight. */
export function freshness(publishedAt: Date | string | null | undefined): number {
  if (!publishedAt) return 0;
  const age = (Date.now() - new Date(publishedAt).getTime()) / 86400000;
  return age < 0 || age > 14 ? 0 : 4 * (1 - age / 14);
}

/** Sorts items by score + freshness; ties keep their order. */
export async function rankByPopularity<T extends { id: string; publishedAt?: Date | string | null }>(subjectType: string, items: T[]): Promise<(T & { popularity: number })[]> {
  const scores = await popularityScores(subjectType, items.map((item) => item.id));
  return items
    .map((item, index) => ({ item: { ...item, popularity: Math.round(((scores.get(item.id) ?? 0) + freshness(item.publishedAt)) * 10) / 10 }, index }))
    .sort((a, b) => b.item.popularity - a.item.popularity || a.index - b.index)
    .map(({ item }) => item);
}

/** Raw counts per kind, for the analytics screen. */
export async function engagementTotals(days = 30) {
  const since = new Date(Date.now() - days * 86400000);
  const grouped = await prisma.engagementEvent.groupBy({ by: ['subjectType', 'subjectId', 'kind'], where: { createdAt: { gte: since } }, _count: { _all: true } });
  return grouped.map((row) => ({ subjectType: row.subjectType, subjectId: row.subjectId, kind: row.kind, count: row._count._all }));
}
