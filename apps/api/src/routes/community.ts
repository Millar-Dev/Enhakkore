import { Router, type Request } from 'express';
import { usernameProblem } from '../services/usernames';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { recordActivity } from '../services/activity';
import { ENQUIRY_TYPES, ENQUIRY_TYPE_LABELS, RESERVATION_TYPES, departureStatus, slugify } from '@enhakkore/shared';
import { env } from '../env';
import { ApiError, route } from '../lib/http';
import { bookingReference, shortCode } from '../lib/ids';
import { parseList, parseObjects } from '../lib/json';
import { prisma } from '../lib/prisma';
import { textContains } from '../lib/search';
import { requireAuth } from '../middleware/auth';
import { notify, notifyStaff } from '../services/notifications';
import { paymentSummary } from './tripPayments';
import { recordEngagement } from '../services/popularity';
import { notifyEnquiry } from '../services/whatsapp';
import { ENHAKKORE_ORGANIZER_SLUG } from '../services/resources/hooks';
import { decideParticipant } from './cc/operations';

/**
 * What members and visitors send: enquiries, trip applications, event
 * registrations, requests to join activities, and everything in Connect.
 *
 * Public forms carry a hidden "website" field that people never see and bots
 * fill in, and are rate-limited per address. Nothing sent here is published
 * without a person on the team reviewing it.
 */
export const communityRouter = Router();

/** Example listings exist to show the layout; nobody can sign up for one. */
export const DEMO_MESSAGE = 'This is an example (DEMO) listing, not a real scheduled activity, so registration is closed.';

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProduction ? 15 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many submissions from here. Please try again a little later, or message us on WhatsApp.' } },
});

const socialLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.isProduction ? 60 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Slow down a little — try again in a while.' } },
});

/** Bots fill every field; people never see this one. */
function rejectBots(req: Request) {
  if (typeof req.body?.website === 'string' && req.body.website.trim() !== '') {
    throw ApiError.badRequest('Submission refused.');
  }
}

const phone = z
  .string()
  .trim()
  .min(7, 'Enter a phone number we can reach you on.')
  .max(30)
  .regex(/^[+\d][\d\s()-]{6,}$/, 'Enter a valid phone number.');

/* -------------------------------- Enquiries ------------------------------- */

