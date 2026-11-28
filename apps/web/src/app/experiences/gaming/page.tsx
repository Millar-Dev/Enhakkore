import type { Metadata } from 'next';
import Link from 'next/link';
import { TOURNAMENT_FORMAT_LABELS, formatInZone } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Empty, ListingCard, SectionTitle } from '@/components/public/Cards';
import { cx } from '@/components/ui';
import { apiGet, query } from '@/lib/api';
import { pick } from '@/lib/public';
import { getSite } from '@/lib/site';
import { SmartImage } from '@/components/public/SmartImage';
import { LocationSelector } from '@/components/public/LocationSelector';

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
  isDemo?: boolean;
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
      badges={[...(item.isDemo ? [{ label: 'Demo', tone: 'demo' as const }] : []), { label: 'Free', tone: 'green' as const }, ...(item.registrationOpen && !item.isDemo ? [{ label: 'Registration open', tone: 'gold' as const }] : [])]}
      tone={item.status === 'COMPLETED' ? 'past' : 'default'}
    />
  );
}

/** A large tournament card: picture, the facts and a clear register button. */
function Feature({ item }: { item: TournamentCard }) {
  return (
    <Link href={`/experiences/gaming/${item.slug}`} className="card-lift group block w-[84vw] max-w-[24rem] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#0d2240] md:w-auto md:max-w-none">
      <div className="relative aspect-[16/9] overflow-hidden bg-[#0b0a24]">
        {item.coverImage && <SmartImage src={item.coverImage} alt="" fill sizes="(max-width:768px) 84vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.05]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d2240] via-transparent to-transparent" />
        <div className="absolute left-3 top-3 flex gap-1">
          {item.isDemo && <span className="rounded-full bg-white/90 px-2 py-0.5 text-[0.625rem] font-bold uppercase text-[#4b2a8a]">Demo</span>}
        </div>
        <div className="absolute inset-x-3 bottom-2 flex items-end justify-between gap-2">
          <p className="line-clamp-2 text-lg font-bold leading-tight">{item.title}</p>
          <span className="shrink-0 rounded-full bg-[#1f9a55] px-2.5 py-0.5 text-[0.6875rem] font-bold">FREE</span>
        </div>
      </div>
      <div className="p-3">
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-[0.8125rem] text-white/75">
          {item.startsAt && <span>📅 {formatInZone(item.startsAt, item.timezone, 'date')}</span>}
          <span>👥 {TOURNAMENT_FORMAT_LABELS[item.format] ?? item.format}{item.teamSize > 1 ? ` (${item.teamSize})` : ''}</span>
          {item.slots ? <span>🏆 {item.slots} {item.teamSize > 1 ? 'teams' : 'players'}</span> : null}
        </p>
        <span className="mt-3 flex h-11 items-center justify-center rounded-full bg-clay-400 text-sm font-bold text-acacia-700">{item.isDemo ? 'See example →' : item.registrationOpen ? 'Register now →' : 'View tournament →'}</span>
      </div>
    </Link>
  );
}

export default async function GamingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pick(await searchParams, ['q', 'game', 'kind', 'country', 'city']);
  const { settings } = await getSite();
  const [current, past] = await Promise.all([
    apiGet<Data>(`/public/tournaments${query(params)}`, 60),
    apiGet<Data>(`/public/tournaments${query({ ...params, when: 'past' })}`, 120),
  ]);
  const games = current?.games ?? [];
  const items = current?.items ?? [];
  const online = items.filter((item) => item.kind === 'ONLINE');
  const consoleSessions = items.filter((item) => item.kind === 'CONSOLE');
  const href = (changes: Record<string, string | undefined>) => `/experiences/gaming${query({ ...params, ...changes })}`;
  const TITLE = settings.gaming.heroTitle.split(/(?<=\.)\s+/);

  return (
    <PublicShell>
      {/* Hero: the gaming picture, the promise, and two clear ways in. */}
      <section className="relative isolate overflow-hidden bg-[#0b0a24] text-white">
        <SmartImage src={settings.gaming.heroImage} alt="" fill priority sizes="100vw" className="object-cover object-[center_30%] opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0a24] via-[#0b0a24]/55 to-[#0b0a24]/20 md:bg-gradient-to-r md:from-[#0b0a24]/95 md:via-[#0b0a24]/55 md:to-transparent" />
        <div className="shell relative flex min-h-[min(30rem,72svh)] flex-col justify-end py-7 text-center md:min-h-[28rem] md:justify-center md:py-16 md:text-left">
          <h1 className="font-display text-[clamp(1.9rem,8vw,4rem)] uppercase leading-[1.02] tracking-wide">
            {TITLE.map((part, index) => (
              <span key={part + index} className={index === TITLE.length - 1 && TITLE.length > 1 ? 'block text-clay-400' : ''}>
                {part}{' '}
              </span>
            ))}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[0.9375rem] text-white/85 md:mx-0 md:max-w-xl md:text-lg">{settings.gaming.heroSubtitle}</p>
          <div className="mx-auto mt-5 grid w-full max-w-xs gap-2.5 sm:max-w-md sm:grid-cols-2 md:mx-0">
            <Link href="#tournaments" className="inline-flex h-12 items-center justify-center rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700">Join a tournament →</Link>
            <Link href="#games" className="inline-flex h-12 items-center justify-center rounded-full border border-white/50 px-5 text-sm font-semibold hover:bg-white/10">Browse games</Link>
          </div>
        </div>
      </section>

      {/* The Gaming Hub's areas — discovery here, personal dashboard in the Account Centre. */}
      <nav aria-label="Gaming Hub" className="border-b border-line bg-white">
        <div className="shell grid grid-cols-2 gap-2 py-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { href: '/experiences/gaming/tournaments', label: 'Tournaments', icon: '🏆' },
            { href: '/experiences/gaming/tournaments/new', label: 'Create a tournament', icon: '➕' },
            { href: '/experiences/gaming/sessions', label: 'Gaming sessions', icon: '🎮' },
            { href: '/experiences/gaming/groups', label: 'Squads & guilds', icon: '🛡️' },
            { href: '/account/gaming?tab=friends&view=find', label: 'Find players', icon: '📍' },
            { href: '/experiences/gaming/organisers/apply', label: 'Esports organisers', icon: '✓' },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="flex min-h-12 items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold leading-tight text-ink [overflow-wrap:anywhere] hover:border-acacia-600">
              <span aria-hidden>{item.icon}</span>{item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Featured: the next tournaments as large cards. */}
      {items.length > 0 && (
        <section id="tournaments" className="band band-dark-a scroll-mt-20 text-white">
          <div className="shell py-6 md:py-10">
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="text-[1.15rem] font-bold md:text-[1.75rem]">Upcoming tournaments</h2>
              <Link href="#online" className="inline-flex min-h-10 items-center text-sm font-semibold text-clay-400">See all →</Link>
            </div>
            <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:grid md:grid-cols-2 md:gap-5 md:overflow-visible md:px-0 xl:grid-cols-3">
              {items.slice(0, 6).map((item) => <Feature key={item.id} item={item} />)}
            </div>
          </div>
        </section>
      )}

      <section className="shell py-6 md:py-12">
        <div className="mb-4 flex flex-wrap items-center gap-2">
        <LocationSelector country={params.country} city={params.city} tone="light" compact />
        <form action="/experiences/gaming" role="search" className="flex h-11 min-w-[14rem] flex-1 items-center gap-2 rounded-full border border-line bg-white pl-4 pr-1 md:max-w-xl">
          <input name="q" defaultValue={params.q} placeholder="Search a game — e.g. Free Fire" className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none" aria-label="Search gaming" />
          {params.country && <input type="hidden" name="country" value={params.country} />}
          {params.city && <input type="hidden" name="city" value={params.city} />}
          <button className="h-9 shrink-0 rounded-full bg-acacia-700 px-4 text-xs font-bold text-white">Search</button>
        </form>
        </div>
        <div id="games" className="no-scrollbar -mx-5 flex scroll-mt-24 gap-2 overflow-x-auto overscroll-x-contain px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
          <Link href={href({ game: undefined })} className={cx('chip', !params.game && 'chip-active')}>All games</Link>
          {games.map((game) => (
            <Link key={game.slug} href={href({ game: game.slug })} className={cx('chip', params.game === game.slug && 'chip-active')}>
              {game.icon} {game.name}
            </Link>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { value: undefined, label: 'Everything' },
            { value: 'online', label: 'Online tournaments' },
            { value: 'console', label: 'PS & console sessions' },
          ].map((option) => (
            <Link key={option.label} href={href({ kind: option.value })} className={cx('chip', params.kind === option.value && 'chip-active')}>{option.label}</Link>
          ))}
        </div>

        {(!params.kind || params.kind === 'online') && (
          <div id="online" className="mt-10 scroll-mt-24">
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
