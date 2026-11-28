import { Router } from 'express';
import { z } from 'zod';
import { formatMoney } from '@enhakkore/shared';
import { ApiError, pageParams, paginated, route } from '../lib/http';
import { paymentReference, shortCode } from '../lib/ids';
import { parseList } from '../lib/json';
import { prisma } from '../lib/prisma';
import { assertPermission, requireAuth, requireStaff } from '../middleware/auth';
import { audit } from '../services/audit';
import { confirmBooking } from '../services/bookings';
import { ledgerIncome } from '../services/ledger';
import { notify, notifyStaff } from '../services/notifications';
import { paymentGateway } from '../services/payments';
import { assetBelongsTo, baseUrlOf, fileStorage } from '../services/storage';
import { notifyTeam } from '../services/whatsapp';

/**
 * Trip payments: the deposit (part of the price, never on top), receipts the
 * traveller uploads after paying by an authorised method, and the team's
 * verification. An uploaded receipt is evidence for the team, never proof of
 * payment by itself: a place is confirmed only once a person has checked the
 * money arrived and approved it.
 */
export const tripPaymentsMember = Router();
export const tripPaymentsAdmin = Router();

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: 'Awaiting payment',
  RECEIPT_SUBMITTED: 'Receipt submitted',
  UNDER_VERIFICATION: 'Under verification',
  APPROVED: 'Payment approved',
  REJECTED: 'Payment rejected',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
};

/** What a booking still needs, worked out from the trip's deposit and what has been verified. */
export function paymentSummary(booking: { travellers: number; totalAmount: number; amountPaid: number; currency: string }, depositPerPerson: number | null) {
  const deposit = depositPerPerson ? Math.min(depositPerPerson * booking.travellers, booking.totalAmount) : null;
  return {
    total: booking.totalAmount,
    deposit,
    // The deposit is deducted from the price: what is left after it is paid.
    balanceAfterDeposit: deposit !== null ? booking.totalAmount - deposit : null,
    paid: booking.amountPaid,
    outstanding: Math.max(0, booking.totalAmount - booking.amountPaid),
    depositOutstanding: deposit !== null ? Math.max(0, deposit - booking.amountPaid) : null,
    currency: booking.currency,
  };
}

async function memberBooking(reference: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: { reference, userId, channel: 'APPLICATION' },
    include: { trip: { select: { id: true, title: true, depositAmount: true, currency: true } }, departure: { select: { startDate: true } } },
  });
  if (!booking) throw ApiError.notFound('We could not find that booking.');
  return booking;
}

/* --------------------------------- Members --------------------------------- */

/** Payment options for a booking: authorised methods, currencies and the automatic gateway's real status. */
tripPaymentsMember.get(
  '/applications/:reference/payment',
  requireAuth,
  route(async (req, res) => {
    const booking = await memberBooking(req.params.reference, req.auth!.id);
    const methods = (await prisma.paymentMethod.findMany({ where: { status: 'ENABLED' }, orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }] })).filter((method) =>
      parseList(method.scopes).includes('TRIPS'),
    );
    const gateway = paymentGateway();
    const receipts = await prisma.paymentReceipt.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: 'desc' } });
    // Only the trip's own currency can be paid today: no exchange-rate source is
    // connected, so no converted amount is ever invented.
    const accepted = new Set(methods.flatMap((method) => parseList(method.currencies)));
    res.json({
      reference: booking.reference,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      paymentStatusLabel: PAYMENT_STATUS_LABELS[booking.paymentStatus] ?? booking.paymentStatus,
      summary: paymentSummary(booking, booking.trip.depositAmount),
      currencies: [{ code: booking.currency, available: true, rate: 1, note: 'Pay in the trip currency.' }].concat(
        [...accepted].filter((code) => code !== booking.currency).map((code) => ({ code, available: false, rate: 0, note: 'Not available yet: no live exchange-rate source is connected.' })),
      ),
      mobileMoney: { available: gateway.isLive, provider: gateway.name, note: gateway.isLive ? null : 'Automatic mobile-money payment is not connected yet. Pay by one of the methods below and upload your receipt.' },
      methods: methods.map((method) => ({
        name: method.name,
        kind: method.kind,
        provider: method.provider,
        accountName: method.accountName,
        accountNumber: method.accountNumber,
        instructions: method.instructions,
        referenceFormat: method.referenceFormat,
        currencies: parseList(method.currencies),
      })),
      receipts: receipts.map((receipt) => ({
        reference: receipt.reference,
        amount: receipt.amount,
        currency: receipt.currency,
        methodName: receipt.methodName,
        transactionRef: receipt.transactionRef,
        status: receipt.status,
        reviewNote: receipt.status === 'REJECTED' ? receipt.reviewNote : null,
        createdAt: receipt.createdAt,
      })),
    });
  }),
);

