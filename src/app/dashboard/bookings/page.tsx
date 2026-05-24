'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getBookings, getEmployees, getEmployeeServices, getServices } from '@/shared/lib/firestore';
import type { Booking, BookingFormData, Employee, EmployeeService, Service } from '@/shared/lib/types';
import { formatCurrency, formatDate, formatTime, cn } from '@/shared/lib/utils';
import { useLanguage } from '@/shared/context/LanguageContext';
import { useAuth } from '@/shared/hooks/useAuth';
import type { Language } from '@/shared/lib/i18n';
import {
  compareServicesByDisplayOrder,
  getCatalogGroupLabel,
  getDefaultServiceCatalogConfig,
  getServiceGroupId,
} from '@/shared/lib/serviceCatalog';
import { Loading } from '@/shared/components/Loading';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  X,
  Clock,
  User,
  Scissors,
  CreditCard,
  ArrowRight,
  Filter,
  CalendarDays,
  LayoutGrid,
  List,
  Trash2,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';

type ViewMode = 'day' | 'week';
type StatusFilter = 'all' | Booking['status'];

type AdminPaymentLinkForm = {
  bookingDate: string;
  bookingTime: string;
  serviceId: string;
  employeeId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  notes: string;
};

type GeneratedPaymentLink = {
  bookingId: string;
  paymentUrl: string;
  amount: number;
};

// ============================================================================
// DATE UTILITIES
// ============================================================================

const DAYS_SHORT_BY_INDEX: Record<Language, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  es: ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'],
};
const DAYS_FULL_BY_INDEX: Record<Language, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  es: ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'],
};
const MONTHS_BY_INDEX: Record<Language, string[]> = {
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
  es: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ],
};
const WEEKDAY_HEADERS: Record<Language, string[]> = {
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  es: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
};

const toDateKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const isSameDay = (d1: Date, d2: Date): boolean => {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
};

const isToday = (date: Date): boolean => isSameDay(date, new Date());

const getWeekDays = (date: Date): Date[] => {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

const getMonthDays = (year: number, month: number): (Date | null)[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = (firstDay.getDay() + 6) % 7;
  
  const days: (Date | null)[] = [];
  
  for (let i = 0; i < startPadding; i++) {
    days.push(null);
  }
  
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  
  return days;
};

const formatDateLong = (date: Date, language: Language): string => {
  const dayName = DAYS_FULL_BY_INDEX[language][date.getDay()];
  const monthName = MONTHS_BY_INDEX[language][date.getMonth()];
  if (language === 'es') {
    return `${dayName}, ${date.getDate()} de ${monthName}`;
  }
  return `${dayName}, ${monthName} ${date.getDate()}`;
};

const formatDateShort = (date: Date, language: Language): string => {
  const monthShort = MONTHS_BY_INDEX[language][date.getMonth()].substring(0, 3);
  if (language === 'es') {
    return `${date.getDate()} ${monthShort}`;
  }
  return `${monthShort} ${date.getDate()}`;
};

const minutesFromTime = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const timeFromMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number): boolean => {
  return startA < endB && startB < endA;
};

