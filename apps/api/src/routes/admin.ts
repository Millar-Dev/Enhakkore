import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { ApiError, pageParams, paginated, route } from '../lib/http';
import { uniqueSlug } from '../lib/ids';
import { stringify } from '../lib/json';
import { prisma } from '../lib/prisma';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { notify } from '../services/notifications';
import { platformStats } from '../services/stats';
import { releaseBooking } from '../services/bookings';
import { paymentGateway } from '../services/payments';
import {
  toBooking,
  toCustomTripRequest,
  toImpactProjectDetail,
  toImpactProjectSummary,
  toOrganizerDetail,
  toPublicUser,
  toReview,
  toTripSummary,
} from '../serializers';

export const adminRouter = Router();

// Every route below is admin-only. Nothing here is reachable by a traveller or
// an organizer, whatever their token claims.
adminRouter.use(requireAuth, requireAdmin);

const TRIP_INCLUDE = {
  destination: true,
  organizer: true,
  departures: { orderBy: { startDate: 'asc' as const } },
};

/* ------------------------------- Overview --------------------------------- */

adminRouter.get(
  '/stats',
  route(async (_req, res) => {
    res.json(await platformStats());
  }),
);

adminRouter.get(
  '/queue',
  route(async (_req, res) => {
    const [organizers, trips, requests, failedPayments] = await Promise.all([
      prisma.organizer.count({ where: { verificationStatus: 'PENDING' } }),
      prisma.trip.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.customTripRequest.count({ where: { status: 'NEW' } }),
      prisma.payment.count({ where: { status: 'FAILED' } }),
    ]);
    res.json({ organizers, trips, requests, failedPayments });
  }),
);

/* --------------------------------- Users ---------------------------------- */

adminRouter.get(
  '/users',
  route(async (req, res) => {
    const page = pageParams(req.query as Record<string, unknown>, 25, 100);
    const where: Prisma.UserWhereInput = {};

    if (typeof req.query.role === 'string' && req.query.role !== 'all') {
      where.role = req.query.role.toUpperCase();
    }
    if (typeof req.query.status === 'string' && req.query.status !== 'all') {
      where.status = req.query.status.toUpperCase();
    }
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const q = req.query.q.trim();
      where.OR = [{ name: { contains: q } }, { email: { contains: q } }];
    }

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { organizer: { select: { id: true } }, _count: { select: { bookings: true } } },
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
      prisma.user.count({ where }),
    ]);

    res.json(
      paginated(
        rows.map((user) => ({ ...toPublicUser(user), bookingCount: user._count.bookings })),
        total,
        page,
      ),
    );
  }),
);

const userStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  reason: z.string().trim().max(300).optional(),
});

adminRouter.post(
  '/users/:id/status',
  route(async (req, res) => {
    const input = userStatusSchema.parse(req.body);

    if (req.params.id === req.auth!.id) {
      throw ApiError.badRequest('You cannot change your own account status.');
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: input.status },
      include: { organizer: { select: { id: true } } },
    });

    // A suspended operator's listings come down with them.
    if (input.status === 'SUSPENDED' && user.organizer) {
      await prisma.organizer.update({
        where: { id: user.organizer.id },
        data: { verificationStatus: 'SUSPENDED' },
      });
      await prisma.trip.updateMany({
        where: { organizerId: user.organizer.id, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      });
    }

    res.json(toPublicUser(user));
  }),
);

/* ------------------------------- Organizers -------------------------------- */

