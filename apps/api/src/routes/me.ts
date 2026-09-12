import { Router } from 'express';
import { z } from 'zod';
import { ApiError, route } from '../lib/http';
import { stringify } from '../lib/json';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { travellerStats } from '../services/stats';
import { refreshRatings } from '../services/stats';
import { toDonation, toNotification, toPublicUser, toReview, toTripSummary } from '../serializers';

export const meRouter = Router();

meRouter.use(requireAuth);

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional(),
  country: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(600).optional(),
});

meRouter.patch(
  '/',
  route(async (req, res) => {
    const input = profileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.auth!.id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
      },
      include: { organizer: { select: { id: true } } },
    });
    res.json(toPublicUser(user));
  }),
);

meRouter.get(
  '/stats',
  route(async (req, res) => {
    res.json(await travellerStats(req.auth!.id));
  }),
);

/* -------------------------------- Impact ---------------------------------- */

meRouter.get(
  '/donations',
  route(async (req, res) => {
    const donations = await prisma.donation.findMany({
      where: { userId: req.auth!.id, status: 'SUCCEEDED' },
      include: { project: true, booking: { select: { reference: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items: donations.map(toDonation) });
  }),
);

/* ------------------------------ Saved trips -------------------------------- */

meRouter.get(
  '/saved',
  route(async (req, res) => {
    const saved = await prisma.savedTrip.findMany({
      where: { userId: req.auth!.id },
      include: {
        trip: {
          include: { destination: true, organizer: true, departures: { orderBy: { startDate: 'asc' } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items: saved.map((row) => toTripSummary(row.trip)) });
  }),
);

meRouter.post(
  '/saved/:tripId',
  route(async (req, res) => {
    const existing = await prisma.savedTrip.findUnique({
      where: { userId_tripId: { userId: req.auth!.id, tripId: req.params.tripId } },
    });

    if (existing) {
      await prisma.savedTrip.delete({ where: { id: existing.id } });
      return res.json({ saved: false });
    }

    await prisma.savedTrip.create({ data: { userId: req.auth!.id, tripId: req.params.tripId } });
    res.json({ saved: true });
  }),
);

/* ----------------------------- Notifications ------------------------------ */

meRouter.get(
  '/notifications',
  route(async (req, res) => {
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.auth!.id },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      prisma.notification.count({ where: { userId: req.auth!.id, read: false } }),
    ]);
    res.json({ items: items.map(toNotification), unread });
  }),
);

meRouter.post(
  '/notifications/read',
  route(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : null;
    await prisma.notification.updateMany({
      where: { userId: req.auth!.id, ...(ids ? { id: { in: ids } } : {}) },
      data: { read: true },
    });
    res.json({ ok: true });
  }),
);

/* -------------------------------- Reviews --------------------------------- */

const reviewSchema = z.object({
  bookingReference: z.string().trim().min(1),
  rating: z.number().int().min(1, 'Choose a rating.').max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(20, 'Tell other travellers a little more.').max(3000),
  photos: z.array(z.string().url()).max(6).default([]),
});

/**
 * Reviews are tied to a completed booking, never written freely. That link is
 * what makes ratings on this platform mean something.
 */
meRouter.post(
  '/reviews',
  route(async (req, res) => {
    const input = reviewSchema.parse(req.body);

    const booking = await prisma.booking.findUnique({
      where: { reference: input.bookingReference },
      include: { trip: true, departure: true, review: true },
    });

    if (!booking || booking.userId !== req.auth!.id) {
      throw ApiError.notFound('We could not find that booking.');
    }
    if (booking.review) {
      throw ApiError.conflict('You have already reviewed this trip.', 'already_reviewed');
    }
    if (booking.status === 'CANCELLED' || booking.status === 'REFUNDED') {
      throw ApiError.unprocessable('Cancelled bookings cannot be reviewed.', 'cancelled');
    }
    if (new Date(booking.departure.endDate).getTime() > Date.now()) {
      throw ApiError.unprocessable('You can review this trip once it has finished.', 'trip_not_finished');
    }

    const review = await prisma.review.create({
      data: {
        tripId: booking.tripId,
        organizerId: booking.trip.organizerId,
        userId: req.auth!.id,
        bookingId: booking.id,
        rating: input.rating,
        title: input.title ?? null,
        body: input.body,
        photos: stringify(input.photos),
      },
      include: { user: true, trip: { select: { title: true } } },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await refreshRatings(booking.tripId, booking.trip.organizerId);

    res.status(201).json(toReview(review));
  }),
);

meRouter.get(
  '/reviews',
  route(async (req, res) => {
    const reviews = await prisma.review.findMany({
      where: { userId: req.auth!.id },
      include: { user: true, trip: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items: reviews.map(toReview) });
  }),
);
