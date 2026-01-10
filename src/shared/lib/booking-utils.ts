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
  let depositPaidValue = 0;
  if (booking.depositPaid) {
    if (booking.depositAmount !== undefined) {
      depositPaidValue = booking.depositAmount / 100; // cents to euros
    } else {
      // Fallback to 50% of base price if no specific amount stored
      depositPaidValue = basePrice * 0.5;
    }
  }

  // 5. Outstanding Balance
  // If paymentStatus is 'paid', outstanding is 0 regardless of the math
  const isFullyPaid = booking.paymentStatus === 'paid';
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



