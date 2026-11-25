import { Router } from 'express';
import { z } from 'zod';
import {
  DEFAULT_SETTINGS,
  SENSITIVE_SETTINGS,
  SETTINGS_GROUPS,
  SETTINGS_PERMISSION,
  hasPermission,
  type SettingsGroup,
} from '@enhakkore/shared';
import { ApiError, pageParams, paginated, route } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { textContains } from '../../lib/search';
import { assertPermission, can } from '../../middleware/auth';
import { audit } from '../../services/audit';
import { getSettings, saveSettingsGroup } from '../../services/settings';

export const coreRouter = Router();

/* --------------------------------- Lookups -------------------------------- */
/* Options for the form pickers. Visible to any staff member — they are lists  */
/* of names, nothing private.                                                  */

coreRouter.get(
  '/lookup/countries',
  route(async (_req, res) => {
    const rows = await prisma.country.findMany({
      orderBy: [{ featured: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, code: true, timezone: true, currency: true, status: true, featured: true },
    });
    res.json(rows);
  }),
);

coreRouter.get(
  '/lookup/cities',
  route(async (req, res) => {
    const countryId = typeof req.query.countryId === 'string' ? req.query.countryId : undefined;
    const rows = await prisma.city.findMany({
      where: countryId ? { countryId } : {},
      orderBy: { name: 'asc' },
      select: { id: true, name: true, countryId: true, timezone: true, status: true },
      take: 500,
    });
    res.json(rows);
  }),
);

/** Quick-add a city from inside any form. */
coreRouter.post(
  '/lookup/cities',
  route(async (req, res) => {
    assertPermission(req, 'catalogue.create');
    const input = z
      .object({ countryId: z.string().min(5), name: z.string().trim().min(2).max(80), timezone: z.string().max(60).optional() })
      .parse(req.body);
    const country = await prisma.country.findUnique({ where: { id: input.countryId } });
    if (!country) throw ApiError.badRequest('Choose a country first.');
    const { slugify } = await import('@enhakkore/shared');
    const slug = slugify(input.name);
    const existing = await prisma.city.findUnique({ where: { countryId_slug: { countryId: country.id, slug } } });
    if (existing) return res.json(existing);
    const city = await prisma.city.create({
      data: { countryId: country.id, name: input.name, slug, timezone: input.timezone || null },
    });
    await audit(req, { action: 'create', entityType: 'cities', entityId: city.id, summary: `Added city “${city.name}, ${country.name}”`, after: city });
    res.status(201).json(city);
  }),
);

coreRouter.get(
  '/lookup/categories',
  route(async (req, res) => {
    const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined;
    const rows = await prisma.category.findMany({
      where: kind ? { kind } : {},
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, kind: true, group: true, icon: true, status: true, featured: true },
    });
    res.json(rows);
  }),
);

coreRouter.get(
  '/lookup/places',
  route(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const rows = await prisma.place.findMany({
      where: q ? { name: textContains(q) } : {},
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
      take: 50,
    });
    res.json(rows);
  }),
);

/** Account search for "organiser account" and "managed by" pickers. Names and emails only. */
coreRouter.get(
  '/lookup/users',
  route(async (req, res) => {
    if (!can(req, 'members.view') && !can(req, 'staff.view') && !can(req, 'activities.edit') && !can(req, 'places.edit')) {
      throw ApiError.forbidden();
    }
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const ids = typeof req.query.ids === 'string' ? req.query.ids.split(',').filter(Boolean).slice(0, 20) : [];
    const rows = await prisma.user.findMany({
      where: ids.length ? { id: { in: ids } } : q ? { OR: [{ name: textContains(q) }, { email: textContains(q) }] } : {},
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true },
      take: 20,
    });
    res.json(rows);
  }),
);

/* -------------------------------- Overview -------------------------------- */

