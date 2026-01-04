import { NextRequest, NextResponse } from 'next/server';
import { getServices, createService, getEmployeeServices, getEmployees } from '@/shared/lib/firestore';
import type { ApiResponse, Service, ServiceFormData, Employee } from '@/shared/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const salonId = searchParams.get('salonId') || undefined;
    const withEmployees = searchParams.get('withEmployees') === 'true';

    const services = await getServices(salonId);

    // If requested, filter services to only those with assigned employees and attach names
    if (withEmployees) {
      const allEmployees = await getEmployees(salonId);
      
      const servicesWithEmployees = await Promise.all(
        services.map(async (service) => {
          const employeeServices = await getEmployeeServices(undefined, service.id);
          const assignedEmployeeIds = employeeServices
            .filter(es => es.isOffered)
            .map(es => es.employeeId);
          
          if (assignedEmployeeIds.length === 0) return null;

          const assignedEmployees = allEmployees
            .filter(emp => assignedEmployeeIds.includes(emp.id))
            .map(emp => ({
              id: emp.id,
              firstName: emp.firstName,
              lastName: emp.lastName
            }));

          return {
            ...service,
            employees: assignedEmployees
          };
        })
      );
      
      const filtered = servicesWithEmployees.filter((s): s is Service => s !== null);
      
      return NextResponse.json<ApiResponse<Service[]>>({
        success: true,
        data: filtered,
      });
    }

    return NextResponse.json<ApiResponse<Service[]>>({
      success: true,
      data: services,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to fetch services',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data: ServiceFormData = await request.json();

    // In production, get salonId from authenticated user context
    const salonId = 'default-salon-id';

    const serviceId = await createService({
      salonId,
      serviceName: data.serviceName,
      description: data.description,
      duration: data.duration,
      price: data.price,
      category: data.category,
      isActive: true,
    });

    return NextResponse.json<ApiResponse<{ id: string }>>({
      success: true,
      data: { id: serviceId },
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to create service',
      },
      { status: 500 }
    );
  }
}




