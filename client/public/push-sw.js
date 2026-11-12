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

function resolveSameOriginUrl(rawUrl, fallbackPath = '/driver') {
  const origin = self.location?.origin || '';
  const fallback = origin ? new URL(fallbackPath, origin).href : fallbackPath;
  if (!rawUrl || typeof rawUrl !== 'string') {
    return fallback;
  }
  try {
    const resolved = origin ? new URL(rawUrl, origin) : new URL(rawUrl);
    if (!origin || resolved.origin === origin) {
      return resolved.href;
    }
    return fallback;
  } catch {
    return fallback;
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
  const targetUrl = resolveSameOriginUrl(payload.url, '/driver');

  event.waitUntil(
    (async () => {
      let windowClients = [];
      try {
        windowClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });
      } catch {
        windowClients = [];
      }

      const visibleDriverClients = windowClients.filter((client) => {
        try {
          const parsedUrl = new URL(client.url);
          return parsedUrl.pathname.startsWith('/driver') && client.visibilityState === 'visible';
        } catch {
          return false;
        }
      });

      // When Driver Dashboard is actively visible in the foreground, let the open app
      // handle showing the single browser Notification via ServiceWorkerRegistration without duplicate alerts.
      if (visibleDriverClients.length > 0) {
        for (const client of visibleDriverClients) {
          try {
            client.postMessage({
              type: 'KK_NEW_RIDE_PUSH',
              payload: { ...payload, bookingId: hasBookingId ? bookingId : undefined, tag, url: targetUrl }
            });
          } catch {
            // Ignore disconnected client errors
          }
        }
        return;
      }

      if (hasBookingId) {
        const seenIds = await readPushNotifiedIds();
        if (seenIds.includes(bookingId)) {
          return;
        }
        try {
          const activeWithTag = await self.registration.getNotifications({ tag });
          if (activeWithTag && activeWithTag.length > 0) {
            await markPushNotifiedId(bookingId);
            return;
          }
        } catch {
          // Ignore getNotifications failures
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
  try {
    event.notification?.close();
  } catch {
    // Ignore close errors
  }

  const notificationData = (event.notification && event.notification.data) || {};
  const targetUrl = resolveSameOriginUrl(notificationData.url, '/driver');
  const bookingId = Number(notificationData.bookingId);
  const hasBookingId = Number.isInteger(bookingId) && bookingId > 0;
  const selfOrigin = self.location?.origin || '';

  event.waitUntil(
    (async () => {
      let windowClients = [];
      try {
        windowClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });
      } catch {
        windowClients = [];
      }

      const candidates = [];
      for (const client of windowClients) {
        try {
          const parsedUrl = new URL(client.url);
          if (!selfOrigin || parsedUrl.origin === selfOrigin) {
            candidates.push({
              client,
              isDriver: parsedUrl.pathname.startsWith('/driver'),
              isFocused: Boolean(client.focused),
              isVisible: client.visibilityState === 'visible'
            });
          }
        } catch {
          // Ignore malformed URL client entries
        }
      }

      // Prefer tabs already on /driver first, then focused/visible same-origin tabs
      candidates.sort((a, b) => {
        if (a.isDriver !== b.isDriver) return a.isDriver ? -1 : 1;
        if (a.isFocused !== b.isFocused) return a.isFocused ? -1 : 1;
        if (a.isVisible !== b.isVisible) return a.isVisible ? -1 : 1;
        return 0;
      });

      for (const candidate of candidates) {
        const { client, isDriver } = candidate;
        try {
          if (isDriver) {
            let activeClient = client;
            if (typeof client.focus === 'function') {
              activeClient = (await client.focus()) || client;
            }
            try {
              activeClient.postMessage?.({
                type: 'KK_NOTIFICATION_CLICKED',
                url: targetUrl,
                bookingId: hasBookingId ? bookingId : undefined
              });
            } catch {
              // Ignore postMessage failures
            }
            return activeClient;
          }

          if (typeof client.navigate === 'function') {
            const navigatedClient = await client.navigate(targetUrl);
            const activeClient = navigatedClient || client;
            if (typeof activeClient.focus === 'function') {
              try {
                await activeClient.focus();
              } catch {
                // Tab is already navigated to /driver; avoid opening a duplicate window
              }
            }
            try {
              activeClient.postMessage?.({
                type: 'KK_NOTIFICATION_CLICKED',
                url: targetUrl,
                bookingId: hasBookingId ? bookingId : undefined
              });
            } catch {
              // Ignore postMessage failures
            }
            return activeClient;
          }
        } catch {
          // Try next matching client or fall back to openWindow
        }
      }

      if (self.clients && typeof self.clients.openWindow === 'function') {
        try {
          return await self.clients.openWindow(targetUrl);
        } catch {
          return undefined;
        }
      }
      return undefined;
    })()
  );
});
