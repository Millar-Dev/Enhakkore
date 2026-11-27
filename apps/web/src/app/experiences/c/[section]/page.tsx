import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EXPERIENCE_SECTIONS, EXPERIENCE_SECTION_NAMES } from '@enhakkore/shared';
import type { CommunityCard, UpcomingCard } from '@/components/home/types';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Empty, PageHero, SectionTitle } from '@/components/public/Cards';
import { CommunityTile } from '@/components/public/experience';
import { UpcomingGrid } from '@/components/public/UpcomingGrid';
import { cx } from '@/components/ui';
import { apiGet, query } from '@/lib/api';
import { getCatalogue, pick } from '@/lib/public';

export const revalidate = 60;

interface SectionData {
  section: { key: string; label: string; icon: string; blurb: string };
  categories: { name: string; slug: string; icon: string | null }[];
  upcoming: UpcomingCard[];
  communities: CommunityCard[];
}

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section: key } = await params;
  const section = EXPERIENCE_SECTIONS.find((item) => item.key === key.toUpperCase());
  return { title: section?.label ?? 'Experiences', description: section?.blurb };
}

export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const key = (await params).section.toUpperCase();
  if (!EXPERIENCE_SECTIONS.some((item) => item.key === key)) notFound();
  const filters = pick(await searchParams, ['q', 'country', 'city', 'category']);
  const [data, catalogue] = await Promise.all([apiGet<SectionData>(`/public/experiences-section/${key}${query(filters)}`, 60), getCatalogue()]);
  if (!data) notFound();
  const base = `/experiences/c/${key.toLowerCase()}`;
  const href = (category?: string) => `${base}${query({ ...filters, category })}`;
  const country = catalogue.countries.find((item) => item.code.toLowerCase() === filters.country?.toLowerCase());

  return (
    <PublicShell>
      <PageHero kicker="Experiences" title={`${data.section.icon} ${EXPERIENCE_SECTION_NAMES[key as keyof typeof EXPERIENCE_SECTION_NAMES] ?? data.section.label}`} intro={data.section.blurb} />
      <section className="shell py-8 md:py-12">
        <div className="mb-5 flex flex-wrap gap-2">
          <Link href={`/experiences/discover?section=${key}`} className="inline-flex h-11 items-center rounded-full bg-acacia-700 px-5 text-sm font-bold text-white">Discover all</Link>
          <Link href={`/experiences/host?section=${key}`} className="inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-semibold text-acacia-700">Host one</Link>
          <Link href="/experiences/plan" className="inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-semibold text-acacia-700">Plan an event with us</Link>
        </div>
        <form action={base} className="grid gap-2 rounded-[1.1rem] border border-line bg-white p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          {filters.category && <input type="hidden" name="category" value={filters.category} />}
          <input name="q" defaultValue={filters.q} placeholder={`Search ${data.section.label.toLowerCase()}`} className="field h-12" aria-label="Search" />
          <select name="country" defaultValue={country?.code ?? ''} className="field h-12" aria-label="Country">
            <option value="">Everywhere</option>
            {catalogue.countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
          </select>
          <select name="city" defaultValue={filters.city ?? ''} className="field h-12" aria-label="City">
            <option value="">Any city</option>
            {(country?.cities ?? catalogue.countries.flatMap((item) => item.cities)).map((city) => <option key={city.slug} value={city.slug}>{city.name}</option>)}
          </select>
          <button className="h-12 rounded-[var(--radius-field)] bg-acacia-600 px-6 font-bold text-white">Search</button>
        </form>

        {data.categories.length > 0 && (
          <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
            <Link href={href()} className={cx('chip', !filters.category && 'chip-active')}>All</Link>
            {data.categories.map((category) => (
              <Link key={category.slug} href={href(category.slug)} className={cx('chip', filters.category === category.slug && 'chip-active')}>
                {category.icon && <span aria-hidden>{category.icon}</span>} {category.name}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-10">
          <SectionTitle kicker="Upcoming" title="What’s on" />
          {data.upcoming.length ? (
            <UpcomingGrid items={data.upcoming} />
          ) : (
            <Empty
              title="Nothing scheduled here yet"
              body="Be the first: host one. Every submission is reviewed by the team before it is published."
              action={<Link href={`/experiences/host?section=${key}`} className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Host an experience</Link>}
            />
          )}
        </div>

        {data.communities.length > 0 && (
          <div className="mt-14">
            <SectionTitle kicker="Communities" title="Communities" />
            <CardGrid>{data.communities.map((community) => <CommunityTile key={community.id} community={community} />)}</CardGrid>
          </div>
        )}
      </section>
    </PublicShell>
  );
}
