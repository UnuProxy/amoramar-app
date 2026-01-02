import { NextRequest, NextResponse } from 'next/server';
import { getEmployees, getEmployeeServices } from '@/shared/lib/firestore';
import type { ApiResponse, Employee } from '@/shared/lib/types';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await context.params;

    // Get all employee-service relationships for this service
    const employeeServices = await getEmployeeServices(undefined, serviceId);
    const employeeIds = employeeServices
      .filter(es => es.isOffered)
      .map(es => es.employeeId);

    if (employeeIds.length === 0) {
      return NextResponse.json<ApiResponse<Employee[]>>({
        success: true,
        data: [],
      });
    }

    // Get all employees and filter by those who offer this service
    const allEmployees = await getEmployees();
    const serviceEmployees = allEmployees.filter(emp => 
      employeeIds.includes(emp.id) && emp.status === 'active'
    );

    return NextResponse.json<ApiResponse<Employee[]>>({
      success: true,
      data: serviceEmployees,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to fetch employees for service',
      },
      { status: 500 }
    );
  }
}
