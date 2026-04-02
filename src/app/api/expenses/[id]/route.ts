import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
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

// GET /api/expenses/[id] - Fetch a single expense
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner(request);
    const { id } = await context.params;
    const docSnap = await getAdminDb().collection('expenses').doc(id).get();

    if (!docSnap.exists) {
      return NextResponse.json(
        {
          success: false,
          error: 'Expense not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: toExpenseResponse(docSnap.id, docSnap.data()),
    });
  } catch (error: any) {
    console.error('Error fetching expense:', error);
    const status = error?.message === 'Permission denied.' || error?.message === 'Missing authorization token.' ? 403 : 500;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch expense',
      },
      { status }
    );
  }
}

// PATCH /api/expenses/[id] - Update an expense
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner(request);
    const { id } = await context.params;
    const body = await request.json();
    const docRef = getAdminDb().collection('expenses').doc(id);
    await docRef.set(
      withoutUndefined({
        ...body,
        updatedAt: Timestamp.now(),
      }),
      { merge: true }
    );
    const updatedExpense = await docRef.get();

    return NextResponse.json({
      success: true,
      data: updatedExpense.exists ? toExpenseResponse(updatedExpense.id, updatedExpense.data()) : null,
    });
  } catch (error: any) {
    console.error('Error updating expense:', error);
    const status = error?.message === 'Permission denied.' || error?.message === 'Missing authorization token.' ? 403 : 500;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update expense',
      },
      { status }
    );
  }
}

// DELETE /api/expenses/[id] - Delete an expense
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner(request);
    const { id } = await context.params;
    await getAdminDb().collection('expenses').doc(id).delete();

    return NextResponse.json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting expense:', error);
    const status = error?.message === 'Permission denied.' || error?.message === 'Missing authorization token.' ? 403 : 500;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete expense',
      },
      { status }
    );
  }
}











