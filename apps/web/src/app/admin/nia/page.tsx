'use client';

import { useEffect, useState } from 'react';
import { AdminShell, Panel } from '@/components/admin/AdminShell';
import { NiaOrb } from '@/components/nia/NiaOrb';
import { ApiError, api } from '@/lib/api';
import { useApi } from '@/lib/useApi';

interface Data {
  settings: { enabled: boolean; text: boolean; voice: boolean; dailyLimit: number; categories: string[] };
  categories: { key: string; label: string }[];
  aiConnected: boolean;
  analytics: { days: { day: string; questions: number; members: number }[]; totalQuestions: number; resultsShownByType: Record<string, number>; note: string };
}

/** Nia's switches, limits and what she searches — and privacy-safe usage counts. */
export default function AdminNiaPage() {
  const { data, reload } = useApi<Data>('/cc/nia');
  const [form, setForm] = useState<Data['settings'] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (data) setForm(data.settings);
  }, [data]);
  async function save() {
    if (!form) return;
    try {
      await api.put('/cc/nia', form);
      setMessage('Saved.');
      reload();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not save.');
    }
  }
  const max = Math.max(1, ...(data?.analytics.days.map((d) => d.questions) ?? [1]));
  return (
    <AdminShell title="Nia AI" permission="nia.view">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Nia for members">
          <div className="flex items-center gap-3"><NiaOrb size={56} /><p className="text-sm text-ink-soft">Nia helps members discover listings, communities, study groups and gaming, using only real Enhakkore records. She can offer to save an item or join a public group; the member confirms. She never approves payments or refunds and cannot see private information.</p></div>
          <p className={`mt-3 rounded-xl p-3 text-sm ${data?.aiConnected ? 'bg-acacia-50 text-acacia-700' : 'bg-[#fff8e6] text-ink-soft'}`}>{data?.aiConnected ? 'Conversation features are connected (Anthropic API key set on the API).' : 'Conversation features are not connected: Nia searches and lists results only. Add ANTHROPIC_API_KEY to the API service on Render to connect them.'}</p>
          {message && <p className="mt-3 rounded-xl bg-sand p-2 text-sm">{message}</p>}
          {form && (
            <div className="mt-4 grid gap-3 text-sm">
              {([['enabled', 'Nia is switched on'], ['text', 'Text conversations'], ['voice', 'Voice (speak and listen, where the member’s browser supports it)']] as const).map(([key, text]) => (
                <label key={key} className="flex items-center justify-between gap-3"><span>{text}</span><input type="checkbox" checked={form[key]} onChange={(e) => setForm((f) => (f ? { ...f, [key]: e.target.checked } : f))} className="h-5 w-5" /></label>
              ))}
              <label className="grid gap-1 font-semibold">Questions per member per day<input type="number" min={1} max={1000} value={form.dailyLimit} onChange={(e) => setForm((f) => (f ? { ...f, dailyLimit: Number(e.target.value) } : f))} className="field" /></label>
              <fieldset>
                <legend className="font-semibold">What Nia may search</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data?.categories.map((c) => (
                    <label key={c.key} className={`chip cursor-pointer ${form.categories.includes(c.key) ? 'chip-active' : ''}`}>
                      <input type="checkbox" className="sr-only" checked={form.categories.includes(c.key)} onChange={() => setForm((f) => (f ? { ...f, categories: f.categories.includes(c.key) ? f.categories.filter((k) => k !== c.key) : [...f.categories, c.key] } : f))} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <button type="button" onClick={save} className="h-11 w-fit rounded-full bg-acacia-600 px-5 font-bold text-white">Save settings</button>
            </div>
          )}
        </Panel>
        <Panel title="Usage (last 30 days)">
          <p className="text-sm text-ink-muted">{data?.analytics.note}</p>
          <p className="mt-3 text-3xl font-bold">{data?.analytics.totalQuestions ?? '…'} <span className="text-sm font-normal text-ink-muted">questions</span></p>
          <ul className="mt-3 grid gap-1 text-xs">
            {(data?.analytics.days ?? []).slice(-14).map((d) => (
              <li key={d.day} className="grid grid-cols-[5.5rem_1fr_4rem] items-center gap-2">
                <span>{d.day}</span>
                <span className="h-3 rounded bg-clay-400" style={{ width: `${(d.questions / max) * 100}%` }} aria-hidden />
                <span className="text-right">{d.questions} · {d.members}👤</span>
              </li>
            ))}
          </ul>
          {data && Object.keys(data.analytics.resultsShownByType).length > 0 && (
            <p className="mt-3 text-sm">Results shown: {Object.entries(data.analytics.resultsShownByType).map(([type, count]) => `${type} ${count}`).join(' · ')}</p>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}
