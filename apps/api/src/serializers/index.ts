import type {
  AllocationLine,
  BookingDto,
  ConversationMemberDto,
  DestinationSummary,
  ImpactProjectDetail,
  ImpactProjectSummary,
  ImpactUpdateDto,
  ItineraryDayDto,
  MessageDto,
  NotificationDto,
  OrganizerDetail,
  OrganizerSummary,
  PaymentDto,
  PublicUser,
  ReviewDto,
  TravellerBadge,
  TripDateDto,
  TripDetail,
  TripSummary,
  CustomTripRequestDto,
  DonationDto,
} from '@enhakkore/shared';
import { departureStatus, money, progressPercent, seatsRemaining } from '@enhakkore/shared';
import { parseList, parseObjects } from '../lib/json';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Prisma's generated types vary with the include shape used at each call site,
// so serializers take structurally-typed input and return the strict DTOs the
// web app consumes. The DTOs are the contract; these functions are the mapping.

export function toPublicUser(user: any): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl ?? null,
    country: user.country ?? null,
    city: user.city ?? null,
    bio: user.bio ?? null,
    createdAt: iso(user.createdAt),
    organizerId: user.organizer?.id ?? user.organizerId ?? null,
  };
}

/** The minimal public shape of a fellow traveller. Never includes email or phone. */
export function toTravellerBadge(user: any): TravellerBadge {
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    country: user.country ?? null,
  };
}

export function toOrganizerSummary(organizer: any): OrganizerSummary {
  return {
    id: organizer.id,
    companyName: organizer.companyName,
    slug: organizer.slug,
    logoUrl: organizer.logoUrl ?? null,
    country: organizer.country ?? null,
    city: organizer.city ?? null,
    verificationStatus: organizer.verificationStatus,
    rating: organizer.rating ?? null,
    reviewCount: organizer.reviewCount ?? 0,
    tripCount: organizer._count?.trips ?? organizer.tripCount ?? 0,
    yearFounded: organizer.yearFounded ?? null,
    isDemo: Boolean(organizer.isDemo),
  };
}

export function toOrganizerDetail(organizer: any): OrganizerDetail {
  return {
    ...toOrganizerSummary(organizer),
    tagline: organizer.tagline ?? null,
    bio: organizer.bio ?? null,
    coverUrl: organizer.coverUrl ?? null,
    websiteUrl: organizer.websiteUrl ?? null,
    languages: parseList(organizer.languages),
    responseTimeHours: organizer.responseTimeHours ?? null,
    memberSince: iso(organizer.createdAt),
  };
}

export function toDestination(destination: any): DestinationSummary {
  return {
    id: destination.id,
    name: destination.name,
    slug: destination.slug,
    country: destination.country,
    region: destination.region ?? null,
    continent: destination.continent,
    summary: destination.summary ?? null,
    heroImage: destination.heroImage ?? null,
    ...(destination._count ? { tripCount: destination._count.trips } : {}),
  };
}

export function toItineraryDay(day: any): ItineraryDayDto {
  return {
    id: day.id,
    dayNumber: day.dayNumber,
    title: day.title,
    summary: day.summary ?? null,
    activities: parseList(day.activities),
    accommodation: day.accommodation ?? null,
    meals: parseList(day.meals),
  };
}

export function toTripDate(date: any, currency: string, fallbackPrice: number): TripDateDto {
  const capacity = date.capacity ?? 0;
  const booked = date.seatsBooked ?? 0;
  return {
    id: date.id,
    startDate: iso(date.startDate),
    endDate: iso(date.endDate),
    capacity,
    seatsBooked: booked,
    seatsRemaining: seatsRemaining(booked, capacity),
    // Recomputed rather than trusted from the column so the badge can never
    // drift from the underlying seat count.
    status: date.status === 'CLOSED' || date.status === 'DEPARTED' ? date.status : departureStatus(booked, capacity),
    price: money(date.price ?? fallbackPrice, currency),
  };
}

