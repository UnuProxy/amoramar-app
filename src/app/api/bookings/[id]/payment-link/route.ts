import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';
import { calculateDepositAmount, createPaymentIntent, getPaymentIntent } from '@/shared/lib/stripe';
import type { ApiResponse, Booking, Employee, Service } from '@/shared/lib/types';

export const runtime = 'nodejs';

type PaymentLinkData = {
  bookingId: string;
  paymentUrl: string;
  clientSecret: string | null;
  paymentIntentId: string | null;
  amount: number;
  paid: boolean;
  booking: {
    clientName: string;
    serviceName: string;
    employeeName: string;
    bookingDate: string;
    bookingTime: string;
    totalAmount: number;
    depositAmount: number;
    remainingAmount: number;
    status: string;
    paymentStatus?: string;
  };
};

const getPublicBaseUrl = () => {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3001'
  ).replace(/\/+$/, '');
};

const buildPaymentUrl = (bookingId: string) => `${getPublicBaseUrl()}/booking-payment/${bookingId}`;

async function getPaymentLinkData(bookingId: string, createIfMissing: boolean): Promise<PaymentLinkData> {
  const db = getAdminDb();
  const bookingRef = db.collection('bookings').doc(bookingId);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) {
    throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  }
  const booking = { id: bookingSnap.id, ...bookingSnap.data() } as Booking;

  const [serviceSnap, employeeSnap] = await Promise.all([
    db.collection('services').doc(booking.serviceId).get(),
    db.collection('employees').doc(booking.employeeId).get(),
  ]);
  const service = serviceSnap.exists ? ({ id: serviceSnap.id, ...serviceSnap.data() } as Service) : null;
  const employee = employeeSnap.exists ? ({ id: employeeSnap.id, ...employeeSnap.data() } as Employee) : null;

  if (!service) {
    throw Object.assign(new Error('Service not found for this booking'), { statusCode: 404 });
  }

  const totalAmount = Number(service.price) || 0;
  const amount = booking.depositAmount && booking.depositAmount > 0
    ? booking.depositAmount
    : calculateDepositAmount(totalAmount, 50);

  let paymentIntentId = booking.paymentIntentId || null;
  let clientSecret: string | null = null;
  let paid = booking.depositPaid === true || booking.paymentStatus === 'deposit_paid' || booking.paymentStatus === 'paid';

  if (paymentIntentId) {
    const intent = await getPaymentIntent(paymentIntentId);
    paid = paid || intent.status === 'succeeded';
    clientSecret = intent.client_secret || null;

    if (!paid && (intent.status === 'canceled' || intent.status === 'requires_capture')) {
      paymentIntentId = null;
      clientSecret = null;
    }
  }

  if (!paid && !paymentIntentId && createIfMissing) {
    const intent = await createPaymentIntent(amount, 'eur', {
      bookingId: booking.id,
      serviceId: booking.serviceId,
      serviceName: service.serviceName,
      bookingDate: booking.bookingDate,
      bookingTime: booking.bookingTime,
      clientEmail: booking.clientEmail || '',
      clientName: booking.clientName || '',
      source: 'admin_payment_link',
    });

    paymentIntentId = intent.id;
    clientSecret = intent.client_secret || null;

    await bookingRef.set({
      paymentIntentId,
      depositAmount: amount,
      requiresDeposit: true,
      depositPaid: false,
      paymentStatus: 'pending',
      status: booking.status === 'cancelled' ? booking.status : 'pending',
      updatedAt: Timestamp.now(),
    }, { merge: true });
  }

  return {
    bookingId: booking.id,
    paymentUrl: buildPaymentUrl(booking.id),
    clientSecret,
    paymentIntentId,
    amount,
    paid,
    booking: {
      clientName: booking.clientName,
      serviceName: service.serviceName,
      employeeName: employee ? `${employee.firstName} ${employee.lastName || ''}`.trim() : '',
      bookingDate: booking.bookingDate,
      bookingTime: booking.bookingTime,
      totalAmount,
      depositAmount: amount / 100,
      remainingAmount: Math.max(0, totalAmount - amount / 100),
      status: booking.status,
      paymentStatus: booking.paymentStatus,
    },
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const data = await getPaymentLinkData(id, false);
    return NextResponse.json<ApiResponse<PaymentLinkData>>({ success: true, data });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: error.message || 'Failed to load payment link' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const data = await getPaymentLinkData(id, true);
    return NextResponse.json<ApiResponse<PaymentLinkData>>({ success: true, data });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: error.message || 'Failed to create payment link' },
      { status: error.statusCode || 500 }
    );
  }
}
