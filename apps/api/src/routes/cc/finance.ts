import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  DIVISIONS,
  DONATION_STATUSES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_RECORD_METHODS,
  RELATED_TYPES,
  SUPPORTED_CURRENCIES,
  toMajor,
  toMinor,
} from '@enhakkore/shared';
import { ApiError, pageParams, paginated, route } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { textContains } from '../../lib/search';
import { assertPermission } from '../../middleware/auth';
import { audit, changedFields } from '../../services/audit';
import { byCurrency } from '../../services/ledger';

/**
 * The money side of the control centre.
 *
 * Two ledgers, deliberately apart: `FinanceTransaction` is Enhakkore's
 * business (income, expenses, refunds) and `Donation` is money given to impact
 * work. No report here ever adds one to the other, and no total ever adds two
 * currencies together — every sum is keyed by currency.
 */
export const financeRouter = Router();

const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const dateParam = (value: unknown) => {
  const raw = str(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  return raw;
};

function transactionWhere(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {};
  const type = str(query.type);
  if (type && type !== 'all') where.type = type;
  const status = str(query.status);
  if (status && status !== 'all') where.status = status;
  else where.status = { not: 'CANCELLED' };
  for (const key of ['division', 'category', 'currency', 'relatedType', 'relatedId', 'paymentMethod']) {
    const value = str(query[key]);
    if (value && value !== 'all') where[key] = value;
  }
  const from = dateParam(query.from);
  const to = dateParam(query.to);
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59Z`) } : {}),
    };
  }
  const q = str(query.q);
  if (q) where.OR = [{ reference: textContains(q) }, { counterparty: textContains(q) }, { notes: textContains(q) }, { relatedLabel: textContains(q) }];
  return where;
}

/* ------------------------------ Transactions ------------------------------ */

financeRouter.get(
  '/transactions',
  route(async (req, res) => {
    assertPermission(req, 'finance.view');
    const page = pageParams(req.query as Record<string, unknown>, 50, 200);
    const where = transactionWhere(req.query as Record<string, unknown>);
    const [items, total, sums] = await Promise.all([
      prisma.financeTransaction.findMany({ where, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], skip: page.skip, take: page.take }),
      prisma.financeTransaction.count({ where }),
      prisma.financeTransaction.groupBy({ by: ['type', 'currency'], where, _sum: { amount: true } }),
    ]);
    res.json({ ...paginated(items, total, page), totals: sums.map((row) => ({ type: row.type, currency: row.currency, amount: row._sum.amount ?? 0 })) });
  }),
);

const transactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE', 'REFUND']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.'),
  amount: z.number({ invalid_type_error: 'Enter an amount.' }).positive('Enter an amount above zero.').max(1e12),
  currency: z.enum(SUPPORTED_CURRENCIES),
  division: z.enum(DIVISIONS),
  category: z.enum([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, 'REFUND'] as [string, ...string[]]),
  relatedType: z.enum(RELATED_TYPES).default('NONE'),
  relatedId: z.string().max(60).optional().nullable(),
  relatedLabel: z.string().max(200).optional().nullable(),
  paymentMethod: z.enum(PAYMENT_RECORD_METHODS).optional().nullable(),
  reference: z.string().trim().max(120).optional().nullable(),
  counterparty: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(3000).optional().nullable(),
  status: z.enum(['PENDING', 'VERIFIED', 'CANCELLED']).default('PENDING'),
  receiptUrl: z.string().trim().max(2000).optional().nullable(),
});

async function relatedLabelFor(type: string, id: string | null | undefined): Promise<string | null> {
  if (!id || type === 'NONE') return null;
  if (type === 'TRIP_DEPARTURE') {
    const departure = await prisma.tripDate.findUnique({ where: { id }, include: { trip: { select: { title: true } } } });
    if (!departure) throw ApiError.badRequest('That departure no longer exists.');
    return `${departure.trip.title} · ${departure.startDate.toISOString().slice(0, 10)}`;
  }
  const model = { EVENT: 'event', EXPERIENCE: 'experience', ACTIVITY: 'activity', PLACE: 'place', CATERING: 'cateringPackage' }[type];
  if (!model) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = await (prisma as any)[model].findUnique({ where: { id } });
  if (!row) throw ApiError.badRequest('The linked item no longer exists.');
  return row.title ?? row.name ?? null;
}

function checkCategory(type: string, category: string) {
  const ok =
    (type === 'INCOME' && (INCOME_CATEGORIES as readonly string[]).includes(category)) ||
    (type === 'EXPENSE' && (EXPENSE_CATEGORIES as readonly string[]).includes(category)) ||
    (type === 'REFUND' && category === 'REFUND');
  if (!ok) throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', { category: 'Choose a category that fits the type.' });
}

financeRouter.post(
  '/transactions',
  route(async (req, res) => {
    assertPermission(req, 'finance.create');
    const input = transactionSchema.parse(req.body);
    checkCategory(input.type, input.category);
    if (input.status === 'VERIFIED') assertPermission(req, 'finance.publish');
    const row = await prisma.financeTransaction.create({
      data: {
        ...input,
        amount: toMinor(input.amount, input.currency),
        date: new Date(`${input.date}T12:00:00Z`),
        relatedId: input.relatedType === 'NONE' ? null : (input.relatedId ?? null),
        relatedLabel: (await relatedLabelFor(input.relatedType, input.relatedId)) ?? input.relatedLabel ?? null,
        createdById: req.auth!.id,
        ...(input.status === 'VERIFIED' ? { verifiedById: req.auth!.id, verifiedAt: new Date() } : {}),
      },
    });
    await audit(req, {
      action: 'finance',
      entityType: 'transactions',
      entityId: row.id,
      summary: `Recorded ${input.type.toLowerCase()} of ${input.amount} ${input.currency} (${input.category})`,
      after: row,
      sensitive: true,
    });
    res.status(201).json(row);
  }),
);

financeRouter.patch(
  '/transactions/:id',
  route(async (req, res) => {
    assertPermission(req, 'finance.edit');
    const before = await prisma.financeTransaction.findUniqueOrThrow({ where: { id: req.params.id } });
    if (before.bookingId || before.registrationId) {
      // Lines written by a recorded booking payment are changed by refunding
      // on the booking, so the booking's paid total never disagrees with the books.
      const allowed = z.object({ notes: z.string().max(3000).optional().nullable(), receiptUrl: z.string().max(2000).optional().nullable() }).parse(req.body);
      const row = await prisma.financeTransaction.update({ where: { id: before.id }, data: allowed });
      return res.json(row);
    }
    const input = transactionSchema.partial().parse(req.body);
    const type = input.type ?? before.type;
    const currency = input.currency ?? before.currency;
    if (input.category || input.type) checkCategory(type, input.category ?? before.category);
    if (input.status && input.status !== before.status && (input.status === 'VERIFIED' || before.status === 'VERIFIED')) {
      assertPermission(req, 'finance.publish');
    }
    const data: Record<string, unknown> = { ...input };
    if (input.amount !== undefined) data.amount = toMinor(input.amount, currency);
    if (input.date) data.date = new Date(`${input.date}T12:00:00Z`);
    if (input.relatedType || input.relatedId !== undefined) {
      data.relatedLabel = (await relatedLabelFor(input.relatedType ?? before.relatedType, input.relatedId ?? before.relatedId)) ?? input.relatedLabel ?? null;
    }
    if (input.status === 'VERIFIED' && before.status !== 'VERIFIED') {
      data.verifiedById = req.auth!.id;
      data.verifiedAt = new Date();
    }
    const row = await prisma.financeTransaction.update({ where: { id: before.id }, data });
    const diff = changedFields(before, row);
    await audit(req, { action: 'finance', entityType: 'transactions', entityId: row.id, summary: `Edited ${row.type.toLowerCase()} ${toMajor(row.amount, row.currency)} ${row.currency}`, before: diff.before, after: diff.after, sensitive: true });
    res.json(row);
  }),
);

/** Transactions are never deleted, only cancelled, so the books keep their history. */
financeRouter.post(
  '/transactions/:id/cancel',
  route(async (req, res) => {
    assertPermission(req, 'finance.delete');
    const before = await prisma.financeTransaction.findUniqueOrThrow({ where: { id: req.params.id } });
    if (before.bookingId || before.registrationId) {
      throw ApiError.unprocessable('This line came from a recorded booking payment. Use Refund on the booking instead.');
    }
    const { reason } = z.object({ reason: z.string().trim().min(3, 'Say why.').max(500) }).parse(req.body);
    const row = await prisma.financeTransaction.update({
      where: { id: before.id },
      data: { status: 'CANCELLED', notes: `${before.notes ? `${before.notes}\n` : ''}Cancelled: ${reason}` },
    });
    await audit(req, { action: 'finance', entityType: 'transactions', entityId: row.id, summary: `Cancelled ${row.type.toLowerCase()} ${toMajor(row.amount, row.currency)} ${row.currency}: ${reason}`, sensitive: true });
    res.json(row);
  }),
);

/* -------------------------------- Reports --------------------------------- */

type Sums = Record<string, number>;
const add = (target: Sums, currency: string, amount: number) => {
  target[currency] = (target[currency] ?? 0) + amount;
};

/**
 * Totals, profit, monthly and yearly breakdowns, income by division,
 * profitability per trip departure and per event, outstanding payments and
 * refunds. Everything per currency. Verified lines only.
 */
financeRouter.get(
  '/reports',
  route(async (req, res) => {
    assertPermission(req, 'finance.view');
    const year = Number(req.query.year) || new Date().getUTCFullYear();
    const from = dateParam(req.query.from) ?? `${year}-01-01`;
    const to = dateParam(req.query.to) ?? `${year}-12-31`;
    const lines = await prisma.financeTransaction.findMany({
      where: { status: 'VERIFIED', date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T23:59:59Z`) } },
      orderBy: { date: 'asc' },
    });

    const income: Sums = {};
    const expenses: Sums = {};
    const refunds: Sums = {};
    const monthly: Record<string, { income: Sums; expenses: Sums; refunds: Sums }> = {};
    const byDivision: Record<string, Sums> = {};
    const expenseByCategory: Record<string, Sums> = {};
    const departures: Record<string, { label: string; income: Sums; expenses: Sums; refunds: Sums }> = {};
    const events: Record<string, { label: string; income: Sums; expenses: Sums; refunds: Sums }> = {};

    for (const line of lines) {
      const month = line.date.toISOString().slice(0, 7);
      monthly[month] ??= { income: {}, expenses: {}, refunds: {} };
      const bucket = line.type === 'INCOME' ? 'income' : line.type === 'EXPENSE' ? 'expenses' : 'refunds';
      add({ income, expenses, refunds }[bucket], line.currency, line.amount);
      add(monthly[month]![bucket], line.currency, line.amount);
      if (line.type === 'INCOME') {
        byDivision[line.division] ??= {};
        add(byDivision[line.division]!, line.currency, line.amount);
      }
      if (line.type === 'EXPENSE') {
        expenseByCategory[line.category] ??= {};
        add(expenseByCategory[line.category]!, line.currency, line.amount);
      }
      const target = line.relatedType === 'TRIP_DEPARTURE' ? departures : line.relatedType === 'EVENT' ? events : null;
      if (target && line.relatedId) {
        target[line.relatedId] ??= { label: line.relatedLabel ?? line.relatedId, income: {}, expenses: {}, refunds: {} };
        add(target[line.relatedId]![bucket], line.currency, line.amount);
      }
    }

    const net = (entry: { income: Sums; expenses: Sums; refunds: Sums }): Sums => {
      const out: Sums = {};
      for (const currency of new Set([...Object.keys(entry.income), ...Object.keys(entry.expenses), ...Object.keys(entry.refunds)])) {
        out[currency] = (entry.income[currency] ?? 0) - (entry.refunds[currency] ?? 0) - (entry.expenses[currency] ?? 0);
      }
      return out;
    };

    // Money still owed on live bookings and registrations.
    const [openBookings, openRegistrations, pendingLines] = await Promise.all([
      prisma.booking.findMany({
        where: { channel: 'APPLICATION', status: { in: ['APPLIED', 'PENDING_PAYMENT', 'CONFIRMED'] } },
        select: { reference: true, totalAmount: true, amountPaid: true, currency: true, user: { select: { name: true } }, trip: { select: { title: true } } },
      }),
      prisma.eventRegistration.findMany({
        where: { status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] } },
        select: { reference: true, amountDue: true, amountPaid: true, currency: true, name: true, event: { select: { title: true } } },
      }),
      prisma.financeTransaction.groupBy({ by: ['type', 'currency'], where: { status: 'PENDING' }, _sum: { amount: true } }),
    ]);
    const outstandingItems = [
      ...openBookings
        .filter((row) => row.totalAmount > row.amountPaid)
        .map((row) => ({ kind: 'Trip', reference: row.reference, who: row.user.name, what: row.trip.title, currency: row.currency, amount: row.totalAmount - row.amountPaid })),
      ...openRegistrations
        .filter((row) => row.amountDue > row.amountPaid)
        .map((row) => ({ kind: 'Event', reference: row.reference, who: row.name, what: row.event.title, currency: row.currency, amount: row.amountDue - row.amountPaid })),
    ];

    res.json({
      period: { from, to },
      totals: { income, expenses, refunds, net: net({ income, expenses, refunds }) },
      monthly: Object.entries(monthly).map(([month, entry]) => ({ month, ...entry, net: net(entry) })),
      byDivision,
      expenseByCategory,
      departures: Object.entries(departures).map(([id, entry]) => ({ id, ...entry, net: net(entry) })),
      events: Object.entries(events).map(([id, entry]) => ({ id, ...entry, net: net(entry) })),
      outstanding: { total: byCurrency(outstandingItems), items: outstandingItems },
      pending: pendingLines.map((row) => ({ type: row.type, currency: row.currency, amount: row._sum.amount ?? 0 })),
      cashFlow: Object.entries(monthly).map(([month, entry]) => ({ month, in: entry.income, out: Object.fromEntries(Object.keys({ ...entry.expenses, ...entry.refunds }).map((c) => [c, (entry.expenses[c] ?? 0) + (entry.refunds[c] ?? 0)])) })),
    });
  }),
);

