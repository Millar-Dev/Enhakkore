import { Router } from 'express';
import { z } from 'zod';
import { ENQUIRY_STATUSES, ENQUIRY_STATUS_LABELS,
  enquiryStatusLabel, PAYMENT_RECORD_METHODS, departureStatus, toMinor } from '@enhakkore/shared';
import { notifyEnquiry, notifyTeam } from '../../services/whatsapp';
import { ApiError, pageParams, paginated, route } from '../../lib/http';
import { paymentReference } from '../../lib/ids';
import { parseRecord } from '../../lib/json';
import { prisma } from '../../lib/prisma';
import { textContains } from '../../lib/search';
import { assertPermission } from '../../middleware/auth';
import { audit } from '../../services/audit';
import { confirmBooking } from '../../services/bookings';
import { byCurrency, ledgerIncome, ledgerRefund } from '../../services/ledger';
import { notify } from '../../services/notifications';

/**
 * Day-to-day operations: enquiries, trip applications and their payments,
 * event registrations and check-in, activity join requests, reviews and
 * reports. Each route checks its own permission.
 */
export const operationsRouter = Router();

const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

/* -------------------------------- Enquiries ------------------------------- */

operationsRouter.get(
  '/enquiries',
  route(async (req, res) => {
    assertPermission(req, 'enquiries.view');
    const page = pageParams(req.query as Record<string, unknown>, 25, 100);
    const where: Record<string, unknown> = {};
    const status = str(req.query.status);
    if (status && status !== 'all') where.status = status;
    else if (!status) where.status = { notIn: ['SPAM', 'CLOSED'] };
    const type = str(req.query.type);
    if (type && type !== 'all') where.type = type;
    const q = str(req.query.q);
    if (q) where.OR = [{ name: textContains(q) }, { phone: textContains(q) }, { email: textContains(q) }, { reference: textContains(q) }, { subjectTitle: textContains(q) }];
    const [items, total, counts] = await Promise.all([
      prisma.enquiry.findMany({ where, orderBy: { createdAt: 'desc' }, skip: page.skip, take: page.take }),
      prisma.enquiry.count({ where }),
      prisma.enquiry.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    res.json({
      ...paginated(items.map((item) => ({ ...item, details: parseRecord(item.details, {}) })), total, page),
      statusCounts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
    });
  }),
);

operationsRouter.patch(
  '/enquiries/:id',
  route(async (req, res) => {
    assertPermission(req, 'enquiries.edit');
    const input = z
      .object({
        status: z.enum(ENQUIRY_STATUSES).optional(),
        internalNotes: z.string().max(5000).optional(),
      })
      .parse(req.body);
    const before = await prisma.enquiry.findUniqueOrThrow({ where: { id: req.params.id } });
    const enquiry = await prisma.enquiry.update({
      where: { id: before.id },
      data: { ...input, handledById: req.auth!.id },
    });
    await audit(req, {
      action: 'update',
      entityType: 'enquiries',
      entityId: enquiry.id,
      summary: `Updated enquiry ${enquiry.reference}${input.status ? ` → ${input.status}` : ''}`,
      before: { status: before.status, internalNotes: before.internalNotes },
      after: { status: enquiry.status, internalNotes: enquiry.internalNotes },
    });
    // The customer sees the new status in their account, and gets an in-app notice.
    if (input.status && input.status !== before.status && enquiry.userId && input.status !== 'SPAM') {
      await notify({
        userId: enquiry.userId,
        type: enquiry.type === 'PARTNERSHIP' ? 'PARTNERSHIP_UPDATE' : 'ENQUIRY_UPDATE',
        title: `${enquiry.reference}: ${enquiryStatusLabel(enquiry.type, input.status)}`,
        body: enquiry.subjectTitle ?? 'Your enquiry was updated.',
        link: '/account/enquiries',
      });
    }
    res.json(enquiry);
  }),
);

/** Retries the automatic WhatsApp notice for one enquiry. */
operationsRouter.post(
  '/enquiries/:id/notify',
  route(async (req, res) => {
    assertPermission(req, 'enquiries.edit');
    const enquiry = await prisma.enquiry.findUniqueOrThrow({ where: { id: req.params.id } });
    const outcome = await notifyEnquiry({ ...enquiry, type: enquiry.type });
    const fresh = await prisma.enquiry.findUniqueOrThrow({ where: { id: enquiry.id } });
    res.json({ notifyStatus: outcome === 'NOT_REQUIRED' ? fresh.notifyStatus : outcome, notifyError: fresh.notifyError });
  }),
);

/* --------------------------- Trip applications ---------------------------- */

const APPLICATION_INCLUDE = {
  user: { select: { id: true, name: true, email: true, phone: true, country: true } },
  trip: { select: { id: true, title: true, slug: true, currency: true, depositAmount: true } },
  departure: true,
  travellerList: true,
  payments: { orderBy: { createdAt: 'desc' as const } },
};

function applicationView(booking: any) {
  return {
    ...booking,
    outstanding: Math.max(0, booking.totalAmount - booking.amountPaid),
  };
}

operationsRouter.get(
  '/applications',
  route(async (req, res) => {
    assertPermission(req, 'bookings.view');
    const page = pageParams(req.query as Record<string, unknown>, 25, 100);
    const where: Record<string, unknown> = { channel: 'APPLICATION' };
    const status = str(req.query.status);
    if (status && status !== 'all') where.status = status;
    const departureId = str(req.query.departureId);
    if (departureId) where.tripDateId = departureId;
    const tripId = str(req.query.tripId);
    if (tripId) where.tripId = tripId;
    const q = str(req.query.q);
    if (q) where.OR = [{ reference: textContains(q) }, { user: { name: textContains(q) } }, { user: { email: textContains(q) } }, { contactPhone: textContains(q) }];
    const [items, total, counts] = await Promise.all([
      prisma.booking.findMany({ where, include: APPLICATION_INCLUDE, orderBy: { createdAt: 'desc' }, skip: page.skip, take: page.take }),
      prisma.booking.count({ where }),
      prisma.booking.groupBy({ by: ['status'], where: { channel: 'APPLICATION' }, _count: { _all: true } }),
    ]);
    res.json({
      ...paginated(items.map(applicationView), total, page),
      statusCounts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
    });
  }),
);

async function loadApplication(id: string) {
  const booking = await prisma.booking.findFirst({ where: { id, channel: 'APPLICATION' }, include: APPLICATION_INCLUDE });
  if (!booking) throw ApiError.notFound('That application does not exist.');
  return booking;
}

operationsRouter.get(
  '/applications/:id',
  route(async (req, res) => {
    assertPermission(req, 'bookings.view');
    res.json(applicationView(await loadApplication(req.params.id)));
  }),
);

/** Returns seats to the departure and takes the traveller out of the group. */
async function releaseSeats(booking: { id: string; tripDateId: string; travellers: number; userId: string }, status: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const departure = await tx.tripDate.findUniqueOrThrow({ where: { id: booking.tripDateId }, include: { conversation: true } });
    await tx.booking.update({ where: { id: booking.id }, data: { status, cancelledAt: new Date(), cancelReason: reason, paymentStatus: status === 'REFUNDED' ? 'REFUNDED' : 'CANCELLED' } });
    const seatsBooked = Math.max(0, departure.seatsBooked - booking.travellers);
    await tx.tripDate.update({
      where: { id: departure.id },
      data: { seatsBooked, status: departure.status === 'CLOSED' ? 'CLOSED' : departureStatus(seatsBooked, departure.capacity) },
    });
    if (departure.conversation) {
      await tx.conversationMember.deleteMany({ where: { conversationId: departure.conversation.id, userId: booking.userId } });
    }
  });
}

