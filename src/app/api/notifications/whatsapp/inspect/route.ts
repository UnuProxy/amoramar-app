import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/shared/lib/types';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';

export const runtime = 'nodejs';

const isAuthorized = (request: NextRequest): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const queryToken = request.nextUrl.searchParams.get('token') || '';

  return bearer === secret || queryToken === secret;
};

type JobInspect = {
  id: string;
  exists: boolean;
  status?: string;
  attempts?: number;
  toPhoneE164?: string;
  templateName?: string;
  lang?: string;
  lastError?: string;
  dueAt?: string;
  updatedAt?: string;
};

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const bookingId = (request.nextUrl.searchParams.get('bookingId') || '').trim();
    if (!bookingId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing bookingId query param' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const ids = [`${bookingId}_WHATSAPP_CONFIRMATION`, `${bookingId}_WHATSAPP_REMINDER_24H`];
    const jobs: JobInspect[] = [];

    for (const id of ids) {
      const snap = await db.collection('notification_jobs').doc(id).get();
      if (!snap.exists) {
        jobs.push({ id, exists: false });
        continue;
      }
      const d = snap.data() as any;
      jobs.push({
        id,
        exists: true,
        status: d?.status,
        attempts: d?.attempts,
        toPhoneE164: d?.toPhoneE164,
        templateName: d?.templateName,
        lang: d?.lang,
        lastError: d?.lastError,
        dueAt: d?.dueAt?.toDate?.()?.toISOString?.(),
        updatedAt: d?.updatedAt?.toDate?.()?.toISOString?.(),
      });
    }

    return NextResponse.json<ApiResponse<{ bookingId: string; jobs: JobInspect[] }>>({
      success: true,
      data: { bookingId, jobs },
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: error?.message || 'WhatsApp inspect failed' },
      { status: 500 }
    );
  }
}

