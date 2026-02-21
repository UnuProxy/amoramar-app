import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/shared/lib/stripe';
import { getBookingByPaymentIntentId, updateBooking } from '@/shared/lib/firestore';

export const runtime = 'nodejs';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
        const booking = await getBookingByPaymentIntentId(intent.id);
        if (booking) {
          await updateBooking(booking.id, {
            paymentStatus: 'paid',
            depositPaid: true,
            depositAmount: intent.amount_received || intent.amount || booking.depositAmount,
            status: booking.status === 'pending' ? 'confirmed' : booking.status,
          });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const booking = await getBookingByPaymentIntentId(intent.id);
        if (booking) {
          await updateBooking(booking.id, {
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
          const booking = await getBookingByPaymentIntentId(paymentIntentId);
          if (booking) {
            await updateBooking(booking.id, {
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

