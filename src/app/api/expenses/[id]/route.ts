import { NextRequest, NextResponse } from 'next/server';
import { getExpense, updateExpense, deleteExpense } from '@/shared/lib/firestore';

// GET /api/expenses/[id] - Fetch a single expense
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const expense = await getExpense(id);

    if (!expense) {
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
      data: expense,
    });
  } catch (error: any) {
    console.error('Error fetching expense:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch expense',
      },
      { status: 500 }
    );
  }
}

// PATCH /api/expenses/[id] - Update an expense
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    
    await updateExpense(id, body);

    const updatedExpense = await getExpense(id);

    return NextResponse.json({
      success: true,
      data: updatedExpense,
    });
  } catch (error: any) {
    console.error('Error updating expense:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update expense',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/expenses/[id] - Delete an expense
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await deleteExpense(id);

    return NextResponse.json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting expense:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete expense',
      },
      { status: 500 }
    );
  }
}







