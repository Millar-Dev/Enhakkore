import type { Metadata } from 'next';
import Link from 'next/link';
import { DemoNotice } from '@/components/public/DemoNotice';
import { notFound } from 'next/navigation';
import { TOURNAMENT_FORMAT_LABELS, TOURNAMENT_KIND_LABELS, formatInZone } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { Facts, Prose } from '@/components/public/Cards';
import { SmartImage } from '@/components/public/SmartImage';
import { ShareButton, TrackView } from '@/components/public/Track';
import { TournamentJoin } from '@/components/public/TournamentJoin';
import { apiGet } from '@/lib/api';
import type { TournamentCard } from '../page';

export const revalidate = 30;

interface Data {
  tournament: TournamentCard & {
    description: string | null;
    summary: string | null;
    registrationDeadline: string | null;
    region: string | null;
    entryRequirements: string | null;
    rules: string | null;
    disputeProcedure: string | null;
    minAge: number | null;
    organiserName: string;
    bracket: { round: string; match: string; result: string }[];
  };
  lineup: { name: string; players: number; status: string }[];
}

const load = (slug: string) => apiGet<Data>(`/public/tournaments/${slug}`, 30);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await load((await params).slug);
  return { title: data?.tournament.title ?? 'Tournament', description: data?.tournament.summary ?? undefined };
}

export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const t = data.tournament;
  const when = (value: string | null) => (value ? formatInZone(value, t.timezone, 'full') : null);

  return (
    <PublicShell>
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#04182a,#0e4269)] text-white">
        {t.coverImage && <SmartImage src={t.coverImage} alt="" fill sizes="100vw" className="object-cover opacity-30" />}
        <div className="shell relative py-12 md:py-16">
          <Link href="/experiences/gaming" className="kicker !text-clay-400">← Gaming & esports</Link>
          <p className="mt-4 text-sm font-semibold text-clay-400">{t.game?.name} · {TOURNAMENT_KIND_LABELS[t.kind]} · {TOURNAMENT_FORMAT_LABELS[t.format]}{t.teamSize > 1 ? ` (${t.teamSize} players)` : ''}</p>
          <h1 className="display-lg mt-2">{t.title}</h1>
          <p className="mt-3 text-white/80">{when(t.startsAt) ?? 'Date to be announced'}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-safari-500 px-3 py-1 text-xs font-bold">Free entry</span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{t.status.replace(/_/g, ' ').toLowerCase()}</span>
          </div>
        </div>
      </section>
      <section className="shell grid gap-10 py-10 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-8">
          <div className="flex flex-wrap gap-2">
            <ShareButton subjectType="TOURNAMENT" subjectId={t.id} title={t.title} />
            <TrackView subjectType="TOURNAMENT" subjectId={t.id} />
          </div>
          {t.isDemo && <DemoNotice what="tournament" />}
          {t.summary && <p className="font-display text-2xl text-acacia-700">{t.summary}</p>}
          <Prose text={t.description} />
          <Facts
            items={[
              { label: 'Game', value: t.game?.name },
              { label: 'Format', value: `${TOURNAMENT_FORMAT_LABELS[t.format]}${t.teamSize > 1 ? ` — ${t.teamSize} per team` : ''}` },
              { label: 'Starts', value: when(t.startsAt) },
              { label: 'Registration closes', value: when(t.registrationDeadline) },
              { label: 'Server / region', value: [t.server, t.region].filter(Boolean).join(' · ') || null },
              { label: 'Venue', value: t.venue },
              { label: 'Slots', value: t.slots ? `${t.slotsLeft} of ${t.slots} left` : null },
              { label: 'Age', value: t.minAge ? `${t.minAge}+` : null },
              { label: 'Organiser', value: t.organiserName },
            ]}
          />
          {t.entryRequirements && (
            <div>
              <p className="font-display text-xl text-acacia-700">Entry requirements</p>
              <Prose text={t.entryRequirements} className="mt-2" />
            </div>
          )}
          {t.rules && (
            <div>
              <p className="font-display text-xl text-acacia-700">Rules</p>
              <Prose text={t.rules} className="mt-2" />
            </div>
          )}
          {t.bracket.length > 0 && (
            <div>
              <p className="font-display text-xl text-acacia-700">Bracket</p>
              <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-sand text-left text-xs uppercase tracking-wider text-ink-muted"><tr><th className="px-4 py-2">Round</th><th className="px-4 py-2">Match</th><th className="px-4 py-2">Result</th></tr></thead>
                  <tbody>{t.bracket.map((row, index) => <tr key={index} className="border-t border-line"><td className="px-4 py-2">{row.round}</td><td className="px-4 py-2 font-semibold">{row.match}</td><td className="px-4 py-2">{row.result || '—'}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
          {t.results && (
            <div className="rounded-xl border border-clay-100 bg-clay-50 p-5">
              <p className="font-display text-xl text-acacia-700">Results</p>
              <Prose text={t.results} className="mt-2" />
            </div>
          )}
          <div>
            <p className="font-display text-xl text-acacia-700">Disputes and appeals</p>
            <Prose text={t.disputeProcedure ?? 'Raise any dispute with the organiser as soon as possible, with screenshots or a recording. See the gaming rules and disputes policy.'} className="mt-2" />
            <Link href="/legal/gaming" className="mt-2 inline-block text-sm font-semibold text-acacia-600 underline">Gaming rules and disputes</Link>
          </div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[1.2rem] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
            <TournamentJoin slug={t.slug} format={t.format} teamSize={t.teamSize} open={t.registrationOpen && !t.isDemo} minAge={t.minAge} />
          </div>
          <div className="rounded-[1.2rem] border border-line bg-white p-5">
            <p className="font-bold text-acacia-700">Line-up ({data.lineup.length}{t.slots ? ` / ${t.slots}` : ''})</p>
            {data.lineup.length ? (
              <ul className="mt-3 divide-y divide-line text-sm">{data.lineup.map((entry, index) => <li key={index} className="flex justify-between py-2"><span className="font-semibold">{entry.name}</span><span className="text-ink-muted">{entry.players} player{entry.players === 1 ? '' : 's'}</span></li>)}</ul>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">No one has registered yet.</p>
            )}
          </div>
        </aside>
      </section>
    </PublicShell>
  );
}
