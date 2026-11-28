'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { ApiError, REALTIME_URL, api, getToken } from '@/lib/api';
import { uploadFile } from '@/lib/upload';
import { useSession } from '@/lib/session';

interface Message { id: string; body: string; kind: string; attachments?: string[]; pinned: boolean; createdAt: string; author: { id: string; name: string; avatarUrl: string | null; isOrganizer: boolean }; replyTo?: { id: string; body: string; author: string } | null; reactions?: { emoji: string; count: number; mine: boolean }[] }
const REACTIONS = ['👍', '❤️', '😂', '🔥', '🙏'];
interface Chat { id: string; subjectType: string; subjectId: string; title: string; href: string; enabled: boolean; archivedAt: string | null; canPost: boolean; canModerate: boolean; muted?: boolean; viewerIsOrganiser: boolean; members: { id: string; name: string }[]; pinned: Message[] }

/**
 * A group chat for an event, activity or community. `open` resolves a listing
 * to its chat (creating it on first use); any other id is a chat.
 */
export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: param } = use(params);
  const router = useRouter();
  const { user } = useSession();
  const [id, setId] = useState<string | null>(param === 'open' ? null : param);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<Message | null>(null);
  const [reacting, setReacting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  // /account/chats/open?type=ACTIVITY&id=… → the chat's own id.
  useEffect(() => {
    if (param !== 'open') return;
    const search = new URLSearchParams(window.location.search);
    api
      .post<{ id: string }>('/experience-chats/open', { subjectType: search.get('type'), subjectId: search.get('id') })
      .then((result) => {
        setId(result.id);
        router.replace(`/account/chats/${result.id}`);
      })
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Could not open this chat.'));
  }, [param, router]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [detail, list] = await Promise.all([api.get<Chat>(`/experience-chats/${id}`), api.get<{ items: Message[] }>(`/experience-chats/${id}/messages`)]);
      setChat(detail);
      setMessages(list.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load this chat.');
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const token = getToken();
    if (!id || !token) return;
    const socket: Socket = io(REALTIME_URL, { path: '/realtime', auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => socket.emit('conversation:join', id));
    socket.on('conversation:joined', () => setLive(true));
    socket.on('disconnect', () => setLive(false));
    socket.on('message:new', (payload: { conversationId: string; message: Message }) => {
      if (payload.conversationId !== id) return;
      setMessages((list) => (list.some((item) => item.id === payload.message.id) ? list : [...list, payload.message]));
    });
    return () => {
      socket.disconnect();
    };
  }, [id]);

  // Slow fallback poll while the live connection is down.
  useEffect(() => {
    if (live || !id) return;
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [live, id, load]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const [sendingFile, setSendingFile] = useState(false);
  const [recording, setRecording] = useState<MediaRecorder | null>(null);
  const [tab, setTab] = useState<'chat' | 'resources'>('chat');
  const [resources, setResources] = useState<Message[] | null>(null);

  /** Uploads a photo, video, document or voice note and posts it. */
  async function sendFile(file: File, kind: 'IMAGE' | 'VIDEO' | 'VOICE' | 'DOCUMENT', caption?: string) {
    if (!id) return;
    setSendingFile(true);
    setError(null);
    try {
      const stored = await uploadFile('CHAT_MEDIA', file);
      if (!stored.url) throw new Error('upload');
      const message = await api.post<Message>(`/experience-chats/${id}/messages`, { body: caption || file.name || (kind === 'VOICE' ? 'Voice message' : 'File'), kind, attachments: [stored.url] });
      setMessages((list) => (list.some((item) => item.id === message.id) ? list : [...list, message]));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The file could not be sent.');
    } finally {
      setSendingFile(false);
    }
  }

  async function toggleVoice() {
    if (recording) {
      recording.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice messages are not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(null);
        const type = recorder.mimeType.split(';')[0] || 'audio/webm';
        const blob = new Blob(chunks, { type });
        if (blob.size > 0) void sendFile(new File([blob], `voice.${type.includes('mp4') ? 'm4a' : type.split('/')[1]}`, { type }), 'VOICE', 'Voice message');
      };
      recorder.start();
      setRecording(recorder);
      // Voice notes stop after two minutes.
      window.setTimeout(() => recorder.state === 'recording' && recorder.stop(), 120000);
    } catch {
      setError('Microphone permission was refused.');
    }
  }

  async function send(kind: 'TEXT' | 'ANNOUNCEMENT' = 'TEXT') {
    if (!id || !text.trim()) return;
    try {
      const message = await api.post<Message>(`/experience-chats/${id}/messages`, { body: text.trim(), kind, replyToId: reply?.id });
      setMessages((list) => (list.some((item) => item.id === message.id) ? list : [...list, message]));
      setText('');
      setReply(null);
      if (reply) void load();
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Not sent.');
    }
  }

  async function act(message: Message, action: 'report' | 'remove' | 'pin') {
    try {
      if (action === 'report') {
        const reason = window.prompt('What is wrong with this message?');
        if (!reason) return;
        await api.post(`/experience-chats/${id}/messages/${message.id}/report`, { reason });
        setError('Reported. The team will review it.');
      } else if (action === 'remove') {
        if (!window.confirm('Remove this message?')) return;
        await api.delete(`/experience-chats/${id}/messages/${message.id}`);
        setMessages((list) => list.filter((item) => item.id !== message.id));
      } else {
        await api.post(`/experience-chats/${id}/messages/${message.id}/pin`);
        void load();
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not work.');
    }
  }

  async function react(messageId: string, emoji: string) {
    await api.post(`/experience-chats/${id}/messages/${messageId}/react`, { emoji }).catch(() => undefined);
    setReacting(null);
    void load();
  }

  async function toggleChat() {
    if (!chat) return;
    await api.post('/experience-chats/settings', { subjectType: chat.subjectType, subjectId: chat.subjectId, enabled: !chat.enabled });
    void load();
  }

  async function block(userId: string) {
    if (!window.confirm('Block this member? You will no longer see their messages.')) return;
    await api.post('/community/blocks', { userId }).catch(() => undefined);
    void load();
  }

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title={chat?.title ?? 'Group chat'}>
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link href="/account/chats" className="font-semibold text-acacia-700">‹ All chats</Link>
          {chat && <span className="text-ink-muted">{chat.members.length} in the chat · {live ? 'live' : 'reconnecting…'} · <Link href={chat.href} className="underline">details</Link></span>}
        </div>
        {chat && !chat.enabled && <p className="rounded-xl bg-sand p-3 text-sm text-ink-soft">The organiser has switched this chat off. You can still read the history.</p>}
        {chat?.archivedAt && <p className="rounded-xl bg-sand p-3 text-sm text-ink-soft">This chat is closed and read-only.</p>}
        {chat?.canModerate && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={toggleChat} className="h-10 rounded-full border border-line bg-white px-4 text-sm font-semibold">{chat.enabled ? 'Switch chat off' : 'Switch chat on'}</button>
          </div>
        )}
        {chat && chat.pinned.length > 0 && (
          <div className="rounded-xl border border-clay-400/50 bg-[#fff8e6] p-3 text-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Pinned</p>
            {chat.pinned.map((item) => <p key={item.id} className="mt-1 text-ink-soft">{item.body}</p>)}
          </div>
        )}
        {error && <p role="status" className="rounded-xl bg-sand p-3 text-sm text-ink-soft">{error}</p>}
        <div className="flex gap-2" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'chat'} onClick={() => setTab('chat')} className={`chip ${tab === 'chat' ? 'chip-active' : ''}`}>Chat</button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'resources'}
            onClick={() => {
              setTab('resources');
              api.get<{ items: Message[] }>(`/experience-chats/${id}/resources`).then((data) => setResources(data.items)).catch(() => setResources([]));
            }}
            className={`chip ${tab === 'resources' ? 'chip-active' : ''}`}
          >
            Shared files
          </button>
        </div>
        {tab === 'resources' && (
          <ul className="grid gap-2 rounded-2xl border border-line bg-white p-4 text-sm">
            {resources === null ? <li className="text-ink-muted">Loading…</li> : resources.length === 0 ? <li className="text-ink-muted">Nothing shared yet.</li> : resources.map((item) => (
              <li key={item.id} className="border-b border-line pb-2 last:border-0">
                <p className="text-xs text-ink-muted">{item.author.name} · {new Date(item.createdAt).toLocaleDateString('en-GB')}</p>
                <Attachment message={item} />
              </li>
            ))}
          </ul>
        )}
        <ol className={`grid gap-3 rounded-2xl border border-line bg-white p-4 ${tab === 'chat' ? '' : 'hidden'}`} aria-live="polite">
          {messages.length === 0 && <li className="text-sm text-ink-muted">No messages yet. Say hello.</li>}
          {messages.map((message) => {
            const mine = message.author.id === user?.id;
            return (
              <li key={message.id} className={`max-w-[85%] ${mine ? 'ml-auto text-right' : ''}`}>
                <p className="text-xs text-ink-muted">
                  <strong className="text-ink-soft">{message.author.name}</strong>
                  {message.author.isOrganizer && <span className="ml-1 rounded bg-clay-400/30 px-1 text-[0.625rem] font-bold uppercase">Organiser</span>} · {new Date(message.createdAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                </p>
                {message.replyTo && <p className="mt-1 inline-block max-w-full truncate rounded-lg border-l-4 border-clay-400 bg-sand px-2 py-1 text-left text-xs text-ink-muted">↩ {message.replyTo.author}: {message.replyTo.body}</p>}
                <br className={message.replyTo ? '' : 'hidden'} />
                {message.attachments?.length ? <Attachment message={message} /> : (
                  <p className={`mt-1 inline-block whitespace-pre-line rounded-2xl px-3 py-2 text-left text-[0.9375rem] [overflow-wrap:anywhere] ${message.kind === 'ANNOUNCEMENT' ? 'bg-[#fff1c9] text-ink' : mine ? 'bg-acacia-700 text-white' : 'bg-sand text-ink'}`}>{message.kind === 'ANNOUNCEMENT' ? '📣 ' : ''}{message.body}</p>
                )}
                {!!message.reactions?.length && (
                  <p className="mt-1 flex flex-wrap justify-end gap-1">
                    {message.reactions.map((reaction) => <button key={reaction.emoji} type="button" onClick={() => react(message.id, reaction.emoji)} className={`rounded-full border px-2 text-xs ${reaction.mine ? 'border-clay-400 bg-[#fff8e6]' : 'border-line bg-white'}`}>{reaction.emoji} {reaction.count}</button>)}
                  </p>
                )}
                {reacting === message.id && (
                  <p className="mt-1 flex justify-end gap-1">{REACTIONS.map((emoji) => <button key={emoji} type="button" onClick={() => react(message.id, emoji)} className="h-9 w-9 rounded-full border border-line bg-white text-lg" aria-label={`React ${emoji}`}>{emoji}</button>)}</p>
                )}
                <p className="mt-1 flex justify-end gap-3 text-xs text-ink-faint">
                  {chat?.canPost && <button type="button" onClick={() => setReply(message)}>Reply</button>}
                  <button type="button" onClick={() => setReacting(reacting === message.id ? null : message.id)}>React</button>
                  {!mine && <button type="button" onClick={() => act(message, 'report')}>Report</button>}
                  {!mine && <button type="button" onClick={() => block(message.author.id)}>Block</button>}
                  {chat?.canModerate && <button type="button" onClick={() => act(message, 'pin')}>{message.pinned ? 'Unpin' : 'Pin'}</button>}
                  {(chat?.canModerate || mine) && <button type="button" onClick={() => act(message, 'remove')}>Remove</button>}
                </p>
              </li>
            );
          })}
          <div ref={end} />
        </ol>
        {sendingFile && <p className="text-xs text-ink-muted">Sending file…</p>}
        {recording && <p className="text-xs font-semibold text-danger">Recording… tap ⏹ to send.</p>}
        {chat?.muted && <p className="rounded-xl bg-sand p-3 text-sm text-ink-soft">A moderator has muted you in this group for now. You can still read it.</p>}
        {chat?.canPost && (
          <>
          {reply && (
            <p className="flex items-center justify-between gap-2 rounded-lg bg-sand px-3 py-1 text-xs text-ink-muted">
              <span className="truncate">Replying to {reply.author.name}: {reply.body}</span>
              <button type="button" onClick={() => setReply(null)} aria-label="Cancel reply">✕</button>
            </p>
          )}
          <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="sticky bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] flex gap-2 rounded-2xl border border-line bg-white p-2">
            <textarea value={text} onChange={(event) => setText(event.target.value)} rows={1} maxLength={2000} placeholder="Write a message…" aria-label="Message" className="min-h-11 w-full resize-none rounded-xl px-3 py-2 outline-none" onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} />
            <label className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line text-lg" title="Send a photo, video or file" aria-label="Send a photo, video or file">
              📎
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,application/pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  const kind = file.type.startsWith('image/') ? 'IMAGE' : file.type.startsWith('video/') ? 'VIDEO' : 'DOCUMENT';
                  void sendFile(file, kind, text.trim() || undefined);
                  setText('');
                }}
              />
            </label>
            <button type="button" onClick={toggleVoice} className={`h-11 w-11 shrink-0 rounded-full border text-lg ${recording ? 'border-danger bg-danger-soft' : 'border-line'}`} aria-label={recording ? 'Stop and send voice message' : 'Record a voice message'} title={recording ? 'Stop and send' : 'Voice message'}>{recording ? '⏹' : '🎙️'}</button>
            {chat.viewerIsOrganiser && <button type="button" onClick={() => send('ANNOUNCEMENT')} className="h-11 shrink-0 rounded-full border border-line px-3 text-sm font-semibold" title="Send as an announcement">📣</button>}
            <button className="h-11 shrink-0 rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Send</button>
          </form>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

/** A photo, video, voice note or document in the chat. */
function Attachment({ message }: { message: Message }) {
  const url = message.attachments?.[0];
  if (!url) return null;
  if (message.kind === 'IMAGE') {
    // eslint-disable-next-line @next/next/no-img-element
    return <a href={url} target="_blank" rel="noreferrer noopener" className="mt-1 inline-block"><img src={url} alt={message.body} className="max-h-72 max-w-full rounded-xl" loading="lazy" /></a>;
  }
  if (message.kind === 'VIDEO') return <video src={url} controls preload="metadata" className="mt-1 max-h-72 max-w-full rounded-xl" />;
  if (message.kind === 'VOICE') return <audio src={url} controls preload="metadata" className="mt-1 max-w-full" aria-label="Voice message" />;
  return <a href={url} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold text-acacia-700">📄 {message.body}</a>;
}
