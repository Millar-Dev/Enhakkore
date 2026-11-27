import type { Metadata } from 'next';
import Link from 'next/link';
import { DemoNotice } from '@/components/public/DemoNotice';
import { notFound } from 'next/navigation';
import { ACTIVITY_MODE_LABELS, EXPERIENCE_LEVEL_LABELS, zoneLabel } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { ReportButton, SaveButton } from '@/components/public/Actions';
import { Facts, Gallery, Prose, VideoBlock } from '@/components/public/Cards';
import { JoinPanel } from '@/components/public/JoinPanel';
import { Sessions } from '@/components/public/Sessions';
import { ShareButton, TrackView } from '@/components/public/Track';
import { SmartImage } from '@/components/public/SmartImage';
import { apiGet } from '@/lib/api';
import { placeLabel, priceLabel, whenLabel, type Listing } from '@/lib/public';
import { getSite, waHref } from '@/lib/site';

export const revalidate = 60;

interface ActivityResponse {
  activity: Listing;
  approvedCount: number;
}

async function load(slug: string) {
  return apiGet<ActivityResponse>(`/public/activities/${slug}`, 60);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await load((await params).slug);
  return data ? { title: String(data.activity.title), description: data.activity.summary ?? undefined } : { title: 'Activity' };
}

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [data, { settings }] = await Promise.all([load(slug), getSite()]);
  if (!data) notFound();
  const item = data.activity;
  const ended = item.status === 'COMPLETED' || (!!item.startsAt && !item.recurrence && new Date(String(item.endsAt ?? item.startsAt)).getTime() < Date.now());
  const open = !ended && ['PUBLISHED', 'FULL'].includes(String(item.status));
  const zone = String(item.timezone ?? 'Africa/Dar_es_Salaam');

  return (
    <PublicShell>
      <section className="bg-[color:var(--color-cream)]">
        <div className="shell grid gap-6 pb-8 md:gap-8 md:py-14 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div className="order-2 lg:order-1">
            <Link href={`/activities${item.category ? `?category=${item.category.slug}` : ''}`} className="kicker">
              {item.category?.icon} {item.category?.name ?? 'Activity'}
            </Link>
            <h1 className="display-lg mt-4 text-acacia-700">{String(item.title)}</h1>
            {item.isDemo ? <DemoNotice what="activity" /> : null}
          {item.summary && <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-ink-soft">{item.summary}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-acacia-700 ring-1 ring-line">
                {item.source === 'COMMUNITY' ? `Organised by ${item.organiserName}` : 'Organised by Enhakkore'}
              </span>
              {item.status === 'FULL' && <span className="rounded-full bg-ink px-3 py-1.5 font-semibold text-white">Full — waitlist open</span>}
              {item.status === 'CANCELLED' && <span className="rounded-full bg-danger px-3 py-1.5 font-semibold text-white">Cancelled</span>}
              {ended && item.status !== 'CANCELLED' && <span className="rounded-full bg-ink-muted px-3 py-1.5 font-semibold text-white">This activity has taken place</span>}
              <SaveButton itemType="ACTIVITY" itemId={item.id} />
              <ShareButton subjectType="ACTIVITY" subjectId={item.id} title={String(item.title)} />
              <TrackView subjectType="ACTIVITY" subjectId={item.id} />
            </div>
          </div>
          <div className="relative order-1 -mx-5 aspect-[16/11] overflow-hidden bg-acacia-700 md:mx-0 md:mt-0 md:rounded-[1.4rem] lg:order-2 lg:aspect-[4/3]">
            {item.coverImage && <SmartImage src={item.coverImage} alt="" fill priority sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover" />}
            <Link href="/experiences" aria-label="Back to Experiences" className="absolute left-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur md:hidden">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
            </Link>
          </div>
        </div>
      </section>

      <section className="shell grid gap-10 py-10 md:py-14 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          <Facts
            items={[
              { label: 'When', value: whenLabel(item.startsAt, zone, 'full') ? `${whenLabel(item.startsAt, zone, 'full')} (${zoneLabel(new Date(String(item.startsAt)), zone)})` : null },
              { label: 'Repeats', value: item.recurrence as string },
              { label: 'Where', value: item.mode === 'ONLINE' ? (item.platformName as string) || ACTIVITY_MODE_LABELS.ONLINE : [item.meetingPoint as string, placeLabel(item)].filter(Boolean).join(', ') },
              { label: 'Level', value: EXPERIENCE_LEVEL_LABELS[String(item.level)] },
              { label: 'Spaces', value: typeof item.capacity === 'number' ? `${item.spacesLeft} of ${item.capacity} left` : 'Open' },
              { label: 'Going', value: data.approvedCount > 0 ? `${data.approvedCount} approved` : null },
              { label: 'Price', value: priceLabel(item.price, item.currency) ?? 'Free' },
            ]}
          />
          <Prose text={item.description} />
          {item.equipment ? (
            <div>
              <p className="font-display text-xl text-acacia-700">Bring</p>
              <Prose text={String(item.equipment)} className="mt-2" />
            </div>
          ) : null}
          {item.requirements ? (
            <div>
              <p className="font-display text-xl text-acacia-700">To take part</p>
              <Prose text={String(item.requirements)} className="mt-2" />
            </div>
          ) : null}
          {item.eligibility ? (
            <div>
              <p className="font-display text-xl text-acacia-700">Who can take part</p>
              <Prose text={String(item.eligibility)} className="mt-2" />
            </div>
          ) : null}
          {item.rules ? (
            <div>
              <p className="font-display text-xl text-acacia-700">Rules</p>
              <Prose text={String(item.rules)} className="mt-2" />
            </div>
          ) : null}
          {item.cancellationTerms ? (
            <div>
              <p className="font-display text-xl text-acacia-700">Cancellation</p>
              <Prose text={String(item.cancellationTerms)} className="mt-2" />
            </div>
          ) : null}
          <Sessions slug={slug} />
          <VideoBlock url={item.videoUrl} />
          <Gallery images={(item.gallery ?? []).map((src) => ({ src }))} />
        </div>

        <aside id="register" className="scroll-mt-20 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[1.2rem] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
            <p className="font-display text-2xl text-acacia-700">{open ? 'Join this activity' : 'Activity'}</p>
            {item.contactMethod ? <p className="mt-1 text-sm text-ink-muted">{String(item.contactMethod)}</p> : null}
            <div className="mt-4">
              <JoinPanel slug={slug} open={open} whatsappHref={waHref(settings, 'activityJoin', String(item.title))} />
            </div>
            <div className="mt-5 rounded-xl bg-[color:var(--color-cream)] p-4 text-[0.8125rem] leading-relaxed text-ink-soft">
              <p className="font-bold text-acacia-700">Stay safe</p>
              <p className="mt-1">{settings.legal.safety}</p>
            </div>
            <div className="mt-4">
              <ReportButton targetType="ACTIVITY" targetId={item.id} />
            </div>
          </div>
        </aside>
      </section>

      {/* Phones: the main action always within reach. */}
      {open && !ended && (
        <>
          <div className="h-24 md:hidden" aria-hidden />
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
            <a href="#register" className="flex h-12 items-center justify-center rounded-full bg-clay-400 text-sm font-bold text-acacia-700">
              {item.isDemo ? 'Example activity — see details' : `Register now${priceLabel(item.price, item.currency) ? '' : ' (free)'}`}
            </a>
          </div>
        </>
      )}
    </PublicShell>
  );
}
