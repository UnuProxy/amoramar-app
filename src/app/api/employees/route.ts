import { NextRequest, NextResponse } from 'next/server';
import { getEmployees, createEmployee } from '@/shared/lib/firestore';
import type { ApiResponse, Employee, EmployeeFormData } from '@/shared/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const salonId = searchParams.get('salonId') || undefined;

    const employees = await getEmployees(salonId);

    return NextResponse.json<ApiResponse<Employee[]>>({
      success: true,
      data: employees,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to fetch employees',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data: EmployeeFormData = await request.json();

    // In production, get salonId from authenticated user context
    const salonId = 'default-salon-id';

    const employeeId = await createEmployee({
      userId: '', // Will be set when creating user account
      salonId,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || '',
      bio: data.bio,
      profileImage: data.profileImage,
      status: 'active',
    });

    return NextResponse.json<ApiResponse<{ id: string }>>({
      success: true,
      data: { id: employeeId },
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to create employee',
      },
      { status: 500 }
    );
  }
}




















