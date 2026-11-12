/* eslint-disable no-restricted-globals */
const KK_PUSH_CACHE = 'kk-push-notified-v1';
const KK_PUSH_IDS_KEY = '/__kk_push_notified_ids.json';
const MAX_STORED_PUSH_IDS = 100;

async function readPushNotifiedIds() {
  try {
    const cache = await caches.open(KK_PUSH_CACHE);
    const res = await cache.match(KK_PUSH_IDS_KEY);
    if (!res) return [];
    const parsed = await res.json();
    return Array.isArray(parsed) ? parsed.filter((id) => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

async function markPushNotifiedId(bookingId) {
  const numericId = Number(bookingId);
  if (!Number.isInteger(numericId) || numericId <= 0) return;
  try {
    const existing = await readPushNotifiedIds();
    if (existing.includes(numericId)) return;
    const next = [...existing, numericId].slice(-MAX_STORED_PUSH_IDS);
    const cache = await caches.open(KK_PUSH_CACHE);
    await cache.put(
      KK_PUSH_IDS_KEY,
      new Response(JSON.stringify(next), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
  } catch {
    // Ignore Cache API failures cleanly
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json() || {};
  } catch {
    payload = {
      title: 'New Ride Request',
      body: event.data.text() || 'A passenger is waiting for an auto ride.'
    };
  }

  const bookingId = Number(payload.bookingId);
  const hasBookingId = Number.isInteger(bookingId) && bookingId > 0;
  const tag = payload.tag || (hasBookingId ? `ride-request-${bookingId}` : 'ride-request');
  const title = payload.title || 'New Ride Request';
  const body = payload.body || 'Tap to view pickup area and fare.';
  const targetUrl = payload.url || '/driver';

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      const visibleDriverClients = windowClients.filter((client) => {
        try {
          const parsedUrl = new URL(client.url);
          return parsedUrl.pathname.startsWith('/driver') && client.visibilityState === 'visible';
        } catch {
          return false;
        }
      });

      // When Driver Dashboard is actively visible in the foreground, let the open app
      // handle showing the single browser Notification without duplicate background alerts.
      if (visibleDriverClients.length > 0) {
        for (const client of visibleDriverClients) {
          client.postMessage({
            type: 'KK_NEW_RIDE_PUSH',
            payload: { ...payload, bookingId: hasBookingId ? bookingId : undefined, tag }
          });
        }
        return;
      }

      if (hasBookingId) {
        const seenIds = await readPushNotifiedIds();
        if (seenIds.includes(bookingId)) {
          return;
        }
        const activeWithTag = await self.registration.getNotifications({ tag });
        if (activeWithTag && activeWithTag.length > 0) {
          await markPushNotifiedId(bookingId);
          return;
        }
        await markPushNotifiedId(bookingId);
      }

      // Normal OS/browser notification using device default sound (no looping/alarm)
      await self.registration.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag,
        renotify: false,
        silent: false,
        requireInteraction: false,
        data: {
          url: targetUrl,
          bookingId: hasBookingId ? bookingId : undefined,
          bookingReference: payload.bookingReference
        }
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/driver';

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      for (const client of windowClients) {
        try {
          const parsedUrl = new URL(client.url);
          if (parsedUrl.origin === self.location.origin) {
            if (!parsedUrl.pathname.startsWith('/driver') && 'navigate' in client) {
              await client.navigate(targetUrl);
            }
            if ('focus' in client) {
              return client.focus();
            }
          }
        } catch {
          // Ignore malformed URL client entries
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })()
  );
});
