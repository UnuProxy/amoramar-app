import { NextRequest, NextResponse } from 'next/server';
import { getBookings, createBooking, getService, getEmployee, getEmployeeServices } from '@/shared/lib/firestore';
import { sendAdminBookingNotification, sendEmployeeNotification } from '@/shared/lib/email';
import type { ApiResponse, Booking, BookingFormData } from '@/shared/lib/types';
import { getPaymentIntent } from '@/shared/lib/stripe';
import { BookingScheduleValidationError, validateBookingSchedule } from '@/shared/lib/bookingAvailability';
import { enqueueWhatsAppJobsForConfirmedBooking } from '@/shared/lib/whatsappJobs';
import { enqueueEmailConfirmationForBooking, enqueueEmailReminderForBooking } from '@/shared/lib/emailReminderJobs';

export const runtime = 'nodejs';

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
    const deferNotificationsUntilPaid = data.deferNotificationsUntilPaid === true;
    const createdByRole = data.createdByRole ?? (allowUnpaid ? (isConsultation ? 'client' : 'employee') : 'client');
    const createdByName = data.createdByName ?? (createdByRole === 'client' ? data.clientName : undefined);
    const createdByUserId = data.createdByUserId;
    const isStaffManagedBooking = createdByRole === 'owner' || createdByRole === 'employee';
    const isOfflineStaffDeposit = isStaffManagedBooking && !allowUnpaid && !data.paymentIntentId;

    if (!process.env.STRIPE_SECRET_KEY && !allowUnpaid && !isOfflineStaffDeposit) {
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

    if (!employee) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Employee not found for this booking',
        },
        { status: 404 }
      );
    }

    if (createdByRole === 'employee') {
      const employeeServices = await getEmployeeServices(data.employeeId, data.serviceId);
      const canOfferService = employeeServices.some((employeeService) => employeeService.isOffered !== false);

      if (!canOfferService) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'You can only create bookings for services assigned to you.',
          },
          { status: 403 }
        );
      }
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
    if (!allowUnpaid && !isOfflineStaffDeposit) {
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
    } else if (!allowUnpaid && isOfflineStaffDeposit) {
      // Staff can register cash/POS deposits without Stripe when payment is handled externally.
      if (typeof data.depositAmount === 'number' && Number.isFinite(data.depositAmount) && data.depositAmount >= 0) {
        depositAmount = Math.round(data.depositAmount);
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
      paymentNotes: data.paymentNotes || undefined,
      finalPaymentMethod: !allowUnpaid ? data.finalPaymentMethod : undefined,
      isConsultation,
      consultationDuration: isConsultation ? data.consultationDuration : undefined,
    });

    // Skip WhatsApp only for unpaid client online bookings (pending deposit). Staff manual bookings
    // (createdByRole !== 'client') still enqueue, including allowUnpaid.
    const shouldEnqueueWhatsApp = !deferNotificationsUntilPaid && (isConsultation || !allowUnpaid || createdByRole !== 'client');

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
          paymentNotes: data.paymentNotes || undefined,
          finalPaymentMethod: !allowUnpaid ? data.finalPaymentMethod : undefined,
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
    let adminEmailSent: boolean | undefined;
    let adminEmailError: string | undefined;

    if (!service || !employee) {
      console.error('Service or employee not found for email notification');
    } else {
      const bookingStatus = isConsultation ? 'confirmed' : (allowUnpaid ? 'pending' : 'confirmed');
      const clientEmailTrimmed = data.clientEmail?.trim() || '';
      if (clientEmailTrimmed && !deferNotificationsUntilPaid) {
        const confirmationQueueResult = await enqueueEmailConfirmationForBooking({
          id: bookingId,
          clientName: data.clientName,
          clientEmail: clientEmailTrimmed,
          serviceName: isConsultation ? `Consulta Gratuita - ${service.serviceName}` : service.serviceName,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          bookingDate: data.bookingDate,
          bookingTime: data.bookingTime,
          status: isConsultation ? 'confirmed' : (allowUnpaid ? 'pending' : 'confirmed'),
          duration: isConsultation && data.consultationDuration ? data.consultationDuration : service.duration,
          price: isConsultation ? '0' : servicePrice.toString(),
        });
        if (!confirmationQueueResult.queued && confirmationQueueResult.skippedReason !== 'already_handled') {
          emailSent = false;
          emailError = `confirmation_queue_skipped:${confirmationQueueResult.skippedReason || 'unknown'}`;
          console.error('[email] confirmation enqueue skipped for booking', bookingId, emailError);
        }
      } else if (!deferNotificationsUntilPaid) {
        console.warn('[email] skip confirmation: no client email', bookingId);
        emailSent = false;
        emailError = 'missing_client_email';
      }

      if (!deferNotificationsUntilPaid) {
        enqueueEmailReminderForBooking({
          id: bookingId,
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          serviceName: isConsultation ? `Consulta Gratuita - ${service.serviceName}` : service.serviceName,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          bookingDate: data.bookingDate,
          bookingTime: data.bookingTime,
          status: isConsultation ? 'confirmed' : (allowUnpaid ? 'pending' : 'confirmed'),
        }).catch((error) => console.error('[email] reminder enqueue failed for booking', bookingId, error));
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

      if (createdByRole === 'client') {
        const adminNotificationResult = await sendAdminBookingNotification({
          bookingId,
          clientName: data.clientName,
          clientEmail: clientEmailTrimmed || data.clientEmail,
          clientPhone: data.clientPhone,
          serviceName: isConsultation ? `Consulta Gratuita - ${service.serviceName}` : service.serviceName,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          bookingDate: data.bookingDate,
          bookingTime: data.bookingTime,
          status: bookingStatus,
          isConsultation,
          depositAmount: isConsultation ? 0 : depositAmount,
        });
        adminEmailSent = adminNotificationResult.success;
        if (!adminNotificationResult.success) {
          adminEmailError = adminNotificationResult.error || 'admin_notification_failed';
          console.error('[email] admin booking notification failed for booking', bookingId, adminEmailError);
        }
      }
    }

    return NextResponse.json<
      ApiResponse<{
        id: string;
        emailSent?: boolean;
        emailError?: string;
        adminEmailSent?: boolean;
        adminEmailError?: string;
        whatsappAttempted?: boolean;
        whatsappError?: string;
      }>
    >({
      success: true,
      data: {
        id: bookingId,
        whatsappAttempted,
        ...(whatsappError && { whatsappError }),
        ...(emailSent !== undefined && { emailSent }),
        ...(emailError && { emailError }),
        ...(adminEmailSent !== undefined && { adminEmailSent }),
        ...(adminEmailError && { adminEmailError }),
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
