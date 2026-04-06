import { FieldValue, Timestamp } from 'firebase-admin/firestore';
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

const getLanguageCode = (): string => process.env.WHATSAPP_TEMPLATE_LANG || 'en_US';

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
  if (!isConfirmed) return;

  const optIn = booking.whatsappOptIn ?? true;
  const toPhoneE164 = normalizeWhatsAppRecipientDigits(booking.clientPhoneE164 || booking.clientPhone);
  const startAt = bookingStartAt(booking);

  if (!optIn || !toPhoneE164 || !startAt) return;

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

  // Vercel cron only runs in production; localhost never hits /api/notifications/whatsapp/process.
  // Flush due jobs in-process so confirmations send immediately in dev and without cron delay in prod.
  try {
    await processDueWhatsAppJobs(25);
  } catch (err) {
    console.error('processDueWhatsAppJobs after enqueue failed:', err);
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

export const processDueWhatsAppJobs = async (limit = 25): Promise<{ processed: number; sent: number; failed: number }> => {
  const now = Timestamp.now();
  const queuedDocs = await getDueQueuedJobDocs(now, limit);
  if (queuedDocs.length === 0) return { processed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const doc of queuedDocs) {
    const ref = doc.ref;
    let claimed = false;

    await db().runTransaction(async (tx) => {
      const fresh = await tx.get(ref);
      const data = fresh.data() as JobDoc | undefined;
      if (!data || data.status !== 'queued') return;
      tx.update(ref, { status: 'processing', updatedAt: Timestamp.now() });
      claimed = true;
    });

    if (!claimed) continue;

    const current = (await ref.get()).data() as JobDoc | undefined;
    if (!current || current.status !== 'processing') continue;

    try {
      // Prefer current runtime language to recover queued jobs created with an outdated language code.
      const runtimeLang = getLanguageCode();
      await sendWhatsAppTemplate(
        current.toPhoneE164,
        current.templateName,
        runtimeLang || current.lang || 'en_US',
        current.vars || {}
      );

      await ref.update({
        status: 'sent',
        sentAt: Timestamp.now(),
        lastError: FieldValue.delete(),
        updatedAt: Timestamp.now(),
      });
      sent += 1;
    } catch (error: any) {
      const attempts = (current.attempts ?? 0) + 1;
      const finalStatus = attempts >= 3 ? 'failed' : 'queued';
      await ref.update({
        status: finalStatus,
        attempts,
        lastError: String(error?.message ?? error).slice(0, 1500),
        updatedAt: Timestamp.now(),
      });
      failed += 1;
    }
  }

  return {
    processed: queuedDocs.length,
    sent,
    failed,
  };
};
