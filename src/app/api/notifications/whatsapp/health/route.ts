import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/shared/lib/types';

export const runtime = 'nodejs';

const isAuthorized = (request: NextRequest): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const queryToken = request.nextUrl.searchParams.get('token') || '';

  return bearer === secret || queryToken === secret;
};

type WhatsAppHealth = {
  graphVersion: string;
  phoneNumberId: string;
  tokenConfigured: boolean;
  ok: boolean;
  phoneNumber?: {
    id?: string;
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
    code_verification_status?: string;
  };
  graphError?: string;
};

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = process.env.META_ACCESS_TOKEN || '';
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';

    if (!token || !phoneNumberId) {
      return NextResponse.json<ApiResponse<WhatsAppHealth>>(
        {
          success: false,
          error: 'Missing META_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID',
          data: {
            graphVersion,
            phoneNumberId,
            tokenConfigured: !!token,
            ok: false,
          },
        },
        { status: 500 }
      );
    }

    const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      const graphError = JSON.stringify(json);
      return NextResponse.json<ApiResponse<WhatsAppHealth>>(
        {
          success: false,
          error: 'WhatsApp config check failed',
          data: {
            graphVersion,
            phoneNumberId,
            tokenConfigured: true,
            ok: false,
            graphError,
          },
        },
        { status: 502 }
      );
    }

    return NextResponse.json<ApiResponse<WhatsAppHealth>>({
      success: true,
      data: {
        graphVersion,
        phoneNumberId,
        tokenConfigured: true,
        ok: true,
        phoneNumber: json,
      },
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: error?.message || 'WhatsApp health check failed' },
      { status: 500 }
    );
  }
}

