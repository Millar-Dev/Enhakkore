'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { OPTIONAL_NOTIFICATIONS } from '@enhakkore/shared';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { ApiError, api, setToken } from '@/lib/api';
import { useSession } from '@/lib/session';

const NEARBY = [
  { value: 'OFF', label: 'Off', body: 'Nobody can discover you nearby. This is the default.' },
  { value: 'M4', label: 'Very close (about 4 m)', body: 'Only people right next to you — the same table or queue.' },
  { value: 'M10', label: 'Close (about 10 m)', body: 'People in the same room or a small venue.' },
];

/** Notifications, quiet hours and Enhakkore Nearby. */
export default function SettingsPage() {
  const { user, refresh } = useSession();
  const [password, setPassword] = useState({ current: '', next: '' });
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [off, setOff] = useState<string[]>([]);
  const [quiet, setQuiet] = useState({ start: '', end: '' });
  const [nearby, setNearby] = useState('OFF');
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user || ready) return;
    setOff(user.notificationPrefs?.off ?? []);
    setQuiet({ start: user.notificationPrefs?.quietStart ?? '', end: user.notificationPrefs?.quietEnd ?? '' });
    setNearby(user.nearbyMode ?? 'OFF');
    setReady(true);
  }, [user, ready]);

  async function saveNotifications(nextOff = off, nextQuiet = quiet) {
    try {
      await api.put('/me/notification-prefs', { off: nextOff, quietStart: nextQuiet.start || null, quietEnd: nextQuiet.end || null });
      setMessage('Notification settings saved.');
      void refresh();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not save.');
    }
  }

  async function saveNearby(mode: string) {
    setNearby(mode);
    try {
      await api.put('/me/nearby', { mode });
      setMessage(mode === 'OFF' ? 'Nearby is off.' : 'Preference saved. Nearby discovery will use it once the Enhakkore mobile app is available.');
      void refresh();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not save.');
    }
  }

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title="Settings">
      <div className="grid max-w-2xl gap-8">
        {message && <p role="status" className="rounded-xl bg-sand p-3 text-sm text-ink-soft">{message}</p>}

        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold text-ink">Notifications</h2>
          <p className="mt-1 text-sm text-ink-muted">Booking, payment, cancellation, safety and pass notices are always sent. You can switch off the others.</p>
          <ul className="mt-4 divide-y divide-line">
            {OPTIONAL_NOTIFICATIONS.map((item) => {
              const enabled = !off.includes(item.key);
              return (
                <li key={item.key} className="flex min-h-14 items-center justify-between gap-3">
                  <span className="text-sm text-ink-soft">{item.label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={item.label}
                    onClick={() => {
                      const next = enabled ? [...off, item.key] : off.filter((key) => key !== item.key);
                      setOff(next);
                      void saveNotifications(next);
                    }}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${enabled ? 'bg-acacia-600' : 'bg-line'}`}
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${enabled ? 'left-6' : 'left-1'}`} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="grid gap-1 text-sm font-semibold text-ink-soft">Quiet hours from<input type="time" value={quiet.start} onChange={(event) => setQuiet((q) => ({ ...q, start: event.target.value }))} className="field" /></label>
            <label className="grid gap-1 text-sm font-semibold text-ink-soft">until<input type="time" value={quiet.end} onChange={(event) => setQuiet((q) => ({ ...q, end: event.target.value }))} className="field" /></label>
            <button type="button" onClick={() => saveNotifications()} className="h-12 rounded-full border border-line px-5 text-sm font-semibold">Save</button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">Quiet hours will apply to phone and email alerts when those are connected. Today Enhakkore sends in-app notices only, which never make a sound.</p>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold text-ink">Enhakkore Nearby</h2>
          <p className="mt-1 text-sm text-ink-muted">Meet members who are physically near you — only when both of you have switched it on. Your exact location is never shown.</p>
          <div className="mt-4 rounded-xl border border-[#e2c47a] bg-[#fff8e6] p-3 text-sm text-ink-soft">
            <strong>Not working yet on the website.</strong> Telling 4 metres from 10 metres needs short-range Bluetooth between phones, which web browsers do not allow. GPS is not accurate enough for this. Nearby will work in the Enhakkore mobile app; your choice here is saved for it.
          </div>
          <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Nearby">
            {NEARBY.map((option) => (
              <label key={option.value} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3 ${nearby === option.value ? 'border-acacia-600 bg-[#f1f6fb]' : 'border-line'}`}>
                <input type="radio" name="nearby" value={option.value} checked={nearby === option.value} onChange={() => saveNearby(option.value)} className="mt-1" />
                <span><span className="block text-sm font-semibold text-ink">{option.label}</span><span className="text-xs text-ink-muted">{option.body}</span></span>
              </label>
            ))}
          </div>
        </section>

        <section id="security" className="scroll-mt-24 rounded-2xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold text-ink">Password & security</h2>
          <form
            className="mt-3 grid gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setPwMessage(null);
              try {
                const result = await api.post<{ token: string }>('/auth/password', { currentPassword: password.current, newPassword: password.next });
                // Other sessions end; this device keeps working with the fresh token.
                setToken(result.token);
                await refresh();
                setPassword({ current: '', next: '' });
                setPwMessage('Password changed. You were signed out on your other devices.');
              } catch (caught) {
                setPwMessage(caught instanceof ApiError ? caught.message : 'Could not change the password.');
              }
            }}
          >
            <label className="grid gap-1 text-sm font-semibold text-ink-soft">Current password<input type="password" autoComplete="current-password" required value={password.current} onChange={(event) => setPassword((p) => ({ ...p, current: event.target.value }))} className="field" /></label>
            <label className="grid gap-1 text-sm font-semibold text-ink-soft">New password<input type="password" autoComplete="new-password" required minLength={8} value={password.next} onChange={(event) => setPassword((p) => ({ ...p, next: event.target.value }))} className="field" /><span className="text-xs font-normal text-ink-muted">At least 8 characters.</span></label>
            {pwMessage && <p role="status" className="text-sm text-ink-soft">{pwMessage}</p>}
            <button className="h-12 w-fit rounded-full bg-acacia-600 px-6 text-sm font-bold text-white">Change password</button>
          </form>
        </section>

        <p className="text-sm text-ink-muted">Who can see your profile details is set on <Link href="/account/profile" className="font-semibold text-acacia-700 underline">your profile</Link>.</p>
      </div>
    </DashboardShell>
  );
}