export function toTripSummary(trip: any): TripSummary {
  const departures: any[] = trip.departures ?? [];
  const upcoming = departures
    .filter((d) => new Date(d.startDate).getTime() >= Date.now() - DAY_MS)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return {
    id: trip.id,
    slug: trip.slug,
    title: trip.title,
    summary: trip.summary,
    type: trip.type,
    style: trip.style,
    status: trip.status,
    durationDays: trip.durationDays,
    durationNights: trip.durationNights,
    fromPrice: money(lowestPrice(trip, departures), trip.currency),
    heroImage: trip.heroImage,
    rating: trip.rating ?? null,
    reviewCount: trip.reviewCount ?? 0,
    tags: parseList(trip.tags),
    destination: toDestination(trip.destination),
    organizer: toOrganizerSummary(trip.organizer),
    nextDeparture: upcoming[0] ? toTripDate(upcoming[0], trip.currency, trip.basePrice) : null,
    totalSeats: departures.reduce((sum, d) => sum + (d.capacity ?? 0), 0),
    totalBooked: departures.reduce((sum, d) => sum + (d.seatsBooked ?? 0), 0),
    impactProjectId: trip.impactProjectId ?? null,
  };
}

export function toTripDetail(trip: any, travellers: any[] = []): TripDetail {
  const departures: any[] = trip.departures ?? [];
  return {
    ...toTripSummary(trip),
    description: trip.description,
    gallery: parseList(trip.gallery),
    includes: parseList(trip.includes),
    excludes: parseList(trip.excludes),
    requirements: parseList(trip.requirements),
    difficulty: trip.difficulty ?? null,
    minAge: trip.minAge ?? null,
    itinerary: (trip.itinerary ?? []).map(toItineraryDay),
    departures: departures.map((d) => toTripDate(d, trip.currency, trip.basePrice)),
    organizerDetail: toOrganizerDetail(trip.organizer),
    travellers: travellers.map(toTravellerBadge),
    reviews: (trip.reviews ?? []).map(toReview),
    impactProject: trip.impactProject ? toImpactProjectSummary(trip.impactProject) : null,
  };
}

export function toReview(review: any): ReviewDto {
  return {
    id: review.id,
    rating: review.rating,
    title: review.title ?? null,
    body: review.body,
    photos: parseList(review.photos),
    createdAt: iso(review.createdAt),
    author: toTravellerBadge(review.user),
    ...(review.trip ? { tripTitle: review.trip.title } : {}),
  };
}

export function toPayment(payment: any): PaymentDto {
  return {
    id: payment.id,
    method: payment.method,
    provider: payment.provider,
    providerRef: payment.providerRef ?? null,
    status: payment.status,
    amount: money(payment.amount, payment.currency),
    createdAt: iso(payment.createdAt),
    simulated: Boolean(payment.simulated),
  };
}

export function toBooking(booking: any): BookingDto {
  const payments: any[] = booking.payments ?? [];
  const latestPayment = payments[0] ?? null;

  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    travellers: booking.travellers,
    tripAmount: money(booking.tripAmount, booking.currency),
    impactAmount: money(booking.impactAmount, booking.currency),
    totalAmount: money(booking.totalAmount, booking.currency),
    platformFee: money(booking.platformFee, booking.currency),
    createdAt: iso(booking.createdAt),
    trip: toTripSummary(booking.trip),
    departure: toTripDate(booking.departure, booking.currency, booking.trip?.basePrice ?? 0),
    travellerDetails: (booking.travellerList ?? []).map((t: any) => ({
      id: t.id,
      fullName: t.fullName,
      email: t.email ?? null,
      phone: t.phone ?? null,
    })),
    impactProject: booking.impactProject ? toImpactProjectSummary(booking.impactProject) : null,
    payment: latestPayment ? toPayment(latestPayment) : null,
    conversationId: booking.departure?.conversation?.id ?? null,
    reviewed: Boolean(booking.review),
  };
}

