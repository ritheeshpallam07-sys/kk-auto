import webpush from 'web-push';

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

if (!publicKey || !privateKey || !subject) {
  console.warn(
    '[Push] VAPID environment variables are missing. Push notifications are disabled.'
  );
} else {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export interface PushSubscriptionData {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export const sendPushNotification = async (
  subscription: PushSubscriptionData,
  payload: {
    title: string;
    body: string;
    bookingId?: number;
  }
) => {
  if (!publicKey || !privateKey || !subject) {
    throw new Error('VAPID environment variables are not configured.');
  }

  await webpush.sendNotification(
    subscription,
    JSON.stringify(payload)
  );
};