adminRouter.get(
  '/organizers',
  route(async (req, res) => {
    const page = pageParams(req.query as Record<string, unknown>, 25, 100);
    const where: Prisma.OrganizerWhereInput = {};

    if (typeof req.query.status === 'string' && req.query.status !== 'all') {
      where.verificationStatus = req.query.status.toUpperCase();
    }
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      where.companyName = { contains: req.query.q.trim() };
    }

    const [rows, total] = await Promise.all([
      prisma.organizer.findMany({
        where,
        include: {
          verification: true,
          user: { select: { email: true, name: true, status: true } },
          _count: { select: { trips: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
      prisma.organizer.count({ where }),
    ]);

    res.json(
      paginated(
        rows.map((organizer) => ({
          ...toOrganizerDetail(organizer),
          contactEmail: organizer.user.email,
          contactName: organizer.user.name,
          accountStatus: organizer.user.status,
          verification: organizer.verification
            ? {
                legalName: organizer.verification.legalName,
                registrationNumber: organizer.verification.registrationNumber,
                licenseNumber: organizer.verification.licenseNumber,
                contactPhone: organizer.verification.contactPhone,
                status: organizer.verification.status,
                submittedAt: organizer.verification.submittedAt,
                documents: organizer.verification.documents,
              }
            : null,
        })),
        total,
        page,
      ),
    );
  }),
);

const verificationDecision = z.object({
  decision: z.enum(['VERIFIED', 'REJECTED', 'SUSPENDED']),
  notes: z.string().trim().max(1000).optional(),
});

/**
 * The only place a "Verified Organizer" badge is ever granted. It requires an
 * admin decision on a submitted verification record — there is no automatic or
 * self-service path to it.
 */
adminRouter.post(
  '/organizers/:id/verification',
  route(async (req, res) => {
    const input = verificationDecision.parse(req.body);

    const organizer = await prisma.organizer.findUnique({
      where: { id: req.params.id },
      include: { verification: true, user: true },
    });
    if (!organizer) throw ApiError.notFound('We could not find that operator.');
    if (!organizer.verification && input.decision === 'VERIFIED') {
      throw ApiError.unprocessable(
        'This operator has not submitted verification details yet.',
        'no_submission',
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.organizer.update({
        where: { id: organizer.id },
        data: { verificationStatus: input.decision },
      });

      if (organizer.verification) {
        await tx.organizerVerification.update({
          where: { organizerId: organizer.id },
          data: {
            status: input.decision,
            reviewNotes: input.notes ?? null,
            reviewedById: req.auth!.id,
            reviewedAt: new Date(),
          },
        });
      }

      if (input.decision === 'SUSPENDED') {
        await tx.trip.updateMany({
          where: { organizerId: organizer.id, status: 'PUBLISHED' },
          data: { status: 'ARCHIVED' },
        });
      }
    });

    await notify({
      userId: organizer.userId,
      type: 'ORGANIZER_STATUS',
      title:
        input.decision === 'VERIFIED'
          ? 'Your operator account is verified'
          : input.decision === 'REJECTED'
            ? 'Verification needs more information'
            : 'Your operator account is suspended',
      body: input.notes ?? 'Open your dashboard for details.',
      link: '/organizer/verification',
    });

    res.json({ status: input.decision });
  }),
);

const commissionSchema = z.object({ rate: z.number().min(0).max(0.5) });

adminRouter.post(
  '/organizers/:id/commission',
  route(async (req, res) => {
    const input = commissionSchema.parse(req.body);
    const organizer = await prisma.organizer.update({
      where: { id: req.params.id },
      data: { commissionRate: input.rate },
    });
    res.json({ commissionRate: organizer.commissionRate });
  }),
);

/* ---------------------------------- Trips ---------------------------------- */

adminRouter.get(
  '/trips',
  route(async (req, res) => {
    const page = pageParams(req.query as Record<string, unknown>, 25, 100);
    const where: Prisma.TripWhereInput = {};

    if (typeof req.query.status === 'string' && req.query.status !== 'all') {
      where.status = req.query.status.toUpperCase();
    }
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      where.title = { contains: req.query.q.trim() };
    }

    const [rows, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        include: TRIP_INCLUDE,
        orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
        skip: page.skip,
        take: page.take,
      }),
      prisma.trip.count({ where }),
    ]);

    res.json(paginated(rows.map(toTripSummary), total, page));
  }),
);

const tripDecision = z.object({
  decision: z.enum(['PUBLISHED', 'APPROVED', 'REJECTED', 'ARCHIVED']),
  notes: z.string().trim().max(1000).optional(),
});

