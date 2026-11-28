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
export const CATEGORY_KINDS = ['ACTIVITY', 'PLACE', 'EXPERIENCE', 'EVENT', 'INTEREST', 'GAME'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  ACTIVITY: 'Community activities',
  PLACE: 'Discover — places & businesses',
  EXPERIENCE: 'Experiences',
  EVENT: 'Events',
  INTEREST: 'Member interests',
  GAME: 'Games (gaming hub)',
};

/* ------------------------------------------------------------------------- */
/* The four main parts of the website                                         */
/* ------------------------------------------------------------------------- */

/** The eight sections of Experiences. A category's `section` places it in one. */
export const EXPERIENCE_SECTIONS = [
  { key: 'PARTIES', label: 'Parties & social events', icon: '🎉', blurb: 'Nights out, parties and social gatherings.' },
  { key: 'COMMUNITIES', label: 'Communities & meetups', icon: '🤝', blurb: 'Regular meetups and interest groups.' },
  { key: 'SPORTS', label: 'Sports & fitness', icon: '🏀', blurb: 'Basketball, jogging, football, fitness.' },
  { key: 'GAMING', label: 'Gaming & esports', icon: '🎮', blurb: 'Online tournaments and console sessions.' },
  { key: 'ARTS', label: 'Arts & culture', icon: '🎨', blurb: 'Art, music, culture and creativity.' },
  { key: 'OUTDOOR', label: 'Outdoor & adventure', icon: '🏞️', blurb: 'Hikes, beaches, nature and adventure.' },
  { key: 'LEARNING', label: 'Workshops & learning', icon: '📚', blurb: 'Workshops, classes and talks.' },
  { key: 'OTHER', label: 'Other experiences', icon: '✨', blurb: 'Everything else worth doing.' },
] as const;
export type ExperienceSection = (typeof EXPERIENCE_SECTIONS)[number]['key'];

/** The four sections of Explore, with the kinds of place each holds. */
export const EXPLORE_SECTIONS = [
  { key: 'STAYS', label: 'Stays & accommodation', icon: '🛏️', kinds: ['Hotels', 'Resorts', 'Apartments', 'Villas', 'Holiday homes', 'Guesthouses', 'Other accommodation'] },
  { key: 'FOOD', label: 'Food & dining', icon: '🍽️', kinds: ['Restaurants', 'Cafes', 'Food outlets', 'Catering', 'Trip lunchboxes'] },
  { key: 'VENUES', label: 'Venues & event spaces', icon: '🏛️', kinds: ['Wedding venues', 'Conference halls', 'Party venues', 'Gardens', 'Rooftops', 'Private event spaces'] },
  { key: 'ATTRACTIONS', label: 'Places & attractions', icon: '🗺️', kinds: ['Tourist attractions', 'Entertainment', 'Recreation centres', 'Nature', 'Places worth visiting'] },
] as const;
export type ExploreSection = (typeof EXPLORE_SECTIONS)[number]['key'];

export const SECTION_OPTIONS = [
  ...EXPERIENCE_SECTIONS.map((section) => ({ value: section.key, label: `Experiences — ${section.label}` })),
  ...EXPLORE_SECTIONS.map((section) => ({ value: section.key, label: `Explore — ${section.label}` })),
];

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
  'EVENT_PLAN',
  'VOLUNTEER',
  'EXPERIENCE',
  'EVENT',
  'ACTIVITY',
  'CATERING',
  'PRIVATE_CHEF',
  'DONATION',
  'PARTNERSHIP',
  'VENUE',
] as const;
export type EnquiryType = (typeof ENQUIRY_TYPES)[number];
export const ENQUIRY_TYPE_LABELS: Record<string, string> = {
  GENERAL: 'General',
  TRIP: 'Trip request',
  PRIVATE_TRIP: 'Private trip',
  PLACE: 'Place',
  TABLE: 'Restaurant reservation',
  ROOM: 'Hotel / stay enquiry',
  EVENT_PLAN: 'Event planning request',
  VOLUNTEER: 'Volunteer',
  EXPERIENCE: 'Experience',
  EVENT: 'Event',
  ACTIVITY: 'Activity',
  CATERING: 'Catering',
  PRIVATE_CHEF: 'Private chef',
  DONATION: 'Donation confirmation',
  PARTNERSHIP: 'Partnership / listing',
  VENUE: 'Venue enquiry',
};

