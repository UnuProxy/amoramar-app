import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import type { Booking } from '@/shared/lib/types';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';
import { getMadridDateTime } from '@/shared/lib/utils';

export type WhatsAppJobType = 'WHATSAPP_CONFIRMATION' | 'WHATSAPP_REMINDER_24H';
export type WhatsAppEnqueueResult = {
  queued: boolean;
  skippedReason?: string;
};

type JobDoc = {
  bookingId: string;
  type: WhatsAppJobType;
  toPhoneE164: string;
  templateName: 'booking_confirmed_new' | 'booking_reminder_24h' | (string & {});
  lang: string;
  vars: Record<string, string>;
  bookingDate?: string;
  bookingTime?: string;
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

const jobDocId = (bookingId: string, type: WhatsAppJobType) => `${bookingId}_${type}`;

/**
 * WhatsApp Cloud API requires `to` as international digits only — no "+", spaces, or punctuation.
 * Accepts values like "+34 692 688 348", "+34692688348", "34692688348".
 * Stored on jobs as digits-only; length must fit E.164 (7–15 digits).
 */
const normalizeWhatsAppRecipientDigits = (phone?: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return '';
  return digits;
};

const bookingStartAt = (booking: Pick<Booking, 'bookingDate' | 'bookingTime'>): Date | null => {
  if (!booking.bookingDate || !booking.bookingTime) return null;
  return getMadridDateTime(booking.bookingDate, booking.bookingTime);
};

const getLocationLabel = (): string => process.env.WHATSAPP_LOCATION_LABEL || 'Amor Amar';

const formatTemplateDate = (date?: string): string => {
  if (!date) return '';
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
};

const buildVars = (booking: Booking): Record<string, string> => ({
  client_name: booking.clientName || '',
  date: formatTemplateDate(booking.bookingDate),
  time: booking.bookingTime || '',
  location: getLocationLabel(),
});

const normalizeTemplateLang = (lang?: string): string => {
  const raw = (lang || '').trim();
  if (!raw) return 'en_US';
  // Keep configured locale as-is (e.g. "en"), and rely on fallback retry logic below.
  return raw;
};

const getLanguageCode = (): string => normalizeTemplateLang(process.env.WHATSAPP_TEMPLATE_LANG);

const buildLanguageFallbacks = (lang: string): string[] => {
  const primary = normalizeTemplateLang(lang);
  const out: string[] = [];
  const pushUnique = (v?: string) => {
    if (!v) return;
    if (!out.includes(v)) out.push(v);
  };

  pushUnique(primary);
  const lower = primary.toLowerCase();
  if (lower === 'en_us') pushUnique('en');
  if (lower === 'es_es') pushUnique('es');
  if (lower === 'pt_br') pushUnique('pt');

  if (!primary.includes('_') && primary.length === 2) {
    if (primary === 'en') pushUnique('en_US');
    if (primary === 'es') pushUnique('es_ES');
    if (primary === 'pt') pushUnique('pt_BR');
  }
  return out;
};

const createJobPayload = (
  booking: Booking,
  type: WhatsAppJobType,
  dueAt: Timestamp
): JobDoc => ({
  bookingId: booking.id,
  type,
  toPhoneE164: normalizeWhatsAppRecipientDigits(booking.clientPhoneE164 || booking.clientPhone),
  templateName: type === 'WHATSAPP_CONFIRMATION' ? 'booking_confirmed_new' : 'booking_reminder_24h',
  lang: getLanguageCode(),
  vars: buildVars(booking),
  bookingDate: booking.bookingDate,
  bookingTime: booking.bookingTime,
  dueAt,
  status: 'queued',
  attempts: 0,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});

const confirmationJobIsAlreadyHandled = async (bookingId: string): Promise<boolean> => {
  const confirmationRef = db().collection('notification_jobs').doc(jobDocId(bookingId, 'WHATSAPP_CONFIRMATION'));
  const snap = await confirmationRef.get();
  if (!snap.exists) return false;
  const st = (snap.data() as JobDoc | undefined)?.status;
  return st === 'queued' || st === 'processing' || st === 'sent';
};

export const enqueueWhatsAppJobsForConfirmedBooking = async (booking: Booking): Promise<WhatsAppEnqueueResult> => {
  const isConfirmed = booking.status === 'confirmed';
  if (!isConfirmed) {
    console.warn('[whatsapp] skip enqueue: booking status is not confirmed', booking.id);
    return { queued: false, skippedReason: 'status_not_confirmed' };
  }

  const optIn = booking.whatsappOptIn ?? true;
  const toPhoneE164 = normalizeWhatsAppRecipientDigits(booking.clientPhoneE164 || booking.clientPhone);
  const startAt = bookingStartAt(booking);

  if (!optIn) {
    console.warn('[whatsapp] skip enqueue: whatsapp opt-out', booking.id);
    return { queued: false, skippedReason: 'opt_out' };
  }
  if (!toPhoneE164) {
    console.warn('[whatsapp] skip enqueue: phone missing or invalid (need 7–15 digits, e.g. +34 612…)', booking.id);
    return { queued: false, skippedReason: 'invalid_phone' };
  }
  if (!startAt) {
    console.warn('[whatsapp] skip enqueue: invalid booking date/time', booking.id);
    return { queued: false, skippedReason: 'invalid_datetime' };
  }

  if (await confirmationJobIsAlreadyHandled(booking.id)) {
    return { queued: false, skippedReason: 'already_handled' };
  }

  const now = Timestamp.now();
  let reminderDueMillis = startAt.getTime() - 24 * 60 * 60 * 1000;
  if (reminderDueMillis < now.toMillis()) {
    reminderDueMillis = now.toMillis() + 60 * 1000;
  }
  const reminderDue = Timestamp.fromMillis(reminderDueMillis);

  const batch = db().batch();
  const confirmationRef = db().collection('notification_jobs').doc(jobDocId(booking.id, 'WHATSAPP_CONFIRMATION'));
  const reminderRef = db().collection('notification_jobs').doc(jobDocId(booking.id, 'WHATSAPP_REMINDER_24H'));

  batch.set(confirmationRef, createJobPayload(booking, 'WHATSAPP_CONFIRMATION', now), { merge: true });
  batch.set(reminderRef, createJobPayload(booking, 'WHATSAPP_REMINDER_24H', reminderDue), { merge: true });

  await batch.commit();

  // Process the confirmation doc by ref — a follow-up query can miss the new row briefly (Firestore),
  // which caused production sends to never run when relying only on processDueWhatsAppJobs().
  try {
    await processQueuedNotificationJobRef(confirmationRef);
    await processDueWhatsAppJobs(25);
  } catch (err: any) {
    const msg = String(err?.message ?? err ?? 'unknown whatsapp enqueue processing error');
    console.error('[whatsapp] process after enqueue failed:', msg);
    throw new Error(`[whatsapp] ${msg}`);
  }
  return { queued: true };
};

export const refreshQueuedWhatsAppReminderForBooking = async (
  booking: Pick<Booking, 'id' | 'bookingDate' | 'bookingTime' | 'status'>
): Promise<WhatsAppEnqueueResult> => {
  const reminderRef = db().collection('notification_jobs').doc(jobDocId(booking.id, 'WHATSAPP_REMINDER_24H'));
  const snap = await reminderRef.get();
  if (!snap.exists) {
    return { queued: false, skippedReason: 'missing_job' };
  }

  const data = snap.data() as JobDoc | undefined;
  if (!data || (data.status !== 'queued' && data.status !== 'failed')) {
    return { queued: false, skippedReason: 'already_handled' };
  }

  if (booking.status === 'cancelled') {
    await reminderRef.set(
      {
        status: 'failed',
        updatedAt: Timestamp.now(),
        lastError: 'skipped_cancelled_booking',
      },
      { merge: true }
    );
    return { queued: false, skippedReason: 'status_cancelled' };
  }

  const startAt = bookingStartAt(booking);
  if (!startAt) {
    await reminderRef.set(
      {
        status: 'failed',
        updatedAt: Timestamp.now(),
        lastError: 'invalid_datetime',
      },
      { merge: true }
    );
    return { queued: false, skippedReason: 'invalid_datetime' };
  }

  const now = Timestamp.now();
  if (startAt.getTime() <= now.toMillis()) {
    await reminderRef.set(
      {
        status: 'failed',
        updatedAt: now,
        lastError: 'booking_in_past',
      },
      { merge: true }
    );
    return { queued: false, skippedReason: 'booking_in_past' };
  }

  let reminderDueMillis = startAt.getTime() - 24 * 60 * 60 * 1000;
  if (reminderDueMillis < now.toMillis()) {
    reminderDueMillis = now.toMillis() + 60 * 1000;
  }

  await reminderRef.set(
    {
      vars: {
        ...(data.vars || {}),
        date: formatTemplateDate(booking.bookingDate),
        time: booking.bookingTime || '',
      },
      bookingDate: booking.bookingDate,
      bookingTime: booking.bookingTime,
      dueAt: Timestamp.fromMillis(reminderDueMillis),
      status: 'queued',
      updatedAt: now,
      lastError: FieldValue.delete(),
    },
    { merge: true }
  );

  return { queued: true };
};

const buildTemplateComponents = (vars: Record<string, string>) => {
  const ordered = ['client_name', 'date', 'time', 'location'];
  return [
    {
      type: 'body',
      parameters: ordered.map((key) => ({
        type: 'text',
        text: String(vars?.[key] ?? ''),
      })),
    },
  ];
};

const isWhatsAppReminderStillUseful = (job: JobDoc, nowMillis = Date.now()): boolean => {
  if (job.type !== 'WHATSAPP_REMINDER_24H') return true;
  if (!job.bookingDate || !job.bookingTime) return true;

  const startAt = getMadridDateTime(job.bookingDate, job.bookingTime);
  if (!startAt) return false;

  return startAt.getTime() - nowMillis > 30 * 60 * 1000;
};

const getSkipReasonForStaleWhatsAppReminder = async (job: JobDoc): Promise<string | null> => {
  if (job.type !== 'WHATSAPP_REMINDER_24H') return null;

  const bookingSnap = await db().collection('bookings').doc(job.bookingId).get();
  if (!bookingSnap.exists) return 'booking_missing';

  const booking = bookingSnap.data() as Booking | undefined;
  if (!booking || booking.status === 'cancelled') return 'booking_cancelled';
  if (job.bookingDate && job.bookingTime && (booking.bookingDate !== job.bookingDate || booking.bookingTime !== job.bookingTime)) {
    return 'booking_schedule_changed';
  }
  if (!isWhatsAppReminderStillUseful(job)) return 'skipped_stale_reminder';

  return null;
};

const sendWhatsAppTemplate = async (
  to: string,
  templateName: string,
  lang: string,
  vars: Record<string, string>
): Promise<string | undefined> => {
  const token = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';

  const missingVars: string[] = [];
  if (!token) missingVars.push('META_ACCESS_TOKEN');
  if (!phoneNumberId) missingVars.push('WHATSAPP_PHONE_NUMBER_ID');
  if (missingVars.length > 0) {
    throw new Error(`Missing WhatsApp API config: ${missingVars.join(', ')}.`);
  }

  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  const toDigits = normalizeWhatsAppRecipientDigits(to);
  if (!toDigits) {
    throw new Error('WA send: invalid recipient phone (need 7–15 international digits).');
  }
  const payload = {
    messaging_product: 'whatsapp',
    to: toDigits,
    type: 'template',
    template: {
      name: templateName,
      language: { code: normalizeTemplateLang(lang) || 'en_US' },
      components: buildTemplateComponents(vars),
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`WA send failed ${response.status}: ${JSON.stringify(json)}`);
  }
  return json?.messages?.[0]?.id;
};

const isMissingIndexError = (error: unknown): boolean => {
  const message = String((error as any)?.message ?? error ?? '');
  return message.includes('FAILED_PRECONDITION') && message.includes('requires an index');
};

const getDueQueuedJobDocs = async (now: Timestamp, limit: number) => {
  const jobsRef = db().collection('notification_jobs');

  try {
    const snap = await jobsRef
      .where('status', '==', 'queued')
      .where('dueAt', '<=', now)
      .orderBy('dueAt', 'asc')
      .limit(limit)
      .get();
    return snap.docs;
  } catch (error) {
    if (!isMissingIndexError(error)) throw error;

    const fallbackSnap = await jobsRef
      .where('dueAt', '<=', now)
      .orderBy('dueAt', 'asc')
      .limit(Math.max(limit * 5, 50))
      .get();

    return fallbackSnap.docs
      .filter((doc) => {
        const data = doc.data() as JobDoc | undefined;
        return data?.status === 'queued';
      })
      .slice(0, limit);
  }
};

/** Claim one queued job by ref, send template, update status (shared by cron and post-enqueue flush). */
async function processQueuedNotificationJobRef(ref: DocumentReference): Promise<'sent' | 'failed' | 'skipped'> {
  let claimed = false;

  await db().runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    const data = fresh.data() as JobDoc | undefined;
    if (!data || data.status !== 'queued') return;
    tx.update(ref, { status: 'processing', updatedAt: Timestamp.now() });
    claimed = true;
  });

  if (!claimed) return 'skipped';

  const current = (await ref.get()).data() as JobDoc | undefined;
  if (!current || current.status !== 'processing') return 'skipped';

  const staleReminderReason = await getSkipReasonForStaleWhatsAppReminder(current);
  if (staleReminderReason) {
    await ref.update({
      status: 'failed',
      lastError: staleReminderReason,
      updatedAt: Timestamp.now(),
    });
    return 'skipped';
  }

  try {
    const runtimeLang = getLanguageCode();
    const candidates = buildLanguageFallbacks(current.lang || runtimeLang || 'en_US');
    let sent = false;
    let lastErr: unknown = null;
    for (const candidate of candidates) {
      try {
        const providerMessageId = await sendWhatsAppTemplate(
          current.toPhoneE164,
          current.templateName,
          candidate,
          current.vars || {}
        );
        sent = true;
        await ref.update({
          providerMessageId: providerMessageId || null,
          updatedAt: Timestamp.now(),
        });
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!sent) throw lastErr;

    await ref.update({
      status: 'sent',
      sentAt: Timestamp.now(),
      lastError: FieldValue.delete(),
      updatedAt: Timestamp.now(),
    });
    return 'sent';
  } catch (error: any) {
    const attempts = (current.attempts ?? 0) + 1;
    const finalStatus = attempts >= 3 ? 'failed' : 'queued';
    const errMsg = String(error?.message ?? error).slice(0, 1500);
    console.error('[whatsapp] send failed:', ref.id, errMsg);
    await ref.update({
      status: finalStatus,
      attempts,
      lastError: errMsg,
      updatedAt: Timestamp.now(),
    });
    return 'failed';
  }
}

export const processDueWhatsAppJobs = async (limit = 25): Promise<{ processed: number; sent: number; failed: number }> => {
  const now = Timestamp.now();
  const queuedDocs = await getDueQueuedJobDocs(now, limit);
  if (queuedDocs.length === 0) return { processed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const doc of queuedDocs) {
    const result = await processQueuedNotificationJobRef(doc.ref);
    if (result === 'sent') sent += 1;
    if (result === 'failed') failed += 1;
  }

  return {
    processed: queuedDocs.length,
    sent,
    failed,
  };
};
