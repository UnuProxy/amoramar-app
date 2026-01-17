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
    
    console.log('[API DELETE Employee] Request received for employee ID:', id);
    
    if (!id || id.trim() === '') {
      console.error('[API DELETE Employee] Missing employee ID');
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Employee ID is required',
        },
        { status: 400 }
      );
    }

    console.log('[API DELETE Employee] Calling deleteEmployee...');
    await deleteEmployee(id);
    console.log('[API DELETE Employee] Employee deleted successfully');

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      data: null,
    });
  } catch (error: any) {
    console.error('[API DELETE Employee] Error occurred:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      fullError: error,
    });
    
    // Check for permission errors
    if (error.message?.includes('PERMISSION_DENIED') || error.message?.includes('permission')) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Permission denied. You must be logged in as the salon owner to delete employees.',
        },
        { status: 403 }
      );
    }
    
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



