coreRouter.get(
  '/overview',
  route(async (req, res) => {
    const now = new Date();
    const counts = await Promise.all([
      prisma.user.count({ where: { role: { in: ['TRAVELER', 'ORGANIZER'] }, isDemo: false } }),
      prisma.activity.count(),
      prisma.activity.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.activity.count({ where: { status: { in: ['PUBLISHED', 'FULL'] } } }),
      prisma.tripDate.count({ where: { startDate: { gte: now }, trip: { organizer: { slug: 'enhakkore' }, status: 'PUBLISHED' } } }),
      prisma.booking.count({ where: { channel: 'APPLICATION', status: { in: ['APPLIED', 'PENDING_PAYMENT'] } } }),
      prisma.booking.count({ where: { channel: 'APPLICATION', status: 'CONFIRMED' } }),
      prisma.event.count({ where: { startsAt: { gte: now }, status: { in: ['PUBLISHED', 'SOLD_OUT'] } } }),
      prisma.eventRegistration.count({ where: { status: 'PENDING_PAYMENT' } }),
      prisma.place.count({ where: { status: 'PUBLISHED' } }),
      prisma.enquiry.count({ where: { status: 'NEW' } }),
      prisma.report.count({ where: { status: 'OPEN' } }),
      prisma.story.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.donation.count({ where: { status: { in: ['PLEDGED', 'PENDING'] }, NOT: { project: { isDemo: true } } } }),
      prisma.placeReview.count({ where: { status: 'PENDING' } }),
    ]);
    const [
      members,
      activities,
      pendingActivities,
      liveActivities,
      upcomingDepartures,
      openApplications,
      confirmedBookings,
      upcomingEvents,
      unpaidRegistrations,
      places,
      newEnquiries,
      openReports,
      pendingStories,
      unverifiedDonations,
      pendingReviews,
    ] = counts;

    // Money only for those allowed to see it, and always per currency.
    let income: { currency: string; amount: number }[] | null = null;
    let expenses: { currency: string; amount: number }[] | null = null;
    let donations: { currency: string; amount: number }[] | null = null;
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    if (can(req, 'finance.view')) {
      const grouped = await prisma.financeTransaction.groupBy({
        by: ['type', 'currency'],
        where: { status: 'VERIFIED', date: { gte: monthStart } },
        _sum: { amount: true },
      });
      income = grouped.filter((row) => row.type === 'INCOME').map((row) => ({ currency: row.currency, amount: row._sum.amount ?? 0 }));
      expenses = grouped.filter((row) => row.type !== 'INCOME').map((row) => ({ currency: row.currency, amount: row._sum.amount ?? 0 }));
    }
    if (can(req, 'donations.view')) {
      const grouped = await prisma.donation.groupBy({
        by: ['currency'],
        where: { status: 'SUCCEEDED', createdAt: { gte: monthStart }, NOT: { project: { isDemo: true } } },
        _sum: { amount: true },
      });
      donations = grouped.map((row) => ({ currency: row.currency, amount: row._sum.amount ?? 0 }));
    }

    const recent = can(req, 'security.view')
      ? await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 })
      : await prisma.auditLog.findMany({ where: { actorId: req.auth!.id }, orderBy: { createdAt: 'desc' }, take: 8 });

    const failedLogins = can(req, 'security.view')
      ? await prisma.loginEvent.count({ where: { success: false, createdAt: { gte: new Date(Date.now() - 86400000) } } })
      : null;

    const alerts: { tone: 'info' | 'warning'; message: string; href: string }[] = [];
    const settings = await getSettings();
    if (!settings.impact.donationAccountConfirmed && can(req, 'donations.view')) {
      alerts.push({
        tone: 'warning',
        message: 'The donation account has not been confirmed as authorised for donations. The Donate page shows a notice until you confirm it in Settings → Impact.',
        href: '/admin/settings?group=impact',
      });
    }
    const storageDurable = process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME;
    if (!storageDurable && process.env.NODE_ENV === 'production' && can(req, 'media.view')) {
      alerts.push({ tone: 'warning', message: 'No image service is connected: uploads will be lost on the next deploy.', href: '/admin/media' });
    }
    if (failedLogins && failedLogins >= 10) {
      alerts.push({ tone: 'warning', message: `${failedLogins} failed sign-in attempts in the last 24 hours.`, href: '/admin/security' });
    }

    res.json({
      counts: {
        members,
        activities,
        pendingActivities,
        liveActivities,
        upcomingDepartures,
        openApplications,
        confirmedBookings,
        upcomingEvents,
        unpaidRegistrations,
        places,
        newEnquiries,
        openReports,
        pendingStories,
        unverifiedDonations,
        pendingReviews,
      },
      money: { monthStart: monthStart.toISOString(), income, expenses, donations },
      visitors: process.env.ANALYTICS_DASHBOARD_URL ? { dashboardUrl: process.env.ANALYTICS_DASHBOARD_URL } : null,
      recent,
      alerts,
    });
  }),
);

