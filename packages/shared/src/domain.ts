/**
 * Domain vocabulary shared by the API and the web app.
 *
 * These are string unions rather than Prisma enums because the development
 * database is SQLite (which Prisma does not support enums on). Moving to
 * PostgreSQL later is a schema change only — the values below stay identical.
 */

export const ROLES = ['TRAVELER', 'ORGANIZER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'PENDING'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Lifecycle of a trip listing. Every transition is an admin- or organizer-driven event. */
export const TRIP_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
  'ARCHIVED',
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_TYPES = [
  'GROUP',
  'PRIVATE',
  'SAFARI',
  'BEACH',
  'ADVENTURE',
  'CULTURAL',
  'INTERNATIONAL',
] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export const TRAVEL_STYLES = ['BUDGET', 'COMFORT', 'LUXURY'] as const;
export type TravelStyle = (typeof TRAVEL_STYLES)[number];

export const BOOKING_STATUSES = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'CANCELLED',
  'REFUNDED',
  'COMPLETED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = ['INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * Payment rails the checkout is architected for. `MOCK` is the only one wired up
 * in this build — see apps/api/src/services/payments. Nothing here implies a
 * live merchant integration exists.
 */
export const PAYMENT_METHODS = ['MOCK', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const MOBILE_MONEY_PROVIDERS = ['M_PESA', 'AIRTEL_MONEY', 'TIGO_PESA', 'HALOPESA'] as const;
export type MobileMoneyProvider = (typeof MOBILE_MONEY_PROVIDERS)[number];

export const VERIFICATION_STATUSES = [
  'UNSUBMITTED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'SUSPENDED',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const IMPACT_CATEGORIES = [
  'EDUCATION',
  'HEALTHCARE',
  'CLEAN_WATER',
  'COMMUNITY',
  'CONSERVATION',
] as const;
export type ImpactCategory = (typeof IMPACT_CATEGORIES)[number];

export const PROJECT_STATUSES = ['DRAFT', 'ACTIVE', 'FUNDED', 'COMPLETED', 'PAUSED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const MESSAGE_KINDS = ['TEXT', 'ANNOUNCEMENT', 'SYSTEM', 'IMAGE'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const NOTIFICATION_TYPES = [
  'BOOKING_CONFIRMED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_FAILED',
  'TRIP_REMINDER',
  'TRIP_UPDATE',
  'ANNOUNCEMENT',
  'CHAT_MESSAGE',
  'IMPACT_UPDATE',
  'ORGANIZER_STATUS',
  'TRIP_STATUS',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const REQUEST_STATUSES = ['NEW', 'MATCHING', 'QUOTED', 'CONVERTED', 'CLOSED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const DEPARTURE_STATUSES = ['OPEN', 'ALMOST_FULL', 'FULL', 'CLOSED', 'DEPARTED'] as const;
export type DepartureStatus = (typeof DEPARTURE_STATUSES)[number];

/* ------------------------------------------------------------------------- */
/* Display labels                                                             */
/* ------------------------------------------------------------------------- */

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  GROUP: 'Group',
  PRIVATE: 'Private',
  SAFARI: 'Safari',
  BEACH: 'Beach & Island',
  ADVENTURE: 'Adventure',
  CULTURAL: 'Cultural',
  INTERNATIONAL: 'International',
};

export const TRAVEL_STYLE_LABELS: Record<TravelStyle, string> = {
  BUDGET: 'Budget',
  COMFORT: 'Comfort',
  LUXURY: 'Luxury',
};

export const IMPACT_CATEGORY_LABELS: Record<ImpactCategory, string> = {
  EDUCATION: 'Education',
  HEALTHCARE: 'Healthcare',
  CLEAN_WATER: 'Clean Water',
  COMMUNITY: 'Community Development',
  CONSERVATION: 'Conservation',
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  COMPLETED: 'Completed',
};

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending review',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  REJECTED: 'Rejected',
  ARCHIVED: 'Archived',
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  UNSUBMITTED: 'Not submitted',
  PENDING: 'Under review',
  VERIFIED: 'Verified organizer',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};

/* ------------------------------------------------------------------------- */
/* Platform economics                                                         */
/* ------------------------------------------------------------------------- */

/**
 * Default share of a booking retained by the platform. Stored per organizer so
 * negotiated rates are possible; this is only the fallback for new accounts.
 */
export const DEFAULT_COMMISSION_RATE = 0.1;

/** Suggested impact contribution tiers, in TZS major units. */
export const IMPACT_TIERS_TZS = [5_000, 10_000, 20_000];

/** A departure is flagged "almost full" once this share of seats is taken. */
export const ALMOST_FULL_THRESHOLD = 0.8;

export function departureStatus(seatsBooked: number, capacity: number): DepartureStatus {
  if (capacity <= 0) return 'CLOSED';
  if (seatsBooked >= capacity) return 'FULL';
  if (seatsBooked / capacity >= ALMOST_FULL_THRESHOLD) return 'ALMOST_FULL';
  return 'OPEN';
}

/** Seats left on a departure, never negative. */
export function seatsRemaining(seatsBooked: number, capacity: number): number {
  return Math.max(0, capacity - seatsBooked);
}
