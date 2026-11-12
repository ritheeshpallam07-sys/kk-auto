import { safeGetLocal, safeSetLocal } from './storage';
import { Booking } from '../api/client';

export const KK_PUSH_CACHE = 'kk-push-notified-v1';
export const KK_PUSH_IDS_KEY = '/__kk_push_notified_ids.json';
const LOCAL_NOTIFIED_PREFIX = 'kk_notified_ride_ids_';
const MAX_STORED_IDS = 100;

export const getLocalNotifiedRideIds = (driverId: number): number[] => {
  if (!Number.isInteger(driverId) || driverId <= 0) return [];
  const raw = safeGetLocal(`${LOCAL_NOTIFIED_PREFIX}${driverId}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(Number).filter((id) => Number.isInteger(id) && id > 0)
      : [];
  } catch {
    return [];
  }
};

export const saveLocalNotifiedRideIds = (driverId: number, ids: Iterable<number>): void => {
  if (!Number.isInteger(driverId) || driverId <= 0) return;
  const normalized = Array.from(
    new Set(Array.from(ids).map(Number).filter((id) => Number.isInteger(id) && id > 0))
  ).slice(-MAX_STORED_IDS);
  safeSetLocal(`${LOCAL_NOTIFIED_PREFIX}${driverId}`, JSON.stringify(normalized));
};

export const readSwNotifiedRideIds = async (): Promise<number[]> => {
  if (typeof caches === 'undefined') return [];
  try {
    const cache = await caches.open(KK_PUSH_CACHE);
    const res = await cache.match(KK_PUSH_IDS_KEY);
    if (!res) return [];
    const parsed = await res.json();
    return Array.isArray(parsed)
      ? parsed.map(Number).filter((id) => Number.isInteger(id) && id > 0)
      : [];
  } catch {
    return [];
  }
};

export const markSwNotifiedRideId = async (bookingId: number): Promise<void> => {
  const numericId = Number(bookingId);
  if (!Number.isInteger(numericId) || numericId <= 0 || typeof caches === 'undefined') return;
  try {
    const existing = await readSwNotifiedRideIds();
    if (existing.includes(numericId)) return;
    const next = [...existing, numericId].slice(-MAX_STORED_IDS);
    const cache = await caches.open(KK_PUSH_CACHE);
    await cache.put(
      KK_PUSH_IDS_KEY,
      new Response(JSON.stringify(next), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
  } catch {
    // Ignore Cache API errors in restricted WebViews
  }
};

export const readActiveSwNotificationBookingIds = async (): Promise<number[]> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return [];
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || typeof reg.getNotifications !== 'function') return [];
    const active = await reg.getNotifications();
    const ids: number[] = [];
    for (const item of active) {
      const fromData = Number((item.data as any)?.bookingId);
      if (Number.isInteger(fromData) && fromData > 0) {
        ids.push(fromData);
        continue;
      }
      if (typeof item.tag === 'string' && item.tag.startsWith('ride-request-')) {
        const parsed = Number(item.tag.replace('ride-request-', ''));
        if (Number.isInteger(parsed) && parsed > 0) {
          ids.push(parsed);
        }
      }
    }
    return ids;
  } catch {
    return [];
  }
};

export const closeRideNotification = async (
  bookingId: number,
  inMemoryNotification?: Notification | null
): Promise<void> => {
  try {
    inMemoryNotification?.close();
  } catch {
    // Ignore close errors
  }

  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || typeof reg.getNotifications !== 'function') return;
    const tag = `ride-request-${bookingId}`;
    const active = await reg.getNotifications({ tag });
    for (const item of active) {
      item.close();
    }
  } catch {
    // Ignore SW close errors
  }
};

/**
 * Show one normal OS/browser notification using the device's default notification sound.
 * Uses the Browser Notification API when the app is open in the foreground,
 * with ServiceWorkerRegistration.showNotification fallback for mobile browsers (e.g. Android Chrome)
 * that disallow direct `new Notification()` construction.
 */
export const showForegroundRideNotification = async (
  request: Booking
): Promise<Notification | null> => {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;

  const pickupArea = (request.pickup_area_name || '').trim() || 'Pickup Area';
  const dropArea = (request.destination_area_name || '').trim() || 'Destination Area';
  const fare = Math.round(Number(request.estimated_fare || 0));
  const passengerCount = Number(request.passengers || 1);

  const title = 'New Ride Request';
  const options: NotificationOptions & { renotify?: boolean } = {
    body: `${pickupArea} → ${dropArea} • ₹${fare} (${passengerCount} ${passengerCount === 1 ? 'passenger' : 'passengers'})`,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: `ride-request-${request.id}`,
    renotify: false,
    silent: false,
    requireInteraction: false,
    data: {
      bookingId: request.id,
      bookingReference: request.booking_reference,
      url: '/driver'
    }
  };

  try {
    const instance = new Notification(title, options);
    instance.onclick = () => {
      try {
        window.focus();
        document.getElementById('incoming-requests-section')?.scrollIntoView({ behavior: 'smooth' });
        instance.close();
      } catch {
        // Ignore focus/scroll failures
      }
    };
    return instance;
  } catch {
    // Android Chrome & certain PWAs require ServiceWorkerRegistration.showNotification()
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, options);
        }
      } catch {
        // Ignore fallback notification error
      }
    }
    return null;
  }
};
