import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Date utilities
export const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return 'N/A';
  try {
    const d = (() => {
      if (date instanceof Date) return date;
      const raw = String(date).trim();
      const isoMatch = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
      if (isoMatch) {
        const [, year, month, day] = isoMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
      }
      const dmyMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (dmyMatch) {
        const [, day, month, year] = dmyMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
      }
      return new Date(raw);
    })();
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate < today;
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
  const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
  const diffMs = bookingDateTime.getTime() - Date.now();
  return diffMs / (1000 * 60 * 60);
};

// Whether a booking can be cancelled given a minimum hours window
export const canCancelWithNotice = (bookingDate: string, bookingTime: string, minHours: number = 24): boolean => {
  return hoursUntilBooking(bookingDate, bookingTime) >= minHours;
};
