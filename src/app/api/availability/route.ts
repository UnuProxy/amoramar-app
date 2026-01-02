import { NextRequest, NextResponse } from 'next/server';
import { getAvailability, createAvailability } from '@/shared/lib/firestore';
import type { ApiResponse, Availability, AvailabilityFormData } from '@/shared/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId');
    const serviceId = searchParams.get('serviceId') || undefined;

    if (!employeeId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'employeeId is required',
        },
        { status: 400 }
      );
    }

    const availability = await getAvailability(employeeId, serviceId || undefined);

    return NextResponse.json<ApiResponse<Availability[]>>({
      success: true,
      data: availability,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to fetch availability',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data: AvailabilityFormData = await request.json();

    const availabilityId = await createAvailability({
      employeeId: data.employeeId,
      serviceId: data.serviceId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      isAvailable: data.isAvailable,
      startDate: data.startDate,
      endDate: data.endDate,
    });

    return NextResponse.json<ApiResponse<{ id: string }>>({
      success: true,
      data: { id: availabilityId },
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to create availability',
      },
      { status: 500 }
    );
  }
}














