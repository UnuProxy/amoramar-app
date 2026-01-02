import { NextRequest, NextResponse } from 'next/server';
import { getBooking, updateBooking, deleteBooking } from '@/shared/lib/firestore';
import type { ApiResponse, Booking } from '@/shared/lib/types';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const booking = await getBooking(id);

    if (!booking) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Booking not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<Booking>>({
      success: true,
      data: booking,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to fetch booking',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const updates: Partial<Booking> = await request.json();

    if (updates.status === 'cancelled') {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Use the cancellation endpoint to cancel bookings (handles refunds and rules).',
        },
        { status: 400 }
      );
    }

    await updateBooking(id, updates);

    return NextResponse.json<ApiResponse<{ id: string }>>({
      success: true,
      data: { id },
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to update booking',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await deleteBooking(id);

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      data: null,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to delete booking',
      },
      { status: 500 }
    );
  }
}













