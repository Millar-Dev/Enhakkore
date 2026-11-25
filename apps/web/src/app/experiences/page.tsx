import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Empty, PageHero } from '@/components/public/Cards';
import { CategoryChips, Filters, Pager } from '@/components/public/Filters';
import { ExperienceCard } from '@/components/public/listings';
import { getCatalogue, getList, pick } from '@/lib/public';
import { getSite, waHref } from '@/lib/site';

export const metadata: Metadata = { title: 'Experiences', description: 'Cooking classes, boat trips, guided tours, workshops and more.' };
export const revalidate = 60;

export default async function ExperiencesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pick(await searchParams, ['country', 'city', 'category', 'q', 'page']);
  const [{ settings }, catalogue, list] = await Promise.all([getSite(), getCatalogue(), getList('/public/experiences', params)]);
  return (
    <PublicShell>
      <PageHero kicker="Enhakkore Experiences" title="Experiences worth trying" intro="Cook, sail, snorkel, hike, learn a craft — run by Enhakkore or by local providers we list. Ask us and we will confirm dates and prices with you." />
      <section className="shell py-8 md:py-12">
        <div className="mb-5"><CategoryChips base="/experiences" catalogue={{ ...catalogue, categories: catalogue.categories.map((item) => (item.kind === 'EXPERIENCE' ? { ...item, featured: true } : item)) }} kind="EXPERIENCE" active={params.category} params={params} /></div>
        <Filters action="/experiences" catalogue={catalogue} kind="EXPERIENCE" values={params} />
        <div className="mt-8">
          {list.items.length ? (
            <CardGrid>{list.items.map((item) => <ExperienceCard key={item.id} item={item} />)}</CardGrid>
          ) : (
            <Empty title="No experiences listed here yet" body="New experiences are added as we confirm them with providers. Tell us what you would like to do and we will see what we can arrange." action={<a href={waHref(settings, 'experience', 'an experience')} target="_blank" rel="noreferrer noopener" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Ask us on WhatsApp</a>} />
          )}
        </div>
        <Pager base="/experiences" page={list.page} totalPages={list.totalPages} params={params} />
      </section>
    </PublicShell>
  );
}
