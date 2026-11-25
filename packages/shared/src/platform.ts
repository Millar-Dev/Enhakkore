/**
 * Platform vocabulary for the Enhakkore divisions, the admin control centre
 * and the finance ledger.
 *
 * Like `domain.ts`, these are string unions rather than database enums: the
 * development database is SQLite, and every value below is stored as text.
 */

/* ------------------------------------------------------------------------- */
/* Content lifecycle                                                          */
/* ------------------------------------------------------------------------- */

/** The lifecycle every editable listing shares. */
export const CONTENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/**
 * Activities have a longer life, because the public can submit them.
 * PUBLISHED, FULL, COMPLETED and CANCELLED are visible on the site — the last
 * two clearly marked — everything else is not.
 */
export const ACTIVITY_STATUSES = [
  'PENDING_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'FULL',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'DRAFT',
  'ARCHIVED',
] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];
export const ACTIVITY_PUBLIC_STATUSES: ActivityStatus[] = ['PUBLISHED', 'FULL', 'COMPLETED', 'CANCELLED'];

export const EVENT_STATUSES = ['DRAFT', 'PUBLISHED', 'SOLD_OUT', 'COMPLETED', 'CANCELLED', 'ARCHIVED'] as const;
export const EVENT_PUBLIC_STATUSES = ['PUBLISHED', 'SOLD_OUT', 'COMPLETED', 'CANCELLED'];

export const STORY_STATUSES = ['PENDING_REVIEW', 'DRAFT', 'PUBLISHED', 'REJECTED', 'ARCHIVED'] as const;
export const POLL_STATUSES = ['DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED'] as const;

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
  PENDING_REVIEW: 'Pending review',
  APPROVED: 'Approved',
  FULL: 'Full',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
  SOLD_OUT: 'Sold out',
  OPEN: 'Open',
  CLOSED: 'Closed',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  FUNDED: 'Funded',
};

/* ------------------------------------------------------------------------- */
/* Categories                                                                 */
/* ------------------------------------------------------------------------- */

/** Which part of the site a category belongs to. */
export const CATEGORY_KINDS = ['ACTIVITY', 'PLACE', 'EXPERIENCE', 'EVENT', 'INTEREST'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  ACTIVITY: 'Community activities',
  PLACE: 'Discover — places & businesses',
  EXPERIENCE: 'Experiences',
  EVENT: 'Events',
  INTEREST: 'Member interests',
};

export const ACTIVITY_MODES = ['IN_PERSON', 'ONLINE'] as const;
export const ACTIVITY_MODE_LABELS: Record<string, string> = { IN_PERSON: 'In person', ONLINE: 'Online' };