// ============================================================================
// MOBILE DRAWER COMPONENT
// ============================================================================

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children }) => {
  const handleClose = useCallback(
    (event?: React.SyntheticEvent) => {
      event?.preventDefault();
      event?.stopPropagation();
      onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={(event) => handleClose(event)}
        onPointerDown={(event) => event.stopPropagation()}
      />
      <div
        className="absolute inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl animate-in slide-in-from-right duration-300"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={(event) => handleClose(event)}
            onPointerDown={(event) => event.stopPropagation()}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100vh-65px)] p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MINI CALENDAR COMPONENT
// ============================================================================

interface MiniCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  bookingCounts: Record<string, number>;
  pastUnpaidDates: Set<string>; // New prop
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({
  selectedDate,
  onSelectDate,
  bookingCounts,
  pastUnpaidDates, // New prop
  currentMonth,
  onMonthChange,
}) => {
  const { t, language } = useLanguage();
  const days = getMonthDays(currentMonth.getFullYear(), currentMonth.getMonth());

  const prevMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    onMonthChange(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    onMonthChange(newDate);
  };

  const getBookingIntensity = (count: number): string => {
    if (count === 0) return '';
    if (count <= 2) return 'bg-emerald-100 text-emerald-700';
    if (count <= 5) return 'bg-emerald-200 text-emerald-800';
    if (count <= 10) return 'bg-emerald-300 text-emerald-900';
    return 'bg-emerald-400 text-emerald-950';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:p-5 shadow-sm">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors active:bg-slate-200"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h3 className="text-sm font-semibold text-slate-900 tracking-wide">
          {MONTHS_BY_INDEX[language][currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors active:bg-slate-200"
        >
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAY_HEADERS[language].map((day, idx) => (
          <div key={`${day}-${idx}`} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }

          const dateKey = toDateKey(day);
          const count = bookingCounts[dateKey] || 0;
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const hasPastUnpaid = pastUnpaidDates.has(dateKey);

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(day)}
              className={cn(
                'aspect-square rounded-lg text-xs font-medium transition-all relative',
                'active:scale-95',
                isSelected
                  ? 'bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-2'
                  : isTodayDate
                  ? 'ring-2 ring-amber-400 ring-offset-1 bg-amber-50 text-amber-700'
                  : count > 0
                  ? getBookingIntensity(count)
                  : 'text-slate-600 hover:bg-slate-50 active:bg-slate-100',
                hasPastUnpaid && !isSelected && 'ring-2 ring-rose-500 ring-offset-1'
              )}
            >
              {day.getDate()}
              {count > 0 && !isSelected && (
                <span className={cn(
                  "absolute -top-1 -right-1 w-4 h-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center",
                  hasPastUnpaid ? "bg-rose-600" : "bg-slate-900"
                )}>
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-100" />
            <span>1-2</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-200" />
            <span>3-5</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-300" />
            <span>6-10</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-400" />
            <span>10+</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-rose-600 uppercase tracking-wider">
          <div className="w-3 h-3 rounded-sm bg-rose-500 shadow-sm" />
          <span>{t('pending_payments')}</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MOBILE WEEK STRIP (HORIZONTAL SCROLL)
// ============================================================================

interface MobileWeekStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  bookingCounts: Record<string, number>;
  pastUnpaidDates: Set<string>; // New prop
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

const MobileWeekStrip: React.FC<MobileWeekStripProps> = ({
  selectedDate,
  onSelectDate,
  bookingCounts,
  pastUnpaidDates, // New prop
  onPrevWeek,
  onNextWeek,
}) => {
  const { language } = useLanguage();
  const weekDays = getWeekDays(selectedDate);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrevWeek}
        className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0 active:bg-slate-200"
      >
        <ChevronLeft className="w-5 h-5 text-slate-600" />
      </button>

      <div className="flex-1 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 min-w-max px-1">
          {weekDays.map((day) => {
            const dateKey = toDateKey(day);
            const count = bookingCounts[dateKey] || 0;
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            const hasPastUnpaid = pastUnpaidDates.has(dateKey);

            return (
              <button
                key={dateKey}
                onClick={() => onSelectDate(day)}
                className={cn(
                  'flex flex-col items-center py-2 px-3 rounded-xl transition-all relative min-w-[52px]',
                  'border-2 active:scale-95',
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                    : isTodayDate
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : hasPastUnpaid
                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                    : 'bg-white border-slate-200 text-slate-600 active:border-slate-400'
                )}
              >
                <span className={cn(
                  'text-[9px] font-bold uppercase tracking-wider',
                  isSelected ? 'text-slate-400' : 'text-slate-400'
                )}>
                  {DAYS_SHORT_BY_INDEX[language][day.getDay()]}
                </span>
                <span className={cn(
                  'text-lg font-bold',
                  isSelected ? 'text-white' : 'text-slate-900'
                )}>
                  {day.getDate()}
                </span>
                {count > 0 && (
                  <span className={cn(
                    'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                    isSelected
                      ? 'bg-white/20 text-white'
                      : hasPastUnpaid
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-100 text-emerald-700'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onNextWeek}
        className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0 active:bg-slate-200"
      >
        <ChevronRight className="w-5 h-5 text-slate-600" />
      </button>
    </div>
  );
};

// ============================================================================
// DESKTOP WEEK STRIP
// ============================================================================

interface DesktopWeekStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  bookingCounts: Record<string, number>;
  pastUnpaidDates: Set<string>; // New prop
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

const DesktopWeekStrip: React.FC<DesktopWeekStripProps> = ({
  selectedDate,
  onSelectDate,
  bookingCounts,
  pastUnpaidDates, // New prop
  onPrevWeek,
  onNextWeek,
}) => {
  const { language } = useLanguage();
  const weekDays = getWeekDays(selectedDate);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrevWeek}
        className="p-3 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
      >
        <ChevronLeft className="w-5 h-5 text-slate-600" />
      </button>

      <div className="flex-1 grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const dateKey = toDateKey(day);
          const count = bookingCounts[dateKey] || 0;
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const hasPastUnpaid = pastUnpaidDates.has(dateKey);

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(day)}
              className={cn(
                'flex flex-col items-center py-3 px-2 rounded-xl transition-all relative',
                'border-2',
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                  : isTodayDate
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : hasPastUnpaid
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-white border-slate-200 hover:border-slate-400 text-slate-600'
              )}
            >
              <span className={cn(
                'text-[10px] font-bold uppercase tracking-wider',
                isSelected ? 'text-slate-400' : 'text-slate-400'
              )}>
                  {DAYS_SHORT_BY_INDEX[language][day.getDay()]}
                </span>
              <span className={cn(
                'text-xl font-bold mt-1',
                isSelected ? 'text-white' : 'text-slate-900'
              )}>
                {day.getDate()}
              </span>
              {count > 0 && (
                <span className={cn(
                  'text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full',
                  isSelected
                    ? 'bg-white/20 text-white'
                    : hasPastUnpaid
                    ? 'bg-rose-600 text-white'
                    : 'bg-emerald-100 text-emerald-700'
                )}>
                    {count} {language === 'es' ? (count === 1 ? 'reserva' : 'reservas') : (count === 1 ? 'booking' : 'bookings')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={onNextWeek}
        className="p-3 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
      >
        <ChevronRight className="w-5 h-5 text-slate-600" />
      </button>
    </div>
  );
};

// ============================================================================
// BOOKING CARD COMPONENT
// ============================================================================

interface BookingCardProps {
  booking: Booking;
  serviceName: string;
  employeeName: string;
  detailHref: string;
  compact?: boolean;
  onDelete?: (booking: Booking) => void;
  isDeleting?: boolean;
}

const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  serviceName,
  employeeName,
  detailHref,
  compact = false,
  onDelete,
  isDeleting = false,
}) => {
  const { t } = useLanguage();
  const now = new Date();
  const isFullyPaid =
    booking.finalPaymentReceived === true ||
    booking.paymentStatus === 'paid';
  const effectiveStatus: Booking['status'] =
    booking.status !== 'cancelled' && isFullyPaid
      ? 'completed'
      : booking.status;
  const getStatusConfig = (status: Booking['status']) => {
    switch (status) {
      case 'confirmed':
        return { label: t('confirmed'), bg: 'bg-emerald-500', text: 'text-white' };
      case 'completed':
        return { label: t('completed'), bg: 'bg-slate-700', text: 'text-white' };
      case 'cancelled':
        return { label: t('cancelled'), bg: 'bg-red-500', text: 'text-white' };
      default:
        return { label: t('pending'), bg: 'bg-amber-400', text: 'text-amber-900' };
    }
  };

  const getPaymentStatus = () => {
    const hasDepositOnly =
      !isFullyPaid &&
      (booking.paymentStatus === 'deposit_paid' || booking.depositPaid === true || booking.paymentStatus === 'paid');
    if (booking.paymentStatus === 'refunded') {
      return { label: t('refunded'), color: 'text-slate-500' };
    }
    if (isFullyPaid) {
      return { label: t('payment_paid_in_full'), color: 'text-emerald-700' };
    }
    if (hasDepositOnly) {
      return { label: t('payment_deposit_paid'), color: 'text-emerald-600' };
    }
    if (booking.paymentStatus === 'failed') {
      return { label: t('failed'), color: 'text-red-500' };
    }
    return { label: t('pending'), color: 'text-amber-600' };
  };

  const getCreatedByLabel = () => {
    if (booking.createdByName) return booking.createdByName;
    if (booking.createdByRole === 'owner') return t('role_owner');
    if (booking.createdByRole === 'employee') return t('employee');
    return t('client');
  };

  const bookingStart = new Date(`${booking.bookingDate}T${booking.bookingTime}:00`);
  const isPastBooking = !Number.isNaN(bookingStart.getTime()) && bookingStart.getTime() < now.getTime();
  const hasPendingPaymentWarning =
    effectiveStatus !== 'completed' &&
    booking.status !== 'cancelled' &&
    booking.paymentStatus !== 'refunded' &&
    !isFullyPaid &&
    isPastBooking;
  const status = getStatusConfig(effectiveStatus);
  const payment = getPaymentStatus();

  if (compact) {
    return (
      <Link
        href={detailHref}
        className={cn(
          "group flex items-center gap-3 p-3 lg:p-4 bg-white rounded-xl border hover:shadow-md transition-all active:bg-slate-50",
          hasPendingPaymentWarning
            ? "border-rose-300 bg-rose-50/40 hover:border-rose-400"
            : "border-slate-200 hover:border-slate-400"
        )}
      >
        <div className="flex-shrink-0 w-14 lg:w-16 text-center">
          <div className="text-base lg:text-lg font-bold text-slate-900">{formatTime(booking.bookingTime)}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900 truncate text-sm lg:text-base">{booking.clientName || t('no_name')}</div>
          <div className="text-xs lg:text-sm text-slate-500 truncate">{serviceName}</div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <span className={cn('px-2 lg:px-3 py-1 rounded-full text-[9px] lg:text-[10px] font-bold uppercase tracking-wide', status.bg, status.text)}>
            {status.label}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDelete(booking);
              }}
              disabled={isDeleting}
              aria-label={t('delete') || 'Delete'}
              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all hidden sm:block" />
        </div>
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition-shadow",
        hasPendingPaymentWarning ? "border-rose-300 shadow-rose-100/40" : "border-slate-200"
      )}
    >
      {/* Time Header */}
      <div
        className={cn(
          "px-4 lg:px-5 py-3 flex items-center justify-between",
          hasPendingPaymentWarning ? "bg-rose-700" : "bg-slate-900"
        )}
      >
        <div className="flex items-center gap-2">
          <Clock className={cn("w-4 h-4", hasPendingPaymentWarning ? "text-rose-100" : "text-slate-400")} />
          <span className="text-base lg:text-lg font-bold text-white">{formatTime(booking.bookingTime)}</span>
        </div>
        <span className={cn('px-2 lg:px-3 py-1 rounded-full text-[9px] lg:text-[10px] font-bold uppercase tracking-wide', status.bg, status.text)}>
          {status.label}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 lg:p-5 space-y-3 lg:space-y-4">
        {/* Client */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 lg:w-5 lg:h-5 text-slate-500" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 text-sm lg:text-base truncate">{booking.clientName || t('no_name')}</div>
            <div className="text-xs lg:text-sm text-slate-500 truncate">{booking.clientEmail}</div>
            {booking.clientPhone && (
              <div className="text-xs lg:text-sm text-slate-500">{booking.clientPhone}</div>
            )}
          </div>
        </div>

        {/* Service */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Scissors className="w-4 h-4 lg:w-5 lg:h-5 text-slate-500" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 text-sm lg:text-base truncate">{serviceName}</div>
            <div className="text-xs lg:text-sm text-slate-500">{t('with')} {employeeName}</div>
          </div>
        </div>

        {/* Payment & Meta */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <CreditCard className={cn('w-4 h-4', hasPendingPaymentWarning ? 'text-rose-500' : 'text-slate-400')} />
            <span className={cn('text-xs lg:text-sm font-medium', hasPendingPaymentWarning ? 'text-rose-600' : payment.color)}>
              {payment.label}
            </span>
          </div>
          <div className="text-[9px] lg:text-[10px] text-slate-400 uppercase tracking-wide truncate ml-2">
            {t('by')}: {getCreatedByLabel()}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 lg:px-5 pb-4 lg:pb-5 flex items-center gap-2">
        <Link
          href={detailHref}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 lg:py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl text-sm font-semibold text-slate-700 transition-colors"
        >
          {t('view_details')}
          <ArrowRight className="w-4 h-4" />
        </Link>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(booking)}
            disabled={isDeleting}
            aria-label={t('delete') || 'Delete'}
            className="flex items-center justify-center gap-2 px-4 py-2.5 lg:py-3 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-600 hover:text-rose-700 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// DATE PICKER MODAL
// ============================================================================

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const DatePickerModal: React.FC<DatePickerModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
}) => {
  const { t, language } = useLanguage();
  const [viewDate, setViewDate] = useState(selectedDate);

  useEffect(() => {
    setViewDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const days = getMonthDays(viewDate.getFullYear(), viewDate.getMonth());

  const handleSelect = (day: Date) => {
    onSelectDate(day);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md p-5 sm:p-6 animate-in slide-in-from-bottom sm:fade-in sm:zoom-in-95 duration-300 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">{t('select_date')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <button
            onClick={() => {
              const newDate = new Date(viewDate);
              newDate.setMonth(newDate.getMonth() - 1);
              setViewDate(newDate);
            }}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors active:bg-slate-200"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h3 className="text-base sm:text-lg font-semibold text-slate-900">
            {MONTHS_BY_INDEX[language][viewDate.getMonth()]} {viewDate.getFullYear()}
          </h3>
          <button
            onClick={() => {
              const newDate = new Date(viewDate);
              newDate.setMonth(newDate.getMonth() + 1);
              setViewDate(newDate);
            }}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors active:bg-slate-200"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAY_HEADERS[language].map((day, idx) => (
            <div key={`${day}-${idx}`} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }

            const isSelected = isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);

            return (
              <button
                key={toDateKey(day)}
                onClick={() => handleSelect(day)}
                className={cn(
                  'aspect-square rounded-xl text-sm font-semibold transition-all active:scale-95',
                  isSelected
                    ? 'bg-slate-900 text-white'
                    : isTodayDate
                    ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
                    : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-5 sm:mt-6 pt-5 sm:pt-6 border-t border-slate-100 flex gap-2">
          <button
            onClick={() => handleSelect(new Date())}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl text-sm font-semibold text-slate-700 transition-colors"
          >
            {t('today')}
          </button>
          <button
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              handleSelect(tomorrow);
            }}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl text-sm font-semibold text-slate-700 transition-colors"
          >
            {t('tomorrow')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// FILTERS CONTENT (SHARED BETWEEN SIDEBAR AND DRAWER)
// ============================================================================

interface FiltersContentProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (status: StatusFilter) => void;
  employeeFilter: string;
  setEmployeeFilter: (id: string) => void;
  employees: Employee[];
  onClear: () => void;
  hasActiveFilters: boolean;
  showApplyButton?: boolean;
  onApply?: () => void;
  resultsCount?: number;
}

const FiltersContent: React.FC<FiltersContentProps> = ({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  employeeFilter,
  setEmployeeFilter,
  employees,
  onClear,
  hasActiveFilters,
  showApplyButton = false,
  onApply,
  resultsCount,
}) => {
  const { t, language } = useLanguage();
  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('search_client_service')}
          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded"
          >
            <X className="w-3 h-3 text-slate-400" />
          </button>
        )}
      </div>

      {/* Status Filter */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('status')}</label>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: t('all') },
            { id: 'confirmed', label: t('confirmed') },
            { id: 'pending', label: t('pending') },
            { id: 'completed', label: t('completed') },
            { id: 'cancelled', label: t('cancelled') },
          ].map((status) => (
            <button
              key={status.id}
              onClick={() => setStatusFilter(status.id as StatusFilter)}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-semibold transition-colors active:scale-95',
                statusFilter === status.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300'
              )}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* Employee Filter */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('employee')}</label>
        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400"
        >
          <option value="all">{t('all')}</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.firstName} {emp.lastName}
            </option>
          ))}
        </select>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="w-full py-3 text-sm font-semibold text-red-600 hover:bg-red-50 active:bg-red-100 rounded-lg transition-colors"
        >
          {t('clear_filters')}
        </button>
      )}

      {showApplyButton && onApply && (
        <div className="pt-1 space-y-2">
          <button
            type="button"
            onClick={onApply}
            className="w-full py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-700 rounded-lg transition-colors"
          >
            {language === 'es' ? 'Aplicar y cerrar' : 'Apply and close'}
          </button>
          {typeof resultsCount === 'number' && (
            <p className="text-[11px] font-medium text-slate-500 text-center">
              {language === 'es'
                ? `${resultsCount} ${resultsCount === 1 ? 'reserva encontrada' : 'reservas encontradas'}`
                : `${resultsCount} ${resultsCount === 1 ? 'booking found' : 'bookings found'}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN BOOKINGS PAGE
// ============================================================================

export default function BookingsPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employeeServices, setEmployeeServices] = useState<EmployeeService[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(null);

  // Date & View State
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parsed = new Date(`${dateParam}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const monthParam = searchParams.get('month');
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const parsed = new Date(`${monthParam}-01T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => (searchParams.get('view') === 'week' ? 'week' : 'day'));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [showCalendarDrawer, setShowCalendarDrawer] = useState(false);
  const [lastFiltersDrawerCloseAt, setLastFiltersDrawerCloseAt] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const statusParam = searchParams.get('status');
    return statusParam === 'pending' || statusParam === 'confirmed' || statusParam === 'completed' || statusParam === 'cancelled' || statusParam === 'no-show'
      ? statusParam
      : 'all';
  });
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  const [employeeFilter, setEmployeeFilter] = useState<string>(() => searchParams.get('employee') || 'all');
  const [adminBookingForm, setAdminBookingForm] = useState<AdminPaymentLinkForm | null>(null);
  const [selectedAdminServiceGroupId, setSelectedAdminServiceGroupId] = useState<string | null>(null);
  const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);
  const [generatedPaymentLink, setGeneratedPaymentLink] = useState<GeneratedPaymentLink | null>(null);
  const [copiedPaymentLink, setCopiedPaymentLink] = useState(false);

  const hasActiveFilters = statusFilter !== 'all' || employeeFilter !== 'all' || searchTerm !== '';

  useEffect(() => {
    const dateParam = searchParams.get('date');
    const nextSelectedDate = dateParam ? new Date(`${dateParam}T12:00:00`) : new Date();
    if (!Number.isNaN(nextSelectedDate.getTime()) && toDateKey(nextSelectedDate) !== toDateKey(selectedDate)) {
      setSelectedDate(nextSelectedDate);
    }

    const monthParam = searchParams.get('month');
    const nextCalendarMonth =
      monthParam && /^\d{4}-\d{2}$/.test(monthParam)
        ? new Date(`${monthParam}-01T12:00:00`)
        : nextSelectedDate;
    if (
      !Number.isNaN(nextCalendarMonth.getTime()) &&
      (nextCalendarMonth.getFullYear() !== calendarMonth.getFullYear() || nextCalendarMonth.getMonth() !== calendarMonth.getMonth())
    ) {
      setCalendarMonth(nextCalendarMonth);
    }

    const nextViewMode = searchParams.get('view') === 'week' ? 'week' : 'day';
    if (nextViewMode !== viewMode) {
      setViewMode(nextViewMode);
    }

    const nextStatus = searchParams.get('status');
    const normalizedStatus: StatusFilter =
      nextStatus === 'pending' || nextStatus === 'confirmed' || nextStatus === 'completed' || nextStatus === 'cancelled' || nextStatus === 'no-show'
        ? nextStatus
        : 'all';
    if (normalizedStatus !== statusFilter) {
      setStatusFilter(normalizedStatus);
    }

    const nextEmployee = searchParams.get('employee') || 'all';
    if (nextEmployee !== employeeFilter) {
      setEmployeeFilter(nextEmployee);
    }

    const nextSearchTerm = searchParams.get('q') || '';
    if (nextSearchTerm !== searchTerm) {
      setSearchTerm(nextSearchTerm);
    }
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', toDateKey(selectedDate));
    params.set('month', `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`);
    params.set('view', viewMode);

    if (statusFilter !== 'all') params.set('status', statusFilter);
    else params.delete('status');

    if (employeeFilter !== 'all') params.set('employee', employeeFilter);
    else params.delete('employee');

    if (searchTerm.trim()) params.set('q', searchTerm);
    else params.delete('q');

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [selectedDate, calendarMonth, viewMode, statusFilter, employeeFilter, searchTerm, pathname, router, searchParams]);

  // Data Fetching
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bookingsData, employeesData, servicesData, employeeServicesData] = await Promise.all([
          getBookings(),
          getEmployees(),
          getServices(),
          getEmployeeServices(),
        ]);
        setBookings(bookingsData);
        setEmployees(employeesData);
        setServices(servicesData);
        setEmployeeServices(employeeServicesData);
      } catch (error) {
        console.error('Error fetching bookings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Helpers
  const getServiceName = useCallback(
    (serviceId: string) =>
      services.find((s) => s.id === serviceId)?.serviceName || t('service'),
    [services, t]
  );
  
  const getEmployeeName = useCallback(
    (employeeId: string) =>
      employees.find((e) => e.id === employeeId)?.firstName || t('employee'),
    [employees, t]
  );

  const getEffectiveBookingStatus = useCallback((booking: Booking): Booking['status'] => {
    const isFullyPaid =
      booking.paymentStatus === 'paid' ||
      booking.finalPaymentReceived === true;

    if (booking.status !== 'cancelled' && isFullyPaid) {
      return 'completed';
    }

    return booking.status;
  }, []);

  const serviceCatalogConfig = useMemo(() => getDefaultServiceCatalogConfig(), []);

  const activeServices = useMemo(
    () => services.filter((service) => service.isActive !== false).sort(compareServicesByDisplayOrder),
    [services]
  );

  const adminEmployeeServices = useMemo(() => {
    if (!adminBookingForm?.employeeId) return [];

    const offeredServiceIds = new Set(
      employeeServices
        .filter((item) => item.employeeId === adminBookingForm.employeeId && item.isOffered !== false)
        .map((item) => item.serviceId)
    );
    const seenServiceKeys = new Set<string>();

    return activeServices.filter((service) => {
      if (!offeredServiceIds.has(service.id)) return false;

      const dedupeKey = [
        service.serviceName.trim().toLowerCase(),
        Number(service.price || 0).toFixed(2),
        String(service.duration || 0),
        getServiceGroupId(service),
      ].join('|');
      if (seenServiceKeys.has(dedupeKey)) return false;

      seenServiceKeys.add(dedupeKey);
      return true;
    });
  }, [activeServices, adminBookingForm?.employeeId, employeeServices]);

  const selectedAdminService = adminBookingForm
    ? services.find((service) => service.id === adminBookingForm.serviceId)
    : undefined;

  const selectedAdminEmployee = adminBookingForm
    ? employees.find((employee) => employee.id === adminBookingForm.employeeId)
    : undefined;

  const adminServiceGroups = useMemo(() => {
    const groups = serviceCatalogConfig.groups
      .map((group) => ({
        id: group.id,
        label: getCatalogGroupLabel(group, language === 'es' ? 'es' : 'en'),
        services: adminEmployeeServices.filter((service) => getServiceGroupId(service) === group.id),
      }))
      .filter((group) => group.services.length > 0);

    const knownGroupIds = new Set(serviceCatalogConfig.groups.map((group) => group.id));
    const uncataloguedServices = adminEmployeeServices.filter((service) => !knownGroupIds.has(getServiceGroupId(service)));
    if (uncataloguedServices.length > 0) {
      groups.push({
        id: 'other-services',
        label: language === 'es' ? 'Otros' : 'Other',
        services: uncataloguedServices,
      });
    }

    return groups;
  }, [adminEmployeeServices, language, serviceCatalogConfig]);

  const activeAdminServiceGroup =
    adminServiceGroups.find((group) => group.id === selectedAdminServiceGroupId) ||
    (selectedAdminService ? adminServiceGroups.find((group) => group.id === getServiceGroupId(selectedAdminService)) : undefined) ||
    adminServiceGroups[0] ||
    null;

  const openAdminBookingModal = useCallback(
    (time: string) => {
      const selectedDateKey = toDateKey(selectedDate);

      setAdminBookingForm({
        bookingDate: selectedDateKey,
        bookingTime: time,
        serviceId: '',
        employeeId: '',
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        notes: '',
      });
      setGeneratedPaymentLink(null);
      setCopiedPaymentLink(false);
      setSelectedAdminServiceGroupId(null);
    },
    [selectedDate]
  );

  const closeAdminBookingModal = () => {
    if (creatingPaymentLink) return;
    setAdminBookingForm(null);
    setSelectedAdminServiceGroupId(null);
    setGeneratedPaymentLink(null);
    setCopiedPaymentLink(false);
  };

  const handleCreateAdminPaymentLink = async () => {
    if (!adminBookingForm) return;
    if (!adminBookingForm.serviceId || !adminBookingForm.employeeId || !adminBookingForm.clientName.trim()) {
      window.alert(language === 'es'
        ? 'Elige servicio, profesional y nombre del cliente.'
        : 'Choose a service, professional, and client name.');
      return;
    }

    const service = services.find((item) => item.id === adminBookingForm.serviceId);
    if (!service) {
      window.alert(language === 'es' ? 'Servicio no encontrado.' : 'Service not found.');
      return;
    }

    const depositAmount = Math.round((Number(service.price) || 0) * 0.5 * 100);
    const createdByName = user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : user?.email || 'Admin';

    setCreatingPaymentLink(true);
    setCopiedPaymentLink(false);

    try {
      const bookingPayload: BookingFormData = {
        serviceId: adminBookingForm.serviceId,
        employeeId: adminBookingForm.employeeId,
        bookingDate: adminBookingForm.bookingDate,
        bookingTime: adminBookingForm.bookingTime,
        clientName: adminBookingForm.clientName.trim(),
        clientEmail: adminBookingForm.clientEmail.trim(),
        clientPhone: adminBookingForm.clientPhone.trim(),
        notes: adminBookingForm.notes.trim() || undefined,
        allowUnpaid: true,
        deferNotificationsUntilPaid: true,
        depositAmount,
        createdByRole: user?.role ?? 'owner',
        createdByName,
        createdByUserId: user?.id,
        paymentNotes: 'Admin payment link pending',
      };

      const bookingResponse = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload),
      });
      const bookingJson = await bookingResponse.json();
      if (!bookingResponse.ok || !bookingJson?.success || !bookingJson.data?.id) {
        throw new Error(bookingJson?.error || 'Could not create booking');
      }

      const paymentResponse = await fetch(`/api/bookings/${bookingJson.data.id}/payment-link`, {
        method: 'POST',
      });
      const paymentJson = await paymentResponse.json();
      if (!paymentResponse.ok || !paymentJson?.success || !paymentJson.data?.paymentUrl) {
        throw new Error(paymentJson?.error || 'Could not create Stripe link');
      }

      const newBooking: Booking = {
        id: bookingJson.data.id,
        salonId: 'default-salon-id',
        employeeId: adminBookingForm.employeeId,
        serviceId: adminBookingForm.serviceId,
        serviceName: service.serviceName,
        clientName: adminBookingForm.clientName.trim(),
        clientEmail: adminBookingForm.clientEmail.trim(),
        clientPhone: adminBookingForm.clientPhone.trim(),
        bookingDate: adminBookingForm.bookingDate,
        bookingTime: adminBookingForm.bookingTime,
        status: 'pending',
        requiresDeposit: true,
        depositAmount,
        depositPaid: false,
        paymentStatus: 'pending',
        paymentNotes: 'Admin payment link pending',
        createdByRole: user?.role ?? 'owner',
        createdByName,
        createdByUserId: user?.id,
        notes: adminBookingForm.notes.trim() || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setBookings((prev) => [newBooking, ...prev]);
      setGeneratedPaymentLink({
        bookingId: bookingJson.data.id,
        paymentUrl: paymentJson.data.paymentUrl,
        amount: paymentJson.data.amount || depositAmount,
      });
    } catch (error: any) {
      console.error('Failed to create admin payment link:', error);
      window.alert(
        (language === 'es' ? 'No se pudo crear el enlace de pago.\n\n' : 'Could not create the payment link.\n\n') +
          (error?.message || 'Unknown error')
      );
    } finally {
      setCreatingPaymentLink(false);
    }
  };

  const copyGeneratedPaymentLink = async () => {
    if (!generatedPaymentLink?.paymentUrl) return;
    try {
      await navigator.clipboard.writeText(generatedPaymentLink.paymentUrl);
      setCopiedPaymentLink(true);
      window.setTimeout(() => setCopiedPaymentLink(false), 2000);
    } catch (_error) {
      window.prompt(
        language === 'es' ? 'Copia este enlace de pago:' : 'Copy this payment link:',
        generatedPaymentLink.paymentUrl
      );
    }
  };

  const handleDeleteBooking = useCallback(
    async (booking: Booking) => {
      const confirmMessage =
        language === 'es'
          ? `¿Eliminar definitivamente la reserva de ${booking.clientName || 'este cliente'} el ${formatDate(booking.bookingDate)} a las ${booking.bookingTime}?\n\nEsta acción no se puede deshacer.`
          : `Permanently delete the booking for ${booking.clientName || 'this client'} on ${formatDate(booking.bookingDate)} at ${booking.bookingTime}?\n\nThis cannot be undone.`;
      if (!window.confirm(confirmMessage)) return;

      setDeletingBookingId(booking.id);
      try {
        const response = await fetch(`/api/bookings/${booking.id}`, { method: 'DELETE' });
        const json = await response.json().catch(() => ({ success: response.ok }));
        if (!response.ok || json.success === false) {
          throw new Error(json.error || 'Failed to delete booking');
        }
        setBookings((prev) => prev.filter((b) => b.id !== booking.id));
      } catch (error: any) {
        console.error('Failed to delete booking:', error);
        window.alert(
          (language === 'es' ? 'No se pudo eliminar la reserva.\n\n' : 'Could not delete booking.\n\n') +
            (error?.message || 'Unknown error')
        );
      } finally {
        setDeletingBookingId(null);
      }
    },
    [language]
  );

  // Booking counts by date
  const bookingCounts = useMemo(() => {
    return bookings.reduce<Record<string, number>>((acc, booking) => {
      acc[booking.bookingDate] = (acc[booking.bookingDate] || 0) + 1;
      return acc;
    }, {});
  }, [bookings]);

  // Identify dates with past unpaid bookings
  const pastUnpaidDates = useMemo(() => {
    const now = new Date();
    const todayStr = toDateKey(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const dates = new Set<string>();
    bookings.forEach(b => {
      if (b.status === 'cancelled' || b.paymentStatus === 'paid') return;

      const [hours, minutes] = b.bookingTime.split(':').map(Number);
      const bookingMinutes = hours * 60 + minutes;

      const isPast = b.bookingDate < todayStr || (b.bookingDate === todayStr && bookingMinutes < nowMinutes);
      
      if (isPast) {
        dates.add(b.bookingDate);
      }
    });
    return dates;
  }, [bookings]);

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    const selectedDateKey = toDateKey(selectedDate);
    const weekDays = getWeekDays(selectedDate).map(toDateKey);

    return bookings
      .filter((b) => {
        if (viewMode === 'day') {
          return b.bookingDate === selectedDateKey;
        } else {
          return weekDays.includes(b.bookingDate);
        }
      })
      .filter((b) => statusFilter === 'all' || getEffectiveBookingStatus(b) === statusFilter)
      .filter((b) => employeeFilter === 'all' || b.employeeId === employeeFilter)
      .filter((b) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return (
          b.clientName?.toLowerCase().includes(term) ||
          b.clientEmail?.toLowerCase().includes(term) ||
          getServiceName(b.serviceId).toLowerCase().includes(term) ||
          getEmployeeName(b.employeeId).toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        if (a.bookingDate !== b.bookingDate) {
          return a.bookingDate.localeCompare(b.bookingDate);
        }
        return a.bookingTime.localeCompare(b.bookingTime);
      });
  }, [bookings, selectedDate, viewMode, statusFilter, employeeFilter, searchTerm, getServiceName, getEmployeeName, getEffectiveBookingStatus]);

  // Group bookings by date
  const bookingsByDate = useMemo(() => {
    return filteredBookings.reduce<Record<string, Booking[]>>((acc, booking) => {
      acc[booking.bookingDate] = acc[booking.bookingDate] || [];
      acc[booking.bookingDate].push(booking);
      return acc;
    }, {});
  }, [filteredBookings]);

  const serviceDurationById = useMemo(
    () => new Map(services.map((service) => [service.id, service.duration])),
    [services]
  );

  const dayDiarySlots = useMemo(() => {
    const selectedDateKey = toDateKey(selectedDate);
    const dayBookings = filteredBookings
      .filter((booking) => booking.bookingDate === selectedDateKey && booking.status !== 'cancelled')
      .sort((a, b) => a.bookingTime.localeCompare(b.bookingTime));

    const starts = dayBookings.map((booking) => minutesFromTime(booking.bookingTime));
    const defaultStart = 9 * 60;
    const defaultEnd = 20 * 60;
    const earliestStart = starts.length ? Math.min(defaultStart, Math.min(...starts)) : defaultStart;
    const latestEnd = dayBookings.reduce((latest, booking) => {
      const start = minutesFromTime(booking.bookingTime);
      const duration = booking.isConsultation
        ? booking.consultationDuration || 20
        : serviceDurationById.get(booking.serviceId) || 30;
      return Math.max(latest, start + duration);
    }, defaultEnd);

    const startMinute = Math.floor(earliestStart / 30) * 30;
    const endMinute = Math.ceil(latestEnd / 30) * 30;

    return Array.from({ length: Math.max(0, (endMinute - startMinute) / 30) }, (_, index) => {
      const slotStart = startMinute + index * 30;
      const slotEnd = slotStart + 30;
      const startingBookings = dayBookings.filter((booking) => minutesFromTime(booking.bookingTime) === slotStart);
      const overlappingBooking = dayBookings.find((booking) => {
        const bookingStart = minutesFromTime(booking.bookingTime);
        const duration = booking.isConsultation
          ? booking.consultationDuration || 20
          : serviceDurationById.get(booking.serviceId) || 30;
        return rangesOverlap(slotStart, slotEnd, bookingStart, bookingStart + duration);
      });

      return {
        time: timeFromMinutes(slotStart),
        startingBookings,
        occupiedByContinuation: Boolean(overlappingBooking && startingBookings.length === 0),
      };
    });
  }, [filteredBookings, selectedDate, serviceDurationById]);

  // Navigation handlers
  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCalendarMonth(today);
  };

  const goToPrevWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate);
    if (newDate.getMonth() !== calendarMonth.getMonth()) {
      setCalendarMonth(newDate);
    }
  };

  const goToNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedDate(newDate);
    if (newDate.getMonth() !== calendarMonth.getMonth()) {
      setCalendarMonth(newDate);
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    if (date.getMonth() !== calendarMonth.getMonth() || date.getFullYear() !== calendarMonth.getFullYear()) {
      setCalendarMonth(date);
    }
    setShowCalendarDrawer(false);
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setEmployeeFilter('all');
    setSearchTerm('');
  };

  const openFiltersDrawer = () => {
    // Prevent immediate reopen when closing from the top-right button
    // on mobile devices where taps can bleed through to underlying elements.
    if (Date.now() - lastFiltersDrawerCloseAt < 250) return;
    setShowFiltersDrawer(true);
  };

  const closeFiltersDrawer = () => {
    setShowFiltersDrawer(false);
    setLastFiltersDrawerCloseAt(Date.now());
  };

  const detailHrefForBooking = useCallback(
    (bookingId: string) => {
      const query = searchParams.toString();
      return query ? `/dashboard/bookings/${bookingId}?returnTo=${encodeURIComponent(`${pathname}?${query}`)}` : `/dashboard/bookings/${bookingId}`;
    },
    [pathname, searchParams]
  );

  // Keyboard navigation (desktop only)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case 'ArrowLeft':
          if (e.shiftKey) {
            goToPrevWeek();
          } else {
            const prev = new Date(selectedDate);
            prev.setDate(prev.getDate() - 1);
            handleDateSelect(prev);
          }
          break;
        case 'ArrowRight':
          if (e.shiftKey) {
            goToNextWeek();
          } else {
            const next = new Date(selectedDate);
            next.setDate(next.getDate() + 1);
            handleDateSelect(next);
          }
          break;
        case 't':
        case 'T':
          goToToday();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ================================================================== */}
      {/* HEADER */}
      {/* ================================================================== */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-3 lg:py-4">
          {/* Mobile Header */}
          <div className="flex lg:hidden items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{t('bookings')}</h1>
              <p className="text-xs text-slate-500">{formatDateShort(selectedDate, language)}</p>
            </div>
            <div className="flex items-center gap-2">
              {!isToday(selectedDate) && (
                <button
                  onClick={goToToday}
                  className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold"
                >
                  {t('today')}
                </button>
              )}
              <button
                onClick={() => setShowCalendarDrawer(true)}
                className="p-2.5 bg-slate-100 rounded-lg"
              >
                <CalendarDays className="w-5 h-5 text-slate-600" />
              </button>
              <button
                onClick={openFiltersDrawer}
                className={cn(
                  'p-2.5 rounded-lg relative',
                  hasActiveFilters ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                )}
              >
                <Filter className="w-5 h-5" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full" />
                )}
              </button>
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('bookings')}</h1>
                <p className="text-sm text-slate-500">{formatDateLong(selectedDate, language)}</p>
              </div>
              {!isToday(selectedDate) && (
                <button
                  onClick={goToToday}
                  className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-sm font-semibold transition-colors"
                >
                  {t('go_to_today')}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDatePicker(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                {t('go_to_date')}
              </button>
              <div className="flex items-center bg-slate-100 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('day')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                    viewMode === 'day'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  {t('day')}
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                    viewMode === 'week'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  {t('week')}
                </button>
              </div>
              <Link
                href="/dashboard"
                className="px-4 py-2.5 border border-slate-200 hover:border-slate-400 rounded-xl text-sm font-semibold text-slate-600 transition-colors"
              >
                {t('dashboard')}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      {/* MOBILE VIEW TOGGLE */}
      {/* ================================================================== */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2">
        <div className="flex items-center justify-center bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setViewMode('day')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              viewMode === 'day'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500'
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            {t('day')}
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              viewMode === 'week'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500'
            )}
          >
            <List className="w-4 h-4" />
            {t('week')}
          </button>
        </div>
      </div>

      {/* ================================================================== */}
      {/* WEEK STRIP */}
      {/* ================================================================== */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-3 lg:py-4">
          {/* Mobile Week Strip */}
          <div className="lg:hidden">
            <MobileWeekStrip
              selectedDate={selectedDate}
              onSelectDate={handleDateSelect}
              bookingCounts={bookingCounts}
              pastUnpaidDates={pastUnpaidDates}
              onPrevWeek={goToPrevWeek}
              onNextWeek={goToNextWeek}
            />
          </div>
          {/* Desktop Week Strip */}
          <div className="hidden lg:block">
            <DesktopWeekStrip
              selectedDate={selectedDate}
              onSelectDate={handleDateSelect}
              bookingCounts={bookingCounts}
              pastUnpaidDates={pastUnpaidDates}
              onPrevWeek={goToPrevWeek}
              onNextWeek={goToNextWeek}
            />
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* MAIN CONTENT */}
      {/* ================================================================== */}
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-4 lg:py-6">
        <div className="flex gap-6">
          {/* ============================================================== */}
          {/* DESKTOP SIDEBAR */}
          {/* ============================================================== */}
          <aside className="hidden lg:block w-72 flex-shrink-0 space-y-6">
            <MiniCalendar
              selectedDate={selectedDate}
              onSelectDate={handleDateSelect}
              bookingCounts={bookingCounts}
              pastUnpaidDates={pastUnpaidDates}
              currentMonth={calendarMonth}
              onMonthChange={setCalendarMonth}
            />

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4" />
                {t('filters')}
              </h3>
              <FiltersContent
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                employeeFilter={employeeFilter}
                setEmployeeFilter={setEmployeeFilter}
                employees={employees}
                onClear={clearFilters}
                hasActiveFilters={hasActiveFilters}
              />
            </div>

            {/* Keyboard Shortcuts */}
            <div className="bg-slate-100 rounded-2xl p-4 text-[11px] text-slate-500 space-y-1">
              <div className="font-semibold text-slate-700 mb-2">{t('keyboard_shortcuts')}</div>
              <div className="flex justify-between">
                <span>{t('previous_next_day')}</span>
                <span className="font-mono">← →</span>
              </div>
              <div className="flex justify-between">
                <span>{t('previous_next_week')}</span>
                <span className="font-mono">⇧← ⇧→</span>
              </div>
              <div className="flex justify-between">
                <span>{t('go_to_today')}</span>
                <span className="font-mono">T</span>
              </div>
            </div>
          </aside>

          {/* ============================================================== */}
          {/* MAIN AREA */}
          {/* ============================================================== */}
          <main className="flex-1 min-w-0">
            {/* Stats Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3 lg:p-4 mb-4 lg:mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 lg:gap-6 overflow-x-auto">
                  <div className="flex-shrink-0">
                    <div className="text-xl lg:text-2xl font-bold text-slate-900">{filteredBookings.length}</div>
                    <div className="text-[10px] lg:text-xs text-slate-500 whitespace-nowrap">
                      {viewMode === 'day' ? t('today').toLowerCase() : t('week').toLowerCase()}
                    </div>
                  </div>
                  <div className="w-px h-8 lg:h-10 bg-slate-200 flex-shrink-0" />
                  <div className="flex-shrink-0">
                    <div className="text-xl lg:text-2xl font-bold text-emerald-600">
                      {filteredBookings.filter((b) => getEffectiveBookingStatus(b) === 'confirmed').length}
                    </div>
                    <div className="text-[10px] lg:text-xs text-slate-500">{t('confirmed').toLowerCase()}</div>
                  </div>
                  <div className="w-px h-8 lg:h-10 bg-slate-200 flex-shrink-0" />
                  <div className="flex-shrink-0">
                    <div className="text-xl lg:text-2xl font-bold text-amber-600">
                      {filteredBookings.filter((b) => getEffectiveBookingStatus(b) === 'pending').length}
                    </div>
                    <div className="text-[10px] lg:text-xs text-slate-500">{t('pending').toLowerCase()}</div>
                  </div>
                </div>
                {hasActiveFilters && (
                  <span className="hidden sm:block text-xs text-slate-500 flex-shrink-0 ml-4">
                    {t('filters_active')}
                  </span>
                )}
              </div>
            </div>

            {/* Bookings Content */}
            {viewMode === 'day' ? (
              // Day View
              <div className="space-y-5 lg:space-y-6">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 lg:px-6 lg:py-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                          {language === 'es' ? 'Diario visual' : 'Visual diary'}
                        </p>
                        <h2 className="text-base font-bold text-slate-900 lg:text-lg">
                          {formatDateLong(selectedDate, language)}
                        </h2>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          {language === 'es' ? 'Libre' : 'Free'}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-slate-900" />
                          {language === 'es' ? 'Reserva' : 'Booking'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {dayDiarySlots.map((slot) => (
                      <div key={slot.time} className="grid grid-cols-[72px_1fr] lg:grid-cols-[92px_1fr]">
                        <div className="border-r border-slate-100 bg-slate-50/70 px-3 py-3 text-right">
                          <span className="text-xs font-black tabular-nums tracking-tight text-slate-500">
                            {slot.time}
                          </span>
                        </div>
                        <div className="min-h-[54px] px-3 py-2 lg:px-4">
                          {slot.startingBookings.length > 0 ? (
                            <div className="space-y-2">
                              {slot.startingBookings.map((booking) => {
                                const serviceName = getServiceName(booking.serviceId);
                                const employeeName = getEmployeeName(booking.employeeId);
                                const duration = booking.isConsultation
                                  ? booking.consultationDuration || 20
                                  : serviceDurationById.get(booking.serviceId) || 30;

                                return (
                                  <Link
                                    key={booking.id}
                                    href={detailHrefForBooking(booking.id)}
                                    className="block rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                                  >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-black uppercase tracking-tight">
                                          {booking.clientName || t('no_name')}
                                        </p>
                                        <p className="mt-1 truncate text-xs font-semibold text-white/70">
                                          {serviceName} · {employeeName}
                                        </p>
                                      </div>
                                      <p className="shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
                                        {formatTime(booking.bookingTime)} · {duration} min
                                      </p>
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                          ) : slot.occupiedByContinuation ? (
                            <div className="flex h-full min-h-[38px] items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                                {language === 'es' ? 'Ocupado' : 'Occupied'}
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openAdminBookingModal(slot.time)}
                              className="flex h-full min-h-[38px] w-full items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 text-left transition-all hover:border-emerald-300 hover:bg-emerald-100"
                            >
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
                                {language === 'es' ? 'Libre' : 'Free'}
                              </span>
                              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700">
                                {language === 'es' ? 'Crear reserva + pago' : 'Create booking + pay'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {filteredBookings.length > 0 && (
                  <div className="grid gap-3 lg:gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      serviceName={getServiceName(booking.serviceId)}
                      employeeName={getEmployeeName(booking.employeeId)}
                      detailHref={detailHrefForBooking(booking.id)}
                      onDelete={handleDeleteBooking}
                      isDeleting={deletingBookingId === booking.id}
                    />
                  ))}
                  </div>
                )}
              </div>
            ) : (
              // Week View
              <div className="space-y-4 lg:space-y-6">
                {Object.keys(bookingsByDate).length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 lg:p-12 text-center">
                    <div className="w-14 h-14 lg:w-16 lg:h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-7 h-7 lg:w-8 lg:h-8 text-slate-400" />
                    </div>
                    <h3 className="text-base lg:text-lg font-semibold text-slate-900 mb-1">{t('no_bookings_week')}</h3>
                    <p className="text-sm text-slate-500">
                      {t('no_bookings_filters')}
                    </p>
                  </div>
                ) : (
                  getWeekDays(selectedDate).map((day) => {
                    const dateKey = toDateKey(day);
                    const dayBookings = bookingsByDate[dateKey] || [];
                    const isDaySelected = isSameDay(day, selectedDate);
                    const isTodayDate = isToday(day);

                    return (
                      <div
                        key={dateKey}
                        className={cn(
                          'bg-white rounded-2xl border overflow-hidden transition-all',
                          isDaySelected
                            ? 'border-slate-400 shadow-md'
                            : 'border-slate-200'
                        )}
                      >
                        {/* Day Header */}
                        <button
                          onClick={() => handleDateSelect(day)}
                          className={cn(
                            'w-full px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between transition-colors',
                            isDaySelected ? 'bg-slate-900 text-white' : 'bg-slate-50 hover:bg-slate-100 active:bg-slate-200'
                          )}
                        >
                          <div className="flex items-center gap-3 lg:gap-4">
                            <div className={cn(
                              'w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex flex-col items-center justify-center',
                              isDaySelected ? 'bg-white/10' : isTodayDate ? 'bg-amber-100' : 'bg-white'
                            )}>
                              <span className={cn(
                                'text-[9px] lg:text-[10px] font-bold uppercase',
                                isDaySelected ? 'text-white/70' : 'text-slate-400'
                              )}>
                                {DAYS_SHORT_BY_INDEX[language][day.getDay()]}
                              </span>
                              <span className={cn(
                                'text-base lg:text-lg font-bold',
                                isDaySelected ? 'text-white' : isTodayDate ? 'text-amber-700' : 'text-slate-900'
                              )}>
                                {day.getDate()}
                              </span>
                            </div>
                            <div className="text-left">
                              <div className={cn(
                                'font-semibold text-sm lg:text-base',
                                isDaySelected ? 'text-white' : 'text-slate-900'
                              )}>
                                {DAYS_FULL_BY_INDEX[language][day.getDay()]}
                              </div>
                              <div className={cn(
                                'text-xs lg:text-sm',
                                isDaySelected ? 'text-white/70' : 'text-slate-500'
                              )}>
                                {language === 'es'
                                  ? `${day.getDate()} de ${MONTHS_BY_INDEX[language][day.getMonth()]}`
                                  : `${MONTHS_BY_INDEX[language][day.getMonth()]} ${day.getDate()}`}
                              </div>
                            </div>
                          </div>
                          <div className={cn(
                            'px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-xs lg:text-sm font-semibold',
                            isDaySelected
                              ? 'bg-white/20 text-white'
                              : dayBookings.length > 0
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-400'
                          )}>
                            {dayBookings.length}{' '}
                            {language === 'es'
                              ? dayBookings.length === 1 ? 'reserva' : 'reservas'
                              : dayBookings.length === 1 ? 'booking' : 'bookings'}
                          </div>
                        </button>

                        {/* Day Bookings */}
                        {dayBookings.length > 0 && (
                          <div className="p-3 lg:p-4 space-y-2">
                            {dayBookings.map((booking) => (
                              <BookingCard
                                key={booking.id}
                                booking={booking}
                                serviceName={getServiceName(booking.serviceId)}
                                employeeName={getEmployeeName(booking.employeeId)}
                                detailHref={detailHrefForBooking(booking.id)}
                                compact
                                onDelete={handleDeleteBooking}
                                isDeleting={deletingBookingId === booking.id}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ================================================================== */}
      {/* MODALS & DRAWERS */}
      {/* ================================================================== */}
      
      {/* Date Picker Modal */}
      <DatePickerModal
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={selectedDate}
        onSelectDate={handleDateSelect}
      />

      {/* Mobile Filters Drawer */}
      <Drawer
        isOpen={showFiltersDrawer}
        onClose={closeFiltersDrawer}
        title={t('filters')}
      >
        <FiltersContent
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          employeeFilter={employeeFilter}
          setEmployeeFilter={setEmployeeFilter}
          employees={employees}
          onClear={clearFilters}
          hasActiveFilters={hasActiveFilters}
          showApplyButton
          onApply={closeFiltersDrawer}
          resultsCount={filteredBookings.length}
        />
      </Drawer>

      {/* Mobile Calendar Drawer */}
      <Drawer
        isOpen={showCalendarDrawer}
        onClose={() => setShowCalendarDrawer(false)}
        title={t('calendar')}
      >
        <div className="space-y-4">
          <MiniCalendar
            selectedDate={selectedDate}
            onSelectDate={handleDateSelect}
            bookingCounts={bookingCounts}
            pastUnpaidDates={pastUnpaidDates}
            currentMonth={calendarMonth}
            onMonthChange={setCalendarMonth}
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                goToToday();
                setShowCalendarDrawer(false);
              }}
              className="flex-1 py-3 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 rounded-xl text-sm font-semibold text-amber-700 transition-colors"
            >
              {t('go_to_today')}
            </button>
            <button
              onClick={() => setShowDatePicker(true)}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl text-sm font-semibold text-slate-700 transition-colors"
            >
              {t('select_date')}
            </button>
          </div>
        </div>
      </Drawer>

      {adminBookingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">
                  {language === 'es' ? 'Reserva con enlace de pago' : 'Booking payment link'}
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                  {formatDateLong(new Date(`${adminBookingForm.bookingDate}T12:00:00`), language)} · {adminBookingForm.bookingTime}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeAdminBookingModal}
                className="rounded-xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-900 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              {!generatedPaymentLink ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        {language === 'es' ? 'Profesional' : 'Professional'}
                      </span>
                      <select
                        value={adminBookingForm.employeeId}
                        onChange={(event) => {
                          setSelectedAdminServiceGroupId(null);
                          setAdminBookingForm((prev) => prev ? { ...prev, employeeId: event.target.value, serviceId: '' } : prev);
                        }}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400"
                      >
                        <option value="">{language === 'es' ? 'Elige profesional' : 'Choose professional'}</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {`${employee.firstName} ${employee.lastName || ''}`.trim()}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="space-y-3 rounded-3xl border border-slate-100 bg-slate-50/70 p-3">
                    <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          {language === 'es' ? 'Servicio' : 'Service'}
                        </p>
                        <p className="text-xs font-semibold text-slate-500">
                          {!adminBookingForm.employeeId
                            ? (language === 'es' ? 'Primero elige profesional' : 'Choose a professional first')
                            : (language === 'es'
                              ? `Servicios que ofrece ${selectedAdminEmployee?.firstName || 'este profesional'}`
                              : `Services offered by ${selectedAdminEmployee?.firstName || 'this professional'}`)}
                        </p>
                      </div>
                      {selectedAdminService && (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                          {language === 'es' ? 'Seleccionado' : 'Selected'}
                        </span>
                      )}
                    </div>

                    {!adminBookingForm.employeeId ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        {language === 'es' ? 'Elige profesional para ver sus servicios' : 'Choose a professional to see services'}
                      </div>
                    ) : adminEmployeeServices.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        {language === 'es' ? 'Este profesional no tiene servicios asignados' : 'This professional has no assigned services'}
                      </div>
                    ) : (
                      <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {adminServiceGroups.map((group) => {
                        const isActive = activeAdminServiceGroup?.id === group.id;
                        return (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => setSelectedAdminServiceGroupId(group.id)}
                            className={cn(
                              'rounded-2xl border px-3 py-3 text-left transition-all',
                              isActive
                                ? 'border-emerald-300 bg-white shadow-sm'
                                : 'border-slate-100 bg-white/70 hover:border-slate-300'
                            )}
                          >
                            <p className={cn(
                              'text-[10px] font-black uppercase tracking-[0.14em] leading-tight',
                              isActive ? 'text-emerald-700' : 'text-slate-700'
                            )}>
                              {group.label}
                            </p>
                            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                              {group.services.length} {language === 'es' ? 'servicios' : 'services'}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    {activeAdminServiceGroup && (
                      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                        {activeAdminServiceGroup.services.map((service) => {
                          const isSelected = service.id === adminBookingForm.serviceId;
                          return (
                            <button
                              key={service.id}
                              type="button"
                              onClick={() => {
                                setSelectedAdminServiceGroupId(getServiceGroupId(service));
                                setAdminBookingForm((prev) => prev ? { ...prev, serviceId: service.id } : prev);
                              }}
                              className={cn(
                                'w-full rounded-2xl border px-4 py-3 text-left transition-all',
                                isSelected
                                  ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                                  : 'border-slate-100 bg-white text-slate-800 hover:border-emerald-300 hover:shadow-sm'
                              )}
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <p className="text-xs font-black uppercase tracking-[0.1em] leading-snug">
                                  {service.serviceName}
                                </p>
                                <p className={cn(
                                  'shrink-0 text-[10px] font-black uppercase tracking-[0.16em]',
                                  isSelected ? 'text-white/70' : 'text-slate-400'
                                )}>
                                  {formatCurrency(service.price)} · {service.duration} min
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                      </>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        {language === 'es' ? 'Cliente' : 'Client'}
                      </span>
                      <input
                        value={adminBookingForm.clientName}
                        onChange={(event) => setAdminBookingForm((prev) => prev ? { ...prev, clientName: event.target.value } : prev)}
                        placeholder={language === 'es' ? 'Nombre completo' : 'Full name'}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Email</span>
                      <input
                        type="email"
                        value={adminBookingForm.clientEmail}
                        onChange={(event) => setAdminBookingForm((prev) => prev ? { ...prev, clientEmail: event.target.value } : prev)}
                        placeholder="cliente@email.com"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        {language === 'es' ? 'Telefono' : 'Phone'}
                      </span>
                      <input
                        value={adminBookingForm.clientPhone}
                        onChange={(event) => setAdminBookingForm((prev) => prev ? { ...prev, clientPhone: event.target.value } : prev)}
                        placeholder="+34..."
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400"
                      />
                    </label>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      {language === 'es' ? 'Notas internas' : 'Internal notes'}
                    </span>
                    <textarea
                      value={adminBookingForm.notes}
                      onChange={(event) => setAdminBookingForm((prev) => prev ? { ...prev, notes: event.target.value } : prev)}
                      rows={3}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400"
                    />
                  </label>

                  {selectedAdminService && (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">
                        {language === 'es' ? 'Deposito a cobrar' : 'Deposit to collect'}
                      </p>
                      <p className="mt-1 text-2xl font-black text-emerald-900">
                        {formatCurrency(selectedAdminService.price * 0.5)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-emerald-700">
                        50% {language === 'es' ? 'de' : 'of'} {formatCurrency(selectedAdminService.price)}
                        {selectedAdminEmployee ? ` · ${selectedAdminEmployee.firstName}` : ''}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={closeAdminBookingModal}
                      className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-slate-500 transition hover:border-slate-400"
                    >
                      {language === 'es' ? 'Cancelar' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateAdminPaymentLink}
                      disabled={creatingPaymentLink}
                      className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {creatingPaymentLink
                        ? (language === 'es' ? 'Creando...' : 'Creating...')
                        : (language === 'es' ? 'Crear enlace 50%' : 'Create 50% link')}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-emerald-600">
                      <Check className="h-7 w-7" />
                    </div>
                    <h3 className="mt-4 text-xl font-black text-slate-900">
                      {language === 'es' ? 'Enlace listo para enviar' : 'Payment link ready'}
                    </h3>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      {language === 'es'
                        ? 'La reserva queda pendiente hasta que el cliente pague el deposito.'
                        : 'The booking stays pending until the client pays the deposit.'}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      {language === 'es' ? 'Importe del enlace' : 'Link amount'}
                    </p>
                    <p className="mt-1 text-2xl font-black text-slate-900">
                      {formatCurrency(generatedPaymentLink.amount / 100)}
                    </p>
                    <div className="mt-4 break-all rounded-xl bg-white p-3 text-xs font-semibold text-slate-600">
                      {generatedPaymentLink.paymentUrl}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={copyGeneratedPaymentLink}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-emerald-700"
                    >
                      {copiedPaymentLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedPaymentLink
                        ? (language === 'es' ? 'Copiado' : 'Copied')
                        : (language === 'es' ? 'Copiar enlace' : 'Copy link')}
                    </button>
                    <a
                      href={generatedPaymentLink.paymentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-slate-700 transition hover:border-slate-400"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {language === 'es' ? 'Abrir' : 'Open'}
                    </a>
                  </div>

                  <button
                    type="button"
                    onClick={closeAdminBookingModal}
                    className="w-full rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-slate-600 transition hover:bg-slate-200"
                  >
                    {language === 'es' ? 'Cerrar' : 'Close'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add custom scrollbar hide utility */}
      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
