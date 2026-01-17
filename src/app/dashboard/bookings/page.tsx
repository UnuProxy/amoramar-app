'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { getBookings, getEmployees, getServices } from '@/shared/lib/firestore';
import type { Booking, Employee, Service } from '@/shared/lib/types';
import { formatTime, cn } from '@/shared/lib/utils';
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
} from 'lucide-react';

type ViewMode = 'day' | 'week';
type StatusFilter = 'all' | Booking['status'];

// ============================================================================
// DATE UTILITIES
// ============================================================================

const DAYS_ES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_FULL_ES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_ES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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

const formatDateLong = (date: Date): string => {
  return `${DAYS_FULL_ES[date.getDay()]}, ${date.getDate()} de ${MONTHS_ES[date.getMonth()]}`;
};

const formatDateShort = (date: Date): string => {
  return `${date.getDate()} ${MONTHS_ES[date.getMonth()].substring(0, 3)}`;
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

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <h2 className="text-lg font-bold text-stone-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-stone-500" />
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
    <div className="bg-white rounded-2xl border border-stone-200 p-4 lg:p-5 shadow-sm">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors active:bg-stone-200"
        >
          <ChevronLeft className="w-5 h-5 text-stone-600" />
        </button>
        <h3 className="text-sm font-semibold text-stone-900 tracking-wide">
          {MONTHS_ES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors active:bg-stone-200"
        >
          <ChevronRight className="w-5 h-5 text-stone-600" />
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 mb-2">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
          <div key={day} className="text-center text-[10px] font-bold text-stone-400 uppercase tracking-wider py-1">
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
                  ? 'bg-stone-900 text-white ring-2 ring-stone-900 ring-offset-2'
                  : isTodayDate
                  ? 'ring-2 ring-amber-400 ring-offset-1 bg-amber-50 text-amber-700'
                  : count > 0
                  ? getBookingIntensity(count)
                  : 'text-stone-600 hover:bg-stone-50 active:bg-stone-100',
                hasPastUnpaid && !isSelected && 'ring-2 ring-rose-500 ring-offset-1'
              )}
            >
              {day.getDate()}
              {count > 0 && !isSelected && (
                <span className={cn(
                  "absolute -top-1 -right-1 w-4 h-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center",
                  hasPastUnpaid ? "bg-rose-600" : "bg-stone-900"
                )}>
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-stone-100 space-y-3">
        <div className="flex items-center justify-between text-[10px] text-stone-500">
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
          <span>Pending payments</span>
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
  const weekDays = getWeekDays(selectedDate);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrevWeek}
        className="p-2 hover:bg-stone-100 rounded-lg transition-colors flex-shrink-0 active:bg-stone-200"
      >
        <ChevronLeft className="w-5 h-5 text-stone-600" />
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
                    ? 'bg-stone-900 text-white border-stone-900 shadow-lg'
                    : isTodayDate
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : hasPastUnpaid
                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                    : 'bg-white border-stone-200 text-stone-600 active:border-stone-400'
                )}
              >
                <span className={cn(
                  'text-[9px] font-bold uppercase tracking-wider',
                  isSelected ? 'text-stone-400' : 'text-stone-400'
                )}>
                  {DAYS_ES[day.getDay()]}
                </span>
                <span className={cn(
                  'text-lg font-bold',
                  isSelected ? 'text-white' : 'text-stone-900'
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
        className="p-2 hover:bg-stone-100 rounded-lg transition-colors flex-shrink-0 active:bg-stone-200"
      >
        <ChevronRight className="w-5 h-5 text-stone-600" />
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
  const weekDays = getWeekDays(selectedDate);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrevWeek}
        className="p-3 hover:bg-stone-100 rounded-xl transition-colors border border-stone-200"
      >
        <ChevronLeft className="w-5 h-5 text-stone-600" />
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
                  ? 'bg-stone-900 text-white border-stone-900 shadow-lg'
                  : isTodayDate
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : hasPastUnpaid
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-white border-stone-200 hover:border-stone-400 text-stone-600'
              )}
            >
              <span className={cn(
                'text-[10px] font-bold uppercase tracking-wider',
                isSelected ? 'text-stone-400' : 'text-stone-400'
              )}>
                {DAYS_ES[day.getDay()]}
              </span>
              <span className={cn(
                'text-xl font-bold mt-1',
                isSelected ? 'text-white' : 'text-stone-900'
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
                  {count} booking{count !== 1 ? 's' : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={onNextWeek}
        className="p-3 hover:bg-stone-100 rounded-xl transition-colors border border-stone-200"
      >
        <ChevronRight className="w-5 h-5 text-stone-600" />
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
  compact?: boolean;
}

const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  serviceName,
  employeeName,
  compact = false,
}) => {
  const getStatusConfig = (status: Booking['status']) => {
    switch (status) {
      case 'confirmed':
        return { label: 'Confirmada', bg: 'bg-emerald-500', text: 'text-white' };
      case 'completed':
        return { label: 'Completada', bg: 'bg-stone-700', text: 'text-white' };
      case 'cancelled':
        return { label: 'Cancelada', bg: 'bg-red-500', text: 'text-white' };
      default:
        return { label: 'Pendiente', bg: 'bg-amber-400', text: 'text-amber-900' };
    }
  };

  const getPaymentStatus = () => {
    if (booking.paymentStatus === 'paid' || booking.depositPaid) {
      return { label: 'Pagado', color: 'text-emerald-600' };
    }
    if (booking.paymentStatus === 'refunded') {
      return { label: 'Reembolsado', color: 'text-stone-500' };
    }
    if (booking.paymentStatus === 'failed') {
      return { label: 'Fallido', color: 'text-red-500' };
    }
    return { label: 'Pendiente', color: 'text-amber-600' };
  };

  const status = getStatusConfig(booking.status);
  const payment = getPaymentStatus();

  if (compact) {
    return (
      <Link
        href={`/dashboard/bookings/${booking.id}`}
        className="group flex items-center gap-3 p-3 lg:p-4 bg-white rounded-xl border border-stone-200 hover:border-stone-400 hover:shadow-md transition-all active:bg-stone-50"
      >
        <div className="flex-shrink-0 w-14 lg:w-16 text-center">
          <div className="text-base lg:text-lg font-bold text-stone-900">{formatTime(booking.bookingTime)}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-stone-900 truncate text-sm lg:text-base">{booking.clientName || 'Sin nombre'}</div>
          <div className="text-xs lg:text-sm text-stone-500 truncate">{serviceName}</div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <span className={cn('px-2 lg:px-3 py-1 rounded-full text-[9px] lg:text-[10px] font-bold uppercase tracking-wide', status.bg, status.text)}>
            {status.label}
          </span>
          <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-600 group-hover:translate-x-1 transition-all hidden sm:block" />
        </div>
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Time Header */}
      <div className="bg-stone-900 px-4 lg:px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-stone-400" />
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
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 lg:w-5 lg:h-5 text-stone-500" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-stone-900 text-sm lg:text-base truncate">{booking.clientName || 'Sin nombre'}</div>
            <div className="text-xs lg:text-sm text-stone-500 truncate">{booking.clientEmail}</div>
            {booking.clientPhone && (
              <div className="text-xs lg:text-sm text-stone-500">{booking.clientPhone}</div>
            )}
          </div>
        </div>

        {/* Service */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
            <Scissors className="w-4 h-4 lg:w-5 lg:h-5 text-stone-500" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-stone-900 text-sm lg:text-base truncate">{serviceName}</div>
            <div className="text-xs lg:text-sm text-stone-500">con {employeeName}</div>
          </div>
        </div>

        {/* Payment & Meta */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-100">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-stone-400" />
            <span className={cn('text-xs lg:text-sm font-medium', payment.color)}>{payment.label}</span>
          </div>
          <div className="text-[9px] lg:text-[10px] text-stone-400 uppercase tracking-wide truncate ml-2">
            By: {booking.createdByName || booking.createdByRole || 'Client'}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 lg:px-5 pb-4 lg:pb-5">
        <Link
          href={`/dashboard/bookings/${booking.id}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 lg:py-3 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded-xl text-sm font-semibold text-stone-700 transition-colors"
        >
          View details
          <ArrowRight className="w-4 h-4" />
        </Link>
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
          <h2 className="text-lg sm:text-xl font-bold text-stone-900">Select date</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-stone-500" />
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
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors active:bg-stone-200"
          >
            <ChevronLeft className="w-5 h-5 text-stone-600" />
          </button>
          <h3 className="text-base sm:text-lg font-semibold text-stone-900">
            {MONTHS_ES[viewDate.getMonth()]} {viewDate.getFullYear()}
          </h3>
          <button
            onClick={() => {
              const newDate = new Date(viewDate);
              newDate.setMonth(newDate.getMonth() + 1);
              setViewDate(newDate);
            }}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors active:bg-stone-200"
          >
            <ChevronRight className="w-5 h-5 text-stone-600" />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 mb-2">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
            <div key={day} className="text-center text-xs font-bold text-stone-400 uppercase tracking-wider py-2">
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
                    ? 'bg-stone-900 text-white'
                    : isTodayDate
                    ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
                    : 'text-stone-700 hover:bg-stone-100 active:bg-stone-200'
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-5 sm:mt-6 pt-5 sm:pt-6 border-t border-stone-100 flex gap-2">
          <button
            onClick={() => handleSelect(new Date())}
            className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded-xl text-sm font-semibold text-stone-700 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              handleSelect(tomorrow);
            }}
            className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded-xl text-sm font-semibold text-stone-700 transition-colors"
          >
            Mañana
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
}) => {
  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search client, service..."
          className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm placeholder:text-stone-400 focus:outline-none focus:border-stone-400"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-stone-200 rounded"
          >
            <X className="w-3 h-3 text-stone-400" />
          </button>
        )}
      </div>

      {/* Status Filter */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Status</label>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'confirmed', label: 'Confirmed' },
            { id: 'pending', label: 'Pending' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((status) => (
            <button
              key={status.id}
              onClick={() => setStatusFilter(status.id as StatusFilter)}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-semibold transition-colors active:scale-95',
                statusFilter === status.id
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200 active:bg-stone-300'
              )}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* Employee Filter */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Employee</label>
        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="w-full px-3 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400"
        >
          <option value="all">All</option>
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
          Limpiar filtros
        </button>
      )}
    </div>
  );
};

// ============================================================================
// MAIN BOOKINGS PAGE
// ============================================================================

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Date & View State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [showCalendarDrawer, setShowCalendarDrawer] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');

  const hasActiveFilters = statusFilter !== 'all' || employeeFilter !== 'all' || searchTerm !== '';

  // Data Fetching
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bookingsData, employeesData, servicesData] = await Promise.all([
          getBookings(),
          getEmployees(),
          getServices(),
        ]);
        setBookings(bookingsData);
        setEmployees(employeesData);
        setServices(servicesData);
      } catch (error) {
        console.error('Error fetching bookings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Helpers
  const getServiceName = useCallback((serviceId: string) => 
    services.find((s) => s.id === serviceId)?.serviceName || 'Service', [services]);
  
  const getEmployeeName = useCallback((employeeId: string) => 
    employees.find((e) => e.id === employeeId)?.firstName || 'Employee', [employees]);

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
      .filter((b) => statusFilter === 'all' || b.status === statusFilter)
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
  }, [bookings, selectedDate, viewMode, statusFilter, employeeFilter, searchTerm, getServiceName, getEmployeeName]);

  // Group bookings by date
  const bookingsByDate = useMemo(() => {
    return filteredBookings.reduce<Record<string, Booking[]>>((acc, booking) => {
      acc[booking.bookingDate] = acc[booking.bookingDate] || [];
      acc[booking.bookingDate].push(booking);
      return acc;
    }, {});
  }, [filteredBookings]);

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
    <div className="min-h-screen bg-stone-50">
      {/* ================================================================== */}
      {/* HEADER */}
      {/* ================================================================== */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-3 lg:py-4">
          {/* Mobile Header */}
          <div className="flex lg:hidden items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-stone-900">Bookings</h1>
              <p className="text-xs text-stone-500">{formatDateShort(selectedDate)}</p>
            </div>
            <div className="flex items-center gap-2">
              {!isToday(selectedDate) && (
                <button
                  onClick={goToToday}
                  className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold"
                >
                  Hoy
                </button>
              )}
              <button
                onClick={() => setShowCalendarDrawer(true)}
                className="p-2.5 bg-stone-100 rounded-lg"
              >
                <CalendarDays className="w-5 h-5 text-stone-600" />
              </button>
              <button
                onClick={() => setShowFiltersDrawer(true)}
                className={cn(
                  'p-2.5 rounded-lg relative',
                  hasActiveFilters ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
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
                <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Bookings</h1>
                <p className="text-sm text-stone-500">{formatDateLong(selectedDate)}</p>
              </div>
              {!isToday(selectedDate) && (
                <button
                  onClick={goToToday}
                  className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-sm font-semibold transition-colors"
                >
                  Go to today
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDatePicker(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 rounded-xl text-sm font-semibold text-stone-700 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Go to date
              </button>
              <div className="flex items-center bg-stone-100 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('day')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                    viewMode === 'day'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  )}
                >
                  Day
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                    viewMode === 'week'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  )}
                >
                  Week
                </button>
              </div>
              <Link
                href="/dashboard"
                className="px-4 py-2.5 border border-stone-200 hover:border-stone-400 rounded-xl text-sm font-semibold text-stone-600 transition-colors"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      {/* MOBILE VIEW TOGGLE */}
      {/* ================================================================== */}
      <div className="lg:hidden bg-white border-b border-stone-200 px-4 py-2">
        <div className="flex items-center justify-center bg-stone-100 rounded-xl p-1">
          <button
            onClick={() => setViewMode('day')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              viewMode === 'day'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500'
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            Día
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              viewMode === 'week'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500'
            )}
          >
            <List className="w-4 h-4" />
            Semana
          </button>
        </div>
      </div>

      {/* ================================================================== */}
      {/* WEEK STRIP */}
      {/* ================================================================== */}
      <div className="bg-white border-b border-stone-200">
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

            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4" />
                Filters
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
            <div className="bg-stone-100 rounded-2xl p-4 text-[11px] text-stone-500 space-y-1">
              <div className="font-semibold text-stone-700 mb-2">Keyboard shortcuts</div>
              <div className="flex justify-between">
                <span>Previous/Next day</span>
                <span className="font-mono">← →</span>
              </div>
              <div className="flex justify-between">
                <span>Previous/Next week</span>
                <span className="font-mono">⇧← ⇧→</span>
              </div>
              <div className="flex justify-between">
                <span>Go to today</span>
                <span className="font-mono">T</span>
              </div>
            </div>
          </aside>

          {/* ============================================================== */}
          {/* MAIN AREA */}
          {/* ============================================================== */}
          <main className="flex-1 min-w-0">
            {/* Stats Bar */}
            <div className="bg-white rounded-2xl border border-stone-200 p-3 lg:p-4 mb-4 lg:mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 lg:gap-6 overflow-x-auto">
                  <div className="flex-shrink-0">
                    <div className="text-xl lg:text-2xl font-bold text-stone-900">{filteredBookings.length}</div>
                    <div className="text-[10px] lg:text-xs text-stone-500 whitespace-nowrap">
                      {viewMode === 'day' ? 'today' : 'week'}
                    </div>
                  </div>
                  <div className="w-px h-8 lg:h-10 bg-stone-200 flex-shrink-0" />
                  <div className="flex-shrink-0">
                    <div className="text-xl lg:text-2xl font-bold text-emerald-600">
                      {filteredBookings.filter((b) => b.status === 'confirmed').length}
                    </div>
                    <div className="text-[10px] lg:text-xs text-stone-500">confirmed</div>
                  </div>
                  <div className="w-px h-8 lg:h-10 bg-stone-200 flex-shrink-0" />
                  <div className="flex-shrink-0">
                    <div className="text-xl lg:text-2xl font-bold text-amber-600">
                      {filteredBookings.filter((b) => b.status === 'pending').length}
                    </div>
                    <div className="text-[10px] lg:text-xs text-stone-500">pending</div>
                  </div>
                </div>
                {hasActiveFilters && (
                  <span className="hidden sm:block text-xs text-stone-500 flex-shrink-0 ml-4">
                    Filters activos
                  </span>
                )}
              </div>
            </div>

            {/* Bookings Content */}
            {viewMode === 'day' ? (
              // Day View
              <div className="space-y-3 lg:space-y-4">
                {filteredBookings.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-stone-200 p-8 lg:p-12 text-center">
                    <div className="w-14 h-14 lg:w-16 lg:h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-7 h-7 lg:w-8 lg:h-8 text-stone-400" />
                    </div>
                    <h3 className="text-base lg:text-lg font-semibold text-stone-900 mb-1">No bookings</h3>
                    <p className="text-sm text-stone-500">
                      No bookings for this day
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 lg:gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredBookings.map((booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        serviceName={getServiceName(booking.serviceId)}
                        employeeName={getEmployeeName(booking.employeeId)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Week View
              <div className="space-y-4 lg:space-y-6">
                {Object.keys(bookingsByDate).length === 0 ? (
                  <div className="bg-white rounded-2xl border border-stone-200 p-8 lg:p-12 text-center">
                    <div className="w-14 h-14 lg:w-16 lg:h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-7 h-7 lg:w-8 lg:h-8 text-stone-400" />
                    </div>
                    <h3 className="text-base lg:text-lg font-semibold text-stone-900 mb-1">No bookings this week</h3>
                    <p className="text-sm text-stone-500">
                      No bookings match the filters
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
                            ? 'border-stone-400 shadow-md'
                            : 'border-stone-200'
                        )}
                      >
                        {/* Day Header */}
                        <button
                          onClick={() => handleDateSelect(day)}
                          className={cn(
                            'w-full px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between transition-colors',
                            isDaySelected ? 'bg-stone-900 text-white' : 'bg-stone-50 hover:bg-stone-100 active:bg-stone-200'
                          )}
                        >
                          <div className="flex items-center gap-3 lg:gap-4">
                            <div className={cn(
                              'w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex flex-col items-center justify-center',
                              isDaySelected ? 'bg-white/10' : isTodayDate ? 'bg-amber-100' : 'bg-white'
                            )}>
                              <span className={cn(
                                'text-[9px] lg:text-[10px] font-bold uppercase',
                                isDaySelected ? 'text-white/70' : 'text-stone-400'
                              )}>
                                {DAYS_ES[day.getDay()]}
                              </span>
                              <span className={cn(
                                'text-base lg:text-lg font-bold',
                                isDaySelected ? 'text-white' : isTodayDate ? 'text-amber-700' : 'text-stone-900'
                              )}>
                                {day.getDate()}
                              </span>
                            </div>
                            <div className="text-left">
                              <div className={cn(
                                'font-semibold text-sm lg:text-base',
                                isDaySelected ? 'text-white' : 'text-stone-900'
                              )}>
                                {DAYS_FULL_ES[day.getDay()]}
                              </div>
                              <div className={cn(
                                'text-xs lg:text-sm',
                                isDaySelected ? 'text-white/70' : 'text-stone-500'
                              )}>
                                {day.getDate()} de {MONTHS_ES[day.getMonth()]}
                              </div>
                            </div>
                          </div>
                          <div className={cn(
                            'px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-xs lg:text-sm font-semibold',
                            isDaySelected
                              ? 'bg-white/20 text-white'
                              : dayBookings.length > 0
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-stone-100 text-stone-400'
                          )}>
                            {dayBookings.length} booking{dayBookings.length !== 1 ? 's' : ''}
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
                                compact
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
        onClose={() => setShowFiltersDrawer(false)}
        title="Filters"
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
        />
      </Drawer>

      {/* Mobile Calendar Drawer */}
      <Drawer
        isOpen={showCalendarDrawer}
        onClose={() => setShowCalendarDrawer(false)}
        title="Calendar"
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
              Go to today
            </button>
            <button
              onClick={() => setShowDatePicker(true)}
              className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded-xl text-sm font-semibold text-stone-700 transition-colors"
            >
              Select date
            </button>
          </div>
        </div>
      </Drawer>

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