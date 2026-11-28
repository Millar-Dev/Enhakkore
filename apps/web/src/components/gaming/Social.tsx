'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { GAMING_PLATFORMS, GAMING_SESSION_TYPES } from '@enhakkore/shared';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { uploadFile } from '@/lib/upload';

function SignInPrompt({ next, text }: { next: string; text: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 text-center">
      <p className="text-ink-soft">{text}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Link href={`/signin?next=${encodeURIComponent(next)}`} className="inline-flex h-11 items-center rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700">Sign in</Link>
        <Link href={`/join?next=${encodeURIComponent(next)}`} className="inline-flex h-11 items-center rounded-full border border-line px-5 text-sm font-semibold">Create a free account</Link>
      </div>
    </div>
  );
}

/* ---------------------------------- Sessions ---------------------------------- */

interface SessionCard { slug: string; title: string; game: string; platform: string; mode: string; sessionType: string; startsAt: string; capacity: number; joined: number; spotsLeft: number; location: string | null; onlinePlatform: string | null; description: string | null; status: string; organiser: string | null; mine: boolean; joinedByMe: boolean }
const SESSION_TYPE = Object.fromEntries(GAMING_SESSION_TYPES.map((t) => [t.key, t.label]));
const time = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dar_es_Salaam' });