const receiptSchema = z.object({
  amount: z.number().int().positive().max(1e12),
  methodName: z.string().trim().min(2).max(120),
  payerPhone: z.string().trim().max(30).optional().or(z.literal('')),
  transactionRef: z.string().trim().max(120).optional().or(z.literal('')),
  fileAssetId: z.string().trim().max(200).optional().or(z.literal('')),
  fileFormat: z.string().trim().max(10).optional().or(z.literal('')),
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: 'Please accept the booking and cancellation terms.' }) }),
});

/** The traveller reports a payment they made and attaches the receipt. The team verifies it. */
tripPaymentsMember.post(
  '/applications/:reference/receipts',
  requireAuth,
  route(async (req, res) => {
    const input = receiptSchema.parse(req.body);
    const booking = await memberBooking(req.params.reference, req.auth!.id);
    if (!['APPLIED', 'PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status)) throw ApiError.unprocessable('This booking is closed, so no payment can be added.');
    if (!input.fileAssetId && !input.transactionRef) throw ApiError.badRequest('Upload the receipt or type the transaction reference from your payment message.');
    if (input.fileAssetId && !assetBelongsTo(input.fileAssetId, req.auth!.id, 'PAYMENT_RECEIPT')) throw ApiError.forbidden('That file belongs to another account.');
    const open = await prisma.paymentReceipt.count({ where: { bookingId: booking.id, status: { in: ['SUBMITTED', 'UNDER_VERIFICATION'] } } });
    if (open >= 3) throw ApiError.conflict('You already have receipts waiting for the team to check. Please wait for them first.');
    const receipt = await prisma.paymentReceipt.create({
      data: {
        reference: `RCP-${shortCode(6)}`,
        bookingId: booking.id,
        userId: req.auth!.id,
        amount: input.amount,
        currency: booking.currency,
        methodName: input.methodName,
        payerPhone: input.payerPhone || null,
        transactionRef: input.transactionRef || null,
        fileAssetId: input.fileAssetId || null,
        fileFormat: input.fileFormat || null,
      },
    });
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: 'RECEIPT_SUBMITTED' } });
    const summary = `${booking.trip.title} · ${booking.reference} · ${formatMoney({ amount: input.amount, currency: booking.currency })} by ${input.methodName}`;
    await notifyStaff('bookings.edit', { type: 'PAYMENT_CONFIRMED', title: `Receipt to verify · ${receipt.reference}`, body: summary, link: '/admin/payments' });
    const whatsapp = await notifyTeam(`Receipt ${receipt.reference}`, `Enhakkore: payment receipt to verify\n${summary}\nReceipt ${receipt.reference}. Check it in the control centre → Payments & receipts.`, { type: 'RECEIPT', id: receipt.id }, 'TRIP');
    await notify({ userId: req.auth!.id, type: 'PAYMENT_CONFIRMED', title: `Receipt received · ${receipt.reference}`, body: 'The team will check that the money arrived. Your place is confirmed only after they approve it.', link: `/account/applications/${booking.reference}` });
    res.status(201).json({ reference: receipt.reference, status: receipt.status, paymentStatus: 'RECEIPT_SUBMITTED', teamNotice: whatsapp });
  }),
);

/** Automatic mobile money. Works only when a real merchant gateway is connected; never simulated here. */
tripPaymentsMember.post(
  '/applications/:reference/mobile-money',
  requireAuth,
  route(async (req, res) => {
    const input = z.object({ provider: z.string().trim().max(40), phone: z.string().trim().min(9).max(20), amount: z.number().int().positive() }).parse(req.body);
    await memberBooking(req.params.reference, req.auth!.id);
    const gateway = paymentGateway();
    if (!gateway.isLive) {
      throw new ApiError(503, 'Automatic mobile-money payment is not connected yet. Please pay by one of the listed methods and upload your receipt.', 'payments_not_configured');
    }
    // A live gateway would start the USSD/STK prompt here and the booking would
    // change only when its signed callback arrives. None is connected.
    void input;
    throw new ApiError(503, 'The connected gateway does not support mobile-money prompts yet.', 'payments_not_configured');
  }),
);