const enquirySchema = z
  .object({
    type: z.enum(ENQUIRY_TYPES).default('GENERAL'),
    subjectType: z.string().max(40).optional(),
    subjectId: z.string().max(60).optional(),
    subjectTitle: z.string().max(200).optional(),
    name: z.string().trim().min(2, 'Tell us your name.').max(100),
    phone: phone.optional().or(z.literal('')),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.').optional().or(z.literal('')),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    people: z.number().int().min(1).max(10000).optional().nullable(),
    message: z.string().trim().min(5, 'Tell us a little more.').max(4000),
    details: z.record(z.string().max(60), z.string().max(1000)).optional(),
  })
  .refine((value) => !!value.phone || !!value.email, { message: 'Give a phone number or an email so we can reply.', path: ['phone'] })
  .superRefine((value, ctx) => {
    // Hotel and restaurant requests need their essentials, and a WhatsApp/phone number.
    if ((value.type === 'ROOM' || value.type === 'TABLE') && !value.phone) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Give a phone or WhatsApp number so we can confirm.' });
    }
    if (value.type === 'ROOM') {
      if (!value.startDate) ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Choose your check-in date.' });
      if (!value.endDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Choose your check-out date.' });
      if (value.startDate && value.endDate && value.endDate <= value.startDate) {
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Check-out must be after check-in.' });
      }
    }
    if (value.type === 'TABLE') {
      if (!value.startDate) ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Choose a date.' });
      if (!value.details?.time) ctx.addIssue({ code: 'custom', path: ['time'], message: 'Choose a time.' });
      if (!value.people) ctx.addIssue({ code: 'custom', path: ['people'], message: 'How many guests?' });
    }
    if (value.type === 'VENUE') {
      if (!value.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Give a phone or WhatsApp number so we can confirm.' });
      if (!value.startDate) ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Choose the event date.' });
      if (!value.people) ctx.addIssue({ code: 'custom', path: ['people'], message: 'How many guests?' });
      if (!value.details?.eventType) ctx.addIssue({ code: 'custom', path: ['eventType'], message: 'What kind of event is it?' });
    }
    if (value.type === 'TRIP') {
      if (!value.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Give a phone or WhatsApp number so we can reply.' });
      if (!value.people) ctx.addIssue({ code: 'custom', path: ['people'], message: 'How many travellers?' });
    }
    if (value.type === 'PARTNERSHIP' && !value.details?.businessName) {
      ctx.addIssue({ code: 'custom', path: ['businessName'], message: 'Give the business name.' });
    }
  });

const ENQUIRY_THANKS: Record<string, string> = {
  TRIP: 'Thank you — your trip request has reached the Enhakkore travel team. This is a request, not a confirmed place: we will contact you about dates, availability and how to secure your place.',
  ROOM: 'Thank you — your hotel enquiry has reached the Enhakkore team. This is a request, not a booking: no room is reserved until the property confirms availability and price.',
  VENUE: 'Thank you — your venue enquiry has reached the Enhakkore team. This is a request, not a booking: the venue is not reserved until the team confirms it with the venue.',
  TABLE: 'Thank you — your reservation request has reached the Enhakkore team. Your table is not confirmed until the restaurant accepts it; we will tell you as soon as it does.',
  EVENT_PLAN: 'Thank you — your event-planning request has reached the Enhakkore team. Sending it is free; we will contact you to discuss your event and, if you wish, a quotation.',
  PARTNERSHIP: 'Thank you — your application has reached the Enhakkore team. We review every business before anything is published, and will contact you.',
  VOLUNTEER: 'Thank you for offering your time. The impact team will contact you about upcoming opportunities.',
};

communityRouter.post(
  '/enquiries',
  formLimiter,
  route(async (req, res) => {
    rejectBots(req);
    const input = enquirySchema.parse(req.body);
    // Hotel, restaurant and venue requests are tied to an account, so the
    // customer can follow the request and its status in their Account Centre.
    if ((RESERVATION_TYPES as readonly string[]).includes(input.type) && !req.auth) {
      throw ApiError.unauthorized('Sign in or create a free account to send a reservation request.');
    }
    // A double tap, a retry on a slow connection or a second submit of the same
    // request returns the first one instead of creating a duplicate.
    const contact = req.auth?.id ? { userId: req.auth.id } : input.phone ? { phone: input.phone } : input.email ? { email: input.email } : null;
    if (contact) {
      const duplicate = await prisma.enquiry.findFirst({
        where: {
          ...contact,
          type: input.type,
          subjectId: input.subjectId ?? null,
          startDate: input.startDate ? new Date(`${input.startDate}T12:00:00Z`) : null,
          status: { notIn: ['CANCELLED', 'DECLINED', 'CLOSED', 'SPAM'] },
          createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (duplicate) {
        return res.status(200).json({
          reference: duplicate.reference,
          duplicate: true,
          notice: null,
          message: `You already sent this request a few minutes ago (reference ${duplicate.reference}). We have it — there is no need to send it again.`,
        });
      }
    }
    const enquiry = await prisma.enquiry.create({
      data: {
        reference: `ENQ-${shortCode(6)}`,
        type: input.type,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
        subjectTitle: input.subjectTitle ?? null,
        userId: req.auth?.id ?? null,
        name: input.name,
        phone: input.phone || null,
        email: input.email || null,
        startDate: input.startDate ? new Date(`${input.startDate}T12:00:00Z`) : null,
        endDate: input.endDate ? new Date(`${input.endDate}T12:00:00Z`) : null,
        people: input.people ?? null,
        message: input.message,
        details: JSON.stringify(input.details ?? {}),
      },
    });
    const notice = await notifyEnquiry(enquiry);
    // The responsible team members see it in the control centre straight away.
    await notifyStaff(enquiry.type === 'PARTNERSHIP' ? 'partnerships.view' : 'enquiries.view', {
      type: 'ENQUIRY_RECEIVED',
      title: `New ${(ENQUIRY_TYPE_LABELS[enquiry.type] ?? 'enquiry').toLowerCase()} · ${enquiry.reference}`,
      body: [enquiry.subjectTitle, enquiry.startDate?.toISOString().slice(0, 10), enquiry.people ? `${enquiry.people} people` : null].filter(Boolean).join(' · ') || enquiry.message.slice(0, 120),
      link: `/admin/enquiries?ref=${enquiry.reference}`,
    });
    if (enquiry.userId) {
      await notify({
        userId: enquiry.userId,
        type: 'ENQUIRY_RECEIVED',
        title: `Enquiry ${enquiry.reference} received`,
        body: enquiry.subjectTitle ? `About ${enquiry.subjectTitle}. We will reply soon.` : 'We will reply soon.',
        link: '/account/enquiries',
      });
    }
    if (enquiry.subjectType && enquiry.subjectId) await recordEngagement(req, enquiry.subjectType, enquiry.subjectId, 'ENQUIRY');
    res.status(201).json({
      reference: enquiry.reference,
      notice,
      message:
        ENQUIRY_THANKS[enquiry.type] ??
        'Thank you — your enquiry has reached the Enhakkore team. This is not a confirmed booking: we will reply to confirm availability and details.',
    });
  }),
);

/* ----------------------------- Trip applications --------------------------- */

const applySchema = z.object({
  departureId: z.string().min(5),
  travellers: z
    .array(
      z.object({
        fullName: z.string().trim().min(2, 'Full name, please.').max(120),
        phone: z.string().trim().max(30).optional().or(z.literal('')),
        email: z.string().trim().max(200).optional().or(z.literal('')),
        notes: z.string().trim().max(600).optional().or(z.literal('')),
      }),
    )
    .min(1)
    .max(20),
  priceTier: z.string().max(120).optional().nullable(),
  contactPhone: phone,
  notes: z.string().trim().max(2000).optional(),
});

/**
 * Applies for places on an Enhakkore departure.
 *
 * Seats are held at once with the same conditional update that protects every
 * departure from overselling; a declined or cancelled application gives them
 * back. Nothing is charged: the team approves, the traveller pays by the
 * method shown, and the booking is confirmed when the payment is verified.
 */
communityRouter.post(
  '/trips/apply',
  requireAuth,
  formLimiter,
  route(async (req, res) => {
    const input = applySchema.parse(req.body);
    const departure = await prisma.tripDate.findUnique({
      where: { id: input.departureId },
      include: { trip: { include: { organizer: true } } },
    });
    if (!departure || departure.trip.organizer.slug !== ENHAKKORE_ORGANIZER_SLUG || departure.trip.status !== 'PUBLISHED') {
      throw ApiError.notFound('That departure is not open for applications.');
    }
    if (departure.startDate.getTime() < Date.now()) throw ApiError.unprocessable('That departure has already left.', 'departure_past');
    if (departure.status === 'CLOSED') throw ApiError.unprocessable('Applications for this date are closed.', 'departure_closed');
    if (departure.bookingDeadline && departure.bookingDeadline.getTime() + 12 * 3600000 < Date.now()) {
      throw ApiError.unprocessable('The application deadline for this date has passed.', 'deadline_passed');
    }

    const existing = await prisma.booking.findFirst({
      where: { userId: req.auth!.id, tripDateId: departure.id, status: { in: ['APPLIED', 'PENDING_PAYMENT', 'CONFIRMED'] } },
    });
    if (existing) {
      throw ApiError.conflict(`You already have an application for this date (${existing.reference}).`, 'already_applied');
    }

    // The price: a named tier (e.g. international visitor) or the departure's own.
    const tiers = parseObjects<{ label: string; amount: number; currency: string }>(departure.trip.priceTiers);
    const tier = input.priceTier ? tiers.find((item) => item.label === input.priceTier) : undefined;
    if (input.priceTier && !tier) throw ApiError.badRequest('Choose one of the prices shown.');
    const unit = tier ? Number(tier.amount) : (departure.price ?? departure.trip.basePrice);
    const currency = tier ? tier.currency : departure.trip.currency;
    const count = input.travellers.length;

    const booking = await prisma.$transaction(async (tx) => {
      const claimed = await tx.tripDate.updateMany({
        where: { id: departure.id, seatsBooked: { lte: departure.capacity - count } },
        data: { seatsBooked: { increment: count } },
      });
      if (claimed.count === 0) {
        const fresh = await tx.tripDate.findUniqueOrThrow({ where: { id: departure.id } });
        const left = Math.max(0, fresh.capacity - fresh.seatsBooked);
        throw ApiError.conflict(left === 0 ? 'This date is full.' : `Only ${left} ${left === 1 ? 'place is' : 'places are'} left on this date.`, 'not_enough_seats');
      }
      const fresh = await tx.tripDate.findUniqueOrThrow({ where: { id: departure.id } });
      await tx.tripDate.update({ where: { id: departure.id }, data: { status: departureStatus(fresh.seatsBooked, fresh.capacity) } });
      return tx.booking.create({
        data: {
          reference: bookingReference(),
          tripId: departure.tripId,
          tripDateId: departure.id,
          userId: req.auth!.id,
          travellers: count,
          status: 'APPLIED',
          channel: 'APPLICATION',
          tripAmount: unit * count,
          totalAmount: unit * count,
          currency,
          priceTier: tier?.label ?? null,
          contactPhone: input.contactPhone,
          notes: input.notes ?? null,
          travellerList: {
            create: input.travellers.map((traveller) => ({
              fullName: traveller.fullName,
              phone: traveller.phone || null,
              email: traveller.email || null,
              notes: traveller.notes || null,
            })),
          },
        },
      });
    });

    await notify({
      userId: req.auth!.id,
      type: 'TRIP_UPDATE',
      title: `Application received · ${departure.trip.title}`,
      body: 'Your places are held while the Enhakkore team reviews your application. This is not yet a confirmed booking.',
      link: `/account/applications/${booking.reference}`,
    });
    await recordActivity({ userId: req.auth!.id, action: 'TRIP_JOINED', title: `Applied to join ${departure.trip.title}`, link: `/account/applications/${booking.reference}`, subjectType: 'TRIP', subjectId: departure.trip.id });
    res.status(201).json({ reference: booking.reference });
  }),
);

/** The applicant's own view of an application, with how to pay. */
communityRouter.get(
  '/applications',
  requireAuth,
  route(async (req, res) => {
    const rows = await prisma.booking.findMany({
      where: { userId: req.auth!.id, channel: 'APPLICATION' },
      include: { trip: { select: { title: true, slug: true, heroImage: true } }, departure: { select: { startDate: true, endDate: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows.map((row) => ({ reference: row.reference, status: row.status, paymentStatus: row.paymentStatus, travellers: row.travellers, totalAmount: row.totalAmount, amountPaid: row.amountPaid, currency: row.currency, trip: row.trip, departure: row.departure, createdAt: row.createdAt })));
  }),
);

communityRouter.get(
  '/applications/:reference',
  requireAuth,
  route(async (req, res) => {
    const booking = await prisma.booking.findFirst({
      where: { reference: req.params.reference, userId: req.auth!.id, channel: 'APPLICATION' },
      include: {
        trip: { select: { title: true, slug: true, heroImage: true, paymentInstructions: true, paymentOptions: true, cancellationPolicy: true, depositAmount: true } },
        departure: { include: { conversation: { select: { id: true } } } },
        travellerList: { select: { fullName: true, phone: true, email: true } },
        payments: { where: { status: 'SUCCEEDED' }, select: { amount: true, currency: true, method: true, settledAt: true, providerRef: true } },
      },
    });
    if (!booking) throw ApiError.notFound('We could not find that application.');
    const methods = await prisma.paymentMethod.findMany({ where: { status: 'ENABLED' }, orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }] });
    res.json({
      reference: booking.reference,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      paymentSummary: paymentSummary(booking, booking.trip.depositAmount),
      travellers: booking.travellerList,
      priceTier: booking.priceTier,
      totalAmount: booking.totalAmount,
      amountPaid: booking.amountPaid,
      currency: booking.currency,
      createdAt: booking.createdAt,
      cancelReason: booking.cancelReason,
      trip: { ...booking.trip, paymentOptions: parseObjects(booking.trip.paymentOptions) },
      departure: { startDate: booking.departure.startDate, endDate: booking.departure.endDate },
      // The private group opens only once the booking is confirmed.
      groupId: booking.status === 'CONFIRMED' || booking.status === 'COMPLETED' ? (booking.departure.conversation?.id ?? null) : null,
      payments: booking.payments,
      paymentMethods: methods
        .filter((method) => parseList(method.scopes).includes('TRIPS'))
        .map((method) => ({ name: method.name, provider: method.provider, accountName: method.accountName, accountNumber: method.accountNumber, instructions: method.instructions, referenceFormat: method.referenceFormat })),
    });
  }),
);

/** An applicant may withdraw before the trip; the seats go back. */
communityRouter.post(
  '/applications/:reference/withdraw',
  requireAuth,
  route(async (req, res) => {
    const booking = await prisma.booking.findFirst({ where: { reference: req.params.reference, userId: req.auth!.id, channel: 'APPLICATION' }, include: { departure: true } });
    if (!booking) throw ApiError.notFound();
    if (!['APPLIED', 'PENDING_PAYMENT'].includes(booking.status)) {
      throw ApiError.unprocessable(booking.status === 'CONFIRMED' ? 'Your booking is confirmed — contact Enhakkore on WhatsApp to cancel, under the cancellation policy.' : 'This application is already closed.');
    }
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'Withdrawn by the applicant' } });
      const seatsBooked = Math.max(0, booking.departure.seatsBooked - booking.travellers);
      await tx.tripDate.update({ where: { id: booking.tripDateId }, data: { seatsBooked, status: booking.departure.status === 'CLOSED' ? 'CLOSED' : departureStatus(seatsBooked, booking.departure.capacity) } });
    });
    res.json({ ok: true });
  }),
);

/* ---------------------------- Event registration --------------------------- */

const registerSchema = z.object({
  ticketId: z.string().min(5),
  quantity: z.number().int().min(1).max(20),
  name: z.string().trim().min(2, 'Tell us your name.').max(100),
  phone,
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional(),
});

/**
 * Registers for an Enhakkore event. Places are held at once against both the
 * ticket's limit and the event's, so the last tickets cannot be sold twice.
 */
communityRouter.post(
  '/events/:slug/register',
  formLimiter,
  route(async (req, res) => {
    rejectBots(req);
    const input = registerSchema.parse(req.body);
    const event = await prisma.event.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' }, include: { tickets: true } });
    if (event?.isDemo) throw ApiError.conflict(DEMO_MESSAGE);
    if (!event) throw ApiError.notFound('That event is not open for registration.');
    if (event.registrationMode !== 'ENHAKKORE') throw ApiError.unprocessable('Registration for this event is handled by its organiser.');
    if ((event.endsAt ?? event.startsAt).getTime() < Date.now()) throw ApiError.unprocessable('This event has already taken place.');
    const ticket = event.tickets.find((item) => item.id === input.ticketId && item.active);
    if (!ticket) throw ApiError.badRequest('Choose a ticket.');

    const registration = await prisma.$transaction(async (tx) => {
      if (ticket.capacity !== null) {
        const claimed = await tx.eventTicket.updateMany({
          where: { id: ticket.id, sold: { lte: ticket.capacity - input.quantity } },
          data: { sold: { increment: input.quantity } },
        });
        if (claimed.count === 0) throw ApiError.conflict('Not enough of these tickets are left.', 'sold_out');
      } else {
        await tx.eventTicket.update({ where: { id: ticket.id }, data: { sold: { increment: input.quantity } } });
      }
      if (event.capacity !== null) {
        const sold = await tx.eventTicket.aggregate({ where: { eventId: event.id }, _sum: { sold: true } });
        if ((sold._sum.sold ?? 0) > event.capacity) throw ApiError.conflict('The event is full.', 'sold_out');
      }
      return tx.eventRegistration.create({
        data: {
          reference: `EVT-${shortCode(6)}`,
          eventId: event.id,
          ticketId: ticket.id,
          userId: req.auth?.id ?? null,
          name: input.name,
          phone: input.phone,
          email: input.email || null,
          quantity: input.quantity,
          amountDue: ticket.price * input.quantity,
          currency: ticket.currency,
          // A free ticket needs no payment check.
          status: ticket.price === 0 ? 'CONFIRMED' : 'PENDING_PAYMENT',
          notes: input.notes ?? null,
        },
      });
    });

    if (req.auth) await recordActivity({ userId: req.auth.id, action: 'EVENT_REGISTERED', title: `Registered for ${event.title}`, link: `/events/${event.slug}`, subjectType: 'EVENT', subjectId: event.id });
    const methods = await prisma.paymentMethod.findMany({ where: { status: 'ENABLED' }, orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }] });
    res.status(201).json({
      reference: registration.reference,
      status: registration.status,
      amountDue: registration.amountDue,
      currency: registration.currency,
      paymentInstructions: event.paymentInstructions,
      paymentMethods: methods
        .filter((method) => parseList(method.scopes).includes('EVENTS'))
        .map((method) => ({ name: method.name, provider: method.provider, accountName: method.accountName, accountNumber: method.accountNumber, instructions: method.instructions })),
    });
  }),
);