export function toImpactProjectSummary(project: any): ImpactProjectSummary {
  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    category: project.category,
    status: project.status,
    location: project.location,
    country: project.country,
    summary: project.summary,
    heroImage: project.heroImage,
    goal: money(project.goal, project.currency),
    raised: money(project.raised, project.currency),
    progress: progressPercent(project.raised, project.goal),
    contributorCount: project.contributorCount ?? 0,
    isDemo: Boolean(project.isDemo),
  };
}

export function toImpactUpdate(update: any): ImpactUpdateDto {
  return {
    id: update.id,
    title: update.title,
    body: update.body,
    images: parseList(update.images),
    milestone: Boolean(update.milestone),
    publishedAt: iso(update.publishedAt),
  };
}

export function toImpactProjectDetail(project: any): ImpactProjectDetail {
  return {
    ...toImpactProjectSummary(project),
    description: project.description,
    gallery: parseList(project.gallery),
    allocation: parseObjects<AllocationLine>(project.allocation),
    updates: (project.updates ?? []).map(toImpactUpdate),
    partnerName: project.partnerName ?? null,
    partnerNote: project.partnerNote ?? null,
    startedAt: project.startedAt ? iso(project.startedAt) : null,
    completedAt: project.completedAt ? iso(project.completedAt) : null,
    linkedTrips: (project.trips ?? []).map(toTripSummary),
    recentContributions: (project.donations ?? []).map((donation: any) => ({
      id: donation.id,
      amount: money(donation.amount, donation.currency),
      createdAt: iso(donation.createdAt),
      // Anonymity is honoured at the serializer boundary so no route can leak it.
      donorName: donation.anonymous ? null : donation.donorName ?? donation.user?.name ?? null,
      message: donation.message ?? null,
    })),
  };
}

export function toDonation(donation: any): DonationDto {
  return {
    id: donation.id,
    amount: money(donation.amount, donation.currency),
    status: donation.status,
    createdAt: iso(donation.createdAt),
    anonymous: Boolean(donation.anonymous),
    message: donation.message ?? null,
    project: toImpactProjectSummary(donation.project),
    bookingReference: donation.booking?.reference ?? null,
  };
}

export function toMessage(message: any, organizerUserId?: string | null): MessageDto {
  return {
    id: message.id,
    body: message.body,
    kind: message.kind,
    attachments: parseList(message.attachments),
    pinned: Boolean(message.pinned),
    createdAt: iso(message.createdAt),
    author: {
      id: message.author.id,
      name: message.author.name,
      avatarUrl: message.author.avatarUrl ?? null,
      role: message.author.role,
      isOrganizer: Boolean(organizerUserId && message.author.id === organizerUserId),
    },
  };
}

export function toConversationMember(member: any): ConversationMemberDto {
  return {
    ...toTravellerBadge(member.user),
    role: member.role,
    joinedAt: iso(member.joinedAt),
  };
}

export function toNotification(notification: any): NotificationDto {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link ?? null,
    read: Boolean(notification.read),
    createdAt: iso(notification.createdAt),
  };
}

export function toCustomTripRequest(request: any): CustomTripRequestDto {
  return {
    id: request.id,
    destination: request.destination,
    startDate: request.startDate ? iso(request.startDate) : null,
    endDate: request.endDate ? iso(request.endDate) : null,
    travellers: request.travellers,
    budget: request.budget != null ? money(request.budget, request.currency) : null,
    style: request.style,
    accommodation: request.accommodation ?? null,
    activities: parseList(request.activities),
    notes: request.notes ?? null,
    status: request.status,
    createdAt: iso(request.createdAt),
    contactName: request.contactName,
    contactEmail: request.contactEmail,
  };
}

/* -------------------------------------------------------------------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

function lowestPrice(trip: any, departures: any[]): number {
  const prices = departures.map((d) => d.price ?? trip.basePrice).filter((p): p is number => typeof p === 'number');
  return prices.length ? Math.min(...prices) : trip.basePrice;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
