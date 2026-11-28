import type { Metadata } from 'next';
import Link from 'next/link';
import type { CommunityCard } from '@/components/home/types';
import { PublicShell } from '@/components/layout/PublicShell';
import { AppHero } from '@/components/public/AppHero';
import { CardGrid, Empty } from '@/components/public/Cards';
import { CommunityTile } from '@/components/public/experience';
import { RecommendedCommunities } from '@/components/public/RecommendedCommunities';
import { apiGet, query } from '@/lib/api';
import { pick } from '@/lib/public';
import { getSite } from '@/lib/site';

export const metadata: Metadata = { title: 'Study groups', description: 'Find or start a study group — medicine, programming, languages, maths and more.' };
export const revalidate = 30;

interface SearchHit { id: string; slug: string; name: string; summary: string | null; subject: string | null; topic: string | null; course: string | null; institution: string | null; mode: string; private: boolean; official: boolean; isDemo: boolean; memberCount: number; matchedIn: string[] }

/** Experiences → Workshops & Learning → Study groups. Any member can start one. */
export default async function StudyGroupsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pick(await searchParams, ['q', 'country', 'city']);
  const [data, { settings }, search] = await Promise.all([
    apiGet<{ items: CommunityCard[] }>(`/public/communities${query({ ...params, q: undefined, kind: 'STUDY_GROUP' })}`, 30),
    getSite(),
    // Meaning-aware search: “human heart” also finds cardiology, cardiovascular and anatomy groups.
    params.q ? apiGet<{ items: SearchHit[]; expanded: string[] }>(`/public/groups/search${query({ q: params.q, kind: 'STUDY_GROUP' })}`, false) : Promise.resolve(null),
  ]);
  return (
    <PublicShell>
      <AppHero
        title="Study Groups"
        subtitle="Learn together — find a group for your subject, or start your own in a minute"
        image={settings.pages.experiencesHeroImage}
        search={{ action: '/experiences/study-groups', placeholder: 'Search subjects, topics, schools…', value: params.q, hidden: { country: params.country, city: params.city } }}
        location={{ country: params.country, city: params.city }}
      />
      <section className="band band-ivory">
        <div className="shell py-8 md:py-12">
          <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-ink">Start a study group</p>
              <p className="text-sm text-ink-muted">Public or private, online or in person. No approval needed — you become the group admin. Phone numbers are never shown to members.</p>
            </div>
            <Link href="/experiences/study-groups/new" className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-clay-400 px-6 text-sm font-bold text-acacia-700">＋ Create a study group</Link>
          </div>
          {params.q ? (
            <div>
              <h2 className="text-xl font-bold text-ink">Study groups for “{params.q}”</h2>
              {search?.expanded.length ? <p className="mt-1 text-sm text-ink-muted">Also matching related terms: {search.expanded.slice(0, 8).join(', ')}</p> : null}
              {search?.items.length ? (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {search.items.map((hit) => (
                    <li key={hit.id}>
                      <Link href={`/experiences/communities/${hit.slug}`} className="card-lift block h-full rounded-2xl border border-line bg-white p-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-clay-700">{hit.private ? '🔒 Private' : 'Public'}{hit.official ? ' · Official' : ''}{hit.isDemo ? ' · DEMO' : ''}</span>
                        <span className="mt-1 block text-lg font-bold text-ink">{hit.name}</span>
                        <span className="block text-sm text-ink-muted">{[hit.subject, hit.topic, hit.course, hit.institution].filter(Boolean).join(' · ')}</span>
                        {hit.summary && <span className="mt-1 block text-sm text-ink-soft">{hit.summary}</span>}
                        <span className="mt-2 block text-xs text-ink-muted">{hit.memberCount} members · {hit.mode === 'ONLINE' ? 'Online' : hit.mode === 'BOTH' ? 'Online & in person' : 'In person'}{hit.matchedIn.length ? ` · matched in ${hit.matchedIn.slice(0, 3).join(', ')}` : ''}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty title="No study groups match yet" body="Start one for this subject and invite classmates." action={<Link href="/experiences/study-groups/new" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Create a study group</Link>} />
              )}
              <Link href="/experiences/study-groups" className="mt-6 inline-flex min-h-10 items-center text-sm font-semibold text-acacia-700 underline">See all study groups</Link>
            </div>
          ) : (
          <>
          <RecommendedCommunities kind="STUDY_GROUP" />
          <h2 className="mb-4 text-xl font-bold text-ink">All study groups</h2>
          {data?.items.length ? (
            <CardGrid>{data.items.map((group) => <CommunityTile key={group.id} community={group} />)}</CardGrid>
          ) : (
            <Empty title="No study groups here yet" body="Be the first — start one for your subject and invite classmates." action={<Link href="/experiences/study-groups/new" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Create a study group</Link>} />
          )}
          </>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
