'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { SUGGESTED_INTERESTS } from '@enhakkore/shared';
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
  connection: { id: string; status: string; incoming: boolean } | null;
  activities?: { title: string; slug: string }[];
}

/** The connect / accept / pending button for one member. */
export function ConnectButton({ member, onChange }: { member: Member; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const link = member.connection;
  const act = async (work: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await work();
      onChange();
    } finally {
      setBusy(false);
    }
  };
  if (link?.status === 'ACCEPTED') return <span className="rounded-full bg-safari-50 px-3 py-1.5 text-xs font-bold text-safari-700">Connected</span>;
  if (link?.status === 'PENDING' && link.incoming)
    return (
      <span className="flex gap-2">
        <button disabled={busy} onClick={() => act(() => api.post(`/community/connections/${link.id}/respond`, { accept: true }))} className="h-9 rounded-full bg-acacia-600 px-3 text-xs font-bold text-white">Accept</button>
        <button disabled={busy} onClick={() => act(() => api.post(`/community/connections/${link.id}/respond`, { accept: false }))} className="h-9 rounded-full border border-line-strong px-3 text-xs font-semibold">Decline</button>
      </span>
    );
  if (link?.status === 'PENDING') return <span className="rounded-full bg-sand px-3 py-1.5 text-xs font-bold text-ink-muted">Request sent</span>;
  if (link?.status === 'DECLINED') return null;
  return (
    <button disabled={busy} onClick={() => act(() => api.post('/community/connections', { userId: member.id }))} className="h-9 rounded-full bg-clay-400 px-4 text-xs font-bold text-acacia-700 hover:bg-clay-500 hover:text-white">
      Connect
    </button>
  );
}

