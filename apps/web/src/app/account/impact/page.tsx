'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { DonationDto, TravellerStats } from '@enhakkore/shared';
import { DashboardShell, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { ProjectMini } from '@/components/impact/ProjectCard';
import { ButtonLink, Card, EmptyState, Icon, Skeleton, StatTile } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, price } from '@/lib/format';

export default function MyImpactPage() {
  const [donations, setDonations] = useState<DonationDto[] | null>(null);
  const [stats, setStats] = useState<TravellerStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [donationResult, statsResult] = await Promise.all([
          api.get<{ items: DonationDto[] }>('/me/donations'),
          api.get<TravellerStats>('/me/stats'),
        ]);
        if (cancelled) return;
        setDonations(donationResult.items);
        setStats(statsResult);
      } catch {
        if (!cancelled) setDonations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // One entry per project, so the list reads as "what you support" rather than
  // a transaction log.
  const byProject = (donations ?? []).reduce<Record<string, { project: DonationDto['project']; total: number; count: number; latest: string }>>(
    (accumulator, donation) => {
      const existing = accumulator[donation.project.id];
      if (existing) {
        existing.total += donation.amount.amount;
        existing.count += 1;
        if (donation.createdAt > existing.latest) existing.latest = donation.createdAt;
      } else {
        accumulator[donation.project.id] = {
          project: donation.project,
          total: donation.amount.amount,
          count: 1,
          latest: donation.createdAt,
        };
      }
      return accumulator;
    },
    {},
  );

  const projects = Object.values(byProject).sort((a, b) => b.total - a.total);

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={['TRAVELER', 'ORGANIZER', 'ADMIN']} title="Your impact">
      <p className="-mt-4 mb-8 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-muted">
        Everything you have contributed, and where it went. You will get a notification whenever one of
        these projects publishes an update.
      </p>

      {donations === null ? (
        <div className="space-y-5">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : donations.length === 0 ? (
        <EmptyState
          icon={<Icon.ripple size={34} />}
          title="You have not contributed yet"
          description="You can add a contribution at checkout when you book a trip, or support any project directly. There is no minimum, and Enhakkore takes no commission on contributions."
          action={
            <ButtonLink href="/impact" variant="impact">
              Browse impact projects
              <Icon.arrow />
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Total contributed"
              value={stats ? price(stats.impactContributed) : '—'}
              tone="impact"
            />
            <StatTile label="Projects supported" value={projects.length} />
            <StatTile label="Contributions" value={donations.length} />
          </div>

          <h2 className="mt-10 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
            Projects you support
          </h2>
          <div className="mt-4 space-y-4">
            {projects.map((entry) => (
              <div key={entry.project.id}>
                <ProjectMini project={entry.project} />
                <p className="mt-2 pl-1 text-[0.8125rem] text-ink-muted">
                  You contributed{' '}
                  <span className="font-semibold text-clay-600">
                    {price({ amount: entry.total, currency: entry.project.goal.currency })}
                  </span>{' '}
                  {entry.count > 1 && `across ${entry.count} contributions `}· latest{' '}
                  {formatDate(entry.latest, 'long')} ·{' '}
                  <Link
                    href={`/impact/${entry.project.slug}`}
                    className="font-semibold text-acacia-700 hover:underline"
                  >
                    see updates
                  </Link>
                </p>
              </div>
            ))}
          </div>

          <h2 className="mt-12 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
            All contributions
          </h2>
          <Card className="mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[0.875rem]">
                <thead className="border-b border-line bg-sand/50">
                  <tr>
                    <th scope="col" className="px-5 py-3 text-[0.75rem] font-semibold text-ink-muted">
                      Date
                    </th>
                    <th scope="col" className="px-5 py-3 text-[0.75rem] font-semibold text-ink-muted">
                      Project
                    </th>
                    <th scope="col" className="px-5 py-3 text-[0.75rem] font-semibold text-ink-muted">
                      Booking
                    </th>
                    <th scope="col" className="px-5 py-3 text-right text-[0.75rem] font-semibold text-ink-muted">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {donations.map((donation) => (
                    <tr key={donation.id} className="border-b border-line last:border-0">
                      <td className="whitespace-nowrap px-5 py-3.5 text-ink-muted">
                        {formatDate(donation.createdAt, 'long')}
                      </td>
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/impact/${donation.project.slug}`}
                          className="font-medium hover:text-acacia-700"
                        >
                          {donation.project.title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[0.8125rem] text-ink-faint">
                        {donation.bookingReference ?? 'Direct'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums text-clay-600">
                        {price(donation.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </DashboardShell>
  );
}
