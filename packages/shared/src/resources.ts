import { SUPPORTED_CURRENCIES } from './money';
import {
  ACTIVITY_MODES,
  ACTIVITY_MODE_LABELS,
  ACTIVITY_STATUSES,
  CATEGORY_KINDS,
  CATEGORY_KIND_LABELS,
  CATERING_KINDS,
  CATERING_KIND_LABELS,
  CONTENT_STATUSES,
  EVENT_HOSTS,
  EVENT_HOST_LABELS,
  EVENT_STATUSES,
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
  INFO_SOURCES,
  INFO_SOURCE_LABELS,
  PAYMENT_METHOD_KINDS,
  PAYMENT_SCOPES,
  PAYMENT_SCOPE_LABELS,
  POLL_STATUSES,
  PRICE_UNITS,
  PRICE_UNIT_LABELS,
  REGISTRATION_MODES,
  REGISTRATION_MODE_LABELS,
  STORY_STATUSES,
  type CategoryKind,
  type PermissionModule,
} from './platform';
import { IMPACT_CATEGORIES, IMPACT_CATEGORY_LABELS, TRIP_TYPES, TRIP_TYPE_LABELS } from './domain';

/**
 * The admin control centre, described as data.
 *
 * Each resource below is one kind of thing the owner manages — activities,
 * places, trips, events… The API builds its validation and storage from these
 * definitions, and the dashboard builds its forms and tables from the same
 * ones, so the two can never disagree about what a field is.
 *
 * Adding a field to a listing is a line here plus a database column.
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'integer'
  | 'money'
  | 'currency'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'tags'
  | 'date'
  | 'datetime'
  | 'timezone'
  | 'country'
  | 'city'
  | 'category'
  | 'image'
  | 'gallery'
  | 'video'
  | 'url'
  | 'phone'
  | 'email'
  | 'list'
  | 'repeater'
  | 'place'
  | 'user'
  | 'color';

export interface Option {
  value: string;
  label: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: Option[];
  max?: number;
  min?: number;
  /** For `money`: the field holding its currency code. */
  currencyField?: string;
  /** For `datetime`: the field holding the IANA zone the time is entered in. */
  timezoneField?: string;
  /** For `category`. */
  categoryKind?: CategoryKind;
  /** For `repeater`: the shape of each row. */
  fields?: FieldDef[];
  /** Form section heading this field sits under. */
  section?: string;
  default?: unknown;
  /** Never sent by the public API — shown in the dashboard only. */
  private?: boolean;
  /** Stored outside the row (e.g. trip departures, event tickets); handled by the resource's own code. */
  virtual?: boolean;
  /** Only shown when another field has one of these values. */
  showIf?: { field: string; values: (string | boolean)[] };
  /** Takes the full width of the form. */
  wide?: boolean;
  /** Not editable after creation (e.g. a country code). */
  readOnly?: boolean;
}

export interface ResourceDef {
  key: string;
  label: string;
  plural: string;
  /** Prisma model delegate name. */
  model: string;
  permission: PermissionModule;
  description: string;
  titleField: string;
  slugField?: string;
  statusField?: string;
  statuses?: readonly string[];
  /** The status that "Publish" sets, and the one "Unpublish" returns to. */
  publishStatus?: string;
  unpublishStatus?: string;
  archiveStatus?: string;
  /** Public address, `{slug}` and `{id}` filled in, for Preview and View. */
  publicPath?: string;
  columns: string[];
  searchFields: string[];
  filters: string[];
  defaultSort: { field: string; dir: 'asc' | 'desc' };
  fields: FieldDef[];
  /** For partner roles limited to their own listings. */
  ownerField?: string;
  /** Changes need a typed confirmation and are flagged in the audit log. */
  sensitive?: boolean;
  /** The image shown in list rows. */
  imageField?: string;
  /** Rows created by the system that cannot be deleted. */
  protectDelete?: boolean;
  /** Hidden from the generic menu (managed on its own screen). */
  hidden?: boolean;
}

