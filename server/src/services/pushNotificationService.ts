import webpush from 'web-push';
import { query } from '../config/db';

let configuredVapidSignature = '';

const getVapidConfig = () => {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (process.env.VAPID_SUBJECT || '').trim();
  return { publicKey, privateKey, subject };
};

export const isPushConfigured = (): boolean => {
  const { publicKey, privateKey, subject } = getVapidConfig();
  return Boolean(publicKey && privateKey && subject);
};

const ensureVapidConfigured = (): boolean => {
  const { publicKey, privateKey, subject } = getVapidConfig();
  if (!publicKey || !privateKey || !subject) {
    return false;
  }
  const sig = `${subject}|${publicKey}`;
  if (configuredVapidSignature !== sig) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configuredVapidSignature = sig;
  }
  return true;
};

if (!isPushConfigured()) {
  console.warn(
    '[Push] VAPID environment variables are missing. Push notifications are disabled.'
  );
} else {
  ensureVapidConfigured();
}

export interface PushSubscriptionData {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NewRidePushPayload {
  title: string;
  body: string;
  bookingId?: number;
  bookingReference?: string;
  tag?: string;
  url?: string;
}

export interface NewRideBookingSummary {
  id: number;
  booking_reference: string;
  pickup_area_name?: string | null;
  destination_area_name?: string | null;
  estimated_fare: number | string;
  passengers?: number | null;
}

export const sendPushNotification = async (
  subscription: PushSubscriptionData,
  payload: NewRidePushPayload
) => {
  if (!ensureVapidConfigured()) {
    throw new Error('VAPID environment variables are not configured.');
  }

  await webpush.sendNotification(subscription, JSON.stringify(payload));
};

/**
 * Send one normal Web Push notification per subscribed eligible driver when a new ride request is created.
 * - Targets only APPROVED/ACTIVE, online ('available'), non-deletion-pending drivers.
 * - Excludes exact street addresses and customer PII (only area names & fare).
 * - Cleans up expired (404/410) push subscriptions automatically.
 * - Never throws or blocks booking creation.
 */
export const notifyAvailableDriversOfNewRide = async (
  booking: NewRideBookingSummary,
  options?: {
    sendFn?: (sub: PushSubscriptionData, payload: NewRidePushPayload) => Promise<void>;
  }
): Promise<{ targeted: number; sent: number; cleaned: number; skipped: boolean }> => {
  const sendFn = options?.sendFn;
  if (!sendFn && !ensureVapidConfigured()) {
    return { targeted: 0, sent: 0, cleaned: 0, skipped: true };
  }

  const subRes = await query<{ endpoint: string; p256dh: string; auth: string }>(
    `SELECT s.endpoint, s.p256dh, s.auth
     FROM driver_push_subscriptions s
     JOIN drivers d ON s.driver_id = d.id
     JOIN users u ON d.user_id = u.id
     WHERE UPPER(d.approval_status) IN ('APPROVED', 'ACTIVE')
       AND d.availability_status = 'available'
       AND u.deletion_requested_at IS NULL`
  );

  if (subRes.rows.length === 0) {
    return { targeted: 0, sent: 0, cleaned: 0, skipped: false };
  }

  const pickupArea = (booking.pickup_area_name || '').trim() || 'Pickup Area';
  const dropArea = (booking.destination_area_name || '').trim() || 'Destination Area';
  const fare = Math.round(Number(booking.estimated_fare || 0));
  const passengerCount = Number(booking.passengers || 1);
  const payload: NewRidePushPayload = {
    title: 'New Ride Request',
    body: `${pickupArea} → ${dropArea} • ₹${fare} (${passengerCount} ${passengerCount === 1 ? 'passenger' : 'passengers'})`,
    bookingId: booking.id,
    bookingReference: booking.booking_reference,
    tag: `ride-request-${booking.id}`,
    url: '/driver'
  };

  let sent = 0;
  let cleaned = 0;
  const sender = sendFn || sendPushNotification;

  await Promise.all(
    subRes.rows.map(async (row) => {
      try {
        await sender(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth }
          },
          payload
        );
        sent += 1;
      } catch (err: any) {
        const statusCode = Number(err?.statusCode);
        if (statusCode === 404 || statusCode === 410) {
          cleaned += 1;
          await query(`DELETE FROM driver_push_subscriptions WHERE endpoint = $1`, [row.endpoint]).catch(
            () => {}
          );
        }
      }
    })
  );

  return { targeted: subRes.rows.length, sent, cleaned, skipped: false };
};
