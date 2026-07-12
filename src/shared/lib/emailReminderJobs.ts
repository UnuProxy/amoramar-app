import { FieldValue, Timestamp, type DocumentReference, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { Booking } from '@/shared/lib/types';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';
import { sendBookingConfirmation, sendBookingReminder } from '@/shared/lib/email';
import { getMadridDateTime } from '@/shared/lib/utils';

type EmailReminderJob = {
  bookingId: string;
  type: 'EMAIL_CONFIRMATION' | 'EMAIL_REMINDER_24H';
  toEmail: string;
  clientName: string;
  serviceName: string;
  employeeName: string;
  bookingDate: string;
  bookingTime: string;
  hoursUntil?: number;
  duration?: number;
  price?: string;
  dueAt: Timestamp;
  status: 'queued' | 'processing' | 'sent' | 'failed';
  attempts: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastError?: string;
  sentAt?: Timestamp;
  providerMessageId?: string;
  processingStartedAt?: Timestamp;
};

const db = () => getAdminDb();
const jobDocId = (bookingId: string, type: EmailReminderJob['type']) => `${bookingId}_${type}`;
const REMINDER_SEND_CUTOFF_MINUTES = 30;
const MAX_EMAIL_JOB_ATTEMPTS = 5;
const IMMEDIATE_CONFIRMATION_ATTEMPTS = 3;
const PROCESSING_LEASE_MINUTES = 10;
const EMAIL_JOB_QUERY_LIMIT = 100;

type EmailEnqueueResult = {
  queued: boolean;
  sent?: boolean;
  skippedReason?: string;
};

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const timestampMillis = (value: unknown): number => {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof (value as any).toMillis === 'function') {
    return (value as any).toMillis();
  }
  return 0;
};

const isProcessingLeaseExpired = (
  job: Pick<EmailReminderJob, 'status' | 'processingStartedAt' | 'updatedAt'>,
  nowMillis = Date.now()
): boolean => {
  if (job.status !== 'processing') return false;
  const startedAt = timestampMillis(job.processingStartedAt) || timestampMillis(job.updatedAt);
  return startedAt === 0 || startedAt <= nowMillis - PROCESSING_LEASE_MINUTES * 60 * 1000;
};

const bookingStartAt = (booking: Pick<Booking, 'bookingDate' | 'bookingTime'>): Date | null => {
  if (!booking.bookingDate || !booking.bookingTime) return null;
  return getMadridDateTime(booking.bookingDate, booking.bookingTime);
};

const isReminderStillUseful = (
  job: Pick<EmailReminderJob, 'type' | 'bookingDate' | 'bookingTime'>,
  nowMillis = Date.now()
): boolean => {
  if (job.type !== 'EMAIL_REMINDER_24H') return true;

  const startAt = bookingStartAt(job);
  if (!startAt) return false;

  // Never send reminders after the appointment has started, and avoid sending
  // awkward last-minute emails if delayed queue processing catches up too late.
  return startAt.getTime() - nowMillis > REMINDER_SEND_CUTOFF_MINUTES * 60 * 1000;
};

