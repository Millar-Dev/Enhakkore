import type { ImpactProjectSummary, OrganizerSummary, TripSummary } from '@enhakkore/shared';

/**
 * Keeping demonstration content off the public site.
 *
 * The development seed marks every record it creates, so it can be told apart
 * from anything real. These helpers are the single place that knows how, and
 * every public listing runs through them — if a new page forgets, that is the
 * one thing to look for.
 *
 * This hides the seed rather than deleting it. The rows are still in the
 * database, which is deliberate: hiding is reversible in a second, and the
 * demo operators, bookings and conversations are what the development and
 * test environments run on. Clearing them out of the live database properly
 * is a separate, destructive job.
 */

export function isRealTrip(trip: TripSummary): boolean {
  // A trip carries no flag of its own; the seed marks the operator behind it.
  return !trip.organizer?.isDemo;
}

export function isRealProject(project: ImpactProjectSummary): boolean {
  return !project.isDemo;
}

export function isRealOperator(operator: OrganizerSummary): boolean {
  return !operator.isDemo;
}

/** Filters a list of trips, tolerating a failed request. */
export function realTrips(items: TripSummary[] | undefined | null): TripSummary[] {
  return (items ?? []).filter(isRealTrip);
}

/** Filters a list of impact projects, tolerating a failed request. */
export function realProjects(items: ImpactProjectSummary[] | undefined | null): ImpactProjectSummary[] {
  return (items ?? []).filter(isRealProject);
}