/* -------------------------------- Settings -------------------------------- */

coreRouter.get(
  '/settings',
  route(async (req, res) => {
    const settings = await getSettings();
    const visible: Record<string, unknown> = {};
    for (const group of SETTINGS_GROUPS) {
      const permission = SETTINGS_PERMISSION[group];
      const [module] = permission.split('.');
      if (can(req, `${module}.view`) || can(req, permission)) visible[group] = settings[group];
    }
    res.json({ settings: visible, defaults: DEFAULT_SETTINGS, sensitive: SENSITIVE_SETTINGS });
  }),
);

const settingsSchema = z.object({ value: z.unknown(), confirm: z.boolean().optional() });

function validateGroup(group: SettingsGroup, value: unknown): void {
  if (value === null || typeof value !== typeof DEFAULT_SETTINGS[group] || Array.isArray(value) !== Array.isArray(DEFAULT_SETTINGS[group])) {
    throw ApiError.badRequest('That setting has the wrong shape.');
  }
  const text = JSON.stringify(value);
  if (text.length > 200_000) throw ApiError.badRequest('That setting is too large.');
  if (group === 'contact') {
    const contact = value as typeof DEFAULT_SETTINGS.contact;
    for (const number of contact.numbers ?? []) {
      if (!/^\d{7,15}$/.test(String(number.digits ?? ''))) {
        throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', {
          numbers: `“${number.display}”: digits must be the full number with country code, e.g. 255745341440.`,
        });
      }
    }
  }
  if (group === 'social') {
    for (const link of value as typeof DEFAULT_SETTINGS.social) {
      if (!/^https:\/\//.test(String(link.url ?? ''))) {
        throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', { social: `“${link.label}” needs a link starting with https://` });
      }
    }
  }
}

coreRouter.put(
  '/settings/:group',
  route(async (req, res) => {
    const group = req.params.group as SettingsGroup;
    if (!SETTINGS_GROUPS.includes(group)) throw ApiError.notFound('No such settings group.');
    assertPermission(req, SETTINGS_PERMISSION[group]);
    const { value, confirm } = settingsSchema.parse(req.body);
    const sensitive = SENSITIVE_SETTINGS.includes(group);
    if (sensitive && confirm !== true) {
      throw new ApiError(428, 'This is a sensitive change. Confirm it to continue.', 'confirmation_required');
    }
    validateGroup(group, value);
    const change = await saveSettingsGroup(group, value as never);
    await audit(req, {
      action: 'settings',
      entityType: 'settings',
      entityId: group,
      summary: `Changed website settings: ${group}`,
      before: change.before,
      after: change.after,
      sensitive,
    });
    res.json({ ok: true, value: change.after });
  }),
);

