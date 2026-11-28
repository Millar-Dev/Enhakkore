'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BRACKET_FORMATS, GAMING_PLATFORMS, ORGANISER_TYPES, TOURNAMENT_CATEGORIES } from '@enhakkore/shared';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { uploadFile } from '@/lib/upload';

interface Card {
  slug: string;
  title: string;
  category: string;
  organiserName: string;
  verifiedOrganiser: boolean;
  game: { name: string; slug: string } | null;
  platform: string | null;
  bracketFormat: string;
  kind: string;
  startsAt: string | null;
  status: string;
  slots: number | null;
  entries: number;
  coverImage: string | null;
  prizeStated: boolean;
  registrationOpen: boolean;
  isDemo: boolean;
  memberCreated: boolean;
}

const FORMAT = Object.fromEntries(BRACKET_FORMATS.map((f) => [f.key, f.label]));
const CATEGORY = Object.fromEntries(TOURNAMENT_CATEGORIES.map((c) => [c.key, c.label]));

/** Public tournament discovery with the five category tabs. */
export function TournamentDiscover() {
  const [category, setCategory] = useState('');
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Card[] | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const c = new URLSearchParams(window.location.search).get('category');
      if (c) setCategory(c.toUpperCase());
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      api.get<{ items: Card[] }>(`/public/gaming/tournaments?category=${category}&when=${when}&q=${encodeURIComponent(q)}`, { token: null }).then((d) => setItems(d.items)).catch(() => setItems([]));
    }, q ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [category, when, q]);

  return (
    <div className="shell py-8 md:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link href="/experiences/gaming" className="kicker inline-flex min-h-10 items-center">← Gaming Hub</Link>
          <h1 className="text-h1 [overflow-wrap:anywhere]">Tournaments</h1>
          <p className="mt-1 text-sm text-ink-muted">Free to enter. Member tournaments are published straight away and monitored by the Enhakkore team.</p>
        </div>
        <Link href="/experiences/gaming/tournaments/new" className="inline-flex h-11 items-center rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700">+ Create tournament</Link>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search tournaments, games, organisers…" aria-label="Search tournaments" className="h-11 min-w-0 flex-1 rounded-full border border-line px-4 text-[0.9375rem] outline-none focus:border-acacia-600 sm:max-w-md" />
        <div className="flex gap-1 rounded-full border border-line p-1">
          {(['upcoming', 'past'] as const).map((key) => <button key={key} type="button" onClick={() => setWhen(key)} className={`h-9 rounded-full px-4 text-sm font-semibold ${when === key ? 'bg-[#06152a] text-white' : ''}`}>{key === 'upcoming' ? 'Upcoming' : 'Results'}</button>)}
        </div>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="tablist" aria-label="Tournament category">
        <button type="button" role="tab" aria-selected={category === ''} onClick={() => setCategory('')} className={`chip shrink-0 ${category === '' ? 'chip-active' : ''}`}>All</button>
        {TOURNAMENT_CATEGORIES.map((c) => <button key={c.key} type="button" role="tab" aria-selected={category === c.key} onClick={() => setCategory(c.key)} className={`chip shrink-0 ${category === c.key ? 'chip-active' : ''}`}>{c.label.replace(' Tournament', '')}</button>)}
      </div>
      {items === null ? <p className="mt-6 text-sm text-ink-muted">Loading…</p> : items.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">No tournaments here yet. <Link href="/experiences/gaming/tournaments/new" className="font-semibold text-acacia-700 underline">Create the first one</Link>.</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <li key={t.slug}>
              <Link href={`/experiences/gaming/${t.slug}`} className="card-lift flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white">
                <span className="relative block aspect-[16/9] bg-[linear-gradient(135deg,#04182a,#0e4269)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t.coverImage && <img src={t.coverImage} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  <span className="absolute left-3 top-3 rounded-full bg-clay-400 px-2.5 py-0.5 text-[0.6875rem] font-bold uppercase text-acacia-700">{CATEGORY[t.category]?.replace(' Tournament', '') ?? t.category}</span>
                  {t.isDemo && <span className="absolute right-3 top-3 rounded-full bg-white px-2 py-0.5 text-[0.6875rem] font-bold">DEMO</span>}
                </span>
                <span className="flex flex-1 flex-col p-4">
                  <span className="text-xs font-semibold text-clay-700">{t.game?.name ?? 'Game'}{t.platform ? ` · ${t.platform}` : ''} · {FORMAT[t.bracketFormat] ?? t.bracketFormat}</span>
                  <span className="mt-1 text-lg font-bold leading-snug text-ink">{t.title}</span>
                  <span className="mt-1 text-sm text-ink-muted">
                    by {t.organiserName}
                    {t.verifiedOrganiser ? <span className="ml-1 rounded bg-acacia-50 px-1.5 text-[0.6875rem] font-bold text-acacia-700">✓ Verified organiser</span> : null}
                  </span>
                  <span className="mt-auto pt-3 text-sm text-ink-soft">
                    {t.startsAt ? new Date(t.startsAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dar_es_Salaam' }) : 'Date to be announced'}
                    {' · '}{t.entries}{t.slots ? `/${t.slots}` : ''} entries{t.prizeStated ? ' · prize stated by organiser' : ''}
                  </span>
                  <span className={`mt-2 inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-bold ${t.registrationOpen ? 'bg-safari-500 text-white' : 'bg-sand text-ink-soft'}`}>{t.registrationOpen ? 'Free · registration open' : t.status.replace(/_/g, ' ').toLowerCase()}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Create Tournament — published immediately (no routine approval). */
export function CreateTournamentForm() {
  const { user, status } = useSession();
  const [games, setGames] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    title: '', category: 'FRIENDLY', organiserType: 'INDIVIDUAL', organiserName: '', contactName: '', contactPhone: '', contactEmail: '',
    gameId: '', platform: 'Mobile', bracketFormat: 'SINGLE_ELIMINATION', format: 'SOLO', teamSize: 1, kind: 'ONLINE',
    summary: '', description: '', rules: '', startsAt: '', registrationDeadline: '', slots: 16, venue: '', server: '', minAge: '', prizeDetails: '', coverImage: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ items: { id: string; name: string }[] }>('/public/gaming/games', { token: null }).then((d) => setGames(d.items)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, contactName: f.contactName || user.name, organiserName: f.organiserName || user.name, contactEmail: f.contactEmail || user.email, contactPhone: f.contactPhone || (user.phone ?? '') }));
  }, [user]);

  if (status === 'anonymous') {
    return (
      <div className="shell max-w-xl py-12 text-center">
        <h1 className="text-h1 [overflow-wrap:anywhere]">Create a tournament</h1>
        <p className="mt-3 text-ink-muted">Sign in or create a free account to publish a tournament.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/signin?next=/experiences/gaming/tournaments/new" className="inline-flex h-12 items-center rounded-full bg-clay-400 px-6 font-bold text-acacia-700">Sign in</Link>
          <Link href="/join?next=/experiences/gaming/tournaments/new" className="inline-flex h-12 items-center rounded-full border border-line px-6 font-semibold">Create account</Link>
        </div>
      </div>
    );
  }

  const set = (key: keyof typeof form, value: string | number) => setForm((f) => ({ ...f, [key]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const result = await api.post<{ slug: string }>('/gaming/tournaments', {
        ...form,
        teamSize: Number(form.teamSize),
        slots: Number(form.slots),
        minAge: form.minAge ? Number(form.minAge) : undefined,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : '',
        registrationDeadline: form.registrationDeadline ? new Date(form.registrationDeadline).toISOString() : undefined,
      });
      window.location.href = `/experiences/gaming/${result.slug}?created=1`;
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not publish it.');
      if (caught instanceof ApiError) setFields(caught.fields);
      setBusy(false);
    }
  }

  const label = 'grid gap-1 text-sm font-semibold text-ink';
  return (
    <div className="shell max-w-2xl py-8 md:py-12">
      <Link href="/account/gaming" className="kicker inline-flex min-h-10 items-center">← Gaming Hub</Link>
      <h1 className="text-h1 [overflow-wrap:anywhere]">Create a tournament</h1>
      <p className="mt-2 text-sm text-ink-muted">Your tournament is published as soon as you submit it. The Enhakkore team sees it straight away and may contact you on the phone number below. Entry is free — paid entry is not available yet.</p>
      <form onSubmit={submit} className="mt-6 grid gap-5" noValidate>
        {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
        <fieldset className="grid gap-3 rounded-2xl border border-line p-4">
          <legend className="px-1 text-sm font-bold">Tournament</legend>
          <label className={label}>Name<input required value={form.title} onChange={(e) => set('title', e.target.value)} className="field" maxLength={120} />{fields.title && <span className="text-xs text-danger">{fields.title}</span>}</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Tournament category<select value={form.category} onChange={(e) => set('category', e.target.value)} className="field">{TOURNAMENT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
            <label className={label}>Game<select required value={form.gameId} onChange={(e) => set('gameId', e.target.value)} className="field"><option value="">Choose…</option>{games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>{fields.gameId && <span className="text-xs text-danger">{fields.gameId}</span>}</label>
            <label className={label}>Platform<select value={form.platform} onChange={(e) => set('platform', e.target.value)} className="field">{GAMING_PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></label>
            <label className={label}>Format<select value={form.bracketFormat} onChange={(e) => set('bracketFormat', e.target.value)} className="field">{BRACKET_FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select></label>
            <label className={label}>Entries are<select value={form.format} onChange={(e) => set('format', e.target.value)} className="field"><option value="SOLO">Solo players</option><option value="DUO">Duos</option><option value="SQUAD">Squads</option><option value="TEAM">Teams</option></select></label>
            {form.format !== 'SOLO' && <label className={label}>Players per team<input type="number" min={2} max={20} value={form.teamSize} onChange={(e) => set('teamSize', Number(e.target.value))} className="field" /></label>}
            <label className={label}>Places (players or teams)<input type="number" min={2} max={1024} value={form.slots} onChange={(e) => set('slots', Number(e.target.value))} className="field" /></label>
            <label className={label}>Minimum age (optional)<input type="number" min={0} max={99} value={form.minAge} onChange={(e) => set('minAge', e.target.value)} className="field" /></label>
          </div>
          <label className={label}>Short summary<input value={form.summary} onChange={(e) => set('summary', e.target.value)} className="field" maxLength={300} /></label>
          <label className={label}>Rules<textarea required rows={5} value={form.rules} onChange={(e) => set('rules', e.target.value)} className="field" maxLength={8000} placeholder="Match format, how results are reported, fair play, disconnections…" />{fields.rules && <span className="text-xs text-danger">{fields.rules}</span>}</label>
          <label className={label}>Prize details (optional)<textarea rows={2} value={form.prizeDetails} onChange={(e) => set('prizeDetails', e.target.value)} className="field" maxLength={2000} /><span className="text-xs font-normal text-ink-muted">Shown as stated by you. Not verified by Enhakkore unless the team checks it.</span></label>
          <label className={label}>Cover image (optional)
            <input type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const stored = await uploadFile('CHAT_MEDIA', file); if (stored.url) set('coverImage', stored.url); } catch { setError('The image could not be uploaded.'); } }} />
          </label>
        </fieldset>
        <fieldset className="grid gap-3 rounded-2xl border border-line p-4">
          <legend className="px-1 text-sm font-bold">When and where</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Starts (your local time)<input type="datetime-local" required value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} className="field" />{fields.startsAt && <span className="text-xs text-danger">{fields.startsAt}</span>}</label>
            <label className={label}>Registration closes (optional)<input type="datetime-local" value={form.registrationDeadline} onChange={(e) => set('registrationDeadline', e.target.value)} className="field" /></label>
          </div>
          <div className="flex gap-2">
            {(['ONLINE', 'CONSOLE'] as const).map((kind) => <label key={kind} className={`chip cursor-pointer ${form.kind === kind ? 'chip-active' : ''}`}><input type="radio" className="sr-only" checked={form.kind === kind} onChange={() => set('kind', kind)} />{kind === 'ONLINE' ? 'Online' : 'Physical venue'}</label>)}
          </div>
          {form.kind === 'ONLINE' ? <label className={label}>Server / region (optional)<input value={form.server} onChange={(e) => set('server', e.target.value)} className="field" /></label> : <label className={label}>Venue<input value={form.venue} onChange={(e) => set('venue', e.target.value)} className="field" placeholder="A public venue" />{fields.venue && <span className="text-xs text-danger">{fields.venue}</span>}</label>}
        </fieldset>
        <fieldset className="grid gap-3 rounded-2xl border border-line p-4">
          <legend className="px-1 text-sm font-bold">Organiser</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Organiser type<select value={form.organiserType} onChange={(e) => set('organiserType', e.target.value)} className="field">{ORGANISER_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
            <label className={label}>Organiser name shown publicly<input required value={form.organiserName} onChange={(e) => set('organiserName', e.target.value)} className="field" maxLength={120} /></label>
            <label className={label}>Your full name (team only)<input required value={form.contactName} onChange={(e) => set('contactName', e.target.value)} className="field" maxLength={120} /></label>
            <label className={label}>Phone (team only)<input required type="tel" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} className="field" maxLength={40} />{fields.contactPhone && <span className="text-xs text-danger">{fields.contactPhone}</span>}</label>
            <label className={label}>Email (team only)<input type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} className="field" maxLength={160} /></label>
          </div>
          <p className="text-xs text-ink-muted">Your phone and email are visible only to the Enhakkore team, never to players. Esports tournaments show a verified badge only after the team verifies your <Link href="/experiences/gaming/organisers/apply" className="underline">esports organiser application</Link>.</p>
        </fieldset>
        <button disabled={busy} className="h-12 rounded-full bg-clay-400 text-sm font-bold text-acacia-700 disabled:opacity-50">{busy ? 'Publishing…' : 'Publish tournament'}</button>
      </form>
    </div>
  );
}

