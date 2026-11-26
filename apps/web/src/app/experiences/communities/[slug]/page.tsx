import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CommunityCard } from '@/components/home/types';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Prose, SectionTitle } from '@/components/public/Cards';
import { CommunityMembership } from '@/components/public/CommunityActions';
import { ActivityCard } from '@/components/public/listings';
import { SmartImage } from '@/components/public/SmartImage';
import { ShareButton, TrackView } from '@/components/public/Track';
import { apiGet } from '@/lib/api';
import type { Listing } from '@/lib/public';

export const revalidate = 30;

interface Data {
  community: CommunityCard & { description: string | null; rules: string | null };
  announcements: { id: string; title: string; body: string; createdAt: string }[];
  activities: Listing[];
}

const load = (slug: string) => apiGet<Data>(`/public/communities/${slug}`, 30);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await load((await params).slug);
  return { title: data?.community.name ?? 'Community', description: data?.community.summary ?? undefined };
}

export default async function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const c = data.community;
  return (
    <PublicShell>
      <section className="relative bg-acacia-700 text-white">
        {c.coverImage && <SmartImage src={c.coverImage} alt="" fill sizes="100vw" className="object-cover opacity-35" />}
        <div className="shell relative py-12 md:py-16">
          <Link href="/experiences/communities" className="kicker !text-clay-400">← Communities</Link>
          <h1 className="display-lg mt-3">{c.name}</h1>
          {c.summary && <p className="mt-3 max-w-2xl text-white/80">{c.summary}</p>}
          <p className="mt-3 text-sm text-white/70">{[c.category?.name, [c.city?.name, c.country?.name].filter(Boolean).join(', '), `${c.memberCount} members`].filter(Boolean).join(' · ')}</p>
        </div>
      </section>
      <section className="shell grid gap-10 py-10 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-10">
          <div className="flex gap-2">
            <ShareButton subjectType="COMMUNITY" subjectId={c.id} title={c.name} />
            <TrackView subjectType="COMMUNITY" subjectId={c.id} />
          </div>
          <Prose text={c.description} />
          <div>
            <SectionTitle kicker="Announcements" title="Latest from the community" />
            {data.announcements.length ? (
              <ul className="space-y-3">
                {data.announcements.map((item) => (
                  <li key={item.id} className="rounded-xl border border-line bg-white p-4">
                    <p className="font-bold text-acacia-700">{item.title}</p>
                    <Prose text={item.body} className="mt-1 text-sm" />
                    <p className="mt-2 text-xs text-ink-muted">{new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">No announcements yet.</p>
            )}
          </div>
          <div>
            <SectionTitle kicker="Meetups" title="Upcoming activities" />
            {data.activities.length ? <CardGrid>{data.activities.map((item) => <ActivityCard key={item.id} item={item} />)}</CardGrid> : <p className="text-sm text-ink-muted">No upcoming meetups yet.</p>}
          </div>
          {c.rules && (
            <div>
              <p className="font-display text-xl text-acacia-700">Community rules</p>
              <Prose text={c.rules} className="mt-2" />
            </div>
          )}
        </div>
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <CommunityMembership slug={c.slug} memberCount={c.memberCount} />
        </aside>
      </section>
    </PublicShell>
  );
}