/* --------------------------- Activities: joining --------------------------- */

communityRouter.post(
  '/activities/:slug/join',
  requireAuth,
  socialLimiter,
  route(async (req, res) => {
    const { message } = z.object({ message: z.string().trim().max(500).optional() }).parse(req.body ?? {});
    const activity = await prisma.activity.findFirst({ where: { slug: req.params.slug, status: { in: ['PUBLISHED', 'FULL'] } } });
    if (activity?.isDemo) throw ApiError.conflict(DEMO_MESSAGE);
    if (!activity) throw ApiError.notFound('That activity is not taking requests.');
    if (activity.startsAt && !activity.recurrence && (activity.endsAt ?? activity.startsAt).getTime() < Date.now()) {
      throw ApiError.unprocessable('This activity has already happened.');
    }
    if (activity.organiserUserId === req.auth!.id) throw ApiError.badRequest('You are organising this one.');
    const participant = await prisma.activityParticipant.upsert({
      where: { activityId_userId: { activityId: activity.id, userId: req.auth!.id } },
      create: { activityId: activity.id, userId: req.auth!.id, message: message ?? null, status: activity.status === 'FULL' ? 'WAITLIST' : 'REQUESTED' },
      update: { message: message ?? null, status: activity.status === 'FULL' ? 'WAITLIST' : 'REQUESTED' },
    });
    if (activity.organiserUserId) {
      await notify({ userId: activity.organiserUserId, type: 'TRIP_UPDATE', title: `New request · ${activity.title}`, body: `${req.auth!.name} would like to join.`, link: '/account/hosting' });
    }
    res.status(201).json({ status: participant.status });
  }),
);

