import { NextRequest, NextResponse } from 'next/server';
import { getBooking, updateBooking, deleteBooking, getEmployeeByUserId } from '@/shared/lib/firestore';
import type { ApiResponse, Booking, UserRole } from '@/shared/lib/types';

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