adminRouter.post(
  '/trips/:id/review',
  route(async (req, res) => {
    const input = tripDecision.parse(req.body);

    const trip = await prisma.trip.findUnique({
      where: { id: req.params.id },
      include: { organizer: true },
    });
    if (!trip) throw ApiError.notFound('We could not find that trip.');

    // A listing cannot go live under an unverified operator, whatever the
    // listing itself looks like.
    if (
      (input.decision === 'PUBLISHED' || input.decision === 'APPROVED') &&
      trip.organizer.verificationStatus !== 'VERIFIED'
    ) {
      throw ApiError.unprocessable(
        'Verify this operator before publishing their listings.',
        'organizer_unverified',
      );
    }

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: {
        status: input.decision,
        reviewNotes: input.notes ?? null,
        reviewedById: req.auth!.id,
        publishedAt: input.decision === 'PUBLISHED' ? new Date() : trip.publishedAt,
      },
      include: TRIP_INCLUDE,
    });

    await notify({
      userId: trip.organizer.userId,
      type: 'TRIP_STATUS',
      title: `${trip.title} — ${input.decision.toLowerCase()}`,
      body: input.notes ?? `Your listing is now ${input.decision.toLowerCase()}.`,
      link: `/organizer/trips/${trip.id}`,
    });

    res.json(toTripSummary(updated));
  }),
);

adminRouter.post(
  '/trips/:id/feature',
  route(async (req, res) => {
    const featured = Boolean(req.body?.featured);
    const trip = await prisma.trip.update({ where: { id: req.params.id }, data: { featured } });
    res.json({ featured: trip.featured });
  }),
);

/* -------------------------------- Bookings --------------------------------- */

adminRouter.get(
  '/bookings',
  route(async (req, res) => {
    const page = pageParams(req.query as Record<string, unknown>, 25, 100);
    const where: Prisma.BookingWhereInput = {};

    if (typeof req.query.status === 'string' && req.query.status !== 'all') {
      where.status = req.query.status.toUpperCase();
    }
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      where.reference = { contains: req.query.q.trim().toUpperCase() };
    }

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
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
      prisma.booking.count({ where }),
    ]);

    res.json(
      paginated(
        rows.map((booking) => ({
          ...toBooking(booking),
          traveller: { name: booking.user.name, email: booking.user.email },
        })),
        total,
        page,
      ),
    );
  }),
);

const refundSchema = z.object({ reason: z.string().trim().max(300).default('Refunded by Enhakkore') });

adminRouter.post(
  '/bookings/:id/refund',
  route(async (req, res) => {
    const input = refundSchema.parse(req.body ?? {});
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) throw ApiError.notFound('We could not find that booking.');

    const payment = await prisma.payment.findFirst({
      where: { bookingId: booking.id, status: 'SUCCEEDED' },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment?.providerRef) {
      throw ApiError.unprocessable('There is no settled payment to refund.', 'no_payment');
    }

    const result = await paymentGateway().refund({
      providerRef: payment.providerRef,
      amount: payment.amount,
      currency: payment.currency,
      reason: input.reason,
    });

    if (result.status !== 'REFUNDED') {
      throw ApiError.unprocessable('The refund could not be completed.', 'refund_failed');
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'REFUNDED', refundedAt: new Date() },
    });
    await releaseBooking(booking.id, input.reason, 'REFUNDED');

    await notify({
      userId: booking.userId,
      type: 'PAYMENT_CONFIRMED',
      title: `Refund issued for ${booking.reference}`,
      body: input.reason,
      link: `/account/bookings/${booking.reference}`,
    });

    res.json({ ok: true, simulated: result.simulated });
  }),
);

/* -------------------------------- Payments --------------------------------- */