communityRouter.post(
  '/activities/:slug/leave',
  requireAuth,
  route(async (req, res) => {
    const activity = await prisma.activity.findFirst({ where: { slug: req.params.slug } });
    if (!activity) throw ApiError.notFound();
    const participant = await prisma.activityParticipant.findUnique({ where: { activityId_userId: { activityId: activity.id, userId: req.auth!.id } } });
    if (!participant) throw ApiError.notFound();
    await decideParticipant(participant.id, 'CANCELLED');
    res.json({ ok: true });
  }),
);

/** Activities this member organises, with who has asked to join. */
communityRouter.get(
  '/hosting',
  requireAuth,
  route(async (req, res) => {
    const rows = await prisma.activity.findMany({
      where: { organiserUserId: req.auth!.id },
      include: { participants: { include: { user: { select: { id: true, name: true, avatarUrl: true, city: true, country: true } } }, orderBy: { createdAt: 'asc' } } },
      orderBy: { startsAt: 'desc' },
    });
    const checkedIn = await prisma.pass.groupBy({ by: ['listingId'], where: { listingType: 'ACTIVITY', listingId: { in: rows.map((row) => row.id) }, status: 'CHECKED_IN' }, _count: { _all: true } });
    const attendance = new Map(checkedIn.map((row) => [row.listingId, row._count._all]));
    res.json(
      rows.map((row) => ({
        id: row.id, slug: row.slug, title: row.title, status: row.status, startsAt: row.startsAt, timezone: row.timezone, capacity: row.capacity, spotsTaken: row.spotsTaken,
        verification: row.verification, chatEnabled: row.chatEnabled, checkedIn: attendance.get(row.id) ?? 0,
        // The team's note is shown to the organiser when it asks for changes.
        reviewNotes: row.status === 'CHANGES_REQUESTED' || row.status === 'REJECTED' ? row.reviewNotes : null,
        participants: row.participants.map((p) => ({ ...p, user: { ...p.user, country: undefined } })),
      })),
    );
  }),
);

communityRouter.post(
  '/hosting/participants/:id',
  requireAuth,
  route(async (req, res) => {
    const { status } = z.object({ status: z.enum(['APPROVED', 'DECLINED', 'WAITLIST']) }).parse(req.body);
    const participant = await prisma.activityParticipant.findUnique({ where: { id: req.params.id }, include: { activity: true } });
    if (!participant || participant.activity.organiserUserId !== req.auth!.id) throw ApiError.notFound();
    const result = await decideParticipant(participant.id, status);
    await notify({
      userId: participant.userId,
      type: 'TRIP_UPDATE',
      title: participant.activity.title,
      body: status === 'APPROVED' ? 'The organiser approved your request.' : status === 'WAITLIST' ? 'You are on the waitlist.' : 'Your request was not accepted this time.',
      link: `/activities/${participant.activity.slug}`,
    });
    res.json(result.participant);
  }),
);

