import { NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';
import { getBooking, getEmployee, getService, updateBooking } from '@/shared/lib/firestore';
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
    process.env.NEXT_PUBLIC_PAYMENT_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://amoramar-web.vercel.app'
  ).replace(/\/+$/, '');
};

const buildPaymentUrl = (bookingId: string, paymentIntentId?: string | null) => {
  const url = new URL(`${getPublicBaseUrl()}/booking-payment/${bookingId}`);
  if (paymentIntentId) {
    url.searchParams.set('payment_intent', paymentIntentId);
  }
  return url.toString();
};

const getOptionalAdminDb = (): Firestore | null => {
  try {
    return getAdminDb();
  } catch (error) {
    console.error('[payment-link] Firebase Admin unavailable, using client SDK fallback:', error);
    return null;
  }
};

const loadBookingContext = async (bookingId: string) => {
  const db = getOptionalAdminDb();

  if (db) {
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

    return {
      db,
      bookingRef,
      booking,
      service: serviceSnap.exists ? ({ id: serviceSnap.id, ...serviceSnap.data() } as Service) : null,
      employee: employeeSnap.exists ? ({ id: employeeSnap.id, ...employeeSnap.data() } as Employee) : null,
    };
  }

  const booking = await getBooking(bookingId);
  if (!booking) {
    throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  }

  const [service, employee] = await Promise.all([
    getService(booking.serviceId),
    getEmployee(booking.employeeId),
  ]);

  return {
    db: null,
    bookingRef: null,
    booking,
    service,
    employee,
  };
};

const persistPaymentIntentOnBooking = async (
  context: Awaited<ReturnType<typeof loadBookingContext>>,
  updates: Partial<Booking>
) => {
  const payload = {
    ...updates,
    updatedAt: Timestamp.now(),
  };

  if (context.bookingRef) {
    await context.bookingRef.set(payload, { merge: true });
    return;
  }

  try {
    await updateBooking(context.booking.id, updates);
  } catch (error) {
    // The payment URL still works because the PaymentIntent carries bookingId metadata.
    // Webhook confirmation also falls back to that metadata.
    console.error('[payment-link] Could not persist payment intent on booking:', error);
  }
};

async function getPaymentLinkData(
  bookingId: string,
  createIfMissing: boolean,
  requestedPaymentIntentId?: string | null
): Promise<PaymentLinkData> {
  const context = await loadBookingContext(bookingId);
  const { booking, service, employee } = context;

  if (!service) {
    throw Object.assign(new Error('Service not found for this booking'), { statusCode: 404 });
  }

  const totalAmount = Number(service.price) || 0;
  const amount = booking.depositAmount && booking.depositAmount > 0
    ? booking.depositAmount
    : calculateDepositAmount(totalAmount, 50);

  let paymentIntentId = requestedPaymentIntentId || booking.paymentIntentId || null;
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

    await persistPaymentIntentOnBooking(context, {
      paymentIntentId,
      depositAmount: amount,
      requiresDeposit: true,
      depositPaid: false,
      paymentStatus: 'pending',
      status: booking.status === 'cancelled' ? booking.status : 'pending',
    });
  }

  return {
    bookingId: booking.id,
    paymentUrl: buildPaymentUrl(booking.id, paymentIntentId),
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
    const paymentIntentId = new URL(request.url).searchParams.get('paymentIntentId') ||
      new URL(request.url).searchParams.get('payment_intent');
    const data = await getPaymentLinkData(id, false, paymentIntentId);
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
    const paymentIntentId = new URL(request.url).searchParams.get('paymentIntentId') ||
      new URL(request.url).searchParams.get('payment_intent');
    const data = await getPaymentLinkData(id, true, paymentIntentId);
    return NextResponse.json<ApiResponse<PaymentLinkData>>({ success: true, data });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: error.message || 'Failed to create payment link' },
      { status: error.statusCode || 500 }
    );
  }
}
