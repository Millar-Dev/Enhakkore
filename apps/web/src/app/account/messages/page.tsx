'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { Avatar, EmptyState } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { useQueryParam } from '@/lib/useApi';

interface Item {
  id: string;
  member: { id: string; name: string; username: string | null; avatarUrl: string | null; available: boolean };
  incomingRequest: boolean;
  waitingForThem: boolean;
  muted: boolean;
  unread: number;
  lastMessage: { mine: boolean; preview: string; createdAt: string } | null;
  updatedAt: string;
}
interface Person { id: string; name: string; username: string | null; avatarUrl: string | null }

const BOXES = [
  { key: 'all', label: 'All' },
  { key: 'requests', label: 'Requests' },
  { key: 'archived', label: 'Archived' },
] as const;

function when(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * My Messages — the permanent one-to-one inbox. Requests from people who are
 * not yet accepted sit in their own tab; archived conversations in another.
 */
export default function MessagesPage() {
  const boxParam = useQueryParam('box');
  const [box, setBox] = useState<'all' | 'requests' | 'archived'>('all');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[] | null>(null);
  const [requests, setRequests] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [search, setSearch] = useState<{ conversationId: string; preview: string; createdAt: string }[] | null>(null);

  useEffect(() => {
    if (boxParam === 'requests' || boxParam === 'archived') setBox(boxParam);
  }, [boxParam]);

  // Only the latest request may update the list (a slower earlier one must not overwrite it).
  const latest = useRef(0);
  const load = useCallback(async () => {
    const ticket = ++latest.current;
    try {
      const data = await api.get<{ items: Item[]; counts: { requests: number } }>(`/messages?box=${box}&q=${encodeURIComponent(q)}`);
      if (ticket !== latest.current) return;
      setItems(data.items);
      setRequests(data.counts.requests);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load your messages.');
    }
  }, [box, q]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), q ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, q]);

  async function openPicker() {
    setPicker(true);
    if (people) return;
    // People you can message: friends and members who follow you back.
    const [friends, follows] = await Promise.all([
      api.get<{ friends: { member: Person }[] }>('/social/friends').catch(() => ({ friends: [] })),
      api.get<{ following: (Person & { mutual: boolean })[] }>('/social/follows').catch(() => ({ following: [] })),
    ]);
    const map = new Map<string, Person>();
    for (const row of friends.friends) map.set(row.member.id, row.member);
    for (const row of follows.following) if (row.mutual) map.set(row.id, row);
    setPeople([...map.values()]);
  }

  async function start(userId: string) {
    try {
      const result = await api.post<{ id: string }>('/messages/start', { userId });
      window.location.href = `/account/messages/${result.id}`;
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not start the conversation.');
      setPicker(false);
    }
  }

  async function searchMessages() {
    if (q.trim().length < 2) return;
    const data = await api.get<{ items: { conversationId: string; preview: string; createdAt: string }[] }>(`/messages/search?q=${encodeURIComponent(q.trim())}`).catch(() => ({ items: [] }));
    setSearch(data.items);
  }

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title="My Messages">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search messages</span>
            <input
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setSearch(null);
              }}
              onKeyDown={(event) => event.key === 'Enter' && void searchMessages()}
              placeholder="Search people or press Enter to search messages…"
              className="h-11 w-full rounded-full border border-line bg-white pl-4 pr-10 text-[0.9375rem] outline-none focus:border-acacia-600"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden>⌕</span>
          </label>
          <button type="button" onClick={openPicker} className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full bg-clay-400 px-4 text-sm font-bold text-acacia-700" aria-label="New message">
            ✎ <span className="hidden sm:inline">New</span>
          </button>
        </div>

        <div className="mt-4 flex gap-2" role="tablist" aria-label="Inbox">
          {BOXES.map((item) => (
            <button key={item.key} type="button" role="tab" aria-selected={box === item.key} onClick={() => setBox(item.key)} className={`chip ${box === item.key ? 'chip-active' : ''}`}>
              {item.label}
              {item.key === 'requests' && requests > 0 && <span className="ml-1 rounded-full bg-clay-400 px-1.5 text-[0.6875rem] font-bold text-acacia-700">{requests}</span>}
            </button>
          ))}
        </div>

        {error && <p role="status" className="mt-4 rounded-xl bg-sand p-3 text-sm text-ink-soft">{error}</p>}

        {search && (
          <section className="mt-4 rounded-2xl border border-line bg-white p-4">
            <h2 className="text-sm font-bold">Messages matching “{q}”</h2>
            {search.length === 0 ? <p className="mt-2 text-sm text-ink-muted">No messages found.</p> : (
              <ul className="mt-2 grid gap-2">
                {search.map((hit, index) => (
                  <li key={index}><Link href={`/account/messages/${hit.conversationId}`} className="block rounded-xl bg-sand px-3 py-2 text-sm">{hit.preview}<span className="block text-xs text-ink-muted">{when(hit.createdAt)}</span></Link></li>
                ))}
              </ul>
            )}
          </section>
        )}

        {box === 'requests' && <p className="mt-4 text-sm text-ink-muted">Message requests come from members who follow you and whom you follow back. Accept to reply; declining is private — they are not told.</p>}

        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {items === null ? (
            <li className="p-4 text-sm text-ink-muted">Loading…</li>
          ) : items.length === 0 ? (
            <li className="p-2">
              <EmptyState
                className="border-0 bg-transparent py-10"
                title={box === 'requests' ? 'No message requests' : box === 'archived' ? 'Nothing archived' : 'No conversations yet'}
                description={box === 'all' ? 'You can message your friends, and members who follow you back. Find people in Gaming Hub → Game Friends or on their profile.' : undefined}
              />
            </li>
          ) : (
            items.map((item) => (
              <li key={item.id}>
                <Link href={`/account/messages/${item.id}`} className="flex min-h-[4.5rem] items-center gap-3 px-4 py-3 hover:bg-sand">
                  <Avatar name={item.member.name} src={item.member.avatarUrl} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{item.member.username ? `@${item.member.username}` : item.member.name}</span>
                      <span className="shrink-0 text-xs text-ink-muted">{when(item.updatedAt)}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${item.unread ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
                        {item.incomingRequest ? 'Wants to message you' : item.waitingForThem ? 'Request sent — waiting for them to accept' : item.lastMessage ? `${item.lastMessage.mine ? 'You: ' : ''}${item.lastMessage.preview}` : 'No messages yet'}
                      </span>
                      {item.unread > 0 && <span className="min-w-6 shrink-0 rounded-full bg-clay-400 px-2 text-center text-xs font-bold leading-6 text-acacia-700">{item.unread}</span>}
                      {item.muted && <span className="shrink-0 text-xs text-ink-faint" aria-label="Muted">🔕</span>}
                    </span>
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>

      {picker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="New message" onClick={() => setPicker(false)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">New message</h2>
              <button type="button" onClick={() => setPicker(false)} className="h-10 w-10 rounded-full hover:bg-sand" aria-label="Close">✕</button>
            </div>
            <p className="mt-1 text-sm text-ink-muted">Your friends and members who follow you back.</p>
            <ul className="mt-3 grid gap-1">
              {people === null ? <li className="text-sm text-ink-muted">Loading…</li> : people.length === 0 ? (
                <li className="text-sm text-ink-muted">Nobody yet. Add friends in <Link href="/account/gaming?tab=friends" className="underline">Game Friends</Link>, or follow members from their profile.</li>
              ) : people.map((person) => (
                <li key={person.id}>
                  <button type="button" onClick={() => start(person.id)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-sand">
                    <Avatar name={person.name} src={person.avatarUrl} size="sm" />
                    <span className="font-semibold">{person.username ? `@${person.username}` : person.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