/** The organiser messages everyone approved, as an in-app notification. */
communityRouter.post(
  '/hosting/:activityId/update',
  requireAuth,
  socialLimiter,
  route(async (req, res) => {
    const { message } = z.object({ message: z.string().trim().min(3).max(600) }).parse(req.body);
    const activity = await prisma.activity.findUnique({ where: { id: req.params.activityId }, include: { participants: { where: { status: 'APPROVED' } } } });
    if (!activity || activity.organiserUserId !== req.auth!.id) throw ApiError.notFound();
    await prisma.notification.createMany({
      data: activity.participants.map((participant) => ({ userId: participant.userId, type: 'ANNOUNCEMENT', title: `Update · ${activity.title}`, body: message, link: `/activities/${activity.slug}` })),
    });
    res.json({ sent: activity.participants.length });
  }),
);

/* ---------------------------------- Connect -------------------------------- */

/** Blocks either way hide two people from each other completely. */
async function blockedIds(userId: string): Promise<string[]> {
  const rows = await prisma.block.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
  return rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId));
}

/** A member as other members see them: no email, no phone, no address, no location. */
type CardUser = { id: string; name: string; username?: string | null; avatarUrl: string | null; coverImage?: string | null; country: string | null; city: string | null; headline: string | null; bio?: string | null; interests: string; activityPrefs: string; profileFields?: string | null; createdAt: Date };

/** Field visibility a member chose. Default: shown to members. */
export function fieldVisibility(user: { profileFields?: string | null }): Record<string, string> {
  try {
    const parsed = JSON.parse(user.profileFields || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * A member's profile card. `audience` is who is looking: MEMBERS (signed in)
 * or PUBLIC (anyone). Fields the member set to Private are never included,
 * and no phone number or email ever is.
 */
export function memberCard(user: CardUser, audience: 'MEMBERS' | 'PUBLIC' | 'SELF' = 'MEMBERS') {
  const vis = fieldVisibility(user);
  const show = (field: string) => {
    if (audience === 'SELF') return true;
    const level = vis[field] ?? 'MEMBERS';
    return level === 'PUBLIC' || (level === 'MEMBERS' && audience === 'MEMBERS');
  };
  return {
    id: user.id,
    // Usernames are the public handle; the full name is shown to signed-in members only.
    name: audience === 'PUBLIC' ? (user.username ? `@${user.username}` : user.name.split(' ')[0]) : user.name,
    username: user.username ?? null,
    avatarUrl: user.avatarUrl,
    coverImage: user.coverImage ?? null,
    country: show('location') ? user.country : null,
    city: show('location') ? user.city : null,
    headline: user.headline,
    bio: show('bio') ? (user.bio ?? null) : null,
    interests: show('interests') ? parseList(user.interests) : [],
    activityPrefs: show('interests') ? parseList(user.activityPrefs) : [],
    memberSince: user.createdAt,
    visibility: { communities: show('communities'), activities: show('activities') },
  };
}

const MEMBER_FIELDS = { id: true, name: true, username: true, coverImage: true, profileFields: true, avatarUrl: true, country: true, city: true, headline: true, bio: true, interests: true, activityPrefs: true, createdAt: true } as const;

communityRouter.get(
  '/members',
  requireAuth,
  route(async (req, res) => {
    const hidden = await blockedIds(req.auth!.id);
    const and: Record<string, unknown>[] = [
      { status: 'ACTIVE', isDemo: false, role: { in: ['TRAVELER', 'ORGANIZER', 'STAFF', 'ADMIN'] } },
      { profileVisibility: { not: 'HIDDEN' } },
      { id: { notIn: [req.auth!.id, ...hidden] } },
    ];
    const country = typeof req.query.country === 'string' && req.query.country ? req.query.country : null;
    if (country) and.push({ country: textContains(country) });
    const city = typeof req.query.city === 'string' && req.query.city ? req.query.city : null;
    if (city) and.push({ city: textContains(city) });
    const interest = typeof req.query.interest === 'string' && req.query.interest ? req.query.interest : null;
    if (interest) and.push({ OR: [{ interests: textContains(interest) }, { activityPrefs: textContains(interest) }] });
    const q = typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q.trim() : null;
    if (q) and.push({ OR: [{ name: textContains(q) }, { username: textContains(q.replace(/^@/, '').toLowerCase()) }, { headline: textContains(q) }] });
    const rows = await prisma.user.findMany({ where: { AND: and }, select: MEMBER_FIELDS, orderBy: { lastLoginAt: 'desc' }, take: 60 });
    const connections = await prisma.connection.findMany({
      where: { OR: [{ requesterId: req.auth!.id }, { addresseeId: req.auth!.id }] },
    });
    res.json(
      rows.map((row) => {
        const link = connections.find((item) => item.requesterId === row.id || item.addresseeId === row.id);
        return {
          ...memberCard(row),
          connection: link ? { id: link.id, status: link.status, incoming: link.addresseeId === req.auth!.id } : null,
        };
      }),
    );
  }),
);

communityRouter.get(
  '/members/:id',
  requireAuth,
  route(async (req, res) => {
    const hidden = await blockedIds(req.auth!.id);
    if (hidden.includes(req.params.id)) throw ApiError.notFound('That member is not available.');
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, status: 'ACTIVE', isDemo: false, OR: [{ profileVisibility: { not: 'HIDDEN' } }, { id: req.auth!.id }] },
      select: MEMBER_FIELDS,
    });
    if (!user) throw ApiError.notFound('That member is not available.');
    const link = await prisma.connection.findFirst({
      where: { OR: [{ requesterId: req.auth!.id, addresseeId: user.id }, { requesterId: user.id, addresseeId: req.auth!.id }] },
    });
    const [going, communities, published] = await Promise.all([
      prisma.activityParticipant.findMany({
        where: { userId: user.id, status: 'APPROVED', activity: { status: { in: ['PUBLISHED', 'FULL'] } } },
        select: { activity: { select: { title: true, slug: true } } },
        take: 6,
      }),
      prisma.communityMember.findMany({ where: { userId: user.id, status: 'ACTIVE', community: { status: 'PUBLISHED' } }, select: { community: { select: { name: true, slug: true } } }, take: 20 }),
      prisma.activity.findMany({ where: { organiserUserId: user.id, status: { in: ['PUBLISHED', 'FULL', 'COMPLETED'] } }, select: { title: true, slug: true }, take: 12 }),
    ]);
    const card = memberCard(user, user.id === req.auth!.id ? 'SELF' : 'MEMBERS');
    res.json({
      ...card,
      connection: link ? { id: link.id, status: link.status, incoming: link.addresseeId === req.auth!.id } : null,
      activities: card.visibility.activities ? going.map((row) => row.activity) : [],
      communities: card.visibility.communities ? communities.map((row) => row.community) : [],
      published: published,
      // Approved by the team as an organiser (per category), or has had an activity published.
      approvedOrganiser: published.length > 0 || (await prisma.organiserApplication.count({ where: { userId: user.id, status: 'APPROVED' } })) > 0,
    });
  }),
);

