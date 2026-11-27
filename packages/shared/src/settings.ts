import { LEGAL_DRAFTS, type LegalKey } from './legal';
/**
 * Website settings an administrator changes from the control centre.
 *
 * Each group is stored as one JSON value under its key. The defaults here are
 * what the site shows until someone edits a group — and they are the official
 * details supplied for Enhakkore, nothing invented: no email address, no
 * physical address and no Facebook page appear, because none was given.
 */

export interface ContactNumber {
  label: string;
  /** As people read it: "+255 745 341 440". */
  display: string;
  /** Digits only, with country code: "255745341440". */
  digits: string;
  whatsapp: boolean;
  calls: boolean;
}

export interface SocialLink {
  platform: 'instagram' | 'tiktok' | 'facebook' | 'x' | 'youtube' | 'linkedin' | 'website' | 'other';
  label: string;
  handle: string;
  url: string;
}

export interface SiteSettings {
  brand: {
    name: string;
    shortName: string;
    slogan: string;
    description: string;
    /** Full logo, emblem and wordmark. The original file supplied. */
    logoUrl: string;
    /** The emblem alone, from the same artwork. */
    markUrl: string;
    /**
     * Optional official light/gold version of the logo for dark backgrounds
     * (the phone header). Empty shows the original logo on a cream badge.
     */
    logoOnDarkUrl: string;
    faviconUrl: string;
    /** The WSC logo, used in the Impact section. The original file supplied. */
    wscLogoUrl: string;
    /** Optional colour overrides; blank keeps the design system's own. */
    primaryColor: string;
    accentColor: string;
  };
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  contact: {
    numbers: ContactNumber[];
    emails: { label: string; address: string }[];
    address: string;
    hours: string;
    /**
     * Which WhatsApp number receives each kind of enquiry, as "all", "1" or "2"
     * (the order of the numbers above). Used for automatic notices and for the
     * WhatsApp buttons on those pages.
     */
    routing: Record<string, string>;
  };
  social: SocialLink[];
  /** Prefilled WhatsApp messages. `{title}` is replaced with the page's subject. */
  whatsapp: Record<WhatsAppContext, string>;
  launch: {
    /** Where the community launch focuses. Visitors elsewhere still see everything. */
    countryCode: string;
    citySlug: string;
    cityName: string;
  };
  homepage: {
    hero: {
      eyebrow: string;
      title: string;
      subtitle: string;
      primaryLabel: string;
      primaryHref: string;
      secondaryLabel: string;
      secondaryHref: string;
      imageUrl: string;
      videoEnabled: boolean;
    };
    sections: HomepageSection[];
  };
  navigation: {
    primary: { label: string; href: string }[];
  };
  legal: Record<LegalKey, string> & {
    /** Tick only after a lawyer has reviewed the pages. Until then each page is marked as a draft. */
    reviewed: boolean;
  };
  impact: {
    donationIntro: string;
    donationUse: string;
    /** Must stay false until the account is confirmed as authorised for the stated project. */
    donationAccountConfirmed: boolean;
    wscIntro: string;
  };
  catering: {
    intro: string;
  };
  gaming: {
    /** The Gaming hub's hero picture. Replace it with your own photo from the media library. */
    heroImage: string;
    heroTitle: string;
    heroSubtitle: string;
  };
  /** The homepage globe's Locate mode: which categories appear, their names and order. */
  globe: {
    categories: { key: GlobeCategoryKey; label: string; enabled: boolean }[];
  };
  /** Pictures at the top of the main category pages. */
  pages: {
    exploreHeroImage: string;
    experiencesHeroImage: string;
    travelHeroImage: string;
    impactHeroImage: string;
  };
}

export const GLOBE_CATEGORY_KEYS = ['all', 'experiences', 'travel', 'sports', 'gaming', 'events', 'food', 'stays', 'venues', 'attractions', 'communities', 'impact'] as const;
export type GlobeCategoryKey = (typeof GLOBE_CATEGORY_KEYS)[number];

