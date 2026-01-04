import { NextRequest, NextResponse } from 'next/server';
import { createExpense, getExpenses } from '@/shared/lib/firestore';
import type { Expense } from '@/shared/lib/types';

// GET /api/expenses - Fetch all expenses (with optional filters)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const salonId = searchParams.get('salonId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const expenses = await getExpenses(salonId, startDate, endDate);

    return NextResponse.json({
      success: true,
      data: expenses,
    });
  } catch (error: any) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch expenses',
      },
      { status: 500 }
    );
  }
}

// POST /api/expenses - Create a new expense
export async function POST(request: NextRequest) {
  try {
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
      category: body.category,
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

    const newExpense = await createExpense(expenseData);

    return NextResponse.json({
      success: true,
      data: newExpense,
    });
  } catch (error: any) {
    console.error('Error creating expense:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create expense',
      },
      { status: 500 }
    );
  }
}








