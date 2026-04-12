import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/shared/lib/firebaseAdmin';
import type { ManualRevenue } from '@/shared/lib/types';

const withoutUndefined = <T extends Record<string, any>>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

const toManualRevenueResponse = (docId: string, data?: Record<string, any>): ManualRevenue => ({
  id: docId,
  salonId: data?.salonId || 'default-salon-id',
  serviceName: data?.serviceName || '',
  amount: typeof data?.amount === 'number' ? data.amount : Number(data?.amount || 0),
  date: data?.date || '',
  notes: data?.notes || undefined,
  createdAt: data?.createdAt?.toDate?.() || new Date(0),
  updatedAt: data?.updatedAt?.toDate?.() || new Date(0),
});

const getBearerToken = (request: NextRequest): string | null => {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
};

const requireOwner = async (request: NextRequest): Promise<string> => {
  const token = getBearerToken(request);
  if (!token) {
    throw new Error('Missing authorization token.');
  }

  const decoded = await getAdminAuth().verifyIdToken(token);
  const userDoc = await getAdminDb().collection('users').doc(decoded.uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'owner') {
    throw new Error('Permission denied.');
  }

  return decoded.uid;
};

export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const { searchParams } = new URL(request.url);
    const salonId = searchParams.get('salonId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    let query = getAdminDb().collection('manualRevenue').orderBy('date', 'desc');
    if (salonId) {
      query = query.where('salonId', '==', salonId);
    }
    if (startDate) {
      query = query.where('date', '>=', startDate);
    }
    if (endDate) {
      query = query.where('date', '<=', endDate);
    }

    const snapshot = await query.get();
    const items = snapshot.docs.map((doc) => toManualRevenueResponse(doc.id, doc.data()));

    return NextResponse.json({
      success: true,
      data: items,
    });
  } catch (error: any) {
    console.error('Error fetching manual revenue:', error);
    const status = error?.message === 'Permission denied.' || error?.message === 'Missing authorization token.' ? 403 : 500;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch manual revenue',
      },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOwner(request);
    const body = await request.json();

    if (!body.serviceName || !body.amount || !body.date) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: serviceName, amount, date',
        },
        { status: 400 }
      );
    }

    const manualRevenueData: Omit<ManualRevenue, 'id' | 'createdAt' | 'updatedAt'> = {
      salonId: body.salonId || 'default-salon-id',
      serviceName: body.serviceName,
      amount: parseFloat(body.amount),
      date: body.date,
      notes: body.notes || undefined,
    };

    const docRef = getAdminDb().collection('manualRevenue').doc();
    await docRef.set(
      withoutUndefined({
        ...manualRevenueData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: Timestamp.now(),
      })
    );

    const persisted = await docRef.get();
    return NextResponse.json({
      success: true,
      data: toManualRevenueResponse(docRef.id, persisted.data()),
    });
  } catch (error: any) {
    console.error('Error creating manual revenue:', error);
    const status = error?.message === 'Permission denied.' || error?.message === 'Missing authorization token.' ? 403 : 500;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create manual revenue',
      },
      { status }
    );
  }
}
