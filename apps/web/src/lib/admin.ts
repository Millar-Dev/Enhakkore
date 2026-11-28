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
      { href: '/admin', label: 'Website overview', permission: '', keywords: 'dashboard home alerts' },
      { href: '/admin/enquiries', label: 'All enquiries', permission: 'enquiries.view', keywords: 'messages support contact requests' },
      { href: '/admin/enquiries?type=ROOM', label: 'Hotel enquiries', permission: 'enquiries.view', keywords: 'rooms stays accommodation booking' },
      { href: '/admin/enquiries?type=TABLE', label: 'Restaurant reservations', permission: 'enquiries.view', keywords: 'table booking dining' },
      { href: '/admin/enquiries?type=EVENT_PLAN', label: 'Event-planning requests', permission: 'enquiries.view', keywords: 'party wedding planning quote' },
      { href: '/admin/applications', label: 'Trip applications', permission: 'bookings.view', keywords: 'bookings payments confirm participants' },
      { href: '/admin/registrations', label: 'Event registrations', permission: 'events.view', keywords: 'tickets check-in door' },
      { href: '/admin/moderation', label: 'Reviews & reports', permission: 'reviews.view', keywords: 'safety block report moderation' },
    ],
  },
  {
    title: 'Explore',
    items: [
      resource('places', 'Explore listings', 'hotels restaurants venues attractions businesses'),
      { href: '/admin/enquiries?type=PARTNERSHIP', label: 'Business partnerships', permission: 'enquiries.view', keywords: 'list business apply promote' },
      resource('agreements', 'Partner agreements', 'commission sponsored referral contract'),
      resource('deals', 'Local deals', 'offers'),
    ],
  },
  {
    title: 'Experiences',
    items: [
      resource('activities', 'Events & activities', 'basketball running jogging sessions submissions approve'),
      resource('events', 'Ticketed events', 'parties tickets'),
      resource('communities', 'Communities', 'groups meetups members announcements'),
      { href: '/admin/r/communities?kind=STUDY_GROUP', label: 'Study groups', permission: 'communities.view', keywords: 'study learning students school university moderation' },
      resource('tournaments', 'Gaming & tournaments', 'free fire pubg efootball console esports'),
      resource('experiences', 'Guided experiences', 'tours cooking'),
      resource('catering', 'Catering & lunchboxes', 'food menu chef'),
      { href: '/admin/organisers', label: 'Organiser applications', permission: 'experiences.view', keywords: 'host organise organiser approve verify identity' },
      { href: '/account/scanner', label: 'Check-in scanner & passes', permission: 'events.view', keywords: 'qr pass scan entrance attendance check-in offline' },
    ],
  },
  {
    title: 'Travel & Impact',
    items: [
      resource('trips', 'Travel — trips', 'prices dates departures itinerary stage'),
      { href: '/admin/payments', label: 'Payments & receipts', permission: 'bookings.view', keywords: 'deposit receipt verify approve reject mobile money arusha' },
      { href: '/admin/chats', label: 'Group chats', permission: 'trips.view', keywords: 'chat messages group moderation archive trip event community' },
      resource('impact', 'Impact / WSC projects', 'charity wsc outreach volunteer'),
      { href: '/admin/donations', label: 'Donations', permission: 'donations.view', keywords: 'charity give selcom' },
    ],
  },
  {
    title: 'Content',
    items: [
      { href: '/admin/assistant', label: 'AI Assistant (Bethany & Ariel)', permission: '*', keywords: 'ai assistant bethany ariel report help automate' },
      { href: '/admin/settings?group=homepage', label: 'Homepage editor', permission: 'homepage.view', keywords: 'hero sections order headline' },
      resource('banners', 'Banners & announcements'),
      resource('stories', 'Community stories'),
      resource('polls', 'Polls'),
      resource('challenges', 'Local challenges'),
      { href: '/admin/media', label: 'Media library', permission: 'media.view', keywords: 'photos videos images upload logos' },
      resource('categories', 'Categories & games', 'sports gaming types sections games'),
      resource('countries', 'Countries', 'international'),
      resource('cities', 'Cities'),
    ],
  },
  {
    title: 'Money & reports',
    items: [
      { href: '/admin/finance', label: 'Finance', permission: 'finance.view', keywords: 'income expenses profit reports export csv excel' },
      resource('payment-methods', 'Payment settings', 'bank mobile money mpesa account number'),
      { href: '/admin/analytics', label: 'Reports & analytics', permission: 'analytics.view', keywords: 'popular views visitors trending statistics' },
    ],
  },
  {
    title: 'People & settings',
    items: [
      { href: '/admin/members', label: 'Member management', permission: 'members.view', keywords: 'users accounts suspend customers' },
      { href: '/admin/staff', label: 'Team & permissions', permission: 'staff.view', keywords: 'staff roles invite access' },
      { href: '/admin/notifications', label: 'Notifications', permission: 'enquiries.view', keywords: 'whatsapp email delivery sent failed' },
      { href: '/admin/settings?group=contact', label: 'Contacts & social', permission: 'settings.view', keywords: 'whatsapp phone instagram tiktok email address' },
      { href: '/admin/settings', label: 'Website settings', permission: 'settings.view', keywords: 'brand logo seo legal terms privacy navigation menu' },
      { href: '/admin/settings?group=legal', label: 'Policies', permission: 'settings.view', keywords: 'terms privacy cookie gaming donation partner legal' },
      { href: '/admin/security', label: 'Security & audit', permission: 'security.view', keywords: 'sessions logins history log' },
      { href: '/admin/help', label: 'Help & manual', permission: '', keywords: 'manual guide instructions how to help pdf' },
      { href: '/admin/two-factor', label: 'My two-factor sign-in', permission: '', keywords: '2fa authenticator code security' },
    ],
  },
];

export function visibleMenu(user: PublicUser | null | undefined): MenuGroup[] {
  return MENU.map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || can(user, item.permission)) })).filter(
    (group) => group.items.length > 0,
  );
}

export const SETTINGS_SEARCH = SETTINGS_GROUPS;