/* --------------------------------- Export --------------------------------- */

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  // Neutralise spreadsheet formulas (=, +, -, @) so an exported note cannot run as one.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function sendCsv(res: Response, filename: string, header: string[], rows: unknown[][]) {
  const body = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  // BOM so Excel opens accented names correctly.
  res.send(`﻿${body}`);
}

financeRouter.get(
  '/export/transactions.csv',
  route(async (req, res) => {
    assertPermission(req, 'finance.export');
    const rows = await prisma.financeTransaction.findMany({ where: transactionWhere(req.query as Record<string, unknown>), orderBy: { date: 'asc' } });
    await audit(req, { action: 'export', entityType: 'transactions', summary: `Exported ${rows.length} finance transactions to CSV`, sensitive: true });
    sendCsv(
      res,
      `enhakkore-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Type', 'Amount', 'Currency', 'Division', 'Category', 'Related to', 'Payment method', 'Reference', 'Customer / supplier', 'Status', 'Notes'],
      rows.map((row) => [row.date, row.type, toMajor(row.amount, row.currency), row.currency, row.division, row.category, row.relatedLabel, row.paymentMethod, row.reference, row.counterparty, row.status, row.notes]),
    );
  }),
);

/* -------------------------------- Donations ------------------------------- */
/* Kept apart from everything above. Never income, never profit.              */

financeRouter.get(
  '/donations',
  route(async (req, res) => {
    assertPermission(req, 'donations.view');
    const page = pageParams(req.query as Record<string, unknown>, 50, 200);
    // Demonstration projects from the development seed are never counted.
    const where: Record<string, unknown> = { NOT: { project: { isDemo: true } } };
    const status = str(req.query.status);
    if (status && status !== 'all') where.status = status;
    const projectId = str(req.query.projectId);
    if (projectId) where.projectId = projectId === 'none' ? null : projectId;
    const q = str(req.query.q);
    if (q) where.OR = [{ donorName: textContains(q) }, { reference: textContains(q) }, { donorPhone: textContains(q) }];
    const [items, total, totals] = await Promise.all([
      prisma.donation.findMany({ where, include: { project: { select: { title: true, slug: true } } }, orderBy: { createdAt: 'desc' }, skip: page.skip, take: page.take }),
      prisma.donation.count({ where }),
      prisma.donation.groupBy({ by: ['status', 'currency'], where: { NOT: { project: { isDemo: true } } }, _sum: { amount: true } }),
    ]);
    res.json({ ...paginated(items, total, page), totals: totals.map((row) => ({ status: row.status, currency: row.currency, amount: row._sum.amount ?? 0 })) });
  }),
);

const donationSchema = z.object({
  projectId: z.string().max(60).optional().nullable(),
  amount: z.number().positive().max(1e12),
  currency: z.enum(SUPPORTED_CURRENCIES),
  donorName: z.string().trim().max(160).optional().nullable(),
  donorPhone: z.string().trim().max(40).optional().nullable(),
  donorEmail: z.string().trim().max(200).optional().nullable(),
  anonymous: z.boolean().default(false),
  method: z.enum(['BANK_TRANSFER', 'MOBILE_MONEY', 'CASH', 'OTHER']).default('BANK_TRANSFER'),
  reference: z.string().trim().max(120).optional().nullable(),
  receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(DONATION_STATUSES).default('PENDING'),
  notes: z.string().trim().max(3000).optional().nullable(),
  message: z.string().trim().max(1000).optional().nullable(),
  receiptUrl: z.string().trim().max(2000).optional().nullable(),
});

/** Keeps the project's public total equal to its verified donations, always recomputed rather than incremented. */
async function refreshProjectTotals(projectId: string | null | undefined) {
  if (!projectId) return;
  const verified = await prisma.donation.findMany({ where: { projectId, status: 'SUCCEEDED' }, select: { amount: true, currency: true, userId: true, donorName: true } });
  const project = await prisma.impactProject.findUnique({ where: { id: projectId } });
  if (!project) return;
  const raised = verified.filter((row) => row.currency === project.currency).reduce((sum, row) => sum + row.amount, 0);
  await prisma.impactProject.update({ where: { id: projectId }, data: { raised, contributorCount: verified.length } });
}

financeRouter.post(
  '/donations',
  route(async (req, res) => {
    assertPermission(req, 'donations.create');
    const input = donationSchema.parse(req.body);
    if (input.status === 'SUCCEEDED') assertPermission(req, 'donations.publish');
    if (input.projectId && !(await prisma.impactProject.findUnique({ where: { id: input.projectId } }))) throw ApiError.badRequest('Choose a project from the list.');
    const donation = await prisma.donation.create({
      data: {
        ...input,
        projectId: input.projectId || null,
        amount: toMinor(input.amount, input.currency),
        receivedAt: input.receivedAt ? new Date(`${input.receivedAt}T12:00:00Z`) : null,
        ...(input.status === 'SUCCEEDED' ? { verifiedById: req.auth!.id, verifiedAt: new Date() } : {}),
      },
    });
    await refreshProjectTotals(donation.projectId);
    await audit(req, { action: 'donation', entityType: 'donations', entityId: donation.id, summary: `Recorded donation of ${input.amount} ${input.currency} (${input.status})`, after: donation, sensitive: true });
    res.status(201).json(donation);
  }),
);

financeRouter.patch(
  '/donations/:id',
  route(async (req, res) => {
    assertPermission(req, 'donations.edit');
    const before = await prisma.donation.findUniqueOrThrow({ where: { id: req.params.id } });
    if (before.method === 'CHECKOUT' && before.bookingId) throw ApiError.unprocessable('This contribution came through a trip checkout and is changed from the booking.');
    const input = donationSchema.partial().parse(req.body);
    if (input.status && input.status !== before.status && (input.status === 'SUCCEEDED' || before.status === 'SUCCEEDED')) {
      assertPermission(req, 'donations.publish');
    }
    const currency = input.currency ?? before.currency;
    const data: Record<string, unknown> = { ...input };
    if (input.amount !== undefined) data.amount = toMinor(input.amount, currency);
    if (input.receivedAt !== undefined) data.receivedAt = input.receivedAt ? new Date(`${input.receivedAt}T12:00:00Z`) : null;
    if (input.projectId !== undefined) data.projectId = input.projectId || null;
    if (input.status === 'SUCCEEDED' && before.status !== 'SUCCEEDED') {
      data.verifiedById = req.auth!.id;
      data.verifiedAt = new Date();
    }
    const donation = await prisma.donation.update({ where: { id: before.id }, data });
    await refreshProjectTotals(before.projectId);
    if (donation.projectId !== before.projectId) await refreshProjectTotals(donation.projectId);
    const diff = changedFields(before, donation);
    await audit(req, { action: 'donation', entityType: 'donations', entityId: donation.id, summary: `Updated donation ${toMajor(donation.amount, donation.currency)} ${donation.currency} → ${donation.status}`, before: diff.before, after: diff.after, sensitive: true });
    res.json(donation);
  }),
);

financeRouter.get(
  '/export/donations.csv',
  route(async (req, res) => {
    assertPermission(req, 'donations.export');
    const rows = await prisma.donation.findMany({ where: { NOT: { project: { isDemo: true } } }, include: { project: { select: { title: true } } }, orderBy: { createdAt: 'asc' } });
    await audit(req, { action: 'export', entityType: 'donations', summary: `Exported ${rows.length} donations to CSV`, sensitive: true });
    sendCsv(
      res,
      `enhakkore-donations-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Recorded', 'Received', 'Amount', 'Currency', 'Project', 'Donor', 'Phone', 'Method', 'Reference', 'Status', 'Notes'],
      rows.map((row) => [row.createdAt, row.receivedAt, toMajor(row.amount, row.currency), row.currency, row.project?.title ?? 'General', row.anonymous ? 'Anonymous' : row.donorName, row.donorPhone, row.method, row.reference, row.status, row.notes]),
    );
  }),
);

export { sendCsv };

/**
 * Opens a private receipt. Stored references look like
 * `private:enhakkore/receipts/<user>/<id>.pdf`; the reply is a link that stops
 * working after ten minutes.
 */
financeRouter.get(
  '/receipt',
  route(async (req, res) => {
    if (!['finance.view', 'donations.view', 'bookings.view'].some((permission) => req.auth!.permissions.includes('*') || req.auth!.permissions.some((p) => p === permission || p === `${permission.split('.')[0]}.*`))) {
      throw ApiError.forbidden();
    }
    const ref = typeof req.query.ref === 'string' ? req.query.ref : '';
    const match = /^private:(enhakkore\/receipts\/[A-Za-z0-9_\/-]+)\.([a-z0-9]{2,5})$/.exec(ref);
    if (!match) throw ApiError.badRequest('That is not a receipt reference.');
    const { fileStorage, baseUrlOf } = await import('../../services/storage');
    const url = await fileStorage().privateUrl(match[1]!, match[2]!, baseUrlOf(req));
    await audit(req, { action: 'view', entityType: 'receipts', summary: `Opened receipt ${match[1]}`, sensitive: true });
    res.json({ url });
  }),
);