export const WHATSAPP_CONTEXTS = [
  'general',
  'trip',
  'privateTrip',
  'event',
  'place',
  'experience',
  'activityHost',
  'activityJoin',
  'catering',
  'privateChef',
  'donation',
  'listing',
] as const;
export type WhatsAppContext = (typeof WHATSAPP_CONTEXTS)[number];

export const HOMEPAGE_SECTION_KEYS = [
  'explore',
  'experiences',
  'happening',
  'trips',
  'destinations',
  'purpose',
  'impact',
  'review',
  'join',
  'partner',
] as const;
export type HomepageSectionKey = (typeof HOMEPAGE_SECTION_KEYS)[number];

export interface HomepageSection {
  key: HomepageSectionKey;
  enabled: boolean;
  title: string;
  subtitle: string;
}

export const HOMEPAGE_SECTION_LABELS: Record<HomepageSectionKey, string> = {
  explore: 'Explore our world (category picture tiles)',
  experiences: 'Upcoming experiences',
  happening: 'What’s happening now (trending)',
  trips: 'Upcoming trips',
  destinations: 'Featured destinations',
  purpose: 'Travel with purpose (banner)',
  impact: 'Enhakkore Impact (banner)',
  review: 'Discover & review (places)',
  join: 'Join the Enhakkore community',
  partner: 'Partner with Enhakkore',
};

