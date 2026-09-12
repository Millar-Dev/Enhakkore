import { Router } from 'express';
import { z } from 'zod';
import { ApiError, pageParams, paginated, route } from '../lib/http';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { createBooking, releaseBooking } from '../services/bookings';
import { paymentGateway } from '../services/payments';
import { toBooking } from '../serializers';

export const bookingsRouter = Router();

bookingsRouter.use(requireAuth);

const BOOKING_INCLUDE = {
  trip: {
    include: { destination: true, organizer: true, departures: { orderBy: { startDate: 'asc' as const } } },
  },
  departure: { include: { conversation: { select: { id: true } } } },
  travellerList: true,
  impactProject: true,
  payments: { orderBy: { createdAt: 'desc' as const } },
  review: { select: { id: true } },
};

const createSchema = z.object({
  tripDateId: z.string().min(1, 'Choose a departure date.'),
  travellers: z.number().int().min(1, 'At least one traveller.').max(20),
  impactAmount: z.number().int().min(0).default(0),
  impactProjectId: z.string().optional().nullable(),
  travellerDetails: z
    .array(
      z.object({
        fullName: z.string().trim().min(2, 'Enter the traveller’s full name.').max(120),
        email: z.string().trim().email('Enter a valid email.').optional().or(z.literal('')),
        phone: z.string().trim().max(40).optional(),
        notes: z.string().trim().max(400).optional(),
      }),
    )
    .min(1, 'Add at least one traveller.'),
  notes: z.string().trim().max(1000).optional(),
  paymentMethod: z.enum(['MOCK', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER']).default('MOCK'),
  paymentInstrument: z.string().trim().max(40).optional(),
});

bookingsRouter.post(
  '/',
  route(async (req, res) => {
    const input = createSchema.parse(req.body);

    if (input.travellerDetails.length !== input.travellers) {
      throw ApiError.badRequest('Add details for every traveller on this booking.');
    }

    const result = await createBooking({
      userId: req.auth!.id,
      tripDateId: input.tripDateId,
      travellers: input.travellers,
      impactAmount: input.impactAmount,
      impactProjectId: input.impactProjectId ?? null,
      travellerDetails: input.travellerDetails.map((t) => ({
        fullName: t.fullName,
        email: t.email || undefined,
        phone: t.phone,
        notes: t.notes,
      })),
      notes: input.notes,
      paymentMethod: input.paymentMethod,
      paymentInstrument: input.paymentInstrument,
    });

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: result.bookingId },
      include: BOOKING_INCLUDE,
    });

    res.status(result.payment.status === 'SUCCEEDED' ? 201 : 402).json({
      booking: toBooking(booking),
      payment: {
        status: result.payment.status,
        simulated: result.payment.simulated,
        message: result.payment.message,
        failureCode: result.payment.failureCode ?? null,
      },
    });
  }),
);

bookingsRouter.get(
  '/',
  route(async (req, res) => {
    const page = pageParams(req.query as Record<string, unknown>, 10, 50);
    const scope = String(req.query.scope ?? 'all');

    const where: Record<string, unknown> = { userId: req.auth!.id };
    if (scope === 'upcoming') {
      where.status = 'CONFIRMED';
      where.departure = { endDate: { gte: new Date() } };
    } else if (scope === 'past') {
      where.OR = [{ status: 'COMPLETED' }, { departure: { endDate: { lt: new Date() } } }];
    }

    const [rows, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
      prisma.booking.count({ where }),
    ]);

    res.json(paginated(rows.map(toBooking), total, page));
  }),
);

