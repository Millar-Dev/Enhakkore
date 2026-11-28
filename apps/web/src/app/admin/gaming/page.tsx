'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BRACKET_FORMATS, ESPORTS_STATUS_LABELS, ORGANISER_TYPES, TOURNAMENT_CATEGORIES } from '@enhakkore/shared';
import { AdminShell, Panel } from '@/components/admin/AdminShell';
import { ApiError, api } from '@/lib/api';
import { useApi, useQueryParam } from '@/lib/useApi';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tournaments', label: 'Tournaments' },
  { key: 'esports', label: 'Esports organisers' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'groups', label: 'Squads & guilds' },
  { key: 'disputes', label: 'Disputes' },
  { key: 'invites', label: 'Invitations' },
] as const;
type Tab = (typeof TABS)[number]['key'];

const label = (list: readonly { key: string; label: string }[], key: string) => list.find((item) => item.key === key)?.label ?? key;
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

/**
 * Gaming in the control centre. Member tournaments publish immediately; this is
 * where the team monitors them, contacts organisers, records follow-up, checks,
 * restricts, hides or suspends — and verifies esports organisers.
 */
export default function AdminGamingPage() {
  const tabParam = useQueryParam('tab');
  const idParam = useQueryParam('id');
  const [tab, setTab] = useState<Tab>('overview');
  useEffect(() => {
    if (tabParam && TABS.some((t) => t.key === tabParam)) setTab(tabParam as Tab);
  }, [tabParam]);
  return (
    <AdminShell title="Gaming" permission="gaming.view">
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="tablist">
        {TABS.map((t) => <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`chip shrink-0 ${tab === t.key ? 'chip-active' : ''}`}>{t.label}</button>)}
      </div>
      {tab === 'overview' && <Overview onTab={setTab} />}
      {tab === 'tournaments' && <Tournaments initialId={idParam} />}
      {tab === 'esports' && <Esports initialId={idParam} />}
      {tab === 'sessions' && <Sessions />}
      {tab === 'groups' && <Groups />}
      {tab === 'disputes' && <Disputes />}
      {tab === 'invites' && <Invites />}
    </AdminShell>
  );
}

function Overview({ onTab }: { onTab: (tab: Tab) => void }) {
  const { data } = useApi<{ tournaments: number; unchecked: number; esportsPending: number; sessions: number; groups: number; disputes: number; invitesToday: number }>('/cc/gaming/overview');
  const tiles: { label: string; value: number | undefined; tab: Tab }[] = [
    { label: 'Live tournaments', value: data?.tournaments, tab: 'tournaments' },
    { label: 'Member tournaments not yet checked', value: data?.unchecked, tab: 'tournaments' },
    { label: 'Esports applications waiting', value: data?.esportsPending, tab: 'esports' },
    { label: 'Open disputes', value: data?.disputes, tab: 'disputes' },
    { label: 'Upcoming sessions', value: data?.sessions, tab: 'sessions' },
    { label: 'Squads, guilds & teams', value: data?.groups, tab: 'groups' },
    { label: 'Invitations (24 h)', value: data?.invitesToday, tab: 'invites' },
  ];
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <button key={tile.label} type="button" onClick={() => onTab(tile.tab)} className="rounded-2xl border border-line bg-white p-4 text-left">
            <p className="text-3xl font-bold text-[#06172b]">{tile.value ?? '…'}</p>
            <p className="mt-1 text-sm text-ink-muted [overflow-wrap:anywhere]">{tile.label}</p>
          </button>
        ))}
      </div>
      <Panel title="Game directory">
        <p className="text-sm text-ink-soft">The list of games members choose from is managed under Categories (kind “Game”).</p>
        <Link href="/admin/r/categories?kind=GAME" className="mt-2 inline-flex h-10 items-center rounded-full border border-line px-4 text-sm font-semibold">Manage games</Link>
        <Link href="/admin/r/tournaments" className="ml-2 mt-2 inline-flex h-10 items-center rounded-full border border-line px-4 text-sm font-semibold">Edit tournaments in full</Link>
      </Panel>
    </div>
  );
}

interface TournamentRow { id: string; slug: string; title: string; category: string; organiserType: string; organiserName: string; game: string | null; startsAt: string | null; status: string; entries: number; slots: number | null; notes: number; checkedAt: string | null; registrationRestricted: boolean; memberCreated: boolean; createdAt: string }