export const EXPERIENCE_LEVELS = ['ALL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export const EXPERIENCE_LEVEL_LABELS: Record<string, string> = {
  ALL: 'All levels',
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

/**
 * How much the platform stands behind a place's details. Shown on every
 * listing, so a visitor always knows who said what.
 */
export const INFO_SOURCES = ['VERIFIED', 'BUSINESS_SUBMITTED', 'UNVERIFIED'] as const;
export const INFO_SOURCE_LABELS: Record<string, string> = {
  VERIFIED: 'Verified by Enhakkore',
  BUSINESS_SUBMITTED: 'Submitted by the business',
  UNVERIFIED: 'Not yet verified',
};

export const EVENT_HOSTS = ['ENHAKKORE', 'THIRD_PARTY'] as const;
export const EVENT_HOST_LABELS: Record<string, string> = {
  ENHAKKORE: 'Hosted by Enhakkore',
  THIRD_PARTY: 'Third-party event',
};

export const REGISTRATION_MODES = ['ENHAKKORE', 'EXTERNAL', 'INFO_ONLY'] as const;
export const REGISTRATION_MODE_LABELS: Record<string, string> = {
  ENHAKKORE: 'Register on Enhakkore',
  EXTERNAL: 'Tickets sold by the organiser (external link)',
  INFO_ONLY: 'Information only — no registration',
};

export const CATERING_KINDS = ['LUNCHBOX', 'GROUP', 'PRIVATE_CHEF'] as const;
export const CATERING_KIND_LABELS: Record<string, string> = {
  LUNCHBOX: 'Travel lunchbox',
  GROUP: 'Group catering',
  PRIVATE_CHEF: 'Private chef',
};
export const PRICE_UNITS = ['PER_PERSON', 'PER_GROUP', 'ON_REQUEST'] as const;
export const PRICE_UNIT_LABELS: Record<string, string> = {
  PER_PERSON: 'per person',
  PER_GROUP: 'per group',
  ON_REQUEST: 'price on request',
};

/* ------------------------------------------------------------------------- */
/* Enquiries, applications, registrations                                     */
/* ------------------------------------------------------------------------- */

export const ENQUIRY_TYPES = [
  'GENERAL',
  'TRIP',
  'PRIVATE_TRIP',
  'PLACE',
  'TABLE',
  'ROOM',
  'EXPERIENCE',
  'EVENT',
  'ACTIVITY',
  'CATERING',
  'PRIVATE_CHEF',
  'DONATION',
  'PARTNERSHIP',
] as const;
export type EnquiryType = (typeof ENQUIRY_TYPES)[number];
export const ENQUIRY_TYPE_LABELS: Record<string, string> = {
  GENERAL: 'General',
  TRIP: 'Trip',
  PRIVATE_TRIP: 'Private trip',
  PLACE: 'Place',
  TABLE: 'Table enquiry',
  ROOM: 'Room enquiry',
  EXPERIENCE: 'Experience',
  EVENT: 'Event',
  ACTIVITY: 'Activity',
  CATERING: 'Catering',
  PRIVATE_CHEF: 'Private chef',
  DONATION: 'Donation confirmation',
  PARTNERSHIP: 'Partnership / listing',
};
export const ENQUIRY_STATUSES = ['NEW', 'CONTACTED', 'IN_PROGRESS', 'CONVERTED', 'CLOSED', 'SPAM'] as const;

export const PARTICIPANT_STATUSES = ['REQUESTED', 'APPROVED', 'WAITLIST', 'DECLINED', 'CANCELLED'] as const;

/** A trip booking made by application, reviewed by a person, not charged by a gateway. */
export const APPLICATION_STATUSES = ['APPLIED', 'PENDING_PAYMENT', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'REFUNDED', 'COMPLETED'] as const;
export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  APPLIED: 'Application received',
  PENDING_PAYMENT: 'Approved — awaiting payment',
  CONFIRMED: 'Confirmed',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  COMPLETED: 'Completed',
};

export const REGISTRATION_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'REFUNDED'] as const;

/* ------------------------------------------------------------------------- */
/* Finance                                                                    */
/* ------------------------------------------------------------------------- */

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE', 'REFUND'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** Where income comes from. Donations are deliberately not on this list. */
export const DIVISIONS = [
  'TRAVEL',
  'EVENTS',
  'EXPERIENCES',
  'CATERING',
  'ADVERTISING',
  'FEATURED_LISTINGS',
  'PROMOTIONS',
  'SUBSCRIPTIONS',
  'REFERRALS',
  'OPERATIONS',
  'OTHER',
] as const;
export const DIVISION_LABELS: Record<string, string> = {
  TRAVEL: 'Enhakkore Travel',
  EVENTS: 'Events',
  EXPERIENCES: 'Experiences',
  CATERING: 'Catering & lunchboxes',
  ADVERTISING: 'Business advertising',
  FEATURED_LISTINGS: 'Featured listings',
  PROMOTIONS: 'Promotional campaigns',
  SUBSCRIPTIONS: 'Organiser subscriptions',
  REFERRALS: 'Referral commissions',
  OPERATIONS: 'General operations',
  OTHER: 'Other',
};