/** Hotel, restaurant and venue requests: account required, confirmed only by the team. */
export const RESERVATION_TYPES = ['ROOM', 'TABLE', 'VENUE'] as const;
/** How reservation requests are described to customers and the team. */
export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  NEW: 'Request submitted',
  IN_PROGRESS: 'Under review',
  CONTACTED: 'Supplier contacted',
  AWAITING_BUSINESS: 'Awaiting supplier confirmation',
  ALTERNATIVE_OFFERED: 'Alternative offered',
  CONFIRMED: 'Confirmed',
  DECLINED: 'Unavailable / rejected',
  UNSUCCESSFUL: 'Unavailable / rejected',
  CANCELLED: 'Cancelled',
  SPAM: 'Spam',
};
export const ENQUIRY_STATUSES = [
  'NEW',
  'CONTACTED',
  'AWAITING_BUSINESS',
  'ALTERNATIVE_OFFERED',
  'NEGOTIATING',
  'AWAITING_VERIFICATION',
  'AWAITING_AGREEMENT',
  'IN_PROGRESS',
  'APPROVED',
  'PUBLISHED',
  'CONFIRMED',
  'CONVERTED',
  'DECLINED',
  'CANCELLED',
  'UNSUCCESSFUL',
  'CLOSED',
  'SPAM',
] as const;
export const ENQUIRY_STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  AWAITING_BUSINESS: 'Awaiting business response',
  ALTERNATIVE_OFFERED: 'Alternative offered',
  NEGOTIATING: 'Negotiating',
  AWAITING_VERIFICATION: 'Awaiting verification',
  AWAITING_AGREEMENT: 'Awaiting agreement / payment',
  IN_PROGRESS: 'In progress',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  CONFIRMED: 'Confirmed',
  CONVERTED: 'Converted',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
  UNSUCCESSFUL: 'Unsuccessful',
  CLOSED: 'Closed',
  SPAM: 'Spam',
};
/** The statuses that make sense for each kind of enquiry. */
export function enquiryStatusesFor(type: string): string[] {
  if (type === 'ROOM' || type === 'TABLE' || type === 'VENUE') {
    return ['NEW', 'IN_PROGRESS', 'CONTACTED', 'AWAITING_BUSINESS', 'ALTERNATIVE_OFFERED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'SPAM'];
  }
  if (type === 'TRIP' || type === 'PRIVATE_TRIP') {
    return ['NEW', 'CONTACTED', 'IN_PROGRESS', 'CONFIRMED', 'CONVERTED', 'DECLINED', 'CANCELLED', 'CLOSED', 'SPAM'];
  }
  if (type === 'PARTNERSHIP') {
    return ['NEW', 'CONTACTED', 'NEGOTIATING', 'AWAITING_VERIFICATION', 'AWAITING_AGREEMENT', 'APPROVED', 'PUBLISHED', 'DECLINED', 'SPAM'];
  }
  return ['NEW', 'CONTACTED', 'IN_PROGRESS', 'CONFIRMED', 'CONVERTED', 'DECLINED', 'CANCELLED', 'CLOSED', 'SPAM'];
}
/** The label for an enquiry's status, in reservation wording where it applies. */
export function enquiryStatusLabel(type: string, status: string): string {
  if ((RESERVATION_TYPES as readonly string[]).includes(type)) return RESERVATION_STATUS_LABELS[status] ?? ENQUIRY_STATUS_LABELS[status] ?? status;
  return ENQUIRY_STATUS_LABELS[status] ?? status;
}
/** Enquiry types that send the team an automatic WhatsApp notice. */
export const NOTIFY_ENQUIRY_TYPES = ['VENUE', 'TRIP', 'ROOM', 'TABLE', 'EVENT_PLAN', 'PARTNERSHIP', 'PRIVATE_TRIP', 'CATERING', 'PRIVATE_CHEF'];

/** Where a trip stands — shown on the trip page, set by the travel team. */
export const TRIP_STAGES = [
  'REGISTRATION_OPEN',
  'MINIMUM_NOT_REACHED',
  'MINIMUM_REACHED',
  'SUPPLIER_CONFIRMATION',
  'TRIP_CONFIRMED',
  'DEPARTURE_READY',
  'COMPLETED',
  'CANCELLED',
] as const;
export const TRIP_STAGE_LABELS: Record<string, string> = {
  REGISTRATION_OPEN: 'Registration open',
  MINIMUM_NOT_REACHED: 'Minimum group size not reached yet',
  MINIMUM_REACHED: 'Minimum group size reached',
  SUPPLIER_CONFIRMATION: 'Confirming with suppliers',
  TRIP_CONFIRMED: 'Trip confirmed',
  DEPARTURE_READY: 'Ready to depart',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

/* Gaming */
export const TOURNAMENT_KINDS = ['ONLINE', 'CONSOLE'] as const;
export const TOURNAMENT_KIND_LABELS: Record<string, string> = { ONLINE: 'Online tournament', CONSOLE: 'PlayStation / console session' };
export const TOURNAMENT_FORMATS = ['SOLO', 'DUO', 'SQUAD', 'TEAM'] as const;
export const TOURNAMENT_FORMAT_LABELS: Record<string, string> = { SOLO: 'Solo', DUO: 'Duo', SQUAD: 'Squad', TEAM: 'Team' };
export const TOURNAMENT_STATUSES = ['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED'] as const;
export const TOURNAMENT_PUBLIC_STATUSES = ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export const ENTRY_STATUSES = ['REGISTERED', 'CONFIRMED', 'WAITLIST', 'DISQUALIFIED', 'WITHDRAWN'] as const;

/* Communities */
export const COMMUNITY_STATUSES = ['PENDING_REVIEW', 'DRAFT', 'PUBLISHED', 'REJECTED', 'ARCHIVED'] as const;
export const SESSION_STATUSES = ['SCHEDULED', 'CHANGED', 'CANCELLED', 'COMPLETED'] as const;

/* Partnerships */
export const AGREEMENT_KINDS = ['EDITORIAL', 'SPONSORED', 'REFERRAL', 'VENUE', 'GAMING', 'OTHER'] as const;
export const AGREEMENT_KIND_LABELS: Record<string, string> = {
  EDITORIAL: 'Editorial (selected by Enhakkore, unpaid)',
  SPONSORED: 'Sponsored placement (paid, labelled)',
  REFERRAL: 'Referral / booking commission',
  VENUE: 'Venue partnership',
  GAMING: 'Gaming partnership / sponsorship',
  OTHER: 'Other',
};
export const AGREEMENT_STATUSES = ['NEGOTIATING', 'ACTIVE', 'ENDED', 'CANCELLED'] as const;
export const PARTNER_CATEGORIES = [
  'Hotels & accommodation',
  'Restaurants & cafes',
  'Venues & event spaces',
  'Events & experiences',
  'Gaming & esports',
  'Sponsors',
  'Other partnerships',
];

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
  { key: 'communities', label: 'Communities' },
  { key: 'gaming', label: 'Gaming & tournaments' },
  { key: 'partnerships', label: 'Business partnerships & agreements' },
  { key: 'analytics', label: 'Reports & analytics' },
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
    name: 'Explore Manager',
    description: 'Explore listings — stays, food, venues and attractions — and hotel and restaurant enquiries.',
    permissions: [all('places'), all('enquiries'), all('partnerships'), all('media'), 'catalogue.view'],
  },
  {
    name: 'Experiences Manager',
    description: 'Experiences, events, activities, sessions and communities.',
    permissions: [all('experiences'), all('events'), all('activities'), all('communities'), all('media'), 'enquiries.view', 'enquiries.edit', 'catalogue.view'],
  },
  {
    name: 'Gaming Manager',
    description: 'Games, tournaments, console sessions, entries, brackets and results.',
    permissions: [all('gaming'), all('media'), 'catalogue.view', 'members.view'],
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


/* ------------------------------------------------------------------------- */
/* Subcategories (the second level everywhere: globe, category pages, forms)  */
/* ------------------------------------------------------------------------- */

/** Experience subcategories per section. Category records with these names are created by the bootstrap. */
export const EXPERIENCE_SUBCATEGORIES: Record<ExperienceSection, string[]> = {
  PARTIES: ['House Parties', 'Birthday Parties', 'Concerts', 'Music Festivals', 'Awards Events', 'Nightlife', 'Social Gatherings', 'Cultural Celebrations', 'Private Events', 'Other Events'],
  SPORTS: ['Jogging and Running', 'Football', 'Basketball', 'Tennis', 'Volleyball', 'Roller Skating', 'Cycling', 'Gym and Fitness', 'Swimming', 'Sports Competitions', 'Fitness Challenges', 'Other Sports'],
  GAMING: ['Online Tournaments', 'PS & Console Gaming', 'Gaming Meetups'],
  ARTS: ['Art Exhibitions', 'Painting', 'Music', 'Dance', 'Photography', 'Creative Workshops', 'Cultural Celebrations', 'Other Creative Experiences'],
  OUTDOOR: ['Hiking', 'Camping', 'Nature Walks', 'Outdoor Challenges', 'Exploration', 'Adventure Activities', 'Other Outdoor Experiences'],
  COMMUNITIES: ['Sports Communities', 'Gaming Communities', 'Photography Communities', 'Art Communities', 'Business Communities', 'Country-based Communities', 'Social Communities', 'Travel Communities', 'Other Interest Groups'],
  LEARNING: ['Study Groups', 'Training', 'Skills Workshops', 'Language Learning', 'Creative Classes', 'Educational Events', 'Professional Development'],
  OTHER: ['Other Experiences'],
};

/** Display names for the experience sections, in the order of the brief. */
export const EXPERIENCE_SECTION_NAMES: Record<ExperienceSection, string> = {
  PARTIES: 'Events & Social',
  SPORTS: 'Sports & Fitness',
  GAMING: 'Gaming & Esports',
  ARTS: 'Arts & Culture',
  OUTDOOR: 'Outdoor & Adventure',
  COMMUNITIES: 'Communities & Meetups',
  LEARNING: 'Workshops & Learning',
  OTHER: 'Other Experiences',
};

/** Games offered for tournaments (admins can add more under Categories & games). */
export const ONLINE_GAMES = ['Free Fire', 'PUBG Mobile', 'Call of Duty Mobile', 'Delta Force', 'Mobile Legends', 'Brawl Stars', 'Fortnite', 'eFootball', 'EA FC Mobile'];
export const CONSOLE_GAMES = ['EA SPORTS FC', 'eFootball', 'Mortal Kombat', 'Tekken', 'WWE', 'NBA 2K'];

export const TRAVEL_SUBCATEGORIES = [
  { key: 'GROUP', label: 'Group Trips' },
  { key: 'PRIVATE', label: 'Private Trips' },
  { key: 'SAFARI', label: 'Safaris' },
  { key: 'BEACH', label: 'Beach & Island' },
  { key: 'HOLIDAY', label: 'Holiday Packages' },
  { key: 'INTERNATIONAL', label: 'International Travel' },
] as const;

export const IMPACT_SUBCATEGORIES = [
  { key: 'COMMUNITY', label: 'Community Projects' },
  { key: 'CHILDREN', label: 'Children’s Initiatives' },
  { key: 'VOLUNTEERING', label: 'Volunteering' },
  { key: 'DONATIONS', label: 'Donations' },
  { key: 'STORIES', label: 'Impact Stories' },
] as const;

/* ------------------------------------------------------------------------- */
/* Organisers, passes, entry checks                                           */
/* ------------------------------------------------------------------------- */

export const ORGANISER_APPLICATION_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type OrganiserApplicationStatus = (typeof ORGANISER_APPLICATION_STATUSES)[number];
export const ORGANISER_APPLICATION_LABELS: Record<OrganiserApplicationStatus, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  MORE_INFO: 'More information required',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};

/** How entry to an activity or event is checked. NONE is the default for ordinary free activities. */
export const ENTRY_VERIFICATION = ['NONE', 'QR', 'MANUAL'] as const;
export type EntryVerification = (typeof ENTRY_VERIFICATION)[number];
export const ENTRY_VERIFICATION_LABELS: Record<EntryVerification, string> = {
  NONE: 'No verification (default)',
  QR: 'QR code — Enhakkore Pass',
  MANUAL: 'Manual — names checked at the door',
};

export const PASS_STATUS_LABELS: Record<string, string> = { VALID: 'Confirmed', CHECKED_IN: 'Checked in', CANCELLED: 'Cancelled', EXPIRED: 'Expired' };
export const SCAN_RESULT_LABELS: Record<string, string> = {
  VALID: 'Valid — checked in',
  ALREADY_CHECKED_IN: 'Already checked in',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  NOT_FOUND: 'Not found',
  REVIEW: 'Needs review',
};

export const COMMUNITY_ACCESS = ['FREE', 'PAID', 'PRIVATE'] as const;
export const COMMUNITY_ACCESS_LABELS: Record<string, string> = { FREE: 'Free to join', PAID: 'Paid membership', PRIVATE: 'Private — apply to join' };

/** Profile fields with their own visibility. */
export const PROFILE_FIELDS = ['bio', 'interests', 'location', 'communities', 'activities'] as const;
export const VISIBILITY_LEVELS = ['PUBLIC', 'MEMBERS', 'PRIVATE'] as const;

/** Non-essential notification kinds a member can switch off. Safety, cancellation and booking notices are always sent. */
export const OPTIONAL_NOTIFICATIONS: { key: string; label: string; types: string[] }[] = [
  { key: 'chat', label: 'New group chat messages', types: ['CHAT_MESSAGE'] },
  { key: 'invites', label: 'Invitations from members', types: ['INVITATION'] },
  { key: 'community', label: 'Community announcements', types: ['COMMUNITY_ANNOUNCEMENT'] },
  { key: 'nearby', label: 'Nearby members', types: ['NEARBY'] },
  { key: 'impact', label: 'Impact updates', types: ['IMPACT_UPDATE'] },
];

/** Usernames: 3–20 characters, lowercase letters, numbers, dot and underscore. */
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._]{1,18})[a-z0-9]$/;
