import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { Timestamp } from 'firebase-admin/firestore';
import { stripe } from '@/shared/lib/stripe';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';
import { enqueueWhatsAppJobsForConfirmedBooking } from '@/shared/lib/whatsappJobs';
import { enqueueEmailConfirmationForBooking, enqueueEmailReminderForBooking } from '@/shared/lib/emailReminderJobs';
import type { Booking, Employee, Service } from '@/shared/lib/types';

export const runtime = 'nodejs';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const getBookingDocByPaymentIntentId = async (paymentIntentId: string) => {
  const snap = await getAdminDb()
    .collection('bookings')
    .where('paymentIntentId', '==', paymentIntentId)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc) return null;
  return { ref: doc.ref, booking: { id: doc.id, ...doc.data() } as Booking };
};

const getAdminDoc = async <T,>(collection: string, id: string): Promise<T | null> => {
  const snap = await getAdminDb().collection(collection).doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as T) : null;
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
        const bookingDoc = await getBookingDocByPaymentIntentId(intent.id);
        const booking = bookingDoc?.booking;
        if (booking) {
          const wasAlreadyPaid =
            booking.depositPaid === true ||
            booking.paymentStatus === 'deposit_paid' ||
            booking.paymentStatus === 'paid';

          await bookingDoc.ref.set({
            paymentStatus: 'deposit_paid',
            depositPaid: true,
            depositAmount: intent.amount_received || intent.amount || booking.depositAmount,
            status: booking.status === 'pending' ? 'confirmed' : booking.status,
            updatedAt: Timestamp.now(),
          }, { merge: true });

          if (!wasAlreadyPaid) {
            const [service, employee] = await Promise.all([
              getAdminDoc<Service>('services', booking.serviceId),
              getAdminDoc<Employee>('employees', booking.employeeId),
            ]);

            if (service && employee && booking.clientEmail) {
              await enqueueEmailConfirmationForBooking({
                id: booking.id,
                clientName: booking.clientName,
                clientEmail: booking.clientEmail,
                serviceName: booking.isConsultation ? `Consulta Gratuita - ${service.serviceName}` : service.serviceName,
                employeeName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
                bookingDate: booking.bookingDate,
                bookingTime: booking.bookingTime,
                status: 'confirmed',
                duration: booking.isConsultation && booking.consultationDuration ? booking.consultationDuration : service.duration,
                price: booking.isConsultation ? '0' : service.price.toString(),
              }).catch((error) => console.error('[stripe webhook] confirmation enqueue failed', booking.id, error));

              enqueueEmailReminderForBooking({
                id: booking.id,
                clientName: booking.clientName,
                clientEmail: booking.clientEmail,
                serviceName: booking.isConsultation ? `Consulta Gratuita - ${service.serviceName}` : service.serviceName,
                employeeName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
                bookingDate: booking.bookingDate,
                bookingTime: booking.bookingTime,
                status: 'confirmed',
              }).catch((error) => console.error('[stripe webhook] reminder enqueue failed', booking.id, error));
            }

            enqueueWhatsAppJobsForConfirmedBooking({
              ...booking,
              depositPaid: true,
              depositAmount: intent.amount_received || intent.amount || booking.depositAmount,
              paymentStatus: 'deposit_paid',
              status: 'confirmed',
            }).catch((error) => console.error('[stripe webhook] WhatsApp enqueue failed', booking.id, error));
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const bookingDoc = await getBookingDocByPaymentIntentId(intent.id);
        if (bookingDoc) {
          await bookingDoc.ref.set({
            paymentStatus: 'failed',
            depositPaid: false,
            updatedAt: Timestamp.now(),
          }, { merge: true });
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
        if (paymentIntentId) {
          const bookingDoc = await getBookingDocByPaymentIntentId(paymentIntentId);
          if (bookingDoc) {
            await bookingDoc.ref.set({
              paymentStatus: 'refunded',
              depositPaid: false,
              updatedAt: Timestamp.now(),
            }, { merge: true });
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
