'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ConversationDto } from '@enhakkore/shared';
import { DashboardShell, ORGANIZER_NAV } from '@/components/layout/DashboardShell';
import { Badge, ButtonLink, Card, EmptyState, Icon, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { dateRange, daysUntil, timeAgo } from '@/lib/format';

/**
 * Organizer view of their trip groups.
 *
 * Same conversations the travellers see — an organizer is a member of every
 * group for a departure they run, with the added ability to post announcements.
 */
export default function OrganizerMessagesPage() {
  const [groups, setGroups] = useState<ConversationDto[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.get<{ items: ConversationDto[] }>('/conversations');
        if (!cancelled) setGroups(result.items);
      } catch {
        if (!cancelled) setGroups([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardShell nav={ORGANIZER_NAV} allow={['ORGANIZER']} title="Messages">
      <p className="-mt-4 mb-8 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-muted">
        Each departure with confirmed bookings has its own group. Your messages carry an organizer badge,
        and announcements notify everyone travelling.
      </p>

      {groups === null ? (
        <div className="space-y-4">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Icon.chat size={34} />}
          title="No trip groups yet"
          description="A group is created the first time someone books a departure. Once travellers join, this is where you talk to them."
          action={
            <ButtonLink href="/organizer/trips">
              Manage my trips
              <Icon.arrow />
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const countdown = daysUntil(group.departure.startDate);
            return (
              <Link key={group.id} href={`/account/groups/${group.id}`} className="block">
                <Card className="flex gap-4 p-3 transition-all hover:border-line-strong hover:shadow-[--shadow-card]">
                  <div className="media relative h-20 w-20 shrink-0 rounded-[0.625rem] sm:h-24 sm:w-24">
                    <Image src={group.heroImage} alt="" fill sizes="96px" className="object-cover" />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-1">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="truncate text-[1rem] font-bold tracking-tight">{group.title}</h2>
                      {group.unreadCount > 0 && (
                        <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-acacia-600 px-2 text-[0.6875rem] font-bold text-white">
                          {group.unreadCount}
                        </span>
                      )}
                    </div>

                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-ink-muted">
                      <span>{dateRange(group.departure.startDate, group.departure.endDate)}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {group.departure.seatsBooked}/{group.departure.capacity} travellers
                      </span>
                      {countdown !== null && countdown <= 14 && (
                        <Badge tone="impact">{countdown === 0 ? 'Today' : `${countdown}d`}</Badge>
                      )}
                    </p>

                    {group.lastMessage ? (
                      <p className="truncate text-[0.8125rem] text-ink-soft">
                        <span className="font-semibold">{group.lastMessage.author.name}:</span>{' '}
                        {group.lastMessage.body}
                        <span className="ml-2 text-ink-faint">{timeAgo(group.lastMessage.createdAt)}</span>
                      </p>
                    ) : (
                      <p className="truncate text-[0.8125rem] italic text-ink-faint">
                        No messages yet — say hello to your travellers
                      </p>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