export const INCOME_CATEGORIES = [
  'TRIP_BOOKING',
  'TICKET_SALES',
  'EXPERIENCE_SALES',
  'CATERING_SALES',
  'ADVERTISING',
  'FEATURED_LISTING',
  'PROMOTION',
  'SUBSCRIPTION',
  'REFERRAL_COMMISSION',
  'OTHER_INCOME',
] as const;
export const EXPENSE_CATEGORIES = [
  'TRANSPORT',
  'ACCOMMODATION',
  'MEALS',
  'ACTIVITIES',
  'MARKETING',
  'STAFF_COMMISSIONS',
  'OPERATIONS',
  'EVENT_COSTS',
  'OTHER_EXPENSE',
] as const;
export const FINANCE_CATEGORY_LABELS: Record<string, string> = {
  TRIP_BOOKING: 'Trip booking',
  TICKET_SALES: 'Ticket sales',
  EXPERIENCE_SALES: 'Experience sales',
  CATERING_SALES: 'Catering sales',
  ADVERTISING: 'Business advertising',
  FEATURED_LISTING: 'Featured listing',
  PROMOTION: 'Promotional campaign',
  SUBSCRIPTION: 'Organiser subscription',
  REFERRAL_COMMISSION: 'Referral commission',
  OTHER_INCOME: 'Other income',
  TRANSPORT: 'Transport',
  ACCOMMODATION: 'Accommodation',
  MEALS: 'Meals',
  ACTIVITIES: 'Activities',
  MARKETING: 'Marketing',
  STAFF_COMMISSIONS: 'Staff & commissions',
  OPERATIONS: 'Operational expenses',
  EVENT_COSTS: 'Event costs',
  OTHER_EXPENSE: 'Other expense',
  REFUND: 'Refund',
};
export const TRANSACTION_STATUSES = ['PENDING', 'VERIFIED', 'CANCELLED'] as const;
export const PAYMENT_RECORD_METHODS = ['MOBILE_MONEY', 'BANK_TRANSFER', 'CASH', 'CARD', 'OTHER'] as const;
export const PAYMENT_RECORD_METHOD_LABELS: Record<string, string> = {
  MOBILE_MONEY: 'Mobile money',
  BANK_TRANSFER: 'Bank transfer',
  CASH: 'Cash',
  CARD: 'Card',
  OTHER: 'Other',
};
export const RELATED_TYPES = ['NONE', 'TRIP_DEPARTURE', 'EVENT', 'EXPERIENCE', 'ACTIVITY', 'PLACE', 'CATERING'] as const;

export const DONATION_STATUSES = ['PLEDGED', 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED'] as const;

/** Where a payment method may be offered. */
export const PAYMENT_SCOPES = ['TRIPS', 'EVENTS', 'EXPERIENCES', 'CATERING', 'DONATIONS'] as const;
export const PAYMENT_SCOPE_LABELS: Record<string, string> = {
  TRIPS: 'Trips',
  EVENTS: 'Events',
  EXPERIENCES: 'Experiences',
  CATERING: 'Catering',
  DONATIONS: 'Donations',
};
export const PAYMENT_METHOD_KINDS = ['BANK_TRANSFER', 'MOBILE_MONEY', 'CASH', 'PAYMENT_LINK', 'OTHER'] as const;

/* ------------------------------------------------------------------------- */
/* Permissions                                                                */
/* ------------------------------------------------------------------------- */

/**
 * Every area of the admin control centre. A permission is `<module>.<action>`,
 * e.g. `finance.view` or `activities.publish`. The owner holds `*`.
 *
 * These are enforced by the API on every request. The dashboard hides what a
 * person cannot use, but hiding is a convenience, never the protection.
 */
export const PERMISSION_MODULES = [
  { key: 'trips', label: 'Travel — trips & departures' },
  { key: 'bookings', label: 'Trip applications & bookings' },
  { key: 'activities', label: 'Community activities' },
  { key: 'places', label: 'Discover — places & businesses' },
  { key: 'experiences', label: 'Experiences' },
  { key: 'events', label: 'Events & registrations' },
  { key: 'catering', label: 'Catering & lunchboxes' },
  { key: 'impact', label: 'Impact projects' },
  { key: 'donations', label: 'Donations' },
  { key: 'stories', label: 'Stories, polls, challenges & deals' },
  { key: 'reviews', label: 'Reviews & reports' },
  { key: 'enquiries', label: 'Enquiries & support' },
  { key: 'members', label: 'Customers & members' },
  { key: 'media', label: 'Media library' },
  { key: 'homepage', label: 'Homepage, banners & navigation' },
  { key: 'catalogue', label: 'Countries, cities & categories' },
  { key: 'finance', label: 'Finance & reports' },
  { key: 'payments', label: 'Payment settings' },
  { key: 'settings', label: 'Website settings & contacts' },
  { key: 'staff', label: 'Staff, roles & permissions' },
  { key: 'security', label: 'Security & audit centre' },
] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number]['key'];