const getSkipReasonForStaleReminder = async (job: EmailReminderJob): Promise<string | null> => {
  if (job.type !== 'EMAIL_REMINDER_24H') return null;

  const bookingSnap = await db().collection('bookings').doc(job.bookingId).get();
  if (!bookingSnap.exists) return 'booking_missing';

  const booking = bookingSnap.data() as Booking | undefined;
  if (!booking || booking.status === 'cancelled') return 'booking_cancelled';
  if (booking.bookingDate !== job.bookingDate || booking.bookingTime !== job.bookingTime) {
    return 'booking_schedule_changed';
  }
  if (!isReminderStillUseful(job)) return 'skipped_stale_reminder';

  return null;
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
): Promise<EmailEnqueueResult> => {
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

  const millisUntilBooking = startAt.getTime() - now.toMillis();
  let dueMillis = startAt.getTime() - 24 * 60 * 60 * 1000;
  let hoursUntil = 24;
  if (dueMillis < now.toMillis()) {
    // A booking made with less than 24 hours' notice cannot receive a literal
    // 24-hour reminder. Queue an immediate, accurately labelled reminder.
    dueMillis = now.toMillis();
    hoursUntil = Math.max(1, Math.ceil(millisUntilBooking / (60 * 60 * 1000)));
  }

  const ref = db().collection('email_notification_jobs').doc(jobDocId(booking.id, 'EMAIL_REMINDER_24H'));
  const existing = await ref.get();
  const existingData = existing.exists ? (existing.data() as EmailReminderJob | undefined) : undefined;
  const sameSchedule =
    existingData?.bookingDate === booking.bookingDate &&
    existingData?.bookingTime === booking.bookingTime;
  const activeProcessing = existingData?.status === 'processing' && !isProcessingLeaseExpired(existingData);
  if (
    sameSchedule &&
    (existingData?.status === 'queued' || activeProcessing || existingData?.status === 'sent')
  ) {
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
      hoursUntil,
      dueAt: Timestamp.fromMillis(dueMillis),
      status: 'queued',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      processingStartedAt: FieldValue.delete(),
      sentAt: FieldValue.delete(),
      providerMessageId: FieldValue.delete(),
      lastError: FieldValue.delete(),
    },
    { merge: true }
  );

  return { queued: true };
};

export const enqueueEmailConfirmationForBooking = async (
  booking: Pick<
    Booking,
    | 'id'
    | 'clientName'
    | 'clientEmail'
    | 'serviceName'
    | 'bookingDate'
    | 'bookingTime'
    | 'status'
  > & {
    employeeName: string;
    duration: number;
    price: string;
  }
): Promise<EmailEnqueueResult> => {
  if (booking.status === 'cancelled') {
    return { queued: false, skippedReason: 'status_cancelled' };
  }

  const toEmail = booking.clientEmail?.trim();
  if (!toEmail) {
    return { queued: false, skippedReason: 'missing_client_email' };
  }

  const now = Timestamp.now();
  const ref = db().collection('email_notification_jobs').doc(jobDocId(booking.id, 'EMAIL_CONFIRMATION'));
  const existing = await ref.get();
  const existingData = existing.exists ? (existing.data() as EmailReminderJob | undefined) : undefined;
  if (existingData?.status === 'sent') {
    return { queued: false, sent: true, skippedReason: 'already_sent' };
  }
  if (existingData?.status === 'processing' && !isProcessingLeaseExpired(existingData)) {
    return { queued: true, sent: false, skippedReason: 'already_processing' };
  }

  await ref.set(
    {
      bookingId: booking.id,
      type: 'EMAIL_CONFIRMATION',
      toEmail,
      clientName: booking.clientName || 'Cliente',
      serviceName: booking.serviceName || 'Servicio',
      employeeName: booking.employeeName || 'Amor Amar',
      bookingDate: booking.bookingDate,
      bookingTime: booking.bookingTime,
      duration: booking.duration,
      price: booking.price,
      dueAt: now,
      status: 'queued',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      processingStartedAt: FieldValue.delete(),
      sentAt: FieldValue.delete(),
      providerMessageId: FieldValue.delete(),
      lastError: FieldValue.delete(),
    },
    { merge: true }
  );

  let processResult: Awaited<ReturnType<typeof processEmailReminderJobRef>> = 'skipped';
  for (let attempt = 0; attempt < IMMEDIATE_CONFIRMATION_ATTEMPTS; attempt += 1) {
    processResult = await processEmailReminderJobRef(ref);
    if (processResult === 'sent') {
      return { queued: false, sent: true };
    }
    if (processResult !== 'retrying') break;
    if (attempt < IMMEDIATE_CONFIRMATION_ATTEMPTS - 1) {
      await sleep(400 * (attempt + 1));
    }
  }

  if (processResult === 'failed') {
    return { queued: false, sent: false, skippedReason: 'send_failed' };
  }

  return {
    queued: processResult === 'retrying' || processResult === 'skipped',
    sent: false,
    skippedReason: processResult === 'retrying' ? 'retry_queued' : 'send_not_completed',
  };
};