bookingsRouter.get(
  '/:reference',
  route(async (req, res) => {
    const booking = await prisma.booking.findUnique({
      where: { reference: req.params.reference },
      include: BOOKING_INCLUDE,
    });

    if (!booking) throw ApiError.notFound('We could not find that booking.');

    // A booking is visible to the traveller who made it, the organizer running
    // the trip, and admins. Nobody else, regardless of knowing the reference.
    const viewer = req.auth!;
    const trip = await prisma.trip.findUniqueOrThrow({
      where: { id: booking.tripId },
      select: { organizerId: true },
    });
    const allowed =
      booking.userId === viewer.id || viewer.role === 'ADMIN' || viewer.organizerId === trip.organizerId;

    if (!allowed) throw ApiError.forbidden('You cannot view this booking.');

    res.json(toBooking(booking));
  }),
);

bookingsRouter.post(
  '/:reference/cancel',
  route(async (req, res) => {
    const booking = await prisma.booking.findUnique({ where: { reference: req.params.reference } });
    if (!booking) throw ApiError.notFound('We could not find that booking.');
    if (booking.userId !== req.auth!.id && req.auth!.role !== 'ADMIN') {
      throw ApiError.forbidden('You cannot cancel this booking.');
    }
    if (booking.status === 'COMPLETED') {
      throw ApiError.unprocessable('This trip has already taken place.', 'already_completed');
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 300) : 'Cancelled by traveller';

    // Refund the simulated charge so the ledger stays consistent. Real refund
    // policy (windows, partial amounts) belongs here once a rail is connected.
    const payment = await prisma.payment.findFirst({
      where: { bookingId: booking.id, status: 'SUCCEEDED' },
      orderBy: { createdAt: 'desc' },
    });

    let refunded = false;
    if (payment?.providerRef) {
      const result = await paymentGateway().refund({
        providerRef: payment.providerRef,
        amount: payment.amount,
        currency: payment.currency,
        reason,
      });
      refunded = result.status === 'REFUNDED';
      if (refunded) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        });
      }
    }

    await releaseBooking(booking.id, reason, refunded ? 'REFUNDED' : 'CANCELLED');

    const updated = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: BOOKING_INCLUDE,
    });

    res.json({ booking: toBooking(updated), refunded });
  }),
);

/** What the checkout needs to price a departure before anything is created. */
bookingsRouter.get(
  '/quote/:tripDateId',
  route(async (req, res) => {
    const travellers = Math.max(1, Math.min(20, Number(req.query.travellers ?? 1) || 1));
    const impactAmount = Math.max(0, Number(req.query.impactAmount ?? 0) || 0);

    const departure = await prisma.tripDate.findUnique({
      where: { id: req.params.tripDateId },
      include: { trip: { include: { organizer: true, destination: true, impactProject: true } } },
    });
    if (!departure) throw ApiError.notFound('That departure no longer exists.');

    if (departure.trip.status !== 'PUBLISHED') {
      throw ApiError.unprocessable('This trip is not open for booking right now.', 'trip_unavailable');
    }

    const unitPrice = departure.price ?? departure.trip.basePrice;
    const tripAmount = unitPrice * travellers;
    const gateway = paymentGateway();

    const { toTripDate } = await import('../serializers');

    res.json({
      currency: departure.trip.currency,
      unitPrice,
      travellers,
      tripAmount,
      impactAmount,
      total: tripAmount + impactAmount,
      seatsRemaining: Math.max(0, departure.capacity - departure.seatsBooked),
      // Enough trip context for the checkout summary without a second request.
      trip: {
        id: departure.trip.id,
        slug: departure.trip.slug,
        title: departure.trip.title,
        heroImage: departure.trip.heroImage,
        durationDays: departure.trip.durationDays,
        durationNights: departure.trip.durationNights,
        destination: departure.trip.destination.name,
        country: departure.trip.destination.country,
        organizer: departure.trip.organizer.companyName,
        impactProjectId: departure.trip.impactProjectId,
      },
      departure: toTripDate(departure, departure.trip.currency, departure.trip.basePrice),
      // The client uses these to state plainly that no live rail is connected.
      gateway: { name: gateway.name, isLive: gateway.isLive, supports: gateway.supports },
    });
  }),
);
