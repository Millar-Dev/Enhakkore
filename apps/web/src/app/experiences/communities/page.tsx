import type { Metadata } from 'next';
import type { CommunityCard } from '@/components/home/types';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Empty, PageHero, SectionTitle } from '@/components/public/Cards';
import { CommunityApplyForm } from '@/components/public/CommunityActions';
import { CommunityTile } from '@/components/public/experience';
import { apiGet, query } from '@/lib/api';
import { getCatalogue, pick } from '@/lib/public';

export const metadata: Metadata = { title: 'Communities', description: 'Join interest-based communities — jogging, gaming, basketball, art and more.' };
export const revalidate = 60;

export default async function CommunitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pick(await searchParams, ['q', 'country']);
  const [data, catalogue, countries] = await Promise.all([
    apiGet<{ items: CommunityCard[] }>(`/public/communities${query(params)}`, 60),
    getCatalogue(),
    apiGet<{ id: string; name: string }[]>('/public/countries', 3600),
  ]);
  const categories = catalogue.categories.filter((item) => item.kind === 'ACTIVITY').map((item) => ({ id: item.id, name: item.name }));
  return (
    <PublicShell>
      <PageHero kicker="Experiences · Communities" title="Find your community" intro="Communities bring people together around what they love — a weekly run, a game, a sport, a craft. Join one to get its announcements and meetups." />
      <section className="shell py-8 md:py-12">
        <form action="/experiences/communities" className="flex flex-col gap-2 rounded-[1.1rem] border border-line bg-white p-3 sm:flex-row">
          <input name="q" defaultValue={params.q} placeholder="Search communities" className="field h-12 flex-1" aria-label="Search communities" />
          <button className="h-12 rounded-[var(--radius-field)] bg-acacia-600 px-6 font-bold text-white">Search</button>
        </form>
        <div className="mt-8">
          {data?.items.length ? (
            <CardGrid>{data.items.map((community) => <CommunityTile key={community.id} community={community} />)}</CardGrid>
          ) : (
            <Empty title="No communities yet" body="Communities are being set up. Start one below — the team reviews it before it goes live." />
          )}
        </div>
        <div id="start" className="mt-14 grid gap-8 rounded-[1.4rem] border border-line bg-[color:var(--color-cream)] p-6 md:grid-cols-[1fr_1.3fr] md:p-10">
          <div>
            <SectionTitle kicker="Start one" title="Start a community" />
            <p className="text-ink-soft">Tell us what your community is about. Once approved it gets its own page, members, announcements and activities.</p>
          </div>
          <CommunityApplyForm categories={categories} countries={countries ?? []} />
        </div>
      </section>
    </PublicShell>
  );
}