export const refreshQueuedEmailReminderForBooking = async (
  booking: Pick<Booking, 'id' | 'bookingDate' | 'bookingTime' | 'status'>
): Promise<{ refreshed: boolean; skippedReason?: string }> => {
  const ref = db().collection('email_notification_jobs').doc(jobDocId(booking.id, 'EMAIL_REMINDER_24H'));
  const snap = await ref.get();
  if (!snap.exists) {
    return { refreshed: false, skippedReason: 'missing_job' };
  }

  const data = snap.data() as EmailReminderJob | undefined;
  if (!data) {
    return { refreshed: false, skippedReason: 'missing_job_data' };
  }
  const scheduleChanged =
    data.bookingDate !== booking.bookingDate ||
    data.bookingTime !== booking.bookingTime;
  if (
    (data.status === 'sent' && !scheduleChanged) ||
    (data.status === 'processing' && !isProcessingLeaseExpired(data)) ||
    (data.status !== 'queued' &&
      data.status !== 'failed' &&
      data.status !== 'sent' &&
      data.status !== 'processing')
  ) {
    return { refreshed: false, skippedReason: 'already_handled' };
  }

  if (booking.status === 'cancelled') {
    await ref.set(
      {
        status: 'failed',
        updatedAt: Timestamp.now(),
        lastError: 'skipped_cancelled_booking',
      },
      { merge: true }
    );
    return { refreshed: false, skippedReason: 'status_cancelled' };
  }

  const startAt = bookingStartAt(booking);
  if (!startAt) {
    await ref.set(
      {
        status: 'failed',
        updatedAt: Timestamp.now(),
        lastError: 'invalid_datetime',
      },
      { merge: true }
    );
    return { refreshed: false, skippedReason: 'invalid_datetime' };
  }

  const now = Timestamp.now();
  if (startAt.getTime() <= now.toMillis()) {
    await ref.set(
      {
        status: 'failed',
        updatedAt: now,
        lastError: 'booking_in_past',
      },
      { merge: true }
    );
    return { refreshed: false, skippedReason: 'booking_in_past' };
  }

  const millisUntilBooking = startAt.getTime() - now.toMillis();
  let dueMillis = startAt.getTime() - 24 * 60 * 60 * 1000;
  let hoursUntil = 24;
  if (dueMillis < now.toMillis()) {
    dueMillis = now.toMillis();
    hoursUntil = Math.max(1, Math.ceil(millisUntilBooking / (60 * 60 * 1000)));
  }

  await ref.set(
    {
      bookingDate: booking.bookingDate,
      bookingTime: booking.bookingTime,
      hoursUntil,
      dueAt: Timestamp.fromMillis(dueMillis),
      status: 'queued',
      attempts: 0,
      updatedAt: now,
      lastError: FieldValue.delete(),
      processingStartedAt: FieldValue.delete(),
      sentAt: FieldValue.delete(),
      providerMessageId: FieldValue.delete(),
    },
    { merge: true }
  );

  return { refreshed: true };
};

