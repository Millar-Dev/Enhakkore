import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Empty, PageHero } from '@/components/public/Cards';
import { CategoryChips, Filters, Pager } from '@/components/public/Filters';
import { PlaceCard } from '@/components/public/listings';
import { getCatalogue, getList, pick } from '@/lib/public';
import { getSite, waHref } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Discover',
  description: 'Hotels, restaurants, beaches, nightlife, cultural sites and hidden gems — with clear labels for what has been verified.',
};
export const revalidate = 60;

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = pick(await searchParams, ['country', 'city', 'category', 'q', 'page', 'hiddenGem', 'verified']);
  const [{ settings }, catalogue, list] = await Promise.all([getSite(), getCatalogue(), getList('/public/places', params)]);
  return (
    <PublicShell>
      <PageHero
        kicker="Enhakkore Discover"
        title="Places worth knowing"
        intro="Where to stay, eat, swim and go out — and the hidden gems in between. Every listing says who provided its details: verified by us, submitted by the business, or not yet verified."
      />
      <section className="shell py-8 md:py-12">
        <CategoryChips base="/discover" catalogue={catalogue} kind="PLACE" active={params.category} params={params} />
        <div className="mt-5">
          <Filters
            action="/discover"
            catalogue={catalogue}
            kind="PLACE"
            values={params}
            extra={[
              { name: 'verified', label: 'Details', options: [{ value: '', label: 'All listings' }, { value: 'true', label: 'Verified only' }] },
              { name: 'hiddenGem', label: 'Type', options: [{ value: '', label: 'Everything' }, { value: 'true', label: 'Hidden gems' }] },
            ]}
          />
        </div>
        <p className="mt-8 text-sm text-ink-muted">{list.total} place{list.total === 1 ? '' : 's'}</p>
        <div className="mt-4">
          {list.items.length ? (
            <CardGrid>
              {list.items.map((item) => (
                <PlaceCard key={item.id} item={item} />
              ))}
            </CardGrid>
          ) : (
            <Empty
              title="No places listed here yet"
              body="We only list places we can describe honestly, so this grows over time. Own a business here? We would like to hear from you."
              action={
                <a href={waHref(settings, 'listing')} target="_blank" rel="noreferrer noopener" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">
                  List your business
                </a>
              }
            />
          )}
        </div>
        <Pager base="/discover" page={list.page} totalPages={list.totalPages} params={params} />
        <p className="mt-12 text-center text-sm text-ink-muted">
          Know a place that belongs here? <Link className="font-semibold text-acacia-600 underline" href="/contact">Tell us about it</Link>.
        </p>
      </section>
    </PublicShell>
  );
}
