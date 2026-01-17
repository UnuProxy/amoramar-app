import { NextRequest, NextResponse } from 'next/server';
import { getEmployee, updateEmployee, deleteEmployee } from '@/shared/lib/firestore';
import type { ApiResponse, Employee } from '@/shared/lib/types';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const employee = await getEmployee(id);

    if (!employee) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Employee not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<Employee>>({
      success: true,
      data: employee,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to fetch employee',
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
    const updates: Partial<Employee> = await request.json();

    await updateEmployee(id, updates);

    return NextResponse.json<ApiResponse<{ id: string }>>({
      success: true,
      data: { id },
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to update employee',
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
    
    if (!id || id.trim() === '') {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Employee ID is required',
        },
        { status: 400 }
      );
    }

    await deleteEmployee(id);

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      data: null,
    });
  } catch (error: any) {
    console.error('DELETE /api/employees/[id] error:', error);
    
    // Return appropriate status codes
    const status = error.message?.includes('not found') ? 404 : 500;
    
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to delete employee',
      },
      { status }
    );
  }
}



















