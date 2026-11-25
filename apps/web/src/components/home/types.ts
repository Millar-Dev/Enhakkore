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
