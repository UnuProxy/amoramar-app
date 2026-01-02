import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// Initialize Stripe with secret key (server-side only)
export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
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
    console.error('Error creating refund:', error);
    throw new Error(error.message || 'Failed to create refund');
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







