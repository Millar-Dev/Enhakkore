import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { ApiError, pageParams, paginated, route } from '../lib/http';
import { uniqueSlug } from '../lib/ids';
import { stringify } from '../lib/json';
import { prisma } from '../lib/prisma';
import { requireAuth, requireOrganizer } from '../middleware/auth';
import { notify } from '../services/notifications';
import { organizerStats } from '../services/stats';
import { toBooking, toOrganizerDetail, toTripDetail, toTripSummary } from '../serializers';
import { ORGANIZER_WITH_COUNT } from '../lib/includes';

export const organizersRouter = Router();

const TRIP_INCLUDE = {
  destination: true,
  organizer: ORGANIZER_WITH_COUNT,
  departures: { orderBy: { startDate: 'asc' as const } },
};

/* -------------------------------------------------------------------------- */
/* Public organizer profiles                                                   */
/* -------------------------------------------------------------------------- */

organizersRouter.get(
  '/:slug',
  route(async (req, res) => {
    const organizer = await prisma.organizer.findUnique({
      where: { slug: req.params.slug },
      include: { _count: { select: { trips: { where: { status: 'PUBLISHED' } } } } },
    });
    if (!organizer) throw ApiError.notFound('We could not find that operator.');

    const trips = await prisma.trip.findMany({
      where: { organizerId: organizer.id, status: 'PUBLISHED' },
      include: TRIP_INCLUDE,
      take: 12,
    });

    res.json({ organizer: toOrganizerDetail(organizer), trips: trips.map(toTripSummary) });
  }),
);

/* -------------------------------------------------------------------------- */
/* Organizer workspace — everything below requires an organizer account         */
/* -------------------------------------------------------------------------- */

const workspace = Router();
workspace.use(requireAuth, requireOrganizer);
organizersRouter.use('/me', workspace);

workspace.get(
  '/',
  route(async (req, res) => {
    const organizer = await prisma.organizer.findUniqueOrThrow({
      where: { id: req.auth!.organizerId! },
      include: { verification: true, _count: { select: { trips: true } } },
    });

    res.json({
      organizer: toOrganizerDetail(organizer),
      verification: organizer.verification
        ? {
            status: organizer.verification.status,
            submittedAt: organizer.verification.submittedAt,
            reviewedAt: organizer.verification.reviewedAt,
            reviewNotes: organizer.verification.reviewNotes,
          }
        : null,
    });
  }),
);

workspace.get(
  '/stats',
  route(async (req, res) => {
    res.json(await organizerStats(req.auth!.organizerId!));
  }),
);

const profileSchema = z.object({
  companyName: z.string().trim().min(2).max(120).optional(),
  tagline: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(4000).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  coverUrl: z.string().url().optional().or(z.literal('')),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  country: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  yearFounded: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  languages: z.array(z.string().trim().max(40)).max(12).optional(),
});

workspace.patch(
  '/',
  route(async (req, res) => {
    const input = profileSchema.parse(req.body);
    const organizer = await prisma.organizer.update({
      where: { id: req.auth!.organizerId! },
      data: {
        ...(input.companyName ? { companyName: input.companyName } : {}),
        ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl || null } : {}),
        ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl || null } : {}),
        ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl || null } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.yearFounded !== undefined ? { yearFounded: input.yearFounded } : {}),
        ...(input.languages ? { languages: stringify(input.languages) } : {}),
      },
    });
    res.json(toOrganizerDetail(organizer));
  }),
);

/* ---------------------------- Verification -------------------------------- */

const verificationSchema = z.object({
  legalName: z.string().trim().min(2, 'Enter the registered legal name.').max(160),
  registrationNumber: z.string().trim().max(80).optional(),
  taxId: z.string().trim().max(80).optional(),
  licenseNumber: z.string().trim().max(80).optional(),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email('Enter a valid contact email.'),
  contactPhone: z.string().trim().min(6, 'Enter a reachable phone number.').max(40),
  addressLine: z.string().trim().max(240).optional(),
  documents: z
    .array(z.object({ label: z.string().trim().max(80), fileName: z.string().trim().max(200) }))
    .max(10)
    .default([]),
  payoutMethod: z.enum(['MOBILE_MONEY', 'BANK']).optional(),
  /** A reference the operator can recognise — never full account credentials. */
  payoutReference: z.string().trim().max(60).optional(),
});

/**
 * Submits verification details for admin review.
 *
 * Nothing here grants a badge. The record goes to PENDING and only an admin
 * decision can move it to VERIFIED — see routes/admin.ts.
 */
