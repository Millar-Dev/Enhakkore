import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/layout/PublicShell';
import { Empty, PageHero, Prose } from '@/components/public/Cards';
import { apiGet } from '@/lib/api';
import { placeLabel, type Listing } from '@/lib/public';
import { getSite, waHref } from '@/lib/site';

export const metadata: Metadata = { title: 'Local deals', description: 'Offers confirmed with the businesses that make them.' };
export const revalidate = 60;

export default async function DealsPage() {
  const [{ settings }, deals] = await Promise.all([getSite(), apiGet<(Listing & { place: { slug: string; name: string } | null })[]>('/public/deals', 60)]);
  return (
    <PublicShell>
      <PageHero kicker="Local deals" title="Offers worth knowing" intro="Every deal here has been confirmed with the business. Terms are the business’s own — check them before you go." />
      <section className="shell py-12">
        {deals?.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {deals.map((deal) => (
              <div key={deal.id} id={deal.slug} className="rounded-[1.1rem] border border-clay-100 bg-white p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-clay-600">{String(deal.businessName)} · {placeLabel(deal)}</p>
                <p className="mt-2 font-display text-2xl text-acacia-700">{String(deal.title)}</p>
                <Prose text={deal.description} className="mt-2 text-[0.9375rem]" />
                {deal.terms ? <p className="mt-3 text-xs text-ink-muted">Terms: {String(deal.terms)}</p> : null}
                {deal.validUntil ? <p className="mt-1 text-xs text-ink-muted">Valid until {new Date(String(deal.validUntil)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</p> : null}
                {deal.place && <Link href={`/explore/${deal.place.slug}`} className="mt-3 inline-block text-sm font-semibold text-acacia-600 underline">About {deal.place.name}</Link>}
              </div>
            ))}
          </div>
        ) : (
          <Empty title="No deals right now" body="Businesses: want to offer something to the Enhakkore community? Talk to us." action={<a href={waHref(settings, 'listing')} target="_blank" rel="noreferrer noopener" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Talk to us</a>} />
        )}
      </section>
    </PublicShell>
  );
}
