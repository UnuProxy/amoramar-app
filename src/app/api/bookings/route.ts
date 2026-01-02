import { NextRequest, NextResponse } from 'next/server';
import { getBookings, createBooking, getService, getEmployee } from '@/shared/lib/firestore';
import { sendBookingConfirmation, sendEmployeeNotification } from '@/shared/lib/email';
import type { ApiResponse, Booking, BookingFormData } from '@/shared/lib/types';
import { getPaymentIntent } from '@/shared/lib/stripe';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filters: any = {};

    if (searchParams.get('salonId')) {
      filters.salonId = searchParams.get('salonId');
    }
    if (searchParams.get('employeeId')) {
      filters.employeeId = searchParams.get('employeeId');
    }
    if (searchParams.get('status')) {
      filters.status = searchParams.get('status');
    }
    if (searchParams.get('startDate')) {
      filters.startDate = searchParams.get('startDate');
    }
    if (searchParams.get('endDate')) {
      filters.endDate = searchParams.get('endDate');
    }

    const bookings = await getBookings(filters);

    return NextResponse.json<ApiResponse<Booking[]>>({
      success: true,
      data: bookings,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to fetch bookings',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data: BookingFormData = await request.json();

    // In production, get salonId from authenticated user context or service
    const salonId = 'default-salon-id';

    const allowUnpaid = data.allowUnpaid === true;
    const createdByRole = data.createdByRole ?? (allowUnpaid ? 'employee' : 'client');
    const createdByName = data.createdByName ?? (createdByRole === 'client' ? data.clientName : undefined);
    const createdByUserId = data.createdByUserId;

    if (!process.env.STRIPE_SECRET_KEY && !allowUnpaid) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Payment processing is not configured. Please contact support.',
        },
        { status: 500 }
      );
    }

    const [service, employee] = await Promise.all([
      getService(data.serviceId),
      getEmployee(data.employeeId),
    ]);

    if (!service) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Service not found for this booking',
        },
        { status: 404 }
      );
    }

    const servicePrice = typeof service.price === 'string'
      ? parseFloat(service.price)
      : service.price;

    if (!servicePrice || Number.isNaN(servicePrice)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Service price is not configured correctly.',
        },
        { status: 400 }
      );
    }

    const expectedDeposit = Math.round((servicePrice * 0.5) * 100);

    let depositAmount = expectedDeposit;
    if (!allowUnpaid) {
      if (!data.paymentIntentId) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'Payment is required to confirm the booking. Please complete the deposit.',
          },
          { status: 400 }
        );
      }

      const paymentIntent = await getPaymentIntent(data.paymentIntentId);
      if (paymentIntent.status !== 'succeeded') {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'The payment for this booking was not completed. Please try again.',
          },
          { status: 400 }
        );
      }

      depositAmount = paymentIntent.amount_received || paymentIntent.amount || 0;

      if (depositAmount < expectedDeposit) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'The deposit paid does not match the required amount.',
          },
          { status: 400 }
        );
      }
    }

    // Create the booking
    const bookingId = await createBooking({
      salonId,
      employeeId: data.employeeId,
      serviceId: data.serviceId,
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      clientPhone: data.clientPhone,
      bookingDate: data.bookingDate,
      bookingTime: data.bookingTime,
      status: allowUnpaid ? 'pending' : 'confirmed',
      createdByRole,
      createdByName,
      createdByUserId,
      notes: data.notes || undefined,
      requiresDeposit: true,
      depositAmount,
      depositPaid: !allowUnpaid,
      paymentIntentId: data.paymentIntentId,
      paymentStatus: allowUnpaid ? 'pending' : 'paid',
    });

    if (!service || !employee) {
      console.error('Service or employee not found for email notification');
    } else {
      // Send confirmation email to client (async, don't wait)
      sendBookingConfirmation({
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        serviceName: service.serviceName,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        bookingDate: data.bookingDate,
        bookingTime: data.bookingTime,
        duration: service.duration,
        price: servicePrice.toString(),
      }).catch((error) => console.error('Error sending confirmation email:', error));

      // Send notification email to employee (async, don't wait)
      // NOTE: Resend free tier can only send to verified email (unujulian@gmail.com)
      // To enable employee notifications, verify a domain at resend.com/domains
      if (employee.email && employee.email === 'unujulian@gmail.com') {
        sendEmployeeNotification({
          employeeName: employee.firstName,
          employeeEmail: employee.email,
          clientName: data.clientName,
          serviceName: service.serviceName,
          bookingDate: data.bookingDate,
          bookingTime: data.bookingTime,
          action: 'new',
        }).catch((error) => console.error('Error sending employee notification:', error));
      }
    }

    return NextResponse.json<ApiResponse<{ id: string }>>({
      success: true,
      data: { id: bookingId },
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to create booking',
      },
      { status: 500 }
    );
  }
}
