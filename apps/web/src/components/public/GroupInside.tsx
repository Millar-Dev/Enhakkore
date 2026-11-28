'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { uploadFile } from '@/lib/upload';

interface Session { id: string; title: string; description: string | null; mode: string; startsAt: string; endsAt: string | null; location: string | null; link: string | null; going: number; maybe: number; myRsvp: string | null }
interface Resource { id: string; kind: string; title: string; body: string | null; url: string | null; createdAt: string; mine: boolean; author: string }

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dar_es_Salaam' });

/**
 * The inside of a community or study group, for members: sessions with RSVP
 * and reminders, shared notes, files and links, and (for admins and
 * moderators) invitation links and the group password.
 */
export function GroupInside({ slug, isStudy }: { slug: string; isStudy: boolean }) {
  const { status } = useSession();
  const [access, setAccess] = useState<{ member: boolean; manager: boolean; private: boolean } | null>(null);
  useEffect(() => {
    if (status !== 'authenticated') return;
    api
      .get<{ locked?: boolean; viewer: { isMember: boolean; role: string | null } | null; community: { accessType?: string } }>(`/public/communities/${slug}`)
      .then((data) => setAccess({ member: !!data.viewer?.isMember, manager: data.viewer?.role === 'ADMIN' || data.viewer?.role === 'MODERATOR', private: data.community.accessType === 'PRIVATE' }))
      .catch(() => setAccess(null));
  }, [status, slug]);
  if (!access?.member) return null;
  return (
    <div className="space-y-10">
      <Sessions slug={slug} manager={access.manager} isStudy={isStudy} />
      <Resources slug={slug} manager={access.manager} />
      {access.manager && <ManageAccess slug={slug} isPrivate={access.private} />}
    </div>
  );
}

