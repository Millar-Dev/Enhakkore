'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

interface Relationship { following: boolean; followsYou: boolean; friend: boolean; friendRequest: { id: string; incoming: boolean } | null; blocked: boolean; canMessage: boolean; conversation: { id: string } | null }

/** Follow, add as a friend, message, block and report — on a member's profile. */
export function ProfileActions({ username }: { username: string }) {
  const { status, user } = useSession();
  const [id, setId] = useState<string | null>(null);
  const [rel, setRel] = useState<Relationship | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (userId: string) => {
    setRel(await api.get<Relationship>(`/social/relationship/${userId}`).catch(() => null));
  }, []);
  useEffect(() => {
    if (status !== 'authenticated') return;
    api.get<{ id?: string }>(`/public/u/${encodeURIComponent(username)}`).then((card) => {
      if (card.id) {
        setId(card.id);
        void load(card.id);
      }
    }).catch(() => undefined);
  }, [status, username, load]);

  if (status === 'loading') return null;
  if (status !== 'authenticated') {
    return <p className="mt-4 text-sm text-ink-muted"><Link href={`/signin?next=/u/${username}`} className="font-semibold text-acacia-700 underline">Sign in</Link> to follow, add as a friend or message.</p>;
  }
  if (!id || !rel || id === user?.id) return null;

  async function run(promise: Promise<unknown>, done?: string) {
    try {
      await promise;
      if (done) setMessage(done);
      await load(id!);
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'That did not work.');
    }
  }
  async function openChat() {
    try {
      const result = await api.post<{ id: string }>('/messages/start', { userId: id });
      window.location.href = `/account/messages/${result.id}`;
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not open the conversation.');
    }
  }
  if (rel.blocked) {
    return (
      <div className="mt-4 text-sm"><p className="text-ink-muted">You blocked this member.</p><button type="button" onClick={() => run(api.delete(`/community/blocks/${id}`), 'Unblocked.')} className="mt-1 font-semibold underline">Unblock</button></div>
    );
  }
  return (
    <div className="mt-4">
      {message && <p role="status" className="mb-2 rounded-xl bg-sand p-2 text-sm">{message}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => run(rel.following ? api.delete(`/social/follows/${id}`) : api.post(`/social/follows/${id}`))} className={`h-11 rounded-full px-5 text-sm font-bold ${rel.following ? 'border border-line bg-white' : 'bg-acacia-600 text-white'}`}>{rel.following ? 'Following' : rel.followsYou ? 'Follow back' : 'Follow'}</button>
        {rel.friend ? <span className="inline-flex h-11 items-center rounded-full bg-sand px-4 text-sm font-semibold">✓ Friends</span> : rel.friendRequest?.incoming ? (
          <button type="button" onClick={() => run(api.post(`/social/friends/${rel.friendRequest!.id}/respond`, { accept: true }), 'You are now friends.')} className="h-11 rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700">Accept friend request</button>
        ) : rel.friendRequest ? <span className="inline-flex h-11 items-center rounded-full bg-sand px-4 text-sm">Friend request sent</span> : (
          <button type="button" onClick={() => run(api.post('/social/friends', { userId: id }), 'Friend request sent.')} className="h-11 rounded-full border border-line bg-white px-5 text-sm font-semibold">Add friend</button>
        )}
        {(rel.canMessage || rel.conversation) && <button type="button" onClick={openChat} className="h-11 rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700">Message</button>}
      </div>
      {!rel.canMessage && !rel.conversation && <p className="mt-2 text-xs text-ink-muted">You can message friends, or members who follow you back.</p>}
      <div className="mt-3 flex gap-3 text-xs">
        <button type="button" onClick={() => window.confirm('Block this member? They will not be able to message or invite you.') && run(api.post('/community/blocks', { userId: id }), 'Blocked.')} className="text-danger underline">Block</button>
        <button type="button" onClick={() => { const reason = window.prompt('What is wrong with this profile?'); if (reason) void run(api.post('/community/reports', { targetType: 'USER', targetId: id, reason }), 'Reported. Thank you.'); }} className="text-danger underline">Report</button>
      </div>
    </div>
  );
}
