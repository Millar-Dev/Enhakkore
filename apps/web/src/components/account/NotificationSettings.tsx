'use client';

import { useEffect, useState } from 'react';
import { ESSENTIAL_NOTIFICATION_LABELS, OPTIONAL_NOTIFICATIONS } from '@enhakkore/shared';
import { ApiError, api } from '@/lib/api';
import { currentSubscription, disablePush, enablePush, pushSupported } from '@/lib/push';
import { useSession } from '@/lib/session';

function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onChange} className="relative inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-40">
      <span className={`relative h-7 w-12 rounded-full transition-colors ${on ? 'bg-acacia-600' : 'bg-line'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

/**
 * Notification Settings: which kinds to receive, on which channels, and quiet
 * hours. It says honestly what is connected: push works in supporting
 * browsers; email and WhatsApp/SMS only once the team has connected them.
 */
export function NotificationSettings() {
  const { user, refresh } = useSession();
  const [off, setOff] = useState<string[]>([]);
  const [quiet, setQuiet] = useState({ start: '', end: '' });
  const [channels, setChannels] = useState({ push: true, email: false, whatsapp: false });
  const [pushState, setPushState] = useState<'unsupported' | 'off' | 'on' | 'blocked' | 'checking'>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user || ready) return;
    const prefs = (user.notificationPrefs ?? {}) as { off?: string[]; quietStart?: string; quietEnd?: string; channels?: typeof channels };
    setOff(prefs.off ?? []);
    setQuiet({ start: prefs.quietStart ?? '', end: prefs.quietEnd ?? '' });
    setChannels({ push: prefs.channels?.push !== false, email: !!prefs.channels?.email, whatsapp: !!prefs.channels?.whatsapp });
    setReady(true);
  }, [user, ready]);

  useEffect(() => {
    if (!pushSupported()) return setPushState('unsupported');
    if (Notification.permission === 'denied') return setPushState('blocked');
    currentSubscription().then((sub) => setPushState(sub ? 'on' : 'off')).catch(() => setPushState('off'));
  }, []);

  async function save(next: { off?: string[]; quiet?: typeof quiet; channels?: typeof channels } = {}) {
    const body = { off: next.off ?? off, quietStart: (next.quiet ?? quiet).start || null, quietEnd: (next.quiet ?? quiet).end || null, channels: next.channels ?? channels };
    try {
      await api.put('/me/notification-prefs', body);
      setMessage('Saved.');
      void refresh();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not save.');
    }
  }

  async function togglePush() {
    setMessage(null);
    if (pushState === 'on') {
      await disablePush();
      setPushState('off');
      setMessage('Push notifications are off on this device.');
      return;
    }
    const result = await enablePush().catch(() => ({ ok: false, reason: 'Could not switch push on. Try again.' }));
    if (!result.ok) {
      setMessage(result.reason ?? 'Could not switch push on.');
      if (Notification.permission === 'denied') setPushState('blocked');
      return;
    }
    setPushState('on');
    const next = { ...channels, push: true };
    setChannels(next);
    await save({ channels: next });
    setMessage('Push notifications are on for this device.');
  }

  async function testPush() {
    const result = await api.post<{ message: string }>('/me/push/test').catch((caught) => ({ message: caught instanceof ApiError ? caught.message : 'Test failed.' }));
    setMessage(result.message);
  }

  return (
    <div className="grid gap-5">
      {message && <p role="status" className="rounded-xl bg-sand p-3 text-sm text-ink-soft">{message}</p>}

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-bold">How you are notified</h2>
        <ul className="mt-3 divide-y divide-line text-sm">
          <li className="flex min-h-14 items-center justify-between gap-3">
            <span>
              <span className="block font-semibold text-ink">Push notifications on this device</span>
              <span className="text-xs text-ink-muted">
                {pushState === 'unsupported' ? 'Not supported in this browser. On iPhone, add Enhakkore to the Home Screen first.' : pushState === 'blocked' ? 'Blocked in your browser settings for this site.' : pushState === 'on' ? 'On. Opening a notification takes you straight to it.' : 'Off on this device.'}
              </span>
            </span>
            <Switch on={pushState === 'on'} label="Push notifications" onChange={togglePush} disabled={pushState === 'unsupported' || pushState === 'checking'} />
          </li>
          {pushState === 'on' && (
            <li className="py-2"><button type="button" onClick={testPush} className="h-10 rounded-full border border-line px-4 text-sm font-semibold">Send me a test notification</button></li>
          )}
          <li className="flex min-h-14 items-center justify-between gap-3">
            <span>
              <span className="block font-semibold text-ink">Email</span>
              <span className="text-xs text-ink-muted">Saved for when Enhakkore connects its email service. Password emails work separately.</span>
            </span>
            <Switch on={channels.email} label="Email notifications" onChange={() => { const next = { ...channels, email: !channels.email }; setChannels(next); void save({ channels: next }); }} />
          </li>
          <li className="flex min-h-14 items-center justify-between gap-3">
            <span>
              <span className="block font-semibold text-ink">WhatsApp / SMS</span>
              <span className="text-xs text-ink-muted">Not available yet — it needs a connected messaging provider. Nothing is sent by WhatsApp or SMS today.</span>
            </span>
            <Switch on={false} label="WhatsApp or SMS notifications" onChange={() => undefined} disabled />
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-bold">What you are notified about</h2>
        <p className="mt-1 text-sm text-ink-muted">Always on: {ESSENTIAL_NOTIFICATION_LABELS.join(', ').toLowerCase()}.</p>
        <ul className="mt-3 divide-y divide-line">
          {OPTIONAL_NOTIFICATIONS.map((item) => {
            const enabled = !off.includes(item.key);
            return (
              <li key={item.key} className="flex min-h-14 items-center justify-between gap-3">
                <span className="text-sm text-ink-soft">{item.label}</span>
                <Switch
                  on={enabled}
                  label={item.label}
                  onChange={() => {
                    const next = enabled ? [...off, item.key] : off.filter((key) => key !== item.key);
                    setOff(next);
                    void save({ off: next });
                  }}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-bold">Quiet hours</h2>
        <p className="mt-1 text-sm text-ink-muted">No push notifications in this window (East Africa Time), except essential ones. They still appear in your inbox.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-sm font-semibold text-ink-soft">From<input type="time" value={quiet.start} onChange={(event) => setQuiet((q) => ({ ...q, start: event.target.value }))} className="field" /></label>
          <label className="grid gap-1 text-sm font-semibold text-ink-soft">Until<input type="time" value={quiet.end} onChange={(event) => setQuiet((q) => ({ ...q, end: event.target.value }))} className="field" /></label>
          <button type="button" onClick={() => save()} className="h-12 rounded-full border border-line px-5 text-sm font-semibold">Save</button>
        </div>
      </section>
    </div>
  );
}
