'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

interface Member { userId: string; name: string; role: string; status: string; message: string | null; mutedUntil: string | null }

/** For a study group's admin and moderators (and Enhakkore staff): requests, roles, mute and remove, announcements. */
export function StudyGroupManage({ slug }: { slug: string }) {
  const { status, user } = useSession();
  const [data, setData] = useState<{ viewerRole: string | null; items: Member[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(() => {
    api.get<{ viewerRole: string | null; items: Member[] }>(`/community/study-groups/${slug}/members`).then(setData).catch(() => setData(null));
  }, [slug]);
  useEffect(() => {
    if (status === 'authenticated') load();
  }, [status, load]);
  if (!data) return null;
  const isAdmin = data.viewerRole === 'ADMIN' || data.viewerRole === 'STAFF';
  const act = async (member: Member, action: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await api.post(`/community/study-groups/${slug}/members/${member.userId}`, { action });
      load();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'That did not work.');
    }
  };
  const pending = data.items.filter((item) => item.status === 'PENDING');
  const active = data.items.filter((item) => item.status === 'ACTIVE');
  return (
    <div id="manage" className="scroll-mt-24 rounded-[1.1rem] border border-clay-400/60 bg-white p-5 text-sm">
      <p className="font-bold text-acacia-700">Manage this group</p>
      {message && <p className="mt-2 text-xs text-danger">{message}</p>}
      {pending.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Requests ({pending.length})</p>
          <ul className="mt-1 divide-y divide-line">
            {pending.map((member) => (
              <li key={member.userId} className="py-2">
                <p className="font-semibold">{member.name}</p>
                {member.message && <p className="text-xs text-ink-muted">“{member.message}”</p>}
                <div className="mt-1 flex gap-3 text-xs font-semibold">
                  <button type="button" className="min-h-9 text-safari-700" onClick={() => act(member, 'approve')}>Approve</button>
                  <button type="button" className="min-h-9 text-danger" onClick={() => act(member, 'decline')}>Decline</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-muted">Members ({active.length})</p>
      <ul className="mt-1 divide-y divide-line">
        {active.map((member) => {
          const muted = member.mutedUntil && new Date(member.mutedUntil).getTime() > Date.now();
          const self = member.userId === user?.id;
          return (
            <li key={member.userId} className="py-2">
              <p><span className="font-semibold">{member.name}</span> <span className="text-xs text-ink-muted">{member.role === 'ADMIN' ? '· admin' : member.role === 'MODERATOR' ? '· moderator' : ''}{muted ? ' · muted' : ''}</span></p>
              {member.role !== 'ADMIN' && !self && (
                <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold">
                  {isAdmin && <button type="button" className="min-h-9 text-acacia-700" onClick={() => act(member, member.role === 'MODERATOR' ? 'member' : 'moderator')}>{member.role === 'MODERATOR' ? 'Remove moderator' : 'Make moderator'}</button>}
                  <button type="button" className="min-h-9 text-ink-soft" onClick={() => act(member, muted ? 'unmute' : 'mute')}>{muted ? 'Unmute' : 'Mute 24 h'}</button>
                  <button type="button" className="min-h-9 text-danger" onClick={() => act(member, 'remove', `Remove ${member.name} from the group?`)}>Remove</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <form
        className="mt-4 grid gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          try {
            await api.post(`/community/study-groups/${slug}/announcements`, { title: String(form.get('title')), body: String(form.get('body')) });
            setMessage('Announcement posted. Every member was notified.');
            (event.target as HTMLFormElement).reset();
          } catch (caught) {
            setMessage(caught instanceof ApiError ? caught.message : 'Could not post.');
          }
        }}
      >
        <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Announcement</p>
        <input name="title" required minLength={3} maxLength={160} placeholder="Title" className="field" />
        <textarea name="body" required minLength={3} maxLength={4000} rows={3} placeholder="Message to all members" className="field" />
        <button className="h-10 w-fit rounded-full bg-acacia-600 px-4 text-xs font-bold text-white">Post announcement</button>
      </form>
    </div>
  );
}
