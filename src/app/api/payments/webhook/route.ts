import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { Timestamp } from 'firebase-admin/firestore';
import { stripe } from '@/shared/lib/stripe';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';
import { getBooking, getEmployee, getService, updateBooking } from '@/shared/lib/firestore';
import { enqueueWhatsAppJobsForConfirmedBooking } from '@/shared/lib/whatsappJobs';
import { enqueueEmailConfirmationForBooking, enqueueEmailReminderForBooking } from '@/shared/lib/emailReminderJobs';
import type { Booking, Employee, Service } from '@/shared/lib/types';

export const runtime = 'nodejs';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const getOptionalAdminDb = () => {
  try {
    return getAdminDb();
  } catch (error) {
    console.error('[stripe webhook] Firebase Admin unavailable, using client SDK fallback:', error);
    return null;
  }
};

const getBookingDocByPaymentIntent = async (intent: Stripe.PaymentIntent) => {
  const db = getOptionalAdminDb();

  if (!db) {
    const metadataBookingId = intent.metadata?.bookingId;
    const booking = metadataBookingId ? await getBooking(metadataBookingId) : null;
    return booking ? { ref: null, booking } : null;
  }

  const snap = await db
    .collection('bookings')
    .where('paymentIntentId', '==', intent.id)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc && intent.metadata?.bookingId) {
    const metadataDoc = await db.collection('bookings').doc(intent.metadata.bookingId).get();
    if (!metadataDoc.exists) return null;
    return { ref: metadataDoc.ref, booking: { id: metadataDoc.id, ...metadataDoc.data() } as Booking };
  }
  if (!doc) return null;
  return { ref: doc.ref, booking: { id: doc.id, ...doc.data() } as Booking };
};

const getAdminDoc = async <T,>(collection: string, id: string): Promise<T | null> => {
  const db = getOptionalAdminDb();
  if (!db) {
    if (collection === 'services') return (await getService(id)) as T | null;
    if (collection === 'employees') return (await getEmployee(id)) as T | null;
    return null;
  }
  const snap = await db.collection(collection).doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as T) : null;
};

const updateBookingPaymentState = async (
  bookingDoc: Awaited<ReturnType<typeof getBookingDocByPaymentIntent>>,
  updates: Partial<Booking>
) => {
  if (!bookingDoc) return;

  if (bookingDoc.ref) {
    await bookingDoc.ref.set({ ...updates, updatedAt: Timestamp.now() }, { merge: true });
    return;
  }

  await updateBooking(bookingDoc.booking.id, updates);
};

const handleSucceededPaymentIntent = async (intent: Stripe.PaymentIntent) => {
  const bookingDoc = await getBookingDocByPaymentIntent(intent);
  const booking = bookingDoc?.booking;
  if (!booking) return;

  const wasAlreadyPaid =
    booking.depositPaid === true ||
    booking.paymentStatus === 'deposit_paid' ||
    booking.paymentStatus === 'paid';

  await updateBookingPaymentState(bookingDoc, {
    paymentIntentId: intent.id,
    paymentStatus: 'deposit_paid',
    depositPaid: true,
    depositAmount: intent.amount_received || intent.amount || booking.depositAmount,
    status: booking.status === 'pending' ? 'confirmed' : booking.status,
  });

  if (wasAlreadyPaid) return;

  const [service, employee] = await Promise.all([
    getAdminDoc<Service>('services', booking.serviceId),
    getAdminDoc<Employee>('employees', booking.employeeId),
  ]);

  if (booking.clientEmail) {
    const baseServiceName = service?.serviceName || booking.serviceName || 'Servicio';
    const serviceName = booking.isConsultation ? `Consulta Gratuita - ${baseServiceName}` : baseServiceName;
    const employeeName = employee
      ? `${employee.firstName} ${employee.lastName || ''}`.trim()
      : 'Amor Amar';

    const emailResults = await Promise.allSettled([
      enqueueEmailConfirmationForBooking({
        id: booking.id,
        clientName: booking.clientName,
        clientEmail: booking.clientEmail,
        serviceName,
        employeeName,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        status: 'confirmed',
        duration:
          booking.isConsultation && booking.consultationDuration
            ? booking.consultationDuration
            : service?.duration || 0,
        price: booking.isConsultation ? '0' : String(service?.price || '0'),
      }).catch((error) => {
        console.error('[stripe webhook] confirmation enqueue failed', booking.id, error);
        throw error;
      }),
      enqueueEmailReminderForBooking({
        id: booking.id,
        clientName: booking.clientName,
        clientEmail: booking.clientEmail,
        serviceName,
        employeeName,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        status: 'confirmed',
      }).catch((error) => {
        console.error('[stripe webhook] reminder enqueue failed', booking.id, error);
        throw error;
      }),
    ]);
    const emailFailure = emailResults.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    if (emailFailure) {
      throw emailFailure.reason;
    }
  }

  enqueueWhatsAppJobsForConfirmedBooking({
    ...booking,
    paymentIntentId: intent.id,
    depositPaid: true,
    depositAmount: intent.amount_received || intent.amount || booking.depositAmount,
    paymentStatus: 'deposit_paid',
    status: 'confirmed',
  }).catch((error) => console.error('[stripe webhook] WhatsApp enqueue failed', booking.id, error));
};

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 500 });
  }

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Missing STRIPE_WEBHOOK_SECRET.' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${error.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await handleSucceededPaymentIntent(intent);
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
        if (paymentIntentId) {
          const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
          await handleSucceededPaymentIntent(intent);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const bookingDoc = await getBookingDocByPaymentIntent(intent);
        if (bookingDoc) {
          await updateBookingPaymentState(bookingDoc, {
            paymentStatus: 'failed',
            depositPaid: false,
          });
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
        if (paymentIntentId) {
          const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
          const bookingDoc = await getBookingDocByPaymentIntent(intent);
          if (bookingDoc) {
            await updateBookingPaymentState(bookingDoc, {
              paymentStatus: 'refunded',
              depositPaid: false,
            });
          }
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Webhook processing failed.' }, { status: 500 });
  }
}
