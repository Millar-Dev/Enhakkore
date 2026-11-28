'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { ApiError, api, setToken } from '@/lib/api';
import { useSession } from '@/lib/session';

const NEARBY = [
  { value: 'OFF', label: 'Off', body: 'Nobody can discover you nearby. This is the default.' },
  { value: 'M4', label: 'Very close (about 4 m)', body: 'Only people right next to you — the same table or queue.' },
  { value: 'M10', label: 'Close (about 10 m)', body: 'People in the same room or a small venue.' },
];

function PrivacySwitches() {
  const [state, setState] = useState<{ readReceipts: boolean; friendLocation: boolean } | null>(null);
  useEffect(() => {
    api.get<{ readReceipts: boolean; friendLocation: boolean }>('/social/me').then((data) => setState({ readReceipts: data.readReceipts, friendLocation: data.friendLocation })).catch(() => undefined);
  }, []);
  async function toggle(key: 'readReceipts' | 'friendLocation') {
    if (!state) return;
    const next = { ...state, [key]: !state[key] };
    setState(next);
    await api.put('/social/me', { [key]: next[key] }).catch(() => setState(state));
  }
  const rows = [
    { key: 'readReceipts' as const, label: 'Read receipts in private messages', body: 'Others see “Seen” when you have read their message. If you switch this off, you will not see theirs either.' },
    { key: 'friendLocation' as const, label: 'Show friends my approximate distance', body: 'Accepted friends see a distance band (for example “1–2 km”) when you have shared your location recently. Never your exact location. Off by default.' },
  ];
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-lg font-bold text-ink">Privacy</h2>
      <ul className="mt-2 divide-y divide-line">
        {rows.map((row) => (
          <li key={row.key} className="flex min-h-16 items-center justify-between gap-3 py-2">
            <span><span className="block text-sm font-semibold text-ink">{row.label}</span><span className="text-xs text-ink-muted">{row.body}</span></span>
            <button type="button" role="switch" aria-checked={!!state?.[row.key]} aria-label={row.label} disabled={!state} onClick={() => toggle(row.key)} className="relative inline-flex h-11 w-14 shrink-0 items-center justify-center">
              <span className={`relative h-7 w-12 rounded-full transition-colors ${state?.[row.key] ? 'bg-acacia-600' : 'bg-line'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${state?.[row.key] ? 'left-6' : 'left-1'}`} /></span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-ink-muted">Who sees your profile details is set on <Link href="/account/profile#privacy" className="font-semibold text-acacia-700 underline">your profile</Link>. Blocked members can be managed below.</p>
      <BlockedList />
    </section>
  );
}

function BlockedList() {
  const [rows, setRows] = useState<{ userId: string; name: string }[] | null>(null);
  useEffect(() => {
    api.get<{ userId: string; name: string }[]>('/community/blocks').then(setRows).catch(() => setRows([]));
  }, []);
  if (!rows || rows.length === 0) return null;
  return (
    <ul className="mt-3 grid gap-1 text-sm">
      {rows.map((row) => (
        <li key={row.userId} className="flex items-center justify-between rounded-lg bg-sand px-3 py-2">
          <span>{row.name}</span>
          <button type="button" className="font-semibold text-acacia-700 underline" onClick={async () => { await api.delete(`/community/blocks/${row.userId}`); setRows((list) => list?.filter((item) => item.userId !== row.userId) ?? null); }}>Unblock</button>
        </li>
      ))}
    </ul>
  );
}

function DevicesSection() {
  const [rows, setRows] = useState<{ id: string; userAgent: string | null; lastSeenAt: string; current: boolean }[] | null>(null);
  const load = () => api.get<{ items: NonNullable<typeof rows> }>('/me/sessions').then((data) => setRows(data.items)).catch(() => setRows([]));
  useEffect(() => {
    void load();
  }, []);
  const device = (agent: string | null) => (!agent ? 'Unknown device' : /iphone|ipad/i.test(agent) ? 'iPhone / iPad' : /android/i.test(agent) ? 'Android' : /windows/i.test(agent) ? 'Windows' : /mac/i.test(agent) ? 'Mac' : 'Browser');
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-lg font-bold text-ink">Signed-in devices</h2>
      <ul className="mt-2 grid gap-2 text-sm">
        {rows === null ? <li className="text-ink-muted">Loading…</li> : rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-2 rounded-lg bg-sand px-3 py-2">
            <span>{device(row.userAgent)}{row.current ? ' · this device' : ''}<span className="block text-xs text-ink-muted">Last active {new Date(row.lastSeenAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></span>
            {!row.current && <button type="button" className="font-semibold text-danger underline" onClick={async () => { await api.post(`/me/sessions/${row.id}/revoke`); void load(); }}>Sign out</button>}
          </li>
        ))}
      </ul>
      {rows && rows.length > 1 && <button type="button" onClick={async () => { await api.post('/me/sessions/others/revoke'); void load(); }} className="mt-3 h-10 rounded-full border border-line px-4 text-sm font-semibold">Sign out all other devices</button>}
    </section>
  );
}

/** Notifications, privacy, devices, Enhakkore Nearby and password. */
export default function SettingsPage() {
  const { user, refresh } = useSession();
  const [password, setPassword] = useState({ current: '', next: '' });
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [nearby, setNearby] = useState('OFF');
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user || ready) return;
    setNearby(user.nearbyMode ?? 'OFF');
    setReady(true);
  }, [user, ready]);

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
          <p className="mt-1 text-sm text-ink-muted">Push notifications, what you are told about, and quiet hours.</p>
          <Link href="/account/notifications?section=settings" className="mt-3 inline-flex h-11 items-center rounded-full border border-line px-5 text-sm font-semibold">Notification settings ›</Link>
        </section>

        <PrivacySwitches />

        <DevicesSection />

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