adminRouter.get(
  '/payments',
  route(async (req, res) => {
    const page = pageParams(req.query as Record<string, unknown>, 25, 100);
    const where: Prisma.PaymentWhereInput = {};
    if (typeof req.query.status === 'string' && req.query.status !== 'all') {
      where.status = req.query.status.toUpperCase();
    }

    const [rows, total, commissionAgg] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { booking: { select: { reference: true, userId: true, trip: { select: { title: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
      prisma.payment.count({ where }),
      prisma.platformCommission.aggregate({ where: { status: 'EARNED' }, _sum: { amount: true } }),
    ]);

    res.json({
      ...paginated(
        rows.map((payment) => ({
          id: payment.id,
          reference: payment.booking?.reference ?? null,
          tripTitle: payment.booking?.trip?.title ?? null,
          method: payment.method,
          provider: payment.provider,
          providerRef: payment.providerRef,
          status: payment.status,
          amount: { amount: payment.amount, currency: payment.currency },
          simulated: payment.simulated,
          failureCode: payment.failureCode,
          createdAt: payment.createdAt,
        })),
        total,
        page,
      ),
      commissionEarned: { amount: commissionAgg._sum.amount ?? 0, currency: 'TZS' },
    });
  }),
);

/* --------------------------- Impact administration -------------------------- */

const projectSchema = z.object({
  title: z.string().trim().min(4).max(160),
  category: z.enum(['EDUCATION', 'HEALTHCARE', 'CLEAN_WATER', 'COMMUNITY', 'CONSERVATION']),
  summary: z.string().trim().min(20).max(300),
  description: z.string().trim().min(60).max(8000),
  location: z.string().trim().min(2).max(160),
  country: z.string().trim().max(80).default('Tanzania'),
  goal: z.number().int().positive(),
  currency: z.string().length(3).default('TZS'),
  heroImage: z.string().url(),
  gallery: z.array(z.string().url()).max(12).default([]),
  allocation: z
    .array(
      z.object({
        label: z.string().trim().max(80),
        percent: z.number().min(0).max(100),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .max(10)
    .default([]),
  beneficiaries: z.number().int().positive().optional(),
  partnerName: z.string().trim().max(160).optional(),
  partnerNote: z.string().trim().max(400).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'FUNDED', 'COMPLETED', 'PAUSED']).default('DRAFT'),
  featured: z.boolean().default(false),
});

adminRouter.get(
  '/impact/projects',
  route(async (req, res) => {
    const page = pageParams(req.query as Record<string, unknown>, 25, 100);
    const [rows, total] = await Promise.all([
      prisma.impactProject.findMany({
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
      prisma.impactProject.count(),
    ]);
    res.json(paginated(rows.map(toImpactProjectSummary), total, page));
  }),
);

adminRouter.post(
  '/impact/projects',
  route(async (req, res) => {
    const input = projectSchema.parse(req.body);

    const allocationTotal = input.allocation.reduce((sum, line) => sum + line.percent, 0);
    if (input.allocation.length > 0 && Math.round(allocationTotal) !== 100) {
      throw ApiError.badRequest('Allocation lines must add up to 100%.');
    }

    const project = await prisma.impactProject.create({
      data: {
        title: input.title,
        slug: uniqueSlug(input.title),
        category: input.category,
        status: input.status,
        summary: input.summary,
        description: input.description,
        location: input.location,
        country: input.country,
        goal: input.goal,
        currency: input.currency,
        heroImage: input.heroImage,
        gallery: stringify(input.gallery),
        allocation: stringify(input.allocation),
        beneficiaries: input.beneficiaries ?? null,
        partnerName: input.partnerName ?? null,
        partnerNote: input.partnerNote ?? null,
        featured: input.featured,
        startedAt: input.status === 'ACTIVE' ? new Date() : null,
      },
    });

    res.status(201).json(toImpactProjectSummary(project));
  }),
);

adminRouter.patch(
  '/impact/projects/:id',
  route(async (req, res) => {
    const input = projectSchema.partial().parse(req.body);
    const project = await prisma.impactProject.update({
      where: { id: req.params.id },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.summary ? { summary: input.summary } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.location ? { location: input.location } : {}),
        ...(input.country ? { country: input.country } : {}),
        ...(input.goal ? { goal: input.goal } : {}),
        ...(input.heroImage ? { heroImage: input.heroImage } : {}),
        ...(input.gallery ? { gallery: stringify(input.gallery) } : {}),
        ...(input.allocation ? { allocation: stringify(input.allocation) } : {}),
        ...(input.partnerName !== undefined ? { partnerName: input.partnerName ?? null } : {}),
        ...(input.partnerNote !== undefined ? { partnerNote: input.partnerNote ?? null } : {}),
        ...(input.featured !== undefined ? { featured: input.featured } : {}),
        ...(input.status === 'COMPLETED' ? { completedAt: new Date() } : {}),
      },
      include: { updates: { orderBy: { publishedAt: 'desc' } }, trips: { include: TRIP_INCLUDE }, donations: false },
    });
    res.json(toImpactProjectDetail({ ...project, donations: [] }));
  }),
);

const updateSchema = z.object({
  title: z.string().trim().min(4).max(160),
  body: z.string().trim().min(20).max(4000),
  images: z.array(z.string().url()).max(8).default([]),
  milestone: z.boolean().default(false),
  published: z.boolean().default(true),
});

/**
 * Publishes a progress update and tells everyone who contributed. This is the
 * mechanism behind the transparency promise — supporters hear what happened
 * without having to come looking.
 */
adminRouter.post(
  '/impact/projects/:id/updates',
  route(async (req, res) => {
    const input = updateSchema.parse(req.body);

    const project = await prisma.impactProject.findUnique({ where: { id: req.params.id } });
    if (!project) throw ApiError.notFound('We could not find that project.');

    const update = await prisma.impactUpdate.create({
      data: {
        projectId: project.id,
        title: input.title,
        body: input.body,
        images: stringify(input.images),
        milestone: input.milestone,
        published: input.published,
      },
    });

    if (input.published) {
      const supporters = await prisma.donation.findMany({
        where: { projectId: project.id, status: 'SUCCEEDED', userId: { not: null } },
        select: { userId: true },
        distinct: ['userId'],
      });

      for (const supporter of supporters) {
        if (!supporter.userId) continue;
        await notify({
          userId: supporter.userId,
          type: 'IMPACT_UPDATE',
          title: `Update from ${project.title}`,
          body: input.title,
          link: `/impact/${project.slug}`,
        });
      }
    }

    const { toImpactUpdate } = await import('../serializers');
    res.status(201).json(toImpactUpdate(update));
  }),
);

/* --------------------------------- Reviews --------------------------------- */

adminRouter.get(
  '/reviews',
  route(async (req, res) => {
    const page = pageParams(req.query as Record<string, unknown>, 25, 100);
    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        include: { user: true, trip: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
      prisma.review.count(),
    ]);
    res.json(paginated(rows.map(toReview), total, page));
  }),
);

adminRouter.post(
  '/reviews/:id/visibility',
  route(async (req, res) => {
    const published = Boolean(req.body?.published);
    const review = await prisma.review.update({ where: { id: req.params.id }, data: { published } });

    const { refreshRatings } = await import('../services/stats');
    await refreshRatings(review.tripId, review.organizerId);

    res.json({ published: review.published });
  }),
);

/* ------------------------------ Trip requests ------------------------------ */

adminRouter.get(
  '/requests',
  route(async (req, res) => {
    const page = pageParams(req.query as Record<string, unknown>, 25, 100);
    const where: Prisma.CustomTripRequestWhereInput = {};
    if (typeof req.query.status === 'string' && req.query.status !== 'all') {
      where.status = req.query.status.toUpperCase();
    }

    const [rows, total] = await Promise.all([
      prisma.customTripRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
      prisma.customTripRequest.count({ where }),
    ]);

    res.json(paginated(rows.map(toCustomTripRequest), total, page));
  }),
);

adminRouter.post(
  '/requests/:id/status',
  route(async (req, res) => {
    const status = z.enum(['NEW', 'MATCHING', 'QUOTED', 'CONVERTED', 'CLOSED']).parse(req.body?.status);
    const request = await prisma.customTripRequest.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(toCustomTripRequest(request));
  }),
);
