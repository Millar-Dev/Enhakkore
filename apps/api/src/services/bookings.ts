import type { PaymentMethod } from '@enhakkore/shared';
import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/http';
import { bookingReference } from '../lib/ids';
import { paymentGateway } from './payments';
import { notify } from './notifications';

export interface CreateBookingInput {
  userId: string;
  tripDateId: string;
  travellers: number;
  impactAmount: number;
  impactProjectId?: string | null;
  travellerDetails: { fullName: string; email?: string; phone?: string; notes?: string }[];
  notes?: string;
  paymentMethod: PaymentMethod;
  paymentInstrument?: string;
}

/**
 * Creates a booking and attempts payment.
 *
 * Seat allocation and booking creation happen inside one transaction with a
 * conditional seat update, so two people checking out for the last seat cannot
 * both succeed — the loser gets a clean "trip is full" error rather than an
 * oversold departure.
 */
export async function createBooking(input: CreateBookingInput) {
  const departure = await prisma.tripDate.findUnique({
    where: { id: input.tripDateId },
    include: {
      trip: { include: { organizer: true, impactProject: true } },
      conversation: true,
    },
  });

  if (!departure) throw ApiError.notFound('That departure no longer exists.');
  if (departure.trip.status !== 'PUBLISHED') {
    throw ApiError.unprocessable('This trip is not open for booking right now.', 'trip_unavailable');
  }
  if (departure.status === 'CLOSED' || departure.status === 'DEPARTED') {
    throw ApiError.unprocessable('Booking for this departure has closed.', 'departure_closed');
  }
  if (new Date(departure.startDate).getTime() < Date.now()) {
    throw ApiError.unprocessable('That departure date has already passed.', 'departure_past');
  }

  const seatsLeft = departure.capacity - departure.seatsBooked;
  if (input.travellers > seatsLeft) {
    throw ApiError.conflict(
      seatsLeft === 0
        ? 'This trip is fully booked.'
        : `Only ${seatsLeft} ${seatsLeft === 1 ? 'seat is' : 'seats are'} left on this departure.`,
      'not_enough_seats',
    );
  }

  const unitPrice = departure.price ?? departure.trip.basePrice;
  const tripAmount = unitPrice * input.travellers;
  const impactAmount = Math.max(0, Math.round(input.impactAmount));
  const totalAmount = tripAmount + impactAmount;

  // Commission is charged on travel value only. Impact contributions pass
  // through untouched — the platform does not take a cut of a donation.
  const rate = departure.trip.organizer.commissionRate;
  const platformFee = Math.round(tripAmount * rate);

  const impactProjectId = impactAmount > 0 ? input.impactProjectId ?? departure.trip.impactProjectId ?? null : null;
  if (impactAmount > 0 && !impactProjectId) {
    throw ApiError.badRequest('Choose a project for your impact contribution.');
  }

  const booking = await prisma.$transaction(async (tx) => {
    // Conditional update: only succeeds while enough seats remain.
    const claimed = await tx.tripDate.updateMany({
      where: { id: departure.id, seatsBooked: { lte: departure.capacity - input.travellers } },
      data: { seatsBooked: { increment: input.travellers } },
    });
    if (claimed.count === 0) {
      throw ApiError.conflict('Those seats were just taken. Please try again.', 'not_enough_seats');
    }

    const created = await tx.booking.create({
      data: {
        reference: bookingReference(),
        tripId: departure.tripId,
        tripDateId: departure.id,
        userId: input.userId,
        travellers: input.travellers,
        status: 'PENDING_PAYMENT',
        tripAmount,
        impactAmount,
        totalAmount,
        platformFee,
        currency: departure.trip.currency,
        impactProjectId,
        notes: input.notes ?? null,
        travellerList: {
          create: input.travellerDetails.map((t) => ({
            fullName: t.fullName,
            email: t.email ?? null,
            phone: t.phone ?? null,
            notes: t.notes ?? null,
          })),
        },
        commission: {
          create: {
            amount: platformFee,
            rate,
            currency: departure.trip.currency,
            status: 'PENDING',
          },
        },
      },
    });

    // Refresh the departure badge now that seats moved.
    const refreshed = await tx.tripDate.findUniqueOrThrow({ where: { id: departure.id } });
    await tx.tripDate.update({
      where: { id: departure.id },
      data: { status: refreshed.seatsBooked >= refreshed.capacity ? 'FULL' : 'OPEN' },
    });

    return created;
  });

  const gateway = paymentGateway();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });

  const result = await gateway.charge({
    bookingId: booking.id,
    reference: booking.reference,
    amount: totalAmount,
    currency: booking.currency,
    method: input.paymentMethod,
    instrument: input.paymentInstrument,
    customer: { id: user.id, name: user.name, email: user.email },
  });

  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      method: input.paymentMethod,
      provider: gateway.name,
      providerRef: result.providerRef,
      amount: totalAmount,
      currency: booking.currency,
      status: result.status,
      simulated: result.simulated,
      failureCode: result.failureCode ?? null,
      rawResponse: JSON.stringify(result.raw),
      settledAt: result.status === 'SUCCEEDED' ? new Date() : null,
    },
  });

  if (result.status === 'SUCCEEDED') {
    await confirmBooking(booking.id, impactProjectId, impactAmount);
  } else if (result.status === 'FAILED') {
    // Release the seats immediately; a failed payment must not hold inventory.
    await releaseBooking(booking.id, 'Payment failed');
  }

  await notify({
    userId: user.id,
    type: result.status === 'SUCCEEDED' ? 'BOOKING_CONFIRMED' : 'PAYMENT_FAILED',
    title:
      result.status === 'SUCCEEDED'
        ? `You're going to ${departure.trip.title}`
        : `Payment issue on ${booking.reference}`,
    body:
      result.status === 'SUCCEEDED'
        ? `Booking ${booking.reference} is confirmed. Your trip group is open.`
        : result.message,
    link: `/account/bookings/${booking.reference}`,
  });

  return { bookingId: booking.id, reference: booking.reference, payment: result };
}

