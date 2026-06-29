import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// Initialize Stripe with secret key (server-side only)
export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
    })
  : null;

/**
 * Create a payment intent for a booking deposit
 * @param amount - Amount in cents (e.g., 2000 for $20.00 or 20.00€)
 * @param currency - Currency code (e.g., 'eur', 'usd')
 * @param metadata - Additional data to attach to the payment
 * @returns PaymentIntent
 */
export async function createPaymentIntent(
  amount: number,
  currency: string = 'eur',
  metadata: Record<string, string> = {}
): Promise<Stripe.PaymentIntent> {
  try {
    if (!stripe) {
      throw new Error('Stripe is not configured.');
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return paymentIntent;
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    throw new Error(error.message || 'Failed to create payment intent');
  }
}

export async function createBookingCheckoutSession(params: {
  amount: number;
  currency?: string;
  serviceName: string;
  clientEmail?: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  try {
    if (!stripe) {
      throw new Error('Stripe is not configured.');
    }

    return await stripe.checkout.sessions.create({
      mode: 'payment',
      // Keep admin-generated deposit links on plain card checkout. Stripe Link can
      // trap clients in account/phone verification when their Link account data
      // does not match, even though a normal card payment would work.
      payment_method_types: ['card'],
      locale: 'es',
      customer_email: params.clientEmail || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: params.currency || 'eur',
            unit_amount: params.amount,
            product_data: {
              name: params.serviceName,
              description: 'Amor Amar booking deposit',
            },
          },
        },
      ],
      metadata: params.metadata,
      payment_intent_data: {
        metadata: params.metadata,
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    throw new Error(error.message || 'Failed to create checkout session');
  }
}

/**
 * Retrieve a payment intent
 */
export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  try {
    if (!stripe) {
      throw new Error('Stripe is not configured.');
    }
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error: any) {
    console.error('Error retrieving payment intent:', error);
    throw new Error(error.message || 'Failed to retrieve payment intent');
  }
}

/**
 * Create a refund for a payment
 */
export async function createRefund(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
  try {
    if (!stripe) {
      throw new Error('Stripe is not configured.');
    }
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount, // If not provided, refunds full amount
    });
    return refund;
  } catch (error: any) {
    const alreadyRefunded =
      error?.code === 'charge_already_refunded' ||
      /already been refunded/i.test(error?.message || '');

    if (alreadyRefunded && stripe) {
      // Idempotent behavior: if Stripe says already refunded, return existing refund record.
      const existing = await stripe.refunds.list({
        payment_intent: paymentIntentId,
        limit: 1,
      });
      if (existing.data.length > 0) {
        return existing.data[0]!;
      }
    }

    console.error('Error creating refund:', error);
    const normalizedError = new Error(error.message || 'Failed to create refund') as Error & { code?: string };
    normalizedError.code = error?.code;
    throw normalizedError;
  }
}

/**
 * Calculate deposit amount
 * @param totalPrice - Total service price (e.g., "45.00€" or "45")
 * @param depositPercentage - Percentage to charge as deposit (default 50%)
 * @returns Deposit amount in cents
 */
export function calculateDepositAmount(totalPrice: string | number, depositPercentage: number = 50): number {
  // Parse price string to number
  let priceNumber: number;
  if (typeof totalPrice === 'string') {
    // Remove currency symbols and whitespace, then parse
    priceNumber = parseFloat(totalPrice.replace(/[€$£\s]/g, ''));
  } else {
    priceNumber = totalPrice;
  }

  // Calculate deposit and convert to cents
  const depositAmount = (priceNumber * depositPercentage) / 100;
  return Math.round(depositAmount * 100); // Convert to cents
}

/**
 * Format amount from cents to display string
 */
export function formatAmount(amountInCents: number, currency: string = 'eur'): string {
  const amount = amountInCents / 100;
  
  const currencySymbols: Record<string, string> = {
    eur: '€',
    usd: '$',
    gbp: '£',
  };

  const symbol = currencySymbols[currency.toLowerCase()] || currency.toUpperCase();
  
  return `${amount.toFixed(2)}${symbol}`;
}






