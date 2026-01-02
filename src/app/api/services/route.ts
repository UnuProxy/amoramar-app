import { NextRequest, NextResponse } from 'next/server';
import { getServices, createService, getEmployeeServices } from '@/shared/lib/firestore';
import type { ApiResponse, Service, ServiceFormData } from '@/shared/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const salonId = searchParams.get('salonId') || undefined;
    const withEmployees = searchParams.get('withEmployees') === 'true';

    const services = await getServices(salonId);

    // If requested, filter services to only those with assigned employees
    if (withEmployees) {
      const servicesWithEmployees = await Promise.all(
        services.map(async (service) => {
          const employeeServices = await getEmployeeServices(undefined, service.id);
          const hasEmployees = employeeServices.some(es => es.isOffered);
          return hasEmployees ? service : null;
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




