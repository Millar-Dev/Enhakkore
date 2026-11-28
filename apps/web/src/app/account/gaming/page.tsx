'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ESPORTS_STATUS_LABELS, GAMING_PLATFORMS, PLAY_STYLES } from '@enhakkore/shared';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { Avatar, EmptyState } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { useQueryParam } from '@/lib/useApi';

interface Registered { slug: string; title: string; game: string | null; startsAt: string | null; status: string; phase: 'UPCOMING' | 'CURRENT' | 'COMPLETED'; reference: string; teamName: string | null; nextMatch: { round: number; stage: string } | null; played: number; won: number; result: string | null }
interface Created { slug: string; title: string; game: string | null; startsAt: string | null; status: string; phase: string; entries: number; slots: number | null; checked: boolean; registrationRestricted: boolean }
interface Member { id: string; name: string; username: string | null; avatarUrl: string | null; city: string | null; games: string[]; platforms: string[] }
interface Friend { id: string; status: string; member: Member; distance: string | null }
interface GroupRow { slug: string; name: string; kind: string; game: string | null; role: string; status: string; members: number; squads: number; guild: { name: string; slug: string } | null }
interface InviteView { id: string; kind: string; game: string; platform: string; slotsNeeded: number; slotsRemaining: number; status: string; expiresAt: string; isRequester: boolean; myResponse: string | null; accepted: { id: string; name: string }[]; requester: { name: string } | null }

