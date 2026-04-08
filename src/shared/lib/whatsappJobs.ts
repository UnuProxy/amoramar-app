import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import type { Booking } from '@/shared/lib/types';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';

export type WhatsAppJobType = 'WHATSAPP_CONFIRMATION' | 'WHATSAPP_REMINDER_24H';

type JobDoc = {
  bookingId: string;
  type: WhatsAppJobType;
  toPhoneE164: string;
  templateName: 'booking_confirmed_new' | 'booking_reminder_24h' | (string & {});
  lang: string;
  vars: Record<string, string>;
  dueAt: Timestamp;
  status: 'queued' | 'processing' | 'sent' | 'failed';
  attempts: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastError?: string;
  sentAt?: Timestamp;
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
  const candidate = new Date(`${booking.bookingDate}T${booking.bookingTime}:00`);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
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
  const lc = raw.toLowerCase();
  // Common shorthand values configured in envs.
  if (lc === 'en') return 'en_US';
  if (lc === 'es') return 'es_ES';
  if (lc === 'pt') return 'pt_BR';
  return raw;
};

const getLanguageCode = (): string => normalizeTemplateLang(process.env.WHATSAPP_TEMPLATE_LANG);

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

export const enqueueWhatsAppJobsForConfirmedBooking = async (booking: Booking): Promise<void> => {
  const isConfirmed = booking.status === 'confirmed';
  if (!isConfirmed) {
    console.warn('[whatsapp] skip enqueue: booking status is not confirmed', booking.id);
    return;
  }

  const optIn = booking.whatsappOptIn ?? true;
  const toPhoneE164 = normalizeWhatsAppRecipientDigits(booking.clientPhoneE164 || booking.clientPhone);
  const startAt = bookingStartAt(booking);

  if (!optIn) {
    console.warn('[whatsapp] skip enqueue: whatsapp opt-out', booking.id);
    return;
  }
  if (!toPhoneE164) {
    console.warn('[whatsapp] skip enqueue: phone missing or invalid (need 7–15 digits, e.g. +34 612…)', booking.id);
    return;
  }
  if (!startAt) {
    console.warn('[whatsapp] skip enqueue: invalid booking date/time', booking.id);
    return;
  }

  if (await confirmationJobIsAlreadyHandled(booking.id)) return;

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

const sendWhatsAppTemplate = async (
  to: string,
  templateName: string,
  lang: string,
  vars: Record<string, string>
) => {
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
      language: { code: lang || 'en_US' },
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

  try {
    const runtimeLang = getLanguageCode();
    const effectiveLang = normalizeTemplateLang(current.lang || runtimeLang || 'en_US');
    await sendWhatsAppTemplate(
      current.toPhoneE164,
      current.templateName,
      effectiveLang,
      current.vars || {}
    );

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