workspace.post(
  '/verification',
  route(async (req, res) => {
    const input = verificationSchema.parse(req.body);
    const organizerId = req.auth!.organizerId!;

    const existing = await prisma.organizerVerification.findUnique({ where: { organizerId } });
    if (existing?.status === 'VERIFIED') {
      throw ApiError.conflict('This account is already verified.', 'already_verified');
    }

    const payload = {
      legalName: input.legalName,
      registrationNumber: input.registrationNumber ?? null,
      taxId: input.taxId ?? null,
      licenseNumber: input.licenseNumber ?? null,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      addressLine: input.addressLine ?? null,
      documents: stringify(
        input.documents.map((doc) => ({ ...doc, uploadedAt: new Date().toISOString() })),
      ),
      payoutMethod: input.payoutMethod ?? null,
      payoutReference: input.payoutReference ?? null,
      status: 'PENDING',
      submittedAt: new Date(),
      reviewedAt: null,
      reviewNotes: null,
    };

    await prisma.organizerVerification.upsert({
      where: { organizerId },
      create: { organizerId, ...payload },
      update: payload,
    });

    await prisma.organizer.update({ where: { id: organizerId }, data: { verificationStatus: 'PENDING' } });

    res.status(201).json({ status: 'PENDING' });
  }),
);

/* -------------------------------- Trips ----------------------------------- */

workspace.get(
  '/trips',
  route(async (req, res) => {
    const page = pageParams(req.query as Record<string, unknown>, 20, 60);
    const where: Prisma.TripWhereInput = { organizerId: req.auth!.organizerId! };
    if (typeof req.query.status === 'string' && req.query.status !== 'all') {
      where.status = req.query.status.toUpperCase();
    }

    const [rows, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        include: TRIP_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
      prisma.trip.count({ where }),
    ]);

    res.json(paginated(rows.map(toTripSummary), total, page));
  }),
);

const itinerarySchema = z.array(
  z.object({
    dayNumber: z.number().int().positive(),
    title: z.string().trim().min(2, 'Give the day a title.').max(160),
    summary: z.string().trim().max(2000).optional(),
    activities: z.array(z.string().trim().max(240)).max(20).default([]),
    meals: z.array(z.string().trim().max(40)).max(6).default([]),
    accommodation: z.string().trim().max(160).optional(),
  }),
);

const departureSchema = z.array(
  z.object({
    startDate: z.string(),
    endDate: z.string(),
    capacity: z.number().int().min(1).max(200),
    price: z.number().int().positive().optional().nullable(),
  }),
);

const tripSchema = z.object({
  title: z.string().trim().min(4, 'Give the trip a name.').max(140),
  destinationId: z.string().min(1, 'Choose a destination.'),
  summary: z.string().trim().min(20, 'Write a short summary (at least 20 characters).').max(300),
  description: z.string().trim().min(80, 'Describe the experience in a bit more detail.').max(8000),
  type: z.enum(['GROUP', 'PRIVATE', 'SAFARI', 'BEACH', 'ADVENTURE', 'CULTURAL', 'INTERNATIONAL']),
  style: z.enum(['BUDGET', 'COMFORT', 'LUXURY']).default('COMFORT'),
  durationDays: z.number().int().min(1).max(60),
  durationNights: z.number().int().min(0).max(60),
  basePrice: z.number().int().positive('Enter a price.'),
  currency: z.string().length(3).default('TZS'),
  heroImage: z.string().url('Add a cover image URL.'),
  gallery: z.array(z.string().url()).max(12).default([]),
  tags: z.array(z.string().trim().max(40)).max(10).default([]),
  includes: z.array(z.string().trim().max(160)).max(30).default([]),
  excludes: z.array(z.string().trim().max(160)).max(30).default([]),
  requirements: z.array(z.string().trim().max(240)).max(20).default([]),
  difficulty: z.string().trim().max(40).optional(),
  minAge: z.number().int().min(0).max(99).optional(),
  impactProjectId: z.string().optional().nullable(),
  itinerary: itinerarySchema.default([]),
  departures: departureSchema.default([]),
  /** DRAFT keeps it private; PENDING_REVIEW sends it to the Enhakkore team. */
  submit: z.boolean().default(false),
});