/** The traveller opens their own receipt file. */
tripPaymentsMember.get(
  '/receipts/:reference/file',
  requireAuth,
  route(async (req, res) => {
    const receipt = await prisma.paymentReceipt.findFirst({ where: { reference: req.params.reference, userId: req.auth!.id } });
    if (!receipt?.fileAssetId) throw ApiError.notFound('No file.');
    res.json({ url: await fileStorage().privateUrl(receipt.fileAssetId, receipt.fileFormat ?? 'jpg', baseUrlOf(req)) });
  }),
);

/* ---------------------------------- Team ---------------------------------- */

tripPaymentsAdmin.use(requireAuth, requireStaff);

tripPaymentsAdmin.get(
  '/receipts',
  route(async (req, res) => {
    assertPermission(req, 'bookings.view');
    const params = pageParams(req.query, 30, 100);
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined;
    const where = status ? { status } : {};
    const [rows, total, counts] = await Promise.all([
      prisma.paymentReceipt.findMany({
        where,
        include: { booking: { include: { trip: { select: { title: true, depositAmount: true } }, user: { select: { name: true, username: true, phone: true, email: true } }, departure: { select: { startDate: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      prisma.paymentReceipt.count({ where }),
      prisma.paymentReceipt.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    res.json({
      ...paginated(
        rows.map((row) => ({
          id: row.id,
          reference: row.reference,
          amount: row.amount,
          currency: row.currency,
          methodName: row.methodName,
          payerPhone: row.payerPhone,
          transactionRef: row.transactionRef,
          hasFile: !!row.fileAssetId,
          status: row.status,
          reviewNote: row.reviewNote,
          reviewedAt: row.reviewedAt,
          createdAt: row.createdAt,
          booking: {
            id: row.booking.id,
            reference: row.booking.reference,
            status: row.booking.status,
            paymentStatus: row.booking.paymentStatus,
            travellers: row.booking.travellers,
            trip: row.booking.trip.title,
            startDate: row.booking.departure.startDate,
            customer: row.booking.user,
            summary: paymentSummary(row.booking, row.booking.trip.depositAmount),
          },
        })),
        total,
        params,
      ),
      counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
    });
  }),
);

tripPaymentsAdmin.get(
  '/receipts/:id/file',
  route(async (req, res) => {
    assertPermission(req, 'bookings.view');
    const receipt = await prisma.paymentReceipt.findUnique({ where: { id: req.params.id } });
    if (!receipt?.fileAssetId) throw ApiError.notFound('No file was uploaded with this receipt.');
    await audit(req, { action: 'view', entityType: 'receipts', entityId: receipt.id, summary: `Opened receipt file ${receipt.reference}`, sensitive: true });
    res.json({ url: await fileStorage().privateUrl(receipt.fileAssetId, receipt.fileFormat ?? 'jpg', baseUrlOf(req)) });
  }),
);

const decisionSchema = z.object({
  action: z.enum(['verify', 'approve', 'reject']),
  note: z.string().trim().max(1000).optional(),
  /** The amount that actually arrived, if different from what was reported. */
  amount: z.number().int().positive().max(1e12).optional(),
  method: z.enum(['MOBILE_MONEY', 'BANK_TRANSFER', 'CASH', 'CARD', 'OTHER']).default('MOBILE_MONEY'),
});

/**
 * Verify (start checking), approve (the money arrived: record it, confirm the
 * place once the deposit is covered) or reject (with a reason the traveller
 * sees). Every decision is in the audit log; approved payments go to the ledger.
 */
tripPaymentsAdmin.post(
  '/receipts/:id/decision',
  route(async (req, res) => {
    assertPermission(req, 'bookings.edit');
    const input = decisionSchema.parse(req.body);
    const receipt = await prisma.paymentReceipt.findUnique({
      where: { id: req.params.id },
      include: { booking: { include: { trip: { select: { title: true, depositAmount: true } }, departure: { select: { startDate: true } }, user: { select: { name: true } } } } },
    });
    if (!receipt) throw ApiError.notFound('Receipt not found.');
    if (!['SUBMITTED', 'UNDER_VERIFICATION'].includes(receipt.status)) throw ApiError.unprocessable(`This receipt was already ${receipt.status.toLowerCase()}.`);
    if (input.action === 'reject' && !input.note) throw ApiError.badRequest('Give a reason — the traveller sees it.');
    const booking = receipt.booking;
    const link = `/account/applications/${booking.reference}`;

    if (input.action === 'verify') {
      await prisma.$transaction([
        prisma.paymentReceipt.update({ where: { id: receipt.id }, data: { status: 'UNDER_VERIFICATION', reviewedById: req.auth!.id } }),
        prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: 'UNDER_VERIFICATION' } }),
      ]);
    } else if (input.action === 'reject') {
      await prisma.$transaction([
        prisma.paymentReceipt.update({ where: { id: receipt.id }, data: { status: 'REJECTED', reviewNote: input.note, reviewedById: req.auth!.id, reviewedAt: new Date() } }),
        prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: 'REJECTED' } }),
      ]);
      await notify({ userId: booking.userId, type: 'PAYMENT_FAILED', title: `Payment not verified · ${booking.trip.title}`, body: input.note!, link });
    } else {
      if (!['APPLIED', 'PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status)) throw ApiError.unprocessable('This booking is closed.');
      const amount = input.amount ?? receipt.amount;
      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            bookingId: booking.id,
            method: input.method,
            provider: 'manual',
            providerRef: receipt.transactionRef ?? paymentReference(),
            amount,
            currency: booking.currency,
            status: 'SUCCEEDED',
            simulated: false,
            settledAt: new Date(),
            recordedById: req.auth!.id,
            note: `Receipt ${receipt.reference}${input.note ? ` · ${input.note}` : ''}`,
          },
        });
        await tx.booking.update({ where: { id: booking.id }, data: { amountPaid: { increment: amount }, paymentStatus: 'APPROVED', reviewedById: req.auth!.id, reviewedAt: new Date() } });
        await tx.paymentReceipt.update({ where: { id: receipt.id }, data: { status: 'APPROVED', amount, reviewNote: input.note ?? null, reviewedById: req.auth!.id, reviewedAt: new Date() } });
        await ledgerIncome(tx, {
          amount,
          currency: booking.currency,
          division: 'TRAVEL',
          category: 'TRIP_BOOKING',
          relatedType: 'TRIP_DEPARTURE',
          relatedId: booking.tripDateId,
          relatedLabel: `${booking.trip.title} · ${booking.departure.startDate.toISOString().slice(0, 10)}`,
          paymentMethod: input.method,
          reference: receipt.transactionRef ?? receipt.reference,
          counterparty: booking.user.name,
          date: new Date(),
          bookingId: booking.id,
          paymentId: payment.id,
          actorId: req.auth!.id,
          notes: `Booking ${booking.reference}, receipt ${receipt.reference}`,
        });
      });
      const fresh = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      const summary = paymentSummary(fresh, booking.trip.depositAmount);
      const threshold = summary.deposit ?? summary.total;
      if (fresh.amountPaid >= threshold && fresh.status !== 'CONFIRMED') {
        await confirmBooking(booking.id, null, 0);
        await notify({
          userId: booking.userId,
          type: 'BOOKING_CONFIRMED',
          title: `Place confirmed · ${booking.trip.title}`,
          body: summary.outstanding > 0 ? `Your payment was verified and your place is confirmed. Remaining balance: ${formatMoney({ amount: summary.outstanding, currency: summary.currency })}. The trip group chat is now open to you.` : 'Your payment was verified and your place is confirmed. The trip group chat is now open to you.',
          link,
        });
      } else {
        await notify({ userId: booking.userId, type: 'PAYMENT_CONFIRMED', title: `Payment verified · ${booking.trip.title}`, body: summary.outstanding > 0 ? `Remaining balance: ${formatMoney({ amount: summary.outstanding, currency: summary.currency })}.` : 'Paid in full. Thank you.', link });
      }
    }
    await audit(req, {
      action: 'finance',
      entityType: 'receipts',
      entityId: receipt.id,
      summary: `${input.action === 'approve' ? 'Approved' : input.action === 'reject' ? 'Rejected' : 'Started verifying'} receipt ${receipt.reference} (${booking.reference}, ${formatMoney({ amount: input.amount ?? receipt.amount, currency: receipt.currency })})`,
      before: { status: receipt.status, paymentStatus: booking.paymentStatus },
      after: { action: input.action, note: input.note ?? null, amount: input.amount ?? receipt.amount },
      sensitive: true,
    });
    const updated = await prisma.paymentReceipt.findUniqueOrThrow({ where: { id: receipt.id }, include: { booking: { select: { status: true, paymentStatus: true, amountPaid: true } } } });
    res.json({ status: updated.status, booking: updated.booking });
  }),
);
