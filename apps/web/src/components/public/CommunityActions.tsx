'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

interface Detail {
  members: { id: string; name: string; username?: string | null; avatarUrl: string | null; city: string | null; role: string }[];
  viewer: { isMember: boolean; status?: string | null; role: string | null } | null;
  community?: { accessType?: string; membershipPrice?: number | null; membershipCurrency?: string | null; membershipPeriod?: string | null; membershipBenefits?: string | null; membershipTerms?: string | null };
}
const PERIOD: Record<string, string> = { MONTH: 'per month', YEAR: 'per year', ONCE: 'one-time' };

/** Join / leave, and the member list (signed-in members only). */
export function CommunityMembership({ slug, memberCount }: { slug: string; memberCount: number }) {
  const { status } = useSession();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(() => api.get<Detail>(`/public/communities/${slug}`).then(setDetail).catch(() => undefined), [slug]);
  useEffect(() => {
    if (status === 'authenticated') void load();
  }, [status, load]);

  if (status !== 'authenticated') {
    return (
      <div className="rounded-[1.1rem] border border-line bg-[color:var(--color-cream)] p-5">
        <p className="font-semibold text-acacia-700">{memberCount} member{memberCount === 1 ? '' : 's'}</p>
        <p className="mt-1 text-sm text-ink-soft">Join free to get announcements and see who else is in.</p>
        <Link href={`/join?next=/experiences/communities/${slug}`} className="mt-3 inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Join Enhakkore</Link>
      </div>
    );
  }
  const isMember = !!detail?.viewer?.isMember;
  const pending = detail?.viewer?.status === 'PENDING';
  const declined = detail?.viewer?.status === 'DECLINED';
  const access = detail?.community?.accessType ?? 'FREE';
  const c = detail?.community;
  return (
    <div className="space-y-4">
      {access !== 'FREE' && (
        <div className="rounded-[1.1rem] border border-line bg-white p-5 text-sm text-ink-soft">
          <p className="font-bold text-acacia-700">{access === 'PAID' ? 'Paid membership' : 'Private community'}</p>
          {access === 'PAID' && c?.membershipPrice != null && <p className="mt-1">{c.membershipCurrency ?? 'TZS'} {c.membershipPrice.toLocaleString()} {PERIOD[c.membershipPeriod ?? ''] ?? ''} — separate from the cost of any event.</p>}
          {access === 'PAID' && <p className="mt-1">Online payment is not switched on yet. Send a request; the community team will contact you about payment and approve your membership.</p>}
          {access === 'PRIVATE' && <p className="mt-1">Members apply and the community team approves each one.</p>}
          {c?.membershipBenefits && <p className="mt-2 whitespace-pre-line"><strong>Members get:</strong> {c.membershipBenefits}</p>}
          {c?.membershipTerms && <details className="mt-2"><summary className="cursor-pointer font-semibold">Membership terms</summary><p className="mt-1 whitespace-pre-line">{c.membershipTerms}</p></details>}
        </div>
      )}
      {notice && <p role="status" className="rounded-xl bg-sand p-3 text-sm text-ink-soft">{notice}</p>}
      {pending ? (
        <p className="rounded-xl border border-line bg-white p-4 text-sm text-ink-soft">Your request is waiting for the community team. <button type="button" className="font-semibold underline" onClick={async () => { await api.post(`/community/communities/${slug}/leave`, {}).catch(() => undefined); await load(); }}>Withdraw</button></p>
      ) : declined ? (
        <p className="rounded-xl border border-line bg-white p-4 text-sm text-ink-soft">Your last request was not approved.</p>
      ) : (
        <>
          {!isMember && access === 'PRIVATE' && (
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} placeholder="Tell the community team a little about yourself" aria-label="Message to the community team" className="field w-full" />
          )}
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setNotice(null);
              try {
                const result = await api.post<{ message?: string }>(`/community/communities/${slug}/${isMember ? 'leave' : 'join'}`, isMember ? {} : { message: note || undefined });
                if (!isMember && result.message && access !== 'FREE') setNotice(result.message);
              } catch (caught) {
                setNotice(caught instanceof ApiError ? caught.message : 'That did not work.');
              }
              await load();
              setBusy(false);
            }}
            className={isMember ? 'h-12 w-full rounded-full border border-line-strong bg-white font-semibold text-ink' : 'h-12 w-full rounded-full bg-acacia-600 font-bold text-white'}
          >
            {isMember ? 'Leave community' : access === 'FREE' ? 'Join community' : 'Request to join'}
          </button>
        </>
      )}
      <div className="rounded-[1.1rem] border border-line bg-white p-5">
        <p className="font-bold text-acacia-700">Members ({detail?.members.length ?? memberCount})</p>
        <ul className="mt-3 grid gap-2">
          {(detail?.members ?? []).slice(0, 30).map((member) => (
            <li key={member.id}>
              <Link href={`/members/${member.id}`} className="flex items-center gap-2 text-sm">
                <Avatar name={member.name} src={member.avatarUrl} size="xs" />
                <span className="font-semibold text-ink">{member.username ? `@${member.username}` : member.name.split(' ')[0]}</span>
                {member.role === 'MODERATOR' && <span className="text-xs text-clay-600">moderator</span>}
                {member.city && <span className="text-xs text-ink-muted">{member.city}</span>}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">Only names and photos members chose to share. No phone numbers or emails.</p>
      </div>
    </div>
  );
}

/** A member applies to start a community. Reviewed before it is published. */
export function CommunityApplyForm({ categories, countries }: { categories: { id: string; name: string }[]; countries: { id: string; name: string }[] }) {
  const { status } = useSession();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (status !== 'authenticated') {
    return (
      <p className="text-sm text-ink-soft">
        <Link href="/signin?next=/experiences/communities#start" className="font-semibold text-acacia-600 underline">Sign in</Link> to apply to start a community.
      </p>
    );
  }
  if (message) return <p className="rounded-xl bg-safari-50 p-4 text-sm text-safari-700">{message}</p>;
  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const get = (name: string) => String(form.get(name) ?? '').trim();
        setError(null);
        try {
          const result = await api.post<{ message: string }>('/community/communities/apply', {
            name: get('name'),
            summary: get('summary'),
            description: get('description'),
            categoryId: get('categoryId'),
            countryId: get('countryId'),
            rules: get('rules'),
          });
          setMessage(result.message);
        } catch (caught) {
          setError(caught instanceof ApiError ? Object.values(caught.fields)[0] ?? caught.message : 'Could not send.');
        }
      }}
    >
      <input name="name" required minLength={3} maxLength={120} className="field" placeholder="Community name — e.g. Dar Jogging" aria-label="Community name" />
      <input name="summary" required minLength={10} maxLength={400} className="field" placeholder="In one sentence: who is it for?" aria-label="Summary" />
      <textarea name="description" className="field" placeholder="What will members do together?" aria-label="Description" />
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="categoryId" className="field" defaultValue="" aria-label="Category">
          <option value="">Category (optional)</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select name="countryId" className="field" defaultValue="" aria-label="Country">
          <option value="">Country (optional)</option>
          {countries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}
        </select>
      </div>
      <textarea name="rules" className="field" placeholder="Community rules (optional)" aria-label="Rules" />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button className="h-12 rounded-full bg-acacia-600 font-bold text-white">Apply to start this community</button>
      <p className="text-xs text-ink-muted">The Enhakkore team reviews every community before it is published.</p>
    </form>
  );
}