function Tournaments({ initialId }: { initialId: string | null }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, reload } = useApi<{ items: TournamentRow[] }>(`/cc/gaming/tournaments?filter=${filter}&q=${encodeURIComponent(q)}`);
  useEffect(() => {
    if (initialId) setOpenId(initialId);
  }, [initialId]);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <Panel title="Tournaments">
        <div className="mb-3 flex flex-wrap gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or organiser…" className="field max-w-xs" aria-label="Search" />
          {[['all', 'All'], ['unchecked', 'Not checked'], ['restricted', 'Restricted / hidden']].map(([key, text]) => <button key={key} type="button" onClick={() => setFilter(key!)} className={`chip ${filter === key ? 'chip-active' : ''}`}>{text}</button>)}
        </div>
        <ul className="grid gap-2">
          {!data ? <li className="text-sm text-ink-muted">Loading…</li> : data.items.length === 0 ? <li className="text-sm text-ink-muted">None.</li> : data.items.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => setOpenId(t.id)} className={`w-full rounded-xl border p-3 text-left text-sm ${openId === t.id ? 'border-acacia-600 bg-[#f1f6fb]' : 'border-line bg-white'}`}>
                <span className="flex justify-between gap-2"><span className="font-semibold">{t.title}</span><span className="shrink-0 text-xs font-bold">{t.status.replace(/_/g, ' ').toLowerCase()}</span></span>
                <span className="block text-xs text-ink-muted">{label(TOURNAMENT_CATEGORIES, t.category)} · {t.organiserName} ({label(ORGANISER_TYPES, t.organiserType)}) · {t.game ?? '—'} · {t.entries}{t.slots ? `/${t.slots}` : ''} entries</span>
                <span className="mt-1 flex flex-wrap gap-1 text-[0.6875rem] font-bold">
                  {t.memberCreated && <span className="rounded bg-sand px-1.5">Member-created</span>}
                  {t.checkedAt ? <span className="rounded bg-acacia-50 px-1.5 text-acacia-700">Checked</span> : t.memberCreated ? <span className="rounded bg-[#fff1c9] px-1.5">Not checked</span> : null}
                  {t.registrationRestricted && <span className="rounded bg-danger-soft px-1.5 text-danger">Registration restricted</span>}
                  {t.notes > 0 && <span className="rounded bg-sand px-1.5">{t.notes} notes</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      {openId ? <TournamentDetail id={openId} onChange={reload} /> : <Panel><p className="text-sm text-ink-muted">Choose a tournament to see the organiser’s contact details and take action. Opening contact details is recorded in the audit log.</p></Panel>}
    </div>
  );
}

