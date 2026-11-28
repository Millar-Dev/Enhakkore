/* Enhakkore service worker: browser push notifications only (no offline caching). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Enhakkore', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Enhakkore';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/brand/refined/enhakkore-icon-192.png',
      badge: '/brand/refined/favicon-32.png',
      tag: data.tag || undefined,
      data: { url: data.url || '/account/notifications' },
    }),
  );
});

/* Opening a notification goes straight to its page (an invitation, a chat…), never the homepage. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/account/notifications', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