export function SessionsBrowser() {
  const { status } = useSession();
  const [items, setItems] = useState<SessionCard[] | null>(null);
  const [mode, setMode] = useState('');
  const [game, setGame] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', game: '', platform: 'Mobile', mode: 'ONLINE', sessionType: 'CASUAL', startsAt: '', capacity: 4, location: '', onlinePlatform: '', description: '' });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => api.get<{ items: SessionCard[] }>(`/public/gaming/sessions?mode=${mode}&game=${encodeURIComponent(game)}`).then((d) => setItems(d.items)).catch(() => setItems([])), 250);
    return () => window.clearTimeout(timer);
  }, [mode, game]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await api.post<{ slug: string }>('/gaming/sessions', { ...form, capacity: Number(form.capacity), startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : '' });
      window.location.href = `/experiences/gaming/sessions/${result.slug}`;
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the session.');
    }
  }
  return (
    <div className="shell py-8 md:py-12">
      <Link href="/experiences/gaming" className="kicker inline-flex min-h-10 items-center">← Gaming Hub</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1">Gaming sessions</h1>
          <p className="mt-1 text-sm text-ink-muted">Casual matches, team practice, training and meet-ups — separate from tournaments.</p>
        </div>
        <button type="button" onClick={() => setCreating((v) => !v)} className="h-11 rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700">+ Organise a session</button>
      </div>
      {creating && (status === 'authenticated' ? (
        <form onSubmit={create} className="mt-5 grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2">
          {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Title<input required minLength={3} maxLength={120} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="field" /></label>
          <label className="grid gap-1 text-sm font-semibold">Game<input required value={form.game} onChange={(e) => setForm((f) => ({ ...f, game: e.target.value }))} className="field" /></label>
          <label className="grid gap-1 text-sm font-semibold">Platform<select value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))} className="field">{GAMING_PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-semibold">Type<select value={form.sessionType} onChange={(e) => setForm((f) => ({ ...f, sessionType: e.target.value }))} className="field">{GAMING_SESSION_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-semibold">Where<select value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))} className="field"><option value="ONLINE">Online</option><option value="PHYSICAL">In person (public venue)</option></select></label>
          <label className="grid gap-1 text-sm font-semibold">Starts<input type="datetime-local" required value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} className="field" /></label>
          <label className="grid gap-1 text-sm font-semibold">Players (including you)<input type="number" min={2} max={200} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))} className="field" /></label>
          {form.mode === 'PHYSICAL' ? <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Venue (a public place)<input required value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="field" /></label> : <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Room code / server (shown to players only)<input value={form.onlinePlatform} onChange={(e) => setForm((f) => ({ ...f, onlinePlatform: e.target.value }))} className="field" /></label>}
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Description<textarea rows={2} maxLength={2000} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="field" /></label>
          <button className="h-12 rounded-full bg-acacia-600 text-sm font-bold text-white sm:col-span-2">Publish session</button>
        </form>
      ) : <div className="mt-5"><SignInPrompt next="/experiences/gaming/sessions" text="Sign in to organise a gaming session." /></div>)}
      <div className="mt-5 flex flex-wrap gap-2">
        <input value={game} onChange={(e) => setGame(e.target.value)} placeholder="Game…" aria-label="Filter by game" className="h-11 rounded-full border border-line px-4 text-sm outline-none" />
        {['', 'ONLINE', 'PHYSICAL'].map((key) => <button key={key} type="button" onClick={() => setMode(key)} className={`chip ${mode === key ? 'chip-active' : ''}`}>{key === '' ? 'All' : key === 'ONLINE' ? 'Online' : 'In person'}</button>)}
      </div>
      {items === null ? <p className="mt-5 text-sm text-ink-muted">Loading…</p> : items.length === 0 ? <p className="mt-5 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">No upcoming sessions. Organise one!</p> : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <li key={s.slug}><Link href={`/experiences/gaming/sessions/${s.slug}`} className="card-lift block h-full rounded-2xl border border-line bg-white p-4">
              <span className="text-xs font-semibold text-clay-700">{SESSION_TYPE[s.sessionType] ?? s.sessionType} · {s.mode === 'ONLINE' ? 'Online' : 'In person'}</span>
              <span className="mt-1 block text-lg font-bold">{s.title}</span>
              <span className="block text-sm text-ink-muted">{s.game} · {s.platform}</span>
              <span className="mt-2 block text-sm">{time(s.startsAt)}</span>
              <span className="mt-1 block text-xs text-ink-muted">{s.spotsLeft > 0 ? `${s.spotsLeft} place${s.spotsLeft === 1 ? '' : 's'} left` : 'Full'}{s.organiser ? ` · by ${s.organiser}` : ''}</span>
            </Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SessionDetail({ slug }: { slug: string }) {
  const { status } = useSession();
  const [data, setData] = useState<{ session: SessionCard; players: string[] } | null | 'missing'>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(() => api.get<{ session: SessionCard; players: string[] }>(`/public/gaming/sessions/${slug}`).then(setData).catch(() => setData('missing')), [slug]);
  useEffect(() => {
    void load();
  }, [load]);
  async function run(path: string) {
    try {
      await api.post(path);
      void load();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'That did not work.');
    }
  }
  if (data === null) return <div className="shell py-12 text-sm text-ink-muted">Loading…</div>;
  if (data === 'missing') return <div className="shell py-12"><h1 className="text-h2">This session is not available.</h1><Link href="/experiences/gaming/sessions" className="mt-3 inline-block underline">See other sessions</Link></div>;
  const s = data.session;
  return (
    <div className="shell max-w-2xl py-8 md:py-12">
      <Link href="/experiences/gaming/sessions" className="kicker inline-flex min-h-10 items-center">← Gaming sessions</Link>
      <p className="text-sm font-semibold text-clay-700">{SESSION_TYPE[s.sessionType]} · {s.game} · {s.platform}</p>
      <h1 className="text-h1">{s.title}</h1>
      <p className="mt-2 text-ink-soft">{time(s.startsAt)} · {s.mode === 'ONLINE' ? 'Online' : s.location}</p>
      <p className="mt-1 text-sm text-ink-muted">{s.joined}/{s.capacity} players{s.organiser ? ` · organised by ${s.organiser}` : ''}{s.status !== 'OPEN' ? ` · ${s.status.toLowerCase()}` : ''}</p>
      {s.description && <p className="mt-4 whitespace-pre-line">{s.description}</p>}
      {s.onlinePlatform && <p className="mt-4 rounded-xl bg-sand p-3 text-sm"><strong>For players:</strong> {s.onlinePlatform}</p>}
      {message && <p className="mt-4 rounded-xl bg-sand p-3 text-sm">{message}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        {status !== 'authenticated' ? <SignInPrompt next={`/experiences/gaming/sessions/${slug}`} text="Sign in to join this session." /> : s.mine ? (
          s.status !== 'CANCELLED' && <button type="button" onClick={() => window.confirm('Cancel this session? Players are told.') && run(`/gaming/sessions/${slug}/cancel`)} className="h-11 rounded-full border border-danger/30 px-5 text-sm font-semibold text-danger">Cancel session</button>
        ) : s.joinedByMe ? (
          <button type="button" onClick={() => run(`/gaming/sessions/${slug}/leave`)} className="h-11 rounded-full border border-line px-5 text-sm font-semibold">Leave</button>
        ) : s.status === 'OPEN' ? (
          <button type="button" onClick={() => run(`/gaming/sessions/${slug}/join`)} className="h-11 rounded-full bg-clay-400 px-6 text-sm font-bold text-acacia-700">Join session</button>
        ) : <p className="text-sm text-ink-muted">This session is not taking players.</p>}
      </div>
      {data.players.length > 0 && <p className="mt-5 text-sm text-ink-muted">Players: {data.players.join(', ')}</p>}
    </div>
  );
}

/* ------------------------------- Squads & guilds ------------------------------- */

interface GroupCard { slug: string; name: string; kind: string; game: string | null; description: string | null; privacy: string; members: number; squads: number; guild: { name: string; slug: string } | null }
const KIND = { GUILD: 'Guild', SQUAD: 'Squad', TEAM: 'Team' } as Record<string, string>;

export function GroupsBrowser() {
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<GroupCard[] | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => api.get<{ items: GroupCard[] }>(`/public/gaming/groups?kind=${kind}&q=${encodeURIComponent(q)}`).then((d) => setItems(d.items)).catch(() => setItems([])), 250);
    return () => window.clearTimeout(timer);
  }, [kind, q]);
  return (
    <div className="shell py-8 md:py-12">
      <Link href="/experiences/gaming" className="kicker inline-flex min-h-10 items-center">← Gaming Hub</Link>
      <h1 className="text-h1">Squads, guilds & teams</h1>
      <p className="mt-1 text-sm text-ink-muted">A guild can hold several squads; teams stand on their own. Create yours in <Link href="/account/gaming?tab=friends&view=squads" className="underline">Gaming Hub → Squads & Guilds</Link>.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search" className="h-11 rounded-full border border-line px-4 text-sm outline-none" />
        {['', 'GUILD', 'SQUAD', 'TEAM'].map((key) => <button key={key} type="button" onClick={() => setKind(key)} className={`chip ${kind === key ? 'chip-active' : ''}`}>{key ? `${KIND[key]}s` : 'All'}</button>)}
      </div>
      {items === null ? <p className="mt-5 text-sm text-ink-muted">Loading…</p> : items.length === 0 ? <p className="mt-5 text-sm text-ink-muted">None yet.</p> : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((g) => (
            <li key={g.slug}><Link href={`/experiences/gaming/groups/${g.slug}`} className="card-lift block h-full rounded-2xl border border-line bg-white p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-clay-700">{KIND[g.kind]}{g.guild ? ` · ${g.guild.name}` : ''}</span>
              <span className="mt-1 block text-lg font-bold">{g.name}</span>
              <span className="block text-sm text-ink-muted">{g.members} members{g.kind === 'GUILD' ? ` · ${g.squads} squads` : ''}{g.game ? ` · ${g.game}` : ''}{g.privacy === 'INVITE' ? ' · invitation only' : ''}</span>
            </Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GroupDetail({ slug }: { slug: string }) {
  const { status } = useSession();
  const [data, setData] = useState<{ group: GroupCard & { squads: { name: string; slug: string; game: string | null }[] }; members: { userId: string; name: string; role: string }[]; requests: { userId: string; name: string }[]; viewer: { status: string | null; role: string | null; canManage: boolean; conversationId: string | null } | null } | null | 'missing'>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [friends, setFriends] = useState<{ member: { id: string; name: string; username: string | null } }[]>([]);
  const load = useCallback(() => api.get<NonNullable<Exclude<typeof data, 'missing'>>>(`/public/gaming/groups/${slug}`).then(setData).catch(() => setData('missing')), [slug]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (data && data !== 'missing' && data.viewer?.canManage) api.get<{ friends: typeof friends }>('/social/friends').then((d) => setFriends(d.friends)).catch(() => undefined);
  }, [data]);
  async function run(promise: Promise<unknown>, done?: string) {
    try {
      await promise;
      if (done) setMessage(done);
      void load();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'That did not work.');
    }
  }
  if (data === null) return <div className="shell py-12 text-sm text-ink-muted">Loading…</div>;
  if (data === 'missing') return <div className="shell py-12"><h1 className="text-h2">Not found.</h1></div>;
  const { group, viewer } = data;
  return (
    <div className="shell max-w-2xl py-8 md:py-12">
      <Link href="/experiences/gaming/groups" className="kicker inline-flex min-h-10 items-center">← Squads & guilds</Link>
      <p className="text-sm font-bold uppercase tracking-wider text-clay-700">{KIND[group.kind]}{group.guild ? <> in <Link href={`/experiences/gaming/groups/${group.guild.slug}`} className="underline">{group.guild.name}</Link></> : null}</p>
      <h1 className="text-h1">{group.name}</h1>
      <p className="mt-1 text-sm text-ink-muted">{group.game ?? 'Any game'} · {group.privacy === 'INVITE' ? 'Invitation only' : 'Open to requests'}</p>
      {group.description && <p className="mt-3">{group.description}</p>}
      {message && <p className="mt-3 rounded-xl bg-sand p-3 text-sm">{message}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {status !== 'authenticated' ? <SignInPrompt next={`/experiences/gaming/groups/${slug}`} text="Sign in to join." /> : viewer?.status === 'ACTIVE' ? (
          <>
            {viewer.conversationId ? <Link href={`/account/chats/${viewer.conversationId}`} className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Open team chat</Link> : <Link href={`/account/chats`} className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Team chat in My Group Chats</Link>}
            {viewer.role !== 'OWNER' && <button type="button" onClick={() => window.confirm('Leave?') && run(api.post(`/gaming/groups/${slug}/leave`), 'You left.')} className="h-11 rounded-full border border-line px-5 text-sm font-semibold">Leave</button>}
          </>
        ) : viewer?.status === 'INVITED' ? (
          <button type="button" onClick={() => run(api.post(`/gaming/groups/${slug}/join`), 'Welcome!')} className="h-11 rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700">Accept invitation</button>
        ) : viewer?.status === 'PENDING' ? <p className="text-sm text-ink-muted">Request sent — waiting for the owner or a captain.</p> : group.privacy === 'PUBLIC' ? (
          <button type="button" onClick={() => run(api.post(`/gaming/groups/${slug}/join`), 'Request sent.')} className="h-11 rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700">Ask to join</button>
        ) : <p className="text-sm text-ink-muted">Invitation only.</p>}
      </div>
      {group.kind === 'GUILD' && (
        <section className="mt-6">
          <h2 className="text-h3">Squads</h2>
          {group.squads.length === 0 ? <p className="mt-1 text-sm text-ink-muted">No squads yet.{viewer?.canManage ? ' Create one in Gaming Hub → Squads & Guilds and choose this guild.' : ''}</p> : <ul className="mt-2 grid gap-2">{group.squads.map((s) => <li key={s.slug}><Link href={`/experiences/gaming/groups/${s.slug}`} className="block rounded-xl border border-line bg-white px-4 py-3 font-semibold">{s.name}</Link></li>)}</ul>}
        </section>
      )}
      {data.members.length > 0 && (
        <section className="mt-6">
          <h2 className="text-h3">Members</h2>
          <ul className="mt-2 grid gap-1">
            {data.members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-2 rounded-lg bg-sand px-3 py-2 text-sm">
                <span>{m.name} <span className="text-xs text-ink-muted">{m.role === 'OWNER' ? 'Owner' : m.role === 'CAPTAIN' ? 'Captain' : ''}</span></span>
                {viewer?.canManage && m.role !== 'OWNER' && (
                  <span className="flex gap-2 text-xs">
                    {viewer.role === 'OWNER' && <button type="button" onClick={() => run(api.post(`/gaming/groups/${slug}/members/${m.userId}`, { action: m.role === 'CAPTAIN' ? 'member' : 'captain' }))} className="underline">{m.role === 'CAPTAIN' ? 'Make member' : 'Make captain'}</button>}
                    <button type="button" onClick={() => window.confirm(`Remove ${m.name}?`) && run(api.post(`/gaming/groups/${slug}/members/${m.userId}`, { action: 'remove' }))} className="text-danger underline">Remove</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.requests.length > 0 && (
        <section className="mt-6">
          <h2 className="text-h3">Requests</h2>
          <ul className="mt-2 grid gap-1">{data.requests.map((r) => (
            <li key={r.userId} className="flex items-center justify-between gap-2 rounded-lg bg-sand px-3 py-2 text-sm">{r.name}
              <span className="flex gap-2"><button type="button" onClick={() => run(api.post(`/gaming/groups/${slug}/members/${r.userId}`, { action: 'approve' }))} className="font-semibold text-acacia-700 underline">Accept</button><button type="button" onClick={() => run(api.post(`/gaming/groups/${slug}/members/${r.userId}`, { action: 'decline' }))} className="underline">Decline</button></span>
            </li>))}
          </ul>
        </section>
      )}
      {viewer?.canManage && friends.length > 0 && (
        <section className="mt-6">
          <h2 className="text-h3">Invite friends</h2>
          <div className="mt-2 flex flex-wrap gap-2">{friends.filter((f) => !data.members.some((m) => m.userId === f.member.id)).map((f) => <button key={f.member.id} type="button" onClick={() => run(api.post(`/gaming/groups/${slug}/invite`, { userId: f.member.id }), 'Invitation sent.')} className="chip">+ {f.member.username ? `@${f.member.username}` : f.member.name}</button>)}</div>
        </section>
      )}
    </div>
  );
}

/* ---------------------------- Esports organiser application --------------------------- */

export function EsportsApplyForm() {
  const { status, user } = useSession();
  const [form, setForm] = useState({ organisationName: '', representativeName: '', representativeRole: '', phone: '', email: '', country: 'Tanzania', location: '', website: '', socials: '', history: '', games: '', authorityEvidence: '' });
  const [documents, setDocuments] = useState<{ assetId: string; format: string; name: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [updateId, setUpdateId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    setUpdateId(new URLSearchParams(window.location.search).get('update'));
  }, []);
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, representativeName: f.representativeName || user.name, email: f.email || user.email, phone: f.phone || (user.phone ?? '') }));
  }, [user]);
  if (status === 'anonymous') return <div className="shell max-w-xl py-12"><SignInPrompt next="/experiences/gaming/organisers/apply" text="Sign in to register as an esports organiser." /></div>;
  if (done) return <div className="shell max-w-xl py-12"><h1 className="text-h2">Application received</h1><p className="mt-3 text-ink-soft">{message}</p><Link href="/account/gaming" className="mt-4 inline-block font-semibold text-acacia-700 underline">Back to Gaming Hub</Link></div>;

  async function upload(file: File) {
    try {
      const stored = await uploadFile('ESPORTS_DOCUMENT', file);
      setDocuments((list) => [...list, { assetId: stored.assetId, format: stored.format, name: file.name.slice(0, 120) }]);
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'The document could not be uploaded.');
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      if (updateId) {
        await api.patch(`/gaming/esports-organisers/${updateId}`, { note, ...(documents.length ? { documents } : {}) });
        setMessage('Thank you — the gaming team will look at the new information.');
      } else {
        const result = await api.post<{ message: string }>('/gaming/esports-organisers', {
          ...form,
          socials: form.socials.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
          games: form.games.split(',').map((s) => s.trim()).filter(Boolean),
          documents,
        });
        setMessage(result.message);
      }
      setDone(true);
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not submit.');
    }
  }
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const label = 'grid gap-1 text-sm font-semibold';
  return (
    <div className="shell max-w-2xl py-8 md:py-12">
      <Link href="/account/gaming" className="kicker inline-flex min-h-10 items-center">← Gaming Hub</Link>
      <h1 className="text-h1">{updateId ? 'Add information to your application' : 'Register as an Esports Organiser'}</h1>
      <p className="mt-2 text-sm text-ink-muted">For esports organisations, tournament companies, publishers, gaming associations, universities, sponsors and established independent organisers. Company registration is not required — we look at credible identity, authority and experience. Until you are verified, your esports tournaments can still be published but do not show a verified badge.</p>
      <form onSubmit={submit} className="mt-6 grid gap-3">
        {message && <p role="status" className="rounded-xl bg-sand p-3 text-sm">{message}</p>}
        {updateId ? (
          <label className={label}>What the team asked for<textarea required rows={5} value={note} onChange={(e) => setNote(e.target.value)} className="field" /></label>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>Organisation or organiser name<input required value={form.organisationName} onChange={(e) => set('organisationName', e.target.value)} className="field" /></label>
              <label className={label}>Representative’s name<input required value={form.representativeName} onChange={(e) => set('representativeName', e.target.value)} className="field" /></label>
              <label className={label}>Representative’s role<input required value={form.representativeRole} onChange={(e) => set('representativeRole', e.target.value)} className="field" placeholder="Founder, director, tournament lead…" /></label>
              <label className={label}>Phone<input required type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className="field" /></label>
              <label className={label}>Email<input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="field" /></label>
              <label className={label}>Country<input required value={form.country} onChange={(e) => set('country', e.target.value)} className="field" /></label>
              <label className={label}>City / location<input value={form.location} onChange={(e) => set('location', e.target.value)} className="field" /></label>
              <label className={label}>Website (optional)<input type="url" value={form.website} onChange={(e) => set('website', e.target.value)} className="field" placeholder="https://" /></label>
            </div>
            <label className={label}>Official social accounts (one per line)<textarea rows={2} value={form.socials} onChange={(e) => set('socials', e.target.value)} className="field" /></label>
            <label className={label}>Games you run competitions for (comma separated)<input required value={form.games} onChange={(e) => set('games', e.target.value)} className="field" /></label>
            <label className={label}>Competition history<textarea required rows={4} value={form.history} onChange={(e) => set('history', e.target.value)} className="field" placeholder="Events you ran: dates, games, number of players, results pages…" /></label>
            <label className={label}>Your authority to represent the organisation<textarea required rows={3} value={form.authorityEvidence} onChange={(e) => set('authorityEvidence', e.target.value)} className="field" /></label>
          </>
        )}
        <label className={label}>Supporting documents (optional, PDF or images — only the gaming team can open them)
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="text-sm" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file); }} />
        </label>
        {documents.length > 0 && <ul className="text-sm text-ink-muted">{documents.map((d) => <li key={d.assetId}>📄 {d.name}</li>)}</ul>}
        <button className="h-12 rounded-full bg-clay-400 text-sm font-bold text-acacia-700">{updateId ? 'Send information' : 'Submit application'}</button>
      </form>
    </div>
  );
}

