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
  legal: {
    terms: string;
    privacy: string;
    cancellation: string;
    safety: string;
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
}

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
  'search',
  'weekend',
  'activities',
  'people',
  'places',
  'trips',
  'events',
  'experiences',
  'catering',
  'globe',
  'stories',
  'impact',
  'updates',
] as const;
export type HomepageSectionKey = (typeof HOMEPAGE_SECTION_KEYS)[number];

export interface HomepageSection {
  key: HomepageSectionKey;
  enabled: boolean;
  title: string;
  subtitle: string;
}

export const HOMEPAGE_SECTION_LABELS: Record<HomepageSectionKey, string> = {
  search: 'Search and discovery',
  weekend: 'What’s happening this weekend',
  activities: 'Explore activities',
  people: 'Find your people',
  places: 'Discover places',
  trips: 'Upcoming Enhakkore trips',
  events: 'Upcoming events',
  experiences: 'Experiences worth trying',
  catering: 'Catering & lunchboxes',
  globe: 'Explore the world (globe)',
  stories: 'Community stories',
  impact: 'Impact projects',
  updates: 'Community updates sign-up',
};

export const DEFAULT_SETTINGS: SiteSettings = {
  brand: {
    name: 'ENHAKKORE TRAVEL & IMPACT',
    shortName: 'Enhakkore',
    slogan: 'Explore. Connect. Create impact.',
    description:
      'An international platform connecting people to destinations, experiences, events, communities and opportunities to create positive change.',
    logoUrl: '/partners/enhakkore-wordmark.webp',
    markUrl: '/partners/enhakkore-mark.webp',
    faviconUrl: '/icon.svg',
    wscLogoUrl: '/partners/wsc.webp',
    primaryColor: '',
    accentColor: '',
  },
  seo: {
    title: 'Enhakkore Travel & Impact — Explore. Connect. Create impact.',
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
      eyebrow: 'Enhakkore Travel & Impact',
      title: 'Explore. Connect. Create impact.',
      subtitle:
        'Trips, places, experiences, events and people who share your interests — in Dar es Salaam and around the world.',
      primaryLabel: 'Explore activities',
      primaryHref: '/activities',
      secondaryLabel: 'Upcoming trips',
      secondaryHref: '/travel',
      imageUrl: '/media/hero/safari-tourist-poster-v1.jpg',
      videoEnabled: true,
    },
    sections: [
      { key: 'search', enabled: true, title: 'Where to next?', subtitle: '' },
      { key: 'weekend', enabled: true, title: 'What’s happening this weekend', subtitle: 'Activities, events and experiences in the next few days.' },
      { key: 'activities', enabled: true, title: 'Explore activities', subtitle: 'Basketball, running, gaming and more — organised by the community and by Enhakkore.' },
      { key: 'trips', enabled: true, title: 'Upcoming Enhakkore trips', subtitle: 'Travel together with a small group.' },
      { key: 'events', enabled: true, title: 'Upcoming events', subtitle: 'Hosted by Enhakkore and by others we list.' },
      { key: 'people', enabled: true, title: 'Find your people', subtitle: 'Meet others who share your interests, in your city and beyond.' },
      { key: 'places', enabled: true, title: 'Discover places', subtitle: 'Hotels, restaurants, beaches and hidden gems.' },
      { key: 'experiences', enabled: true, title: 'Experiences worth trying', subtitle: '' },
      { key: 'catering', enabled: true, title: 'Good journeys deserve good food', subtitle: 'Lunchboxes, group catering and private chefs for travellers.' },
      { key: 'globe', enabled: true, title: 'Explore the world', subtitle: 'Countries with something to discover.' },
      { key: 'stories', enabled: true, title: 'Community stories', subtitle: '' },
      { key: 'impact', enabled: true, title: 'Impact', subtitle: 'Community projects, with We Save Children (WSC).' },
      { key: 'updates', enabled: true, title: 'Stay in the loop', subtitle: 'Follow us for new trips, activities and events.' },
    ],
  },
  navigation: {
    primary: [
      { label: 'Travel', href: '/travel' },
      { label: 'Discover', href: '/discover' },
      { label: 'Experiences', href: '/experiences' },
      { label: 'Catering', href: '/catering' },
      { label: 'Events', href: '/events' },
      { label: 'Activities', href: '/activities' },
      { label: 'Connect', href: '/connect' },
      { label: 'Impact', href: '/impact' },
    ],
  },
  legal: {
    terms: '',
    privacy: '',
    cancellation: '',
    safety:
      'Meet in public places, especially the first time. Tell a friend where you are going. Never share your home address or live location with people you have not met. Activities are reviewed before they are published, but Enhakkore does not supervise community-organised activities — use your own judgement, and report anything that feels wrong.',
  },
  impact: {
    donationIntro:
      'Donations support community projects carried out with We Save Children (WSC) — such as outreach days with children in villages around Dar es Salaam.',
    donationUse:
      'Donations are recorded separately from Enhakkore’s travel and business income and are used for the community project you choose, or for general outreach where none is chosen.',
    donationAccountConfirmed: false,
    wscIntro:
      'WSC — We Save Children — is a charity group working so that no child grows up in poverty. Enhakkore’s impact work is carried out together with WSC. WSC is its own organisation, not a part of Enhakkore.',
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
