import { NextRequest, NextResponse } from 'next/server';
import { getAvailability, getBlockedSlots, getBookings, getService } from '@/shared/lib/firestore';
import { addMinutesToTime, generateTimeSlots, isPastDate } from '@/shared/lib/utils';
import type { ApiResponse, AvailableSlotsResponse, TimeSlot } from '@/shared/lib/types';

// Minimum minutes ahead required for booking (e.g., 30 minutes buffer)
const MIN_BOOKING_BUFFER_MINUTES = 30;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId');
    const serviceId = searchParams.get('serviceId');
    const date = searchParams.get('date');

    if (!employeeId || !serviceId || !date) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'employeeId, serviceId, and date are required',
        },
        { status: 400 }
      );
    }

    if (isPastDate(date)) {
      return NextResponse.json<ApiResponse<AvailableSlotsResponse>>({
        success: true,
        data: {
          date,
          slots: [],
        },
      });
    }

    // Get service to know duration
    const service = await getService(serviceId);
    if (!service) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Service not found',
        },
        { status: 404 }
      );
    }

    // Get employee availability for the day of week
    const dateObj = new Date(`${date}T12:00:00`);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[dateObj.getDay()];
    let availabilityList = await getAvailability(employeeId, serviceId);
    if (!availabilityList.length) {
      availabilityList = await getAvailability(employeeId);
    }

    const dayAvailabilities = availabilityList.filter((a) => {
      if (a.dayOfWeek !== dayOfWeek || !a.isAvailable) return false;
      if (a.startDate && date < a.startDate) return false;
      if (a.endDate && date > a.endDate) return false;
      return true;
    });

    if (dayAvailabilities.length === 0) {
      return NextResponse.json<ApiResponse<AvailableSlotsResponse>>({
        success: true,
        data: {
          date,
          slots: [],
        },
      });
    }

    // Generate time slots for all windows, dedupe and sort
    const slotSet = new Set<string>();
    dayAvailabilities.forEach((avail) => {
      generateTimeSlots(avail.startTime, avail.endTime, service.duration).forEach((slot) =>
        slotSet.add(slot)
      );
    });
    const allSlots = Array.from(slotSet).sort();

    const [bookings, blockedSlots] = await Promise.all([
      // Existing bookings for the day
      getBookings({
        employeeId,
        startDate: date,
        endDate: date,
      }),
      // Slots the employee manually blocked
      getBlockedSlots({
        employeeId,
        serviceId,
        startDate: date,
        endDate: date,
      }),
    ]);

    const blockedSlotsForDay = blockedSlots.filter((slot) => slot.date === date);

    const toMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    // Treat any non-cancelled booking as blocking the slot (confirmed + completed, etc.)
    const bookedSlots = bookings
      .filter((b) => b.status !== 'cancelled' && b.bookingDate === date)
      .map((b) => b.bookingTime);

    // Check if this is today to filter out past slots
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const isToday = date === today;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    // Add buffer time - slots must be at least MIN_BOOKING_BUFFER_MINUTES in the future
    const minimumSlotTime = currentMinutes + MIN_BOOKING_BUFFER_MINUTES;

    // Filter out booked slots, blocked slots, and past slots
    const availableSlots: TimeSlot[] = allSlots.map((slot) => {
      const slotTime = toMinutes(slot);
      const slotEndTime = slotTime + service.duration;

      // Check if slot is in the past (for today only)
      const isPastSlot = isToday && slotTime < minimumSlotTime;

      const isBooked = bookedSlots.some((bookedTime) => {
        // Check if this slot conflicts with any booking
        const bookedTimeMinutes = toMinutes(bookedTime);
        const bookedEndTime = bookedTimeMinutes + service.duration;

        return (
          (slotTime >= bookedTimeMinutes &&
            slotTime < bookedEndTime) ||
          (bookedTimeMinutes >= slotTime && bookedTimeMinutes < slotEndTime)
        );
      });

      const isBlocked = blockedSlotsForDay.some((blocked) => {
        const blockStart = toMinutes(blocked.startTime);
        const blockEnd = blocked.endTime
          ? toMinutes(blocked.endTime)
          : toMinutes(addMinutesToTime(blocked.startTime, service.duration));

        return (
          (slotTime >= blockStart && slotTime < blockEnd) ||
          (blockStart >= slotTime && blockStart < slotEndTime)
        );
      });

      return {
        time: slot,
        available: !isPastSlot && !isBooked && !isBlocked,
      };
    });

    return NextResponse.json<ApiResponse<AvailableSlotsResponse>>({
      success: true,
      data: {
        date,
        slots: availableSlots,
      },
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to fetch available slots',
      },
      { status: 500 }
    );
  }
}
