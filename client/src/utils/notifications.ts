import { safeGetLocal, safeSetLocal, safeRemoveLocal } from './storage';
import { api, Booking } from '../api/client';

export const ONBOARDING_DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const ONBOARDING_DISMISSED_KEY_PREFIX = 'kk_notif_onboarding_dismissed_at';

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

export const isPushNotificationsSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window;

const getOnboardingDismissKey = (userId?: number | null): string =>
  userId && Number.isInteger(userId) && userId > 0
    ? `${ONBOARDING_DISMISSED_KEY_PREFIX}_${userId}`
    : ONBOARDING_DISMISSED_KEY_PREFIX;

/**
 * Returns true when the driver dismissed onboarding within the last 24 hours.
 * Malformed, negative, expired, or clock-skewed values are cleared safely.
 */
export const isNotificationOnboardingDismissed = (
  userId?: number | null,
  nowMs: number = Date.now()
): boolean => {
  const key = getOnboardingDismissKey(userId);
  const raw = safeGetLocal(key);
  if (!raw || !raw.trim()) return false;

  const dismissedAt = Number(raw);
  if (
    !Number.isFinite(dismissedAt) ||
    dismissedAt <= 0 ||
    dismissedAt > nowMs + ONBOARDING_DISMISS_COOLDOWN_MS
  ) {
    safeRemoveLocal(key);
    return false;
  }

  if (nowMs - dismissedAt >= ONBOARDING_DISMISS_COOLDOWN_MS) {
    safeRemoveLocal(key);
    return false;
  }

  return true;
};

export const dismissNotificationOnboarding = (
  userId?: number | null,
  nowMs: number = Date.now()
): void => {
  if (!Number.isFinite(nowMs) || nowMs <= 0) return;
  safeSetLocal(getOnboardingDismissKey(userId), String(nowMs));
};

export const clearNotificationOnboardingDismissal = (userId?: number | null): void => {
  safeRemoveLocal(getOnboardingDismissKey(userId));
};

export const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

/**
 * Reuses an active service worker registration when present, or falls back
 * to registering `/sw.js` / awaiting `navigator.serviceWorker.ready`.
 */
export const ensurePushServiceWorkerRegistration = async (): Promise<
  ServiceWorkerRegistration | undefined
> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return undefined;
  }

  let registration = await navigator.serviceWorker.getRegistration();
  if (!registration && typeof navigator.serviceWorker.register === 'function') {
    try {
      registration = await navigator.serviceWorker.register('/sw.js');
    } catch {
      // Fall back to waiting for ready registration below
    }
  }

  if (!registration && navigator.serviceWorker.ready) {
    registration = await Promise.race<ServiceWorkerRegistration | undefined>([
      navigator.serviceWorker.ready,
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 4000))
    ]);
  }

  return registration;
};

export type EnsurePushSubscriptionResult =
  | { ok: true; reusedSubscription: boolean; subscription: PushSubscription }
  | {
      ok: false;
      reason:
        | 'unsupported'
        | 'permission_not_granted'
        | 'missing_vapid_key'
        | 'no_service_worker'
        | 'incomplete_subscription'
        | 'server_error'
        | 'unknown';
      error: string;
    };

/**
 * Ensures the driver has an active Web Push subscription saved on the backend
 * once Notification permission is granted. Never calls Notification.requestPermission().
 */
export const ensureDriverPushSubscription = async (options?: {
  showPreview?: boolean;
}): Promise<EnsurePushSubscriptionResult> => {
  if (!isPushNotificationsSupported()) {
    return {
      ok: false,
      reason: 'unsupported',
      error: 'Push notifications are not supported on this browser/device.'
    };
  }

  if (Notification.permission !== 'granted') {
    return {
      ok: false,
      reason: 'permission_not_granted',
      error: 'Notification permission is not granted.'
    };
  }

  try {
    const registration = await ensurePushServiceWorkerRegistration();
    if (!registration) {
      return {
        ok: false,
        reason: 'no_service_worker',
        error: 'Background service worker is not ready yet. Please refresh the page and try again.'
      };
    }

    let subscription = await registration.pushManager.getSubscription();
    const reusedSubscription = Boolean(subscription);

    if (!subscription) {
      const vapidRes = await api.driver.getPushPublicKey();
      const vapidPublicKey = vapidRes.data?.publicKey;
      if (!vapidPublicKey) {
        return {
          ok: false,
          reason: 'missing_vapid_key',
          error: 'Push alerts are unavailable because the notification server key is missing.'
        };
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource
      });
    }

    const rawSub = subscription.toJSON();
    if (!rawSub.endpoint || !rawSub.keys?.p256dh || !rawSub.keys?.auth) {
      return {
        ok: false,
        reason: 'incomplete_subscription',
        error: 'Incomplete push subscription payload returned by browser.'
      };
    }

    const saveRes = await api.driver.savePushSubscription({
      endpoint: rawSub.endpoint,
      expirationTime: rawSub.expirationTime,
      keys: {
        p256dh: rawSub.keys.p256dh,
        auth: rawSub.keys.auth
      }
    });

    if (!saveRes.success) {
      return {
        ok: false,
        reason: 'server_error',
        error: saveRes.error || 'Failed to save push subscription on server.'
      };
    }

    if (options?.showPreview) {
      try {
        await registration.showNotification('Clik2Go Driver Console', {
          body: 'Push alerts are now enabled for incoming ride bookings.',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          silent: false
        });
      } catch {
        // Subscription saved even if immediate preview notification fails
      }
    }

    return { ok: true, reusedSubscription, subscription };
  } catch (error: any) {
    return {
      ok: false,
      reason: 'unknown',
      error: error?.message || 'Unable to enable push notifications.'
    };
  }
};
