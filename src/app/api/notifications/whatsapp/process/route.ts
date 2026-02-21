import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/shared/lib/types';
import { processDueWhatsAppJobs } from '@/shared/lib/whatsappJobs';

const isAuthorized = (request: NextRequest): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

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

    const result = await processDueWhatsAppJobs(25);
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

