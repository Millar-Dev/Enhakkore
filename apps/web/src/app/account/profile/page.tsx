'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SUGGESTED_INTERESTS, USERNAME_PATTERN } from '@enhakkore/shared';
import type { PublicUser } from '@enhakkore/shared';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { CountryCity } from '@/components/public/CountryCity';
import { CropUpload } from '@/components/uploads/CropUpload';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

const FIELD_LABELS: Record<string, string> = {
  bio: 'About you',
  interests: 'Interests',
  location: 'Country and city',
  communities: 'Communities you belong to',
  activities: 'Activities you are going to',
};
const LEVELS = [
  { value: 'PUBLIC', label: 'Everyone' },
  { value: 'MEMBERS', label: 'Members' },
  { value: 'PRIVATE', label: 'Only me' },
];

/**
 * The member's profile card: picture, cover, username, introduction and
 * interests, with who can see each part. Phone and email are never shown to
 * anyone.
 */
export default function ProfilePage() {
  const { user, updateUser } = useSession();
  const [interests, setInterests] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [place, setPlace] = useState({ country: '', city: '' });
  const [username, setUsername] = useState('');
  const [visibility, setVisibility] = useState<Record<string, string>>({});
  const [check, setCheck] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user || ready) return;
    setInterests(user.interests ?? []);
    setAvatar(user.avatarUrl ?? null);
    setCover(user.coverImage ?? null);
    setPlace({ country: user.country ?? '', city: user.city ?? '' });
    setUsername(user.username ?? '');
    setVisibility(user.profileFields ?? {});
    setReady(true);
  }, [user, ready]);

  useEffect(() => {
    const value = username.trim().toLowerCase();
    if (!user || !value || value === user.username) return setCheck(null);
    if (!USERNAME_PATTERN.test(value)) return setCheck({ ok: false, reason: 'Use 3–20 lowercase letters, numbers, dots or underscores.' });
    const timer = window.setTimeout(() => {
      api
        .get<{ available: boolean; reason: string | null }>(`/me/username-available?u=${encodeURIComponent(value)}`)
        .then((result) => setCheck({ ok: result.available, reason: result.reason ?? undefined }))
        .catch(() => setCheck(null));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [username, user]);

  if (!user) return <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES}>{null}</DashboardShell>;
  const toggle = (tag: string) => setInterests((list) => (list.includes(tag) ? list.filter((item) => item !== tag) : [...list, tag]));

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title="Your profile">
      <form
        className="grid max-w-2xl gap-6"
        onSubmit={async (event) => {
          event.preventDefault();
          if (check && !check.ok) return setMessage({ tone: 'error', text: check.reason ?? 'Choose another username.' });
          const form = new FormData(event.currentTarget);
          setBusy(true);
          setMessage(null);
          try {
            const updated = await api.patch<PublicUser>('/me', {
              name: String(form.get('name')),
              headline: String(form.get('headline') ?? ''),
              bio: String(form.get('bio') ?? ''),
              country: place.country,
              city: place.city,
              phone: String(form.get('phone') ?? ''),
              avatarUrl: avatar ?? '',
              coverImage: cover ?? '',
              interests,
              activityPrefs: [],
              profileVisibility: form.get('hidden') ? 'HIDDEN' : 'MEMBERS',
              profileFields: visibility,
              ...(form.get('dateOfBirth') ? { dateOfBirth: String(form.get('dateOfBirth')) } : {}),
              ...(username.trim() && username.trim().toLowerCase() !== user.username ? { username: username.trim().toLowerCase() } : {}),
            });
            updateUser({ ...user, ...updated });
            setMessage({ tone: 'ok', text: 'Saved.' });
          } catch (caught) {
            setMessage({ tone: 'error', text: caught instanceof ApiError ? caught.message : 'Could not save.' });
          } finally {
            setBusy(false);
          }
        }}
      >
        <section className="grid gap-4">
          <CropUpload label="Cover photo" kind="AVATAR" aspect={3} outputWidth={1500} value={cover} onChange={setCover} />
          <CropUpload label="Profile picture" kind="AVATAR" aspect={1} outputWidth={512} round value={avatar} onChange={setAvatar} />
        </section>

        <label id="username" className="grid scroll-mt-24 gap-1 text-sm font-semibold text-ink-soft">
          Username
          <span className="flex items-center rounded-xl border border-line bg-white focus-within:ring-2 focus-within:ring-acacia-500">
            <span className="pl-3 text-ink-faint">@</span>
            <input value={username} onChange={(event) => setUsername(event.target.value.replace(/\s/g, '').toLowerCase())} maxLength={20} className="h-12 w-full rounded-xl bg-transparent px-1 font-normal outline-none" aria-describedby="username-hint" />
          </span>
          <span id="username-hint" className={`text-xs font-normal ${check && !check.ok ? 'text-[#b42318]' : 'text-ink-muted'}`}>
            {check ? (check.ok ? 'Available.' : check.reason) : 'Shown to other members instead of your phone number or email.'}
          </span>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink-soft">Full name<input name="name" defaultValue={user.name} required className="field" /><span className="text-xs font-normal text-ink-muted">Seen by signed-in members and the organisers of things you join. Public visitors see your username.</span></label>
        {user.dateOfBirth ? (
          <p className="text-sm text-ink-muted">Date of birth saved — used only for age protections and never shown to others. Contact support to correct it.</p>
        ) : (
          <label className="grid gap-1 text-sm font-semibold text-ink-soft">Date of birth<input name="dateOfBirth" type="date" max={new Date(Date.now() - 13 * 365.25 * 86_400_000).toISOString().slice(0, 10)} className="field" /><span className="text-xs font-normal text-ink-muted">Needed for adult-only features such as nearby gaming. Never shown to other members, and can be set once.</span></label>
        )}
        <label className="grid gap-1 text-sm font-semibold text-ink-soft">One-line introduction<input name="headline" defaultValue={user.headline ?? ''} maxLength={120} placeholder="Weekend hooper, always up for a hike" className="field" /></label>
        <label className="grid gap-1 text-sm font-semibold text-ink-soft">About you<textarea name="bio" defaultValue={user.bio ?? ''} maxLength={600} className="field" /></label>
        <CountryCity country={place.country} city={place.city} onChange={setPlace} />
        <label className="grid gap-1 text-sm font-semibold text-ink-soft">Phone (private — never shown to members)<input name="phone" defaultValue={user.phone ?? ''} className="field" /></label>

        <div>
          <p className="text-sm font-semibold text-ink-soft">Interests & activities</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Array.from(new Set([...SUGGESTED_INTERESTS, ...interests])).map((tag) => (
              <button type="button" key={tag} onClick={() => toggle(tag)} className={`chip ${interests.includes(tag) ? 'chip-active' : ''}`} aria-pressed={interests.includes(tag)}>{tag}</button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Add your own (e.g. PUBG Mobile)" className="field" maxLength={40} />
            <button type="button" onClick={() => { if (custom.trim()) { toggle(custom.trim()); setCustom(''); } }} className="chip">Add</button>
          </div>
        </div>

        <fieldset id="privacy" className="scroll-mt-24 rounded-2xl border border-line bg-white p-4">
          <legend className="px-1 text-sm font-bold text-ink">Who can see each part</legend>
          <p className="text-xs text-ink-muted">“Everyone” includes people who are not signed in, on your public card at /u/{user.username || 'username'}.</p>
          <div className="mt-3 grid gap-3">
            {Object.entries(FIELD_LABELS).map(([field, label]) => (
              <div key={field} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-ink-soft">{label}</span>
                <div className="flex gap-1 rounded-full bg-sand p-1" role="radiogroup" aria-label={label}>
                  {LEVELS.map((level) => {
                    const active = (visibility[field] ?? 'MEMBERS') === level.value;
                    return (
                      <button key={level.value} type="button" role="radio" aria-checked={active} onClick={() => setVisibility((v) => ({ ...v, [field]: level.value }))} className={`min-h-9 rounded-full px-3 text-xs font-semibold ${active ? 'bg-acacia-700 text-white' : 'text-ink-muted'}`}>
                        {level.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <label className="flex items-start gap-2 text-sm text-ink-soft">
          <input type="checkbox" name="hidden" defaultChecked={user.profileVisibility === 'HIDDEN'} className="mt-1" />
          Hide my profile from member search and my public card (people you are already connected with can still see it)
        </label>
        {message && <p role="status" className={`text-sm ${message.tone === 'ok' ? 'text-acacia-700' : 'text-[#b42318]'}`}>{message.text}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={busy} className="h-12 w-fit rounded-full bg-acacia-600 px-8 font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save profile'}</button>
          {user.username && <Link href={`/u/${user.username}`} className="text-sm font-semibold text-acacia-700 underline">See your public card</Link>}
        </div>
      </form>
    </DashboardShell>
  );
}
