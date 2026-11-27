import type { Listing } from '@/lib/public';
import type { TripListing } from '@/components/public/listings';
import type { Project } from '@/components/public/impact';

export interface HomeData {
  launch: { countryCode: string; citySlug: string; cityName: string };
  weekend: { zone: string; start: string; end: string; city: { name: string; slug: string } | null; activities: Listing[]; events: Listing[]; experiences: Listing[] };
  activities: Listing[];
  events: Listing[];
  experiences: Listing[];
  places: Listing[];
  trips: TripListing[];
  pastTrips: TripListing[];
  stories: Listing[];
  impact: Project[];
  catering: Listing[];
  whatsNew: { kind: string; title: string; href: string; at: string; image: string | null }[];
}

/** One upcoming thing in Experiences — an activity, an event or a gaming tournament. */
export interface UpcomingCard {
  kind: string;
  id: string;
  subjectType: string;
  title: string;
  href: string;
  image: string | null;
  startsAt: string | null;
  where: string;
  recurrence?: string | null;
  category?: string | null;
  free?: boolean;
  popularity?: number;
  isDemo?: boolean;
}

export interface CommunityCard {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  coverImage: string | null;
  memberCount: number;
  isDemo?: boolean;
  chatEnabled?: boolean;
  accessType?: 'FREE' | 'PAID' | 'PRIVATE' | string;
  membershipPrice?: number | null;
  membershipCurrency?: string | null;
  membershipPeriod?: string | null;
  membershipBenefits?: string | null;
  membershipTerms?: string | null;
  city?: { name: string } | null;
  country?: { name: string } | null;
  category?: { name: string; icon?: string | null } | null;
}

export interface HubData {
  sections: { key: string; label: string; icon: string; blurb: string; count: number }[];
  upcoming: UpcomingCard[];
  popular: UpcomingCard[];
  communities: CommunityCard[];
  guided: Listing[];
}

export interface TrendingItem {
  kind: string;
  title: string;
  href: string;
  where: string;
  image: string | null;
  startsAt?: string | null;
  sponsored?: boolean;
  subjectId: string;
  popularity: number;
}