function Sessions({ slug, manager, isStudy }: { slug: string; manager: boolean; isStudy: boolean }) {
  const [items, setItems] = useState<Session[] | null>(null);
  const [form, setForm] = useState({ title: '', mode: 'ONLINE', startsAt: '', location: '', link: '', description: '' });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api.get<{ items: Session[] }>(`/community/groups/${slug}/sessions`).then((d) => setItems(d.items)).catch(() => setItems([])), [slug]);
  useEffect(() => {
    void load();
  }, [load]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api.post(`/community/groups/${slug}/sessions`, { ...form, startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : '' });
      setOpen(false);
      setForm({ title: '', mode: 'ONLINE', startsAt: '', location: '', link: '', description: '' });
      void load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not add the session.');
    }
  }
  return (
    <section id="sessions" className="scroll-mt-24">
      <div className="flex items-end justify-between gap-2">
        <h2 className="text-h3">{isStudy ? 'Study sessions' : 'Group sessions'}</h2>
        {manager && <button type="button" onClick={() => setOpen((v) => !v)} className="h-10 rounded-full border border-line px-4 text-sm font-semibold">+ Add session</button>}
      </div>
      {open && (
        <form onSubmit={create} className="mt-3 grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2">
          {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Title<input required minLength={3} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="field" /></label>
          <label className="grid gap-1 text-sm font-semibold">How<select value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))} className="field"><option value="ONLINE">Online</option><option value="PHYSICAL">In person</option><option value="HYBRID">Hybrid</option></select></label>
          <label className="grid gap-1 text-sm font-semibold">Starts<input type="datetime-local" required value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} className="field" /></label>
          {form.mode !== 'ONLINE' && <label className="grid gap-1 text-sm font-semibold">Place<input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="field" /></label>}
          {form.mode !== 'PHYSICAL' && <label className="grid gap-1 text-sm font-semibold">Meeting link<input type="url" value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} className="field" placeholder="https://" /></label>}
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Notes<textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="field" /></label>
          <button className="h-11 rounded-full bg-acacia-600 text-sm font-bold text-white sm:col-span-2">Add session and tell members</button>
        </form>
      )}
      <ul className="mt-3 grid gap-2">
        {items === null ? <li className="text-sm text-ink-muted">Loading…</li> : items.length === 0 ? <li className="text-sm text-ink-muted">No sessions scheduled.</li> : items.map((s) => (
          <li key={s.id} className="rounded-xl border border-line bg-white p-4 text-sm">
            <p className="font-semibold">{s.title}</p>
            <p className="text-ink-muted">{when(s.startsAt)} · {s.mode === 'ONLINE' ? 'Online' : s.mode === 'HYBRID' ? 'Hybrid' : 'In person'}{s.location ? ` · ${s.location}` : ''}</p>
            {s.link && <a href={s.link} target="_blank" rel="noreferrer noopener" className="text-acacia-700 underline">Meeting link</a>}
            {s.description && <p className="mt-1 text-ink-soft">{s.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(['GOING', 'MAYBE', 'NOT_GOING'] as const).map((value) => (
                <button key={value} type="button" onClick={() => api.post(`/community/groups/${slug}/sessions/${s.id}/rsvp`, { status: value }).then(load)} className={`chip ${s.myRsvp === value ? 'chip-active' : ''}`}>{value === 'GOING' ? 'Going' : value === 'MAYBE' ? 'Maybe' : 'Can’t go'}</button>
              ))}
              <span className="text-xs text-ink-muted">{s.going} going · {s.maybe} maybe · reminder an hour before</span>
              {manager && <button type="button" onClick={() => window.confirm('Cancel this session? Members who replied are told.') && api.delete(`/community/groups/${slug}/sessions/${s.id}`).then(load)} className="text-xs text-danger underline">Cancel</button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Resources({ slug, manager }: { slug: string; manager: boolean }) {
  const [items, setItems] = useState<Resource[] | null>(null);
  const [kind, setKind] = useState<'NOTE' | 'LINK' | 'FILE'>('NOTE');
  const [form, setForm] = useState({ title: '', body: '', url: '' });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api.get<{ items: Resource[] }>(`/community/groups/${slug}/resources`).then((d) => setItems(d.items)).catch(() => setItems([])), [slug]);
  useEffect(() => {
    void load();
  }, [load]);
  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api.post(`/community/groups/${slug}/resources`, { kind, ...form });
      setForm({ title: '', body: '', url: '' });
      setOpen(false);
      void load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not add it.');
    }
  }
  return (
    <section id="resources" className="scroll-mt-24">
      <div className="flex items-end justify-between gap-2">
        <h2 className="text-h3">Notes, files & links</h2>
        <button type="button" onClick={() => setOpen((v) => !v)} className="h-10 rounded-full border border-line px-4 text-sm font-semibold">+ Share</button>
      </div>
      {open && (
        <form onSubmit={add} className="mt-3 grid gap-3 rounded-2xl border border-line bg-white p-4">
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">{(['NOTE', 'LINK', 'FILE'] as const).map((k) => <button key={k} type="button" onClick={() => setKind(k)} className={`chip ${kind === k ? 'chip-active' : ''}`}>{k === 'NOTE' ? 'Note' : k === 'LINK' ? 'Link' : 'File (PDF…)'}</button>)}</div>
          <label className="grid gap-1 text-sm font-semibold">Title<input required minLength={2} maxLength={160} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="field" /></label>
          {kind === 'NOTE' && <label className="grid gap-1 text-sm font-semibold">Note<textarea required rows={6} maxLength={20000} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} className="field" /></label>}
          {kind === 'LINK' && <label className="grid gap-1 text-sm font-semibold">Link<input type="url" required value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} className="field" placeholder="https://" /></label>}
          {kind === 'FILE' && (
            <label className="grid gap-1 text-sm font-semibold">File
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="text-sm" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const stored = await uploadFile('CHAT_MEDIA', file); setForm((f) => ({ ...f, url: stored.url ?? '', title: f.title || file.name })); } catch { setError('The file could not be uploaded.'); } }} />
              {form.url && <span className="text-xs font-normal text-ink-muted">Uploaded.</span>}
            </label>
          )}
          <p className="text-xs text-ink-muted">Share only material you are allowed to share.</p>
          <button className="h-11 rounded-full bg-acacia-600 text-sm font-bold text-white">Share with the group</button>
        </form>
      )}
      <ul className="mt-3 grid gap-2">
        {items === null ? <li className="text-sm text-ink-muted">Loading…</li> : items.length === 0 ? <li className="text-sm text-ink-muted">Nothing shared yet.</li> : items.map((r) => (
          <li key={r.id} className="rounded-xl border border-line bg-white p-4 text-sm">
            <p className="flex items-start justify-between gap-2">
              <span className="font-semibold">{r.kind === 'NOTE' ? '📝' : r.kind === 'LINK' ? '🔗' : '📄'} {r.url ? <a href={r.url} target="_blank" rel="noreferrer noopener" className="underline">{r.title}</a> : r.title}</span>
              {(r.mine || manager) && <button type="button" onClick={() => window.confirm('Remove this?') && api.delete(`/community/groups/${slug}/resources/${r.id}`).then(load)} className="shrink-0 text-xs text-danger underline">Remove</button>}
            </p>
            {r.body && <details className="mt-1"><summary className="cursor-pointer text-acacia-700">Read note</summary><p className="mt-1 whitespace-pre-line text-ink-soft">{r.body}</p></details>}
            <p className="mt-1 text-xs text-ink-muted">{r.author} · {new Date(r.createdAt).toLocaleDateString('en-GB')}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ManageAccess({ slug, isPrivate }: { slug: string; isPrivate: boolean }) {
  const [data, setData] = useState<{ hasPassword: boolean; items: { id: string; createdAt: string; expiresAt: string | null; maxUses: number | null; uses: number; active: boolean }[] } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(() => api.get<NonNullable<typeof data>>(`/community/groups/${slug}/invites`).then(setData).catch(() => undefined), [slug]);
  useEffect(() => {
    void load();
  }, [load]);
  async function run(promise: Promise<unknown>, done: string) {
    try {
      await promise;
      setMessage(done);
      void load();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'That did not work.');
    }
  }
  return (
    <section className="rounded-2xl border border-clay-400/60 bg-[#fff8e6] p-4 text-sm">
      <h2 className="font-bold">Invitations & access (admins and moderators)</h2>
      {message && <p className="mt-2 rounded-lg bg-white p-2">{message}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => api.post<{ link: string }>(`/community/groups/${slug}/invites`, { days: 7 }).then((r) => { setLink(r.link); void load(); }).catch((caught) => setMessage(caught instanceof ApiError ? caught.message : 'Could not create a link.'))} className="h-10 rounded-full bg-acacia-600 px-4 font-bold text-white">New invitation link (7 days)</button>
        <button type="button" onClick={() => api.post<{ link: string }>(`/community/groups/${slug}/invites`, { days: 2, maxUses: 1 }).then((r) => { setLink(r.link); void load(); })} className="h-10 rounded-full border border-line bg-white px-4 font-semibold">Single-use link</button>
      </div>
      {link && (
        <div className="mt-3 rounded-lg bg-white p-3">
          <p className="break-all font-mono text-xs">{link}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => navigator.clipboard?.writeText(link).then(() => setMessage('Link copied.'))} className="h-9 rounded-full border border-line px-3 text-xs font-semibold">Copy</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer noopener" className="inline-flex h-9 items-center rounded-full border border-line px-3 text-xs font-semibold">WhatsApp</a>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Shown once. Anyone with the link can join until it expires or you revoke it.</p>
        </div>
      )}
      {data && data.items.length > 0 && (
        <ul className="mt-3 grid gap-1">
          {data.items.slice(0, 8).map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs">
              <span>Created {new Date(item.createdAt).toLocaleDateString('en-GB')} · used {item.uses}{item.maxUses ? `/${item.maxUses}` : ''}{item.expiresAt ? ` · until ${new Date(item.expiresAt).toLocaleDateString('en-GB')}` : ''}</span>
              {item.active ? <button type="button" onClick={() => run(api.delete(`/community/groups/${slug}/invites/${item.id}`), 'Link revoked.')} className="text-danger underline">Revoke</button> : <span className="text-ink-faint">inactive</span>}
            </li>
          ))}
        </ul>
      )}
      {isPrivate && (
        <form className="mt-4 grid gap-2" onSubmit={(event) => { event.preventDefault(); void run(api.put(`/community/groups/${slug}/password`, { password: password || null }), password ? 'Password set. Share it privately.' : 'Password removed — invitation links only.'); setPassword(''); }}>
          <p className="font-semibold">Group password {data?.hasPassword ? '(set)' : '(not set)'}</p>
          <p className="text-xs text-ink-muted">Stored scrambled — nobody can read it back, not even the Enhakkore team. Setting a new one replaces it.</p>
          <div className="flex gap-2">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} maxLength={100} placeholder="New password (6+ characters)" aria-label="New group password" className="field flex-1 bg-white" autoComplete="new-password" />
            <button className="h-11 rounded-full border border-line bg-white px-4 font-semibold">{password ? 'Set' : 'Remove'}</button>
          </div>
        </form>
      )}
      <button type="button" onClick={() => run(api.put(`/community/groups/${slug}/visibility`, { visibility: isPrivate ? 'PUBLIC' : 'PRIVATE' }).then(() => window.location.reload()), 'Changed.')} className="mt-3 text-xs underline">{isPrivate ? 'Make the group public' : 'Make the group private'}</button>
    </section>
  );
}