/** Older saved orders used different keys; map them, then add any new sections. */
const OLD_SECTION_KEYS: Record<string, HomepageSectionKey> = { discover: 'explore', upcoming: 'experiences', trending: 'happening' };
export function normaliseHomepageSections(stored: { key: string; enabled: boolean; title: string; subtitle: string }[] | undefined): HomepageSection[] {
  const defaults = DEFAULT_SETTINGS.homepage.sections;
  const out: HomepageSection[] = [];
  for (const row of stored ?? []) {
    const key = (HOMEPAGE_SECTION_KEYS as readonly string[]).includes(row.key) ? (row.key as HomepageSectionKey) : OLD_SECTION_KEYS[row.key];
    if (!key || out.some((item) => item.key === key)) continue;
    const fallback = defaults.find((item) => item.key === key)!;
    out.push(key === row.key ? { ...fallback, ...row, key } : { ...fallback, enabled: row.enabled });
  }
  for (const section of defaults) if (!out.some((item) => item.key === section.key)) out.push(section);
  return out;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  brand: {
    name: 'ENHAKKORE TRAVEL & IMPACT',
    shortName: 'Enhakkore',
    slogan: 'Travel Further. Connect Deeper. Create Impact.',
    description:
      'An international platform connecting people to destinations, experiences, events, communities and opportunities to create positive change.',
    logoUrl: '/partners/enhakkore-wordmark.webp',
    markUrl: '/partners/enhakkore-mark.webp',
    logoOnDarkUrl: '',
    faviconUrl: '/brand/refined/favicon-32.png',
    wscLogoUrl: '/partners/wsc.webp',
    primaryColor: '',
    accentColor: '',
  },
  seo: {
    title: 'Enhakkore Travel & Impact — Travel Further. Connect Deeper. Create Impact.',
    description:
      'Discover trips, places, experiences, events and community activities around the world, meet people who share your interests, and support real community projects.',
    keywords: ['travel', 'experiences', 'events', 'Dar es Salaam', 'Tanzania', 'community activities', 'group trips', 'social impact'],
  },
  contact: {
    numbers: [
      { label: 'Primary', display: '+255 745 341 440', digits: '255745341440', whatsapp: true, calls: true },
      { label: 'Second line', display: '+255 794 279 089', digits: '255794279089', whatsapp: true, calls: true },
    ],
    emails: [],
    address: '',
    hours: '',
    routing: { TRIP: 'all', ROOM: 'all', TABLE: 'all', EVENT_PLAN: 'all', PARTNERSHIP: 'all', PRIVATE_TRIP: 'all', CATERING: 'all', PRIVATE_CHEF: 'all', GENERAL: 'all' },
  },
  social: [
    {
      platform: 'instagram',
      label: 'Enhakkore Travel',
      handle: '@enhakkoretravel',
      url: 'https://www.instagram.com/enhakkoretravel',
    },
    {
      platform: 'instagram',
      label: 'Enhakkore Impact',
      handle: '@enhakkore.impact',
      url: 'https://www.instagram.com/enhakkore.impact',
    },
    {
      platform: 'instagram',
      label: 'WSC — We Save Children',
      handle: '@_wsc2022',
      url: 'https://www.instagram.com/_wsc2022',
    },
    {
      platform: 'tiktok',
      label: 'Enhakkore Travel',
      handle: '@enhakkore.travel',
      url: 'https://www.tiktok.com/@enhakkore.travel',
    },
  ],
  whatsapp: {
    general: 'Hello Enhakkore, I found you on your website and I have a question.',
    trip: 'Hello Enhakkore, I am interested in the trip "{title}". Could you tell me about availability and how to book?',
    privateTrip: 'Hello Enhakkore, I would like to plan a private trip. Here is what I have in mind:',
    event: 'Hello Enhakkore, I am interested in the event "{title}". Could you share details on tickets?',
    place: 'Hello Enhakkore, I would like to ask about "{title}" that I saw on your website.',
    experience: 'Hello Enhakkore, I am interested in the experience "{title}". Is it available, and how do I book?',
    activityHost:
      'Hello Enhakkore, I would like to host an activity and have it listed on your website. Please send me the submission requirements.',
    activityJoin: 'Hello Enhakkore, I would like to join the activity "{title}".',
    catering: 'Hello Enhakkore, I would like to order catering / lunchboxes. Here are the details:',
    privateChef: 'Hello Enhakkore, I would like to ask about a private chef. Here are my dates and location:',
    donation:
      'Hello Enhakkore, I have made a donation and would like to send my payment confirmation for verification.',
    listing: 'Hello Enhakkore, I would like to list my business on Enhakkore Discover.',
  },
  launch: {
    countryCode: 'TZ',
    citySlug: 'dar-es-salaam',
    cityName: 'Dar es Salaam',
  },
  homepage: {
    hero: {
      eyebrow: 'Travel · Experiences · Community · Impact',
      title: 'Explore Experiences. Create Impact.',
      subtitle:
        'Discover remarkable places, join activities, travel with purpose and connect with people across Tanzania and beyond.',
      primaryLabel: 'Explore Now',
      primaryHref: '/explore',
      secondaryLabel: 'Discover Experiences',
      secondaryHref: '/experiences',
      imageUrl: '/media/hero/safari-tourist-poster-v1.jpg',
      videoEnabled: true,
    },
    sections: [
      { key: 'explore', enabled: true, title: 'Explore Enhakkore', subtitle: 'Places, experiences, trips and impact — start with what moves you.' },
      { key: 'experiences', enabled: true, title: 'Upcoming Experiences', subtitle: '' },
      { key: 'happening', enabled: true, title: 'What’s Happening Now', subtitle: 'What members are viewing, saving and joining.' },
      { key: 'trips', enabled: true, title: 'Upcoming Trips', subtitle: '' },
      { key: 'destinations', enabled: true, title: 'Featured Destinations', subtitle: '' },
      { key: 'purpose', enabled: true, title: 'Travel With Purpose', subtitle: 'Trips, safaris, getaways and unforgettable experiences across Tanzania and beyond.' },
      { key: 'review', enabled: true, title: 'Discover & Review', subtitle: 'Hotels, restaurants, cafés and places worth knowing — reviews come only from members.' },
      { key: 'impact', enabled: true, title: 'Enhakkore Impact', subtitle: 'Community projects for children and families — including WSC, We Save Children.' },
      { key: 'join', enabled: true, title: 'Join the Enhakkore Community', subtitle: 'Meet people, join communities, take part in activities and create real experiences together.' },
      { key: 'partner', enabled: true, title: 'Partner With Enhakkore', subtitle: 'List your hotel, restaurant, venue or experience and reach more people.' },
    ],
  },
  navigation: {
    primary: [
      { label: 'Explore', href: '/explore' },
      { label: 'Experiences', href: '/experiences' },
      { label: 'Travel', href: '/travel' },
      { label: 'Impact', href: '/impact' },
    ],
  },
  legal: { ...LEGAL_DRAFTS, reviewed: false },
  impact: {
    donationIntro:
      'Donations support Enhakkore Impact’s community projects, including WSC — We Save Children — such as outreach days with children in villages around Dar es Salaam.',
    donationUse:
      'Donations are recorded separately from Enhakkore’s travel and business income and are used for the community project you choose, or for general outreach where none is chosen.',
    donationAccountConfirmed: false,
    wscIntro:
      'WSC — We Save Children — is an initiative within Enhakkore Impact, working so that no child grows up in poverty.',
  },
  globe: {
    categories: [
      { key: 'all', label: 'All Activities', enabled: true },
      { key: 'experiences', label: 'Experiences', enabled: true },
      { key: 'travel', label: 'Travel & Trips', enabled: true },
      { key: 'sports', label: 'Sports & Fitness', enabled: true },
      { key: 'gaming', label: 'Gaming & Esports', enabled: true },
      { key: 'events', label: 'Events & Parties', enabled: true },
      { key: 'food', label: 'Food & Dining', enabled: true },
      { key: 'stays', label: 'Stays & Hotels', enabled: true },
      { key: 'venues', label: 'Venues', enabled: true },
      { key: 'attractions', label: 'Places & Attractions', enabled: true },
      { key: 'communities', label: 'Communities', enabled: true },
      { key: 'impact', label: 'Impact', enabled: true },
    ],
  },
  pages: {
    exploreHeroImage: '/packages/arusha/arusha-city.webp',
    experiencesHeroImage: '/packages/arusha/chemka-2.webp',
    travelHeroImage: '/packages/arusha/mount-meru.webp',
    impactHeroImage: '/impact/mkuranga/cover.webp',
  },
  gaming: {
    heroImage: '/media/gaming/gaming-hero.jpg',
    heroTitle: 'Game. Compete. Connect.',
    heroSubtitle: 'Tournaments, gaming sessions and gaming communities — every tournament free to enter at launch.',
  },
  catering: {
    intro:
      'Good journeys deserve good food. Enhakkore prepares packed lunchboxes for road trips, safaris and hikes, caters for groups and events, and — on request — arranges a private chef. Menus, prices and availability are confirmed with you directly.',
  },
};

