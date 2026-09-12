import type { Metadata } from 'next';
import Link from 'next/link';
import type { Paginated, TripSummary } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { TripCard } from '@/components/trips/TripCard';
import { TripFilters } from '@/components/trips/TripFilters';
import { SearchBar } from '@/components/trips/SearchBar';
import { Alert, ButtonLink, EmptyState, Icon, cx } from '@/components/ui';
import { apiGet, query } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Explore trips',
  description:
    'Browse group departures, private journeys, safaris, island trips and adventures from verified operators.',
};

export const revalidate = 60;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Number(first(params.page) ?? 1) || 1;

  const results = await apiGet<Paginated<TripSummary>>(
    `/trips${query({
      q: first(params.q),
      type: first(params.type),
      style: first(params.style),
      country: first(params.country),
      destination: first(params.destination),
      minPrice: first(params.minPrice),
      maxPrice: first(params.maxPrice),
      minDuration: first(params.minDuration),
      maxDuration: first(params.maxDuration),
      minGroup: first(params.minGroup),
      maxGroup: first(params.maxGroup),
      from: first(params.from),
      to: first(params.to),
      availableOnly: first(params.availableOnly),
      sort: first(params.sort) ?? 'recommended',
      page,
      pageSize: 12,
    })}`,
  );

  const trips = results?.items ?? [];
  const total = results?.total ?? 0;
  const totalPages = results?.totalPages ?? 1;
  const searchTerm = first(params.q);

  return (
    <PublicShell>
      <div className="border-b border-line bg-sand/50">
        <div className="shell py-10 md:py-14">
          <h1 className="text-h1 text-balance">Explore trips</h1>
          <p className="mt-3 max-w-xl text-[1rem] leading-relaxed text-ink-muted">
            Group departures you can join, private journeys built around you, and everything in between —
            all from operators reviewed by the Enhakkore team.
          </p>
          <div className="mt-8">
            <SearchBar variant="inline" />
          </div>
        </div>
      </div>

      <div className="shell py-8 md:py-10">
        <div className="grid gap-10 lg:grid-cols-[17rem_1fr] lg:gap-14">
          <TripFilters total={total} />

          <div>
            <div className="mb-7 flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <p className="text-[0.9375rem] font-semibold text-ink">
                  {total === 0 ? 'No trips found' : `${total} ${total === 1 ? 'trip' : 'trips'}`}
                </p>
                {searchTerm && (
                  <p className="mt-1 text-[0.875rem] text-ink-muted">
                    matching “{searchTerm}”
                  </p>
                )}
              </div>
            </div>

            {results === null ? (
              <Alert tone="danger" title="We could not load trips">
                Something went wrong reaching the Enhakkore service. Refresh the page, or try again in a
                moment.
              </Alert>
            ) : trips.length === 0 ? (
              <EmptyState
                icon={<Icon.search size={34} />}
                title="No trips match your search"
                description="Try changing your destination, date or budget — or clear the filters to see everything on the platform right now."
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <ButtonLink href="/trips">Clear all filters</ButtonLink>
                    <ButtonLink href="/private-trips" variant="secondary">
                      Request a custom trip
                    </ButtonLink>
                  </div>
                }
              />
            ) : (
              <>
                <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
                  {trips.map((trip, index) => (
                    <TripCard key={trip.id} trip={trip} priority={index < 3} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <Pagination current={page} totalPages={totalPages} params={params} />
                )}
              </>
            )}

            {/* A dead end should still offer a way forward. */}
            {trips.length > 0 && trips.length < 4 && (
              <div className="mt-14 rounded-[--radius-card] border border-line bg-sand/60 p-7 text-center">
                <h2 className="text-h3">Not quite what you had in mind?</h2>
                <p className="mx-auto mt-2 max-w-md text-[0.9375rem] leading-relaxed text-ink-muted">
                  Tell us where you want to go and how you like to travel. We will pass it to operators who
                  run that route.
                </p>
                <ButtonLink href="/private-trips" className="mt-6">
                  Request a custom trip
                  <Icon.arrow />
                </ButtonLink>
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

function Pagination({
  current,
  totalPages,
  params,
}: {
  current: number;
  totalPages: number;
  params: SearchParams;
}) {
  const build = (page: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      const single = Array.isArray(value) ? value[0] : value;
      if (single && key !== 'page') next.set(key, single);
    }
    if (page > 1) next.set('page', String(page));
    const qs = next.toString();
    return `/trips${qs ? `?${qs}` : ''}`;
  };

  // Window of pages around the current one, so 40 pages never renders 40 links.
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === totalPages || Math.abs(page - current) <= 1,
  );

  return (
    <nav className="mt-14 flex items-center justify-center gap-1.5" aria-label="Pagination">
      {current > 1 && (
        <Link
          href={build(current - 1)}
          className="inline-flex h-11 items-center rounded-[--radius-field] border border-line-strong px-4 text-[0.875rem] font-semibold text-ink transition-colors hover:border-ink"
        >
          Previous
        </Link>
      )}

      {pages.map((page, index) => (
        <span key={page} className="flex items-center gap-1.5">
          {index > 0 && page - pages[index - 1] > 1 && (
            <span className="px-1 text-ink-faint" aria-hidden="true">
              …
            </span>
          )}
          <Link
            href={build(page)}
            aria-current={page === current ? 'page' : undefined}
            className={cx(
              'inline-flex h-11 w-11 items-center justify-center rounded-[--radius-field] text-[0.875rem] font-semibold transition-colors',
              page === current
                ? 'bg-ink text-white'
                : 'border border-line-strong text-ink hover:border-ink',
            )}
          >
            {page}
          </Link>
        </span>
      ))}

      {current < totalPages && (
        <Link
          href={build(current + 1)}
          className="inline-flex h-11 items-center rounded-[--radius-field] border border-line-strong px-4 text-[0.875rem] font-semibold text-ink transition-colors hover:border-ink"
        >
          Next
        </Link>
      )}
    </nav>
  );
}
