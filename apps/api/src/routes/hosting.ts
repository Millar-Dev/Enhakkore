import { Router } from 'express';
import { z } from 'zod';
import { EXPERIENCE_SECTIONS, ORGANISER_APPLICATION_LABELS, ORGANISER_APPLICATION_STATUSES } from '@enhakkore/shared';
import { ApiError, pageParams, paginated, route } from '../lib/http';
import { prisma } from '../lib/prisma';
import { assertPermission, requireAuth, requireStaff } from '../middleware/auth';
import { audit } from '../services/audit';
import { notify } from '../services/notifications';

/**
 * Host & Organise: organiser applications.
 *
 * A member applies to organise in one or more Experiences sections. The team
 * checks identity outside the website (a call, a meeting, documents seen) and
 * records only how it was checked — no identity numbers or document images
 * are stored. Approval is per section: someone approved for Sports is not
 * automatically approved for Gaming.
 */
export const hostingMember = Router();
export const hostingAdmin = Router();

const SECTION_KEYS = EXPERIENCE_SECTIONS.map((section) => section.key) as unknown as [string, ...string[]];
const OPEN = ['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO'];

const parseList = (value: string | null | undefined): string[] => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

function view(row: Awaited<ReturnType<typeof prisma.organiserApplication.findFirst>> & {}, staff = false) {
  return {
    id: row.id,
    legalName: row.legalName,
    phone: row.phone,
    email: row.email,
    country: row.country,
    city: row.city,
    categories: parseList(row.categories),
    approvedCategories: parseList(row.approvedCategories),
    hasExperience: row.hasExperience,
    description: row.description,
    links: row.links,
    status: row.status,
    statusLabel: ORGANISER_APPLICATION_LABELS[row.status as keyof typeof ORGANISER_APPLICATION_LABELS] ?? row.status,
    reviewNotes: row.reviewNotes,
    identityChecked: !!row.identityCheckedAt,
    ...(staff ? { identityCheck: row.identityCheck, identityCheckedAt: row.identityCheckedAt, userId: row.userId, reviewedAt: row.reviewedAt } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The sections a member is currently approved to organise in. */
export async function organiserSections(userId: string): Promise<string[]> {
  const row = await prisma.organiserApplication.findFirst({ where: { userId, status: 'APPROVED' }, orderBy: { updatedAt: 'desc' } });
  return row ? parseList(row.approvedCategories) : [];
}

/* --------------------------------- Members --------------------------------- */

hostingMember.get(
  '/organiser-application',
  requireAuth,
  route(async (req, res) => {
    const row = await prisma.organiserApplication.findFirst({ where: { userId: req.auth!.id }, orderBy: { createdAt: 'desc' } });
    res.json({ application: row ? view(row) : null });
  }),
);

const applicationSchema = z.object({
  legalName: z.string().trim().min(3, 'Your full legal name, please.').max(120),
  phone: z.string().trim().min(7, 'A phone or WhatsApp number.').max(30),
  email: z.string().trim().toLowerCase().email('A valid email address.'),
  country: z.string().trim().min(2, 'Choose your country.').max(80),
  city: z.string().trim().min(2, 'Choose your city.').max(80),
  categories: z.array(z.enum(SECTION_KEYS)).min(1, 'Choose at least one category.').max(8),
  hasExperience: z.boolean().default(false),
  description: z.string().trim().min(30, 'Tell us what you would like to organise (a few sentences).').max(4000),
  links: z.string().trim().max(1000).optional().or(z.literal('')),
  agreedRules: z.literal(true, { errorMap: () => ({ message: 'Please agree to the organiser rules.' }) }),
});

/**
 * Submits an application, or updates the open one (for "More information
 * required"). An approved organiser applying again is asking for more
 * sections: that starts a new review without removing current approval.
 */
hostingMember.post(
  '/organiser-application',
  requireAuth,
  route(async (req, res) => {
    const input = applicationSchema.parse(req.body);
    const userId = req.auth!.id;
    const open = await prisma.organiserApplication.findFirst({ where: { userId, status: { in: OPEN } }, orderBy: { createdAt: 'desc' } });
    const suspended = await prisma.organiserApplication.findFirst({ where: { userId, status: 'SUSPENDED' } });
    if (suspended) throw ApiError.forbidden('Your organiser access is suspended. Contact the Enhakkore team.');
    const data = {
      legalName: input.legalName,
      phone: input.phone,
      email: input.email,
      country: input.country,
      city: input.city,
      categories: JSON.stringify(input.categories),
      hasExperience: input.hasExperience,
      description: input.description,
      links: input.links || null,
      agreedRules: true,
    };
    const row = open
      ? await prisma.organiserApplication.update({ where: { id: open.id }, data: { ...data, status: open.status === 'MORE_INFO' ? 'UNDER_REVIEW' : open.status } })
      : await prisma.organiserApplication.create({ data: { ...data, userId, status: 'SUBMITTED' } });
    await notify({
      userId,
      type: 'ORGANISER_APPROVAL',
      title: open ? 'Organiser application updated' : 'Organiser application received',
      body: 'The Enhakkore team reviews every organiser before they can publish. We may contact you to verify your identity.',
      link: '/experiences/host',
    });
    res.status(open ? 200 : 201).json({ application: view(row) });
  }),
);

/* ---------------------------------- Admin ---------------------------------- */

hostingAdmin.use(requireAuth, requireStaff);

hostingAdmin.get(
  '/organiser-applications',
  route(async (req, res) => {
    assertPermission(req, 'experiences.view');
    const params = pageParams(req.query, 20);
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined;
    const where = status ? { status } : {};
    const [rows, total] = await Promise.all([
      prisma.organiserApplication.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: params.skip, take: params.take }),
      prisma.organiserApplication.count({ where }),
    ]);
    const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true, username: true } });
    const byId = new Map(users.map((u) => [u.id, u]));
    res.json(paginated(rows.map((row) => ({ ...view(row, true), account: byId.get(row.userId) ?? null })), total, params));
  }),
);

