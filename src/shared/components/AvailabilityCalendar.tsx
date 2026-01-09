'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/shared/lib/utils';

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

export function AvailabilityCalendar({
  selectedDate,
  onDateSelect,
  employeeId,
  serviceId,
  minDate = new Date().toISOString().split('T')[0],
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
          const dateStr = date.toISOString().split('T')[0];
          
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
                hasAvailability: data.success && (data.data?.slots || []).length > 0,
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
    
    // Add empty cells for days before the first day of the month
    const firstDayOfWeek = firstDay.getDay();
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
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className={cn(
      "bg-white border-2 rounded-2xl p-4 shadow-lg relative max-w-md mx-auto",
      isConsultation ? "border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30" : "border-neutral-100"
    )}>
      {/* Consultation Badge */}
      {isConsultation && (
        <div className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full">
          Consulta Gratuita
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={previousMonth}
          className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 transition-colors flex items-center justify-center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h3 className="text-base font-black text-neutral-800 uppercase tracking-tight">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        
        <button
          onClick={nextMonth}
          className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 transition-colors flex items-center justify-center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div key={day} className="text-center text-[9px] font-black text-neutral-400 uppercase tracking-wider py-1">
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
          
          const dateStr = day.toISOString().split('T')[0];
          const isPast = dateStr < minDate;
          const isSelected = dateStr === selectedDate;
          const hasAvailability = availabilityMap.get(dateStr) || false;
          const isToday = dateStr === new Date().toISOString().split('T')[0];
          
          return (
            <button
              key={dateStr}
              onClick={() => !isPast && onDateSelect(dateStr)}
              disabled={isPast || loading}
              className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all",
                "text-xs font-bold",
                isPast && "opacity-30 cursor-not-allowed",
                !isPast && !isSelected && !hasAvailability && "bg-neutral-50 text-neutral-300 cursor-not-allowed",
                !isPast && hasAvailability && !isSelected && isConsultation 
                  ? "bg-neutral-50 text-neutral-800 hover:bg-emerald-50 hover:border-emerald-200 border border-transparent"
                  : "bg-neutral-50 text-neutral-800 hover:bg-rose-50 hover:border-rose-200 border border-transparent",
                isSelected && isConsultation && "bg-emerald-600 text-white shadow-md scale-105 border border-emerald-700",
                isSelected && !isConsultation && "bg-rose-600 text-white shadow-md scale-105 border border-rose-700",
                isToday && !isSelected && (isConsultation ? "border border-emerald-300" : "border border-rose-300")
              )}
            >
              <span className="relative z-10">{day.getDate()}</span>
              
              {/* Availability indicator dot */}
              {!isPast && hasAvailability && !isSelected && (
                <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-green-500" />
              )}
              
              {/* No availability indicator */}
              {!isPast && !hasAvailability && !isSelected && (
                <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-neutral-300" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-neutral-100">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[10px] text-neutral-600 font-medium">Disponible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-neutral-300" />
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