const decisionSchema = z.object({
  action: z.enum(['approve', 'decline', 'confirm', 'cancel', 'complete']),
  reason: z.string().trim().max(1000).optional(),
});

/**
 * Moves an application along:
 *   approve  APPLIED → PENDING_PAYMENT (seats stay held)
 *   decline  APPLIED → DECLINED (seats released)
 *   confirm  → CONFIRMED, and the traveller joins the departure's private group
 *   cancel   → CANCELLED (seats released, group access removed)
 *   complete CONFIRMED → COMPLETED, after the trip
 */
operationsRouter.post(
  '/applications/:id/decision',
  route(async (req, res) => {
    assertPermission(req, 'bookings.edit');
    const { action, reason } = decisionSchema.parse(req.body);
    const booking = await loadApplication(req.params.id);
    const from = booking.status;

    const allowed: Record<string, string[]> = {
      approve: ['APPLIED'],
      decline: ['APPLIED', 'PENDING_PAYMENT'],
      confirm: ['APPLIED', 'PENDING_PAYMENT'],
      cancel: ['APPLIED', 'PENDING_PAYMENT', 'CONFIRMED'],
      complete: ['CONFIRMED'],
    };
    if (!allowed[action]!.includes(from)) {
      throw ApiError.unprocessable(`An application that is ${from.toLowerCase().replace('_', ' ')} cannot be ${action}d.`);
    }

    const link = `/account/applications/${booking.reference}`;
    if (action === 'approve') {
      await prisma.booking.update({ where: { id: booking.id }, data: { status: 'PENDING_PAYMENT', reviewedById: req.auth!.id, reviewedAt: new Date() } });
      await notify({ userId: booking.userId, type: 'TRIP_UPDATE', title: `Application approved · ${booking.trip.title}`, body: 'Your place is held. Follow the payment instructions on your booking to confirm it.', link });
    } else if (action === 'decline') {
      await releaseSeats(booking, 'DECLINED', reason ?? 'Declined');
      await notify({ userId: booking.userId, type: 'TRIP_UPDATE', title: `Application not accepted · ${booking.trip.title}`, body: reason ?? 'Contact Enhakkore on WhatsApp for details.', link });
    } else if (action === 'confirm') {
      await prisma.booking.update({ where: { id: booking.id }, data: { reviewedById: req.auth!.id, reviewedAt: new Date() } });
      await confirmBooking(booking.id, null, 0);
      await notify({ userId: booking.userId, type: 'BOOKING_CONFIRMED', title: `Booking confirmed · ${booking.trip.title}`, body: 'You are confirmed, and the private group for your departure is now open to you.', link });
    } else if (action === 'cancel') {
      await releaseSeats(booking, 'CANCELLED', reason ?? 'Cancelled by Enhakkore');
      await notify({ userId: booking.userId, type: 'TRIP_UPDATE', title: `Booking cancelled · ${booking.trip.title}`, body: reason ?? 'Contact Enhakkore on WhatsApp for details.', link });
    } else {
      await prisma.booking.update({ where: { id: booking.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    }

    const after = await loadApplication(booking.id);
    await audit(req, {
      action: 'status',
      entityType: 'applications',
      entityId: booking.id,
      summary: `${action[0]!.toUpperCase()}${action.slice(1)}d application ${booking.reference} (${booking.user.name}, ${booking.trip.title})`,
      before: { status: from },
      after: { status: after.status, ...(reason ? { reason } : {}) },
    });
    res.json(applicationView(after));
  }),
);

const paymentSchema = z.object({
  amount: z.number().positive().max(1e12),
  method: z.enum(PAYMENT_RECORD_METHODS),
  reference: z.string().trim().max(120).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  note: z.string().trim().max(1000).optional(),
  /** Confirm the booking once this payment covers it in full. */
  confirmWhenPaid: z.boolean().default(true),
});

/**
 * Records a payment someone made by transfer, after a person has checked it
 * arrived. Writes the payment, the running total on the booking, and a
 * verified income line in the finance ledger — together or not at all.
 */
operationsRouter.post(
  '/applications/:id/payments',
  route(async (req, res) => {
    assertPermission(req, 'bookings.edit');
    const input = paymentSchema.parse(req.body);
    const booking = await loadApplication(req.params.id);
    if (!['APPLIED', 'PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status)) {
      throw ApiError.unprocessable('Payments can only be recorded on an open or confirmed booking.');
    }
    const amount = toMinor(input.amount, booking.currency);
    const date = input.date ? new Date(`${input.date.slice(0, 10)}T12:00:00Z`) : new Date();

    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          method: input.method,
          provider: 'manual',
          providerRef: input.reference ?? paymentReference(),
          amount,
          currency: booking.currency,
          status: 'SUCCEEDED',
          simulated: false,
          settledAt: date,
          recordedById: req.auth!.id,
          note: input.note ?? null,
        },
      });
      await tx.booking.update({ where: { id: booking.id }, data: { amountPaid: { increment: amount } } });
      await ledgerIncome(tx, {
        amount,
        currency: booking.currency,
        division: 'TRAVEL',
        category: 'TRIP_BOOKING',
        relatedType: 'TRIP_DEPARTURE',
        relatedId: booking.tripDateId,
        relatedLabel: `${booking.trip.title} · ${booking.departure.startDate.toISOString().slice(0, 10)}`,
        paymentMethod: input.method,
        reference: input.reference,
        counterparty: booking.user.name,
        date,
        bookingId: booking.id,
        paymentId: payment.id,
        actorId: req.auth!.id,
        notes: `Booking ${booking.reference}`,
      });
    });

    let updated = await loadApplication(booking.id);
    // With a deposit, the place is confirmed once the deposit is covered; the balance is paid later.
    const threshold = updated.trip.depositAmount ? Math.min(updated.trip.depositAmount * updated.travellers, updated.totalAmount) : updated.totalAmount;
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: 'APPROVED' } });
    if (input.confirmWhenPaid && updated.amountPaid >= threshold && updated.status !== 'CONFIRMED') {
      await confirmBooking(booking.id, null, 0);
      await notify({
        userId: booking.userId,
        type: 'BOOKING_CONFIRMED',
        title: `Payment received · ${booking.trip.title}`,
        body: 'Your payment has been verified and your place is confirmed. The private group for your departure is now open.',
        link: `/account/applications/${booking.reference}`,
      });
      updated = await loadApplication(booking.id);
    } else {
      await notify({
        userId: booking.userId,
        type: 'PAYMENT_CONFIRMED',
        title: `Payment recorded · ${booking.trip.title}`,
        body: 'We have verified a payment towards your booking.',
        link: `/account/applications/${booking.reference}`,
      });
    }
    await audit(req, {
      action: 'finance',
      entityType: 'applications',
      entityId: booking.id,
      summary: `Recorded payment of ${input.amount} ${booking.currency} on ${booking.reference} (${input.method})`,
      after: { amount, currency: booking.currency, method: input.method, reference: input.reference },
      sensitive: true,
    });
    res.json(applicationView(updated));
  }),
);

