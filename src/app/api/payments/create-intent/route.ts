import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent, calculateDepositAmount } from '@/shared/lib/stripe';
import { getService } from '@/shared/lib/firestore';
import type { ApiResponse } from '@/shared/lib/types';

interface CreatePaymentIntentRequest {
  serviceId: string;
  bookingId?: string;
  depositPercentage?: number;
  bookingDate?: string;
  bookingTime?: string;
  clientName?: string;
  clientEmail?: string;
}

export async function POST(request: NextRequest) {
  try {
    const data: CreatePaymentIntentRequest = await request.json();

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Payment processing is not configured. Please contact support.',
        },
        { status: 500 }
      );
    }

    // Fetch service to get price
    const service = await getService(data.serviceId);
    if (!service) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Service not found',
        },
        { status: 404 }
      );
    }

    // Calculate deposit amount (default 20%)
    const depositAmount = calculateDepositAmount(service.price, data.depositPercentage || 50);

    // Create payment intent
    const paymentIntent = await createPaymentIntent(depositAmount, 'eur', {
      serviceId: data.serviceId,
      serviceName: service.serviceName,
      bookingId: data.bookingId || 'pending',
      bookingDate: data.bookingDate || '',
      bookingTime: data.bookingTime || '',
      clientEmail: data.clientEmail || '',
      clientName: data.clientName || '',
    });

    return NextResponse.json<ApiResponse<{ clientSecret: string; amount: number; paymentIntentId: string }>>({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret!,
        amount: depositAmount,
        paymentIntentId: paymentIntent.id,
      },
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to create payment intent',
      },
      { status: 500 }
    );
  }
}