interface Match {
  id: string;
  stage: string;
  round: number;
  position: number;
  home: { id: string; name: string } | null;
  away: { id: string; name: string } | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerId: string | null;
  status: string;
  disputed: boolean;
}
interface Fixtures {
  format: string;
  canManage: boolean;
  myEntryIds: string[];
  matches: Match[];
  standings: { entryId: string; name: string; played: number; won: number; drawn: number; lost: number; scored: number; conceded: number; difference: number; points: number }[];
}

const STAGE: Record<string, string> = { WINNERS: 'Winners bracket', LOSERS: 'Losers bracket', GRAND_FINAL: 'Grand final', LEAGUE: 'Fixtures' };

/** Fixtures, bracket, table and organiser tools on a tournament page. */
export function TournamentFixtures({ slug, title }: { slug: string; title: string }) {
  const [data, setData] = useState<Fixtures | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({});
  const load = useCallback(() => api.get<Fixtures>(`/public/gaming/tournaments/${slug}/fixtures`).then(setData).catch(() => setData(null)), [slug]);
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
  async function generate() {
    const confirmAgain = data?.matches.some((m) => m.status === 'COMPLETED');
    if (confirmAgain && !window.confirm('Results exist already. Make the fixtures again and delete them?')) return;
    await run(api.post(`/gaming/tournaments/${slug}/fixtures${confirmAgain ? '?confirm=yes' : ''}`), 'Fixtures made. Players were notified.');
  }

  if (!data) return null;
  const stages = [...new Set(data.matches.map((m) => m.stage))];
  return (
    <section id="fixtures" className="scroll-mt-24">
      <h2 className="text-h3">Fixtures & results</h2>
      {message && <p role="status" className="mt-2 rounded-xl bg-sand p-3 text-sm text-ink-soft">{message}</p>}
      {data.canManage && (
        <div className="mt-3 flex flex-wrap gap-2 rounded-2xl border border-clay-400/60 bg-[#fff8e6] p-3 text-sm">
          <span className="w-full font-semibold">Organiser tools</span>
          <button type="button" onClick={generate} className="h-10 rounded-full bg-acacia-600 px-4 font-bold text-white">{data.matches.length ? 'Make fixtures again' : 'Make the fixtures'}</button>
          <button type="button" onClick={() => run(api.patch(`/gaming/tournaments/${slug}`, { status: 'REGISTRATION_CLOSED' }), 'Registration closed.')} className="h-10 rounded-full border border-line bg-white px-4 font-semibold">Close registration</button>
          <button type="button" onClick={() => run(api.patch(`/gaming/tournaments/${slug}`, { status: 'REGISTRATION_OPEN' }), 'Registration open.')} className="h-10 rounded-full border border-line bg-white px-4 font-semibold">Reopen registration</button>
          <button type="button" onClick={() => window.confirm(`Cancel ${title}? Players are told.`) && run(api.patch(`/gaming/tournaments/${slug}`, { status: 'CANCELLED' }), 'Cancelled.')} className="h-10 rounded-full border border-danger/30 bg-white px-4 font-semibold text-danger">Cancel tournament</button>
        </div>
      )}
      {data.matches.length === 0 ? <p className="mt-3 text-sm text-ink-muted">The fixtures appear here once the organiser makes them.</p> : (
        <div className="mt-4 grid gap-5">
          {data.standings.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full min-w-[28rem] text-sm">
                <thead className="bg-sand text-left text-xs uppercase tracking-wider text-ink-muted"><tr><th className="p-2">#</th><th className="p-2">Team</th><th className="p-2">P</th><th className="p-2">W</th><th className="p-2">D</th><th className="p-2">L</th><th className="p-2">GD</th><th className="p-2">Pts</th></tr></thead>
                <tbody>
                  {data.standings.map((row, index) => (
                    <tr key={row.entryId} className={`border-t border-line ${data.myEntryIds.includes(row.entryId) ? 'bg-[#fff8e6] font-semibold' : ''}`}><td className="p-2">{index + 1}</td><td className="p-2">{row.name}</td><td className="p-2">{row.played}</td><td className="p-2">{row.won}</td><td className="p-2">{row.drawn}</td><td className="p-2">{row.lost}</td><td className="p-2">{row.difference}</td><td className="p-2 font-bold">{row.points}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {stages.map((stage) => {
            const rounds = [...new Set(data.matches.filter((m) => m.stage === stage).map((m) => m.round))].sort((a, b) => a - b);
            return (
              <div key={stage}>
                <h3 className="text-sm font-bold uppercase tracking-wider text-ink-muted">{STAGE[stage] ?? stage}</h3>
                <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
                  {rounds.map((round) => (
                    <div key={round} className="grid min-w-[15rem] content-start gap-2">
                      <p className="text-xs font-semibold text-ink-muted">{stage === 'LEAGUE' ? `Matchday ${round}` : stage === 'GRAND_FINAL' ? 'Final' : `Round ${round}`}</p>
                      {data.matches.filter((m) => m.stage === stage && m.round === round).map((m) => {
                        const mine = [m.home?.id, m.away?.id].some((id) => id && data.myEntryIds.includes(id));
                        const score = scores[m.id] ?? { home: m.homeScore?.toString() ?? '', away: m.awayScore?.toString() ?? '' };
                        return (
                          <div key={m.id} className={`rounded-xl border bg-white p-2 text-sm ${mine ? 'border-clay-400' : 'border-line'}`}>
                            {[['home', m.home, m.homeScore], ['away', m.away, m.awayScore]].map(([side, entry, value]) => (
                              <p key={side as string} className={`flex items-center justify-between gap-2 ${m.winnerId && (entry as Match['home'])?.id === m.winnerId ? 'font-bold' : ''}`}>
                                <span className="truncate">{(entry as Match['home'])?.name ?? (m.status === 'BYE' ? 'Bye' : 'To be decided')}</span>
                                <span>{value as number | null ?? ''}</span>
                              </p>
                            ))}
                            {m.status === 'BYE' && <p className="text-xs text-ink-muted">Bye — advances automatically</p>}
                            {m.disputed && <p className="text-xs font-semibold text-danger">Result disputed</p>}
                            {data.canManage && m.home && m.away && (
                              <form className="mt-1 flex items-center gap-1" onSubmit={(event) => { event.preventDefault(); void run(api.post(`/gaming/matches/${m.id}/result`, { homeScore: Number(score.home), awayScore: Number(score.away) }), 'Result saved.'); }}>
                                <input aria-label="Home score" inputMode="numeric" value={score.home} onChange={(event) => setScores((s) => ({ ...s, [m.id]: { ...score, home: event.target.value } }))} className="h-9 w-12 rounded-lg border border-line text-center" />
                                <span>–</span>
                                <input aria-label="Away score" inputMode="numeric" value={score.away} onChange={(event) => setScores((s) => ({ ...s, [m.id]: { ...score, away: event.target.value } }))} className="h-9 w-12 rounded-lg border border-line text-center" />
                                <button className="h-9 rounded-full bg-acacia-600 px-3 text-xs font-bold text-white">Save</button>
                              </form>
                            )}
                            {mine && m.status === 'COMPLETED' && !data.canManage && (
                              <button type="button" onClick={() => { const reason = window.prompt('What is wrong with this result?'); if (reason) void run(api.post(`/gaming/matches/${m.id}/dispute`, { reason }), 'Dispute sent to the organiser.'); }} className="mt-1 text-xs text-danger underline">Dispute result</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Invite friends to a tournament (they register themselves). */
export function InviteFriendsToTournament({ slug }: { slug: string }) {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<{ member: { id: string; name: string; username: string | null } }[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  if (status !== 'authenticated') return null;
  return (
    <div className="rounded-2xl border border-line bg-white p-4 text-sm">
      {!open ? (
        <button type="button" onClick={() => { setOpen(true); api.get<{ friends: NonNullable<typeof friends> }>('/social/friends').then((d) => setFriends(d.friends)).catch(() => setFriends([])); }} className="font-semibold text-acacia-700 underline">Invite game friends</button>
      ) : (
        <>
          <p className="font-semibold">Invite game friends</p>
          {friends === null ? <p className="text-ink-muted">Loading…</p> : friends.length === 0 ? <p className="text-ink-muted">No friends yet — add them in Gaming Hub → Game Friends.</p> : (
            <div className="mt-2 flex flex-wrap gap-2">
              {friends.map((row) => (
                <label key={row.member.id} className={`chip cursor-pointer ${chosen.includes(row.member.id) ? 'chip-active' : ''}`}>
                  <input type="checkbox" className="sr-only" checked={chosen.includes(row.member.id)} onChange={() => setChosen((list) => (list.includes(row.member.id) ? list.filter((id) => id !== row.member.id) : [...list, row.member.id]))} />
                  {row.member.username ? `@${row.member.username}` : row.member.name}
                </label>
              ))}
            </div>
          )}
          {message && <p className="mt-2 text-ink-soft">{message}</p>}
          {chosen.length > 0 && <button type="button" onClick={() => api.post<{ invited: number }>(`/gaming/tournaments/${slug}/invite`, { userIds: chosen }).then((r) => setMessage(`Invited ${r.invited}.`)).catch((caught) => setMessage(caught instanceof ApiError ? caught.message : 'Could not invite.'))} className="mt-2 h-10 rounded-full bg-clay-400 px-4 font-bold text-acacia-700">Send invitations</button>}
        </>
      )}
    </div>
  );
}
