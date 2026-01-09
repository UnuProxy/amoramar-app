import { NextRequest, NextResponse } from 'next/server';
import { sendBookingCancellation, sendBookingReschedule } from '@/shared/lib/email';
import { getService, getEmployee } from '@/shared/lib/firestore';
import type { ApiResponse } from '@/shared/lib/types';

interface CancellationRequest {
  type: 'cancellation';
  bookingId: string;
  clientName: string;
  clientEmail: string;
  serviceId: string;
  employeeId: string;
  bookingDate: string;
  bookingTime: string;
}

interface RescheduleRequest {
  type: 'reschedule';
  bookingId: string;
  clientName: string;
  clientEmail: string;
  serviceId: string;
  employeeId: string;
  oldBookingDate: string;
  oldBookingTime: string;
  newBookingDate: string;
  newBookingTime: string;
}

type NotificationRequest = CancellationRequest | RescheduleRequest;

export async function POST(request: NextRequest) {
  try {
    const data: NotificationRequest = await request.json();

    // Fetch service and employee details
    const [service, employee] = await Promise.all([
      getService(data.serviceId),
      getEmployee(data.employeeId),
    ]);

    if (!service || !employee) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Service or employee not found',
        },
        { status: 404 }
      );
    }

    const employeeName = `${employee.firstName} ${employee.lastName}`;

    if (data.type === 'cancellation') {
      // Send cancellation email
      const result = await sendBookingCancellation({
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        serviceName: service.serviceName,
        employeeName,
        bookingDate: data.bookingDate,
        bookingTime: data.bookingTime,
      });

      if (!result.success) {
        console.error('Failed to send cancellation email:', result.error);
      }

      return NextResponse.json<ApiResponse<{ sent: boolean }>>({
        success: true,
        data: { sent: result.success },
      });
    } else if (data.type === 'reschedule') {
      // Send reschedule email
      const result = await sendBookingReschedule({
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        serviceName: service.serviceName,
        employeeName,
        oldBookingDate: data.oldBookingDate,
        oldBookingTime: data.oldBookingTime,
        newBookingDate: data.newBookingDate,
        newBookingTime: data.newBookingTime,
      });

      if (!result.success) {
        console.error('Failed to send reschedule email:', result.error);
      }

      return NextResponse.json<ApiResponse<{ sent: boolean }>>({
        success: true,
        data: { sent: result.success },
      });
    }

    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Invalid notification type',
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error sending notification:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to send notification',
      },
      { status: 500 }
    );
  }
}












