'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { NiaOrb } from './NiaOrb';

interface Result { type: string; id: string; title: string; subtitle: string | null; link: string; image: string | null; action?: { kind: 'SAVE' | 'JOIN_GROUP'; itemType?: string; itemId?: string; slug?: string; label: string } | null }
interface Turn { role: 'USER' | 'NIA'; content: string; results?: Result[]; guide?: { title: string; link: string; help: string }[] }
interface Config { enabled: boolean; text: boolean; voice: boolean; aiConnected: boolean; history: boolean; dailyLimit: number; usedToday: number; categories: { key: string; label: string }[] }
interface ConversationRow { id: string; title: string; updatedAt: string }

type SpeechRecognitionLike = { lang: string; interimResults: boolean; onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void };

const SUGGESTIONS = ['Find a study group for anatomy', 'Football communities in Dar es Salaam', 'Upcoming gaming tournaments', 'Where do I see my trip payments?', 'Places to eat near the beach'];

/**
 * Nia — the member assistant. Answers come from real Enhakkore records. Any
 * action (save, join) is offered as a button the member presses; Nia never
 * acts on her own. Voice uses the browser's own speech features when the
 * team has voice switched on and the browser supports it.
 */
export function NiaChat() {
  const { status } = useSession();
  const [config, setConfig] = useState<Config | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  const loadConfig = useCallback(() => api.get<Config>('/nia/config').then(setConfig).catch(() => setConfig(null)), []);
  const loadConversations = useCallback(() => api.get<{ items: ConversationRow[] }>('/nia/conversations').then((d) => setConversations(d.items)).catch(() => setConversations([])), []);
  useEffect(() => {
    void loadConfig();
    if (status === 'authenticated') void loadConversations();
  }, [status, loadConfig, loadConversations]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [turns.length, busy]);

  const voiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const listenSupported = typeof window !== 'undefined' && !!((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);

  function speak(content: string) {
    if (!voiceSupported || !config?.voice) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content.replace(/[*_#>`]/g, ''));
    // Prefer an English female voice where the device offers one.
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) => /en/i.test(v.lang) && /female|samantha|victoria|zira|susan|karen|moira|tessa|serena|google uk english female/i.test(v.name)) ?? voices.find((v) => /en/i.test(v.lang));
    if (preferred) utterance.voice = preferred;
    utterance.rate = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function listen() {
    const Ctor = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = 'en-GB';
    rec.interimResults = false;
    rec.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? '';
      if (heard) void ask(heard);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognition.current = rec;
    setListening(true);
    rec.start();
  }

  async function ask(message: string) {
    const question = message.trim();
    if (!question || busy) return;
    setBusy(true);
    setError(null);
    setTurns((list) => [...list, { role: 'USER', content: question }]);
    setText('');
    try {
      const answer = await api.post<{ conversationId: string | null; reply: string; results: Result[]; guide: Turn['guide']; usedToday: number }>('/nia/ask', { message: question, conversationId: current });
      setTurns((list) => [...list, { role: 'NIA', content: answer.reply, results: answer.results, guide: answer.guide }]);
      if (answer.conversationId && answer.conversationId !== current) {
        setCurrent(answer.conversationId);
        void loadConversations();
      }
      setConfig((c) => (c ? { ...c, usedToday: answer.usedToday } : c));
      if (speakReplies) speak(answer.reply);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Nia could not answer just now.');
      setTurns((list) => list.slice(0, -1));
      setText(question);
    } finally {
      setBusy(false);
    }
  }

  async function openConversation(id: string) {
    const data = await api.get<{ id: string; messages: { role: 'USER' | 'NIA'; content: string; results: Result[] }[] }>(`/nia/conversations/${id}`).catch(() => null);
    if (!data) return;
    setCurrent(id);
    setTurns(data.messages.map((m) => ({ role: m.role, content: m.content, results: m.results })));
    setShowHistory(false);
  }
  async function rename(id: string) {
    const title = window.prompt('Name this conversation');
    if (!title) return;
    await api.patch(`/nia/conversations/${id}`, { title }).catch(() => undefined);
    void loadConversations();
  }
  async function remove(id: string) {
    if (!window.confirm('Delete this conversation?')) return;
    await api.delete(`/nia/conversations/${id}`).catch(() => undefined);
    if (current === id) {
      setCurrent(null);
      setTurns([]);
    }
    void loadConversations();
  }
  async function clearAll() {
    if (!window.confirm('Delete all your Nia history?')) return;
    await api.delete('/nia/conversations').catch(() => undefined);
    setCurrent(null);
    setTurns([]);
    void loadConversations();
  }
  async function toggleHistory() {
    if (!config) return;
    const enabling = !config.history;
    const deleteExisting = !enabling && conversations.length > 0 && window.confirm('History will stop being saved. Also delete what is saved now?');
    await api.put('/nia/history', { enabled: enabling, deleteExisting }).catch(() => undefined);
    void loadConfig();
    void loadConversations();
  }
  async function runAction(result: Result) {
    const action = result.action;
    if (!action) return;
    // Every action is the member's own choice, confirmed here, and done by the normal API with its own checks.
    if (!window.confirm(`${action.label}: ${result.title}?`)) return;
    try {
      if (action.kind === 'SAVE') await api.post('/community/saved', { itemType: action.itemType, itemId: action.itemId });
      if (action.kind === 'JOIN_GROUP') await api.post(`/community/groups/${action.slug}/join`, {});
      setError(action.kind === 'SAVE' ? 'Saved to your wishlist (press again on the item to remove it).' : 'You joined the group.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not work.');
    }
  }

  if (status === 'anonymous') {
    return (
      <div className="shell max-w-xl py-12 text-center">
        <NiaOrb size={96} className="mx-auto" />
        <h1 className="mt-4 text-h1">Meet Nia</h1>
        <p className="mt-2 text-ink-muted">Enhakkore’s assistant helps you find places, experiences, trips, communities, study groups and gaming — from real Enhakkore listings.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/signin?next=/nia" className="inline-flex h-12 items-center rounded-full bg-clay-400 px-6 font-bold text-acacia-700">Sign in</Link>
          <Link href="/join?next=/nia" className="inline-flex h-12 items-center rounded-full border border-line px-6 font-semibold">Create a free account</Link>
        </div>
      </div>
    );
  }
  if (config && (!config.enabled || !config.text)) {
    return <div className="shell max-w-xl py-12 text-center"><NiaOrb size={80} className="mx-auto" /><h1 className="mt-4 text-h2">Nia is switched off at the moment.</h1><p className="mt-2 text-ink-muted">Use the search at the top of the site in the meantime.</p></div>;
  }

  return (
    <div className="shell grid max-w-5xl gap-6 py-6 md:grid-cols-[16rem_1fr] md:py-10">
      <aside className={`${showHistory ? 'block' : 'hidden'} md:block`}>
        <button type="button" onClick={() => { setCurrent(null); setTurns([]); setShowHistory(false); }} className="h-11 w-full rounded-full bg-[#06152a] text-sm font-bold text-white">+ New conversation</button>
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-ink-muted">History</p>
        {!config?.history ? <p className="mt-2 text-sm text-ink-muted">History saving is off.</p> : conversations.length === 0 ? <p className="mt-2 text-sm text-ink-muted">No saved conversations.</p> : (
          <ul className="mt-2 grid gap-1">
            {conversations.map((c) => (
              <li key={c.id} className={`group flex items-center gap-1 rounded-lg ${current === c.id ? 'bg-sand' : ''}`}>
                <button type="button" onClick={() => openConversation(c.id)} className="min-h-10 min-w-0 flex-1 truncate px-2 text-left text-sm">{c.title}</button>
                <button type="button" onClick={() => rename(c.id)} className="h-9 px-1 text-xs text-ink-muted" aria-label={`Rename ${c.title}`}>✎</button>
                <button type="button" onClick={() => remove(c.id)} className="h-9 px-1 text-xs text-danger" aria-label={`Delete ${c.title}`}>✕</button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 grid gap-2 text-sm">
          <label className="flex items-center justify-between gap-2"><span>Save history</span><input type="checkbox" checked={!!config?.history} onChange={toggleHistory} className="h-5 w-5" /></label>
          {conversations.length > 0 && <button type="button" onClick={clearAll} className="text-left text-danger underline">Clear all history</button>}
          {config?.voice && voiceSupported && <label className="flex items-center justify-between gap-2"><span>Read replies aloud</span><input type="checkbox" checked={speakReplies} onChange={(e) => setSpeakReplies(e.target.checked)} className="h-5 w-5" /></label>}
        </div>
      </aside>

      <section className="flex min-h-[70svh] flex-col rounded-2xl border border-line bg-white">
        <header className="flex items-center gap-3 border-b border-line p-4">
          <NiaOrb size={44} state={busy ? 'thinking' : speaking ? 'speaking' : 'idle'} />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold">Nia</h1>
            <p className="text-xs text-ink-muted">Enhakkore’s assistant · answers from real Enhakkore listings{config ? ` · ${Math.max(0, config.dailyLimit - config.usedToday)} questions left today` : ''}</p>
          </div>
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="h-10 rounded-full border border-line px-3 text-sm font-semibold md:hidden">History</button>
        </header>
        {config && !config.aiConnected && <p className="m-4 rounded-xl bg-[#fff8e6] p-3 text-xs text-ink-soft">Nia’s conversation features are not connected yet, so for now she searches Enhakkore and shows what she finds.</p>}
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {turns.length === 0 && (
            <div className="py-6 text-center">
              <NiaOrb size={88} className="mx-auto" />
              <p className="mt-3 font-semibold">Hello, I’m Nia. What are you looking for?</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => ask(s)} className="chip h-auto min-h-10 max-w-full whitespace-normal py-2 text-left">{s}</button>)}
              </div>
            </div>
          )}
          {turns.map((turn, index) => (
            <div key={index} className={turn.role === 'USER' ? 'flex justify-end' : ''}>
              {turn.role === 'USER' ? (
                <p className="max-w-[85%] rounded-2xl bg-acacia-700 px-4 py-2 text-white">{turn.content}</p>
              ) : (
                <div className="max-w-full">
                  <div className="flex gap-2">
                    <NiaOrb size={28} />
                    <p className="whitespace-pre-line rounded-2xl bg-sand px-4 py-2 text-ink">{turn.content}</p>
                  </div>
                  {turn.guide && turn.guide.length > 0 && (
                    <ul className="ml-9 mt-2 grid gap-1">{turn.guide.map((g) => <li key={g.link}><Link href={g.link} className="text-sm font-semibold text-acacia-700 underline">{g.title} ›</Link></li>)}</ul>
                  )}
                  {turn.results && turn.results.length > 0 && (
                    <ul className="ml-9 mt-2 grid gap-2 sm:grid-cols-2">
                      {turn.results.map((r) => (
                        <li key={`${r.type}-${r.id}`} className="overflow-hidden rounded-xl border border-line bg-white">
                          <Link href={r.link} className="flex gap-3 p-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {r.image ? <img src={r.image} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" loading="lazy" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#06152a] text-clay-400">★</span>}
                            <span className="min-w-0">
                              <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-clay-700">{r.type}</span>
                              <span className="block truncate font-semibold">{r.title}</span>
                              {r.subtitle && <span className="line-clamp-2 block text-xs text-ink-muted">{r.subtitle}</span>}
                            </span>
                          </Link>
                          {r.action && <button type="button" onClick={() => runAction(r)} className="w-full border-t border-line py-2 text-sm font-semibold text-acacia-700">{r.action.label}</button>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {config?.voice && voiceSupported && <button type="button" onClick={() => speak(turn.content)} className="ml-9 mt-1 text-xs text-ink-muted underline">🔊 Listen</button>}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-sm text-ink-muted"><NiaOrb size={28} state="thinking" /> Nia is looking…</div>}
          <div ref={end} />
        </div>
        {error && <p role="status" className="mx-4 rounded-xl bg-sand p-3 text-sm text-ink-soft">{error}</p>}
        <form onSubmit={(event) => { event.preventDefault(); void ask(text); }} className="flex gap-2 border-t border-line p-3">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Ask Nia…" aria-label="Ask Nia" className="h-12 min-w-0 flex-1 rounded-full border border-line px-4 outline-none focus:border-acacia-600" />
          {config?.voice && listenSupported && <button type="button" onClick={listen} aria-label={listening ? 'Stop listening' : 'Speak to Nia'} className={`h-12 w-12 shrink-0 rounded-full border text-lg ${listening ? 'border-danger bg-danger-soft' : 'border-line'}`}>🎙️</button>}
          <button disabled={busy || !text.trim()} className="h-12 shrink-0 rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700 disabled:opacity-50">Ask</button>
        </form>
        <p className="px-4 pb-3 text-[0.6875rem] text-ink-faint">Nia can make mistakes. Prices, availability and bookings are confirmed by Enhakkore, not by Nia. She cannot see other members’ private information.</p>
      </section>
    </div>
  );
}
