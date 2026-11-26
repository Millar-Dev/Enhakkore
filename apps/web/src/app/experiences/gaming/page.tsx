import type { Metadata } from 'next';
import Link from 'next/link';
import { TOURNAMENT_FORMAT_LABELS, formatInZone } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Empty, ListingCard, SectionTitle } from '@/components/public/Cards';
import { cx } from '@/components/ui';
import { apiGet, query } from '@/lib/api';
import { pick } from '@/lib/public';

export const metadata: Metadata = {
  title: 'Gaming & esports',
  description: 'Free online tournaments — Free Fire, PUBG Mobile, eFootball and more — and PlayStation / console sessions.',
};
export const revalidate = 60;

export interface TournamentCard {
  id: string;
  slug: string;
  title: string;
  kind: string;
  format: string;
  teamSize: number;
  startsAt: string | null;
  timezone: string;
  server: string | null;
  venue: string | null;
  coverImage: string | null;
  slots: number | null;
  slotsLeft: number | null;
  entryCount: number;
  registrationOpen: boolean;
  status: string;
  results: string | null;
  game: { name: string; slug: string; icon: string | null; group: string | null } | null;
}

interface Data {
  items: TournamentCard[];
  games: { name: string; slug: string; icon: string | null; group: string | null }[];
}

function Card({ item }: { item: TournamentCard }) {
  return (
    <ListingCard
      href={`/experiences/gaming/${item.slug}`}
      image={item.coverImage}
      kicker={`${item.game?.name ?? 'Gaming'} · ${TOURNAMENT_FORMAT_LABELS[item.format] ?? item.format}`}
      title={item.title}
      meta={[
        item.startsAt ? formatInZone(item.startsAt, item.timezone, 'datetime') : null,
        item.kind === 'ONLINE' ? `Online${item.server ? ` · ${item.server}` : ''}` : item.venue,
        item.slots ? `${item.slotsLeft} of ${item.slots} slots left` : null,
      ]}
      badges={[{ label: 'Free', tone: 'green' }, ...(item.registrationOpen ? [{ label: 'Registration open', tone: 'gold' as const }] : [])]}
      tone={item.status === 'COMPLETED' ? 'past' : 'default'}
    />
  );
}

export default async function GamingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pick(await searchParams, ['q', 'game', 'kind']);
  const [current, past] = await Promise.all([
    apiGet<Data>(`/public/tournaments${query(params)}`, 60),
    apiGet<Data>(`/public/tournaments${query({ ...params, when: 'past' })}`, 120),
  ]);
  const games = current?.games ?? [];
  const items = current?.items ?? [];
  const online = items.filter((item) => item.kind === 'ONLINE');
  const consoleSessions = items.filter((item) => item.kind === 'CONSOLE');
  const href = (changes: Record<string, string | undefined>) => `/experiences/gaming${query({ ...params, ...changes })}`;

  return (
    <PublicShell>
      <section className="bg-[linear-gradient(135deg,#04182a,#0e4269)] text-white">
        <div className="shell py-12 md:py-16">
          <p className="kicker !text-clay-400">Experiences · Gaming & esports</p>
          <h1 className="display-lg mt-3 max-w-3xl">Play, compete, meet your squad</h1>
          <p className="mt-4 max-w-2xl text-white/80">Online tournaments and PlayStation / console sessions. Every tournament is free to enter at launch — no entry fees are taken.</p>
          <form action="/experiences/gaming" className="mt-7 flex flex-col gap-2 rounded-[1.2rem] bg-white p-3 sm:flex-row">
            <input name="q" defaultValue={params.q} placeholder="Search a game — e.g. Free Fire" className="field h-12 flex-1 text-ink" aria-label="Search gaming" />
            <button className="h-12 rounded-[var(--radius-field)] bg-clay-400 px-6 font-bold text-acacia-700">Search</button>
          </form>
        </div>
      </section>
      <section className="shell py-8 md:py-12">
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
          <Link href={href({ game: undefined })} className={cx('chip', !params.game && 'chip-active')}>All games</Link>
          {games.map((game) => (
            <Link key={game.slug} href={href({ game: game.slug })} className={cx('chip', params.game === game.slug && 'chip-active')}>
              {game.icon} {game.name}
            </Link>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          {[
            { value: undefined, label: 'Everything' },
            { value: 'online', label: 'Online tournaments' },
            { value: 'console', label: 'PS & console sessions' },
          ].map((option) => (
            <Link key={option.label} href={href({ kind: option.value })} className={cx('chip', params.kind === option.value && 'chip-active')}>{option.label}</Link>
          ))}
        </div>

        {(!params.kind || params.kind === 'online') && (
          <div className="mt-10">
            <SectionTitle kicker="Online" title="Online tournaments" />
            {online.length ? <CardGrid>{online.map((item) => <Card key={item.id} item={item} />)}</CardGrid> : <Empty title="No online tournaments open right now" body="New tournaments are announced here and on our Instagram and TikTok." />}
          </div>
        )}
        {(!params.kind || params.kind === 'console') && (
          <div className="mt-12">
            <SectionTitle kicker="In person" title="PlayStation & console sessions" />
            {consoleSessions.length ? <CardGrid>{consoleSessions.map((item) => <Card key={item.id} item={item} />)}</CardGrid> : <Empty title="No console sessions scheduled" body="EA SPORTS FC, eFootball, Tekken, Mortal Kombat, NBA 2K nights appear here when they are planned." />}
          </div>
        )}
        {past?.items.length ? (
          <div className="mt-12">
            <SectionTitle kicker="Results" title="Past tournaments" />
            <CardGrid>{past.items.map((item) => <Card key={item.id} item={item} />)}</CardGrid>
          </div>
        ) : null}
        <p className="mt-12 text-center text-sm text-ink-muted">
          Want to run a tournament with Enhakkore? <Link href="/partner" className="font-semibold text-acacia-600 underline">Talk to us about gaming partnerships</Link>. Rules and disputes: <Link href="/legal/gaming" className="font-semibold text-acacia-600 underline">gaming rules</Link>.
        </p>
      </section>
    </PublicShell>
  );
}