export type SettingsGroup = keyof SiteSettings;
export const SETTINGS_GROUPS = Object.keys(DEFAULT_SETTINGS) as SettingsGroup[];

/** Groups whose changes need an explicit confirmation and are flagged in the audit log. */
export const SENSITIVE_SETTINGS: SettingsGroup[] = ['contact', 'social', 'impact', 'brand'];

/** Which permission edits each group. */
export const SETTINGS_PERMISSION: Record<SettingsGroup, string> = {
  brand: 'settings.edit',
  seo: 'settings.edit',
  contact: 'settings.edit',
  social: 'settings.edit',
  whatsapp: 'settings.edit',
  launch: 'settings.edit',
  homepage: 'homepage.edit',
  navigation: 'homepage.edit',
  legal: 'settings.edit',
  impact: 'impact.edit',
  catering: 'catering.edit',
  gaming: 'gaming.edit',
  globe: 'homepage.edit',
  pages: 'homepage.edit',
};

/** A wa.me link with a prefilled message. Digits only; the message is URL-encoded. */
export function whatsappLink(digits: string, message?: string): string {
  const clean = digits.replace(/\D/g, '');
  return message ? `https://wa.me/${clean}?text=${encodeURIComponent(message)}` : `https://wa.me/${clean}`;
}

/** Fills `{title}` in a message template. */
export function fillMessage(template: string, title?: string | null): string {
  return template.replace(/\{title\}/g, title ?? '');
}

/** Deep-merges stored settings over the defaults, so a new field never arrives undefined. */
export function mergeSettings(stored: Partial<Record<SettingsGroup, unknown>>): SiteSettings {
  const out = structuredCloneSafe(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
  for (const group of SETTINGS_GROUPS) {
    const value = stored[group];
    if (value === undefined || value === null) continue;
    const base = out[group];
    if (Array.isArray(base) || Array.isArray(value) || typeof base !== 'object') {
      out[group] = value;
    } else {
      out[group] = { ...(base as object), ...(value as object) };
    }
  }
  return out as unknown as SiteSettings;
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
