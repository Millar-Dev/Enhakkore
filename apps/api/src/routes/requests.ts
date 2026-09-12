import { Router } from 'express';
import { z } from 'zod';
import { route } from '../lib/http';
import { stringify } from '../lib/json';
import { prisma } from '../lib/prisma';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { toCustomTripRequest } from '../serializers';

export const requestsRouter = Router();

const requestSchema = z.object({
  destination: z.string().trim().min(2, 'Where would you like to go?').max(160),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  travellers: z.number().int().min(1).max(60).default(2),
  budget: z.number().int().positive().optional(),
  currency: z.string().length(3).default('TZS'),
  style: z.enum(['BUDGET', 'COMFORT', 'LUXURY']).default('COMFORT'),
  accommodation: z.string().trim().max(120).optional(),
  activities: z.array(z.string().trim().max(80)).max(20).default([]),
  notes: z.string().trim().max(2000).optional(),
  contactName: z.string().trim().min(2, 'Tell us your name.').max(120),
  contactEmail: z.string().trim().email('Enter a valid email address.'),
  contactPhone: z.string().trim().max(40).optional(),
});

/**
 * Captures a private/custom trip enquiry.
 *
 * Requests land in an admin queue for matching. The data model already supports
 * routing one request to several verified operators and collecting quotes —
 * that flow is a later milestone, but nothing here has to change for it.
 */
requestsRouter.post(
  '/',
  optionalAuth,
  route(async (req, res) => {
    const input = requestSchema.parse(req.body);

    const created = await prisma.customTripRequest.create({
      data: {
        userId: req.auth?.id ?? null,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone ?? null,
        destination: input.destination,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        travellers: input.travellers,
        budget: input.budget ?? null,
        currency: input.currency,
        style: input.style,
        accommodation: input.accommodation ?? null,
        activities: stringify(input.activities),
        notes: input.notes ?? null,
      },
    });

    res.status(201).json(toCustomTripRequest(created));
  }),
);

/** A signed-in traveller's own requests. */
requestsRouter.get(
  '/mine',
  requireAuth,
  route(async (req, res) => {
    const rows = await prisma.customTripRequest.findMany({
      where: { userId: req.auth!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items: rows.map(toCustomTripRequest) });
  }),
);