const processEmailReminderJobRef = async (
  ref: DocumentReference
): Promise<'sent' | 'failed' | 'retrying' | 'skipped'> => {
  const claimed = await db().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) return null;

    const data = snap.data() as EmailReminderJob;
    if (data.status !== 'queued') return null;

    transaction.update(ref, {
      status: 'processing',
      attempts: FieldValue.increment(1),
      processingStartedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return data;
  });

  if (!claimed) return 'skipped';

  const staleReminderReason = await getSkipReasonForStaleReminder(claimed);
  if (staleReminderReason) {
    await ref.set(
      {
        status: 'failed',
        updatedAt: Timestamp.now(),
        lastError: staleReminderReason,
        processingStartedAt: FieldValue.delete(),
      },
      { merge: true }
    );
    return 'skipped';
  }

  try {
    const result =
      claimed.type === 'EMAIL_CONFIRMATION'
        ? await sendBookingConfirmation({
            clientName: claimed.clientName,
            clientEmail: claimed.toEmail,
            serviceName: claimed.serviceName,
            employeeName: claimed.employeeName,
            bookingDate: claimed.bookingDate,
            bookingTime: claimed.bookingTime,
            duration: claimed.duration || 0,
            price: claimed.price || '0',
            idempotencyKey: `booking-confirmation/${claimed.bookingId}`,
          })
        : await sendBookingReminder({
            clientName: claimed.clientName,
            clientEmail: claimed.toEmail,
            serviceName: claimed.serviceName,
            employeeName: claimed.employeeName,
            bookingDate: claimed.bookingDate,
            bookingTime: claimed.bookingTime,
            hoursUntil: claimed.hoursUntil || 24,
            idempotencyKey: `booking-reminder-24h/${claimed.bookingId}/${claimed.bookingDate}/${claimed.bookingTime}`,
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
        processingStartedAt: FieldValue.delete(),
        ...(result.id && { providerMessageId: result.id }),
      },
      { merge: true }
    );

    return 'sent';
  } catch (error: any) {
    const attempts = (claimed.attempts || 0) + 1;
    const finalStatus: EmailReminderJob['status'] = attempts >= MAX_EMAIL_JOB_ATTEMPTS ? 'failed' : 'queued';
    await ref.set(
      {
        status: finalStatus,
        attempts,
        updatedAt: Timestamp.now(),
        lastError: String(error?.message || error),
        processingStartedAt: FieldValue.delete(),
      },
      { merge: true }
    );

    return finalStatus === 'failed' ? 'failed' : 'retrying';
  }
};

const recoverStaleProcessingJobs = async (): Promise<number> => {
  const snap = await db()
    .collection('email_notification_jobs')
    .where('status', '==', 'processing')
    .limit(EMAIL_JOB_QUERY_LIMIT)
    .get();
  const now = Timestamp.now();
  const staleDocs = snap.docs.filter((doc) =>
    isProcessingLeaseExpired(doc.data() as EmailReminderJob, now.toMillis())
  );

  if (staleDocs.length === 0) return 0;

  const batch = db().batch();
  staleDocs.forEach((doc) => {
    const job = doc.data() as EmailReminderJob;
    batch.update(doc.ref, {
      status: (job.attempts || 0) >= MAX_EMAIL_JOB_ATTEMPTS ? 'failed' : 'queued',
      processingStartedAt: FieldValue.delete(),
      updatedAt: now,
      lastError: 'recovered_expired_processing_lease',
    });
  });
  await batch.commit();
  return staleDocs.length;
};

export const processDueEmailReminderJobs = async (
  limit = EMAIL_JOB_QUERY_LIMIT
): Promise<{ processed: number; sent: number; failed: number; recovered: number }> => {
  const recovered = await recoverStaleProcessingJobs();
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
      .limit(Math.max(limit * 5, 500))
      .get();
    docs = fallbackSnap.docs
      .filter((doc) => {
        const data = doc.data() as EmailReminderJob;
        return data.dueAt?.toMillis?.() <= now.toMillis() && isReminderStillUseful(data, now.toMillis());
      })
      .sort((a, b) => {
        const aDue = (a.data() as EmailReminderJob).dueAt?.toMillis?.() || 0;
        const bDue = (b.data() as EmailReminderJob).dueAt?.toMillis?.() || 0;
        return aDue - bDue;
      })
      .slice(0, limit);
  }

  let sent = 0;
  let failed = 0;

  for (const doc of docs) {
    const result = await processEmailReminderJobRef(doc.ref);
    if (result === 'sent') sent++;
    if (result === 'failed') failed++;
  }

  return { processed: docs.length, sent, failed, recovered };
};
