'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConversationDetail, MessageDto, TripDetail } from '@enhakkore/shared';
import { Logo } from '@/components/brand/Logo';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  Divider,
  EmptyState,
  Icon,
  Skeleton,
  cx,
} from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { dateRange, daysUntil, formatDate, timeAgo } from '@/lib/format';
import { useSession } from '@/lib/session';

type Tab = 'chat' | 'overview' | 'members' | 'itinerary' | 'documents';

const TABS: { id: Tab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'itinerary', label: 'Itinerary' },
  { id: 'documents', label: 'Documents' },
];

/**
 * A trip's private group.
 *
 * Access is decided by the API — a traveller without a confirmed booking on this
 * departure gets a 404, not a login prompt. Messages are fetched over REST and
 * then kept current by polling; the socket layer exists on the server and this
 * client is written so swapping the poll for it changes one function.
 */
export default function TripGroupPage() {
  const params = useParams<{ id: string }>();
  const { user, status } = useSession();

  const [tab, setTab] = useState<Tab>('chat');
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [announcement, setAnnouncement] = useState(false);
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const loadMessages = useCallback(async () => {
    const result = await api.get<{ items: MessageDto[] }>(`/conversations/${params.id}/messages?limit=80`);
    setMessages(result.items);
  }, [params.id]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;

    (async () => {
      try {
        const detail = await api.get<ConversationDetail>(`/conversations/${params.id}`);
        if (cancelled) return;
        setConversation(detail);
        await loadMessages();

        const tripDetail = await api.get<TripDetail>(`/trips/${detail.tripSlug}`, { token: null });
        if (!cancelled) setTrip(tripDetail);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : 'We could not open this trip group.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.id, status, loadMessages]);

  // Poll while the tab is visible. Cheap, predictable, and it stops when the
  // user is not looking — the socket transport is the upgrade path.
  useEffect(() => {
    if (!conversation || tab !== 'chat') return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void loadMessages().catch(() => undefined);
    }, 8000);
    return () => clearInterval(timer);
  }, [conversation, tab, loadMessages]);

  // Only auto-scroll when the reader is already at the bottom — yanking someone
  // away from a message they are reading is worse than a missed scroll.
  useEffect(() => {
    if (tab !== 'chat' || !atBottomRef.current) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, tab]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    try {
      const message = await api.post<MessageDto>(`/conversations/${params.id}/messages`, {
        body,
        kind: announcement ? 'ANNOUNCEMENT' : 'TEXT',
      });
      setMessages((current) => [...current, message]);
      setDraft('');
      atBottomRef.current = true;
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Your message did not send.');
    } finally {
      setSending(false);
    }
  }

  const grouped = useMemo(() => groupByDay(messages), [messages]);
  const countdown = conversation ? daysUntil(conversation.departure.startDate) : null;

  if (error) {
    return (
      <GroupFrame>
        <div className="shell-narrow py-20">
          <EmptyState
            icon={<Icon.chat size={34} />}
            title="This trip group is not available"
            description={error}
            action={
              <ButtonLink href="/account/groups" variant="secondary">
                Back to my groups
              </ButtonLink>
            }
          />
        </div>
      </GroupFrame>
    );
  }

  if (!conversation) {
    return (
      <GroupFrame>
        <div className="shell py-10">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="mt-6 h-96 w-full" />
        </div>
      </GroupFrame>
    );
  }

  return (
    <GroupFrame>
      {/* Trip banner */}
      <div className="relative">
        <div className="media relative h-40 md:h-56">
          <Image
            src={conversation.heroImage}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 scrim" />
        </div>

        <div className="shell relative -mt-16 pb-0">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <Link
                href={`/trips/${conversation.tripSlug}`}
                className="text-[1.5rem] font-bold leading-tight tracking-tight text-white hover:underline md:text-[2rem]"
              >
                {conversation.title}
              </Link>
              <p className="mt-1.5 text-[0.875rem] font-medium text-white/80">
                {dateRange(conversation.departure.startDate, conversation.departure.endDate)} ·{' '}
                {conversation.memberCount} {conversation.memberCount === 1 ? 'member' : 'members'}
              </p>
            </div>
            {countdown !== null && countdown <= 30 && (
              <Badge tone="dark" className="mb-1 bg-white text-ink">
                {countdown === 0 ? 'Departing today' : `${countdown} days to go`}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-16 z-30 mt-6 border-b border-line bg-white/95 backdrop-blur-xl">
        <div className="shell flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? 'page' : undefined}
              className={cx(
                'shrink-0 border-b-2 px-3.5 py-3 text-[0.875rem] font-semibold transition-colors',
                tab === item.id ? 'border-ink text-ink' : 'border-transparent text-ink-muted hover:text-ink',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="shell py-6 md:py-8">
        {tab === 'chat' && (
          <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
            <div className="flex min-h-[32rem] flex-col rounded-[--radius-card] border border-line bg-white">
              {/* Pinned */}
              {conversation.pinned.length > 0 && (
                <div className="border-b border-line bg-clay-50/50 p-4">
                  {conversation.pinned.map((message) => (
                    <div key={message.id} className="flex gap-3">
                      <Icon.pin size={15} className="mt-0.5 shrink-0 text-clay-600" />
                      <div className="min-w-0">
                        <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-clay-600">
                          Pinned by {message.author.name}
                        </p>
                        <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-soft">{message.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div
                ref={scrollRef}
                onScroll={(event) => {
                  const element = event.currentTarget;
                  atBottomRef.current =
                    element.scrollHeight - element.scrollTop - element.clientHeight < 80;
                }}
                className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6"
                style={{ maxHeight: '60vh' }}
              >
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center py-16 text-center">
                    <div>
                      <Icon.chat size={30} className="mx-auto text-ink-faint" />
                      <p className="mt-4 text-[0.9375rem] font-semibold">No messages yet</p>
                      <p className="mt-1.5 text-[0.875rem] text-ink-muted">
                        Say hello — you are travelling with these people.
                      </p>
                    </div>
                  </div>
                ) : (
                  grouped.map(([day, items]) => (
                    <div key={day}>
                      <div className="my-4 flex items-center gap-3">
                        <Divider className="flex-1" />
                        <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-faint">
                          {day}
                        </span>
                        <Divider className="flex-1" />
                      </div>
                      <div className="space-y-4">
                        {items.map((message) => (
                          <MessageRow
                            key={message.id}
                            message={message}
                            mine={message.author.id === user?.id}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Composer */}
              {conversation.canPost ? (
                <form onSubmit={send} className="border-t border-line p-3 md:p-4">
                  {conversation.viewerIsOrganizer && (
                    <label className="mb-2.5 inline-flex cursor-pointer items-center gap-2 text-[0.8125rem] font-medium text-ink-muted">
                      <input
                        type="checkbox"
                        checked={announcement}
                        onChange={(event) => setAnnouncement(event.target.checked)}
                        className="h-4 w-4 accent-clay-500"
                      />
                      Post as an announcement — everyone gets notified
                    </label>
                  )}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        // Enter sends, Shift+Enter breaks the line.
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void send(event as unknown as React.FormEvent);
                        }
                      }}
                      rows={1}
                      placeholder={
                        announcement ? 'Write an announcement for the group…' : 'Write a message…'
                      }
                      className="max-h-32 min-h-12 flex-1 resize-none rounded-[--radius-field] border border-line-strong px-3.5 py-3 text-[0.9375rem] leading-snug focus:border-acacia-600 focus:outline-none focus:ring-4 focus:ring-acacia-600/10"
                    />
                    <Button
                      type="submit"
                      disabled={sending || draft.trim().length === 0}
                      className="shrink-0"
                      variant={announcement ? 'impact' : 'primary'}
                    >
                      {sending ? 'Sending…' : 'Send'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="border-t border-line p-4">
                  <Alert tone="neutral">
                    You have read access to this group for moderation. Only travellers on this departure and
                    the organizer can post.
                  </Alert>
                </div>
              )}
            </div>

            {/* Group context */}
            <aside className="space-y-5">
              <Card className="p-5">
                <h2 className="text-[0.8125rem] font-bold tracking-tight">This departure</h2>
                <dl className="mt-4 space-y-3 text-[0.8125rem]">
                  <div>
                    <dt className="text-ink-muted">Dates</dt>
                    <dd className="mt-0.5 font-semibold">
                      {dateRange(conversation.departure.startDate, conversation.departure.endDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Travellers</dt>
                    <dd className="mt-0.5 font-semibold">
                      {conversation.departure.seatsBooked} of {conversation.departure.capacity}
                    </dd>
                  </div>
                </dl>
                <ButtonLink
                  href={`/trips/${conversation.tripSlug}`}
                  variant="secondary"
                  size="sm"
                  full
                  className="mt-5"
                >
                  Trip details
                </ButtonLink>
              </Card>

              <Card className="p-5">
                <h2 className="text-[0.8125rem] font-bold tracking-tight">
                  Members ({conversation.members.length})
                </h2>
                <ul className="mt-4 space-y-3">
                  {conversation.members.slice(0, 8).map((member) => (
                    <li key={member.id} className="flex items-center gap-3">
                      <Avatar name={member.name} src={member.avatarUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem] font-semibold">{member.name}</p>
                        {member.country && (
                          <p className="truncate text-[0.75rem] text-ink-muted">{member.country}</p>
                        )}
                      </div>
                      {member.role === 'ORGANIZER' && <Badge tone="brand">Organizer</Badge>}
                    </li>
                  ))}
                </ul>
                {conversation.members.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setTab('members')}
                    className="mt-4 text-[0.8125rem] font-semibold text-acacia-700 hover:underline"
                  >
                    See all {conversation.members.length} members
                  </button>
                )}
              </Card>
            </aside>
          </div>
        )}

        {tab === 'overview' && trip && (
          <div className="mx-auto max-w-3xl">
            <h2 className="text-h2">{trip.title}</h2>
            <div className="prose-body mt-5">
              {trip.description.split('\n\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            <Card className="mt-8 p-6">
              <h3 className="text-[0.9375rem] font-bold tracking-tight">What&rsquo;s included</h3>
              <ul className="mt-4 space-y-2.5">
                {trip.includes.map((item) => (
                  <li key={item} className="flex gap-3 text-[0.875rem] text-ink-soft">
                    <Icon.check size={16} className="mt-0.5 shrink-0 text-acacia-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {tab === 'members' && (
          <div className="mx-auto max-w-3xl">
            <h2 className="text-h2">Who&rsquo;s coming</h2>
            <p className="mt-2 text-[0.9375rem] text-ink-muted">
              {conversation.members.length} people on this departure. Only names, photos and countries are
              shared here — nothing else from anyone&rsquo;s account.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {conversation.members.map((member) => (
                <Card key={member.id} className="flex items-center gap-4 p-4">
                  <Avatar name={member.name} src={member.avatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-bold tracking-tight">{member.name}</p>
                    <p className="truncate text-[0.8125rem] text-ink-muted">
                      {member.country ?? 'Traveller'} · joined {formatDate(member.joinedAt)}
                    </p>
                  </div>
                  {member.role === 'ORGANIZER' && <Badge tone="brand">Organizer</Badge>}
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab === 'itinerary' && trip && (
          <div className="mx-auto max-w-3xl">
            <h2 className="text-h2">Day by day</h2>
            <ol className="mt-8 space-y-6">
              {trip.itinerary.map((day) => (
                <li key={day.id} className="rounded-[--radius-card] border border-line bg-white p-6">
                  <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-ink-faint">
                    Day {day.dayNumber}
                  </p>
                  <h3 className="mt-1.5 text-[1.0625rem] font-bold tracking-tight">{day.title}</h3>
                  {day.summary && <p className="mt-2 text-[0.875rem] text-ink-muted">{day.summary}</p>}
                  <ul className="mt-4 space-y-2">
                    {day.activities.map((activity, index) => (
                      <li key={index} className="flex gap-3 text-[0.875rem] text-ink-soft">
                        <span className="mt-[0.5rem] h-1 w-1 shrink-0 rounded-full bg-line-strong" />
                        {activity}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        )}

        {tab === 'documents' && (
          <div className="mx-auto max-w-3xl">
            <EmptyState
              icon={<Icon.ticket size={32} />}
              title="No documents yet"
              description="Your organizer can share kit lists, permits and joining instructions here. File sharing is not connected in this build — the group chat is the place to ask for anything you need in the meantime."
              action={
                <Button variant="secondary" onClick={() => setTab('chat')}>
                  Go to chat
                </Button>
              }
            />
          </div>
        )}
      </div>
    </GroupFrame>
  );
}

/* -------------------------------------------------------------------------- */

function MessageRow({ message, mine }: { message: MessageDto; mine: boolean }) {
  if (message.kind === 'SYSTEM') {
    return (
      <p className="text-center text-[0.8125rem] italic leading-relaxed text-ink-muted">{message.body}</p>
    );
  }

  const isAnnouncement = message.kind === 'ANNOUNCEMENT';

  return (
    <div className={cx('flex gap-3', mine && 'flex-row-reverse')}>
      <Avatar name={message.author.name} src={message.author.avatarUrl} size="sm" className="mt-0.5" />

      <div className={cx('min-w-0 max-w-[80%]', mine && 'items-end text-right')}>
        <div className={cx('flex items-center gap-2', mine && 'flex-row-reverse')}>
          <span className="text-[0.8125rem] font-bold">{mine ? 'You' : message.author.name}</span>
          {message.author.isOrganizer && <Badge tone="brand">Organizer</Badge>}
          <span className="text-[0.6875rem] text-ink-faint">{timeAgo(message.createdAt)}</span>
        </div>

        <div
          className={cx(
            'mt-1.5 inline-block rounded-[--radius-card] px-4 py-2.5 text-left text-[0.9375rem] leading-relaxed',
            isAnnouncement
              ? 'border border-clay-100 bg-clay-50 text-ink-soft'
              : mine
                ? 'bg-ink text-white'
                : 'bg-sand text-ink-soft',
          )}
        >
          {isAnnouncement && (
            <p className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-clay-600">
              Announcement
            </p>
          )}
          <p className="whitespace-pre-wrap">{message.body}</p>
        </div>
      </div>
    </div>
  );
}

function groupByDay(messages: MessageDto[]): [string, MessageDto[]][] {
  const groups = new Map<string, MessageDto[]>();
  for (const message of messages) {
    const date = new Date(message.createdAt);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86_400_000);

    let key: string;
    if (date.toDateString() === today.toDateString()) key = 'Today';
    else if (date.toDateString() === yesterday.toDateString()) key = 'Yesterday';
    else key = formatDate(date, 'long');

    const existing = groups.get(key);
    if (existing) existing.push(message);
    else groups.set(key, [message]);
  }
  return [...groups.entries()];
}

function GroupFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-xl">
        <div className="shell flex h-16 items-center justify-between">
          <Link href="/" aria-label="Enhakkore — home">
            <Logo size="sm" />
          </Link>
          <Link
            href="/account/groups"
            className="text-[0.875rem] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            All groups
          </Link>
        </div>
      </header>
      <main id="main">{children}</main>
    </div>
  );
}
