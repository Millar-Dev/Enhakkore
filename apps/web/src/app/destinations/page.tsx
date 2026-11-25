import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/layout/PublicShell';
import { Empty, PageHero } from '@/components/public/Cards';
import { Globe } from '@/components/home/Globe';
import { getCatalogue } from '@/lib/public';

export const metadata: Metadata = { title: 'Destinations', description: 'Countries and cities with trips, places, experiences, events and activities on Enhakkore.' };
export const revalidate = 120;

export default async function DestinationsPage() {
  const catalogue = await getCatalogue();
  const countries = catalogue.countries.filter((country) => country.total > 0 || country.featured);
  return (
    <PublicShell>
      <PageHero kicker="Destinations" title="Explore by place" intro="Every country and city here has something genuine to show. New places are added as listings are confirmed — Enhakkore starts in Dar es Salaam and grows from there." />
      <section className="shell grid gap-10 py-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="mx-auto w-full max-w-md">
          <Globe markers={countries.filter((c) => c.latitude !== null && c.longitude !== null).map((c) => ({ lat: c.latitude!, lng: c.longitude!, label: c.name, href: `/destinations/${c.slug}` }))} />
        </div>
        <div>
          {countries.length === 0 ? (
            <Empty title="Destinations are on their way" body="Listings are being added." />
          ) : (
            <ul className="grid gap-3">
              {countries.map((country) => (
                <li key={country.code}>
                  <Link href={`/destinations/${country.slug}`} className="card-lift flex items-center justify-between rounded-[1.1rem] border border-line bg-white p-5">
                    <div>
                      <p className="font-display text-2xl text-acacia-700">{country.name}</p>
                      <p className="mt-1 text-sm text-ink-muted">{country.cities.map((city) => city.name).join(' · ') || country.region}</p>
                    </div>
                    <span className="text-sm font-semibold text-clay-600">{country.total} listing{country.total === 1 ? '' : 's'} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
