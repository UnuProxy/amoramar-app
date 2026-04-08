import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';

export const runtime = 'nodejs';

type WhatsAppStatus = {
  id?: string;
  status?: string;
  recipient_id?: string;
  timestamp?: string;
  conversation?: { id?: string; expiration_timestamp?: string; origin?: { type?: string } };
  pricing?: { billable?: boolean; pricing_model?: string; category?: string };
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: any }>;
};

const verifyWebhook = (request: NextRequest) => {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ success: false, error: 'Webhook verification failed' }, { status: 403 });
};

export async function GET(request: NextRequest) {
  return verifyWebhook(request);
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const db = getAdminDb();

    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    let stored = 0;

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value;
        const statuses: WhatsAppStatus[] = Array.isArray(value?.statuses) ? value.statuses : [];
        for (const status of statuses) {
          const wamid = String(status?.id || '').trim();
          if (!wamid) continue;

          const docId = `${wamid}_${status?.status || 'unknown'}_${Date.now()}`;
          await db.collection('whatsapp_status_events').doc(docId).set({
            wamid,
            status: status?.status || null,
            recipientId: status?.recipient_id || null,
            statusTimestamp: status?.timestamp || null,
            conversation: status?.conversation || null,
            pricing: status?.pricing || null,
            errors: status?.errors || null,
            raw: status,
            sourceMetaPhoneNumberId: value?.metadata?.phone_number_id || null,
            sourceMetaDisplayPhoneNumber: value?.metadata?.display_phone_number || null,
            receivedAt: Timestamp.now(),
            createdAtIso: new Date().toISOString(),
          });
          stored += 1;
        }
      }
    }

    return NextResponse.json({ success: true, stored });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to process WhatsApp webhook' },
      { status: 500 }
    );
  }
}