/** Records money given back, and cancels the booking if asked to. */
operationsRouter.post(
  '/applications/:id/refund',
  route(async (req, res) => {
    assertPermission(req, 'bookings.edit');
    assertPermission(req, 'finance.create');
    const input = z
      .object({ amount: z.number().positive(), reference: z.string().max(120).optional(), reason: z.string().max(1000).optional(), cancel: z.boolean().default(true) })
      .parse(req.body);
    const booking = await loadApplication(req.params.id);
    const amount = toMinor(input.amount, booking.currency);
    if (amount > booking.amountPaid) throw ApiError.unprocessable('That is more than has been paid on this booking.');
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { amountPaid: { decrement: amount } } });
      await ledgerRefund(tx, {
        amount,
        currency: booking.currency,
        division: 'TRAVEL',
        relatedType: 'TRIP_DEPARTURE',
        relatedId: booking.tripDateId,
        relatedLabel: booking.trip.title,
        counterparty: booking.user.name,
        reference: input.reference,
        bookingId: booking.id,
        actorId: req.auth!.id,
        notes: input.reason,
      });
    });
    if (input.cancel && booking.status !== 'CANCELLED') await releaseSeats(booking, 'REFUNDED', input.reason ?? 'Refunded');
    await audit(req, { action: 'finance', entityType: 'applications', entityId: booking.id, summary: `Refunded ${input.amount} ${booking.currency} on ${booking.reference}`, sensitive: true });
    res.json(applicationView(await loadApplication(booking.id)));
  }),
);