/**
 * Marks a booking confirmed: records the impact contribution, banks the
 * commission, and adds the traveller to the departure's private group.
 */
export async function confirmBooking(bookingId: string, impactProjectId: string | null, impactAmount: number) {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { trip: { include: { organizer: true } }, departure: { include: { conversation: true } } },
  });

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED' } });
    await tx.platformCommission.updateMany({ where: { bookingId }, data: { status: 'EARNED' } });

    if (impactProjectId && impactAmount > 0) {
      const donor = await tx.user.findUniqueOrThrow({ where: { id: booking.userId } });
      await tx.donation.create({
        data: {
          projectId: impactProjectId,
          userId: booking.userId,
          bookingId,
          amount: impactAmount,
          currency: booking.currency,
          status: 'SUCCEEDED',
          donorName: donor.name,
        },
      });
      await tx.impactProject.update({
        where: { id: impactProjectId },
        data: { raised: { increment: impactAmount }, contributorCount: { increment: 1 } },
      });
    }

    // One conversation per departure, created lazily on the first confirmed
    // booking so empty groups never exist.
    const conversation =
      booking.departure.conversation ??
      (await tx.conversation.create({
        data: {
          tripDateId: booking.tripDateId,
          title: booking.trip.title,
          members: {
            create: {
              userId: booking.trip.organizer.userId,
              role: 'ORGANIZER',
            },
          },
          messages: {
            create: {
              userId: booking.trip.organizer.userId,
              kind: 'SYSTEM',
              body: `Welcome to the ${booking.trip.title} group. Introduce yourself — you'll be travelling together soon.`,
            },
          },
        },
      }));

    await tx.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: conversation.id, userId: booking.userId } },
      create: { conversationId: conversation.id, userId: booking.userId, role: 'TRAVELER' },
      update: {},
    });
  });
}

/** Cancels a booking and returns its seats to the departure. */
export async function releaseBooking(bookingId: string, reason: string, status: 'CANCELLED' | 'REFUNDED' = 'CANCELLED') {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { departure: { include: { conversation: true } } },
  });

  if (booking.status === 'CANCELLED' || booking.status === 'REFUNDED') return booking;

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: { status, cancelledAt: new Date(), cancelReason: reason },
    });

    await tx.tripDate.update({
      where: { id: booking.tripDateId },
      data: {
        seatsBooked: { decrement: Math.min(booking.travellers, booking.departure.seatsBooked) },
        status: 'OPEN',
      },
    });

    await tx.platformCommission.updateMany({ where: { bookingId }, data: { status: 'REVERSED' } });

    // Access to the private group ends with the booking.
    if (booking.departure.conversation) {
      await tx.conversationMember.deleteMany({
        where: { conversationId: booking.departure.conversation.id, userId: booking.userId },
      });
    }
  });

  return booking;
}
