import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Empty, PageHero } from '@/components/public/Cards';
import { CategoryChips, Filters, Pager } from '@/components/public/Filters';
import { ActivityCard } from '@/components/public/listings';
import { getCatalogue, getList, pick } from '@/lib/public';
import { getSite, waHref } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Activities',
  description: 'Basketball, running, gaming and more — find people to do things with, in Dar es Salaam and around the world.',
};
export const revalidate = 60;

const KEYS = ['country', 'city', 'category', 'mode', 'level', 'when', 'q', 'page', 'from', 'to', 'available'];

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pick(await searchParams, KEYS);
  const [{ settings }, catalogue, list] = await Promise.all([getSite(), getCatalogue(), getList('/public/activities', params)]);
  const past = params.when === 'past';

  return (
    <PublicShell>
      <PageHero
        kicker="Enhakkore Activities"
        title="Find people to do things with"
        intro="Pickup basketball, morning runs, FC nights, hikes and more — organised by the community and by Enhakkore. Every activity is reviewed before it is published."
      >
        <div className="flex flex-wrap gap-3">
          <Link href="/activities/host" className="inline-flex h-12 items-center rounded-full bg-clay-400 px-6 font-bold text-acacia-700 shadow-sm hover:bg-clay-500 hover:text-white">
            Host an activity
          </Link>
          <Link href="/experiences/communities" className="inline-flex h-12 items-center rounded-full border border-acacia-600/30 bg-white px-6 font-semibold text-acacia-600">
            Find your people
          </Link>
        </div>
      </PageHero>

      <section className="shell py-8 md:py-12">
        <CategoryChips base="/activities" catalogue={catalogue} kind="ACTIVITY" active={params.category} params={params} />
        <div className="mt-5">
          <Filters
            action="/activities"
            catalogue={catalogue}
            kind="ACTIVITY"
            values={params}
            extra={[
              { name: 'mode', label: 'Where', options: [{ value: '', label: 'In person & online' }, { value: 'IN_PERSON', label: 'In person' }, { value: 'ONLINE', label: 'Online' }] },
              { name: 'level', label: 'Level', options: [{ value: '', label: 'Any level' }, { value: 'BEGINNER', label: 'Beginner' }, { value: 'INTERMEDIATE', label: 'Intermediate' }, { value: 'ADVANCED', label: 'Advanced' }] },
              { name: 'available', label: 'Spaces', options: [{ value: '', label: 'Show all' }, { value: 'true', label: 'With spaces left' }] },
              { name: 'when', label: 'When', options: [{ value: '', label: 'Upcoming' }, { value: 'past', label: 'Past' }] },
            ]}
          />
        </div>

        <p className="mt-8 text-sm text-ink-muted">
          {list.total} {past ? 'past ' : ''}activit{list.total === 1 ? 'y' : 'ies'}
        </p>
        <div className="mt-4">
          {list.items.length ? (
            <CardGrid>
              {list.items.map((item) => (
                <ActivityCard key={item.id} item={item} />
              ))}
            </CardGrid>
          ) : (
            <Empty
              title={past ? 'No past activities here yet' : 'Nothing scheduled here yet'}
              body="Activities appear once they have been reviewed. Be the first: host one in your city, and we will help you get people together."
              action={
                <>
                  <Link href="/activities/host" className="inline-flex h-11 items-center rounded-full bg-clay-400 px-5 text-sm font-bold text-acacia-700">
                    Host an activity
                  </Link>
                  <a href={waHref(settings, 'general')} target="_blank" rel="noreferrer noopener" className="inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-semibold">
                    Ask us on WhatsApp
                  </a>
                </>
              }
            />
          )}
        </div>
        <Pager base="/activities" page={list.page} totalPages={list.totalPages} params={params} />
      </section>
    </PublicShell>
  );
}