communityRouter.get(
  '/connections',
  requireAuth,
  route(async (req, res) => {
    const rows = await prisma.connection.findMany({
      where: { OR: [{ requesterId: req.auth!.id }, { addresseeId: req.auth!.id }], status: { in: ['PENDING', 'ACCEPTED'] } },
      include: { requester: { select: MEMBER_FIELDS }, addressee: { select: MEMBER_FIELDS } },
      orderBy: { createdAt: 'desc' },
    });
    const view = (row: (typeof rows)[number]) => {
      const other = row.requesterId === req.auth!.id ? row.addressee : row.requester;
      return { id: row.id, status: row.status, incoming: row.addresseeId === req.auth!.id, member: memberCard(other), createdAt: row.createdAt };
    };
    res.json({
      incoming: rows.filter((row) => row.status === 'PENDING' && row.addresseeId === req.auth!.id).map(view),
      outgoing: rows.filter((row) => row.status === 'PENDING' && row.requesterId === req.auth!.id).map(view),
      connected: rows.filter((row) => row.status === 'ACCEPTED').map(view),
    });
  }),
);

communityRouter.post(
  '/connections',
  requireAuth,
  socialLimiter,
  route(async (req, res) => {
    const { userId } = z.object({ userId: z.string().min(5) }).parse(req.body);
    if (userId === req.auth!.id) throw ApiError.badRequest('That is you.');
    if ((await blockedIds(req.auth!.id)).includes(userId)) throw ApiError.notFound('That member is not available.');
    const target = await prisma.user.findFirst({ where: { id: userId, status: 'ACTIVE', profileVisibility: { not: 'HIDDEN' } } });
    if (!target) throw ApiError.notFound('That member is not available.');
    const reverse = await prisma.connection.findUnique({ where: { requesterId_addresseeId: { requesterId: userId, addresseeId: req.auth!.id } } });
    if (reverse && reverse.status === 'PENDING') {
      // They already asked us: accepting is the natural reading.
      const accepted = await prisma.connection.update({ where: { id: reverse.id }, data: { status: 'ACCEPTED', respondedAt: new Date() } });
      return res.json({ id: accepted.id, status: accepted.status });
    }
    if (reverse && reverse.status === 'ACCEPTED') return res.json({ id: reverse.id, status: reverse.status });
    const connection = await prisma.connection.upsert({
      where: { requesterId_addresseeId: { requesterId: req.auth!.id, addresseeId: userId } },
      create: { requesterId: req.auth!.id, addresseeId: userId },
      // A declined request is not re-sent automatically; it stays declined.
      update: {},
    });
    if (connection.status === 'PENDING') {
      await notify({ userId, type: 'ANNOUNCEMENT', title: 'New connection request', body: `${req.auth!.name} would like to connect on Enhakkore.`, link: '/connect/requests' });
    }
    res.status(201).json({ id: connection.id, status: connection.status });
  }),
);

communityRouter.post(
  '/connections/:id/respond',
  requireAuth,
  route(async (req, res) => {
    const { accept } = z.object({ accept: z.boolean() }).parse(req.body);
    const connection = await prisma.connection.findUnique({ where: { id: req.params.id } });
    if (!connection || connection.addresseeId !== req.auth!.id || connection.status !== 'PENDING') throw ApiError.notFound();
    const updated = await prisma.connection.update({ where: { id: connection.id }, data: { status: accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() } });
    if (accept) await notify({ userId: connection.requesterId, type: 'ANNOUNCEMENT', title: 'Connection accepted', body: `${req.auth!.name} accepted your request.`, link: `/connect/members/${req.auth!.id}` });
    res.json({ id: updated.id, status: updated.status });
  }),
);

communityRouter.delete(
  '/connections/:id',
  requireAuth,
  route(async (req, res) => {
    const connection = await prisma.connection.findUnique({ where: { id: req.params.id } });
    if (!connection || (connection.requesterId !== req.auth!.id && connection.addresseeId !== req.auth!.id)) throw ApiError.notFound();
    await prisma.connection.delete({ where: { id: connection.id } });
    res.json({ ok: true });
  }),
);

communityRouter.get(
  '/blocks',
  requireAuth,
  route(async (req, res) => {
    const rows = await prisma.block.findMany({ where: { blockerId: req.auth!.id }, include: { blocked: { select: { id: true, name: true } } } });
    res.json(rows.map((row) => ({ userId: row.blockedId, name: row.blocked.name, createdAt: row.createdAt })));
  }),
);

communityRouter.post(
  '/blocks',
  requireAuth,
  route(async (req, res) => {
    const { userId } = z.object({ userId: z.string().min(5) }).parse(req.body);
    if (userId === req.auth!.id) throw ApiError.badRequest('That is you.');
    await prisma.block.upsert({ where: { blockerId_blockedId: { blockerId: req.auth!.id, blockedId: userId } }, create: { blockerId: req.auth!.id, blockedId: userId }, update: {} });
    // A block ends any connection between the two.
    await prisma.connection.deleteMany({ where: { OR: [{ requesterId: req.auth!.id, addresseeId: userId }, { requesterId: userId, addresseeId: req.auth!.id }] } });
    res.status(201).json({ ok: true });
  }),
);

communityRouter.delete(
  '/blocks/:userId',
  requireAuth,
  route(async (req, res) => {
    await prisma.block.deleteMany({ where: { blockerId: req.auth!.id, blockedId: req.params.userId } });
    res.json({ ok: true });
  }),
);

communityRouter.post(
  '/reports',
  requireAuth,
  formLimiter,
  route(async (req, res) => {
    const input = z
      .object({
        targetType: z.enum(['USER', 'ACTIVITY', 'PLACE', 'EVENT', 'STORY', 'REVIEW', 'COMMUNITY', 'MESSAGE', 'TRIP']),
        targetId: z.string().min(3).max(60),
        reason: z.string().trim().min(3, 'Choose a reason.').max(120),
        details: z.string().trim().max(2000).optional(),
      })
      .parse(req.body);
    await prisma.report.create({ data: { ...input, reporterId: req.auth!.id } });
    res.status(201).json({ ok: true, message: 'Thank you. The community team will look into it.' });
  }),
);

/* -------------------------- Wishlist, polls, stories ------------------------ */

const SAVE_TYPES = ['TRIP', 'PLACE', 'EXPERIENCE', 'EVENT', 'ACTIVITY', 'COUNTRY', 'CITY'] as const;

