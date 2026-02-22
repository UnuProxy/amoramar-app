import type { Booking, Service } from './types';

/**
 * Calculates the total price and outstanding balance for a booking.
 */
export function calculateBookingTotals(booking: Booking, service?: Service) {
  // 1. Base Price
  const basePrice = service?.price || 0;

  // 2. Additional Services
  const extras = booking.additionalServices || [];
  const extrasTotal = extras.reduce((sum, item) => sum + item.price, 0);

  // 3. Total Original Price
  const totalPrice = basePrice + extrasTotal;

  // 4. Deposit Calculation
  const expectedDeposit = totalPrice * 0.5;
  let depositPaidValue = 0;
  if (booking.depositPaid) {
    if (booking.depositAmount !== undefined) {
      depositPaidValue = booking.depositAmount / 100; // cents to euros
    } else {
      // Fallback to 50% of base price if no specific amount stored
      depositPaidValue = expectedDeposit;
    }
  }

  const hasDepositWorkflow =
    booking.requiresDeposit === true ||
    Boolean(booking.paymentIntentId) ||
    booking.paymentStatus === 'deposit_paid' ||
    booking.paymentStatus === 'refunded' ||
    (booking.depositPaid === true && booking.finalPaymentReceived !== true);

  if (hasDepositWorkflow) {
    // Guard against legacy rows incorrectly storing full price as deposit.
    depositPaidValue = Math.min(depositPaidValue, expectedDeposit);
  }

  // 5. Outstanding Balance
  // A deposit does not mean the booking is fully paid.
  const isFullyPaid =
    booking.finalPaymentReceived === true ||
    (booking.paymentStatus === 'paid' && (!hasDepositWorkflow || booking.status === 'completed'));
  const outstanding = isFullyPaid ? 0 : Math.max(0, totalPrice - depositPaidValue);

  return {
    basePrice,
    extrasTotal,
    totalPrice,
    depositPaidValue,
    outstanding,
    isFullyPaid
  };
}