/* -------------------------------- Invitations -------------------------------- */

interface Invite { id: string; kind: string; game: string; platform: string; playStyle: string | null; message: string | null; meetingArea: string | null; slotsNeeded: number; slotsRemaining: number; expiresAt: string; status: string; requester: { id: string; name: string; avatarUrl: string | null } | null; isRequester: boolean; myResponse: string | null; accepted: { id: string; name: string }[]; conversationId: string | null; linkActive?: boolean }

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const left = Math.max(0, new Date(until).getTime() - now);
  const minutes = Math.floor(left / 60000);
  const seconds = Math.floor((left % 60000) / 1000);
  return <span>{left === 0 ? 'expired' : minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m left` : `${minutes}:${seconds.toString().padStart(2, '0')} left`}</span>;
}

function InviteCard({ invite, onAccept, onDecline, busy }: { invite: Invite; onAccept?: () => void; onDecline?: () => void; busy?: boolean }) {
  const open = invite.status === 'OPEN';
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="bg-[#06152a] p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-clay-400">{invite.kind === 'NEARBY' ? 'Nearby gaming invitation' : 'Gaming invitation'}</p>
        <p className="mt-1 text-2xl font-bold">{invite.game}</p>
        <p className="text-white/75">{invite.platform}{invite.playStyle ? ` · ${invite.playStyle}` : ''}{invite.kind === 'NEARBY' ? ' · within about 2 km' : ''}</p>
      </div>
      <div className="grid gap-2 p-5 text-sm">
        {invite.requester && <p><strong>{invite.requester.name}</strong> {invite.isRequester ? '(you)' : 'is looking for players'}</p>}
        {invite.message && <p className="rounded-xl bg-sand p-3">“{invite.message}”</p>}
        {invite.meetingArea && <p>📍 Approximate area: {invite.meetingArea}</p>}
        <p>{invite.slotsRemaining > 0 ? `${invite.slotsRemaining} of ${invite.slotsNeeded} place${invite.slotsNeeded === 1 ? '' : 's'} left` : 'All places filled'} · {open ? <Countdown until={invite.expiresAt} /> : invite.status.toLowerCase()}</p>
        {invite.accepted.length > 0 && <p className="text-ink-muted">Playing: {invite.accepted.map((a) => a.name).join(', ')}</p>}
        {invite.conversationId && <Link href={`/account/chats/${invite.conversationId}`} className="mt-1 inline-flex h-11 w-fit items-center rounded-full bg-acacia-600 px-5 font-bold text-white">Open the temporary chat</Link>}
        {onAccept && open && !invite.isRequester && invite.myResponse !== 'ACCEPTED' && (
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} onClick={onAccept} className="h-12 flex-1 rounded-full bg-clay-400 font-bold text-acacia-700 disabled:opacity-50">Accept</button>
            {onDecline && <button type="button" disabled={busy} onClick={onDecline} className="h-12 flex-1 rounded-full border border-line font-semibold">Decline</button>}
          </div>
        )}
        {invite.myResponse === 'DECLINED' && <p className="text-ink-muted">You declined. The organiser is not told.</p>}
        <p className="mt-1 text-xs text-ink-muted">Meet only in public places. Exact locations are never shared. Accepting does not make you friends — you can send a friend request after you play.</p>
      </div>
    </div>
  );
}

/** /gaming/invites/[id] — where a notification about an invitation opens. */
export function InvitePage({ id }: { id: string }) {
  const { status } = useSession();
  const [invite, setInvite] = useState<Invite | null | 'missing'>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get<Invite>(`/gaming/invites/${id}`).then(setInvite).catch(() => setInvite('missing')), [id]);
  useEffect(() => {
    if (status === 'authenticated') void load();
  }, [status, load]);
  async function respond(accept: boolean) {
    setBusy(true);
    try {
      const result = await api.post<{ conversationId?: string }>(`/gaming/invites/${id}/${accept ? 'accept' : 'decline'}`, {});
      if (accept && result.conversationId) window.location.href = `/account/chats/${result.conversationId}`;
      else void load();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'That did not work.');
      void load();
    } finally {
      setBusy(false);
    }
  }
  async function friendRequest(userId: string, game: string) {
    await api.post('/social/friends', { userId, context: `playing ${game}` }).then(() => setMessage('Friend request sent.')).catch((caught) => setMessage(caught instanceof ApiError ? caught.message : 'Could not send it.'));
  }
  if (status === 'anonymous') return <div className="shell max-w-md py-12"><SignInPrompt next={`/gaming/invites/${id}`} text="Sign in to see this gaming invitation." /></div>;
  if (invite === null) return <div className="shell py-12 text-sm text-ink-muted">Loading…</div>;
  if (invite === 'missing') return <div className="shell max-w-md py-12"><h1 className="text-h2">This invitation is not available.</h1><Link href="/account/gaming" className="mt-3 inline-block underline">Gaming Hub</Link></div>;
  return (
    <div className="shell max-w-md py-8">
      <Link href="/account/gaming?tab=friends&view=find" className="kicker inline-flex min-h-10 items-center">← Gaming Hub</Link>
      {message && <p role="status" className="mb-3 rounded-xl bg-sand p-3 text-sm">{message}</p>}
      <InviteCard invite={invite} busy={busy} onAccept={() => respond(true)} onDecline={() => respond(false)} />
      {invite.isRequester && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {invite.status === 'OPEN' && <button type="button" onClick={() => window.confirm('Cancel this invitation?') && api.post(`/gaming/invites/${id}/cancel`).then(load)} className="h-10 rounded-full border border-line px-4 font-semibold">Cancel invitation</button>}
          {invite.kind === 'EXTERNAL' && invite.linkActive && <button type="button" onClick={() => api.post(`/gaming/invites/${id}/revoke-link`).then(() => { setMessage('The link no longer works.'); void load(); })} className="h-10 rounded-full border border-line px-4 font-semibold">Stop the link working</button>}
        </div>
      )}
      {(invite.isRequester || invite.myResponse === 'ACCEPTED') && invite.accepted.length > 0 && (
        <div className="mt-4 rounded-2xl border border-line bg-white p-4 text-sm">
          <p className="font-semibold">Played together? Send a friend request</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...(invite.isRequester ? [] : invite.requester ? [{ id: invite.requester.id, name: invite.requester.name }] : []), ...invite.accepted].map((person) => <button key={person.id} type="button" onClick={() => friendRequest(person.id, invite.game)} className="chip">+ {person.name}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}

/** /join/game/[token] — the landing page for people outside Enhakkore. */
export function ExternalInviteLanding({ token }: { token: string }) {
  const { status } = useSession();
  const [invite, setInvite] = useState<Invite | null | 'missing'>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const back = `/join/game/${token}`;
  const load = useCallback(() => api.get<Invite>(`/public/gaming/invite-links/${token}`).then(setInvite).catch(() => setInvite('missing')), [token]);
  useEffect(() => {
    if (status !== 'loading') void load();
  }, [status, load]);
  async function accept() {
    if (invite === null || invite === 'missing') return;
    setBusy(true);
    try {
      const result = await api.post<{ conversationId?: string }>(`/gaming/invites/${invite.id}/accept`, { token });
      if (result.conversationId) window.location.href = `/account/chats/${result.conversationId}`;
      else void load();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not accept.');
      void load();
    } finally {
      setBusy(false);
    }
  }
  if (invite === null) return <div className="shell py-12 text-sm text-ink-muted">Loading…</div>;
  if (invite === 'missing') return <div className="shell max-w-md py-12"><h1 className="text-h2">This invitation link is not valid.</h1><p className="mt-2 text-ink-muted">It may have been cancelled or expired.</p><Link href="/experiences/gaming" className="mt-3 inline-block underline">Explore gaming on Enhakkore</Link></div>;
  return (
    <div className="shell max-w-md py-8">
      <p className="mb-3 inline-flex rounded-full bg-safari-500 px-3 py-1 text-xs font-bold text-white">You’ve been invited to play</p>
      {message && <p role="status" className="mb-3 rounded-xl bg-sand p-3 text-sm">{message}</p>}
      <InviteCard invite={invite} busy={busy} onAccept={status === 'authenticated' ? accept : undefined} />
      {status !== 'authenticated' && invite.status === 'OPEN' && (
        <div className="mt-4 grid gap-2">
          <Link href={`/join?next=${encodeURIComponent(back)}`} className="inline-flex h-12 items-center justify-center rounded-full bg-clay-400 font-bold text-acacia-700">Join Enhakkore to accept</Link>
          <Link href={`/signin?next=${encodeURIComponent(back)}`} className="text-center text-sm font-semibold text-acacia-700 underline">Already a member? Sign in</Link>
          <p className="text-center text-xs text-ink-muted">Sign up with your email. Google and Apple sign-in are not available yet. After signing up you return to this invitation.</p>
        </div>
      )}
    </div>
  );
}
