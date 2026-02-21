import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Booking } from '@/shared/lib/types';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';

export type WhatsAppJobType = 'WHATSAPP_CONFIRMATION' | 'WHATSAPP_REMINDER_24H';

type JobDoc = {
  bookingId: string;
  type: WhatsAppJobType;
  toPhoneE164: string;
  templateName: 'booking_confirmed' | 'booking_reminder_24h';
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

const safeE164 = (phone?: string): string => {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  return '';
};

const bookingStartAt = (booking: Pick<Booking, 'bookingDate' | 'bookingTime'>): Date | null => {
  if (!booking.bookingDate || !booking.bookingTime) return null;
  const candidate = new Date(`${booking.bookingDate}T${booking.bookingTime}:00`);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
};

const buildVars = (booking: Booking): Record<string, string> => ({
  client_name: booking.clientName || '',
  start_at: `${booking.bookingDate} ${booking.bookingTime}`,
  service_name: booking.serviceName || '',
  pickup: booking.notes || '',
});

const getLanguageCode = (): string => process.env.WHATSAPP_TEMPLATE_LANG || 'en_US';

const createJobPayload = (
  booking: Booking,
  type: WhatsAppJobType,
  dueAt: Timestamp
): JobDoc => ({
  bookingId: booking.id,
  type,
  toPhoneE164: safeE164(booking.clientPhoneE164 || booking.clientPhone),
  templateName: type === 'WHATSAPP_CONFIRMATION' ? 'booking_confirmed' : 'booking_reminder_24h',
  lang: getLanguageCode(),
  vars: buildVars(booking),
  dueAt,
  status: 'queued',
  attempts: 0,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});

export const enqueueWhatsAppJobsForConfirmedBooking = async (booking: Booking): Promise<void> => {
  const isConfirmed = booking.status === 'confirmed';
  if (!isConfirmed) return;

  const optIn = booking.whatsappOptIn ?? true;
  const toPhoneE164 = safeE164(booking.clientPhoneE164 || booking.clientPhone);
  const startAt = bookingStartAt(booking);

  if (!optIn || !toPhoneE164 || !startAt) return;

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
};

const buildTemplateComponents = (vars: Record<string, string>) => {
  const ordered = ['client_name', 'start_at', 'service_name', 'pickup'];
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

  if (!token || !phoneNumberId) {
    throw new Error('Missing WhatsApp API config (META_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID).');
  }

  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
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

export const processDueWhatsAppJobs = async (limit = 25): Promise<{ processed: number; sent: number; failed: number }> => {
  const now = Timestamp.now();
  const queue = db()
    .collection('notification_jobs')
    .where('status', '==', 'queued')
    .where('dueAt', '<=', now)
    .orderBy('dueAt', 'asc')
    .limit(limit);

  const snap = await queue.get();
  if (snap.empty) return { processed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const doc of snap.docs) {
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
      await sendWhatsAppTemplate(
        current.toPhoneE164,
        current.templateName,
        current.lang || 'en_US',
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
    processed: snap.docs.length,
    sent,
    failed,
  };
};

