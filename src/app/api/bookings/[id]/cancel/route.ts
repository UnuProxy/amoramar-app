import { NextRequest, NextResponse } from 'next/server';
import { getBooking, updateBooking } from '@/shared/lib/firestore';
import { createRefund } from '@/shared/lib/stripe';
import { hoursUntilBooking } from '@/shared/lib/utils';
import type { ApiResponse, Booking, UserRole } from '@/shared/lib/types';

type CancelRequest = {
  role?: UserRole | 'admin';
  reason?: string;
  force?: boolean;
};

const MIN_CANCEL_HOURS = 24;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as CancelRequest;
    const role = body.role || 'client';
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

    const hoursUntil = hoursUntilBooking(booking.bookingDate, booking.bookingTime);
    const isAdmin = role === 'owner' || role === 'employee' || role === 'admin' || body.force;

    if (!isAdmin && hoursUntil < MIN_CANCEL_HOURS) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Cancellations are only allowed up to 24 hours before the appointment.',
        },
        { status: 403 }
      );
    }

    let refundStatus: 'none' | 'refunded' | 'failed' = 'none';
    if (booking.paymentStatus === 'paid' && booking.paymentIntentId && booking.depositAmount) {
      try {
        await createRefund(booking.paymentIntentId, booking.depositAmount);
        refundStatus = 'refunded';
      } catch (error) {
        console.error('Error refunding deposit:', error);
        refundStatus = 'failed';
      }
    }

    const updates: Partial<Booking> = {
      status: 'cancelled',
      cancelledAt: new Date(),
      paymentStatus: refundStatus === 'refunded' ? 'refunded' : booking.paymentStatus,
      depositPaid: refundStatus === 'refunded' ? false : booking.depositPaid,
    };

    await updateBooking(id, updates);

    return NextResponse.json<ApiResponse<{ refundStatus: string; hoursUntil: number }>>({
      success: true,
      data: {
        refundStatus,
        hoursUntil,
      },
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to cancel booking',
      },
      { status: 500 }
    );
  }
}
