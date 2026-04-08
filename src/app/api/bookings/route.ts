import { NextRequest, NextResponse } from 'next/server';
import { getBookings, createBooking, getService, getEmployee } from '@/shared/lib/firestore';
import { sendBookingConfirmation, sendEmployeeNotification } from '@/shared/lib/email';
import type { ApiResponse, Booking, BookingFormData } from '@/shared/lib/types';
import { getPaymentIntent } from '@/shared/lib/stripe';
import { BookingScheduleValidationError, validateBookingSchedule } from '@/shared/lib/bookingAvailability';
import { enqueueWhatsAppJobsForConfirmedBooking } from '@/shared/lib/whatsappJobs';

export const runtime = 'nodejs';
const EMAIL_CONFIRMATIONS_ENABLED = process.env.ENABLE_BOOKING_EMAILS === 'true';

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

    const isConsultation = data.isConsultation === true;
    const allowUnpaid = data.allowUnpaid === true || isConsultation;
    const createdByRole = data.createdByRole ?? (allowUnpaid ? (isConsultation ? 'client' : 'employee') : 'client');
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

    const isClientOnlineBooking = createdByRole === 'client';
    const isBleachHighlightsService = service.category === 'hair-bleach-highlights';
    if (isClientOnlineBooking && isBleachHighlightsService) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'This service requires a prior consultation and cannot be booked online.',
        },
        { status: 400 }
      );
    }

    await validateBookingSchedule({
      employeeId: data.employeeId,
      serviceId: data.serviceId,
      bookingDate: data.bookingDate,
      bookingTime: data.bookingTime,
      isConsultation: isConsultation,
      consultationDuration: data.consultationDuration,
      skipScheduleValidation: createdByRole !== 'client',
    });

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

      if (paymentIntent.currency !== 'eur') {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'Invalid payment currency for this booking.',
          },
          { status: 400 }
        );
      }

      const metadataServiceId = paymentIntent.metadata?.serviceId;
      if (metadataServiceId && metadataServiceId !== data.serviceId) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'The payment does not match the selected service.',
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
      serviceName: service.serviceName,
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      clientPhone: data.clientPhone,
      clientPhoneE164: data.clientPhoneE164 || data.clientPhone,
      whatsappOptIn: data.whatsappOptIn ?? true,
      bookingDate: data.bookingDate,
      bookingTime: data.bookingTime,
      status: isConsultation ? 'confirmed' : (allowUnpaid ? 'pending' : 'confirmed'),
      createdByRole,
      createdByName,
      createdByUserId,
      notes: data.notes || undefined,
      requiresDeposit: !isConsultation,
      depositAmount: isConsultation ? 0 : depositAmount,
      depositPaid: isConsultation ? true : !allowUnpaid,
      paymentIntentId: data.paymentIntentId,
      paymentStatus: isConsultation ? 'paid' : (allowUnpaid ? 'pending' : 'deposit_paid'),
      isConsultation,
      consultationDuration: isConsultation ? data.consultationDuration : undefined,
    });

    // Skip WhatsApp only for unpaid client online bookings (pending deposit). Staff manual bookings
    // (createdByRole !== 'client') still enqueue, including allowUnpaid.
    const shouldEnqueueWhatsApp = isConsultation || !allowUnpaid || createdByRole !== 'client';

    let whatsappAttempted = false;
    let whatsappError: string | undefined;
    if (shouldEnqueueWhatsApp) {
      whatsappAttempted = true;
      try {
        const waResult = await enqueueWhatsAppJobsForConfirmedBooking({
          id: bookingId,
          salonId,
          employeeId: data.employeeId,
          serviceId: data.serviceId,
          serviceName: service.serviceName,
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          clientPhone: data.clientPhone,
          clientPhoneE164: data.clientPhoneE164 || data.clientPhone,
          whatsappOptIn: data.whatsappOptIn ?? true,
          bookingDate: data.bookingDate,
          bookingTime: data.bookingTime,
          status: 'confirmed',
          createdByRole,
          createdByName,
          createdByUserId,
          notes: data.notes || undefined,
          requiresDeposit: !isConsultation,
          depositAmount: isConsultation ? 0 : depositAmount,
          depositPaid: isConsultation ? true : !allowUnpaid,
          paymentIntentId: data.paymentIntentId,
          paymentStatus: isConsultation ? 'paid' : (allowUnpaid ? 'pending' : 'deposit_paid'),
          isConsultation,
          consultationDuration: isConsultation ? data.consultationDuration : undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        if (!waResult.queued && waResult.skippedReason) {
          whatsappError = `skipped:${waResult.skippedReason}`;
        }
      } catch (whatsAppError) {
        whatsappError = String((whatsAppError as any)?.message || whatsAppError);
        console.error('Failed to enqueue WhatsApp jobs:', whatsappError);
      }
    } else {
      whatsappError = `skipped:policy_unpaid_client_booking (createdByRole=${createdByRole}, allowUnpaid=${allowUnpaid})`;
    }

    let emailSent: boolean | undefined;
    let emailError: string | undefined;

    if (!service || !employee) {
      console.error('Service or employee not found for email notification');
    } else {
      if (!EMAIL_CONFIRMATIONS_ENABLED) {
        emailSent = false;
        emailError = 'email_confirmations_paused';
      } else {
        const clientEmailTrimmed = data.clientEmail?.trim() || '';
        if (clientEmailTrimmed) {
          const emailResult = await sendBookingConfirmation({
            clientName: data.clientName,
            clientEmail: clientEmailTrimmed,
            serviceName: isConsultation ? `Consulta Gratuita - ${service.serviceName}` : service.serviceName,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            bookingDate: data.bookingDate,
            bookingTime: data.bookingTime,
            duration: isConsultation && data.consultationDuration ? data.consultationDuration : service.duration,
            price: isConsultation ? '0' : servicePrice.toString(),
          });
          emailSent = emailResult.success;
          emailError = emailResult.error;
          if (!emailResult.success) {
            console.error('[email] confirmation failed for booking', bookingId, emailResult.error);
          }
        } else {
          console.warn('[email] skip confirmation: no client email', bookingId);
          emailSent = false;
          emailError = 'missing_client_email';
        }
      }

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

    return NextResponse.json<
      ApiResponse<{ id: string; emailSent?: boolean; emailError?: string; whatsappAttempted?: boolean; whatsappError?: string }>
    >({
      success: true,
      data: {
        id: bookingId,
        whatsappAttempted,
        ...(whatsappError && { whatsappError }),
        ...(emailSent !== undefined && { emailSent }),
        ...(emailError && { emailError }),
      },
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
        error: error.message || 'Failed to create booking',
      },
      { status: 500 }
    );
  }
}
