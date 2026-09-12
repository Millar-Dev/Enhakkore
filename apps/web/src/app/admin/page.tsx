'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PlatformStats } from '@enhakkore/shared';
import { DashboardShell, ADMIN_NAV } from '@/components/layout/DashboardShell';
import { Alert, Card, DemoBadge, Icon, Skeleton, StatTile, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { price } from '@/lib/format';

interface Queue {
  organizers: number;
  trips: number;
  requests: number;
  failedPayments: number;
}

export default function AdminOverview() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statsResult, queueResult] = await Promise.all([
          api.get<PlatformStats>('/admin/stats'),
          api.get<Queue>('/admin/queue'),
        ]);
        if (cancelled) return;
        setStats(statsResult);
        setQueue(queueResult);
      } catch {
        /* the shell renders; tiles show placeholders */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const queueItems = [
    {
      label: 'Organizers awaiting verification',
      count: queue?.organizers ?? 0,
      href: '/admin/organizers?status=PENDING',
      urgent: true,
    },
    {
      label: 'Trips awaiting review',
      count: queue?.trips ?? 0,
      href: '/admin/trips?status=PENDING_REVIEW',
      urgent: true,
    },
    { label: 'New custom trip requests', count: queue?.requests ?? 0, href: '/admin/requests' },
    { label: 'Failed payments', count: queue?.failedPayments ?? 0, href: '/admin/payments?status=FAILED' },
  ];

  return (
    <DashboardShell nav={ADMIN_NAV} allow={['ADMIN']} title="Platform overview" wide>
      {stats?.isDemoData && (
        <Alert tone="neutral" className="mb-8">
          <span className="inline-flex items-center gap-2">
            <DemoBadge />
            The database contains seeded demonstration content. Every figure below includes it.
          </span>
        </Alert>
      )}

      {/* Work queue leads — this is what an admin opens the console to do. */}
      <h2 className="mb-4 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
        Needs your attention
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {queueItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card
              className={cx(
                'flex h-full items-center justify-between gap-4 p-5 transition-all hover:shadow-[--shadow-card]',
                item.count > 0 && item.urgent && 'border-clay-100 bg-clay-50/40',
              )}
            >
              <div className="min-w-0">
                <p className="text-[0.875rem] font-semibold leading-snug">{item.label}</p>
              </div>
              <span
                className={cx(
                  'shrink-0 text-[1.75rem] font-bold leading-none tracking-tight',
                  item.count > 0 ? (item.urgent ? 'text-clay-600' : 'text-ink') : 'text-ink-faint',
                )}
              >
                {queue ? item.count : '—'}
              </span>
            </Card>
          </Link>
        ))}
      </div>

      {/* Platform */}
      <h2 className="mb-4 mt-10 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
        Platform
      </h2>
      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Total users"
              value={stats.totalUsers.toLocaleString('en-GB')}
              hint={`${stats.totalTravellers.toLocaleString('en-GB')} travellers`}
            />
            <StatTile
              label="Active organizers"
              value={stats.activeOrganizers}
              hint={stats.pendingOrganizers > 0 ? `${stats.pendingOrganizers} pending review` : 'none pending'}
            />
            <StatTile
              label="Published trips"
              value={stats.publishedTrips}
              hint={stats.pendingTrips > 0 ? `${stats.pendingTrips} awaiting review` : 'none pending'}
            />
            <StatTile label="Bookings" value={stats.totalBookings.toLocaleString('en-GB')} />
          </div>

          <h2 className="mb-4 mt-10 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
            Money
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Gross booking value"
              value={price(stats.grossBookingValue, true)}
              hint="confirmed and completed bookings"
            />
            <StatTile
              label="Platform revenue"
              value={price(stats.platformRevenue, true)}
              tone="brand"
              hint="commission earned"
            />
            <StatTile
              label="Impact contributions"
              value={price(stats.impactContributions, true)}
              tone="impact"
              hint="no commission taken"
            />
            <StatTile
              label="Communities reached"
              value={stats.communitiesReached}
              hint={`across ${stats.projectsSupported} projects`}
            />
          </div>

          {/* Commission model, stated where it is being measured. */}
          <Card className="mt-8 p-6">
            <h3 className="text-[0.9375rem] font-bold tracking-tight">How revenue is calculated</h3>
            <p className="mt-2 max-w-3xl text-[0.875rem] leading-relaxed text-ink-muted">
              Platform revenue is commission on the travel value of confirmed bookings, at each
              organizer&rsquo;s negotiated rate (10% by default). Impact contributions are excluded from the
              commission base entirely and pass through to projects in full. Cancelled and refunded bookings
              reverse their commission rather than being deleted, so historical reporting stays correct.
            </p>
          </Card>
        </>
      )}

      {/* Shortcuts */}
      <h2 className="mb-4 mt-10 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
        Manage
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/admin/organizers', label: 'Organizers', body: 'Verify, reject, suspend and set commission rates.', icon: Icon.shield },
          { href: '/admin/trips', label: 'Trips', body: 'Review submitted listings and feature the best ones.', icon: Icon.compass },
          { href: '/admin/impact', label: 'Impact projects', body: 'Create projects and publish progress updates.', icon: Icon.ripple },
          { href: '/admin/payments', label: 'Payments', body: 'Transactions, failures, refunds and commission.', icon: Icon.ticket },
        ].map((item) => {
          const ItemIcon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="h-full p-5 transition-all hover:shadow-[--shadow-card]">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[0.625rem] bg-sand text-ink-soft">
                  <ItemIcon size={19} />
                </span>
                <h3 className="mt-4 text-[0.9375rem] font-bold tracking-tight">{item.label}</h3>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-muted">{item.body}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </DashboardShell>
  );
}
