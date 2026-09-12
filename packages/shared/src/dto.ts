/**
 * Wire shapes returned by the API. The web app imports these instead of
 * re-declaring response types, so a serializer change is a compile error rather
 * than a runtime surprise.
 */

import type {
  BookingStatus,
  DepartureStatus,
  ImpactCategory,
  MessageKind,
  NotificationType,
  PaymentMethod,
  PaymentStatus,
  ProjectStatus,
  RequestStatus,
  Role,
  TravelStyle,
  TripStatus,
  TripType,
  UserStatus,
  VerificationStatus,
} from './domain';
import type { Money } from './money';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  avatarUrl: string | null;
  country: string | null;
  city: string | null;
  bio: string | null;
  createdAt: string;
  organizerId: string | null;
}

/** A fellow traveller as shown on a trip page — deliberately minimal. */
export interface TravellerBadge {
  id: string;
  name: string;
  avatarUrl: string | null;
  country: string | null;
}

export interface OrganizerSummary {
  id: string;
  companyName: string;
  slug: string;
  logoUrl: string | null;
  country: string | null;
  city: string | null;
  verificationStatus: VerificationStatus;
  rating: number | null;
  reviewCount: number;
  tripCount: number;
  yearFounded: number | null;
  /** True when the record was created by the demo seed rather than a real signup. */
  isDemo: boolean;
}

export interface OrganizerDetail extends OrganizerSummary {
  tagline: string | null;
  bio: string | null;
  coverUrl: string | null;
  websiteUrl: string | null;
  languages: string[];
  responseTimeHours: number | null;
  memberSince: string;
}

export interface DestinationSummary {
  id: string;
  name: string;
  slug: string;
  country: string;
  region: string | null;
  continent: string;
  summary: string | null;
  heroImage: string | null;
  tripCount?: number;
}

export interface ItineraryDayDto {
  id: string;
  dayNumber: number;
  title: string;
  summary: string | null;
  activities: string[];
  accommodation: string | null;
  meals: string[];
}

export interface TripDateDto {
  id: string;
  startDate: string;
  endDate: string;
  capacity: number;
  seatsBooked: number;
  seatsRemaining: number;
  status: DepartureStatus;
  price: Money;
}

export interface TripSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: TripType;
  style: TravelStyle;
  status: TripStatus;
  durationDays: number;
  durationNights: number;
  fromPrice: Money;
  heroImage: string;
  rating: number | null;
  reviewCount: number;
  tags: string[];
  destination: DestinationSummary;
  organizer: OrganizerSummary;
  nextDeparture: TripDateDto | null;
  totalSeats: number;
  totalBooked: number;
  impactProjectId: string | null;
}

export interface TripDetail extends TripSummary {
  description: string;
  gallery: string[];
  includes: string[];
  excludes: string[];
  requirements: string[];
  difficulty: string | null;
  minAge: number | null;
  itinerary: ItineraryDayDto[];
  departures: TripDateDto[];
  organizerDetail: OrganizerDetail;
  travellers: TravellerBadge[];
  reviews: ReviewDto[];
  impactProject: ImpactProjectSummary | null;
}

export interface ReviewDto {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  photos: string[];
  createdAt: string;
  author: TravellerBadge;
  tripTitle?: string;
}

export interface BookingTravellerDto {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
}

export interface BookingDto {
  id: string;
  reference: string;
  status: BookingStatus;
  travellers: number;
  tripAmount: Money;
  impactAmount: Money;
  totalAmount: Money;
  platformFee: Money;
  createdAt: string;
  trip: TripSummary;
  departure: TripDateDto;
  travellerDetails: BookingTravellerDto[];
  impactProject: ImpactProjectSummary | null;
  payment: PaymentDto | null;
  conversationId: string | null;
  reviewed: boolean;
}

export interface PaymentDto {
  id: string;
  method: PaymentMethod;
  provider: string;
  providerRef: string | null;
  status: PaymentStatus;
  amount: Money;
  createdAt: string;
  /** True when settled by the mock gateway rather than a real PSP. */
  simulated: boolean;
}

export interface ImpactProjectSummary {
  id: string;
  slug: string;
  title: string;
  category: ImpactCategory;
  status: ProjectStatus;
  location: string;
  country: string;
  summary: string;
  heroImage: string;
  goal: Money;
  raised: Money;
  progress: number;
  contributorCount: number;
  isDemo: boolean;
}

export interface AllocationLine {
  label: string;
  /** Share of contributions earmarked for this line, 0–100. */
  percent: number;
  note?: string;
}

export interface ImpactUpdateDto {
  id: string;
  title: string;
  body: string;
  images: string[];
  milestone: boolean;
  publishedAt: string;
}

export interface ImpactProjectDetail extends ImpactProjectSummary {
  description: string;
  gallery: string[];
  allocation: AllocationLine[];
  updates: ImpactUpdateDto[];
  partnerName: string | null;
  partnerNote: string | null;
  startedAt: string | null;
  completedAt: string | null;
  linkedTrips: TripSummary[];
  recentContributions: {
    id: string;
    amount: Money;
    createdAt: string;
    donorName: string | null;
    message: string | null;
  }[];
}

export interface DonationDto {
  id: string;
  amount: Money;
  status: PaymentStatus;
  createdAt: string;
  anonymous: boolean;
  message: string | null;
  project: ImpactProjectSummary;
  bookingReference: string | null;
}

export interface MessageDto {
  id: string;
  body: string;
  kind: MessageKind;
  attachments: string[];
  pinned: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
    role: Role;
    /** True when the author organises this trip — drives the organizer badge. */
    isOrganizer: boolean;
  };
}

export interface ConversationMemberDto extends TravellerBadge {
  role: 'ORGANIZER' | 'TRAVELER' | 'ADMIN';
  joinedAt: string;
}

export interface ConversationDto {
  id: string;
  title: string;
  tripId: string;
  tripSlug: string;
  departure: TripDateDto;
  heroImage: string;
  memberCount: number;
  unreadCount: number;
  lastMessage: MessageDto | null;
}

export interface ConversationDetail extends ConversationDto {
  members: ConversationMemberDto[];
  pinned: MessageDto[];
  canPost: boolean;
  viewerIsOrganizer: boolean;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface CustomTripRequestDto {
  id: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  travellers: number;
  budget: Money | null;
  style: TravelStyle;
  accommodation: string | null;
  activities: string[];
  notes: string | null;
  status: RequestStatus;
  createdAt: string;
  contactName: string;
  contactEmail: string;
}

export interface TravellerStats {
  tripsCompleted: number;
  upcomingTrips: number;
  destinationsVisited: number;
  countriesVisited: number;
  impactContributed: Money;
  projectsSupported: number;
}

export interface OrganizerStats {
  activeTrips: number;
  pendingTrips: number;
  totalBookings: number;
  upcomingTravellers: number;
  grossRevenue: Money;
  netRevenue: Money;
  platformFees: Money;
  averageRating: number | null;
  impactRaised: Money;
}

export interface PlatformStats {
  totalUsers: number;
  totalTravellers: number;
  activeOrganizers: number;
  pendingOrganizers: number;
  publishedTrips: number;
  pendingTrips: number;
  totalBookings: number;
  grossBookingValue: Money;
  platformRevenue: Money;
  impactContributions: Money;
  projectsSupported: number;
  communitiesReached: number;
  /** Set while the database is seeded with demo content. */
  isDemoData: boolean;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
  organizer: OrganizerSummary | null;
}
