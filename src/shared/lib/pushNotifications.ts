import webpush from 'web-push';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';
import { formatDate } from '@/shared/lib/utils';
import type { Booking } from '@/shared/lib/types';

type PushSubscriptionJson = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type StoredPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  userRole?: string;
  language?: 'en' | 'es';
  isActive?: boolean;
};

type AdminBookingPushInput = {
  booking: Pick<
    Booking,
    'id' | 'clientName' | 'bookingDate' | 'bookingTime' | 'createdByRole' | 'createdByName'
  >;
  serviceName: string;
  employeeName: string;
};

const getVapidConfig = () => {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:info@amoramarbeauty.com';

  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
};

const configureWebPush = (): boolean => {
  const config = getVapidConfig();
  if (!config) return false;

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return true;
};

export const getVapidPublicKey = (): string | null => {
  return getVapidConfig()?.publicKey || null;
};

const toWebPushSubscription = (subscription: StoredPushSubscription): PushSubscriptionJson => ({
  endpoint: subscription.endpoint,
  keys: subscription.keys,
});

const getPushTargetSubscriptions = async (): Promise<Array<{ id: string; data: StoredPushSubscription }>> => {
  const snap = await getAdminDb()
    .collection('push_subscriptions')
    .where('userRole', '==', 'owner')
    .get();

  return snap.docs
    .map((doc) => ({ id: doc.id, data: doc.data() as StoredPushSubscription }))
    .filter((item) => item.data.isActive !== false && item.data.endpoint && item.data.keys?.auth && item.data.keys?.p256dh);
};

export const savePushSubscription = async ({
  subscription,
  userId,
  userRole,
  userEmail,
  language,
}: {
  subscription: PushSubscriptionJson;
  userId: string;
  userRole: string;
  userEmail?: string;
  language?: 'en' | 'es';
}): Promise<void> => {
  const endpointHash = Buffer.from(subscription.endpoint).toString('base64url');
  await getAdminDb()
    .collection('push_subscriptions')
    .doc(endpointHash)
    .set(
      {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime || null,
        keys: subscription.keys,
        userId,
        userRole,
        userEmail: userEmail || null,
        language: language || 'en',
        isActive: true,
        updatedAt: Timestamp.now(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
};

export const sendAdminBookingCreatedPush = async ({
  booking,
  serviceName,
  employeeName,
}: AdminBookingPushInput): Promise<{ attempted: number; sent: number; failed: number; skippedReason?: string }> => {
  if (!configureWebPush()) {
    return { attempted: 0, sent: 0, failed: 0, skippedReason: 'missing_vapid_config' };
  }

  const subscriptions = await getPushTargetSubscriptions();
  if (subscriptions.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, skippedReason: 'no_subscriptions' };
  }

  const getPayloadForLanguage = (language: StoredPushSubscription['language']) => {
    const isSpanish = language === 'es';
    const source = booking.createdByRole === 'employee'
      ? `${isSpanish ? 'Empleado' : 'Employee'}${booking.createdByName ? `: ${booking.createdByName}` : ''}`
      : (isSpanish ? 'Web' : 'Website');

    return JSON.stringify({
      title: isSpanish ? 'Nueva reserva' : 'New booking',
      body: `${booking.clientName || (isSpanish ? 'Cliente' : 'Client')} - ${formatDate(booking.bookingDate)} ${booking.bookingTime}`,
      icon: '/icons/Logo-black.png',
      badge: '/icons/Logo-black.png',
      tag: `booking-${booking.id}`,
      data: {
        bookingId: booking.id,
        url: `/dashboard/bookings/${booking.id}`,
        source,
        serviceName,
        employeeName,
      },
    });
  };

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async ({ id, data }) => {
      try {
        await webpush.sendNotification(toWebPushSubscription(data), getPayloadForLanguage(data.language));
        sent += 1;
      } catch (error: any) {
        failed += 1;
        const statusCode = Number(error?.statusCode || error?.status);
        if (statusCode === 404 || statusCode === 410) {
          await getAdminDb().collection('push_subscriptions').doc(id).set(
            {
              isActive: false,
              disabledAt: Timestamp.now(),
              lastError: String(error?.message || error),
              updatedAt: Timestamp.now(),
            },
            { merge: true }
          );
        } else {
          console.error('[push] failed to send booking notification:', String(error?.message || error));
        }
      }
    })
  );

  return { attempted: subscriptions.length, sent, failed };
};
