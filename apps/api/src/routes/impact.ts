import { Router } from 'express';
import { z } from 'zod';
import { IMPACT_CATEGORIES, money } from '@enhakkore/shared';
import { ApiError, pageParams, paginated, route } from '../lib/http';
import { prisma } from '../lib/prisma';
import { paymentGateway } from '../services/payments';
import { paymentReference } from '../lib/ids';
import { optionalAuth } from '../middleware/auth';
import { toImpactProjectDetail, toImpactProjectSummary } from '../serializers';

export const impactRouter = Router();

const listQuery = z.object({
  category: z.string().trim().optional(),
  status: z.string().trim().optional(),
  q: z.string().trim().max(120).optional(),
  featured: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

impactRouter.get(
  '/projects',
  route(async (req, res) => {
    const query = listQuery.parse(req.query);
    const page = pageParams(query as Record<string, unknown>, 9, 48);

    const where: Record<string, unknown> = {
      // Drafts are internal; the public list shows live and finished work.
      status: { in: ['ACTIVE', 'FUNDED', 'COMPLETED'] },
    };

    const categories = (query.category ?? '')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter((c) => IMPACT_CATEGORIES.includes(c as never));
    if (categories.length) where.category = { in: categories };

    if (query.status) where.status = query.status.toUpperCase();
    if (query.featured) where.featured = true;
    if (query.q) {
      where.OR = [
        { title: { contains: query.q } },
        { summary: { contains: query.q } },
        { location: { contains: query.q } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.impactProject.findMany({
        where,
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        skip: page.skip,
        take: page.take,
      }),
      prisma.impactProject.count({ where }),
    ]);

    res.json(paginated(rows.map(toImpactProjectSummary), total, page));
  }),
);

/** Headline numbers for the impact dashboard. Derived, never hand-entered. */
impactRouter.get(
  '/summary',
  route(async (_req, res) => {
    const [donationAgg, contributors, projects, communities, demoCount] = await Promise.all([
      prisma.donation.aggregate({ where: { status: 'SUCCEEDED' }, _sum: { amount: true }, _count: true }),
      prisma.donation.findMany({ where: { status: 'SUCCEEDED' }, select: { userId: true }, distinct: ['userId'] }),
      prisma.impactProject.findMany({
        where: { status: { in: ['ACTIVE', 'FUNDED', 'COMPLETED'] } },
        select: { id: true, status: true, location: true, country: true, category: true },
      }),
      prisma.impactProject.findMany({ select: { location: true }, distinct: ['location'] }),
      prisma.impactProject.count({ where: { isDemo: true } }),
    ]);

    const byCategory = projects.reduce<Record<string, number>>((acc, project) => {
      acc[project.category] = (acc[project.category] ?? 0) + 1;
      return acc;
    }, {});

    res.json({
      totalContributions: money(donationAgg._sum.amount ?? 0),
      contributionCount: donationAgg._count,
      travellersInvolved: contributors.filter((c) => c.userId).length,
      projectsSupported: projects.length,
      projectsCompleted: projects.filter((p) => p.status === 'COMPLETED').length,
      communitiesReached: communities.length,
      countries: [...new Set(projects.map((p) => p.country))].length,
      byCategory,
      // The client uses this to label demo figures rather than present them as
      // achievements.
      isDemoData: demoCount > 0,
    });
  }),
);

impactRouter.get(
  '/projects/:slug',
  route(async (req, res) => {
    const project = await prisma.impactProject.findUnique({
      where: { slug: req.params.slug },
      include: {
        updates: { where: { published: true }, orderBy: { publishedAt: 'desc' } },
        trips: {
          where: { status: 'PUBLISHED' },
          include: { destination: true, organizer: true, departures: { orderBy: { startDate: 'asc' } } },
          take: 6,
        },
        donations: {
          where: { status: 'SUCCEEDED' },
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!project || project.status === 'DRAFT') {
      throw ApiError.notFound('We could not find that project.');
    }

    res.json(toImpactProjectDetail(project));
  }),
);

const donateSchema = z.object({
  amount: z.number().int().positive('Enter an amount greater than zero.'),
  currency: z.string().length(3).default('TZS'),
  anonymous: z.boolean().default(false),
  message: z.string().trim().max(400).optional(),
  donorName: z.string().trim().max(80).optional(),
  donorEmail: z.string().trim().email().optional(),
  paymentMethod: z.enum(['MOCK', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER']).default('MOCK'),
  paymentInstrument: z.string().trim().max(40).optional(),
});

/**
 * Standalone contribution to a project (outside a booking).
 *
 * Runs through the same payment gateway seam as checkout, so when a real rail is
 * connected donations settle through it too. Only successful charges move the
 * project's raised total.
 */
impactRouter.post(
  '/projects/:slug/donate',
  optionalAuth,
  route(async (req, res) => {
    const input = donateSchema.parse(req.body);

    const project = await prisma.impactProject.findUnique({ where: { slug: req.params.slug } });
    if (!project) throw ApiError.notFound('We could not find that project.');
    if (project.status === 'DRAFT' || project.status === 'PAUSED') {
      throw ApiError.unprocessable('This project is not accepting contributions right now.', 'project_closed');
    }

    const donor = req.auth ? await prisma.user.findUnique({ where: { id: req.auth.id } }) : null;
    const donorName = input.anonymous ? null : donor?.name ?? input.donorName ?? null;

    if (!donor && !input.donorEmail) {
      throw ApiError.badRequest('Enter an email so we can send your receipt.');
    }

    const gateway = paymentGateway();
    const result = await gateway.charge({
      bookingId: `donation:${project.id}`,
      reference: paymentReference('DON'),
      amount: input.amount,
      currency: input.currency,
      method: input.paymentMethod,
      instrument: input.paymentInstrument,
      customer: {
        id: donor?.id ?? 'guest',
        name: donor?.name ?? input.donorName ?? 'Guest',
        email: donor?.email ?? input.donorEmail ?? 'guest@enhakkore.local',
      },
    });

    const donation = await prisma.donation.create({
      data: {
        projectId: project.id,
        userId: donor?.id ?? null,
        amount: input.amount,
        currency: input.currency,
        status: result.status,
        anonymous: input.anonymous,
        message: input.message ?? null,
        donorName,
      },
    });

    if (result.status === 'SUCCEEDED') {
      await prisma.impactProject.update({
        where: { id: project.id },
        data: { raised: { increment: input.amount }, contributorCount: { increment: 1 } },
      });
    }

    res.status(result.status === 'SUCCEEDED' ? 201 : 402).json({
      donationId: donation.id,
      status: result.status,
      simulated: result.simulated,
      message: result.message,
    });
  }),
);

impactRouter.get(
  '/projects/:slug/updates',
  route(async (req, res) => {
    const project = await prisma.impactProject.findUnique({
      where: { slug: req.params.slug },
      select: { id: true },
    });
    if (!project) throw ApiError.notFound('We could not find that project.');

    const updates = await prisma.impactUpdate.findMany({
      where: { projectId: project.id, published: true },
      orderBy: { publishedAt: 'desc' },
    });

    const { toImpactUpdate } = await import('../serializers');
    res.json({ items: updates.map(toImpactUpdate) });
  }),
);