const PHASE_LABEL = { UPCOMING: 'Upcoming', CURRENT: 'Current', COMPLETED: 'Completed' } as const;
const STATUS_LABEL: Record<string, string> = { REGISTRATION_OPEN: 'Registration open', REGISTRATION_CLOSED: 'Registration closed', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled', HIDDEN: 'Hidden by the team', SUSPENDED: 'Suspended by the team', DRAFT: 'Draft' };

function name(member: { name: string; username: string | null }) {
  return member.username ? `@${member.username}` : member.name;
}

/**
 * Gaming Hub (Account Centre): the member's personal gaming dashboard with
 * two parts — My Tournaments and Game Friends. The public Gaming Hub under
 * Experiences is where tournaments and sessions are discovered.
 */
export default function GamingHubPage() {
  const tabParam = useQueryParam('tab');
  const viewParam = useQueryParam('view');
  const [tab, setTab] = useState<'tournaments' | 'friends'>('tournaments');
  useEffect(() => {
    if (tabParam === 'friends' || tabParam === 'tournaments') setTab(tabParam);
  }, [tabParam]);

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title="Gaming Hub">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-2xl bg-[#06152a] p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-clay-400">Gaming Hub</p>
          <p className="mt-1 text-xl font-bold">Compete, connect and play.</p>
          <div className="mt-4 grid grid-cols-2 gap-2" role="tablist" aria-label="Gaming Hub">
            <button type="button" role="tab" aria-selected={tab === 'tournaments'} onClick={() => setTab('tournaments')} className={`min-h-14 rounded-xl px-3 text-left text-sm font-bold ${tab === 'tournaments' ? 'bg-clay-400 text-acacia-700' : 'bg-white/10 text-white'}`}>🏆 My Tournaments</button>
            <button type="button" role="tab" aria-selected={tab === 'friends'} onClick={() => setTab('friends')} className={`min-h-14 rounded-xl px-3 text-left text-sm font-bold ${tab === 'friends' ? 'bg-clay-400 text-acacia-700' : 'bg-white/10 text-white'}`}>👥 Game Friends</button>
          </div>
        </div>
        <div className="mt-5">{tab === 'tournaments' ? <MyTournaments view={viewParam} /> : <GameFriends initialView={viewParam} />}</div>
      </div>
    </DashboardShell>
  );
}

/* --------------------------------- My Tournaments -------------------------------- */

function MyTournaments({ view }: { view: string | null }) {
  const [q, setQ] = useState('');
  const [phase, setPhase] = useState<'UPCOMING' | 'CURRENT' | 'COMPLETED' | 'CREATED'>('UPCOMING');
  const [data, setData] = useState<{ registered: Registered[]; created: Created[] } | null>(null);
  const [esports, setEsports] = useState<{ id: string; organisationName: string; status: string; reviewNote: string | null }[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      api.get<{ registered: Registered[]; created: Created[] }>(`/gaming/tournaments/mine?q=${encodeURIComponent(q)}`).then(setData).catch(() => setData({ registered: [], created: [] }));
    }, q ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    api.get<{ items: typeof esports }>('/gaming/esports-organisers/mine').then((d) => setEsports(d.items)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (view === 'created') setPhase('CREATED');
  }, [view]);

  const list = phase === 'CREATED' ? [] : (data?.registered ?? []).filter((item) => item.phase === phase);
  return (
    <section>
      <div className="flex items-center gap-2">
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search my tournaments…" aria-label="Search my tournaments" className="h-11 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-[0.9375rem] outline-none focus:border-acacia-600" />
        <Link href="/experiences/gaming/tournaments" aria-label="Discover tournaments" title="Discover tournaments" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-acacia-600/30 bg-white text-lg">🧭</Link>
        <Link href="/experiences/gaming/tournaments/new" aria-label="Create a tournament" title="Create a tournament" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-clay-400 text-2xl font-light text-acacia-700">+</Link>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="tablist">
        {(['UPCOMING', 'CURRENT', 'COMPLETED', 'CREATED'] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={phase === key} onClick={() => setPhase(key)} className={`chip shrink-0 ${phase === key ? 'chip-active' : ''}`}>
            {key === 'CREATED' ? `Created (${data?.created.length ?? 0})` : `${PHASE_LABEL[key]} (${(data?.registered ?? []).filter((item) => item.phase === key).length})`}
          </button>
        ))}
      </div>

      {data === null ? <p className="mt-4 text-sm text-ink-muted">Loading…</p> : phase === 'CREATED' ? (
        data.created.length === 0 ? <EmptyState className="mt-4" title="You have not created a tournament" description="Create one with the + button. It is published straight away; the Enhakkore team can contact you about it." /> : (
          <ul className="mt-4 grid gap-2">
            {data.created.map((item) => (
              <li key={item.slug}>
                <Link href={`/experiences/gaming/${item.slug}`} className="block rounded-xl border border-line bg-white px-4 py-3">
                  <span className="flex items-start justify-between gap-2"><span className="font-semibold">{item.title}</span><span className="shrink-0 text-xs font-bold text-acacia-700">{STATUS_LABEL[item.status] ?? item.status}</span></span>
                  <span className="mt-0.5 block text-sm text-ink-muted">{item.game ?? 'Game'} · {item.entries}{item.slots ? `/${item.slots}` : ''} entries{item.startsAt ? ` · ${new Date(item.startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}{item.registrationRestricted ? ' · registration restricted by the team' : ''}</span>
                  <span className="mt-1 block text-xs font-semibold text-acacia-700">Manage entries, fixtures and results ›</span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : list.length === 0 ? (
        <EmptyState className="mt-4" title={`No ${PHASE_LABEL[phase].toLowerCase()} tournaments`} description="Find one to join in Discover." action={<Link href="/experiences/gaming/tournaments" className="inline-flex h-11 items-center rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700">Discover tournaments</Link>} />
      ) : (
        <ul className="mt-4 grid gap-2">
          {list.map((item) => (
            <li key={item.slug}>
              <Link href={`/experiences/gaming/${item.slug}`} className="block rounded-xl border border-line bg-white px-4 py-3">
                <span className="flex items-start justify-between gap-2"><span className="font-semibold">{item.title}</span><span className="shrink-0 text-xs font-bold text-acacia-700">{STATUS_LABEL[item.status] ?? item.status}</span></span>
                <span className="mt-0.5 block text-sm text-ink-muted">{item.game ?? 'Game'}{item.teamName ? ` · ${item.teamName}` : ''} · ref {item.reference}</span>
                {item.nextMatch && <span className="mt-1 block text-sm font-semibold text-clay-700">Next: round {item.nextMatch.round}{item.nextMatch.stage === 'LOSERS' ? ' (losers bracket)' : item.nextMatch.stage === 'GRAND_FINAL' ? ' — grand final' : ''}</span>}
                {item.played > 0 && <span className="block text-xs text-ink-muted">Played {item.played} · won {item.won}</span>}
                {item.result && <span className="mt-1 block text-sm font-semibold">{item.result === 'Winner' ? '🏆 Winner' : item.result}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 rounded-2xl border border-line bg-white p-4 text-sm">
        <p className="font-semibold">Esports organiser verification</p>
        {esports.length === 0 ? (
          <p className="mt-1 text-ink-muted">Run esports competitions? <Link href="/experiences/gaming/organisers/apply" className="font-semibold text-acacia-700 underline">Register as an Esports Organiser</Link>. Your esports tournaments show a verified badge only after the team checks your application.</p>
        ) : (
          <ul className="mt-2 grid gap-1">
            {esports.map((row) => (
              <li key={row.id}>{row.organisationName}: <strong>{ESPORTS_STATUS_LABELS[row.status] ?? row.status}</strong>{row.reviewNote ? <span className="block text-ink-muted">Team note: {row.reviewNote}</span> : null}{row.status === 'MORE_INFO' && <Link href={`/experiences/gaming/organisers/apply?update=${row.id}`} className="ml-1 font-semibold text-acacia-700 underline">Add information</Link>}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------- Game Friends -------------------------------- */

const FRIEND_VIEWS = [
  { key: 'friends', label: 'My Friends' },
  { key: 'requests', label: 'Requests' },
  { key: 'discover', label: 'Discover Players' },
  { key: 'squads', label: 'Squads & Guilds' },
  { key: 'find', label: 'Find Players' },
] as const;
type FriendView = (typeof FRIEND_VIEWS)[number]['key'];

function GameFriends({ initialView }: { initialView: string | null }) {
  const [view, setView] = useState<FriendView>('friends');
  const [friends, setFriends] = useState<{ friends: Friend[]; incoming: Friend[]; outgoing: Friend[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (initialView && FRIEND_VIEWS.some((v) => v.key === initialView)) setView(initialView as FriendView);
  }, [initialView]);
  const load = useCallback(() => api.get<NonNullable<typeof friends>>('/social/friends').then(setFriends).catch(() => setFriends({ friends: [], incoming: [], outgoing: [] })), []);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(run: () => Promise<unknown>, done?: string) {
    try {
      await run();
      if (done) setMessage(done);
      await load();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'That did not work.');
    }
  }
  async function messageFriend(userId: string) {
    try {
      const result = await api.post<{ id: string }>('/messages/start', { userId });
      window.location.href = `/account/messages/${result.id}`;
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not open the conversation.');
    }
  }

  return (
    <section>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="tablist" aria-label="Game Friends">
        {FRIEND_VIEWS.map((item) => (
          <button key={item.key} type="button" role="tab" aria-selected={view === item.key} onClick={() => setView(item.key)} className={`chip shrink-0 ${view === item.key ? 'chip-active' : ''}`}>
            {item.label}
            {item.key === 'requests' && (friends?.incoming.length ?? 0) > 0 && <span className="rounded-full bg-clay-400 px-1.5 text-[0.6875rem] font-bold text-acacia-700">{friends!.incoming.length}</span>}
          </button>
        ))}
      </div>
      {message && <p role="status" className="mt-3 rounded-xl bg-sand p-3 text-sm text-ink-soft">{message}</p>}

      {view === 'friends' && (
        <ul className="mt-4 grid gap-2">
          {friends === null ? <li className="text-sm text-ink-muted">Loading…</li> : friends.friends.length === 0 ? (
            <li><EmptyState title="No game friends yet" description="Find players in Discover Players, or send a friend request after you play together." /></li>
          ) : friends.friends.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
              <Avatar name={row.member.name} src={row.member.avatarUrl} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{name(row.member)}</span>
                <span className="block truncate text-xs text-ink-muted">{[row.member.games.slice(0, 3).join(', '), row.distance ? `≈ ${row.distance} away` : null].filter(Boolean).join(' · ') || 'Game friend'}</span>
              </span>
              <span className="flex flex-wrap gap-2">
                <button type="button" onClick={() => messageFriend(row.member.id)} className="h-10 rounded-full bg-acacia-600 px-4 text-sm font-bold text-white">Message</button>
                {row.member.username && <Link href={`/u/${row.member.username}`} className="inline-flex h-10 items-center rounded-full border border-line px-3 text-sm font-semibold">Profile</Link>}
                <button type="button" onClick={() => window.confirm(`Remove ${name(row.member)} from your friends?`) && act(() => api.delete(`/social/friends/${row.id}`), 'Removed.')} className="h-10 rounded-full px-2 text-sm text-ink-muted underline">Remove</button>
                <button type="button" onClick={() => window.confirm('Block this member?') && act(() => api.post('/community/blocks', { userId: row.member.id }), 'Blocked.')} className="h-10 rounded-full px-2 text-sm text-danger underline">Block</button>
                <button type="button" onClick={() => { const reason = window.prompt('What is wrong?'); if (reason) void act(() => api.post('/community/reports', { targetType: 'USER', targetId: row.member.id, reason }), 'Reported. Thank you.'); }} className="h-10 rounded-full px-2 text-sm text-danger underline">Report</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {view === 'requests' && (
        <div className="mt-4 grid gap-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink-muted">Received</h3>
            <ul className="mt-2 grid gap-2">
              {(friends?.incoming ?? []).length === 0 ? <li className="text-sm text-ink-muted">No requests.</li> : friends!.incoming.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
                  <Avatar name={row.member.name} src={row.member.avatarUrl} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{name(row.member)}</span>
                  <button type="button" onClick={() => act(() => api.post(`/social/friends/${row.id}/respond`, { accept: true }), 'You are now friends.')} className="h-10 rounded-full bg-acacia-600 px-4 text-sm font-bold text-white">Accept</button>
                  <button type="button" onClick={() => act(() => api.post(`/social/friends/${row.id}/respond`, { accept: false }))} className="h-10 rounded-full border border-line px-4 text-sm font-semibold">Decline</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink-muted">Sent</h3>
            <ul className="mt-2 grid gap-2">
              {(friends?.outgoing ?? []).length === 0 ? <li className="text-sm text-ink-muted">None waiting.</li> : friends!.outgoing.map((row) => (
                <li key={row.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
                  <span className="min-w-0 flex-1 truncate font-semibold">{name(row.member)}</span>
                  <button type="button" onClick={() => act(() => api.delete(`/social/friends/${row.id}`), 'Request cancelled.')} className="h-10 rounded-full border border-line px-4 text-sm font-semibold">Cancel</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {view === 'discover' && <DiscoverPlayers onAction={act} />}
      {view === 'squads' && <SquadsAndGuilds />}
      {view === 'find' && <FindPlayers friends={friends?.friends ?? []} />}
    </section>
  );
}

function DiscoverPlayers({ onAction }: { onAction: (run: () => Promise<unknown>, done?: string) => Promise<void> }) {
  const [q, setQ] = useState('');
  const [game, setGame] = useState('');
  const [items, setItems] = useState<Member[] | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      api.get<{ items: Member[] }>(`/social/players?q=${encodeURIComponent(q)}&game=${encodeURIComponent(game)}`).then((d) => setItems(d.items)).catch(() => setItems([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q, game]);
  return (
    <div className="mt-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search by username or name…" aria-label="Search players" className="h-11 rounded-full border border-line bg-white px-4 text-[0.9375rem] outline-none" />
        <input value={game} onChange={(event) => setGame(event.target.value)} placeholder="Game (e.g. Free Fire)" aria-label="Game" className="h-11 rounded-full border border-line bg-white px-4 text-[0.9375rem] outline-none" />
      </div>
      <p className="mt-2 text-xs text-ink-muted">Only members whose profile is visible are listed. Nobody’s location is shown here.</p>
      <ul className="mt-3 grid gap-2">
        {items === null ? <li className="text-sm text-ink-muted">Loading…</li> : items.length === 0 ? <li className="text-sm text-ink-muted">No players found. Add your games under Find Players → My gaming profile so others can find you too.</li> : items.map((player) => (
          <li key={player.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
            <Avatar name={player.name} src={player.avatarUrl} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{name(player)}</span>
              <span className="block truncate text-xs text-ink-muted">{[player.games.slice(0, 3).join(', '), player.platforms.join(', ')].filter(Boolean).join(' · ') || player.city || 'Member'}</span>
            </span>
            <button type="button" onClick={() => onAction(() => api.post('/social/friends', { userId: player.id }), 'Friend request sent.')} className="h-10 rounded-full bg-clay-400 px-4 text-sm font-bold text-acacia-700">Add friend</button>
            <button type="button" onClick={() => onAction(() => api.post(`/social/follows/${player.id}`), 'Following.')} className="h-10 rounded-full border border-line px-4 text-sm font-semibold">Follow</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SquadsAndGuilds() {
  const [items, setItems] = useState<GroupRow[] | null>(null);
  const [form, setForm] = useState({ kind: 'SQUAD', name: '', game: '', description: '', privacy: 'PUBLIC', guildSlug: '' });
  const [message, setMessage] = useState<string | null>(null);
  const load = () => api.get<{ items: GroupRow[] }>('/gaming/groups/mine').then((d) => setItems(d.items)).catch(() => setItems([]));
  useEffect(() => {
    void load();
  }, []);
  const guilds = (items ?? []).filter((g) => g.kind === 'GUILD' && ['OWNER', 'CAPTAIN'].includes(g.role) && g.status === 'ACTIVE');
  async function create(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await api.post<{ slug: string }>('/gaming/groups', { ...form, guildSlug: form.kind === 'SQUAD' && form.guildSlug ? form.guildSlug : undefined });
      window.location.href = `/experiences/gaming/groups/${result.slug}`;
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not create it.');
    }
  }
  return (
    <div className="mt-4 grid gap-5">
      <ul className="grid gap-2">
        {items === null ? <li className="text-sm text-ink-muted">Loading…</li> : items.length === 0 ? <li className="text-sm text-ink-muted">You are not in a squad, guild or team yet. <Link href="/experiences/gaming/groups" className="font-semibold text-acacia-700 underline">Browse them</Link> or create one below.</li> : items.map((g) => (
          <li key={g.slug}>
            <Link href={`/experiences/gaming/groups/${g.slug}`} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{g.name}</span>
                <span className="block truncate text-xs text-ink-muted">{g.kind === 'GUILD' ? 'Guild' : g.kind === 'SQUAD' ? 'Squad' : 'Team'}{g.guild ? ` in ${g.guild.name}` : ''} · {g.members} members{g.kind === 'GUILD' ? ` · ${g.squads} squads` : ''}{g.game ? ` · ${g.game}` : ''}</span>
              </span>
              <span className="shrink-0 text-xs font-bold text-acacia-700">{g.status === 'INVITED' ? 'Invitation' : g.status === 'PENDING' ? 'Requested' : g.role === 'OWNER' ? 'Owner' : g.role === 'CAPTAIN' ? 'Captain' : 'Member'}</span>
            </Link>
          </li>
        ))}
      </ul>
      <form onSubmit={create} className="grid gap-3 rounded-2xl border border-line bg-white p-4">
        <h3 className="font-bold">Create a squad, guild or team</h3>
        <p className="text-xs text-ink-muted">A guild can contain several squads. A team stands on its own.</p>
        {message && <p className="text-sm text-danger">{message}</p>}
        <div className="grid gap-2 sm:grid-cols-3">
          {(['SQUAD', 'GUILD', 'TEAM'] as const).map((kind) => (
            <label key={kind} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${form.kind === kind ? 'border-acacia-600 bg-[#f1f6fb]' : 'border-line'}`}>
              <input type="radio" name="kind" checked={form.kind === kind} onChange={() => setForm((f) => ({ ...f, kind }))} /> {kind === 'SQUAD' ? 'Squad' : kind === 'GUILD' ? 'Guild' : 'Team'}
            </label>
          ))}
        </div>
        <label className="grid gap-1 text-sm font-semibold">Name<input required minLength={2} maxLength={60} value={form.name} onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))} className="field" /></label>
        <label className="grid gap-1 text-sm font-semibold">Main game<input maxLength={60} value={form.game} onChange={(event) => setForm((f) => ({ ...f, game: event.target.value }))} className="field" placeholder="Free Fire, eFootball…" /></label>
        {form.kind === 'SQUAD' && guilds.length > 0 && (
          <label className="grid gap-1 text-sm font-semibold">Inside a guild (optional)
            <select value={form.guildSlug} onChange={(event) => setForm((f) => ({ ...f, guildSlug: event.target.value }))} className="field"><option value="">Independent squad</option>{guilds.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}</select>
          </label>
        )}
        <label className="grid gap-1 text-sm font-semibold">Description<textarea maxLength={1000} rows={2} value={form.description} onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))} className="field" /></label>
        <label className="grid gap-1 text-sm font-semibold">Who can join
          <select value={form.privacy} onChange={(event) => setForm((f) => ({ ...f, privacy: event.target.value }))} className="field"><option value="PUBLIC">Anyone can ask to join</option><option value="INVITE">Invitation only</option></select>
        </label>
        <button className="h-12 rounded-full bg-acacia-600 text-sm font-bold text-white">Create</button>
      </form>
    </div>
  );
}

