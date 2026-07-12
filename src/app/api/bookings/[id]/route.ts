import { NextRequest, NextResponse } from 'next/server';
import { getBooking } from '@/shared/lib/firestore';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import type { ApiResponse, Booking, UserRole } from '@/shared/lib/types';
import { BookingScheduleValidationError, validateBookingSchedule } from '@/shared/lib/bookingAvailability';
import { enqueueWhatsAppJobsForConfirmedBooking, refreshQueuedWhatsAppReminderForBooking } from '@/shared/lib/whatsappJobs';
import {
  enqueueEmailConfirmationForBooking,
  enqueueEmailReminderForBooking,
  refreshQueuedEmailReminderForBooking,
} from '@/shared/lib/emailReminderJobs';

export const runtime = 'nodejs';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new BookingScheduleValidationError('Invalid booking time format.', 400);
  }
  return hours * 60 + minutes;
};

const overlaps = (startA: number, endA: number, startB: number, endB: number): boolean => {
  return startA < endB && startB < endA;
};

const withoutUndefined = <T extends Record<string, any>>(value: T): T => {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
};

const getBookingEmailDetails = async (booking: Booking) => {
  const db = getAdminDb();
  const [serviceSnap, employeeSnap] = await Promise.all([
    db.collection('services').doc(booking.serviceId).get(),
    db.collection('employees').doc(booking.employeeId).get(),
  ]);
  const service = serviceSnap.data() as
    | { serviceName?: string; duration?: number; price?: number | string }
    | undefined;
  const employee = employeeSnap.data() as
    | { firstName?: string; lastName?: string }
    | undefined;
  const baseServiceName = service?.serviceName || booking.serviceName || 'Servicio';

  return {
    serviceName: booking.isConsultation ? `Consulta Gratuita - ${baseServiceName}` : baseServiceName,
    employeeName:
      `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || 'Amor Amar',
    duration:
      booking.isConsultation && booking.consultationDuration
        ? booking.consultationDuration
        : Number(service?.duration || 0),
    price: booking.isConsultation ? '0' : String(service?.price || '0'),
  };
};

const validateBookingScheduleWithAdminDb = async ({
  employeeId,
  serviceId,
  bookingDate,
  bookingTime,
  isConsultation = false,
  consultationDuration,
  excludeBookingId,
  skipScheduleValidation = false,
}: {
  employeeId: string;
  serviceId: string;
  bookingDate: string;
  bookingTime: string;
  isConsultation?: boolean;
  consultationDuration?: number;
  excludeBookingId?: string;
  skipScheduleValidation?: boolean;
}) => {
  const db = getAdminDb();
  const serviceSnap = await db.collection('services').doc(serviceId).get();
  if (!serviceSnap.exists) {
    throw new BookingScheduleValidationError('Service not found for this booking.', 404);
  }

  const service = serviceSnap.data() as any;
  const requestedDuration = isConsultation
    ? consultationDuration || service.consultationDuration || 20
    : service.duration;

  if (!requestedDuration || requestedDuration <= 0) {
    throw new BookingScheduleValidationError('Service duration is invalid.', 400);
  }

  const dateObj = new Date(`${bookingDate}T12:00:00`);
  if (Number.isNaN(dateObj.getTime())) {
    throw new BookingScheduleValidationError('Invalid booking date.', 400);
  }

  const requestedStart = toMinutes(bookingTime);
  const requestedEnd = requestedStart + requestedDuration;
  const dayOfWeek = DAY_NAMES[dateObj.getDay()];

  if (!skipScheduleValidation) {
    const availabilitySnap = await db.collection('availability').where('employeeId', '==', employeeId).get();
    const allAvailability = availabilitySnap.docs.map((doc) => doc.data() as any);
    const genericAvailability = allAvailability.filter((item) => !item.serviceId);
    const availability =
      genericAvailability.length > 0
        ? genericAvailability
        : allAvailability.filter((item) => item.serviceId === serviceId);
    const dayAvailabilities = availability.filter((item) => {
      if (!item.isAvailable) return false;
      if (item.dayOfWeek !== dayOfWeek) return false;
      if (item.startDate && bookingDate < item.startDate) return false;
      if (item.endDate && bookingDate > item.endDate) return false;
      return true;
    });

    if (dayAvailabilities.length === 0) {
      throw new BookingScheduleValidationError('Employee has no working schedule for this date.');
    }

    const fitsInWorkingSchedule = dayAvailabilities.some((item) => {
      const windowStart = toMinutes(item.startTime);
      const windowEnd = toMinutes(item.endTime);
      return requestedStart >= windowStart && requestedEnd <= windowEnd;
    });

    if (!fitsInWorkingSchedule) {
      throw new BookingScheduleValidationError(
        `This booking does not fit the employee's work schedule. ${requestedDuration} minutes are required.`
      );
    }
  }

  const [bookingsSnap, blockedSlotsSnap] = await Promise.all([
    db
      .collection('bookings')
      .where('employeeId', '==', employeeId)
      .where('bookingDate', '==', bookingDate)
      .get(),
    db
      .collection('blockedSlots')
      .where('employeeId', '==', employeeId)
      .where('date', '==', bookingDate)
      .get(),
  ]);

  const dayBookings = bookingsSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Booking, 'id'>) } as Booking))
    .filter((booking) => {
      if (booking.status === 'cancelled') return false;
      if (excludeBookingId && booking.id === excludeBookingId) return false;
      return booking.bookingDate === bookingDate;
    });

  const serviceIdsToLoad = Array.from(
    new Set(dayBookings.filter((booking) => !booking.isConsultation).map((booking) => booking.serviceId))
  );
  const servicesById = new Map<string, number>();
  await Promise.all(
    serviceIdsToLoad.map(async (id) => {
      const dayServiceSnap = await db.collection('services').doc(id).get();
      if (dayServiceSnap.exists) {
        servicesById.set(id, Number((dayServiceSnap.data() as any).duration));
      }
    })
  );

  for (const booking of dayBookings) {
    const existingDuration = booking.isConsultation
      ? booking.consultationDuration || 20
      : servicesById.get(booking.serviceId) || requestedDuration;
    const existingStart = toMinutes(booking.bookingTime);
    const existingEnd = existingStart + existingDuration;

    if (overlaps(requestedStart, requestedEnd, existingStart, existingEnd)) {
      throw new BookingScheduleValidationError('This employee already has another booking in that time range.');
    }
  }

  const blocksForDay = blockedSlotsSnap.docs.map((doc) => doc.data() as any);
  for (const block of blocksForDay) {
    if (!skipScheduleValidation && block.serviceId && block.serviceId !== serviceId) continue;
    const blockStart = toMinutes(block.startTime);
    const blockEnd = block.endTime ? toMinutes(block.endTime) : blockStart + requestedDuration;

    if (overlaps(requestedStart, requestedEnd, blockStart, blockEnd)) {
      throw new BookingScheduleValidationError('This time range is blocked in the employee schedule.');
    }
  }
};

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

    const db = getAdminDb();
    const bookingRef = db.collection('bookings').doc(id);
    const bookingSnap = await bookingRef.get();
    const booking = bookingSnap.exists
      ? ({ id: bookingSnap.id, ...(bookingSnap.data() as Omit<Booking, 'id'>) } as Booking)
      : null;

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

      const employeeSnap = await db.collection('employees').where('userId', '==', actorUserId).limit(1).get();
      const employee = employeeSnap.empty ? null : { id: employeeSnap.docs[0]!.id, ...(employeeSnap.docs[0]!.data() as any) };
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
      const validationInput = {
          employeeId: updates.employeeId || booking.employeeId,
          serviceId: updates.serviceId || booking.serviceId,
          bookingDate: updates.bookingDate || booking.bookingDate,
          bookingTime: updates.bookingTime || booking.bookingTime,
          isConsultation: updates.isConsultation ?? booking.isConsultation,
          consultationDuration: updates.consultationDuration ?? booking.consultationDuration,
          excludeBookingId: booking.id,
          skipScheduleValidation: actorRole === 'owner' || actorRole === 'employee' || actorRole === 'admin',
        };

      try {
        await validateBookingScheduleWithAdminDb(validationInput);
      } catch (error: any) {
        if (String(error?.message || '').includes('Firebase Admin SDK is not configured')) {
          await validateBookingSchedule(validationInput);
        } else {
          throw error;
        }
      }
    }

    const statusBefore = booking.status;
    const statusAfter = updates.status ?? booking.status;
    const scheduleChanged =
      (typeof updates.bookingDate === 'string' && updates.bookingDate !== booking.bookingDate) ||
      (typeof updates.bookingTime === 'string' && updates.bookingTime !== booking.bookingTime);

    await bookingRef.set(
      withoutUndefined({
        ...updates,
        updatedAt: Timestamp.now(),
      }),
      { merge: true }
    );

    if (scheduleChanged) {
      const refreshedBooking = {
        ...booking,
        ...updates,
        id: booking.id,
        status: statusAfter,
      } as Booking;

      const refreshEmailReminder = async () => {
        const refreshResult = await refreshQueuedEmailReminderForBooking(refreshedBooking);
        if (refreshResult.skippedReason !== 'missing_job' || !refreshedBooking.clientEmail?.trim()) {
          return;
        }

        const details = await getBookingEmailDetails(refreshedBooking);
        await enqueueEmailReminderForBooking({
          ...refreshedBooking,
          serviceName: details.serviceName,
          employeeName: details.employeeName,
        });
      };

      await Promise.allSettled([
        refreshEmailReminder().catch((error) => {
          console.error('Failed to refresh email reminder after booking schedule change:', id, error);
        }),
        refreshQueuedWhatsAppReminderForBooking(refreshedBooking).catch((error) => {
          console.error('Failed to refresh WhatsApp reminder after booking schedule change:', id, error);
        }),
      ]);
    }

    if (statusBefore !== 'confirmed' && statusAfter === 'confirmed') {
      const confirmedBooking = {
        ...booking,
        ...updates,
        id: booking.id,
        status: 'confirmed',
      } as Booking;

      try {
        await enqueueWhatsAppJobsForConfirmedBooking({
          ...confirmedBooking,
        });
      } catch (whatsAppError) {
        console.error('Failed to enqueue WhatsApp jobs on booking confirmation:', whatsAppError);
      }

      if (confirmedBooking.clientEmail?.trim()) {
        try {
          const details = await getBookingEmailDetails(confirmedBooking);
          await Promise.all([
            enqueueEmailConfirmationForBooking({
              ...confirmedBooking,
              serviceName: details.serviceName,
              employeeName: details.employeeName,
              duration: details.duration,
              price: details.price,
            }),
            enqueueEmailReminderForBooking({
              ...confirmedBooking,
              serviceName: details.serviceName,
              employeeName: details.employeeName,
            }),
          ]);
        } catch (emailError) {
          console.error('Failed to enqueue emails on booking confirmation:', emailError);
        }
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













