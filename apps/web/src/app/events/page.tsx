import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Empty, PageHero } from '@/components/public/Cards';
import { CategoryChips, Filters, Pager } from '@/components/public/Filters';
import { EventCard } from '@/components/public/listings';
import { getCatalogue, getList, pick } from '@/lib/public';
import { getSite, waHref } from '@/lib/site';

export const metadata: Metadata = { title: 'Events', description: 'Parties, silent discos, festivals, music and games — hosted by Enhakkore and by others.' };
export const revalidate = 60;

export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pick(await searchParams, ['country', 'city', 'category', 'host', 'when', 'q', 'page', 'from', 'to']);
  const [{ settings }, catalogue, list] = await Promise.all([getSite(), getCatalogue(), getList('/public/events', params)]);
  return (
    <PublicShell>
      <PageHero kicker="Enhakkore Events" title="What’s on" intro="Silent parties, costume nights, music, festivals and games. Events hosted by Enhakkore are marked — others are listed for you to discover, and their organisers handle tickets." />
      <section className="shell py-8 md:py-12">
        <div className="mb-5"><CategoryChips base="/events" catalogue={{ ...catalogue, categories: catalogue.categories.map((item) => (item.kind === 'EVENT' ? { ...item, featured: true } : item)) }} kind="EVENT" active={params.category} params={params} /></div>
        <Filters action="/events" catalogue={catalogue} kind="EVENT" values={params} extra={[
          { name: 'host', label: 'Host', options: [{ value: '', label: 'All events' }, { value: 'ENHAKKORE', label: 'Hosted by Enhakkore' }, { value: 'THIRD_PARTY', label: 'Listed events' }] },
          { name: 'when', label: 'When', options: [{ value: '', label: 'Upcoming' }, { value: 'past', label: 'Past' }] },
        ]} />
        <div className="mt-8">
          {list.items.length ? (
            <CardGrid>{list.items.map((item) => <EventCard key={item.id} item={item} />)}</CardGrid>
          ) : (
            <Empty title="No events listed here yet" body="Follow us on Instagram and TikTok to hear about the next one first." action={<a href={waHref(settings, 'general')} target="_blank" rel="noreferrer noopener" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Message us</a>} />
          )}
        </div>
        <Pager base="/events" page={list.page} totalPages={list.totalPages} params={params} />
      </section>
    </PublicShell>
  );
}
