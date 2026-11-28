'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { Avatar } from '@/components/ui';
import { ApiError, REALTIME_URL, api, getToken } from '@/lib/api';
import { uploadFile } from '@/lib/upload';

interface Message {
  id: string;
  authorId: string;
  mine: boolean;
  kind: string;
  body: string;
  attachments: string[];
  createdAt: string;
  removed: boolean;
  replyTo: { id: string; authorId: string; body: string; kind: string } | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
}
interface Thread {
  id: string;
  member: { id: string; name: string; username: string | null; avatarUrl: string | null; available: boolean };
  requestStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null;
  incomingRequest: boolean;
  canSend: boolean;
  pendingLimit: number;
  unsendMinutes: number;
  muted: boolean;
  archived: boolean;
  blocked: boolean;
  otherReadAt: string | null;
  items: Message[];
  hasMore: boolean;
}

const REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '🔥'];

/** Turns plain links in text into links (text only — no HTML from messages is ever rendered). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"]+)/g);
  return (
    <>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a key={index} href={part} target="_blank" rel="noreferrer noopener nofollow" className="underline [overflow-wrap:anywhere]">
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function Media({ message }: { message: Message }) {
  const url = message.attachments[0];
  if (!url) return null;
  if (message.kind === 'IMAGE') {
    // eslint-disable-next-line @next/next/no-img-element
    return <a href={url} target="_blank" rel="noreferrer noopener"><img src={url} alt={message.body || 'Photo'} className="max-h-72 max-w-full rounded-xl" loading="lazy" /></a>;
  }
  if (message.kind === 'VIDEO') return <video src={url} controls preload="metadata" className="max-h-72 max-w-full rounded-xl" />;
  return <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-acacia-700">📄 {message.body || 'Document'}</a>;
}

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<Message | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [tab, setTab] = useState<'chat' | 'media'>('chat');
  const [media, setMedia] = useState<{ media: { url: string; kind: string; createdAt: string }[]; links: { url: string; createdAt: string }[] } | null>(null);
  const [live, setLive] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const sending = useRef(false);

  const load = useCallback(async () => {
    try {
      setThread(await api.get<Thread>(`/messages/${id}`));
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load this conversation.');
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const socket: Socket = io(REALTIME_URL, { path: '/realtime', auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => socket.emit('conversation:join', id));
    socket.on('conversation:joined', () => setLive(true));
    socket.on('disconnect', () => setLive(false));
    // A new message arrives: reload so it is decrypted and shaped for this viewer.
    socket.on('message:new', (payload: { conversationId: string }) => {
      if (payload.conversationId === id) void load();
    });
    return () => {
      socket.disconnect();
    };
  }, [id, load]);
  useEffect(() => {
    if (live) return;
    const timer = window.setInterval(() => void load(), 12000);
    return () => window.clearInterval(timer);
  }, [live, load]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [thread?.items.length]);

  async function send(kind: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' = 'TEXT', attachments: string[] = [], caption?: string) {
    const body = kind === 'TEXT' ? text.trim() : caption ?? '';
    if (kind === 'TEXT' && !body) return;
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await api.post(`/messages/${id}/messages`, { body, kind, attachments, replyToId: reply?.id });
      if (kind === 'TEXT') setText('');
      setReply(null);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Not sent.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  async function sendFile(file: File) {
    const kind = file.type.startsWith('image/') ? 'IMAGE' : file.type.startsWith('video/') ? 'VIDEO' : 'DOCUMENT';
    setBusy(true);
    try {
      const stored = await uploadFile('CHAT_MEDIA', file);
      if (!stored.url) throw new Error('upload');
      await send(kind, [stored.url], text.trim() || file.name);
      setText('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The file could not be sent.');
      setBusy(false);
    }
  }

  async function act(path: string, body: unknown, method: 'post' | 'delete' = 'post') {
    try {
      if (method === 'delete') await api.delete(path);
      else await api.post(path, body);
      setMenu(null);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not work.');
    }
  }

  async function respond(accept: boolean) {
    await act(`/messages/${id}/respond`, { accept });
    if (!accept) window.location.href = '/account/messages';
  }

  async function report(messageId?: string) {
    const reason = window.prompt('What is wrong? (spam, harassment, scam, something else)');
    if (!reason) return;
    const block = window.confirm('Also block this member? They will not be able to message you.');
    await act(`/messages/${id}/report`, { messageId, reason, block });
    setError('Thank you. The safety team will review it.');
  }

  const other = thread?.member;
  const lastMine = thread ? [...thread.items].reverse().find((m) => m.mine) : null;
  const seen = !!(lastMine && thread?.otherReadAt && new Date(thread.otherReadAt) >= new Date(lastMine.createdAt));

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title={other ? (other.username ? `@${other.username}` : other.name) : 'Conversation'}>
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <Link href="/account/messages" className="font-semibold text-acacia-700">‹ All messages</Link>
          {other && (
            <div className="flex items-center gap-2">
              <Avatar name={other.name} src={other.avatarUrl} size="xs" />
              {other.username && <Link href={`/u/${other.username}`} className="font-semibold underline">Profile</Link>}
              <button type="button" onClick={() => setMenu(menu === 'thread' ? null : 'thread')} className="h-10 rounded-full border border-line bg-white px-3 font-semibold" aria-expanded={menu === 'thread'}>⋯</button>
            </div>
          )}
        </div>
        {menu === 'thread' && thread && (
          <div className="grid gap-1 rounded-2xl border border-line bg-white p-2 text-sm">
            <button type="button" className="min-h-10 rounded-lg px-3 text-left hover:bg-sand" onClick={() => act(`/messages/${id}/settings`, { muted: !thread.muted })}>{thread.muted ? 'Unmute' : 'Mute notifications'}</button>
            <button type="button" className="min-h-10 rounded-lg px-3 text-left hover:bg-sand" onClick={() => act(`/messages/${id}/settings`, { archived: !thread.archived })}>{thread.archived ? 'Move back to inbox' : 'Archive'}</button>
            <button type="button" className="min-h-10 rounded-lg px-3 text-left hover:bg-sand" onClick={() => window.confirm('Delete this chat for you? The other person keeps their copy.') && act(`/messages/${id}/settings`, { clear: true })}>Delete chat for me</button>
            <button type="button" className="min-h-10 rounded-lg px-3 text-left text-danger hover:bg-danger-soft" onClick={() => window.confirm('Block this member? They will not be able to message you.') && act('/community/blocks', { userId: thread.member.id })}>Block</button>
            <button type="button" className="min-h-10 rounded-lg px-3 text-left text-danger hover:bg-danger-soft" onClick={() => report()}>Report conversation</button>
          </div>
        )}
        {error && <p role="status" className="rounded-xl bg-sand p-3 text-sm text-ink-soft">{error}</p>}
        {thread?.blocked && <p className="rounded-xl bg-sand p-3 text-sm text-ink-soft">You cannot message each other. Unblock them from Settings if this was a mistake.</p>}
        {thread?.incomingRequest && (
          <div className="rounded-2xl border border-clay-400/60 bg-[#fff8e6] p-4 text-sm">
            <p className="font-semibold">{other?.name} wants to message you.</p>
            <p className="mt-1 text-ink-soft">Accept to reply. If you decline, they are not told.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => respond(true)} className="h-10 rounded-full bg-acacia-600 px-5 font-bold text-white">Accept</button>
              <button type="button" onClick={() => respond(false)} className="h-10 rounded-full border border-line bg-white px-5 font-semibold">Decline</button>
              <button type="button" onClick={() => report()} className="h-10 rounded-full px-3 font-semibold text-danger">Report</button>
            </div>
          </div>
        )}
        {thread?.requestStatus === 'PENDING' && !thread.incomingRequest && (
          <p className="rounded-xl bg-sand p-3 text-sm text-ink-soft">Message request sent. You can send up to {thread.pendingLimit} messages until {other?.name.split(' ')[0]} accepts.</p>
        )}

        <div className="flex gap-2" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'chat'} onClick={() => setTab('chat')} className={`chip ${tab === 'chat' ? 'chip-active' : ''}`}>Chat</button>
          <button type="button" role="tab" aria-selected={tab === 'media'} onClick={() => { setTab('media'); api.get<typeof media>(`/messages/${id}/media`).then(setMedia).catch(() => setMedia({ media: [], links: [] })); }} className={`chip ${tab === 'media' ? 'chip-active' : ''}`}>Media, files & links</button>
        </div>

        {tab === 'media' && (
          <div className="rounded-2xl border border-line bg-white p-4 text-sm">
            {!media ? 'Loading…' : media.media.length + media.links.length === 0 ? <p className="text-ink-muted">Nothing shared yet.</p> : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {media.media.map((item, index) =>
                    item.kind === 'IMAGE' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={index} href={item.url} target="_blank" rel="noreferrer noopener"><img src={item.url} alt="" className="aspect-square w-full rounded-lg object-cover" loading="lazy" /></a>
                    ) : (
                      <a key={index} href={item.url} target="_blank" rel="noreferrer noopener" className="flex aspect-square items-center justify-center rounded-lg bg-sand text-2xl">{item.kind === 'VIDEO' ? '🎬' : '📄'}</a>
                    ),
                  )}
                </div>
                {media.links.length > 0 && (
                  <ul className="mt-3 grid gap-1">
                    {media.links.map((link, index) => <li key={index}><a href={link.url} target="_blank" rel="noreferrer noopener nofollow" className="underline [overflow-wrap:anywhere]">{link.url}</a></li>)}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        <ol className={`grid gap-3 rounded-2xl border border-line bg-white p-4 ${tab === 'chat' ? '' : 'hidden'}`} aria-live="polite">
          {thread === null ? <li className="text-sm text-ink-muted">Loading…</li> : thread.items.length === 0 ? <li className="text-sm text-ink-muted">No messages yet.</li> : null}
          {thread?.items.map((message) => {
            const canUnsend = message.mine && !message.removed && Date.now() - new Date(message.createdAt).getTime() < thread.unsendMinutes * 60_000;
            return (
              <li key={message.id} className={`max-w-[85%] ${message.mine ? 'ml-auto text-right' : ''}`}>
                {message.replyTo && (
                  <p className="mb-1 inline-block max-w-full truncate rounded-lg border-l-4 border-clay-400 bg-sand px-2 py-1 text-left text-xs text-ink-muted">↩ {message.replyTo.body || '[media]'}</p>
                )}
                <div className={message.mine ? 'flex justify-end' : ''}>
                  {message.removed ? (
                    <p className="inline-block rounded-2xl bg-sand px-3 py-2 text-sm italic text-ink-muted">Message unsent</p>
                  ) : message.attachments.length ? (
                    <div className="grid gap-1">
                      <Media message={message} />
                      {message.body && message.kind !== 'DOCUMENT' && <p className="text-sm text-ink-soft"><Linkified text={message.body} /></p>}
                    </div>
                  ) : (
                    <p className={`inline-block whitespace-pre-line rounded-2xl px-3 py-2 text-left text-[0.9375rem] [overflow-wrap:anywhere] ${message.mine ? 'bg-acacia-700 text-white' : 'bg-sand text-ink'}`}><Linkified text={message.body} /></p>
                  )}
                </div>
                {message.reactions.length > 0 && (
                  <p className="mt-1 flex flex-wrap justify-end gap-1">
                    {message.reactions.map((reaction) => (
                      <button key={reaction.emoji} type="button" onClick={() => act(`/messages/${id}/messages/${message.id}/react`, { emoji: reaction.emoji })} className={`rounded-full border px-2 text-xs ${reaction.mine ? 'border-clay-400 bg-[#fff8e6]' : 'border-line bg-white'}`}>{reaction.emoji} {reaction.count}</button>
                    ))}
                  </p>
                )}
                <p className="mt-1 flex flex-wrap justify-end gap-3 text-xs text-ink-faint">
                  <span>{new Date(message.createdAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                  {!message.removed && thread.canSend && <button type="button" onClick={() => setReply(message)}>Reply</button>}
                  {!message.removed && <button type="button" onClick={() => setMenu(menu === message.id ? null : message.id)} aria-expanded={menu === message.id}>React</button>}
                  {canUnsend && <button type="button" onClick={() => window.confirm('Unsend this message for everyone?') && act(`/messages/${id}/messages/${message.id}?for=everyone`, null, 'delete')}>Unsend</button>}
                  <button type="button" onClick={() => act(`/messages/${id}/messages/${message.id}?for=me`, null, 'delete')}>Delete for me</button>
                  {!message.mine && !message.removed && <button type="button" onClick={() => report(message.id)}>Report</button>}
                </p>
                {menu === message.id && (
                  <p className="mt-1 flex justify-end gap-1">
                    {REACTIONS.map((emoji) => <button key={emoji} type="button" onClick={() => act(`/messages/${id}/messages/${message.id}/react`, { emoji })} className="h-9 w-9 rounded-full border border-line bg-white text-lg" aria-label={`React ${emoji}`}>{emoji}</button>)}
                  </p>
                )}
              </li>
            );
          })}
          {seen && <li className="text-right text-xs text-ink-faint">Seen</li>}
          <div ref={end} />
        </ol>

        {thread?.canSend && (
          <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="sticky bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] grid gap-1 rounded-2xl border border-line bg-white p-2">
            {reply && (
              <p className="flex items-center justify-between gap-2 rounded-lg bg-sand px-3 py-1 text-xs text-ink-muted">
                <span className="truncate">Replying to: {reply.body || '[media]'}</span>
                <button type="button" onClick={() => setReply(null)} aria-label="Cancel reply">✕</button>
              </p>
            )}
            <div className="flex gap-2">
              <textarea value={text} onChange={(event) => setText(event.target.value)} rows={1} maxLength={4000} placeholder="Write a message…" aria-label="Message" className="min-h-11 w-full resize-none rounded-xl px-3 py-2 outline-none" onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} />
              <label className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line text-lg" title="Send a photo, video or document" aria-label="Send a photo, video or document">
                📎
                <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void sendFile(file); }} />
              </label>
              <button disabled={busy} className="h-11 shrink-0 rounded-full bg-acacia-600 px-5 text-sm font-bold text-white disabled:opacity-50">Send</button>
            </div>
            <p className="px-1 text-[0.6875rem] text-ink-faint">Messages are stored encrypted. Voice notes are not available in private messages yet.</p>
          </form>
        )}
      </div>
    </DashboardShell>
  );
}
