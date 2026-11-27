'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

/** Counts one view of a listing for the popularity engine (once per visitor per day, server-side). */
export function TrackView({ subjectType, subjectId }: { subjectType: string; subjectId: string }) {
  useEffect(() => {
    api.post('/public/track', { subjectType, subjectId, kind: 'VIEW' }).catch(() => undefined);
  }, [subjectType, subjectId]);
  return null;
}

/**
 * Invite friends: copy the link, send it on WhatsApp, use the phone's share
 * sheet, or notify members by username. An invitation only shares the page —
 * it never registers anyone or holds a place.
 */
export function ShareButton({ subjectType, subjectId, title }: { subjectType: string; subjectId: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center rounded-full border border-line-strong bg-white px-3.5 text-xs font-bold text-acacia-700 hover:border-acacia-600"
      >
        Invite friends
      </button>
      {open && <InviteSheet subjectType={subjectType} subjectId={subjectId} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

function InviteSheet({ subjectType, subjectId, title, onClose }: { subjectType: string; subjectId: string; title: string; onClose: () => void }) {
  const { status } = useSession();
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ username: string; firstName: string }[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const url = typeof window === 'undefined' ? '' : window.location.href.split('#')[0];
  const memberInvites = subjectType !== 'PLACE' && status === 'authenticated';
  const track = () => api.post('/public/track', { subjectType, subjectId, kind: 'SHARE' }).catch(() => undefined);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    const q = query.trim().replace(/^@/, '');
    if (!memberInvites || q.length < 2) return setFound([]);
    const timer = window.setTimeout(() => {
      api.get<{ items: { username: string; firstName: string }[] }>(`/community/usernames?q=${encodeURIComponent(q)}`).then((data) => setFound(data.items)).catch(() => setFound([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, memberInvites]);

  async function send() {
    try {
      const result = await api.post<{ sent: number; notFound: string[] }>('/community/invites', { subjectType, subjectId, usernames: chosen });
      setMessage(result.sent ? `Invitation sent to ${result.sent} ${result.sent === 1 ? 'member' : 'members'}. They decide whether to register.` : 'No invitation was sent — those members could not be reached.');
      setChosen([]);
      track();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not send.');
    }
  }

  if (!mounted) return null;
  const text = `${title} — on Enhakkore: ${url}`;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Invite friends" onClick={onClose}>
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 text-ink sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold">Invite friends</p>
            <p className="text-sm text-ink-muted [overflow-wrap:anywhere]">{title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="h-11 w-11 shrink-0 rounded-full text-xl text-ink-muted hover:bg-sand">×</button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
          <button type="button" className="grid min-h-20 place-items-center gap-1 rounded-xl border border-line p-2" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); track(); } catch { setMessage('Copy the address from the browser bar.'); } }}>
            <span className="text-xl" aria-hidden>🔗</span>{copied ? 'Copied ✓' : 'Copy link'}
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer noopener" onClick={track} className="grid min-h-20 place-items-center gap-1 rounded-xl border border-line p-2">
            <span className="text-xl" aria-hidden>🟢</span>WhatsApp
          </a>
          <button type="button" className="grid min-h-20 place-items-center gap-1 rounded-xl border border-line p-2 disabled:opacity-40" disabled={typeof navigator !== 'undefined' && !navigator.share} onClick={async () => { try { await navigator.share({ title, url }); track(); } catch { /* cancelled */ } }}>
            <span className="text-xl" aria-hidden>📤</span>More apps
          </button>
        </div>
        {subjectType !== 'PLACE' && (
          <div className="mt-5">
            <p className="text-sm font-semibold">Invite Enhakkore members</p>
            {status !== 'authenticated' ? (
              <p className="mt-1 text-sm text-ink-muted"><Link href="/signin" className="font-semibold text-acacia-700 underline">Sign in</Link> to invite members by username.</p>
            ) : (
              <>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search @username" aria-label="Search members by username" className="field mt-2 w-full" />
                {found.length > 0 && (
                  <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                    {found.map((person) => (
                      <li key={person.username}>
                        <button type="button" onClick={() => { setChosen((list) => (list.includes(person.username) ? list : [...list, person.username])); setQuery(''); }} className="flex min-h-11 w-full items-center justify-between px-3 text-left text-sm">
                          <span>@{person.username} <span className="text-ink-muted">· {person.firstName}</span></span><span aria-hidden>＋</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {chosen.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {chosen.map((name) => <button type="button" key={name} onClick={() => setChosen((list) => list.filter((item) => item !== name))} className="chip chip-active">@{name} ×</button>)}
                  </div>
                )}
                <button type="button" disabled={!chosen.length} onClick={send} className="mt-3 h-11 w-full rounded-full bg-acacia-600 text-sm font-bold text-white disabled:opacity-40">Send invitation</button>
              </>
            )}
          </div>
        )}
        {message && <p role="status" className="mt-3 rounded-xl bg-sand p-3 text-sm text-ink-soft">{message}</p>}
        <p className="mt-4 text-xs text-ink-faint">An invitation shares this page. It does not register anyone or hold a place.</p>
      </div>
    </div>,
    document.body,
  );
}

/** "Group chat" on a listing page: shown only when the organiser switched the chat on. */
export function GroupChatLink({ subjectType, subjectId, enabled }: { subjectType: string; subjectId: string; enabled?: boolean | null }) {
  const { status } = useSession();
  if (!enabled) return null;
  return (
    <Link
      href={status === 'authenticated' ? `/account/chats/open?type=${subjectType}&id=${subjectId}` : '/signin'}
      className="inline-flex h-9 items-center rounded-full border border-line-strong bg-white px-3.5 text-xs font-bold text-acacia-700 hover:border-acacia-600"
      title="For confirmed participants and members"
    >
      💬 Group chat
    </Link>
  );
}
