import { NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/shared/lib/pushNotifications';

export async function GET() {
  const publicKey = getVapidPublicKey();

  return NextResponse.json({
    configured: Boolean(publicKey),
    publicKey,
  });
}
