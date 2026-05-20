import { FieldValue, Timestamp, type DocumentReference, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { Booking } from '@/shared/lib/types';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';
import { sendBookingReminder } from '@/shared/lib/email';

type EmailReminderJob = {
  bookingId: string;
  type: 'EMAIL_REMINDER_24H';
  toEmail: string;
  clientName: string;
  serviceName: string;
  employeeName: string;
  bookingDate: string;
  bookingTime: string;
  hoursUntil: number;
  dueAt: Timestamp;
  status: 'queued' | 'processing' | 'sent' | 'failed';
  attempts: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastError?: string;
  sentAt?: Timestamp;
  providerMessageId?: string;
};

const db = () => getAdminDb();
const jobDocId = (bookingId: string) => `${bookingId}_EMAIL_REMINDER_24H`;

const bookingStartAt = (booking: Pick<Booking, 'bookingDate' | 'bookingTime'>): Date | null => {
  if (!booking.bookingDate || !booking.bookingTime) return null;
  const candidate = new Date(`${booking.bookingDate}T${booking.bookingTime}:00`);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
};

export const enqueueEmailReminderForBooking = async (
  booking: Pick<
    Booking,
    | 'id'
    | 'clientName'
    | 'clientEmail'
    | 'serviceName'
    | 'bookingDate'
    | 'bookingTime'
    | 'status'
  > & { employeeName: string }
): Promise<{ queued: boolean; skippedReason?: string }> => {
  if (booking.status === 'cancelled') {
    return { queued: false, skippedReason: 'status_cancelled' };
  }

  const toEmail = booking.clientEmail?.trim();
  if (!toEmail) {
    return { queued: false, skippedReason: 'missing_client_email' };
  }

  const startAt = bookingStartAt(booking);
  if (!startAt) {
    return { queued: false, skippedReason: 'invalid_datetime' };
  }

  const now = Timestamp.now();
  if (startAt.getTime() <= now.toMillis()) {
    return { queued: false, skippedReason: 'booking_in_past' };
  }

  let dueMillis = startAt.getTime() - 24 * 60 * 60 * 1000;
  if (dueMillis < now.toMillis()) {
    dueMillis = now.toMillis() + 60 * 1000;
  }

  const ref = db().collection('email_notification_jobs').doc(jobDocId(booking.id));
  const existing = await ref.get();
  const status = existing.exists ? (existing.data() as EmailReminderJob | undefined)?.status : undefined;
  if (status === 'queued' || status === 'processing' || status === 'sent') {
    return { queued: false, skippedReason: 'already_handled' };
  }

  await ref.set(
    {
      bookingId: booking.id,
      type: 'EMAIL_REMINDER_24H',
      toEmail,
      clientName: booking.clientName || 'Cliente',
      serviceName: booking.serviceName || 'Servicio',
      employeeName: booking.employeeName || 'Amor Amar',
      bookingDate: booking.bookingDate,
      bookingTime: booking.bookingTime,
      hoursUntil: 24,
      dueAt: Timestamp.fromMillis(dueMillis),
      status: 'queued',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    } satisfies EmailReminderJob,
    { merge: true }
  );

  return { queued: true };
};

const processEmailReminderJobRef = async (
  ref: DocumentReference
): Promise<'sent' | 'failed' | 'skipped'> => {
  const claimed = await db().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) return null;

    const data = snap.data() as EmailReminderJob;
    if (data.status !== 'queued') return null;

    transaction.update(ref, {
      status: 'processing',
      attempts: FieldValue.increment(1),
      updatedAt: Timestamp.now(),
    });

    return data;
  });

  if (!claimed) return 'skipped';

  try {
    const result = await sendBookingReminder({
      clientName: claimed.clientName,
      clientEmail: claimed.toEmail,
      serviceName: claimed.serviceName,
      employeeName: claimed.employeeName,
      bookingDate: claimed.bookingDate,
      bookingTime: claimed.bookingTime,
      hoursUntil: claimed.hoursUntil,
    });

    if (!result.success) {
      throw new Error(result.error || 'Email reminder failed');
    }

    await ref.set(
      {
        status: 'sent',
        sentAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastError: FieldValue.delete(),
      },
      { merge: true }
    );

    return 'sent';
  } catch (error: any) {
    await ref.set(
      {
        status: 'failed',
        updatedAt: Timestamp.now(),
        lastError: String(error?.message || error),
      },
      { merge: true }
    );

    return 'failed';
  }
};

export const processDueEmailReminderJobs = async (
  limit = 25
): Promise<{ processed: number; sent: number; failed: number }> => {
  const now = Timestamp.now();
  let docs: QueryDocumentSnapshot[] = [];

  try {
    const snap = await db()
      .collection('email_notification_jobs')
      .where('status', '==', 'queued')
      .where('dueAt', '<=', now)
      .orderBy('dueAt', 'asc')
      .limit(limit)
      .get();
    docs = snap.docs;
  } catch (error) {
    const message = String((error as any)?.message || error || '');
    if (!message.includes('FAILED_PRECONDITION') || !message.includes('requires an index')) {
      throw error;
    }

    const fallbackSnap = await db()
      .collection('email_notification_jobs')
      .where('status', '==', 'queued')
      .limit(limit)
      .get();
    docs = fallbackSnap.docs
      .filter((doc) => {
        const data = doc.data() as EmailReminderJob;
        return data.dueAt?.toMillis?.() <= now.toMillis();
      })
      .sort((a, b) => {
        const aDue = (a.data() as EmailReminderJob).dueAt?.toMillis?.() || 0;
        const bDue = (b.data() as EmailReminderJob).dueAt?.toMillis?.() || 0;
        return aDue - bDue;
      });
  }

  let sent = 0;
  let failed = 0;

  for (const doc of docs) {
    const result = await processEmailReminderJobRef(doc.ref);
    if (result === 'sent') sent++;
    if (result === 'failed') failed++;
  }

  return { processed: docs.length, sent, failed };
};
