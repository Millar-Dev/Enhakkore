'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

export interface Member {
  id: string;
  name: string;
  avatarUrl: string | null;
  country: string | null;
  city: string | null;
  headline: string | null;
  bio: string | null;
  interests: string[];
  activityPrefs: string[];
  memberSince: string;
  activities?: { title: string; slug: string }[];
  communities?: { name: string; slug: string }[];
  published?: { title: string; slug: string }[];
  approvedOrganiser?: boolean;
}

export function SignInPrompt({ next }: { next: string }) {
  return (
    <div className="rounded-[1.2rem] border border-line bg-[color:var(--color-cream)] p-8 text-center">
      <p className="font-display text-2xl text-acacia-700">Members only</p>
      <p className="mx-auto mt-2 max-w-md text-ink-soft">To protect everyone’s privacy, member profiles are visible only to signed-in members. Joining is free.</p>
      <div className="mt-5 flex justify-center gap-3">
        <Link href={`/join?next=${next}`} className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Join free</Link>
        <Link href={`/signin?next=${next}`} className="inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-semibold">Sign in</Link>
      </div>
    </div>
  );
}

/** Member discovery, filtered by country, city and interest. */
export function MemberProfile({ id }: { id: string }) {
  const { status, user } = useSession();
  const [member, setMember] = useState<Member | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(() => api.get<Member>(`/community/members/${id}`).then(setMember).catch(() => setMember(null)), [id]);
  useEffect(() => {
    if (status === 'authenticated') void load();
  }, [status, load]);
  if (status !== 'authenticated') return <SignInPrompt next={`/members/${id}`} />;
  if (member === undefined) return <p className="text-ink-muted">Loading…</p>;
  if (member === null) return <p className="text-ink-muted">This member is not available.</p>;
  return (
    <div className="rounded-[1.4rem] border border-line bg-white p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={member.name} src={member.avatarUrl} size="xl" />
        <div>
          <h1 className="font-display text-3xl text-acacia-700">{member.name}</h1>
          <p className="text-ink-muted">{[member.city, member.country].filter(Boolean).join(', ')}</p>
        </div>
        {member.approvedOrganiser && <span className="ml-auto rounded-full bg-safari-50 px-3 py-1.5 text-xs font-bold text-safari-700">Approved organiser</span>}
      </div>
      {member.headline && <p className="mt-5 font-display text-xl text-acacia-700">{member.headline}</p>}
      {member.bio && <p className="mt-2 whitespace-pre-line text-ink-soft">{member.bio}</p>}
      {[...member.interests, ...member.activityPrefs].length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5">{[...member.interests, ...member.activityPrefs].map((tag) => <span key={tag} className="rounded-full bg-[color:var(--color-cream)] px-3 py-1 text-sm text-acacia-700">{tag}</span>)}</div>
      )}
      {member.activities && member.activities.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-bold text-acacia-700">Going to</p>
          <ul className="mt-2 space-y-1">{member.activities.map((activity) => <li key={activity.slug}><Link href={`/activities/${activity.slug}`} className="text-acacia-600 underline-offset-4 hover:underline">{activity.title}</Link></li>)}</ul>
        </div>
      )}
      {member.communities && member.communities.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-bold text-acacia-700">Communities</p>
          <div className="mt-2 flex flex-wrap gap-2">{member.communities.map((community) => <Link key={community.slug} href={`/experiences/communities/${community.slug}`} className="chip">{community.name}</Link>)}</div>
        </div>
      )}
      {member.published && member.published.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-bold text-acacia-700">Activities they organise</p>
          <ul className="mt-2 space-y-1">{member.published.map((activity) => <li key={activity.slug}><Link href={`/activities/${activity.slug}`} className="text-acacia-600 underline-offset-4 hover:underline">{activity.title}</Link></li>)}</ul>
        </div>
      )}
      {user?.id !== member.id && (
        <div className="mt-8 flex flex-wrap gap-3 border-t border-line pt-5 text-sm">
          <button
            onClick={async () => {
              if (!window.confirm(`Block ${member.name}? You will no longer see each other on Enhakkore.`)) return;
              await api.post('/community/blocks', { userId: member.id });
              setNotice('Blocked. You will no longer see each other.');
              setMember(null);
            }}
            className="font-semibold text-danger underline"
          >
            Block
          </button>
          <button
            onClick={async () => {
              const reason = window.prompt('Why are you reporting this member?');
              if (!reason) return;
              try {
                await api.post('/community/reports', { targetType: 'USER', targetId: member.id, reason: reason.slice(0, 120) });
                setNotice('Reported. The community team will look into it.');
              } catch (caught) {
                setNotice(caught instanceof ApiError ? caught.message : 'Could not send the report.');
              }
            }}
            className="font-semibold text-ink-muted underline"
          >
            Report
          </button>
        </div>
      )}
      {notice && <p className="mt-3 text-sm text-safari-700">{notice}</p>}
    </div>
  );
}

