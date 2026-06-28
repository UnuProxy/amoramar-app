import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/shared/lib/firebaseAdmin';
import { savePushSubscription } from '@/shared/lib/pushNotifications';

type PushSubscriptionPayload = {
  subscription?: {
    endpoint?: string;
    expirationTime?: number | null;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
  language?: 'en' | 'es';
};

const getBearerToken = (request: NextRequest): string | null => {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
};

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const userSnap = await getAdminDb().collection('users').doc(decodedToken.uid).get();
    const userData = userSnap.data();
    const userRole = String(userData?.role || '');

    if (userRole !== 'owner') {
      return NextResponse.json({ error: 'Only owner accounts can receive admin push notifications' }, { status: 403 });
    }

    const body = (await request.json()) as PushSubscriptionPayload;
    const subscription = body.subscription;

    if (!subscription?.endpoint || !subscription.keys?.auth || !subscription.keys?.p256dh) {
      return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 });
    }

    await savePushSubscription({
      subscription: {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime || null,
        keys: {
          auth: subscription.keys.auth,
          p256dh: subscription.keys.p256dh,
        },
      },
      userId: decodedToken.uid,
      userRole,
      userEmail: decodedToken.email || userData?.email,
      language: body.language === 'es' ? 'es' : 'en',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[push] failed to save subscription:', String(error?.message || error));
    return NextResponse.json(
      { error: error?.message || 'Failed to save push subscription' },
      { status: 500 }
    );
  }
}