/** Previous values of a settings group, newest first, from the audit trail. */
coreRouter.get(
  '/settings/:group/history',
  route(async (req, res) => {
    const group = req.params.group as SettingsGroup;
    if (!SETTINGS_GROUPS.includes(group)) throw ApiError.notFound();
    assertPermission(req, SETTINGS_PERMISSION[group]);
    const rows = await prisma.auditLog.findMany({
      where: { entityType: 'settings', entityId: group },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json(rows);
  }),
);

/** Puts back the value a group had before a given change. */
coreRouter.post(
  '/settings/:group/restore/:auditId',
  route(async (req, res) => {
    const group = req.params.group as SettingsGroup;
    if (!SETTINGS_GROUPS.includes(group)) throw ApiError.notFound();
    assertPermission(req, SETTINGS_PERMISSION[group]);
    if (req.body?.confirm !== true) throw new ApiError(428, 'Confirm the restore to continue.', 'confirmation_required');
    const entry = await prisma.auditLog.findFirst({ where: { id: req.params.auditId, entityType: 'settings', entityId: group } });
    if (!entry?.before) throw ApiError.notFound('That change has no earlier value to restore.');
    const previous = JSON.parse(entry.before);
    validateGroup(group, previous);
    const change = await saveSettingsGroup(group, previous);
    await audit(req, {
      action: 'settings',
      entityType: 'settings',
      entityId: group,
      summary: `Restored website settings: ${group} (to the value before ${entry.createdAt.toISOString().slice(0, 16).replace('T', ' ')})`,
      before: change.before,
      after: change.after,
      sensitive: SENSITIVE_SETTINGS.includes(group),
    });
    res.json({ ok: true, value: change.after });
  }),
);

/* ------------------------------ Media library ----------------------------- */

coreRouter.get(
  '/media',
  route(async (req, res) => {
    assertPermission(req, 'media.view');
    const page = pageParams(req.query as Record<string, unknown>, 48, 120);
    const where: Record<string, unknown> = {};
    if (typeof req.query.folder === 'string' && req.query.folder) where.folder = req.query.folder;
    if (typeof req.query.kind === 'string' && req.query.kind) where.kind = req.query.kind;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) where.OR = [{ title: textContains(q) }, { caption: textContains(q) }, { alt: textContains(q) }];
    const [items, total, folders] = await Promise.all([
      prisma.mediaAsset.findMany({ where, orderBy: { createdAt: 'desc' }, skip: page.skip, take: page.take }),
      prisma.mediaAsset.count({ where }),
      prisma.mediaAsset.groupBy({ by: ['folder'], _count: { _all: true }, orderBy: { folder: 'asc' } }),
    ]);
    res.json({
      ...paginated(items, total, page),
      folders: folders.map((row) => ({ name: row.folder, count: row._count._all })),
    });
  }),
);

const mediaSchema = z.object({
  url: z.string().trim().max(2000).regex(/^(https?:\/\/|\/)/, 'Must be a link.'),
  kind: z.enum(['IMAGE', 'VIDEO']).default('IMAGE'),
  title: z.string().trim().max(200).optional().nullable(),
  alt: z.string().trim().max(300).optional().nullable(),
  caption: z.string().trim().max(1000).optional().nullable(),
  credit: z.string().trim().max(200).optional().nullable(),
  folder: z.string().trim().min(1).max(80).default('General'),
  assetId: z.string().max(300).optional().nullable(),
  bytes: z.number().int().nonnegative().optional().nullable(),
  format: z.string().max(10).optional().nullable(),
});

/** Records an uploaded file (or an external link) in the library. */
coreRouter.post(
  '/media',
  route(async (req, res) => {
    assertPermission(req, 'media.create');
    const input = mediaSchema.parse(req.body);
    const asset = await prisma.mediaAsset.create({ data: { ...input, createdById: req.auth!.id } });
    await audit(req, { action: 'create', entityType: 'media', entityId: asset.id, summary: `Added ${asset.kind.toLowerCase()} “${asset.title ?? asset.url}” to ${asset.folder}` });
    res.status(201).json(asset);
  }),
);

coreRouter.patch(
  '/media/:id',
  route(async (req, res) => {
    assertPermission(req, 'media.edit');
    const input = mediaSchema.pick({ title: true, alt: true, caption: true, credit: true, folder: true }).partial().parse(req.body);
    const before = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: req.params.id } });
    const asset = await prisma.mediaAsset.update({ where: { id: before.id }, data: input });
    await audit(req, { action: 'update', entityType: 'media', entityId: asset.id, summary: `Edited media “${asset.title ?? asset.url}”`, before, after: asset });
    res.json(asset);
  }),
);

coreRouter.delete(
  '/media/:id',
  route(async (req, res) => {
    assertPermission(req, 'media.delete');
    if (req.query.confirm !== 'yes') throw new ApiError(428, 'Deleting cannot be undone. Confirm to continue.', 'confirmation_required');
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: req.params.id } });
    if (asset.isSystem) {
      throw ApiError.badRequest('This file is part of the website (a logo or an original photograph) and cannot be deleted here.');
    }
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
    await audit(req, { action: 'delete', entityType: 'media', entityId: asset.id, summary: `Removed media “${asset.title ?? asset.url}” from the library`, before: asset, sensitive: true });
    res.json({ ok: true, note: 'Removed from the library. Pages already using the file keep working.' });
  }),
);

/** The current user's own permissions, for the dashboard menu. */
coreRouter.get(
  '/me',
  route(async (req, res) => {
    res.json({
      id: req.auth!.id,
      name: req.auth!.name,
      role: req.auth!.role,
      roleName: req.auth!.adminRoleName,
      scope: req.auth!.scope,
      permissions: req.auth!.permissions,
      isOwner: hasPermission(req.auth!.permissions, '*'),
    });
  }),
);
