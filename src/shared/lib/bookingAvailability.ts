import { getAvailability, getBlockedSlots, getBookings, getService } from '@/shared/lib/firestore';
import type { Booking } from '@/shared/lib/types';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export class BookingScheduleValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 409) {
    super(message);
    this.name = 'BookingScheduleValidationError';
    this.statusCode = statusCode;
  }
}

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

type ValidateBookingScheduleInput = {
  employeeId: string;
  serviceId: string;
  bookingDate: string;
  bookingTime: string;
  isConsultation?: boolean;
  consultationDuration?: number;
  excludeBookingId?: string;
};

export const validateBookingSchedule = async ({
  employeeId,
  serviceId,
  bookingDate,
  bookingTime,
  isConsultation = false,
  consultationDuration,
  excludeBookingId,
}: ValidateBookingScheduleInput): Promise<void> => {
  const service = await getService(serviceId);
  if (!service) {
    throw new BookingScheduleValidationError('Service not found for this booking.', 404);
  }

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

  const allAvailability = await getAvailability(employeeId);
  const genericAvailability = allAvailability.filter((a) => !a.serviceId);
  const availability =
    genericAvailability.length > 0
      ? genericAvailability
      : allAvailability.filter((a) => a.serviceId === serviceId);
  const dayAvailabilities = availability.filter((a) => {
    if (!a.isAvailable) return false;
    if (a.dayOfWeek !== dayOfWeek) return false;
    if (a.startDate && bookingDate < a.startDate) return false;
    if (a.endDate && bookingDate > a.endDate) return false;
    return true;
  });

  if (dayAvailabilities.length === 0) {
    throw new BookingScheduleValidationError('Employee has no working schedule for this date.');
  }

  const fitsInWorkingSchedule = dayAvailabilities.some((a) => {
    const windowStart = toMinutes(a.startTime);
    const windowEnd = toMinutes(a.endTime);
    return requestedStart >= windowStart && requestedEnd <= windowEnd;
  });

  if (!fitsInWorkingSchedule) {
    throw new BookingScheduleValidationError(
      `This booking does not fit the employee's work schedule. ${requestedDuration} minutes are required.`
    );
  }

  const [bookings, blockedSlots] = await Promise.all([
    getBookings({ employeeId, startDate: bookingDate, endDate: bookingDate }),
    getBlockedSlots({ employeeId, serviceId, startDate: bookingDate, endDate: bookingDate }),
  ]);

  const dayBookings = bookings.filter((booking) => {
    if (booking.status === 'cancelled') return false;
    if (excludeBookingId && booking.id === excludeBookingId) return false;
    return booking.bookingDate === bookingDate;
  });

  const serviceIdsToLoad = Array.from(
    new Set(dayBookings.filter((b) => !b.isConsultation).map((b) => b.serviceId))
  );
  const servicesById = new Map<string, number>();

  await Promise.all(
    serviceIdsToLoad.map(async (id) => {
      const dayService = await getService(id);
      if (dayService) {
        servicesById.set(id, dayService.duration);
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

  const blocksForDay = blockedSlots.filter((slot) => slot.date === bookingDate);
  for (const block of blocksForDay) {
    const blockStart = toMinutes(block.startTime);
    const blockEnd = block.endTime ? toMinutes(block.endTime) : blockStart + requestedDuration;

    if (overlaps(requestedStart, requestedEnd, blockStart, blockEnd)) {
      throw new BookingScheduleValidationError('This time range is blocked in the employee schedule.');
    }
  }
};