function TournamentDetail({ id, onChange }: { id: string; onChange: () => void }) {
  const { data, reload } = useApi<{ tournament: { title: string; slug: string; status: string; category: string; organiserType: string; organiserName: string; game: string | null; platform: string | null; bracketFormat: string; startsAt: string | null; prizeDetails: string | null; rules: string | null; moderationReason: string | null; checkedAt: string | null; registrationRestricted: boolean; entries: number }; contact: { name: string | null; phone: string | null; email: string | null }; organiser: { id: string; name: string; email: string; username: string | null; status: string } | null; esports: { organisationName: string; status: string } | null; notes: { id: string; kind: string; body: string; createdAt: string; author: string }[] }>(`/cc/gaming/tournaments/${id}`);
  const [body, setBody] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  async function act(action: string, needs?: string) {
    const text = needs ? window.prompt(needs, body) : body;
    if (needs && !text) return;
    try {
      await api.post(`/cc/gaming/tournaments/${id}/action`, { action, body: text || undefined });
      setBody('');
      setMessage('Done.');
      reload();
      onChange();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'That did not work.');
    }
  }
  async function banOrganiser() {
    if (!data?.organiser) return;
    const reason = window.prompt(`Suspend ${data.organiser.name}'s account? Give the reason (it is recorded).`);
    if (!reason) return;
    try {
      await api.post(`/cc/people/members/${data.organiser.id}/status`, { status: 'SUSPENDED', reason });
      setMessage('Account suspended.');
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not suspend.');
    }
  }
  if (!data) return <Panel><p className="text-sm text-ink-muted">Loading…</p></Panel>;
  const t = data.tournament;
  return (
    <Panel title={t.title} actions={<Link href={`/experiences/gaming/${t.slug}`} target="_blank" className="text-sm font-semibold text-acacia-700 underline">Open page</Link>}>
      {message && <p className="mb-3 rounded-xl bg-sand p-2 text-sm">{message}</p>}
      <dl className="grid gap-1 text-sm">
        <div><dt className="inline text-ink-muted">Status: </dt><dd className="inline font-semibold">{t.status.replace(/_/g, ' ').toLowerCase()}{t.moderationReason ? ` — ${t.moderationReason}` : ''}</dd></div>
        <div><dt className="inline text-ink-muted">Category / format: </dt><dd className="inline">{label(TOURNAMENT_CATEGORIES, t.category)} · {label(BRACKET_FORMATS, t.bracketFormat)} · {t.game ?? '—'} {t.platform ? `(${t.platform})` : ''}</dd></div>
        <div><dt className="inline text-ink-muted">Starts: </dt><dd className="inline">{date(t.startsAt)} · {t.entries} entries</dd></div>
        <div><dt className="inline text-ink-muted">Organiser: </dt><dd className="inline">{t.organiserName} ({label(ORGANISER_TYPES, t.organiserType)})</dd></div>
        {data.esports && <div><dt className="inline text-ink-muted">Esports organiser: </dt><dd className="inline">{data.esports.organisationName} — {ESPORTS_STATUS_LABELS[data.esports.status]}</dd></div>}
        {t.prizeDetails && <div><dt className="inline text-ink-muted">Prize (as stated): </dt><dd className="inline">{t.prizeDetails}</dd></div>}
      </dl>
      <div className="mt-3 rounded-xl border border-clay-400/50 bg-[#fff8e6] p-3 text-sm">
        <p className="font-semibold">Organiser contact (team only)</p>
        <p>{data.contact.name ?? '—'} · {data.contact.phone ? <a href={`tel:${data.contact.phone}`} className="underline">{data.contact.phone}</a> : '—'} · {data.contact.email ? <a href={`mailto:${data.contact.email}`} className="underline">{data.contact.email}</a> : '—'}</p>
        {data.contact.phone && <a href={`https://wa.me/${data.contact.phone.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer noopener" className="mt-1 inline-block text-xs font-semibold underline">Open WhatsApp chat</a>}
        {data.organiser && <p className="mt-1 text-xs text-ink-muted">Account: {data.organiser.name} {data.organiser.username ? `@${data.organiser.username}` : ''} · {data.organiser.status.toLowerCase()}</p>}
      </div>
      <div className="mt-3 grid gap-2">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Follow-up note, what you asked for, or a reason…" className="field" aria-label="Note" />
        <div className="flex flex-wrap gap-2 text-sm">
          <button type="button" onClick={() => act('note')} disabled={!body} className="h-10 rounded-full border border-line px-3 font-semibold disabled:opacity-40">Add note</button>
          <button type="button" onClick={() => act('contact')} disabled={!body} className="h-10 rounded-full border border-line px-3 font-semibold disabled:opacity-40">Log contact</button>
          <button type="button" onClick={() => act('request_info')} disabled={!body} className="h-10 rounded-full border border-line px-3 font-semibold disabled:opacity-40">Request information (sends the note)</button>
          <button type="button" onClick={() => act('check')} className="h-10 rounded-full bg-acacia-600 px-3 font-bold text-white">Mark as checked</button>
          {t.registrationRestricted ? <button type="button" onClick={() => act('allow')} className="h-10 rounded-full border border-line px-3 font-semibold">Allow registration</button> : <button type="button" onClick={() => act('restrict')} className="h-10 rounded-full border border-line px-3 font-semibold">Restrict registration</button>}
          {['HIDDEN', 'SUSPENDED'].includes(t.status) ? <button type="button" onClick={() => act('restore')} className="h-10 rounded-full border border-line px-3 font-semibold">Restore</button> : (
            <>
              <button type="button" onClick={() => act('hide', 'Why hide it? (the organiser will see this)')} className="h-10 rounded-full border border-danger/30 px-3 font-semibold text-danger">Hide</button>
              <button type="button" onClick={() => act('suspend', 'Why suspend it? (the organiser will see this)')} className="h-10 rounded-full border border-danger/30 px-3 font-semibold text-danger">Suspend</button>
            </>
          )}
          {data.organiser && <button type="button" onClick={banOrganiser} className="h-10 rounded-full border border-danger/30 px-3 font-semibold text-danger">Suspend organiser’s account</button>}
        </div>
      </div>
      <h3 className="mt-4 text-sm font-bold">Notes & history</h3>
      <ul className="mt-2 grid gap-1 text-sm">
        {data.notes.length === 0 ? <li className="text-ink-muted">No notes yet.</li> : data.notes.map((n) => <li key={n.id} className="rounded-lg bg-sand px-3 py-2"><span className="text-xs font-bold uppercase">{n.kind.replace('_', ' ').toLowerCase()}</span> · {n.body}<span className="block text-xs text-ink-muted">{n.author} · {date(n.createdAt)}</span></li>)}
      </ul>
    </Panel>
  );
}

interface EsportsRow { id: string; organisationName: string; representativeName: string; representativeRole: string; phone: string; email: string; country: string; location: string | null; website: string | null; socials: string[]; history: string; games: string[]; authorityEvidence: string; documents: { index: number; name: string }[]; status: string; reviewNote: string | null; verifiedUntil: string | null; createdAt: string }

function Esports({ initialId }: { initialId: string | null }) {
  const [status, setStatus] = useState('');
  const { data, reload } = useApi<{ items: EsportsRow[] }>(`/cc/gaming/esports${status ? `?status=${status}` : ''}`);
  const [openId, setOpenId] = useState<string | null>(initialId);
  const [message, setMessage] = useState<string | null>(null);
  async function decide(id: string, next: string) {
    const needsNote = ['MORE_INFO', 'REJECTED', 'SUSPENDED'].includes(next);
    const note = window.prompt(needsNote ? 'Note for the applicant (required):' : 'Note (optional):') ?? '';
    if (needsNote && !note) return;
    try {
      await api.post(`/cc/gaming/esports/${id}/decision`, { status: next, note: note || undefined });
      setMessage(`Marked ${ESPORTS_STATUS_LABELS[next]?.toLowerCase()}.`);
      reload();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'That did not work.');
    }
  }
  async function openDoc(id: string, index: number) {
    const result = await api.get<{ url: string }>(`/cc/gaming/esports/${id}/documents/${index}`).catch(() => null);
    if (result?.url) window.open(result.url, '_blank', 'noopener');
  }
  return (
    <Panel title="Esports organiser applications">
      <p className="mb-3 text-sm text-ink-muted">Independent organisers are not rejected for lacking company registration — judge credible identity, authority and experience. Unverified organisers can still publish, without the badge. Opening a document is recorded.</p>
      <div className="mb-3 flex flex-wrap gap-2">{['', 'PENDING', 'MORE_INFO', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'EXPIRED'].map((s) => <button key={s} type="button" onClick={() => setStatus(s)} className={`chip ${status === s ? 'chip-active' : ''}`}>{s ? ESPORTS_STATUS_LABELS[s] : 'All'}</button>)}</div>
      {message && <p className="mb-3 rounded-xl bg-sand p-2 text-sm">{message}</p>}
      <ul className="grid gap-3">
        {!data ? <li className="text-sm text-ink-muted">Loading…</li> : data.items.length === 0 ? <li className="text-sm text-ink-muted">No applications.</li> : data.items.map((row) => (
          <li key={row.id} className="rounded-xl border border-line p-4 text-sm">
            <button type="button" onClick={() => setOpenId(openId === row.id ? null : row.id)} className="flex w-full justify-between gap-2 text-left">
              <span><strong>{row.organisationName}</strong> · {row.representativeName} ({row.representativeRole})</span>
              <span className="shrink-0 font-bold">{ESPORTS_STATUS_LABELS[row.status]}</span>
            </button>
            {openId === row.id && (
              <div className="mt-3 grid gap-2">
                <p>{row.phone} · {row.email} · {row.country}{row.location ? `, ${row.location}` : ''}</p>
                {row.website && <a href={row.website} target="_blank" rel="noreferrer noopener" className="underline">{row.website}</a>}
                {row.socials.length > 0 && <p>Social: {row.socials.join(' · ')}</p>}
                <p>Games: {row.games.join(', ')}</p>
                <p className="whitespace-pre-line rounded-lg bg-sand p-2"><strong>History:</strong> {row.history}</p>
                <p className="whitespace-pre-line rounded-lg bg-sand p-2"><strong>Authority:</strong> {row.authorityEvidence}</p>
                {row.documents.length > 0 && <p>Documents: {row.documents.map((d) => <button key={d.index} type="button" onClick={() => openDoc(row.id, d.index)} className="mr-2 underline">📄 {d.name}</button>)}</p>}
                {row.reviewNote && <p className="text-ink-muted">Last note: {row.reviewNote}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => decide(row.id, 'VERIFIED')} className="h-10 rounded-full bg-acacia-600 px-3 font-bold text-white">Verify (12 months)</button>
                  <button type="button" onClick={() => decide(row.id, 'MORE_INFO')} className="h-10 rounded-full border border-line px-3 font-semibold">Request more information</button>
                  <button type="button" onClick={() => decide(row.id, 'REJECTED')} className="h-10 rounded-full border border-danger/30 px-3 font-semibold text-danger">Reject</button>
                  <button type="button" onClick={() => decide(row.id, 'SUSPENDED')} className="h-10 rounded-full border border-danger/30 px-3 font-semibold text-danger">Suspend</button>
                  <button type="button" onClick={() => decide(row.id, 'EXPIRED')} className="h-10 rounded-full border border-line px-3 font-semibold">Mark expired</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Sessions() {
  const { data, reload } = useApi<{ items: { id: string; slug: string; title: string; game: string; platform: string; mode: string; startsAt: string; capacity: number; players: number; status: string; location: string | null; organiser: { name: string; username: string | null } | null }[] }>('/cc/gaming/sessions');
  async function set(id: string, status: string) {
    const reason = status === 'OPEN' ? undefined : window.prompt('Reason (the organiser will see it):') ?? undefined;
    if (status !== 'OPEN' && !reason) return;
    await api.post(`/cc/gaming/sessions/${id}/status`, { status, reason }).catch(() => undefined);
    reload();
  }
  return (
    <Panel title="Gaming sessions">
      <ul className="grid gap-2 text-sm">
        {!data ? <li className="text-ink-muted">Loading…</li> : data.items.length === 0 ? <li className="text-ink-muted">None yet.</li> : data.items.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
            <span><Link href={`/experiences/gaming/sessions/${s.slug}`} target="_blank" className="font-semibold underline">{s.title}</Link><span className="block text-xs text-ink-muted">{s.game} · {s.platform} · {s.mode === 'ONLINE' ? 'online' : s.location} · {date(s.startsAt)} · {s.players}/{s.capacity} · by {s.organiser?.username ? `@${s.organiser.username}` : s.organiser?.name}</span></span>
            <span className="flex gap-2"><span className="text-xs font-bold">{s.status.toLowerCase()}</span>{s.status === 'HIDDEN' ? <button type="button" onClick={() => set(s.id, 'OPEN')} className="text-xs underline">Restore</button> : <button type="button" onClick={() => set(s.id, 'HIDDEN')} className="text-xs text-danger underline">Hide</button>}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Groups() {
  const { data, reload } = useApi<{ items: { id: string; slug: string; name: string; kind: string; game: string | null; status: string; guild: string | null; members: number; squads: number; owner: { name: string; username: string | null } | null }[] }>('/cc/gaming/groups');
  async function set(id: string, status: string) {
    const reason = status === 'SUSPENDED' ? window.prompt('Reason (the owner will see it):') : undefined;
    if (status === 'SUSPENDED' && !reason) return;
    await api.post(`/cc/gaming/groups/${id}/status`, { status, reason }).catch(() => undefined);
    reload();
  }
  return (
    <Panel title="Squads, guilds & teams">
      <ul className="grid gap-2 text-sm">
        {!data ? <li className="text-ink-muted">Loading…</li> : data.items.length === 0 ? <li className="text-ink-muted">None yet.</li> : data.items.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
            <span><Link href={`/experiences/gaming/groups/${g.slug}`} target="_blank" className="font-semibold underline">{g.name}</Link><span className="block text-xs text-ink-muted">{g.kind.toLowerCase()}{g.guild ? ` in ${g.guild}` : ''} · {g.members} members{g.kind === 'GUILD' ? ` · ${g.squads} squads` : ''} · owner {g.owner?.username ? `@${g.owner.username}` : g.owner?.name}</span></span>
            <span className="flex gap-2"><span className="text-xs font-bold">{g.status.toLowerCase()}</span>{g.status === 'ACTIVE' ? <button type="button" onClick={() => set(g.id, 'SUSPENDED')} className="text-xs text-danger underline">Suspend</button> : <button type="button" onClick={() => set(g.id, 'ACTIVE')} className="text-xs underline">Restore</button>}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Disputes() {
  const { data, reload } = useApi<{ items: { id: string; status: string; reason: string | null; createdAt: string; resolution: string | null; match: { round: number; stage: string; homeScore: number | null; awayScore: number | null; tournament: { title: string; slug: string; id: string } } | null }[] }>('/cc/gaming/disputes');
  async function resolve(id: string, status: 'RESOLVED' | 'DISMISSED') {
    const resolution = window.prompt('Resolution note:');
    if (!resolution) return;
    await api.post(`/cc/reports/${id}`, { status, resolution }).catch(() => undefined);
    reload();
  }
  return (
    <Panel title="Match disputes">
      <p className="mb-3 text-sm text-ink-muted">The organiser reviews a dispute first. Step in when needed — results can be corrected from the tournament page (organiser tools are available to the gaming team).</p>
      <ul className="grid gap-2 text-sm">
        {!data ? <li className="text-ink-muted">Loading…</li> : data.items.length === 0 ? <li className="text-ink-muted">No disputes.</li> : data.items.map((d) => (
          <li key={d.id} className="rounded-xl border border-line p-3">
            <p className="font-semibold">{d.match ? <Link href={`/experiences/gaming/${d.match.tournament.slug}#fixtures`} target="_blank" className="underline">{d.match.tournament.title}</Link> : 'Match'} · {d.match ? `${d.match.stage.toLowerCase()} round ${d.match.round} (${d.match.homeScore ?? '-'}–${d.match.awayScore ?? '-'})` : ''}</p>
            <p className="whitespace-pre-line text-ink-soft">{d.reason}</p>
            <p className="text-xs text-ink-muted">{date(d.createdAt)} · {d.status.toLowerCase()}{d.resolution ? ` · ${d.resolution}` : ''}</p>
            {['OPEN', 'REVIEWING'].includes(d.status) && <div className="mt-2 flex gap-2"><button type="button" onClick={() => resolve(d.id, 'RESOLVED')} className="h-9 rounded-full border border-line px-3 text-xs font-semibold">Resolved</button><button type="button" onClick={() => resolve(d.id, 'DISMISSED')} className="h-9 rounded-full border border-line px-3 text-xs font-semibold">Dismiss</button></div>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Invites() {
  const { data } = useApi<{ items: { id: string; kind: string; game: string; platform: string; slotsNeeded: number; accepted: number; notified: number; status: string; createdAt: string; expiresAt: string }[] }>('/cc/gaming/invites');
  return (
    <Panel title="Gaming invitations (monitoring)">
      <p className="mb-3 text-sm text-ink-muted">Counts only. Locations are never stored exactly and are never shown here; who declined is not recorded for anyone to see.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="text-left text-xs uppercase text-ink-muted"><tr><th className="p-2">When</th><th className="p-2">Kind</th><th className="p-2">Game</th><th className="p-2">Accepted</th><th className="p-2">Notified</th><th className="p-2">Status</th></tr></thead>
          <tbody>{(data?.items ?? []).map((i) => <tr key={i.id} className="border-t border-line"><td className="p-2">{date(i.createdAt)}</td><td className="p-2">{i.kind.toLowerCase()}</td><td className="p-2">{i.game} · {i.platform}</td><td className="p-2">{i.accepted}/{i.slotsNeeded}</td><td className="p-2">{i.kind === 'EXTERNAL' ? 'link' : i.notified}</td><td className="p-2">{i.status.toLowerCase()}</td></tr>)}</tbody>
        </table>
      </div>
    </Panel>
  );
}
