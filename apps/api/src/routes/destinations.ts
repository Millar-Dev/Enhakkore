import { Router } from 'express';
import { route } from '../lib/http';
import { prisma } from '../lib/prisma';
import { textContains } from '../lib/search';
import { toDestination } from '../serializers';

export const destinationsRouter = Router();

destinationsRouter.get(
  '/',
  route(async (req, res) => {
    const featuredOnly = req.query.featured === 'true';

    const rows = await prisma.destination.findMany({
      where: featuredOnly ? { featured: true } : undefined,
      include: { _count: { select: { trips: { where: { status: 'PUBLISHED' } } } } },
      orderBy: [{ featured: 'desc' }, { name: 'asc' }],
    });

    res.json({ items: rows.map(toDestination) });
  }),
);

/**
 * Typeahead for the hero search. Matches destination names and countries, and
 * is capped so a broad query cannot turn into a table scan response.
 */
destinationsRouter.get(
  '/search',
  route(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return res.json({ items: [] });

    const rows = await prisma.destination.findMany({
      where: { OR: [{ name: textContains(q) }, { country: textContains(q) }, { region: textContains(q) }] },
      include: { _count: { select: { trips: { where: { status: 'PUBLISHED' } } } } },
      take: 8,
    });

    res.json({ items: rows.map(toDestination) });
  }),
);
