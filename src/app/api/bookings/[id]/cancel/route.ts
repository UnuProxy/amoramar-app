import { NextRequest, NextResponse } from 'next/server';
import type { DocumentReference } from 'firebase-admin/firestore';
import { createRefund } from '@/shared/lib/stripe';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';
import { getBooking } from '@/shared/lib/firestore';
import { hoursUntilBooking } from '@/shared/lib/utils';
import type { ApiResponse, Booking, UserRole } from '@/shared/lib/types';

type CancelRequest = {
  role?: UserRole | 'admin';
  reason?: string;
  force?: boolean;
};

const MIN_CANCEL_HOURS = 24;

const isAdminUnavailableError = (error: unknown): boolean => {
  const message = String((error as any)?.message ?? error ?? '');
  return (
    /Firebase Admin SDK is not configured/i.test(message) ||
    /Failed to initialize Firebase Admin SDK credentials/i.test(message) ||
    /DECODER routines::unsupported/i.test(message) ||
    /Getting metadata from plugin failed/i.test(message)
  );
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as CancelRequest;
    const role = body.role || 'client';
    let booking: Booking | null = null;
    let bookingRef: DocumentReference | null = null;
    let requiresClientWrite = false;

    try {
      const db = getAdminDb();
      bookingRef = db.collection('bookings').doc(id);
      const bookingSnap = await bookingRef.get();

      if (!bookingSnap.exists) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'Booking not found',
          },
          { status: 404 }
        );
      }

      const bookingData = bookingSnap.data() as Omit<Booking, 'id'>;
      booking = { id: bookingSnap.id, ...bookingData };
    } catch (adminError: any) {
      // Fallback for environments without Admin SDK (e.g. local dev)
      if (isAdminUnavailableError(adminError)) {
        booking = await getBooking(id);
        requiresClientWrite = true;
      } else {
        throw adminError;
      }
    }

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
    const shouldAttemptRefund =
      !!booking.paymentIntentId &&
      (booking.depositPaid === true ||
        booking.paymentStatus === 'paid' ||
        booking.paymentStatus === 'deposit_paid');

    if (booking.paymentStatus === 'refunded') {
      refundStatus = 'refunded';
    } else if (shouldAttemptRefund) {
      try {
        await createRefund(booking.paymentIntentId!, booking.depositAmount);
        refundStatus = 'refunded';
      } catch (error: any) {
        if (error?.code === 'charge_already_refunded' || /already been refunded/i.test(error?.message || '')) {
          refundStatus = 'refunded';
        } else {
        console.error('Error refunding deposit:', error);
        refundStatus = 'failed';
        }
      }
    }

    const updates: Partial<Booking> = {
      status: 'cancelled',
      cancelledAt: new Date(),
      paymentStatus: refundStatus === 'refunded' ? 'refunded' : booking.paymentStatus,
      depositPaid: refundStatus === 'refunded' ? false : booking.depositPaid,
    };

    if (bookingRef) {
      await bookingRef.update({
        ...updates,
        updatedAt: new Date(),
      });
    }

    return NextResponse.json<ApiResponse<{ refundStatus: string; hoursUntil: number; requiresClientWrite: boolean }>>({
      success: true,
      data: {
        refundStatus,
        hoursUntil,
        requiresClientWrite,
      },
    });
  } catch (error: any) {
    console.error('Cancel booking API failed:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to cancel booking',
      },
      { status: 500 }
    );
  }
}
