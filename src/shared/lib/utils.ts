import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MADRID_TIME_ZONE = 'Europe/Madrid';

const getTimeZoneParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return formatter.formatToParts(date);
};

const pickPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string => {
  return parts.find((part) => part.type === type)?.value || '';
};

export const toDateKeyInTimeZone = (date: Date, timeZone: string): string => {
  const parts = getTimeZoneParts(date, timeZone);
  const year = pickPart(parts, 'year');
  const month = pickPart(parts, 'month');
  const day = pickPart(parts, 'day');
  return `${year}-${month}-${day}`;
};

export const getDateKeyInMadrid = (date: Date = new Date()): string =>
  toDateKeyInTimeZone(date, MADRID_TIME_ZONE);

const getWallClockMillisInTimeZone = (date: Date, timeZone: string): number => {
  const parts = getTimeZoneParts(date, timeZone);
  const year = Number(pickPart(parts, 'year'));
  const month = Number(pickPart(parts, 'month'));
  const day = Number(pickPart(parts, 'day'));
  const hour = Number(pickPart(parts, 'hour'));
  const minute = Number(pickPart(parts, 'minute'));

  if ([year, month, day, hour, minute].some(Number.isNaN)) {
    return Number.NaN;
  }

  return Date.UTC(year, month - 1, day, hour, minute);
};

export const getMadridDateTime = (dateKey: string, time: string): Date | null => {
  const dateMatch = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = time.match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;

  const [, yearRaw, monthRaw, dayRaw] = dateMatch;
  const [, hourRaw, minuteRaw] = timeMatch;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (
    [year, month, day, hour, minute].some(Number.isNaN) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const desiredWallMillis = Date.UTC(year, month - 1, day, hour, minute);
  let utcMillis = desiredWallMillis;

  // Convert a Madrid wall-clock appointment time to a real UTC instant.
  // The small fixed-point loop handles daylight-saving offsets safely.
  for (let i = 0; i < 3; i += 1) {
    const actualWallMillis = getWallClockMillisInTimeZone(new Date(utcMillis), MADRID_TIME_ZONE);
    if (Number.isNaN(actualWallMillis)) return null;

    const diff = desiredWallMillis - actualWallMillis;
    if (diff === 0) break;
    utcMillis += diff;
  }

  return new Date(utcMillis);
};

export const getMinutesInTimeZone = (date: Date, timeZone: string): number => {
  const parts = getTimeZoneParts(date, timeZone);
  const hour = Number(pickPart(parts, 'hour'));
  const minute = Number(pickPart(parts, 'minute'));
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;
  return hour * 60 + minute;
};

export const getMinutesInMadrid = (date: Date = new Date()): number =>
  getMinutesInTimeZone(date, MADRID_TIME_ZONE);

// Date utilities
export const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return 'N/A';
  try {
    const toDotted = (year: string, month: string, day: string): string => `${day}.${month}.${year}`;

    if (date instanceof Date) {
      if (Number.isNaN(date.getTime())) return 'N/A';
      const parts = getTimeZoneParts(date, MADRID_TIME_ZONE);
      return toDotted(pickPart(parts, 'year'), pickPart(parts, 'month'), pickPart(parts, 'day'));
    }

    const raw = String(date).trim();
    const isoMatch = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return toDotted(year, month, day);
    }

    const dmySlashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmySlashMatch) {
      const [, day, month, year] = dmySlashMatch;
      return toDotted(year, month, day);
    }

    const dmyDotMatch = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (dmyDotMatch) {
      const [, day, month, year] = dmyDotMatch;
      return toDotted(year, month, day);
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return String(date);
    const parts = getTimeZoneParts(parsed, MADRID_TIME_ZONE);
    return toDotted(pickPart(parts, 'year'), pickPart(parts, 'month'), pickPart(parts, 'day'));
  } catch {
    return String(date);
  }
};

export const formatTime = (time: string | null | undefined): string => {
  if (!time) return 'N/A';
  try {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    if (isNaN(hour)) return time;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes || '00'} ${ampm}`;
  } catch {
    return time;
  }
};

export const formatDateTime = (date: string, time: string): string => {
  return `${formatDate(date)} at ${formatTime(time)}`;
};

// Generate time slots at regular intervals between start and end time
export const generateTimeSlots = (startTime: string, endTime: string, intervalMinutes: number = 30): string[] => {
  const slots: string[] = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let currentHour = startHour;
  let currentMin = startMin;
  
  while (
    currentHour < endHour ||
    (currentHour === endHour && currentMin <= endMin)
  ) {
    const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
    slots.push(timeStr);
    
    currentMin += intervalMinutes;
    if (currentMin >= 60) {
      currentMin -= 60;
      currentHour += 1;
    }
  }
  
  return slots;
};

// Add minutes to an HH:MM time string
export const addMinutesToTime = (time: string, minutesToAdd: number): string => {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
};

// Check if date is in the past
export const isPastDate = (date: string): boolean => {
  if (!date) return false;
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDatePattern.test(date)) {
    return date < getDateKeyInMadrid(new Date());
  }

  const checkDate = new Date(date);
  if (Number.isNaN(checkDate.getTime())) return false;
  return getDateKeyInMadrid(checkDate) < getDateKeyInMadrid(new Date());
};

// Validate email
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

// Format currency
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

// Hours until a booking happens from now (can be negative if in the past)
export const hoursUntilBooking = (bookingDate: string, bookingTime: string): number => {
  const bookingDateTime = getMadridDateTime(bookingDate, bookingTime);
  if (!bookingDateTime) return Number.NEGATIVE_INFINITY;
  const diffMs = bookingDateTime.getTime() - Date.now();
  return diffMs / (1000 * 60 * 60);
};

// Whether a booking can be cancelled given a minimum hours window
export const canCancelWithNotice = (bookingDate: string, bookingTime: string, minHours: number = 24): boolean => {
  return hoursUntilBooking(bookingDate, bookingTime) >= minHours;
};
