'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AdminShell, Panel } from '@/components/admin/AdminShell';
import { ApiError, api } from '@/lib/api';

interface Entry {
  id: string;
  mode: 'BETHANY' | 'ARIEL';
  prompt: string;
  reply: string;
  actions: { tool: string; ok: boolean; error?: string; confirmed?: boolean }[];
  pending: { tool: string; summary: string } | null;
  status: string;
  createdAt: string;
}
interface Data { configured: boolean; model: string; items: Entry[] }

const SUGGESTIONS: Record<'BETHANY' | 'ARIEL', string[]> = {
  BETHANY: ['Hey Bethany, add a hotel in Arusha called …', 'Hey Bethany, hide the restaurant …', 'Hey Bethany, update the Arusha trip description: …', 'Hey Bethany, close the jogging group chat', 'Hey Bethany, create a Saturday activity for the jogging community'],
  ARIEL: ['Hello Ariel, how are we doing today?', 'Hello Ariel, what is waiting for me?', 'Hello Ariel, which places are most popular?', 'Hello Ariel, any technical problems this week?', 'Hello Ariel, what changed on the website recently?'],
};

/**
 * One assistant, two modes. Bethany (working mode) can change content through
 * checked, logged server actions; sensitive changes wait for your confirmation.
 * Ariel (reporting mode) can only read and report.
 */
export default function AssistantPage() {
  const [data, setData] = useState<Data | null>(null);
  const [mode, setMode] = useState<'BETHANY' | 'ARIEL'>('ARIEL');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const load = () => api.get<Data>('/cc/assistant').then(setData).catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Could not load.'));
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [data?.items.length]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const entry = await api.post<Entry>('/cc/assistant', { prompt: text, mode });
      setMode(entry.mode);
      setData((current) => (current ? { ...current, items: [...current.items, entry] } : current));
      setPrompt('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The assistant could not be reached.');
    } finally {
      setBusy(false);
    }
  }

  async function decide(entry: Entry, confirm: boolean) {
    try {
      const updated = await api.post<Entry>(`/cc/assistant/${entry.id}/confirm`, { confirm });
      setData((current) => (current ? { ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) } : current));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not complete that.');
    }
  }

  const persona = mode === 'BETHANY' ? { name: 'Bethany', role: 'Working mode', body: 'Adds and edits listings, drafts activities, manages visibility, announcements, chats and homepage sections. Sensitive changes wait for your confirmation.' } : { name: 'Ariel', role: 'Reporting mode', body: 'Reports activity, what is waiting, popular listings, recent changes and technical problems. Read-only — never changes anything.' };

  return (
    <AdminShell title="AI Assistant" permission="*">
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <aside className="grid gap-3 self-start">
          <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Assistant mode">
            {(['BETHANY', 'ARIEL'] as const).map((value) => (
              <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)} className={`rounded-xl border p-3 text-left ${mode === value ? 'border-clay-400 bg-clay-400 text-acacia-700' : 'border-line bg-white text-ink'}`}>
                <span className="block font-bold">{value === 'BETHANY' ? 'Bethany' : 'Ariel'}</span>
                <span className="text-xs opacity-80">{value === 'BETHANY' ? 'Working mode' : 'Reporting mode'}</span>
              </button>
            ))}
          </div>
          <Panel>
            <p className="font-bold text-acacia-700">{persona.name} · {persona.role}</p>
            <p className="mt-1 text-sm text-ink-soft">{persona.body}</p>
            <p className="mt-2 text-xs text-ink-muted">Start with “Hey Bethany” or “Hello Ariel” to switch automatically. Payments, refunds, deletions and staff permissions are never done by the assistant.</p>
          </Panel>
          {data && !data.configured && (
            <Panel>
              <p className="text-sm font-bold text-warning">Not connected yet</p>
              <p className="mt-1 text-sm text-ink-soft">Add an Anthropic API key as <code>ANTHROPIC_API_KEY</code> to the API service on Render. Until then the assistant records your requests but does nothing.</p>
            </Panel>
          )}
          {data && <p className="text-xs text-ink-muted">Model: {data.model}. Every request and action is kept in this history and in the <Link href="/admin/security" className="underline">audit log</Link>.</p>}
        </aside>

        <section className="grid gap-3">
          <Panel className="max-h-[60vh] overflow-y-auto">
            {!data ? <p className="text-sm text-ink-muted">Loading…</p> : data.items.length === 0 ? (
              <p className="text-sm text-ink-muted">No conversations yet. Try one of the suggestions below.</p>
            ) : (
              <ol className="grid gap-4">
                {data.items.map((entry) => (
                  <li key={entry.id} className="grid gap-2 text-sm">
                    <p className="ml-auto max-w-[85%] rounded-2xl bg-acacia-700 px-3 py-2 text-white">{entry.prompt}</p>
                    <div className="max-w-[90%] rounded-2xl bg-sand px-3 py-2 text-ink">
                      <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-clay-600">{entry.mode === 'BETHANY' ? 'Bethany' : 'Ariel'}{entry.status === 'NOT_CONFIGURED' ? ' · not connected' : entry.status === 'FAILED' ? ' · failed' : ''}</p>
                      <p className="mt-1 whitespace-pre-line [overflow-wrap:anywhere]">{entry.reply}</p>
                      {entry.actions.length > 0 && (
                        <ul className="mt-2 grid gap-0.5 text-xs text-ink-muted">
                          {entry.actions.map((action, index) => <li key={index}>{action.ok ? '✓' : '✕'} {action.tool.replace(/_/g, ' ')}{action.confirmed ? ' (confirmed)' : ''}{action.error ? ` — ${action.error}` : ''}</li>)}
                        </ul>
                      )}
                      {entry.status === 'AWAITING_CONFIRMATION' && entry.pending && (
                        <div className="mt-3 rounded-xl border border-clay-400 bg-white p-3">
                          <p className="text-xs font-bold text-ink">Confirm: {entry.pending.summary}</p>
                          <div className="mt-2 flex gap-2">
                            <button type="button" onClick={() => decide(entry, true)} className="h-10 rounded-full bg-acacia-600 px-4 text-xs font-bold text-white">Confirm</button>
                            <button type="button" onClick={() => decide(entry, false)} className="h-10 rounded-full border border-line-strong px-4 text-xs font-semibold">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div ref={end} />
          </Panel>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS[mode].map((text) => <button key={text} type="button" onClick={() => setPrompt(text)} className="chip text-xs">{text}</button>)}
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <form onSubmit={(event) => { event.preventDefault(); void send(prompt); }} className="flex flex-col gap-2 sm:flex-row">
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} maxLength={4000} placeholder={mode === 'BETHANY' ? 'Hey Bethany, …' : 'Hello Ariel, …'} aria-label="Message to the assistant" className="field w-full sm:flex-1" onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(prompt); } }} />
            <button disabled={busy} className="h-12 rounded-full bg-clay-400 px-6 font-bold text-acacia-700 disabled:opacity-50">{busy ? 'Working…' : 'Send'}</button>
          </form>
        </section>
      </div>
    </AdminShell>
  );
}
