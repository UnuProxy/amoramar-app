import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/shared/lib/types';
import { processDueWhatsAppJobs } from '@/shared/lib/whatsappJobs';
import { processDueEmailReminderJobs } from '@/shared/lib/emailReminderJobs';

const isAuthorized = (request: NextRequest): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';

  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const queryToken = request.nextUrl.searchParams.get('token') || '';

  return bearer === secret || queryToken === secret;
};

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Process email first so a WhatsApp provider failure can never prevent the
    // critical confirmation/reminder queue from running.
    const emailReminders = await processDueEmailReminderJobs(100);
    let whatsApp;
    try {
      whatsApp = await processDueWhatsAppJobs(25);
    } catch (error: any) {
      console.error('[cron] WhatsApp processing failed:', error);
      whatsApp = {
        processed: 0,
        sent: 0,
        failed: 1,
        error: error?.message || 'WhatsApp processing failed',
      };
    }
    const result = { whatsApp, emailReminders };
    return NextResponse.json<ApiResponse<typeof result>>({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: error?.message || 'Failed to process WhatsApp jobs' },
      { status: 500 }
    );
  }
}