export function MemberCard({ member, onChange }: { member: Member; onChange: () => void }) {
  return (
    <div className="flex flex-col rounded-[1.1rem] border border-line bg-white p-5">
      <Link href={`/connect/members/${member.id}`} className="flex items-center gap-3">
        <Avatar name={member.name} src={member.avatarUrl} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-display text-xl text-acacia-700">{member.name}</p>
          <p className="truncate text-sm text-ink-muted">{[member.city, member.country].filter(Boolean).join(', ') || 'Location not shared'}</p>
        </div>
      </Link>
      {member.headline && <p className="mt-3 text-sm text-ink-soft">{member.headline}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[...member.interests, ...member.activityPrefs].slice(0, 6).map((tag) => (
          <span key={tag} className="rounded-full bg-[color:var(--color-cream)] px-2.5 py-1 text-xs font-medium text-acacia-700">{tag}</span>
        ))}
      </div>
      <div className="mt-auto pt-4"><ConnectButton member={member} onChange={onChange} /></div>
    </div>
  );
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
export function ConnectClient() {
  const { status, user } = useSession();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [filters, setFilters] = useState({ country: '', city: '', interest: '', q: '' });
  const [incoming, setIncoming] = useState(0);

  const load = useCallback(() => {
    const search = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    api.get<Member[]>(`/community/members?${search}`).then(setMembers).catch(() => setMembers([]));
    api.get<{ incoming: unknown[] }>('/community/connections').then((result) => setIncoming(result.incoming.length)).catch(() => undefined);
  }, [filters]);

  useEffect(() => {
    if (status === 'authenticated') load();
  }, [status, load]);

  if (status === 'loading') return <p className="text-ink-muted">Loading…</p>;
  if (status !== 'authenticated') return <SignInPrompt next="/connect" />;

  const profileIncomplete = !user?.headline && !(user?.interests ?? []).length;

  return (
    <div className="space-y-6">
      {profileIncomplete && (
        <div className="flex flex-col gap-3 rounded-[1.1rem] border border-clay-100 bg-clay-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-soft"><strong className="text-acacia-700">Complete your profile</strong> — add your city and interests so the right people can find you.</p>
          <Link href="/account/profile" className="inline-flex h-10 items-center rounded-full bg-acacia-600 px-4 text-sm font-bold text-white">Edit profile</Link>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/connect/requests" className="chip">Requests & connections{incoming ? ` · ${incoming} new` : ''}</Link>
        <Link href="/account/profile" className="chip">My profile</Link>
      </div>
      <form
        className="grid gap-3 rounded-[1.1rem] border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setFilters({ country: String(form.get('country') ?? ''), city: String(form.get('city') ?? ''), interest: String(form.get('interest') ?? ''), q: String(form.get('q') ?? '') });
        }}
      >
        <input name="country" placeholder="Country" defaultValue={filters.country} className="field" />
        <input name="city" placeholder="City" defaultValue={filters.city} className="field" />
        <select name="interest" defaultValue={filters.interest} className="field">
          <option value="">Any interest</option>
          {SUGGESTED_INTERESTS.map((interest) => <option key={interest}>{interest}</option>)}
        </select>
        <input name="q" placeholder="Name" defaultValue={filters.q} className="field" />
        <button className="h-11 rounded-[var(--radius-field)] bg-acacia-600 text-sm font-bold text-white">Find people</button>
      </form>
      {members === null ? (
        <p className="text-ink-muted">Loading members…</p>
      ) : members.length === 0 ? (
        <p className="rounded-xl bg-[color:var(--color-cream)] p-6 text-center text-ink-soft">No members match yet. Try a wider search — the community is growing.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{members.map((member) => <MemberCard key={member.id} member={member} onChange={load} />)}</div>
      )}
      <p className="text-xs leading-relaxed text-ink-muted">Profiles never show email addresses, phone numbers, home addresses or locations. Meet in public places, and report anything that feels wrong.</p>
    </div>
  );
}

export function MemberProfile({ id }: { id: string }) {
  const { status, user } = useSession();
  const [member, setMember] = useState<Member | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(() => api.get<Member>(`/community/members/${id}`).then(setMember).catch(() => setMember(null)), [id]);
  useEffect(() => {
    if (status === 'authenticated') void load();
  }, [status, load]);
  if (status !== 'authenticated') return <SignInPrompt next={`/connect/members/${id}`} />;
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
        {user?.id !== member.id && <div className="ml-auto"><ConnectButton member={member} onChange={load} /></div>}
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
      {user?.id !== member.id && (
        <div className="mt-8 flex flex-wrap gap-3 border-t border-line pt-5 text-sm">
          {member.connection?.status === 'ACCEPTED' && (
            <button onClick={async () => { await api.delete(`/community/connections/${member.connection!.id}`); void load(); }} className="font-semibold text-ink-muted underline">Remove connection</button>
          )}
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

export function RequestsClient() {
  const { status } = useSession();
  const [data, setData] = useState<{ incoming: { id: string; member: Member }[]; outgoing: { id: string; member: Member }[]; connected: { id: string; member: Member }[] } | null>(null);
  const load = useCallback(() => api.get<typeof data>('/community/connections').then(setData).catch(() => undefined), []);
  useEffect(() => {
    if (status === 'authenticated') void load();
  }, [status, load]);
  if (status !== 'authenticated') return <SignInPrompt next="/connect/requests" />;
  if (!data) return <p className="text-ink-muted">Loading…</p>;
  const section = (title: string, rows: { id: string; member: Member }[], kind: 'incoming' | 'outgoing' | 'connected') => (
    <div>
      <p className="font-display text-2xl text-acacia-700">{title}</p>
      {rows.length === 0 ? <p className="mt-2 text-sm text-ink-muted">None.</p> : (
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-white">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 p-3">
              <Avatar name={row.member.name} src={row.member.avatarUrl} size="sm" />
              <Link href={`/connect/members/${row.member.id}`} className="flex-1 font-semibold text-ink">{row.member.name}<span className="block text-xs font-normal text-ink-muted">{[row.member.city, row.member.country].filter(Boolean).join(', ')}</span></Link>
              {kind === 'incoming' && (
                <>
                  <button onClick={async () => { await api.post(`/community/connections/${row.id}/respond`, { accept: true }); void load(); }} className="h-9 rounded-full bg-acacia-600 px-3 text-xs font-bold text-white">Accept</button>
                  <button onClick={async () => { await api.post(`/community/connections/${row.id}/respond`, { accept: false }); void load(); }} className="h-9 rounded-full border border-line-strong px-3 text-xs">Decline</button>
                </>
              )}
              {kind !== 'incoming' && <button onClick={async () => { await api.delete(`/community/connections/${row.id}`); void load(); }} className="text-xs text-ink-muted underline">{kind === 'outgoing' ? 'Cancel' : 'Remove'}</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <div className="grid gap-8">
      {section('Requests for you', data.incoming, 'incoming')}
      {section('Your connections', data.connected, 'connected')}
      {section('Requests you sent', data.outgoing, 'outgoing')}
    </div>
  );
}
