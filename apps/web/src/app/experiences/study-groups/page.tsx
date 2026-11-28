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

/** Experiences → Workshops & Learning → Study groups. Any member can start one. */
export default async function StudyGroupsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pick(await searchParams, ['q', 'country', 'city']);
  const [data, { settings }] = await Promise.all([apiGet<{ items: CommunityCard[] }>(`/public/communities${query({ ...params, kind: 'STUDY_GROUP' })}`, 30), getSite()]);
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
          <RecommendedCommunities kind="STUDY_GROUP" />
          <h2 className="mb-4 text-xl font-bold text-ink">{params.q ? `Study groups: “${params.q}”` : 'All study groups'}</h2>
          {data?.items.length ? (
            <CardGrid>{data.items.map((group) => <CommunityTile key={group.id} community={group} />)}</CardGrid>
          ) : (
            <Empty title="No study groups here yet" body="Be the first — start one for your subject and invite classmates." action={<Link href="/experiences/study-groups/new" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Create a study group</Link>} />
          )}
        </div>
      </section>
    </PublicShell>
  );
}
