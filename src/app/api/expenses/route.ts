import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/shared/lib/firebaseAdmin';
import type { Expense } from '@/shared/lib/types';

const withoutUndefined = <T extends Record<string, any>>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

const toExpenseResponse = (docId: string, data?: Record<string, any>): Expense => ({
  id: docId,
  salonId: data?.salonId || 'default-salon-id',
  category: data?.category || 'other',
  name: data?.name || '',
  description: data?.description || undefined,
  amount: typeof data?.amount === 'number' ? data.amount : Number(data?.amount || 0),
  frequency: data?.frequency || 'one-time',
  date: data?.date || '',
  isRecurring: Boolean(data?.isRecurring),
  isPaid: data?.isPaid !== undefined ? Boolean(data.isPaid) : true,
  paymentMethod: data?.paymentMethod || undefined,
  vendor: data?.vendor || undefined,
  receiptUrl: data?.receiptUrl || undefined,
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

// GET /api/expenses - Fetch all expenses (with optional filters)
export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const { searchParams } = new URL(request.url);
    const salonId = searchParams.get('salonId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    let query = getAdminDb().collection('expenses').orderBy('date', 'desc');
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
    const expenses = snapshot.docs.map((doc) => toExpenseResponse(doc.id, doc.data()));

    return NextResponse.json({
      success: true,
      data: expenses,
    });
  } catch (error: any) {
    console.error('Error fetching expenses:', error);
    const status = error?.message === 'Permission denied.' || error?.message === 'Missing authorization token.' ? 403 : 500;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch expenses',
      },
      { status }
    );
  }
}

// POST /api/expenses - Create a new expense
export async function POST(request: NextRequest) {
  try {
    await requireOwner(request);
    const body = await request.json();

    // Validate required fields
    if (!body.category || !body.name || !body.amount || !body.date) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: category, name, amount, date',
        },
        { status: 400 }
      );
    }

    const expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> = {
      salonId: body.salonId || 'default-salon-id',
      category: String(body.category || 'other').trim() || 'other',
      name: body.name,
      description: body.description || undefined,
      amount: parseFloat(body.amount),
      frequency: body.frequency || 'one-time',
      date: body.date,
      isRecurring: body.isRecurring || false,
      isPaid: body.isPaid !== undefined ? body.isPaid : true,
      paymentMethod: body.paymentMethod || undefined,
      vendor: body.vendor || undefined,
      receiptUrl: body.receiptUrl || undefined,
      notes: body.notes || undefined,
    };

    const docRef = getAdminDb().collection('expenses').doc();
    await docRef.set(
      withoutUndefined({
        ...expenseData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: Timestamp.now(),
      })
    );
    const persisted = await docRef.get();
    const newExpense = toExpenseResponse(docRef.id, persisted.data());

    return NextResponse.json({
      success: true,
      data: newExpense,
    });
  } catch (error: any) {
    console.error('Error creating expense:', error);
    const status = error?.message === 'Permission denied.' || error?.message === 'Missing authorization token.' ? 403 : 500;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create expense',
      },
      { status }
    );
  }
}












