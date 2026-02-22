export const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || '/book';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://amoramar.com';
export const GOOGLE_RATING = '4.9';
export const ADDRESS = 'Carrer del Diputat Josep Ribas, 29, D-1, 07800 Eivissa, Balearic Islands';
export const HOURS = 'Monday to Friday 10:00 - 17:00';
export const PHONE = '+34 000 000 000';
export const INSTAGRAM_URL = 'https://instagram.com/amoramar';

export function bookingLink(service?: string) {
  if (!service) return BOOKING_URL;

  if (BOOKING_URL.startsWith('http://') || BOOKING_URL.startsWith('https://')) {
    const url = new URL(BOOKING_URL);
    url.searchParams.set('service', service);
    return url.toString();
  }

  if (BOOKING_URL.startsWith('/')) {
    const url = new URL(BOOKING_URL, 'https://amoramar.local');
    url.searchParams.set('service', service);
    return `${url.pathname}${url.search}`;
  }

  const separator = BOOKING_URL.includes('?') ? '&' : '?';
  return `${BOOKING_URL}${separator}service=${encodeURIComponent(service)}`;
}
