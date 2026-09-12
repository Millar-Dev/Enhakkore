'use client';

import { useEffect, useState } from 'react';
import type { TripSummary } from '@enhakkore/shared';
import { DashboardShell, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { TripCard } from '@/components/trips/TripCard';
import { ButtonLink, EmptyState, Icon, TripCardSkeleton } from '@/components/ui';
import { api } from '@/lib/api';

export default function SavedPage() {
  const [trips, setTrips] = useState<TripSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.get<{ items: TripSummary[] }>('/me/saved');
        if (!cancelled) setTrips(result.items);
      } catch {
        if (!cancelled) setTrips([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={['TRAVELER', 'ORGANIZER', 'ADMIN']} title="Saved trips">
      {trips === null ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <TripCardSkeleton key={index} />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <EmptyState
          icon={<Icon.heart size={34} />}
          title="Nothing saved yet"
          description="Save trips you are considering and they will wait for you here — useful when you are comparing dates or waiting on a friend to decide."
          action={
            <ButtonLink href="/trips">
              Explore trips
              <Icon.arrow />
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