communityRouter.get(
  '/saved',
  requireAuth,
  route(async (req, res) => {
    const rows = await prisma.savedItem.findMany({ where: { userId: req.auth!.id }, orderBy: { createdAt: 'desc' } });
    const ids = (type: string) => rows.filter((row) => row.itemType === type).map((row) => row.itemId);
    const [trips, places, experiences, events, activities, countries, cities] = await Promise.all([
      prisma.trip.findMany({ where: { id: { in: ids('TRIP') } }, select: { id: true, title: true, slug: true, heroImage: true } }),
      prisma.place.findMany({ where: { id: { in: ids('PLACE') }, status: 'PUBLISHED' }, select: { id: true, name: true, slug: true, coverImage: true } }),
      prisma.experience.findMany({ where: { id: { in: ids('EXPERIENCE') }, status: 'PUBLISHED' }, select: { id: true, title: true, slug: true, coverImage: true } }),
      prisma.event.findMany({ where: { id: { in: ids('EVENT') } }, select: { id: true, title: true, slug: true, poster: true, startsAt: true } }),
      prisma.activity.findMany({ where: { id: { in: ids('ACTIVITY') } }, select: { id: true, title: true, slug: true, coverImage: true, startsAt: true } }),
      prisma.country.findMany({ where: { id: { in: ids('COUNTRY') } }, select: { id: true, name: true, slug: true, heroImage: true } }),
      prisma.city.findMany({ where: { id: { in: ids('CITY') } }, select: { id: true, name: true, slug: true, heroImage: true, country: { select: { slug: true, name: true } } } }),
    ]);
    res.json([
      ...trips.map((row) => ({ itemType: 'TRIP', itemId: row.id, title: row.title, href: `/travel/${row.slug}`, image: row.heroImage })),
      ...places.map((row) => ({ itemType: 'PLACE', itemId: row.id, title: row.name, href: `/discover/${row.slug}`, image: row.coverImage })),
      ...experiences.map((row) => ({ itemType: 'EXPERIENCE', itemId: row.id, title: row.title, href: `/experiences/${row.slug}`, image: row.coverImage })),
      ...events.map((row) => ({ itemType: 'EVENT', itemId: row.id, title: row.title, href: `/events/${row.slug}`, image: row.poster })),
      ...activities.map((row) => ({ itemType: 'ACTIVITY', itemId: row.id, title: row.title, href: `/activities/${row.slug}`, image: row.coverImage })),
      ...countries.map((row) => ({ itemType: 'COUNTRY', itemId: row.id, title: row.name, href: `/destinations/${row.slug}`, image: row.heroImage })),
      ...cities.map((row) => ({ itemType: 'CITY', itemId: row.id, title: `${row.name}, ${row.country.name}`, href: `/destinations/${row.country.slug}/${row.slug}`, image: row.heroImage })),
    ]);
  }),
);

communityRouter.post(
  '/saved',
  requireAuth,
  socialLimiter,
  route(async (req, res) => {
    const input = z.object({ itemType: z.enum(SAVE_TYPES), itemId: z.string().min(5).max(60) }).parse(req.body);
    const existing = await prisma.savedItem.findUnique({ where: { userId_itemType_itemId: { userId: req.auth!.id, ...input } } });
    if (existing) {
      await prisma.savedItem.delete({ where: { id: existing.id } });
      return res.json({ saved: false });
    }
    if (await prisma.savedItem.count({ where: { userId: req.auth!.id } }) >= 500) throw ApiError.unprocessable('Your wishlist is full.');
    await prisma.savedItem.create({ data: { userId: req.auth!.id, ...input } });
    await recordActivity({ userId: req.auth!.id, action: 'SAVED', title: `Saved a ${input.itemType.toLowerCase()} to your wishlist`, link: '/account/saved', subjectType: input.itemType, subjectId: input.itemId });
    res.status(201).json({ saved: true });
  }),
);

communityRouter.get(
  '/saved/ids',
  requireAuth,
  route(async (req, res) => {
    const rows = await prisma.savedItem.findMany({ where: { userId: req.auth!.id }, select: { itemType: true, itemId: true } });
    res.json(rows.map((row) => `${row.itemType}:${row.itemId}`));
  }),
);

communityRouter.post(
  '/polls/:id/vote',
  requireAuth,
  socialLimiter,
  route(async (req, res) => {
    const { optionIndex } = z.object({ optionIndex: z.number().int().min(0).max(50) }).parse(req.body);
    const poll = await prisma.poll.findFirst({ where: { id: req.params.id, status: 'OPEN' } });
    if (!poll || (poll.closesAt && poll.closesAt.getTime() < Date.now())) throw ApiError.unprocessable('This poll is closed.');
    if (optionIndex >= parseList(poll.options).length) throw ApiError.badRequest('Choose one of the options.');
    await prisma.pollVote.upsert({
      where: { pollId_userId: { pollId: poll.id, userId: req.auth!.id } },
      create: { pollId: poll.id, userId: req.auth!.id, optionIndex },
      update: { optionIndex },
    });
    res.json({ ok: true });
  }),
);

communityRouter.post(
  '/stories',
  requireAuth,
  formLimiter,
  route(async (req, res) => {
    const input = z
      .object({
        title: z.string().trim().min(4, 'Give it a title.').max(160),
        body: z.string().trim().min(40, 'Tell us a little more (40 characters at least).').max(10000),
        coverImage: z.string().url().optional().or(z.literal('')),
        countryCode: z.string().length(2).optional().or(z.literal('')),
        cityName: z.string().trim().max(80).optional(),
      })
      .parse(req.body);
    const country = input.countryCode ? await prisma.country.findUnique({ where: { code: input.countryCode.toUpperCase() } }) : null;
    const city = country && input.cityName ? await prisma.city.findFirst({ where: { countryId: country.id, slug: slugify(input.cityName) } }) : null;
    const base = slugify(input.title) || 'story';
    const slug = `${base}-${shortCode(4).toLowerCase()}`;
    await prisma.story.create({
      data: {
        slug,
        title: input.title,
        body: input.body,
        excerpt: input.body.slice(0, 220),
        authorName: req.auth!.name,
        userId: req.auth!.id,
        coverImage: input.coverImage || null,
        countryId: country?.id ?? null,
        cityId: city?.id ?? null,
        source: 'COMMUNITY',
        status: 'PENDING_REVIEW',
      },
    });
    res.status(201).json({ ok: true, message: 'Thank you — your story will appear once the team has reviewed it.' });
  }),
);

