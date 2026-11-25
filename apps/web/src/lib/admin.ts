import { hasPermission, RESOURCES, SETTINGS_GROUPS } from '@enhakkore/shared';
import type { PublicUser } from '@enhakkore/shared';

export function can(user: PublicUser | null | undefined, permission: string): boolean {
  return !!user && hasPermission(user.permissions ?? [], permission);
}

export interface MenuItem {
  href: string;
  label: string;
  permission: string;
  /** Words that find this page from the settings search box. */
  keywords?: string;
}

export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const resource = (key: string, label?: string, keywords?: string): MenuItem => {
  const def = RESOURCES.find((item) => item.key === key)!;
  return { href: `/admin/r/${key}`, label: label ?? def.plural, permission: `${def.permission}.view`, keywords };
};

/** The control centre's menu. Each item shows only to people whose role covers it. */
export const MENU: MenuGroup[] = [
  {
    title: 'Today',
    items: [
      { href: '/admin', label: 'Overview', permission: '', keywords: 'dashboard home alerts' },
      { href: '/admin/enquiries', label: 'Enquiries inbox', permission: 'enquiries.view', keywords: 'messages support contact requests' },
      { href: '/admin/applications', label: 'Trip applications', permission: 'bookings.view', keywords: 'bookings payments confirm participants' },
      { href: '/admin/registrations', label: 'Event registrations', permission: 'events.view', keywords: 'tickets check-in door' },
      { href: '/admin/moderation', label: 'Reviews & reports', permission: 'reviews.view', keywords: 'safety block report moderation' },
    ],
  },
  {
    title: 'Content',
    items: [
      resource('trips', 'Travel — trips', 'prices dates departures itinerary'),
      resource('activities', 'Activities', 'basketball running gaming submissions approve'),
      resource('events', 'Events', 'parties tickets'),
      resource('places', 'Discover — places', 'hotels restaurants beaches businesses'),
      resource('experiences', 'Experiences', 'tours cooking'),
      resource('catering', 'Catering & lunchboxes', 'food menu chef'),
      resource('impact', 'Impact projects', 'charity wsc outreach'),
      resource('stories', 'Community stories'),
      resource('polls', 'Polls'),
      resource('challenges', 'Local challenges'),
      resource('deals', 'Local deals', 'offers'),
      { href: '/admin/media', label: 'Media library', permission: 'media.view', keywords: 'photos videos images upload' },
    ],
  },
  {
    title: 'Website',
    items: [
      { href: '/admin/settings?group=homepage', label: 'Homepage', permission: 'homepage.view', keywords: 'hero sections order headline' },
      resource('banners', 'Banners & announcements'),
      { href: '/admin/settings?group=contact', label: 'Contacts & social', permission: 'settings.view', keywords: 'whatsapp phone instagram tiktok email address' },
      { href: '/admin/settings', label: 'All settings', permission: 'settings.view', keywords: 'brand logo seo legal terms privacy navigation' },
      resource('categories', 'Categories', 'sports gaming types'),
      resource('countries', 'Countries', 'international'),
      resource('cities', 'Cities'),
    ],
  },
  {
    title: 'Money',
    items: [
      { href: '/admin/finance', label: 'Finance', permission: 'finance.view', keywords: 'income expenses profit reports export csv excel' },
      { href: '/admin/donations', label: 'Donations', permission: 'donations.view', keywords: 'charity give selcom' },
      resource('payment-methods', 'Payment settings', 'bank mobile money mpesa account number'),
    ],
  },
  {
    title: 'People',
    items: [
      { href: '/admin/members', label: 'Customers & members', permission: 'members.view', keywords: 'users accounts suspend' },
      { href: '/admin/staff', label: 'Staff & roles', permission: 'staff.view', keywords: 'permissions team access' },
      { href: '/admin/security', label: 'Security & audit', permission: 'security.view', keywords: 'sessions logins history log' },
    ],
  },
];

/** The older marketplace screens (tour operators), owner only. */
export const LEGACY: MenuItem[] = [
  { href: '/admin/organizers', label: 'Tour operators', permission: '*' },
  { href: '/admin/trips', label: 'Operator trips', permission: '*' },
  { href: '/admin/bookings', label: 'Checkout bookings', permission: '*' },
  { href: '/admin/requests', label: 'Custom trip requests', permission: '*' },
];

export function visibleMenu(user: PublicUser | null | undefined): MenuGroup[] {
  return MENU.map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || can(user, item.permission)) })).filter(
    (group) => group.items.length > 0,
  );
}

export const SETTINGS_SEARCH = SETTINGS_GROUPS;