const opts = (values: readonly string[], labels?: Record<string, string>): Option[] =>
  values.map((value) => ({ value, label: labels?.[value] ?? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') }));

const CURRENCY_OPTIONS = opts(SUPPORTED_CURRENCIES, Object.fromEntries(SUPPORTED_CURRENCIES.map((c) => [c, c])));

/* Field shorthands, so each resource reads as a form. */
const f = {
  title: (label = 'Title'): FieldDef => ({ name: 'title', label, type: 'text', required: true, max: 160, section: 'Basics' }),
  slug: (): FieldDef => ({
    name: 'slug',
    label: 'Web address',
    type: 'text',
    max: 120,
    section: 'Basics',
    help: 'Leave empty and one is made from the title. Lowercase words joined by hyphens.',
  }),
  summary: (): FieldDef => ({ name: 'summary', label: 'Short summary', type: 'textarea', max: 400, section: 'Basics', help: 'One or two sentences, shown on cards.' }),
  description: (required = false): FieldDef => ({ name: 'description', label: 'Full description', type: 'textarea', max: 20000, required, section: 'Basics', wide: true }),
  country: (required = true): FieldDef => ({ name: 'countryId', label: 'Country', type: 'country', required, section: 'Location' }),
  city: (required = false): FieldDef => ({ name: 'cityId', label: 'City', type: 'city', required, section: 'Location', help: 'Pick a city, or add a new one from the list.' }),
  cover: (label = 'Cover photo', required = false): FieldDef => ({ name: 'coverImage', label, type: 'image', required, section: 'Photos & video' }),
  gallery: (): FieldDef => ({ name: 'gallery', label: 'Gallery', type: 'gallery', section: 'Photos & video' }),
  video: (): FieldDef => ({ name: 'videoUrl', label: 'Video', type: 'video', section: 'Photos & video', help: 'Upload a video, or paste a link to one.' }),
  featured: (): FieldDef => ({ name: 'featured', label: 'Feature on the homepage', type: 'boolean', section: 'Visibility' }),
  money: (name: string, label: string, currencyField = 'currency', help?: string, required = false): FieldDef => ({
    name,
    label,
    type: 'money',
    currencyField,
    section: 'Price',
    help,
    required,
  }),
  currency: (name = 'currency', required = false): FieldDef => ({
    name,
    label: 'Currency',
    type: 'currency',
    options: CURRENCY_OPTIONS,
    section: 'Price',
    required,
  }),
  timezone: (): FieldDef => ({
    name: 'timezone',
    label: 'Time zone',
    type: 'timezone',
    section: 'Date & time',
    help: 'Times are entered and shown in this zone. Filled in from the city when left empty.',
  }),
};

/* ------------------------------------------------------------------------- */

export const ACTIVITY_RESOURCE: ResourceDef = {
  key: 'activities',
  label: 'Activity',
  plural: 'Activities',
  model: 'activity',
  permission: 'activities',
  description: 'Community and Enhakkore activities — basketball, running, gaming and more. Submissions arrive as “Pending review”.',
  titleField: 'title',
  slugField: 'slug',
  statusField: 'status',
  statuses: ACTIVITY_STATUSES,
  publishStatus: 'PUBLISHED',
  unpublishStatus: 'APPROVED',
  archiveStatus: 'ARCHIVED',
  publicPath: '/activities/{slug}',
  imageField: 'coverImage',
  columns: ['title', 'categoryId', 'cityId', 'startsAt', 'source', 'status'],
  searchFields: ['title', 'organiserName', 'meetingPoint'],
  filters: ['status', 'source', 'countryId', 'cityId', 'categoryId', 'mode'],
  defaultSort: { field: 'createdAt', dir: 'desc' },
  fields: [
    f.title('Activity title'),
    f.slug(),
    { name: 'categoryId', label: 'Category', type: 'category', categoryKind: 'ACTIVITY', required: true, section: 'Basics' },
    f.summary(),
    f.description(true),
    { name: 'source', label: 'Who organises it', type: 'select', options: opts(['ADMIN', 'COMMUNITY'], { ADMIN: 'Enhakkore', COMMUNITY: 'A community member' }), default: 'ADMIN', section: 'Organiser' },
    { name: 'organiserName', label: 'Organiser name', type: 'text', required: true, max: 120, section: 'Organiser' },
    { name: 'organiserPhone', label: 'Organiser phone (private)', type: 'phone', private: true, section: 'Organiser', help: 'Never shown publicly. Used by the Enhakkore team only.' },
    { name: 'organiserUserId', label: 'Organiser’s Enhakkore account', type: 'user', section: 'Organiser', help: 'Link a member account to let them manage participants themselves.' },
    { name: 'contactMethod', label: 'How to join', type: 'text', max: 200, section: 'Organiser', placeholder: 'Request to join on Enhakkore', help: 'Shown on the page.' },
    { name: 'mode', label: 'In person or online', type: 'select', options: opts(ACTIVITY_MODES, ACTIVITY_MODE_LABELS), default: 'IN_PERSON', section: 'Location' },
    f.country(),
    f.city(),
    { name: 'meetingPoint', label: 'Meeting place', type: 'text', max: 200, section: 'Location', help: 'A public place — a court, a park entrance. Never a home address.', showIf: { field: 'mode', values: ['IN_PERSON'] } },
    { name: 'onlineDetails', label: 'Online details (sent to approved participants)', type: 'textarea', max: 1000, private: true, section: 'Location', showIf: { field: 'mode', values: ['ONLINE'] } },
    { name: 'platformName', label: 'Platform or game', type: 'text', max: 120, section: 'Location', placeholder: 'PlayStation 5, PUBG Mobile…', showIf: { field: 'mode', values: ['ONLINE'] } },
    f.timezone(),
    { name: 'startsAt', label: 'Starts', type: 'datetime', timezoneField: 'timezone', section: 'Date & time' },
    { name: 'endsAt', label: 'Ends', type: 'datetime', timezoneField: 'timezone', section: 'Date & time' },
    { name: 'recurrence', label: 'Repeats', type: 'text', max: 120, section: 'Date & time', placeholder: 'Every Saturday morning', help: 'Optional. Describe a regular meet-up.' },
    { name: 'capacity', label: 'Spaces available', type: 'integer', min: 1, max: 100000, section: 'Participants', help: 'Leave empty for no limit.' },
    { name: 'spotsTaken', label: 'Spaces already taken', type: 'integer', min: 0, section: 'Participants', help: 'Updated automatically when you approve a request.' },
    { name: 'level', label: 'Experience level', type: 'select', options: opts(EXPERIENCE_LEVELS, EXPERIENCE_LEVEL_LABELS), default: 'ALL', section: 'Participants' },
    { name: 'equipment', label: 'Equipment to bring', type: 'textarea', max: 1000, section: 'Participants' },
    { name: 'requirements', label: 'Participation requirements', type: 'textarea', max: 1000, section: 'Participants' },
    f.currency(),
    f.money('price', 'Price to take part', 'currency', 'Leave empty if free.'),
    f.cover(),
    f.gallery(),
    f.video(),
    { name: 'status', label: 'Status', type: 'select', options: opts(ACTIVITY_STATUSES), default: 'DRAFT', section: 'Visibility' },
    { name: 'reviewNotes', label: 'Review notes (internal)', type: 'textarea', private: true, max: 2000, section: 'Visibility' },
    f.featured(),
  ],
};

export const PLACE_RESOURCE: ResourceDef = {
  key: 'places',
  label: 'Place',
  plural: 'Places & businesses',
  model: 'place',
  permission: 'places',
  description: 'Hotels, restaurants, beaches, venues and hidden gems in Enhakkore Discover.',
  titleField: 'name',
  slugField: 'slug',
  statusField: 'status',
  statuses: CONTENT_STATUSES,
  publishStatus: 'PUBLISHED',
  unpublishStatus: 'DRAFT',
  archiveStatus: 'ARCHIVED',
  publicPath: '/discover/{slug}',
  imageField: 'coverImage',
  ownerField: 'managerId',
  columns: ['name', 'categoryId', 'cityId', 'infoSource', 'sponsored', 'status'],
  searchFields: ['name', 'address', 'area'],
  filters: ['status', 'countryId', 'cityId', 'categoryId', 'infoSource'],
  defaultSort: { field: 'updatedAt', dir: 'desc' },
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true, max: 160, section: 'Basics' },
    f.slug(),
    { name: 'categoryId', label: 'Category', type: 'category', categoryKind: 'PLACE', required: true, section: 'Basics' },
    f.summary(),
    f.description(),
    { name: 'hiddenGem', label: 'Hidden gem', type: 'boolean', section: 'Basics' },
    f.country(),
    f.city(),
    { name: 'area', label: 'Area / neighbourhood', type: 'text', max: 120, section: 'Location' },
    { name: 'address', label: 'Address', type: 'text', max: 300, section: 'Location' },
    { name: 'latitude', label: 'Map latitude', type: 'number', min: -90, max: 90, section: 'Location' },
    { name: 'longitude', label: 'Map longitude', type: 'number', min: -180, max: 180, section: 'Location' },
    { name: 'facilities', label: 'Facilities', type: 'tags', section: 'Details', help: 'Parking, Wi-Fi, pool…' },
    { name: 'amenities', label: 'Amenities', type: 'tags', section: 'Details' },
    {
      name: 'openingHours',
      label: 'Opening hours',
      type: 'repeater',
      section: 'Details',
      help: 'Only add hours you have confirmed.',
      fields: [
        { name: 'days', label: 'Days', type: 'text', placeholder: 'Mon–Fri' },
        { name: 'hours', label: 'Hours', type: 'text', placeholder: '08:00–22:00 or Closed' },
      ],
    },
    { name: 'priceRange', label: 'Price range', type: 'text', max: 60, section: 'Details', placeholder: 'e.g. From TZS 15,000 per person', help: 'Only a range you have confirmed.' },
    { name: 'offers', label: 'Current offers', type: 'textarea', max: 1000, section: 'Details' },
    { name: 'phone', label: 'Phone', type: 'phone', section: 'Contact' },
    { name: 'whatsapp', label: 'WhatsApp', type: 'phone', section: 'Contact' },
    { name: 'email', label: 'Email', type: 'email', section: 'Contact' },
    { name: 'website', label: 'Website', type: 'url', section: 'Contact' },
    {
      name: 'socials',
      label: 'Social links',
      type: 'repeater',
      section: 'Contact',
      fields: [
        { name: 'label', label: 'Network', type: 'text', placeholder: 'Instagram' },
        { name: 'url', label: 'Link', type: 'url' },
      ],
    },
    { name: 'bookingMode', label: 'Bookings', type: 'select', options: opts(['ENQUIRY', 'EXTERNAL', 'NONE'], { ENQUIRY: 'Enquiries through Enhakkore', EXTERNAL: 'Book on their own website', NONE: 'No bookings' }), default: 'ENQUIRY', section: 'Bookings' },
    { name: 'bookingUrl', label: 'Their booking link', type: 'url', section: 'Bookings', showIf: { field: 'bookingMode', values: ['EXTERNAL'] } },
    { name: 'enquiryKind', label: 'Enquiry type', type: 'select', options: opts(['PLACE', 'ROOM', 'TABLE'], { PLACE: 'General', ROOM: 'Room / stay', TABLE: 'Table reservation' }), default: 'PLACE', section: 'Bookings', showIf: { field: 'bookingMode', values: ['ENQUIRY'] } },
    f.cover(),
    f.gallery(),
    f.video(),
    { name: 'infoSource', label: 'Who provided these details', type: 'select', options: opts(INFO_SOURCES, INFO_SOURCE_LABELS), default: 'UNVERIFIED', section: 'Trust' },
    { name: 'lastVerifiedAt', label: 'Last verified on', type: 'date', section: 'Trust' },
    { name: 'sponsored', label: 'Sponsored listing', type: 'boolean', section: 'Trust', help: 'Shown with a “Sponsored” label.' },
    { name: 'managerId', label: 'Managed by (partner account)', type: 'user', section: 'Trust', help: 'A Business Partner or Property Manager who may edit this listing.' },
    { name: 'status', label: 'Status', type: 'select', options: opts(CONTENT_STATUSES), default: 'DRAFT', section: 'Visibility' },
    f.featured(),
  ],
};

export const EXPERIENCE_RESOURCE: ResourceDef = {
  key: 'experiences',
  label: 'Experience',
  plural: 'Experiences',
  model: 'experience',
  permission: 'experiences',
  description: 'Cooking classes, boat trips, guided tours, workshops — by Enhakkore or by local providers.',
  titleField: 'title',
  slugField: 'slug',
  statusField: 'status',
  statuses: CONTENT_STATUSES,
  publishStatus: 'PUBLISHED',
  unpublishStatus: 'DRAFT',
  archiveStatus: 'ARCHIVED',
  publicPath: '/experiences/{slug}',
  imageField: 'coverImage',
  ownerField: 'managerId',
  columns: ['title', 'categoryId', 'cityId', 'provider', 'status'],
  searchFields: ['title', 'provider'],
  filters: ['status', 'countryId', 'cityId', 'categoryId'],
  defaultSort: { field: 'updatedAt', dir: 'desc' },
  fields: [
    f.title(),
    f.slug(),
    { name: 'categoryId', label: 'Category', type: 'category', categoryKind: 'EXPERIENCE', required: true, section: 'Basics' },
    f.summary(),
    f.description(true),
    f.country(),
    f.city(),
    { name: 'meetingPoint', label: 'Meeting point', type: 'text', max: 200, section: 'Location' },
    { name: 'durationText', label: 'Duration', type: 'text', max: 60, section: 'Date & time', placeholder: '3 hours' },
    { name: 'schedule', label: 'When it runs', type: 'text', max: 200, section: 'Date & time', placeholder: 'Saturdays at 9:00, on request…' },
    f.timezone(),
    { name: 'startsAt', label: 'Next date (optional)', type: 'datetime', timezoneField: 'timezone', section: 'Date & time' },
    f.currency(),
    f.money('price', 'Price', 'currency', 'Leave empty to show “price on request”.'),
    { name: 'priceNote', label: 'Price note', type: 'text', max: 160, section: 'Price', placeholder: 'per person' },
    { name: 'inclusions', label: 'Included', type: 'list', section: 'Details' },
    { name: 'exclusions', label: 'Not included', type: 'list', section: 'Details' },
    { name: 'provider', label: 'Provider', type: 'text', max: 160, required: true, section: 'Provider', default: 'Enhakkore' },
    { name: 'providerContact', label: 'Provider contact (private)', type: 'text', max: 200, private: true, section: 'Provider' },
    { name: 'managerId', label: 'Managed by (partner account)', type: 'user', section: 'Provider' },
    f.cover(),
    f.gallery(),
    f.video(),
    { name: 'status', label: 'Status', type: 'select', options: opts(CONTENT_STATUSES), default: 'DRAFT', section: 'Visibility' },
    f.featured(),
  ],
};

export const EVENT_RESOURCE: ResourceDef = {
  key: 'events',
  label: 'Event',
  plural: 'Events',
  model: 'event',
  permission: 'events',
  description: 'Parties, festivals, music, games — hosted by Enhakkore or listed for others.',
  titleField: 'title',
  slugField: 'slug',
  statusField: 'status',
  statuses: EVENT_STATUSES,
  publishStatus: 'PUBLISHED',
  unpublishStatus: 'DRAFT',
  archiveStatus: 'ARCHIVED',
  publicPath: '/events/{slug}',
  imageField: 'poster',
  ownerField: 'managerId',
  columns: ['title', 'host', 'cityId', 'startsAt', 'status'],
  searchFields: ['title', 'venue', 'hostName'],
  filters: ['status', 'host', 'countryId', 'cityId', 'categoryId'],
  defaultSort: { field: 'startsAt', dir: 'desc' },
  fields: [
    f.title('Event name'),
    f.slug(),
    { name: 'categoryId', label: 'Type of event', type: 'category', categoryKind: 'EVENT', required: true, section: 'Basics' },
    f.summary(),
    f.description(true),
    { name: 'host', label: 'Host', type: 'select', options: opts(EVENT_HOSTS, EVENT_HOST_LABELS), default: 'ENHAKKORE', section: 'Basics' },
    { name: 'hostName', label: 'Organiser name', type: 'text', max: 160, section: 'Basics', showIf: { field: 'host', values: ['THIRD_PARTY'] } },
    f.country(),
    f.city(),
    { name: 'venue', label: 'Venue', type: 'text', max: 200, section: 'Location' },
    { name: 'address', label: 'Venue address', type: 'text', max: 300, section: 'Location' },
    f.timezone(),
    { name: 'startsAt', label: 'Starts', type: 'datetime', timezoneField: 'timezone', required: true, section: 'Date & time' },
    { name: 'endsAt', label: 'Ends', type: 'datetime', timezoneField: 'timezone', section: 'Date & time' },
    { name: 'registrationMode', label: 'Registration', type: 'select', options: opts(REGISTRATION_MODES, REGISTRATION_MODE_LABELS), default: 'ENHAKKORE', section: 'Tickets' },
    { name: 'externalUrl', label: 'Ticket link', type: 'url', section: 'Tickets', showIf: { field: 'registrationMode', values: ['EXTERNAL'] } },
    { name: 'capacity', label: 'Total capacity', type: 'integer', min: 1, section: 'Tickets', help: 'Leave empty for no overall limit.' },
    {
      name: 'tickets',
      label: 'Ticket types',
      type: 'repeater',
      virtual: true,
      section: 'Tickets',
      help: 'Each ticket has its own price and, optionally, its own limit.',
      fields: [
        { name: 'id', label: 'id', type: 'text', readOnly: true },
        { name: 'name', label: 'Ticket name', type: 'text', required: true, placeholder: 'Regular' },
        { name: 'description', label: 'What it includes', type: 'text' },
        { name: 'currency', label: 'Currency', type: 'currency', options: CURRENCY_OPTIONS, default: 'TZS' },
        { name: 'price', label: 'Price', type: 'money', currencyField: 'currency' },
        { name: 'capacity', label: 'Limit', type: 'integer', min: 1 },
        { name: 'active', label: 'On sale', type: 'boolean', default: true },
      ],
    },
    { name: 'paymentInstructions', label: 'Payment instructions', type: 'textarea', max: 3000, section: 'Tickets', help: 'Shown after someone registers. Payment methods from Payment settings are listed too.' },
    { name: 'ageRestriction', label: 'Age restriction', type: 'text', max: 60, section: 'Details' },
    { name: 'dressCode', label: 'Dress code / theme', type: 'text', max: 160, section: 'Details' },
    { name: 'managerId', label: 'Managed by (partner account)', type: 'user', section: 'Details' },
    { name: 'poster', label: 'Event poster', type: 'image', section: 'Photos & video' },
    f.gallery(),
    f.video(),
    { name: 'status', label: 'Status', type: 'select', options: opts(EVENT_STATUSES), default: 'DRAFT', section: 'Visibility' },
    f.featured(),
  ],
};

export const TRIP_RESOURCE: ResourceDef = {
  key: 'trips',
  label: 'Trip',
  plural: 'Enhakkore trips',
  model: 'trip',
  permission: 'trips',
  description: 'Enhakkore’s own group trips, safaris and journeys, with their departures, prices and itinerary.',
  titleField: 'title',
  slugField: 'slug',
  statusField: 'status',
  statuses: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
  publishStatus: 'PUBLISHED',
  unpublishStatus: 'DRAFT',
  archiveStatus: 'ARCHIVED',
  publicPath: '/travel/{slug}',
  imageField: 'heroImage',
  columns: ['title', 'type', 'cityId', 'basePrice', 'status'],
  searchFields: ['title', 'summary'],
  filters: ['status', 'type', 'countryId'],
  defaultSort: { field: 'updatedAt', dir: 'desc' },
  fields: [
    f.title('Trip name'),
    { name: 'subtitle', label: 'Subtitle', type: 'text', max: 160, section: 'Basics' },
    f.slug(),
    { name: 'type', label: 'Kind of trip', type: 'select', options: opts(TRIP_TYPES, TRIP_TYPE_LABELS), default: 'GROUP', section: 'Basics' },
    { name: 'summary', label: 'Short summary', type: 'textarea', required: true, max: 600, section: 'Basics' },
    { name: 'description', label: 'Full description', type: 'textarea', required: true, max: 20000, section: 'Basics', wide: true },
    f.country(),
    f.city(),
    { name: 'destinationLabel', label: 'Destination as shown', type: 'text', max: 160, section: 'Location', placeholder: 'Arusha, Tanzania' },
    { name: 'departureCity', label: 'Departs from', type: 'text', max: 160, section: 'Location', placeholder: 'Dar es Salaam' },
    { name: 'meetingPoint', label: 'Meeting point', type: 'text', max: 200, section: 'Location' },
    { name: 'durationDays', label: 'Days', type: 'integer', min: 1, max: 365, required: true, section: 'Duration' },
    { name: 'durationNights', label: 'Nights', type: 'integer', min: 0, max: 365, required: true, section: 'Duration' },
    f.currency('currency', true),
    f.money('basePrice', 'Headline price (per person)', 'currency', 'The “from” price on cards. Each departure can override it.', true),
    {
      name: 'priceTiers',
      label: 'Other prices',
      type: 'repeater',
      section: 'Price',
      help: 'E.g. a separate price for international visitors. Each is its own price, never a conversion.',
      fields: [
        { name: 'label', label: 'Who it is for', type: 'text', placeholder: 'International visitor' },
        { name: 'note', label: 'Note', type: 'text', placeholder: 'Non-residents' },
        { name: 'currency', label: 'Currency', type: 'currency', options: CURRENCY_OPTIONS, default: 'USD' },
        { name: 'amount', label: 'Price', type: 'money', currencyField: 'currency' },
      ],
    },
    { name: 'minParticipants', label: 'Minimum participants', type: 'integer', min: 1, section: 'Departures' },
    {
      name: 'departures',
      label: 'Departure dates',
      type: 'repeater',
      virtual: true,
      section: 'Departures',
      help: 'Every date has its own seats, its own participant group and, optionally, its own price.',
      fields: [
        { name: 'id', label: 'id', type: 'text', readOnly: true },
        { name: 'startDate', label: 'Start date', type: 'date', required: true },
        { name: 'endDate', label: 'End date', type: 'date', required: true },
        { name: 'capacity', label: 'Seats', type: 'integer', min: 1, required: true },
        { name: 'seatsBooked', label: 'Seats taken', type: 'integer', min: 0, help: 'Applications on the site count automatically. Add places sold by WhatsApp or phone.' },
        { name: 'price', label: 'Price for this date (optional)', type: 'money', currencyField: '../currency' },
        { name: 'bookingDeadline', label: 'Apply by', type: 'date' },
        { name: 'expectedParticipants', label: 'Expected participants (budget)', type: 'integer', min: 0 },
        { name: 'status', label: 'Bookings', type: 'select', options: opts(['OPEN', 'CLOSED'], { OPEN: 'Open', CLOSED: 'Closed' }), default: 'OPEN' },
      ],
    },
    {
      name: 'itinerary',
      label: 'Itinerary',
      type: 'repeater',
      virtual: true,
      section: 'Itinerary',
      fields: [
        { name: 'title', label: 'Day title', type: 'text', required: true },
        { name: 'label', label: 'Day label', type: 'text', placeholder: 'Friday, 18 December' },
        { name: 'summary', label: 'Summary', type: 'textarea' },
        {
          name: 'stops',
          label: 'Stops',
          type: 'repeater',
          fields: [
            { name: 'name', label: 'Stop', type: 'text' },
            { name: 'detail', label: 'Detail', type: 'text' },
            { name: 'provisional', label: 'Still to be confirmed', type: 'boolean' },
          ],
        },
        { name: 'accommodation', label: 'Accommodation', type: 'text' },
      ],
    },
    { name: 'accommodation', label: 'Accommodation', type: 'textarea', max: 2000, section: 'What’s included' },
    { name: 'transport', label: 'Transport', type: 'textarea', max: 2000, section: 'What’s included' },
    { name: 'includes', label: 'Included', type: 'list', section: 'What’s included' },
    { name: 'excludes', label: 'Not included', type: 'list', section: 'What’s included' },
    { name: 'toConfirm', label: 'Still being confirmed', type: 'list', section: 'What’s included', help: 'Shown plainly, so nobody is surprised.' },
    { name: 'requirements', label: 'What to bring / requirements', type: 'list', section: 'What’s included' },
    { name: 'paymentInstructions', label: 'Payment instructions', type: 'textarea', max: 3000, section: 'Booking & payment' },
    {
      name: 'paymentOptions',
      label: 'Payment numbers for this trip',
      type: 'repeater',
      section: 'Booking & payment',
      help: 'Shown on the trip page. Leave empty to use the trip methods in Payment settings.',
      fields: [
        { name: 'method', label: 'Method', type: 'text', placeholder: 'Vodacom M-Pesa' },
        { name: 'kind', label: 'Number type', type: 'text', placeholder: 'Lipa number' },
        { name: 'number', label: 'Number', type: 'text' },
        { name: 'name', label: 'Account name', type: 'text' },
      ],
    },
    { name: 'cancellationPolicy', label: 'Cancellation & refund policy', type: 'textarea', max: 4000, section: 'Booking & payment' },
    { name: 'heroImage', label: 'Cover photo', type: 'image', required: true, section: 'Photos & video' },
    {
      name: 'galleryItems',
      label: 'Gallery',
      type: 'repeater',
      section: 'Photos & video',
      help: 'Credit photographers where the licence requires it.',
      fields: [
        { name: 'src', label: 'Photo', type: 'image' },
        { name: 'alt', label: 'Description', type: 'text' },
        { name: 'credit', label: 'Credit', type: 'text' },
        { name: 'licence', label: 'Licence', type: 'text' },
        { name: 'source', label: 'Source link', type: 'url' },
      ],
    },
    f.video(),
    { name: 'status', label: 'Status', type: 'select', options: opts(['DRAFT', 'PUBLISHED', 'ARCHIVED']), default: 'DRAFT', section: 'Visibility' },
    f.featured(),
  ],
};

export const CATERING_RESOURCE: ResourceDef = {
  key: 'catering',
  label: 'Catering package',
  plural: 'Catering & lunchboxes',
  model: 'cateringPackage',
  permission: 'catering',
  description: 'Travel lunchboxes, group catering and private chef arrangements.',
  titleField: 'title',
  slugField: 'slug',
  statusField: 'status',
  statuses: CONTENT_STATUSES,
  publishStatus: 'PUBLISHED',
  unpublishStatus: 'DRAFT',
  archiveStatus: 'ARCHIVED',
  publicPath: '/catering#{slug}',
  imageField: 'coverImage',
  columns: ['title', 'kind', 'price', 'status'],
  searchFields: ['title'],
  filters: ['status', 'kind'],
  defaultSort: { field: 'sortOrder', dir: 'asc' },
  fields: [
    f.title('Package name'),
    f.slug(),
    { name: 'kind', label: 'Service', type: 'select', options: opts(CATERING_KINDS, CATERING_KIND_LABELS), default: 'LUNCHBOX', required: true, section: 'Basics' },
    f.summary(),
    f.description(),
    {
      name: 'menu',
      label: 'Menu',
      type: 'repeater',
      section: 'Menu',
      fields: [
        { name: 'name', label: 'Item', type: 'text' },
        { name: 'description', label: 'Description', type: 'text' },
      ],
    },
    { name: 'dietaryOptions', label: 'Dietary options', type: 'tags', section: 'Menu', help: 'Vegetarian, halal, no nuts…' },
    f.currency(),
    f.money('price', 'Price', 'currency', 'Leave empty for “price on request”.'),
    { name: 'priceUnit', label: 'Price is', type: 'select', options: opts(PRICE_UNITS, PRICE_UNIT_LABELS), default: 'PER_PERSON', section: 'Price' },
    { name: 'minPeople', label: 'Minimum order (people)', type: 'integer', min: 1, section: 'Price' },
    { name: 'groupDiscounts', label: 'Group discounts', type: 'textarea', max: 1000, section: 'Price' },
    { name: 'availability', label: 'Availability', type: 'textarea', max: 1000, section: 'Availability', help: 'Only what you can commit to.' },
    { name: 'serviceAreas', label: 'Where it is available', type: 'text', max: 300, section: 'Availability' },
    { name: 'leadTime', label: 'Order notice needed', type: 'text', max: 120, section: 'Availability', placeholder: '48 hours' },
    f.cover(),
    f.gallery(),
    { name: 'sortOrder', label: 'Order on the page', type: 'integer', section: 'Visibility', default: 0 },
    { name: 'status', label: 'Status', type: 'select', options: opts(CONTENT_STATUSES), default: 'DRAFT', section: 'Visibility' },
    f.featured(),
  ],
};

export const IMPACT_RESOURCE: ResourceDef = {
  key: 'impact',
  label: 'Impact project',
  plural: 'Impact projects',
  model: 'impactProject',
  permission: 'impact',
  description: 'Community projects and outreach. Amounts raised come only from verified donations.',
  titleField: 'title',
  slugField: 'slug',
  statusField: 'status',
  statuses: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'],
  publishStatus: 'ACTIVE',
  unpublishStatus: 'DRAFT',
  archiveStatus: 'ARCHIVED',
  publicPath: '/impact/{slug}',
  imageField: 'heroImage',
  columns: ['title', 'category', 'location', 'status'],
  searchFields: ['title', 'location'],
  filters: ['status', 'category'],
  defaultSort: { field: 'updatedAt', dir: 'desc' },
  fields: [
    f.title('Project name'),
    f.slug(),
    { name: 'category', label: 'Focus', type: 'select', options: opts(IMPACT_CATEGORIES, IMPACT_CATEGORY_LABELS), default: 'COMMUNITY', section: 'Basics' },
    { name: 'summary', label: 'Purpose (short)', type: 'textarea', required: true, max: 600, section: 'Basics' },
    { name: 'description', label: 'Full story', type: 'textarea', required: true, max: 20000, section: 'Basics', wide: true },
    { name: 'beneficiaryGroup', label: 'Who it is for', type: 'text', max: 300, section: 'Basics', placeholder: 'Children at Hoyoyo village' },
    { name: 'location', label: 'Location', type: 'text', required: true, max: 200, section: 'Location' },
    { name: 'country', label: 'Country (name)', type: 'text', max: 80, section: 'Location', default: 'Tanzania' },
    { name: 'partnerName', label: 'Partner organisation', type: 'text', max: 160, section: 'Partner', placeholder: 'WSC — We Save Children' },
    { name: 'partnerNote', label: 'About the partnership', type: 'textarea', max: 1000, section: 'Partner' },
    { name: 'currency', label: 'Currency', type: 'currency', options: CURRENCY_OPTIONS, default: 'TZS', section: 'Funding' },
    { name: 'goal', label: 'Fundraising goal', type: 'money', currencyField: 'currency', section: 'Funding', help: 'Leave empty if the project is not fundraising.' },
    { name: 'beneficiaries', label: 'People the project plans to reach', type: 'integer', min: 0, section: 'Funding', help: 'A stated plan. Leave empty unless you have a real figure.' },
    { name: 'showFunding', label: 'Show verified donation totals publicly', type: 'boolean', section: 'Funding', help: 'Only switch on once donations to this project are being verified.' },
    { name: 'startedAt', label: 'Started', type: 'date', section: 'Dates' },
    { name: 'completedAt', label: 'Completed', type: 'date', section: 'Dates' },
    { name: 'heroImage', label: 'Cover photo', type: 'image', required: true, section: 'Photos & video' },
    { name: 'gallery', label: 'Gallery', type: 'gallery', section: 'Photos & video' },
    f.video(),
    { name: 'status', label: 'Status', type: 'select', options: opts(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']), default: 'DRAFT', section: 'Visibility' },
    f.featured(),
  ],
};

export const STORY_RESOURCE: ResourceDef = {
  key: 'stories',
  label: 'Story',
  plural: 'Community stories',
  model: 'story',
  permission: 'stories',
  description: 'Discoveries and experiences shared by the community. Member submissions arrive as “Pending review”.',
  titleField: 'title',
  slugField: 'slug',
  statusField: 'status',
  statuses: STORY_STATUSES,
  publishStatus: 'PUBLISHED',
  unpublishStatus: 'DRAFT',
  archiveStatus: 'ARCHIVED',
  publicPath: '/stories/{slug}',
  imageField: 'coverImage',
  columns: ['title', 'authorName', 'cityId', 'status'],
  searchFields: ['title', 'authorName'],
  filters: ['status', 'countryId'],
  defaultSort: { field: 'createdAt', dir: 'desc' },
  fields: [
    f.title(),
    f.slug(),
    { name: 'excerpt', label: 'Short summary', type: 'textarea', max: 400, section: 'Basics' },
    { name: 'body', label: 'Story', type: 'textarea', required: true, max: 20000, section: 'Basics', wide: true },
    { name: 'authorName', label: 'Written by', type: 'text', required: true, max: 120, section: 'Basics' },
    f.country(false),
    f.city(),
    f.cover(),
    f.gallery(),
    { name: 'status', label: 'Status', type: 'select', options: opts(STORY_STATUSES), default: 'DRAFT', section: 'Visibility' },
    f.featured(),
  ],
};

export const DEAL_RESOURCE: ResourceDef = {
  key: 'deals',
  label: 'Local deal',
  plural: 'Local deals',
  model: 'deal',
  permission: 'stories',
  description: 'Offers from businesses. Only publish deals the business has confirmed.',
  titleField: 'title',
  slugField: 'slug',
  statusField: 'status',
  statuses: CONTENT_STATUSES,
  publishStatus: 'PUBLISHED',
  unpublishStatus: 'DRAFT',
  archiveStatus: 'ARCHIVED',
  publicPath: '/deals#{slug}',
  imageField: 'coverImage',
  columns: ['title', 'businessName', 'validUntil', 'verified', 'status'],
  searchFields: ['title', 'businessName'],
  filters: ['status', 'countryId', 'cityId'],
  defaultSort: { field: 'createdAt', dir: 'desc' },
  fields: [
    f.title('Offer'),
    f.slug(),
    { name: 'businessName', label: 'Business', type: 'text', required: true, max: 160, section: 'Basics' },
    { name: 'placeId', label: 'Linked place', type: 'place', section: 'Basics' },
    { name: 'description', label: 'Details', type: 'textarea', max: 3000, section: 'Basics' },
    { name: 'terms', label: 'Terms', type: 'textarea', max: 2000, section: 'Basics' },
    f.country(),
    f.city(),
    { name: 'validFrom', label: 'Valid from', type: 'date', section: 'Dates' },
    { name: 'validUntil', label: 'Valid until', type: 'date', section: 'Dates' },
    { name: 'verified', label: 'Confirmed with the business', type: 'boolean', section: 'Trust' },
    f.cover(),
    { name: 'status', label: 'Status', type: 'select', options: opts(CONTENT_STATUSES), default: 'DRAFT', section: 'Visibility' },
  ],
};

export const POLL_RESOURCE: ResourceDef = {
  key: 'polls',
  label: 'Poll',
  plural: 'Community polls',
  model: 'poll',
  permission: 'stories',
  description: 'Let members vote on the next activity, trip or event.',
  titleField: 'question',
  statusField: 'status',
  statuses: POLL_STATUSES,
  publishStatus: 'OPEN',
  unpublishStatus: 'DRAFT',
  archiveStatus: 'ARCHIVED',
  publicPath: '/community#polls',
  columns: ['question', 'closesAt', 'status'],
  searchFields: ['question'],
  filters: ['status'],
  defaultSort: { field: 'createdAt', dir: 'desc' },
  fields: [
    { name: 'question', label: 'Question', type: 'text', required: true, max: 200, section: 'Basics' },
    { name: 'description', label: 'More detail', type: 'textarea', max: 1000, section: 'Basics' },
    { name: 'options', label: 'Choices', type: 'list', required: true, section: 'Basics', help: 'Two or more.' },
    f.country(false),
    f.city(),
    { name: 'closesAt', label: 'Voting closes', type: 'date', section: 'Dates' },
    { name: 'status', label: 'Status', type: 'select', options: opts(POLL_STATUSES), default: 'DRAFT', section: 'Visibility' },
  ],
};

export const CHALLENGE_RESOURCE: ResourceDef = {
  key: 'challenges',
  label: 'Local challenge',
  plural: 'Local challenges',
  model: 'challenge',
  permission: 'stories',
  description: 'Encourage people to explore — “visit three beaches this month”.',
  titleField: 'title',
  slugField: 'slug',
  statusField: 'status',
  statuses: CONTENT_STATUSES,
  publishStatus: 'PUBLISHED',
  unpublishStatus: 'DRAFT',
  archiveStatus: 'ARCHIVED',
  publicPath: '/community#challenges',
  imageField: 'coverImage',
  columns: ['title', 'cityId', 'endsAt', 'status'],
  searchFields: ['title'],
  filters: ['status', 'countryId'],
  defaultSort: { field: 'createdAt', dir: 'desc' },
  fields: [
    f.title('Challenge'),
    f.slug(),
    { name: 'description', label: 'What to do', type: 'textarea', required: true, max: 3000, section: 'Basics' },
    { name: 'howToTakePart', label: 'How to take part', type: 'textarea', max: 2000, section: 'Basics' },
    f.country(false),
    f.city(),
    { name: 'startsAt', label: 'Starts', type: 'date', section: 'Dates' },
    { name: 'endsAt', label: 'Ends', type: 'date', section: 'Dates' },
    f.cover(),
    { name: 'status', label: 'Status', type: 'select', options: opts(CONTENT_STATUSES), default: 'DRAFT', section: 'Visibility' },
  ],
};

export const BANNER_RESOURCE: ResourceDef = {
  key: 'banners',
  label: 'Banner',
  plural: 'Announcements & banners',
  model: 'banner',
  permission: 'homepage',
  description: 'A message across the top of the site or on the homepage — a new trip, an event, a notice.',
  titleField: 'message',
  statusField: 'status',
  statuses: CONTENT_STATUSES,
  publishStatus: 'PUBLISHED',
  unpublishStatus: 'DRAFT',
  archiveStatus: 'ARCHIVED',
  columns: ['message', 'placement', 'endsAt', 'status'],
  searchFields: ['message'],
  filters: ['status', 'placement'],
  defaultSort: { field: 'createdAt', dir: 'desc' },
  fields: [
    { name: 'message', label: 'Message', type: 'text', required: true, max: 200, section: 'Basics' },
    { name: 'linkLabel', label: 'Button text', type: 'text', max: 40, section: 'Basics' },
    { name: 'linkUrl', label: 'Button link', type: 'text', max: 300, section: 'Basics', placeholder: '/travel/arusha-escape' },
    { name: 'placement', label: 'Where', type: 'select', options: opts(['SITE_TOP', 'HOME'], { SITE_TOP: 'Top of every page', HOME: 'Homepage only' }), default: 'SITE_TOP', section: 'Basics' },
    { name: 'tone', label: 'Colour', type: 'select', options: opts(['NAVY', 'GOLD', 'CREAM'], { NAVY: 'Navy', GOLD: 'Gold', CREAM: 'Cream' }), default: 'NAVY', section: 'Basics' },
    { name: 'imageUrl', label: 'Image (homepage banner)', type: 'image', section: 'Basics' },
    { name: 'startsAt', label: 'Show from', type: 'date', section: 'Dates' },
    { name: 'endsAt', label: 'Show until', type: 'date', section: 'Dates' },
    { name: 'status', label: 'Status', type: 'select', options: opts(CONTENT_STATUSES), default: 'DRAFT', section: 'Visibility' },
  ],
};

export const CATEGORY_RESOURCE: ResourceDef = {
  key: 'categories',
  label: 'Category',
  plural: 'Categories',
  model: 'category',
  permission: 'catalogue',
  description: 'Activity types (sports, gaming…), place types, experience and event types, member interests.',
  titleField: 'name',
  slugField: 'slug',
  statusField: 'status',
  statuses: CONTENT_STATUSES,
  publishStatus: 'PUBLISHED',
  unpublishStatus: 'DRAFT',
  archiveStatus: 'ARCHIVED',
  columns: ['name', 'kind', 'group', 'featured', 'status'],
  searchFields: ['name', 'group'],
  filters: ['kind', 'status'],
  defaultSort: { field: 'sortOrder', dir: 'asc' },
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true, max: 80, section: 'Basics' },
    f.slug(),
    { name: 'kind', label: 'Used for', type: 'select', options: opts(CATEGORY_KINDS, CATEGORY_KIND_LABELS), required: true, default: 'ACTIVITY', section: 'Basics' },
    { name: 'group', label: 'Group', type: 'text', max: 80, section: 'Basics', placeholder: 'Sports, Console gaming…', help: 'Categories with the same group are shown together.' },
    { name: 'description', label: 'Description', type: 'textarea', max: 500, section: 'Basics' },
    { name: 'icon', label: 'Icon (emoji)', type: 'text', max: 8, section: 'Basics', placeholder: '🏀' },
    { name: 'featured', label: 'Show as a main category', type: 'boolean', section: 'Visibility' },
    { name: 'sortOrder', label: 'Order', type: 'integer', default: 100, section: 'Visibility' },
    { name: 'status', label: 'Status', type: 'select', options: opts(CONTENT_STATUSES), default: 'PUBLISHED', section: 'Visibility' },
  ],
};

export const COUNTRY_RESOURCE: ResourceDef = {
  key: 'countries',
  label: 'Country',
  plural: 'Countries',
  model: 'country',
  permission: 'catalogue',
  description: 'Every country is available. Published countries appear on the site once they have something to show.',
  titleField: 'name',
  slugField: 'slug',
  statusField: 'status',
  statuses: CONTENT_STATUSES,
  publishStatus: 'PUBLISHED',
  unpublishStatus: 'DRAFT',
  archiveStatus: 'ARCHIVED',
  publicPath: '/destinations/{slug}',
  imageField: 'heroImage',
  protectDelete: true,
  columns: ['name', 'code', 'currency', 'timezone', 'featured', 'status'],
  searchFields: ['name', 'code'],
  filters: ['status', 'region', 'featured'],
  defaultSort: { field: 'name', dir: 'asc' },
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true, max: 80, section: 'Basics' },
    { name: 'code', label: 'Country code', type: 'text', required: true, max: 2, readOnly: true, section: 'Basics' },
    f.slug(),
    { name: 'region', label: 'Region', type: 'text', max: 40, section: 'Basics' },
    { name: 'currency', label: 'Local currency', type: 'text', max: 3, section: 'Basics', help: 'Prices are still entered in the currency you choose on each listing.' },
    { name: 'timezone', label: 'Default time zone', type: 'timezone', section: 'Basics' },
    { name: 'summary', label: 'Introduction', type: 'textarea', max: 2000, section: 'Basics' },
    { name: 'heroImage', label: 'Cover photo', type: 'image', section: 'Basics' },
    { name: 'featured', label: 'Feature on the homepage globe', type: 'boolean', section: 'Visibility' },
    { name: 'status', label: 'Status', type: 'select', options: opts(CONTENT_STATUSES), default: 'PUBLISHED', section: 'Visibility' },
  ],
};