const reviewSchema = z.object({
  status: z.enum(ORGANISER_APPLICATION_STATUSES),
  approvedCategories: z.array(z.enum(SECTION_KEYS)).max(8).optional(),
  identityCheck: z.string().trim().max(300).optional().or(z.literal('')),
  reviewNotes: z.string().trim().max(2000).optional().or(z.literal('')),
});

/** Reviews an application. Approving needs at least one section and a recorded identity check. */
hostingAdmin.patch(
  '/organiser-applications/:id',
  route(async (req, res) => {
    assertPermission(req, 'experiences.publish');
    const input = reviewSchema.parse(req.body);
    const before = await prisma.organiserApplication.findUnique({ where: { id: req.params.id } });
    if (!before) throw ApiError.notFound('Application not found.');
    const approved = input.approvedCategories ?? parseList(before.approvedCategories);
    const identityCheck = input.identityCheck !== undefined ? input.identityCheck || null : before.identityCheck;
    if (input.status === 'APPROVED') {
      if (approved.length === 0) throw ApiError.badRequest('Choose at least one category to approve.');
      if (!identityCheck) throw ApiError.badRequest('Record how identity was verified before approving (for example "Video call, ID seen"). Do not type ID numbers.');
    }
    if (input.status === 'MORE_INFO' && !(input.reviewNotes || before.reviewNotes)) {
      throw ApiError.badRequest('Say what information is needed — the applicant sees this note.');
    }
    const row = await prisma.organiserApplication.update({
      where: { id: before.id },
      data: {
        status: input.status,
        approvedCategories: JSON.stringify(input.status === 'APPROVED' ? approved : input.status === 'REJECTED' ? [] : approved),
        identityCheck,
        identityCheckedAt: identityCheck && !before.identityCheckedAt ? new Date() : identityCheck ? before.identityCheckedAt : null,
        reviewNotes: input.reviewNotes !== undefined ? input.reviewNotes || null : before.reviewNotes,
        reviewedById: req.auth!.id,
        reviewedAt: new Date(),
      },
    });
    await audit(req, {
      action: 'organiser_application.review',
      entityType: 'OrganiserApplication',
      entityId: row.id,
      summary: `${row.legalName}: ${before.status} → ${row.status}`,
      before: { status: before.status, approvedCategories: parseList(before.approvedCategories) },
      after: { status: row.status, approvedCategories: parseList(row.approvedCategories) },
    });
    if (before.status !== row.status) {
      const label = ORGANISER_APPLICATION_LABELS[row.status as keyof typeof ORGANISER_APPLICATION_LABELS];
      await notify({
        userId: row.userId,
        type: 'ORGANISER_APPROVAL',
        title: `Organiser application: ${label}`,
        body:
          row.status === 'APPROVED'
            ? 'You can now submit experiences in your approved categories. Each one is still reviewed before it is published.'
            : row.reviewNotes || 'Open Host & Organise to see the details.',
        link: '/experiences/host',
      });
    }
    res.json({ application: view(row, true) });
  }),
);
