import type { Metadata } from 'next';
import Link from 'next/link';
import { DemoNotice } from '@/components/public/DemoNotice';
import { notFound } from 'next/navigation';
import type { CommunityCard } from '@/components/home/types';
import { PublicShell } from '@/components/layout/PublicShell';
import { CardGrid, Prose, SectionTitle } from '@/components/public/Cards';
import { CommunityMembership } from '@/components/public/CommunityActions';
import { ActivityCard } from '@/components/public/listings';
import { ReportButton } from '@/components/public/Actions';
import { StudyGroupManage } from '@/components/public/StudyGroupManage';
import { SmartImage } from '@/components/public/SmartImage';
import { GroupChatLink, ShareButton, TrackView } from '@/components/public/Track';
import { apiGet } from '@/lib/api';
import type { Listing } from '@/lib/public';

export const revalidate = 30;

interface Data {
  community: CommunityCard & { description: string | null; rules: string | null; official?: boolean; kind?: string; schedule?: string | null; meetingPoint?: string | null; meetingVerified?: boolean; mode?: string; subject?: string | null; topic?: string | null; institution?: string | null };
  announcements: { id: string; title: string; body: string; createdAt: string }[];
  activities: Listing[];
  sessions: { id: string; startsAt: string; endsAt: string | null; meetingPoint: string | null; route: string | null; status: string; notice: string | null; capacity: number | null; activity: { title: string; slug: string } }[];
  organisers: { name: string; role: string }[];
}

const when = (value: string) => new Date(value).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dar_es_Salaam' });

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
          <Link href={c.kind === 'STUDY_GROUP' ? '/experiences/study-groups' : '/experiences/communities'} className="kicker !text-clay-400 inline-flex min-h-10 items-center">← {c.kind === 'STUDY_GROUP' ? 'Study groups' : 'Communities'}</Link>
          <div className="mt-3 flex flex-wrap gap-2">
            {c.official && <span className="rounded-full bg-clay-400 px-2.5 py-0.5 text-xs font-bold text-acacia-700">Official Enhakkore community</span>}
            {c.kind === 'STUDY_GROUP' && <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">Study group</span>}
            {c.accessType === 'PRIVATE' && <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">Private</span>}
          </div>
          <h1 className="display-lg mt-2">{c.name}</h1>
          {c.summary && <p className="mt-3 max-w-2xl text-white/80">{c.summary}</p>}
          <p className="mt-3 text-sm text-white/70">{[c.category?.name, [c.city?.name, c.country?.name].filter(Boolean).join(', '), `${c.memberCount} members`].filter(Boolean).join(' · ')}</p>
        </div>
      </section>
      <section className="shell grid gap-10 py-10 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-10">
          <div className="flex gap-2">
            <ShareButton subjectType="COMMUNITY" subjectId={c.id} title={c.name} />
            <GroupChatLink subjectType="COMMUNITY" subjectId={c.id} enabled={Boolean(c.chatEnabled)} />
            <TrackView subjectType="COMMUNITY" subjectId={c.id} />
            <ReportButton targetType="COMMUNITY" targetId={c.id} />
          </div>
          {(c.schedule || c.meetingPoint || c.subject) && (
            <div className="grid gap-2 rounded-2xl border border-line bg-white p-5 text-sm">
              {c.subject && <p><span className="text-ink-muted">Subject</span> · <strong>{c.subject}</strong>{c.topic ? ` — ${c.topic}` : ''}{c.institution ? ` · ${c.institution}` : ''}</p>}
              {c.schedule && <p><span aria-hidden>🗓️</span> <strong>{c.schedule}</strong></p>}
              {c.meetingPoint && (
                <p><span aria-hidden>📍</span> {c.meetingPoint}{c.meetingVerified === false && <span className="ml-2 rounded-full bg-[#fff1c9] px-2 py-0.5 text-[0.6875rem] font-bold text-[#7a5a14]">To be confirmed by the team</span>}</p>
              )}
              {c.mode && c.mode !== 'IN_PERSON' && <p><span aria-hidden>💻</span> {c.mode === 'ONLINE' ? 'Online' : 'In person and online'}</p>}
              <p className="text-xs text-ink-muted">Join once — you then see every session, announcement and the group chat. Free casual sessions need no separate registration unless a session says it has limited places.</p>
            </div>
          )}
          {c.isDemo && <DemoNotice what="community" />}
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
            <SectionTitle kicker="Timetable" title="Upcoming sessions" />
            {data.sessions?.length ? (
              <ul className="grid gap-2">
                {data.sessions.map((session) => (
                  <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-4 text-sm">
                    <span>
                      <strong className="text-ink">{when(session.startsAt)}</strong>
                      <span className="block text-xs text-ink-muted">{[session.activity.title, session.meetingPoint, session.route].filter(Boolean).join(' · ')}</span>
                      {session.notice && <span className="block text-xs text-warning">{session.notice}</span>}
                    </span>
                    <span className="text-xs font-semibold text-acacia-700">{session.status === 'CANCELLED' ? 'Cancelled' : session.capacity ? <Link href={`/activities/${session.activity.slug}`} className="underline">Limited places — register</Link> : 'Members just come'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">{c.schedule ? `Regular timetable: ${c.schedule}. Dated sessions appear here once the team publishes them.` : 'No sessions scheduled yet.'}</p>
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
        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <CommunityMembership slug={c.slug} memberCount={c.memberCount} />
          {c.kind === 'STUDY_GROUP' && <StudyGroupManage slug={c.slug} />}
          {data.organisers?.length ? (
            <div className="rounded-[1.1rem] border border-line bg-white p-5 text-sm">
              <p className="font-bold text-acacia-700">Organisers & moderators</p>
              <ul className="mt-2 grid gap-1">{data.organisers.map((person) => <li key={person.name}>{person.name} <span className="text-xs text-ink-muted">· {person.role === 'ADMIN' ? 'group admin' : 'moderator'}</span></li>)}</ul>
            </div>
          ) : c.official ? <p className="rounded-[1.1rem] border border-line bg-white p-5 text-sm text-ink-soft">Organised by the Enhakkore team.</p> : null}
        </aside>
      </section>
    </PublicShell>
  );
}
