'use client';

import { useEffect, useState } from 'react';
import { AdminShell, Panel } from '@/components/admin/AdminShell';
import { ApiError, api } from '@/lib/api';
import { useApi } from '@/lib/useApi';

interface ReportRow { id: string; targetType: string; reason: string; status: string; createdAt: string; resolution: string | null; reporter: { name: string; username: string | null } | null }
interface Opened { kind: string; members: { id: string; name: string; username: string | null; status: string }[]; messages: { id: string; reported: boolean; author: string; authorId: string; body: string; kind: string; createdAt: string }[] }

/**
 * Reported private messages and chat messages. Restricted: the team never
 * browses inboxes. Opening a report needs a written reason and shows only the
 * reported message with a few around it. Every opening is in the audit log.
 */
export default function AdminMessagesPage() {
  const { data, reload } = useApi<{ items: ReportRow[] }>('/cc/messages/reports');
  const settings = useApi<{ unsendMinutes: number; pendingLimit: number }>('/cc/messages/settings');
  const [opened, setOpened] = useState<{ id: string; data: Opened } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ unsendMinutes: 15, pendingLimit: 3 });
  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  async function open(id: string) {
    const reason = window.prompt('Why do you need to open this report? (recorded in the audit log)');
    if (!reason) return;
    try {
      setOpened({ id, data: await api.post<Opened>(`/cc/messages/reports/${id}/open`, { reason }) });
      setMessage(null);
      reload();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not open it.');
    }
  }
  async function resolve(status: 'RESOLVED' | 'DISMISSED', options: { removeMessage?: boolean; suspendUserId?: string } = {}) {
    if (!opened) return;
    const resolution = window.prompt('What did you decide? (recorded)');
    if (!resolution) return;
    try {
      await api.post(`/cc/messages/reports/${opened.id}/resolve`, { status, resolution, ...options });
      setOpened(null);
      setMessage('Report closed. The reporter was told it was reviewed.');
      reload();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not close it.');
    }
  }
  const reported = opened?.data.messages.find((m) => m.reported);
  return (
    <AdminShell title="Reported messages" permission="messages.view">
      <p className="mb-4 max-w-3xl text-sm text-ink-muted">Private messages are stored encrypted. The team can read only messages that members reported, after giving a reason — and every opening is recorded in Security & audit.</p>
      {message && <p className="mb-3 rounded-xl bg-sand p-3 text-sm">{message}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Reports">
          <ul className="grid gap-2 text-sm">
            {!data ? <li className="text-ink-muted">Loading…</li> : data.items.length === 0 ? <li className="text-ink-muted">No reports.</li> : data.items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
                <span>
                  <strong>{r.reason}</strong> · {r.targetType === 'MESSAGE' ? 'group chat message' : r.targetType === 'DIRECT_CONVERSATION' ? 'private conversation' : 'private message'}
                  <span className="block text-xs text-ink-muted">{new Date(r.createdAt).toLocaleString('en-GB')} · by {r.reporter?.username ? `@${r.reporter.username}` : r.reporter?.name ?? 'member'} · {r.status.toLowerCase()}{r.resolution ? ` — ${r.resolution}` : ''}</span>
                </span>
                {r.targetType !== 'MESSAGE' && <button type="button" onClick={() => open(r.id)} className="h-9 rounded-full border border-line px-3 text-xs font-semibold">Open with reason</button>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">Group chat reports are also listed under Reviews & reports, where the message text is included.</p>
        </Panel>
        {opened && (
          <Panel title="Reported conversation (excerpt)">
            <p className="text-xs text-ink-muted">Members: {opened.data.members.map((m) => `${m.username ? `@${m.username}` : m.name}${m.status !== 'ACTIVE' ? ` (${m.status.toLowerCase()})` : ''}`).join(', ')}</p>
            <ol className="mt-3 grid gap-2 text-sm">
              {opened.data.messages.map((m) => (
                <li key={m.id} className={`rounded-lg px-3 py-2 ${m.reported ? 'border border-danger/40 bg-danger-soft' : 'bg-sand'}`}>
                  <span className="text-xs font-bold">{m.author}{m.reported ? ' · REPORTED' : ''}</span>
                  <span className="block whitespace-pre-line [overflow-wrap:anywhere]">{m.kind === 'TEXT' ? m.body : `[${m.kind.toLowerCase()}] ${m.body}`}</span>
                  <span className="text-[0.6875rem] text-ink-muted">{new Date(m.createdAt).toLocaleString('en-GB')}</span>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <button type="button" onClick={() => resolve('RESOLVED', { removeMessage: true })} className="h-10 rounded-full bg-acacia-600 px-3 font-bold text-white">Remove message & close</button>
              {reported && <button type="button" onClick={() => window.confirm('Suspend the author’s account? They are signed out everywhere.') && resolve('RESOLVED', { removeMessage: true, suspendUserId: reported.authorId })} className="h-10 rounded-full border border-danger/30 px-3 font-semibold text-danger">Remove & suspend author</button>}
              <button type="button" onClick={() => resolve('DISMISSED')} className="h-10 rounded-full border border-line px-3 font-semibold">Dismiss</button>
            </div>
          </Panel>
        )}
      </div>
      <Panel title="Messaging settings" className="mt-4">
        <form className="grid max-w-xl gap-3 sm:grid-cols-2" onSubmit={async (event) => { event.preventDefault(); try { await api.put('/cc/messages/settings', form); setMessage('Messaging settings saved.'); } catch (caught) { setMessage(caught instanceof ApiError ? caught.message : 'Could not save.'); } }}>
          <label className="grid gap-1 text-sm font-semibold">Members can unsend their message for (minutes)<input type="number" min={0} max={1440} value={form.unsendMinutes} onChange={(e) => setForm((f) => ({ ...f, unsendMinutes: Number(e.target.value) }))} className="field" /></label>
          <label className="grid gap-1 text-sm font-semibold">Messages allowed before a request is accepted<input type="number" min={1} max={20} value={form.pendingLimit} onChange={(e) => setForm((f) => ({ ...f, pendingLimit: Number(e.target.value) }))} className="field" /></label>
          <button className="h-11 w-fit rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Save</button>
        </form>
      </Panel>
    </AdminShell>
  );
}