/* ------------------------------- Find Players -------------------------------- */

function FindPlayers({ friends }: { friends: Friend[] }) {
  const [me, setMe] = useState<{ gaming: { games?: string[]; platforms?: string[] }; nearbyGaming: boolean; locationRecent: boolean; adult: boolean; hasDateOfBirth: boolean } | null>(null);
  const [mode, setMode] = useState<'NEARBY' | 'FRIENDS' | 'EXTERNAL'>('NEARBY');
  const [form, setForm] = useState({ game: '', platform: 'Mobile', slotsNeeded: 1, playStyle: 'Casual', message: '', meetingArea: '', minutes: 10 });
  const [chosen, setChosen] = useState<string[]>([]);
  const [result, setResult] = useState<{ id: string; reached: boolean; link: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState<{ created: InviteView[]; received: InviteView[] } | null>(null);
  const [profile, setProfile] = useState({ games: '', platforms: [] as string[] });

  const loadMe = useCallback(() => api.get<NonNullable<typeof me>>('/social/me').then((data) => {
    setMe(data);
    setProfile({ games: (data.gaming.games ?? []).join(', '), platforms: data.gaming.platforms ?? [] });
    if (data.gaming.games?.[0]) setForm((f) => (f.game ? f : { ...f, game: data.gaming.games![0]! }));
  }).catch(() => undefined), []);
  useEffect(() => {
    void loadMe();
    api.get<NonNullable<typeof invites>>('/gaming/invites').then(setInvites).catch(() => setInvites({ created: [], received: [] }));
  }, [loadMe]);

  async function shareLocation() {
    setError(null);
    if (!navigator.geolocation) return setError('Location is not available in this browser.');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await api.post('/social/location', { lat: position.coords.latitude, lng: position.coords.longitude }).catch(() => undefined);
        void loadMe();
      },
      () => setError('Location permission was refused. Allow it for this site to find nearby players.'),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    );
  }
  async function toggleNearby() {
    if (!me) return;
    try {
      await api.put('/social/me', { nearbyGaming: !me.nearbyGaming });
      void loadMe();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not change it.');
    }
  }
  async function saveProfile() {
    await api.put('/social/me', { gaming: { games: profile.games.split(',').map((g) => g.trim()).filter(Boolean), platforms: profile.platforms, gamerTags: {} } }).catch(() => undefined);
    void loadMe();
    setError('Gaming profile saved.');
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    try {
      const created = await api.post<{ id: string; reached: boolean; link: string | null }>('/gaming/invites', { kind: mode, ...form, slotsNeeded: Number(form.slotsNeeded), minutes: Number(form.minutes), friendIds: mode === 'FRIENDS' && chosen.length ? chosen : undefined });
      setResult(created);
      api.get<NonNullable<typeof invites>>('/gaming/invites').then(setInvites).catch(() => undefined);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send the invitation.');
    }
  }

  return (
    <div className="mt-4 grid gap-5">
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Who to invite">
        {([
          { key: 'NEARBY', title: 'Nearby Players', body: 'Members within 2 km' },
          { key: 'FRIENDS', title: 'Invite My Game Friends', body: 'Your accepted friends' },
          { key: 'EXTERNAL', title: 'Invite Outside Enhakkore', body: 'A link to share' },
        ] as const).map((option) => (
          <button key={option.key} type="button" role="radio" aria-checked={mode === option.key} onClick={() => { setMode(option.key); setResult(null); }} className={`min-h-16 rounded-xl border p-3 text-left ${mode === option.key ? 'border-clay-400 bg-[#06152a] text-white' : 'border-line bg-white'}`}>
            <span className="block text-sm font-bold">{option.title}</span>
            <span className={`text-xs ${mode === option.key ? 'text-white/70' : 'text-ink-muted'}`}>{option.body}</span>
          </button>
        ))}
      </div>

      {mode === 'NEARBY' && me && (
        <div className="rounded-2xl border border-line bg-white p-4 text-sm">
          {!me.adult ? (
            <p className="text-ink-soft">{me.hasDateOfBirth ? 'Nearby invitations are for members aged 18 and over.' : <>Nearby invitations are for adults. <Link href="/account/profile" className="font-semibold text-acacia-700 underline">Add your date of birth</Link> first.</>}</p>
          ) : (
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <span><span className="block font-semibold">Receive nearby invitations</span><span className="text-xs text-ink-muted">Other adults within 2 km can invite you. Off by default.</span></span>
                <button type="button" role="switch" aria-checked={me.nearbyGaming} onClick={toggleNearby} aria-label="Receive nearby invitations" className="relative inline-flex h-11 w-14 shrink-0 items-center justify-center"><span className={`relative h-7 w-12 rounded-full ${me.nearbyGaming ? 'bg-acacia-600' : 'bg-line'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${me.nearbyGaming ? 'left-6' : 'left-1'}`} /></span></button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sand p-3">
                <span className="text-xs text-ink-soft">{me.locationRecent ? '✓ Approximate location shared (rounded to about 500 m, kept for 2 hours). Nobody sees it.' : 'Share your approximate location to send or receive nearby invitations. It is rounded to about 500 m and never shown to anyone.'}</span>
                <button type="button" onClick={shareLocation} className="h-10 rounded-full border border-line bg-white px-4 text-sm font-semibold">{me.locationRecent ? 'Update' : 'Share approximate location'}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'FRIENDS' && (
        <div className="rounded-2xl border border-line bg-white p-4 text-sm">
          {friends.length === 0 ? <p className="text-ink-muted">You have no game friends yet.</p> : (
            <>
              <p className="font-semibold">Invite (all friends if none chosen)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {friends.map((row) => (
                  <label key={row.member.id} className={`chip cursor-pointer ${chosen.includes(row.member.id) ? 'chip-active' : ''}`}>
                    <input type="checkbox" className="sr-only" checked={chosen.includes(row.member.id)} onChange={() => setChosen((list) => (list.includes(row.member.id) ? list.filter((id) => id !== row.member.id) : [...list, row.member.id]))} />
                    {name(row.member)}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!(mode === 'NEARBY' && me && !me.adult) && (
        <form onSubmit={send} className="grid gap-3 rounded-2xl border border-line bg-white p-4">
          <h3 className="font-bold">{mode === 'NEARBY' ? 'Invite players nearby' : mode === 'FRIENDS' ? 'Invite your friends to play' : 'Create an invitation link'}</h3>
          {error && <p role="status" className="text-sm text-ink-soft">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">Game<input required minLength={2} maxLength={60} value={form.game} onChange={(event) => setForm((f) => ({ ...f, game: event.target.value }))} className="field" placeholder="Free Fire" /></label>
            <label className="grid gap-1 text-sm font-semibold">Platform<select value={form.platform} onChange={(event) => setForm((f) => ({ ...f, platform: event.target.value }))} className="field">{GAMING_PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Players needed<input type="number" min={1} max={10} value={form.slotsNeeded} onChange={(event) => setForm((f) => ({ ...f, slotsNeeded: Number(event.target.value) }))} className="field" /></label>
            <label className="grid gap-1 text-sm font-semibold">Play style<select value={form.playStyle} onChange={(event) => setForm((f) => ({ ...f, playStyle: event.target.value }))} className="field">{PLAY_STYLES.map((p) => <option key={p}>{p}</option>)}</select></label>
            {mode === 'NEARBY' && <label className="grid gap-1 text-sm font-semibold">Approximate meeting area (optional)<input maxLength={120} value={form.meetingArea} onChange={(event) => setForm((f) => ({ ...f, meetingArea: event.target.value }))} className="field" placeholder="near Mlimani City food court" /><span className="text-xs font-normal text-ink-muted">A public place by name — no addresses, coordinates or map pins.</span></label>}
            <label className="grid gap-1 text-sm font-semibold">Expires after<select value={form.minutes} onChange={(event) => setForm((f) => ({ ...f, minutes: Number(event.target.value) }))} className="field">{(mode === 'NEARBY' ? [5, 10, 15, 30, 60] : [10, 30, 60, 180, 720, 1440]).map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? 's' : ''}`}</option>)}</select></label>
          </div>
          <label className="grid gap-1 text-sm font-semibold">Message (optional)<input maxLength={300} value={form.message} onChange={(event) => setForm((f) => ({ ...f, message: event.target.value }))} className="field" placeholder="Need two more for a squad match" /></label>
          <button className="h-12 rounded-full bg-clay-400 text-sm font-bold text-acacia-700">{mode === 'EXTERNAL' ? 'Create link' : 'Send invitation'}</button>
          {result && (
            <div className="rounded-xl bg-sand p-3 text-sm">
              {result.link ? (
                <>
                  <p className="font-semibold">Your invitation link</p>
                  <p className="mt-1 break-all rounded-lg bg-white px-2 py-1 font-mono text-xs">{result.link}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => navigator.clipboard?.writeText(result.link!).then(() => setError('Link copied.'))} className="h-10 rounded-full border border-line bg-white px-4 text-sm font-semibold">Copy</button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`Join me for ${form.game} on Enhakkore: ${result.link}`)}`} target="_blank" rel="noreferrer noopener" className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold">Share on WhatsApp</a>
                    {typeof navigator !== 'undefined' && 'share' in navigator && <button type="button" onClick={() => navigator.share({ title: 'Gaming invitation', url: result.link! }).catch(() => undefined)} className="h-10 rounded-full border border-line bg-white px-4 text-sm font-semibold">Share…</button>}
                  </div>
                  <p className="mt-2 text-xs text-ink-muted">The link carries no location or contact details. You can cancel it any time.</p>
                </>
              ) : (
                <p>{result.reached ? 'Sent. ' : 'Nobody is available right now. '}<Link href={`/gaming/invites/${result.id}`} className="font-semibold text-acacia-700 underline">Open the invitation</Link></p>
              )}
            </div>
          )}
        </form>
      )}

      <div className="rounded-2xl border border-line bg-white p-4">
        <h3 className="font-bold">My invitations</h3>
        <ul className="mt-2 grid gap-2 text-sm">
          {invites === null ? <li className="text-ink-muted">Loading…</li> : invites.created.length + invites.received.length === 0 ? <li className="text-ink-muted">None yet.</li> : [...invites.created, ...invites.received].map((invite) => (
            <li key={invite.id}>
              <Link href={`/gaming/invites/${invite.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-sand px-3 py-2">
                <span className="min-w-0 truncate">{invite.isRequester ? 'You' : invite.requester?.name}: {invite.game} · {invite.platform}</span>
                <span className="shrink-0 text-xs font-bold">{invite.status === 'OPEN' ? `${invite.slotsRemaining} left` : invite.status.toLowerCase()}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-line bg-white p-4">
        <h3 className="font-bold">My gaming profile</h3>
        <p className="text-xs text-ink-muted">Helps friends find you in Discover Players. Shown with your username — never your phone number or location.</p>
        <label className="mt-3 grid gap-1 text-sm font-semibold">Games I play<input value={profile.games} onChange={(event) => setProfile((p) => ({ ...p, games: event.target.value }))} className="field" placeholder="Free Fire, eFootball, PUBG Mobile" /></label>
        <div className="mt-3 flex flex-wrap gap-2">
          {GAMING_PLATFORMS.map((platform) => (
            <label key={platform} className={`chip cursor-pointer ${profile.platforms.includes(platform) ? 'chip-active' : ''}`}>
              <input type="checkbox" className="sr-only" checked={profile.platforms.includes(platform)} onChange={() => setProfile((p) => ({ ...p, platforms: p.platforms.includes(platform) ? p.platforms.filter((x) => x !== platform) : [...p.platforms, platform] }))} />
              {platform}
            </label>
          ))}
        </div>
        <button type="button" onClick={saveProfile} className="mt-3 h-11 rounded-full border border-line px-5 text-sm font-semibold">Save gaming profile</button>
      </div>
    </div>
  );
}