/**
 * One departure at a glance: who is coming, who has paid, what it cost and
 * what it made. Amounts are grouped by currency and never added across them.
 */
operationsRouter.get(
  '/departures/:id',
  route(async (req, res) => {
    assertPermission(req, 'bookings.view');
    const departure = await prisma.tripDate.findUnique({
      where: { id: req.params.id },
      include: {
        trip: { select: { id: true, title: true, slug: true, basePrice: true, currency: true, minParticipants: true } },
        conversation: { select: { id: true } },
        bookings: { where: { channel: 'APPLICATION' }, include: { user: { select: { name: true, email: true, phone: true } }, travellerList: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!departure) throw ApiError.notFound();
    const live = departure.bookings.filter((booking) => ['APPLIED', 'PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED'].includes(booking.status));
    const confirmed = live.filter((booking) => ['CONFIRMED', 'COMPLETED'].includes(booking.status));

    let finance: unknown = null;
    if (req.auth!.permissions.includes('*') || req.auth!.permissions.some((p) => p.startsWith('finance.'))) {
      const lines = await prisma.financeTransaction.findMany({
        where: { relatedType: 'TRIP_DEPARTURE', relatedId: departure.id, status: { not: 'CANCELLED' } },
        orderBy: { date: 'asc' },
      });
      const verified = lines.filter((line) => line.status === 'VERIFIED');
      const income = byCurrency(verified.filter((line) => line.type === 'INCOME'));
      const refunds = byCurrency(verified.filter((line) => line.type === 'REFUND'));
      const expenses = byCurrency(verified.filter((line) => line.type === 'EXPENSE'));
      const pendingExpenses = byCurrency(lines.filter((line) => line.type === 'EXPENSE' && line.status === 'PENDING'));
      const expensesByCategory: Record<string, Record<string, number>> = {};
      for (const line of lines.filter((item) => item.type === 'EXPENSE')) {
        expensesByCategory[line.category] ??= {};
        expensesByCategory[line.category]![line.currency] = (expensesByCategory[line.category]![line.currency] ?? 0) + line.amount;
      }
      const expectedRevenue = byCurrency(live.map((booking) => ({ currency: booking.currency, amount: booking.totalAmount })));
      const currencies = new Set([...Object.keys(income), ...Object.keys(expenses), ...Object.keys(expectedRevenue), ...Object.keys(pendingExpenses)]);
      const actualProfit: Record<string, number> = {};
      const estimatedProfit: Record<string, number> = {};
      for (const currency of currencies) {
        actualProfit[currency] = (income[currency] ?? 0) - (refunds[currency] ?? 0) - (expenses[currency] ?? 0);
        estimatedProfit[currency] = (expectedRevenue[currency] ?? 0) - (expenses[currency] ?? 0) - (pendingExpenses[currency] ?? 0);
      }
      finance = { lines, income, refunds, expenses, pendingExpenses, expensesByCategory, expectedRevenue, actualProfit, estimatedProfit };
    }

    res.json({
      departure,
      summary: {
        expectedParticipants: departure.expectedParticipants,
        applied: live.reduce((sum, booking) => sum + booking.travellers, 0),
        confirmedParticipants: confirmed.reduce((sum, booking) => sum + booking.travellers, 0),
        seatsLeft: Math.max(0, departure.capacity - departure.seatsBooked),
        paid: byCurrency(live.map((booking) => ({ currency: booking.currency, amount: booking.amountPaid }))),
        outstanding: byCurrency(live.map((booking) => ({ currency: booking.currency, amount: Math.max(0, booking.totalAmount - booking.amountPaid) }))),
      },
      finance,
    });
  }),
);

/* -------------------------- Event registrations --------------------------- */

operationsRouter.get(
  '/registrations',
  route(async (req, res) => {
    assertPermission(req, 'events.view');
    const page = pageParams(req.query as Record<string, unknown>, 50, 200);
    const where: Record<string, unknown> = {};
    const eventId = str(req.query.eventId);
    if (eventId) where.eventId = eventId;
    const status = str(req.query.status);
    if (status && status !== 'all') where.status = status;
    const q = str(req.query.q);
    if (q) where.OR = [{ reference: textContains(q) }, { name: textContains(q) }, { phone: textContains(q) }];
    const [items, total] = await Promise.all([
      prisma.eventRegistration.findMany({
        where,
        include: { ticket: { select: { name: true } }, event: { select: { title: true, slug: true, startsAt: true, timezone: true } } },
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
      prisma.eventRegistration.count({ where }),
    ]);
    res.json(paginated(items, total, page));
  }),
);

/** Ticket sales, revenue and costs for one event. */
operationsRouter.get(
  '/events/:id/summary',
  route(async (req, res) => {
    assertPermission(req, 'events.view');
    const event = await prisma.event.findUnique({ where: { id: req.params.id }, include: { tickets: { orderBy: { sortOrder: 'asc' } } } });
    if (!event) throw ApiError.notFound();
    const registrations = await prisma.eventRegistration.findMany({ where: { eventId: event.id } });
    const live = registrations.filter((row) => ['PENDING_PAYMENT', 'CONFIRMED'].includes(row.status));
    let finance: unknown = null;
    if (req.auth!.permissions.includes('*') || req.auth!.permissions.some((p) => p.startsWith('finance.'))) {
      const lines = await prisma.financeTransaction.findMany({ where: { relatedType: 'EVENT', relatedId: event.id, status: 'VERIFIED' } });
      const income = byCurrency(lines.filter((line) => line.type === 'INCOME'));
      const refunds = byCurrency(lines.filter((line) => line.type === 'REFUND'));
      const expenses = byCurrency(lines.filter((line) => line.type === 'EXPENSE'));
      const net: Record<string, number> = {};
      for (const currency of new Set([...Object.keys(income), ...Object.keys(expenses), ...Object.keys(refunds)])) {
        net[currency] = (income[currency] ?? 0) - (refunds[currency] ?? 0) - (expenses[currency] ?? 0);
      }
      finance = { income, refunds, expenses, net, lines };
    }
    res.json({
      event: { id: event.id, title: event.title, startsAt: event.startsAt, timezone: event.timezone, capacity: event.capacity },
      tickets: event.tickets,
      sold: live.reduce((sum, row) => sum + row.quantity, 0),
      confirmed: live.filter((row) => row.status === 'CONFIRMED').reduce((sum, row) => sum + row.quantity, 0),
      checkedIn: registrations.reduce((sum, row) => sum + row.checkedInCount, 0),
      ticketRevenue: byCurrency(live.map((row) => ({ currency: row.currency, amount: row.amountPaid }))),
      outstanding: byCurrency(live.map((row) => ({ currency: row.currency, amount: Math.max(0, row.amountDue - row.amountPaid) }))),
      finance,
    });
  }),
);

async function releaseRegistration(id: string, status: 'CANCELLED' | 'REFUNDED') {
  await prisma.$transaction(async (tx) => {
    const registration = await tx.eventRegistration.findUniqueOrThrow({ where: { id } });
    if (['CANCELLED', 'REFUNDED'].includes(registration.status)) return;
    await tx.eventRegistration.update({ where: { id }, data: { status } });
    if (registration.ticketId) {
      await tx.eventTicket.update({ where: { id: registration.ticketId }, data: { sold: { decrement: registration.quantity } } });
    }
  });
}

operationsRouter.post(
  '/registrations/:id/payments',
  route(async (req, res) => {
    assertPermission(req, 'events.edit');
    const input = paymentSchema.parse(req.body);
    const registration = await prisma.eventRegistration.findUnique({ where: { id: req.params.id }, include: { event: true } });
    if (!registration) throw ApiError.notFound();
    if (!['PENDING_PAYMENT', 'CONFIRMED'].includes(registration.status)) throw ApiError.unprocessable('This registration is cancelled.');
    const amount = toMinor(input.amount, registration.currency);
    const date = input.date ? new Date(`${input.date.slice(0, 10)}T12:00:00Z`) : new Date();
    await prisma.$transaction(async (tx) => {
      const updated = await tx.eventRegistration.update({
        where: { id: registration.id },
        data: { amountPaid: { increment: amount }, paymentReference: input.reference ?? registration.paymentReference },
      });
      if (input.confirmWhenPaid && updated.amountPaid >= updated.amountDue) {
        await tx.eventRegistration.update({ where: { id: registration.id }, data: { status: 'CONFIRMED' } });
      }
      await ledgerIncome(tx, {
        amount,
        currency: registration.currency,
        division: 'EVENTS',
        category: 'TICKET_SALES',
        relatedType: 'EVENT',
        relatedId: registration.eventId,
        relatedLabel: registration.event.title,
        paymentMethod: input.method,
        reference: input.reference,
        counterparty: registration.name,
        date,
        registrationId: registration.id,
        actorId: req.auth!.id,
        notes: `Registration ${registration.reference}`,
      });
    });
    await audit(req, { action: 'finance', entityType: 'registrations', entityId: registration.id, summary: `Recorded payment of ${input.amount} ${registration.currency} on ${registration.reference}`, sensitive: true });
    res.json(await prisma.eventRegistration.findUnique({ where: { id: registration.id } }));
  }),
);

operationsRouter.post(
  '/registrations/:id/status',
  route(async (req, res) => {
    assertPermission(req, 'events.edit');
    const { status, reason } = z.object({ status: z.enum(['CONFIRMED', 'CANCELLED']), reason: z.string().max(500).optional() }).parse(req.body);
    const registration = await prisma.eventRegistration.findUniqueOrThrow({ where: { id: req.params.id } });
    if (status === 'CANCELLED') await releaseRegistration(registration.id, 'CANCELLED');
    else await prisma.eventRegistration.update({ where: { id: registration.id }, data: { status: 'CONFIRMED' } });
    await audit(req, { action: 'status', entityType: 'registrations', entityId: registration.id, summary: `Registration ${registration.reference} → ${status}${reason ? ` (${reason})` : ''}` });
    res.json(await prisma.eventRegistration.findUnique({ where: { id: registration.id } }));
  }),
);

/** Door check-in, by reference. Lets in up to the number of tickets on the registration. */
operationsRouter.post(
  '/registrations/check-in',
  route(async (req, res) => {
    assertPermission(req, 'events.edit');
    const { reference, count, eventId } = z
      .object({ reference: z.string().trim().min(4).max(40), count: z.number().int().min(1).max(50).default(1), eventId: z.string().optional() })
      .parse(req.body);
    const registration = await prisma.eventRegistration.findUnique({ where: { reference: reference.toUpperCase() }, include: { event: { select: { title: true } }, ticket: { select: { name: true } } } });
    if (!registration || (eventId && registration.eventId !== eventId)) throw ApiError.notFound('No registration with that reference for this event.');
    if (registration.status !== 'CONFIRMED') {
      throw ApiError.unprocessable(registration.status === 'PENDING_PAYMENT' ? 'Payment has not been verified for this registration yet.' : 'This registration was cancelled.');
    }
    if (registration.checkedInCount + count > registration.quantity) {
      throw ApiError.unprocessable(`Already checked in ${registration.checkedInCount} of ${registration.quantity}.`);
    }
    const updated = await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: { checkedInCount: { increment: count }, checkedInAt: registration.checkedInAt ?? new Date() },
      include: { event: { select: { title: true } }, ticket: { select: { name: true } } },
    });
    await audit(req, { action: 'update', entityType: 'registrations', entityId: registration.id, summary: `Checked in ${count} on ${registration.reference}` });
    res.json(updated);
  }),
);

/* ------------------------- Activity join requests ------------------------- */

operationsRouter.get(
  '/activities/:id/participants',
  route(async (req, res) => {
    assertPermission(req, 'activities.view');
    const rows = await prisma.activityParticipant.findMany({
      where: { activityId: req.params.id },
      include: { user: { select: { id: true, name: true, email: true, phone: true, city: true, country: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(rows);
  }),
);

export async function decideParticipant(participantId: string, status: 'APPROVED' | 'DECLINED' | 'WAITLIST' | 'CANCELLED') {
  return prisma.$transaction(async (tx) => {
    const participant = await tx.activityParticipant.findUniqueOrThrow({ where: { id: participantId }, include: { activity: true } });
    const wasApproved = participant.status === 'APPROVED';
    const willBeApproved = status === 'APPROVED';
    if (!wasApproved && willBeApproved) {
      const activity = participant.activity;
      if (activity.capacity !== null) {
        // The same guard as trip seats: a conditional increment, so two
        // approvals for the last space cannot both succeed.
        const claimed = await tx.activity.updateMany({
          where: { id: activity.id, spotsTaken: { lte: activity.capacity - 1 } },
          data: { spotsTaken: { increment: 1 } },
        });
        if (claimed.count === 0) throw ApiError.conflict('This activity is full. Increase the spaces or put the request on the waitlist.', 'activity_full');
      } else {
        await tx.activity.update({ where: { id: activity.id }, data: { spotsTaken: { increment: 1 } } });
      }
    } else if (wasApproved && !willBeApproved) {
      await tx.activity.update({ where: { id: participant.activityId }, data: { spotsTaken: { decrement: 1 } } });
    }
    const updated = await tx.activityParticipant.update({ where: { id: participantId }, data: { status, decidedAt: new Date() } });
    const activity = await tx.activity.findUniqueOrThrow({ where: { id: participant.activityId } });
    if (activity.capacity !== null) {
      if (activity.spotsTaken >= activity.capacity && activity.status === 'PUBLISHED') await tx.activity.update({ where: { id: activity.id }, data: { status: 'FULL' } });
      if (activity.spotsTaken < activity.capacity && activity.status === 'FULL') await tx.activity.update({ where: { id: activity.id }, data: { status: 'PUBLISHED' } });
    }
    return { participant: updated, activity };
  });
}

operationsRouter.post(
  '/participants/:id',
  route(async (req, res) => {
    assertPermission(req, 'activities.edit');
    const { status } = z.object({ status: z.enum(['APPROVED', 'DECLINED', 'WAITLIST', 'CANCELLED']) }).parse(req.body);
    const { participant, activity } = await decideParticipant(req.params.id, status);
    await notify({
      userId: participant.userId,
      type: 'TRIP_UPDATE',
      title: `${activity.title}`,
      body:
        status === 'APPROVED'
          ? 'Your request to join was approved. See the activity page for the details.'
          : status === 'WAITLIST'
            ? 'The activity is full for now — you are on the waitlist.'
            : 'Your request to join was not accepted this time.',
      link: `/activities/${activity.slug}`,
    });
    await audit(req, { action: 'status', entityType: 'participants', entityId: participant.id, summary: `Join request for “${activity.title}” → ${status}` });
    res.json(participant);
  }),
);

/* --------------------------- Reviews and reports --------------------------- */

operationsRouter.get(
  '/reviews',
  route(async (req, res) => {
    assertPermission(req, 'reviews.view');
    const status = str(req.query.status) ?? 'PENDING';
    const rows = await prisma.placeReview.findMany({
      where: status === 'all' ? {} : { status },
      include: { place: { select: { name: true, slug: true } }, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(rows);
  }),
);

operationsRouter.post(
  '/reviews/:id',
  route(async (req, res) => {
    assertPermission(req, 'reviews.edit');
    const { status } = z.object({ status: z.enum(['PUBLISHED', 'HIDDEN', 'PENDING']) }).parse(req.body);
    const review = await prisma.placeReview.update({ where: { id: req.params.id }, data: { status } });
    await audit(req, { action: 'status', entityType: 'reviews', entityId: review.id, summary: `Review → ${status}` });
    res.json(review);
  }),
);

operationsRouter.get(
  '/reports',
  route(async (req, res) => {
    assertPermission(req, 'reviews.view');
    const status = str(req.query.status) ?? 'OPEN';
    const rows = await prisma.report.findMany({ where: status === 'all' ? {} : { status }, orderBy: { createdAt: 'desc' }, take: 200 });
    // Name the reporter and the target, so the team can act without hunting.
    const userIds = new Set<string>();
    for (const row of rows) {
      if (row.reporterId) userIds.add(row.reporterId);
      if (row.targetType === 'USER') userIds.add(row.targetId);
    }
    const users = await prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true, email: true, status: true } });
    const byId = new Map(users.map((user) => [user.id, user]));
    res.json(rows.map((row) => ({ ...row, reporter: row.reporterId ? byId.get(row.reporterId) ?? null : null, targetUser: row.targetType === 'USER' ? byId.get(row.targetId) ?? null : null })));
  }),
);

operationsRouter.post(
  '/reports/:id',
  route(async (req, res) => {
    assertPermission(req, 'reviews.edit');
    const input = z.object({ status: z.enum(['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED']), resolution: z.string().max(2000).optional() }).parse(req.body);
    const report = await prisma.report.update({ where: { id: req.params.id }, data: { ...input, handledById: req.auth!.id } });
    await audit(req, { action: 'status', entityType: 'reports', entityId: report.id, summary: `Report on ${report.targetType.toLowerCase()} → ${input.status}` });
    res.json(report);
  }),
);

/** Sends a test WhatsApp notice to the team numbers, to check the integration end to end. */
operationsRouter.post(
  '/whatsapp/test',
  route(async (req, res) => {
    assertPermission(req, 'settings.edit');
    const outcome = await notifyTeam('Test notice', `Enhakkore: this is a test notice sent from the control centre by ${req.auth!.name}. If you can read it, automatic WhatsApp notices are working.`, { type: 'TEST', id: req.auth!.id });
    await audit(req, { action: 'update', entityType: 'settings', summary: `Sent a WhatsApp test notice (${outcome})` });
    res.json({ outcome });
  }),
);