workspace.post(
  '/trips',
  route(async (req, res) => {
    const input = tripSchema.parse(req.body);
    const organizerId = req.auth!.organizerId!;

    const organizer = await prisma.organizer.findUniqueOrThrow({ where: { id: organizerId } });
    if (input.submit && organizer.verificationStatus !== 'VERIFIED') {
      throw ApiError.forbidden(
        'Complete organizer verification before submitting a trip for review.',
      );
    }

    const destination = await prisma.destination.findUnique({ where: { id: input.destinationId } });
    if (!destination) throw ApiError.badRequest('Choose a destination from the list.');

    const trip = await prisma.trip.create({
      data: {
        organizerId,
        destinationId: input.destinationId,
        title: input.title,
        slug: uniqueSlug(input.title),
        summary: input.summary,
        description: input.description,
        type: input.type,
        style: input.style,
        status: input.submit ? 'PENDING_REVIEW' : 'DRAFT',
        submittedAt: input.submit ? new Date() : null,
        durationDays: input.durationDays,
        durationNights: input.durationNights,
        basePrice: input.basePrice,
        currency: input.currency,
        heroImage: input.heroImage,
        gallery: stringify(input.gallery),
        tags: stringify(input.tags),
        includes: stringify(input.includes),
        excludes: stringify(input.excludes),
        requirements: stringify(input.requirements),
        difficulty: input.difficulty ?? null,
        minAge: input.minAge ?? null,
        impactProjectId: input.impactProjectId || null,
        itinerary: {
          create: input.itinerary.map((day) => ({
            dayNumber: day.dayNumber,
            title: day.title,
            summary: day.summary ?? null,
            activities: stringify(day.activities),
            meals: stringify(day.meals),
            accommodation: day.accommodation ?? null,
          })),
        },
        departures: {
          create: input.departures.map((departure) => ({
            startDate: new Date(departure.startDate),
            endDate: new Date(departure.endDate),
            capacity: departure.capacity,
            price: departure.price ?? null,
          })),
        },
      },
      include: { ...TRIP_INCLUDE, itinerary: { orderBy: { dayNumber: 'asc' } }, impactProject: true },
    });

    res.status(201).json(toTripDetail(trip));
  }),
);

workspace.get(
  '/trips/:id',
  route(async (req, res) => {
    const trip = await prisma.trip.findUnique({
      where: { id: req.params.id },
      include: {
        ...TRIP_INCLUDE,
        itinerary: { orderBy: { dayNumber: 'asc' } },
        impactProject: true,
        reviews: { include: { user: true }, orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    // An organizer may only ever reach their own listings.
    if (!trip || trip.organizerId !== req.auth!.organizerId) {
      throw ApiError.notFound('We could not find that trip.');
    }

    res.json(toTripDetail(trip));
  }),
);

workspace.patch(
  '/trips/:id',
  route(async (req, res) => {
    const input = tripSchema.partial().parse(req.body);
    const existing = await prisma.trip.findUnique({ where: { id: req.params.id } });

    if (!existing || existing.organizerId !== req.auth!.organizerId) {
      throw ApiError.notFound('We could not find that trip.');
    }
    if (existing.status === 'ARCHIVED') {
      throw ApiError.unprocessable('Archived trips cannot be edited.', 'archived');
    }

    // Editing a live listing sends it back for review — published content is
    // never changed without the platform seeing it.
    const nextStatus =
      existing.status === 'PUBLISHED' || existing.status === 'APPROVED' ? 'PENDING_REVIEW' : existing.status;

    const trip = await prisma.trip.update({
      where: { id: existing.id },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.destinationId ? { destinationId: input.destinationId } : {}),
        ...(input.summary ? { summary: input.summary } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.style ? { style: input.style } : {}),
        ...(input.durationDays ? { durationDays: input.durationDays } : {}),
        ...(input.durationNights !== undefined ? { durationNights: input.durationNights } : {}),
        ...(input.basePrice ? { basePrice: input.basePrice } : {}),
        ...(input.heroImage ? { heroImage: input.heroImage } : {}),
        ...(input.gallery ? { gallery: stringify(input.gallery) } : {}),
        ...(input.tags ? { tags: stringify(input.tags) } : {}),
        ...(input.includes ? { includes: stringify(input.includes) } : {}),
        ...(input.excludes ? { excludes: stringify(input.excludes) } : {}),
        ...(input.requirements ? { requirements: stringify(input.requirements) } : {}),
        ...(input.difficulty !== undefined ? { difficulty: input.difficulty ?? null } : {}),
        ...(input.minAge !== undefined ? { minAge: input.minAge ?? null } : {}),
        ...(input.impactProjectId !== undefined ? { impactProjectId: input.impactProjectId || null } : {}),
        status: input.submit ? 'PENDING_REVIEW' : nextStatus,
        ...(input.submit ? { submittedAt: new Date() } : {}),
      },
      include: { ...TRIP_INCLUDE, itinerary: { orderBy: { dayNumber: 'asc' } }, impactProject: true },
    });

    if (input.itinerary) {
      await prisma.itineraryDay.deleteMany({ where: { tripId: trip.id } });
      await prisma.itineraryDay.createMany({
        data: input.itinerary.map((day) => ({
          tripId: trip.id,
          dayNumber: day.dayNumber,
          title: day.title,
          summary: day.summary ?? null,
          activities: stringify(day.activities),
          meals: stringify(day.meals),
          accommodation: day.accommodation ?? null,
        })),
      });
    }

    res.json(toTripSummary(trip));
  }),
);

workspace.post(
  '/trips/:id/departures',
  route(async (req, res) => {
    const input = departureSchema.element.parse(req.body);
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip || trip.organizerId !== req.auth!.organizerId) {
      throw ApiError.notFound('We could not find that trip.');
    }

    const departure = await prisma.tripDate.create({
      data: {
        tripId: trip.id,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        capacity: input.capacity,
        price: input.price ?? null,
      },
    });

    const { toTripDate } = await import('../serializers');
    res.status(201).json(toTripDate(departure, trip.currency, trip.basePrice));
  }),
);

workspace.post(
  '/trips/:id/archive',
  route(async (req, res) => {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip || trip.organizerId !== req.auth!.organizerId) {
      throw ApiError.notFound('We could not find that trip.');
    }

    const activeBookings = await prisma.booking.count({
      where: { tripId: trip.id, status: 'CONFIRMED', departure: { startDate: { gte: new Date() } } },
    });
    if (activeBookings > 0) {
      throw ApiError.conflict(
        'This trip has travellers booked on upcoming departures. Contact support to cancel it properly.',
        'has_active_bookings',
      );
    }

    await prisma.trip.update({ where: { id: trip.id }, data: { status: 'ARCHIVED' } });
    res.json({ ok: true });
  }),
);

