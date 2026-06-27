'use client';

import React, { useState, useEffect } from 'react';
import { cn, getDateKeyInMadrid } from '@/shared/lib/utils';

interface AvailabilityCalendarProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  employeeId: string;
  serviceId: string;
  minDate?: string;
  isConsultation?: boolean;
  consultationDuration?: number;
}

interface DayAvailability {
  date: string;
  hasAvailability: boolean;
}

const getCalendarDateKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function AvailabilityCalendar({
  selectedDate,
  onDateSelect,
  employeeId,
  serviceId,
  minDate = getDateKeyInMadrid(),
  isConsultation = false,
  consultationDuration,
}: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availabilityMap, setAvailabilityMap] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(false);

  // Fetch availability for the current month
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!employeeId || !serviceId) return;
      
      setLoading(true);
      try {
        // Get start and end of month
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // Fetch availability for each day in the month
        const daysInMonth = lastDay.getDate();
        const availabilityPromises = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month, day);
          const dateStr = getCalendarDateKey(date);
          
          // Skip past dates
          if (dateStr < minDate) continue;
          
          const url = new URL('/api/slots/available', window.location.origin);
          url.searchParams.set('employeeId', employeeId);
          url.searchParams.set('serviceId', serviceId);
          url.searchParams.set('date', dateStr);
          if (isConsultation) {
            url.searchParams.set('isConsultation', 'true');
            if (consultationDuration) {
              url.searchParams.set('duration', consultationDuration.toString());
            }
          }
          
          availabilityPromises.push(
            fetch(url.toString())
              .then(res => res.json())
              .then(data => ({
                date: dateStr,
                hasAvailability:
                  data.success &&
                  Array.isArray(data.data?.slots) &&
                  data.data.slots.some((slot: { available?: boolean }) => slot.available === true),
              }))
              .catch(() => ({ date: dateStr, hasAvailability: false }))
          );
        }
        
        const results = await Promise.all(availabilityPromises);
        const newMap = new Map<string, boolean>();
        results.forEach(({ date, hasAvailability }) => {
          newMap.set(date, hasAvailability);
        });
        
        setAvailabilityMap(newMap);
      } catch (error) {
        console.error('Error fetching availability:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAvailability();
  }, [currentMonth, employeeId, serviceId, minDate, isConsultation, consultationDuration]);

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: (Date | null)[] = [];
    
    // Add empty cells for days before the first day of the month, with Monday as first column.
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7;
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const days = getDaysInMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className={cn(
      "bg-white border rounded-2xl p-3 shadow-sm relative max-w-sm mx-auto",
      isConsultation ? "border-emerald-200 bg-gradient-to-br from-white to-emerald-50/20" : "border-neutral-200"
    )}>
      {/* Consultation Badge */}
      {isConsultation && (
        <div className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full">
          Consulta Gratuita
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={previousMonth}
          className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 transition-colors flex items-center justify-center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h3 className="text-sm font-black text-neutral-800 uppercase tracking-tight">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        
        <button
          onClick={nextMonth}
          className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 transition-colors flex items-center justify-center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {dayNames.map((day) => (
          <div key={day} className="text-center text-[8px] font-black text-neutral-400 uppercase tracking-[0.18em] py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }
          
          const dateStr = getCalendarDateKey(day);
          const isPast = dateStr < minDate;
          const isSelected = dateStr === selectedDate;
          const hasAvailability = availabilityMap.get(dateStr) || false;
          const isToday = dateStr === getDateKeyInMadrid();
          
          return (
            <button
              key={dateStr}
              onClick={() => !isPast && onDateSelect(dateStr)}
              disabled={isPast || loading || !hasAvailability}
              className={cn(
                "aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all",
                "text-xs font-bold",
                isPast && "opacity-30 cursor-not-allowed",
                !isPast && !isSelected && !hasAvailability && "bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed",
                !isPast && hasAvailability && !isSelected && "bg-white text-neutral-800 border border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400",
                isSelected && isConsultation && "bg-emerald-600 text-white shadow-md scale-105 border border-emerald-700",
                isSelected && !isConsultation && "bg-rose-600 text-white shadow-md scale-105 border border-rose-700",
                isToday && !isSelected && hasAvailability && "ring-1 ring-emerald-300",
                isToday && !isSelected && !hasAvailability && "ring-1 ring-stone-300"
              )}
            >
              <span className="relative z-10">{day.getDate()}</span>

              {!isPast && hasAvailability && !isSelected && (
                <div className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                  <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}

              {!isPast && !hasAvailability && !isSelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="h-7 w-7 text-stone-400/65"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.75} d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-neutral-100">
        <div className="flex items-center gap-1.5">
          <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white">
            <svg className="h-2 w-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-[10px] text-neutral-600 font-medium">Disponible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex h-4 w-4 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 shadow-sm">
            <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </div>
          <span className="text-[10px] text-neutral-600 font-medium">No disponible</span>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm rounded-2xl flex items-center justify-center">
          <div className="w-6 h-6 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
