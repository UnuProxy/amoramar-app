export interface BookingSuccessRedirectData {
  bookingId?: string;
  serviceName?: string;
  employeeName?: string;
  bookingDate?: string;
  bookingTime?: string;
  email?: string;
  depositAmount?: number;
  remainingBalance?: number;
}

export function buildBookingSuccessUrl(data: BookingSuccessRedirectData): string {
  const params = new URLSearchParams();

  if (data.bookingId) params.set('bookingId', data.bookingId);
  if (data.serviceName) params.set('service', data.serviceName);
  if (data.employeeName) params.set('employee', data.employeeName);
  if (data.bookingDate) params.set('date', data.bookingDate);
  if (data.bookingTime) params.set('time', data.bookingTime);
  if (data.email) params.set('email', data.email);
  if (typeof data.depositAmount === 'number') params.set('deposit', String(data.depositAmount));
  if (typeof data.remainingBalance === 'number') params.set('remaining', String(data.remainingBalance));

  const query = params.toString();
  return query ? `/book/success?${query}` : '/book/success';
}