/* ------------------------------- Bookings --------------------------------- */

workspace.get(
  '/bookings',
  route(async (req, res) => {
    const page = pageParams(req.query as Record<string, unknown>, 20, 60);
    const where: Prisma.BookingWhereInput = { trip: { organizerId: req.auth!.organizerId! } };
    if (typeof req.query.status === 'string' && req.query.status !== 'all') {
      where.status = req.query.status.toUpperCase();
    }
    if (typeof req.query.tripId === 'string') where.tripId = req.query.tripId;

    const [rows, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          trip: { include: TRIP_INCLUDE },
          departure: { include: { conversation: { select: { id: true } } } },
          travellerList: true,
          impactProject: true,
          payments: { orderBy: { createdAt: 'desc' } },
          review: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
      prisma.booking.count({ where }),
    ]);

    res.json(paginated(rows.map(toBooking), total, page));
  }),
);

/* ----------------------------- Announcements ------------------------------ */

const announcementSchema = z.object({
  tripDateId: z.string().min(1),
  body: z.string().trim().min(4, 'Write your announcement.').max(2000),
  pin: z.boolean().default(false),
});

workspace.post(
  '/announcements',
  route(async (req, res) => {
    const input = announcementSchema.parse(req.body);
    const organizerId = req.auth!.organizerId!;

    const departure = await prisma.tripDate.findUnique({
      where: { id: input.tripDateId },
      include: { trip: true, conversation: { include: { members: true } } },
    });

    if (!departure || departure.trip.organizerId !== organizerId) {
      throw ApiError.notFound('We could not find that departure.');
    }
    if (!departure.conversation) {
      throw ApiError.unprocessable('No travellers have joined this departure yet.', 'no_group');
    }

    const message = await prisma.message.create({
      data: {
        conversationId: departure.conversation.id,
        userId: req.auth!.id,
        body: input.body,
        kind: 'ANNOUNCEMENT',
        pinned: input.pin,
      },
      include: { author: true },
    });

    const recipients = departure.conversation.members
      .map((member) => member.userId)
      .filter((userId) => userId !== req.auth!.id);

    for (const userId of recipients) {
      await notify({
        userId,
        type: 'ANNOUNCEMENT',
        title: `Announcement · ${departure.trip.title}`,
        body: input.body.slice(0, 160),
        link: `/trips/groups/${departure.conversation.id}`,
      });
    }

    const { toMessage } = await import('../serializers');
    const { broadcastMessage } = await import('../realtime/socket');
    const dto = toMessage(message, req.auth!.id);
    broadcastMessage(departure.conversation.id, dto);

    res.status(201).json(dto);
  }),
);
