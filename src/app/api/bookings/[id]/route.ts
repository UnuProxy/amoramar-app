import { NextRequest, NextResponse } from 'next/server';
import { getBooking, updateBooking, getEmployeeByUserId } from '@/shared/lib/firestore';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';
import type { ApiResponse, Booking, UserRole } from '@/shared/lib/types';
import { BookingScheduleValidationError, validateBookingSchedule } from '@/shared/lib/bookingAvailability';
import { enqueueWhatsAppJobsForConfirmedBooking, refreshQueuedWhatsAppReminderForBooking } from '@/shared/lib/whatsappJobs';
import { refreshQueuedEmailReminderForBooking } from '@/shared/lib/emailReminderJobs';

export const runtime = 'nodejs';

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
    const updates: Partial<Booking> & { actorRole?: UserRole | 'admin'; actorUserId?: string } = await request.json();

    if (updates.status === 'cancelled') {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Use the cancellation endpoint to cancel bookings (handles refunds and rules).',
        },
        { status: 400 }
      );
    }

    const actorRole = (request.headers.get('x-user-role') || updates.actorRole || '').toLowerCase() as
      | UserRole
      | 'admin'
      | '';
    const actorUserId = request.headers.get('x-user-id') || updates.actorUserId;
    const actorEmployeeId = request.headers.get('x-employee-id') || (updates as any).actorEmployeeId;
    delete (updates as any).actorRole;
    delete (updates as any).actorUserId;
    delete (updates as any).actorEmployeeId;

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

    if (actorRole === 'employee') {
      if (!actorUserId) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'Unauthorized: missing user.',
          },
          { status: 403 }
        );
      }

      const employee = await getEmployeeByUserId(actorUserId);
      const ownsBooking =
        (employee && employee.id === booking.employeeId) ||
        (actorEmployeeId && actorEmployeeId === booking.employeeId);
      const attemptingReassign = updates.employeeId && updates.employeeId !== booking.employeeId;

      if (!ownsBooking || attemptingReassign) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'Unauthorized: employees can only modify their own bookings.',
          },
          { status: 403 }
        );
      }
    }

    // Prevent changing ownership fields from this endpoint
    if (actorRole === 'employee') {
      delete (updates as any).employeeId;
      delete (updates as any).salonId;
    }

    const touchesSchedule =
      typeof updates.employeeId === 'string' ||
      typeof updates.serviceId === 'string' ||
      typeof updates.bookingDate === 'string' ||
      typeof updates.bookingTime === 'string' ||
      typeof updates.isConsultation === 'boolean' ||
      typeof updates.consultationDuration === 'number';

    if (touchesSchedule) {
      await validateBookingSchedule({
        employeeId: updates.employeeId || booking.employeeId,
        serviceId: updates.serviceId || booking.serviceId,
        bookingDate: updates.bookingDate || booking.bookingDate,
        bookingTime: updates.bookingTime || booking.bookingTime,
        isConsultation: updates.isConsultation ?? booking.isConsultation,
        consultationDuration: updates.consultationDuration ?? booking.consultationDuration,
        excludeBookingId: booking.id,
        skipScheduleValidation: actorRole === 'owner' || actorRole === 'employee' || actorRole === 'admin',
      });
    }

    const statusBefore = booking.status;
    const statusAfter = updates.status ?? booking.status;
    const scheduleChanged =
      (typeof updates.bookingDate === 'string' && updates.bookingDate !== booking.bookingDate) ||
      (typeof updates.bookingTime === 'string' && updates.bookingTime !== booking.bookingTime);

    await updateBooking(id, updates);

    if (scheduleChanged) {
      const refreshedBooking = {
        ...booking,
        ...updates,
        id: booking.id,
        status: statusAfter,
      } as Booking;

      await Promise.allSettled([
        refreshQueuedEmailReminderForBooking(refreshedBooking).catch((error) => {
          console.error('Failed to refresh email reminder after booking schedule change:', id, error);
        }),
        refreshQueuedWhatsAppReminderForBooking(refreshedBooking).catch((error) => {
          console.error('Failed to refresh WhatsApp reminder after booking schedule change:', id, error);
        }),
      ]);
    }

    if (statusBefore !== 'confirmed' && statusAfter === 'confirmed') {
      try {
        await enqueueWhatsAppJobsForConfirmedBooking({
          ...booking,
          ...updates,
          id: booking.id,
          status: 'confirmed',
        } as Booking);
      } catch (whatsAppError) {
        console.error('Failed to enqueue WhatsApp jobs on booking confirmation:', whatsAppError);
      }
    }

    return NextResponse.json<ApiResponse<{ id: string }>>({
      success: true,
      data: { id },
    });
  } catch (error: any) {
    if (error instanceof BookingScheduleValidationError) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: error.message,
        },
        { status: error.statusCode }
      );
    }

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
    // Use Admin SDK to bypass Firestore security rules (this endpoint is intended
    // for owner/admin cleanup of test or unwanted bookings from the dashboard).
    const bookingRef = getAdminDb().collection('bookings').doc(id);
    const bookingSnap = await bookingRef.get();
    const booking = bookingSnap.exists ? ({ id: bookingSnap.id, ...(bookingSnap.data() as Omit<Booking, 'id'>) } as Booking) : null;

    if (booking) {
      await Promise.allSettled([
        refreshQueuedEmailReminderForBooking({ ...booking, status: 'cancelled' }).catch((error) => {
          console.error('Failed to cancel queued email reminder before delete:', id, error);
        }),
        refreshQueuedWhatsAppReminderForBooking({ ...booking, status: 'cancelled' }).catch((error) => {
          console.error('Failed to cancel queued WhatsApp reminder before delete:', id, error);
        }),
      ]);
    }

    await bookingRef.delete();

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      data: null,
    });
  } catch (error: any) {
    console.error('Failed to delete booking via admin SDK:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to delete booking',
      },
      { status: 500 }
    );
  }
}