communityRouter.post(
  '/places/:slug/reviews',
  requireAuth,
  formLimiter,
  route(async (req, res) => {
    const input = z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().min(20, 'A few more words, please.').max(3000) }).parse(req.body);
    const place = await prisma.place.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' } });
    if (!place) throw ApiError.notFound();
    await prisma.placeReview.upsert({
      where: { placeId_userId: { placeId: place.id, userId: req.auth!.id } },
      create: { placeId: place.id, userId: req.auth!.id, ...input },
      update: { ...input, status: 'PENDING' },
    });
    res.status(201).json({ ok: true, message: 'Thank you — reviews appear once they have been checked.' });
  }),
);

/* ---------------------------------- Invites -------------------------------- */

const inviteSchema = z.object({
  subjectType: z.enum(['ACTIVITY', 'EVENT', 'COMMUNITY', 'TRIP', 'TOURNAMENT']),
  subjectId: z.string().min(5).max(60),
  usernames: z.array(z.string().trim().toLowerCase().max(21)).min(1).max(20),
});

/**
 * Invites existing members by username. An invitation is only a notification
 * with a link: it does not register anyone or hold a place. Blocked members
 * and people who switched invitations off are skipped silently.
 */
communityRouter.post(
  '/invites',
  requireAuth,
  socialLimiter,
  route(async (req, res) => {
    const input = inviteSchema.parse(req.body);
    const target = await inviteTarget(input.subjectType, input.subjectId);
    if (!target) throw ApiError.notFound('That listing is not available.');
    const usernames = [...new Set(input.usernames.map((u) => u.replace(/^@/, '')))];
    const users = await prisma.user.findMany({ where: { username: { in: usernames }, status: 'ACTIVE' }, select: { id: true, username: true } });
    const blocks = await prisma.block.findMany({ where: { OR: [{ blockerId: req.auth!.id }, { blockedId: req.auth!.id }] }, select: { blockerId: true, blockedId: true } });
    const avoid = new Set(blocks.flatMap((b) => [b.blockerId, b.blockedId]));
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.id }, select: { username: true, name: true } });
    const from = me.username ? `@${me.username}` : me.name.split(' ')[0];
    const recipients = users.filter((u) => u.id !== req.auth!.id && !avoid.has(u.id));
    for (const user of recipients) {
      await notify({ userId: user.id, type: 'INVITATION', title: `${from} invited you`, body: `${target.title} — open it to see the details and register if you would like to go.`, link: target.href });
    }
    const found = new Set(users.map((u) => u.username));
    res.json({ sent: recipients.length, notFound: usernames.filter((u) => !found.has(u)) });
  }),
);

async function inviteTarget(type: string, id: string): Promise<{ title: string; href: string } | null> {
  if (type === 'ACTIVITY') {
    const row = await prisma.activity.findFirst({ where: { id, status: { in: ['PUBLISHED', 'FULL'] } }, select: { title: true, slug: true } });
    return row && { title: row.title, href: `/activities/${row.slug}` };
  }
  if (type === 'EVENT') {
    const row = await prisma.event.findFirst({ where: { id, status: 'PUBLISHED' }, select: { title: true, slug: true } });
    return row && { title: row.title, href: `/events/${row.slug}` };
  }
  if (type === 'COMMUNITY') {
    const row = await prisma.community.findFirst({ where: { id, status: 'PUBLISHED' }, select: { name: true, slug: true } });
    return row && { title: row.name, href: `/experiences/communities/${row.slug}` };
  }
  if (type === 'TRIP') {
    const row = await prisma.trip.findFirst({ where: { id, status: 'PUBLISHED' }, select: { title: true, slug: true } });
    return row && { title: row.title, href: `/travel/${row.slug}` };
  }
  const row = await prisma.tournament.findFirst({ where: { id, status: { not: 'DRAFT' } }, select: { title: true, slug: true } });
  return row && { title: row.title, href: `/experiences/gaming/${row.slug}` };
}

/** Username lookup for the invite picker: handle and first name only. */
communityRouter.get(
  '/usernames',
  requireAuth,
  route(async (req, res) => {
    const q = String(req.query.q ?? '').trim().replace(/^@/, '').toLowerCase();
    if (q.length < 2) return res.json({ items: [] });
    const hidden = await blockedIds(req.auth!.id);
    const rows = await prisma.user.findMany({
      where: { username: { startsWith: q }, status: 'ACTIVE', isDemo: false, id: { notIn: [req.auth!.id, ...hidden] } },
      select: { username: true, name: true, avatarUrl: true },
      take: 8,
      orderBy: { username: 'asc' },
    });
    res.json({ items: rows.map((row) => ({ username: row.username, firstName: row.name.split(' ')[0], avatarUrl: row.avatarUrl })) });
  }),
);

/** Public profile card by username — only fields the member made Public. */
export const profilePublic = Router();

/** Username availability for the sign-up form (rate-limited like other forms). */
profilePublic.get(
  '/username-available',
  socialLimiter,
  route(async (req, res) => {
    const username = String(req.query.u ?? '').trim().toLowerCase();
    const problem = await usernameProblem(username);
    res.json({ username, available: !problem, reason: problem });
  }),
);
profilePublic.get(
  '/u/:username',
  route(async (req, res) => {
    const user = await prisma.user.findFirst({
      where: { username: req.params.username.toLowerCase(), status: 'ACTIVE', isDemo: false, profileVisibility: { not: 'HIDDEN' } },
      select: MEMBER_FIELDS,
    });
    if (!user) throw ApiError.notFound('That profile is not available.');
    const card = memberCard(user, 'PUBLIC');
    res.json({ ...card, id: undefined });
  }),
);


/** A customer cancels their own reservation request (before or after confirmation). */
communityRouter.post(
  '/enquiries/:reference/cancel',
  requireAuth,
  route(async (req, res) => {
    const enquiry = await prisma.enquiry.findFirst({ where: { reference: req.params.reference, userId: req.auth!.id } });
    if (!enquiry) throw ApiError.notFound('Request not found.');
    if (['CANCELLED', 'DECLINED', 'UNSUCCESSFUL', 'CLOSED', 'SPAM'].includes(enquiry.status)) throw ApiError.unprocessable('This request is already closed.');
    await prisma.enquiry.update({ where: { id: enquiry.id }, data: { status: 'CANCELLED' } });
    await notifyStaff('enquiries.view', { type: 'ENQUIRY_UPDATE', title: `Cancelled by the customer · ${enquiry.reference}`, body: enquiry.subjectTitle ?? enquiry.type, link: `/admin/enquiries?ref=${enquiry.reference}` });
    res.json({ status: 'CANCELLED' });
  }),
);