export const CITY_RESOURCE: ResourceDef = {
  key: 'cities',
  label: 'City',
  plural: 'Cities',
  model: 'city',
  permission: 'catalogue',
  description: 'Cities inside each country. Add one whenever you list something somewhere new.',
  titleField: 'name',
  slugField: 'slug',
  statusField: 'status',
  statuses: CONTENT_STATUSES,
  publishStatus: 'PUBLISHED',
  unpublishStatus: 'DRAFT',
  archiveStatus: 'ARCHIVED',
  imageField: 'heroImage',
  columns: ['name', 'countryId', 'timezone', 'featured', 'status'],
  searchFields: ['name'],
  filters: ['countryId', 'status'],
  defaultSort: { field: 'name', dir: 'asc' },
  fields: [
    { name: 'name', label: 'City', type: 'text', required: true, max: 80, section: 'Basics' },
    f.slug(),
    { name: 'countryId', label: 'Country', type: 'country', required: true, section: 'Basics' },
    { name: 'timezone', label: 'Time zone', type: 'timezone', section: 'Basics', help: 'Empty uses the country’s.' },
    { name: 'summary', label: 'Introduction', type: 'textarea', max: 2000, section: 'Basics' },
    { name: 'latitude', label: 'Latitude', type: 'number', min: -90, max: 90, section: 'Basics' },
    { name: 'longitude', label: 'Longitude', type: 'number', min: -180, max: 180, section: 'Basics' },
    { name: 'heroImage', label: 'Cover photo', type: 'image', section: 'Basics' },
    { name: 'featured', label: 'Featured city', type: 'boolean', section: 'Visibility' },
    { name: 'status', label: 'Status', type: 'select', options: opts(CONTENT_STATUSES), default: 'PUBLISHED', section: 'Visibility' },
  ],
};

