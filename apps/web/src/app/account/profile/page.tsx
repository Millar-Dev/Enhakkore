'use client';

import { useState } from 'react';
import { SUGGESTED_INTERESTS } from '@enhakkore/shared';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { ImageUpload } from '@/components/uploads/ImageUpload';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { PublicUser } from '@enhakkore/shared';

/** The member's Connect profile: what other members see. Never an address or a location. */
export default function ProfilePage() {
  const { user, updateUser } = useSession();
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [custom, setCustom] = useState('');
  const [avatar, setAvatar] = useState<string | null>(user?.avatarUrl ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES}>{null}</DashboardShell>;
  const toggle = (tag: string) => setInterests((list) => (list.includes(tag) ? list.filter((item) => item !== tag) : [...list, tag]));

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title="Your profile">
      <form
        className="grid max-w-2xl gap-5"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          setMessage(null);
          try {
            const updated = await api.patch<PublicUser>('/me', {
              name: String(form.get('name')),
              headline: String(form.get('headline') ?? ''),
              bio: String(form.get('bio') ?? ''),
              country: String(form.get('country') ?? ''),
              city: String(form.get('city') ?? ''),
              phone: String(form.get('phone') ?? ''),
              avatarUrl: avatar ?? '',
              interests,
              activityPrefs: [],
              profileVisibility: form.get('hidden') ? 'HIDDEN' : 'MEMBERS',
            });
            updateUser({ ...user, ...updated });
            setMessage('Saved.');
          } catch (caught) {
            setMessage(caught instanceof ApiError ? caught.message : 'Could not save.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-soft">Profile picture</p>
          <ImageUpload kind="AVATAR" value={avatar ? [avatar] : []} onChange={(urls: string[]) => setAvatar(urls[0] ?? null)} max={1} />
        </div>
        <label className="grid gap-1 text-sm font-semibold text-ink-soft">Name<input name="name" defaultValue={user.name} required className="field" /></label>
        <label className="grid gap-1 text-sm font-semibold text-ink-soft">One-line introduction<input name="headline" defaultValue={user.headline ?? ''} maxLength={120} placeholder="Weekend hooper, always up for a hike" className="field" /></label>
        <label className="grid gap-1 text-sm font-semibold text-ink-soft">About you<textarea name="bio" defaultValue={user.bio ?? ''} maxLength={600} className="field" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-ink-soft">Country<input name="country" defaultValue={user.country ?? ''} className="field" /></label>
          <label className="grid gap-1 text-sm font-semibold text-ink-soft">City<input name="city" defaultValue={user.city ?? ''} className="field" /></label>
        </div>
        <label className="grid gap-1 text-sm font-semibold text-ink-soft">Phone (private — never shown to members)<input name="phone" defaultValue={user.phone ?? ''} className="field" /></label>
        <div>
          <p className="text-sm font-semibold text-ink-soft">Interests & activities</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Array.from(new Set([...SUGGESTED_INTERESTS, ...interests])).map((tag) => (
              <button type="button" key={tag} onClick={() => toggle(tag)} className={`chip ${interests.includes(tag) ? 'chip-active' : ''}`}>{tag}</button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Add your own (e.g. PUBG Mobile)" className="field" maxLength={40} />
            <button type="button" onClick={() => { if (custom.trim()) { toggle(custom.trim()); setCustom(''); } }} className="chip">Add</button>
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-ink-soft">
          <input type="checkbox" name="hidden" defaultChecked={user.profileVisibility === 'HIDDEN'} className="mt-1" />
          Hide my profile from member search (people you are already connected with can still see it)
        </label>
        {message && <p className="text-sm text-acacia-700">{message}</p>}
        <button disabled={busy} className="h-12 w-fit rounded-full bg-acacia-600 px-8 font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save profile'}</button>
      </form>
    </DashboardShell>
  );
}
