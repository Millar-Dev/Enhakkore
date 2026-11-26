import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Empty, ListingCard, PageHero, Prose, SectionTitle } from '@/components/public/Cards';
import { Polls } from '@/components/public/Polls';
import { apiGet } from '@/lib/api';
import { getList, placeLabel, type Listing } from '@/lib/public';

export const metadata: Metadata = { title: 'Community', description: 'Stories, polls and local challenges from the Enhakkore community.' };
export const revalidate = 60;

export default async function CommunityPage() {
  const [stories, polls, challenges] = await Promise.all([
    getList('/public/stories', { pageSize: 9 }),
    apiGet<Parameters<typeof Polls>[0]['initial']>('/public/polls', 60),
    apiGet<Listing[]>('/public/challenges', 60),
  ]);
  return (
    <PublicShell>
      <PageHero kicker="Community" title="Stories, polls & challenges" intro="Discoveries shared by members, votes on what we do next, and challenges to get you out exploring.">
        <div className="flex flex-wrap gap-3">
          <Link href="/stories/new" className="inline-flex h-12 items-center rounded-full bg-acacia-600 px-6 font-bold text-white">Share a story</Link>
          <Link href="/experiences/communities" className="inline-flex h-12 items-center rounded-full border border-acacia-600/30 bg-white px-6 font-semibold text-acacia-600">Find a community</Link>
        </div>
      </PageHero>
      <section className="shell py-12" id="stories">
        <SectionTitle kicker="Community stories" title="Shared by members" />
        {stories.items.length ? (
          <CardGrid>{stories.items.map((story) => <ListingCard key={story.id} href={`/stories/${story.slug}`} image={story.coverImage} kicker={placeLabel(story) || 'Story'} title={String(story.title)} meta={[`By ${story.authorName}`, (story.excerpt as string) ?? null]} />)}</CardGrid>
        ) : (
          <Empty title="No stories yet" body="Been somewhere good, tried something new? Share it — stories appear once the team has read them." action={<Link href="/stories/new" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Share a story</Link>} />
        )}
      </section>
      <section className="bg-[color:var(--color-cream)]" id="polls">
        <div className="shell py-12">
          <SectionTitle kicker="Community polls" title="Have your say" subtitle="Vote on the next activity, trip or event." />
          <Polls initial={polls ?? []} />
        </div>
      </section>
      <section className="shell py-12" id="challenges">
        <SectionTitle kicker="Local challenges" title="Get out and explore" />
        {challenges?.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {challenges.map((challenge) => (
              <div key={challenge.id} className="rounded-[1.1rem] border border-line bg-white p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-clay-600">{placeLabel(challenge) || 'Anywhere'}{challenge.endsAt ? ` · until ${new Date(String(challenge.endsAt)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : ''}</p>
                <p className="mt-1 font-display text-2xl text-acacia-700">{String(challenge.title)}</p>
                <Prose text={challenge.description} className="mt-2 text-[0.9375rem]" />
                {challenge.howToTakePart ? <Prose text={String(challenge.howToTakePart)} className="mt-3 text-sm text-ink-muted" /> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">No challenges running right now — check back soon.</p>
        )}
      </section>
    </PublicShell>
  );
}