export const PERMISSION_ACTIONS = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'publish', label: 'Publish' },
  { key: 'delete', label: 'Delete' },
  { key: 'export', label: 'Export' },
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]['key'];

export type Permission = `${PermissionModule}.${PermissionAction}` | '*';

/** True when the granted list allows this permission. `trips.*` grants every trips action. */
export function hasPermission(granted: readonly string[] | null | undefined, wanted: string): boolean {
  if (!granted) return false;
  if (granted.includes('*') || granted.includes(wanted)) return true;
  const [module] = wanted.split('.');
  return granted.includes(`${module}.*`);
}

const all = (module: PermissionModule) => `${module}.*`;

/** Starting roles. The owner can edit them, delete them, or create others. */
export const DEFAULT_ROLES: { name: string; description: string; permissions: string[]; scope?: 'ALL' | 'OWN' }[] = [
  {
    name: 'Super Administrator',
    description: 'Everything, including staff, permissions and payment settings.',
    permissions: ['*'],
  },
  {
    name: 'Finance Manager',
    description: 'Income, expenses, donations, payment verification and financial reports.',
    permissions: [all('finance'), all('donations'), 'bookings.view', 'bookings.edit', 'events.view', 'payments.view', 'trips.view'],
  },
  {
    name: 'Travel Manager',
    description: 'Enhakkore trips, departures, applications, catering and travel enquiries.',
    permissions: [all('trips'), all('bookings'), all('catering'), all('enquiries'), all('media'), 'catalogue.view', 'members.view'],
  },
  {
    name: 'Events Manager',
    description: 'Events, ticket types, registrations and check-in.',
    permissions: [all('events'), all('media'), 'enquiries.view', 'enquiries.edit', 'catalogue.view'],
  },
  {
    name: 'Content Manager',
    description: 'Places, experiences, stories, homepage, banners, media and categories.',
    permissions: [all('places'), all('experiences'), all('stories'), all('homepage'), all('media'), all('catalogue'), 'reviews.view', 'reviews.edit'],
  },
  {
    name: 'Community Manager',
    description: 'Community activities, members, stories, polls and reports.',
    permissions: [all('activities'), all('stories'), all('reviews'), 'members.view', 'members.edit', 'media.view', 'media.create', 'catalogue.view'],
  },
  {
    name: 'Impact Manager',
    description: 'Impact projects and updates; records donations for verification.',
    permissions: [all('impact'), 'donations.view', 'donations.create', 'donations.edit', all('media')],
  },
  {
    name: 'Customer Support',
    description: 'Enquiries, and read access to bookings, registrations and members.',
    permissions: [all('enquiries'), 'bookings.view', 'bookings.edit', 'events.view', 'members.view', 'activities.view'],
  },
  {
    name: 'Business Partner',
    description: 'A partner business. Sees and edits only the listings assigned to them.',
    permissions: ['places.view', 'places.edit', 'experiences.view', 'experiences.edit', 'events.view', 'events.edit', 'media.view', 'media.create'],
    scope: 'OWN',
  },
  {
    name: 'Property Manager',
    description: 'A hotel or venue manager. Sees and edits only the properties assigned to them.',
    permissions: ['places.view', 'places.edit', 'media.view', 'media.create', 'enquiries.view'],
    scope: 'OWN',
  },
];

/* ------------------------------------------------------------------------- */
/* Interests (Connect)                                                        */
/* ------------------------------------------------------------------------- */

/** Suggestions offered on a member profile. Admin-managed INTEREST categories add to these. */
export const SUGGESTED_INTERESTS = [
  'Travel',
  'Safari',
  'Beaches',
  'Hiking',
  'Running',
  'Cycling',
  'Basketball',
  'Football',
  'Tennis',
  'Swimming',
  'Gaming',
  'Photography',
  'Food',
  'Music',
  'Nightlife',
  'Culture',
  'Volunteering',
  'Art',
  'Fitness',
  'Books',
];