export const PAYMENT_METHOD_RESOURCE: ResourceDef = {
  key: 'payment-methods',
  label: 'Payment method',
  plural: 'Payment methods',
  model: 'paymentMethod',
  permission: 'payments',
  description: 'Bank and mobile money details shown to customers and donors. Every change is logged.',
  titleField: 'name',
  statusField: 'status',
  statuses: ['ENABLED', 'DISABLED'],
  publishStatus: 'ENABLED',
  unpublishStatus: 'DISABLED',
  sensitive: true,
  columns: ['name', 'kind', 'accountNumber', 'scopes', 'isDefault', 'status'],
  searchFields: ['name', 'accountName', 'accountNumber'],
  filters: ['status', 'kind'],
  defaultSort: { field: 'sortOrder', dir: 'asc' },
  fields: [
    { name: 'name', label: 'Name shown to customers', type: 'text', required: true, max: 120, section: 'Basics', placeholder: 'Bank transfer (Selcom)' },
    { name: 'kind', label: 'Type', type: 'select', options: opts(PAYMENT_METHOD_KINDS), default: 'BANK_TRANSFER', section: 'Basics' },
    { name: 'provider', label: 'Bank or provider', type: 'text', max: 120, section: 'Account', help: 'Only what you have confirmed. Leave empty rather than guess.' },
    { name: 'accountName', label: 'Account name', type: 'text', max: 160, section: 'Account' },
    { name: 'accountNumber', label: 'Account / phone / Lipa number', type: 'text', max: 60, section: 'Account' },
    { name: 'extraDetails', label: 'Other details (branch, SWIFT…)', type: 'textarea', max: 1000, section: 'Account', help: 'Leave empty unless confirmed.' },
    { name: 'currencies', label: 'Currencies accepted', type: 'multiselect', options: CURRENCY_OPTIONS, section: 'Account' },
    { name: 'instructions', label: 'Instructions', type: 'textarea', max: 3000, section: 'Instructions', wide: true },
    { name: 'referenceFormat', label: 'Payment reference to use', type: 'text', max: 200, section: 'Instructions', placeholder: 'Your booking reference, e.g. ENH-4K7Q2M' },
    { name: 'verificationSteps', label: 'How we verify (internal)', type: 'textarea', max: 2000, private: true, section: 'Instructions' },
    { name: 'scopes', label: 'Offer it for', type: 'multiselect', options: opts(PAYMENT_SCOPES, PAYMENT_SCOPE_LABELS), section: 'Where it is used' },
    { name: 'isDefault', label: 'Default method for these', type: 'boolean', section: 'Where it is used' },
    { name: 'sortOrder', label: 'Order', type: 'integer', default: 0, section: 'Where it is used' },
    { name: 'status', label: 'Status', type: 'select', options: opts(['ENABLED', 'DISABLED']), default: 'ENABLED', section: 'Where it is used' },
  ],
};

/** Every resource the generic admin manages, in menu order. */
export const RESOURCES: ResourceDef[] = [
  TRIP_RESOURCE,
  ACTIVITY_RESOURCE,
  EVENT_RESOURCE,
  PLACE_RESOURCE,
  EXPERIENCE_RESOURCE,
  CATERING_RESOURCE,
  IMPACT_RESOURCE,
  STORY_RESOURCE,
  DEAL_RESOURCE,
  POLL_RESOURCE,
  CHALLENGE_RESOURCE,
  BANNER_RESOURCE,
  CATEGORY_RESOURCE,
  COUNTRY_RESOURCE,
  CITY_RESOURCE,
  PAYMENT_METHOD_RESOURCE,
];

export function resourceByKey(key: string): ResourceDef | undefined {
  return RESOURCES.find((resource) => resource.key === key);
}

/** Flattens a resource's fields into the ones stored on its own row. */
export function storedFields(resource: ResourceDef): FieldDef[] {
  return resource.fields.filter((field) => !field.virtual);
}

/** Lowercase, hyphenated, ASCII — "Mlimani City Run!" → "mlimani-city-run". */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}
