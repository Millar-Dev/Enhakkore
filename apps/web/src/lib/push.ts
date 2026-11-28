'use client';

import { api } from './api';

/** Web Push in this browser: support, permission, subscribe and unsubscribe. */
export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function toKey(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Asks for permission and registers this device. Returns why it did not work, if it did not. */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: 'This browser does not support push notifications. On iPhone, add Enhakkore to your Home Screen first.' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'Notifications are blocked for this site in your browser settings.' };
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const { publicKey } = await api.get<{ publicKey: string }>('/me/push/key');
  const subscription = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }));
  const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await api.post('/me/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
  return { ok: true };
}

export async function disablePush() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await api.post('/me/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => undefined);
  await subscription.unsubscribe().catch(() => undefined);
}
