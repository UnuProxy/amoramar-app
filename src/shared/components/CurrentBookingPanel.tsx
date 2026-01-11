'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { addMinutesToTime, formatTime, formatCurrency, cn } from '@/shared/lib/utils';
import { calculateBookingTotals } from '@/shared/lib/booking-utils';
import type { Booking, Employee, Service } from '@/shared/lib/types';

type CurrentBookingPanelProps = {
  bookings: Booking[];
  services: Service[];
  employees?: Employee[];
  now?: Date;
  title?: string;
  context?: 'admin' | 'employee';
  onMarkPaid?: (booking: Booking) => void;
  onComplete?: (booking: Booking) => void;
  onCancel?: (booking: Booking) => void;
};

type BookingWithMeta = {
  booking: Booking;
  service: Service | undefined;
  employee: Employee | undefined;
  startMinutes: number;
  endMinutes: number;
};

const minutesFromTime = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const getPrice = (service?: Service) => {
  if (!service) return 0;
  if (typeof (service as any).price === 'string') {
    const parsed = parseFloat(String((service as any).price).replace(/[^\d.-]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }
  return service.price || 0;
};

const getCreatedByLabel = (booking: Booking) => {
  const createdName = booking.createdByName?.trim();
  const clientName = booking.clientName?.trim();
  const normalizedCreated = createdName?.toLowerCase();
  const normalizedClient = clientName?.toLowerCase();
  const isClientMatch = Boolean(
    normalizedCreated && normalizedClient && normalizedCreated === normalizedClient
  );

  let roleLabel: 'Cliente' | 'Equipo';
  if (booking.createdByRole === 'client' || isClientMatch) {
    roleLabel = 'Cliente';
  } else if (booking.createdByRole === 'owner' || booking.createdByRole === 'employee') {
    roleLabel = 'Equipo';
  } else if (createdName) {
    roleLabel = 'Equipo';
  } else if (booking.paymentStatus === 'pending' && !booking.depositPaid) {
    roleLabel = 'Equipo';
  } else {
    roleLabel = 'Cliente';
  }

  const displayName = createdName || (roleLabel === 'Cliente' ? clientName : undefined);
  return displayName ? `${displayName} (${roleLabel})` : roleLabel;
};

const getPaymentBadgeClass = (booking: Booking) => {
  if (booking.paymentStatus === 'paid' || booking.depositPaid) return 'bg-success-500 text-white';
  if (booking.paymentStatus === 'failed') return 'bg-accent-500 text-white';
  if (booking.paymentStatus === 'refunded') return 'bg-primary-200 text-primary-900';
  return 'bg-warning-500 text-primary-900';
};

const getPaymentLabel = (booking: Booking) => {
  if (booking.paymentStatus === 'paid' || booking.depositPaid) return 'Pagado';
  if (booking.paymentStatus === 'refunded') return 'Reembolsado';
  if (booking.paymentStatus === 'failed') return 'Fallido';
  return 'Pendiente';
};

export function CurrentBookingPanel({
  bookings,
  services,
  employees = [],
  now = new Date(),
  title = 'En curso',
  context = 'admin',
  onMarkPaid,
  onComplete,
  onCancel,
}: CurrentBookingPanelProps) {
  const today = now.toISOString().split('T')[0];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const targetBooking = useMemo(() => {
    const todays: BookingWithMeta[] = bookings
      .filter((b) => b.status !== 'cancelled' && b.paymentStatus !== 'paid' && b.bookingDate === today)
      .map((booking) => {
        const service = services.find((s) => s.id === booking.serviceId);
        const employee = employees.find((e) => e.id === booking.employeeId);
        const duration = service?.duration || 60;
        const startMinutes = minutesFromTime(booking.bookingTime);
        const endMinutes = startMinutes + duration;
        return { booking, service, employee, startMinutes, endMinutes };
      })
      .sort((a, b) => a.startMinutes - b.startMinutes);

    // 1. PRIORITIZE: Bookings that are well past their end time but NOT completed
    const pastPending = todays.find((t) => t.endMinutes <= nowMinutes && t.booking.status !== 'completed');
    if (pastPending) return { ...pastPending, state: 'past_pending' as const };

    // 2. SECONDARY: Booking currently in progress
    const active = todays.find((t) => nowMinutes >= t.startMinutes && nowMinutes < t.endMinutes);
    if (active) return { ...active, state: 'active' as const };

    // 3. TERTIARY: Next upcoming booking
    const upcoming = todays.find((t) => t.startMinutes >= nowMinutes);
    if (upcoming) return { ...upcoming, state: 'upcoming' as const };

    return null;
  }, [bookings, employees, nowMinutes, services, today]);

  if (!targetBooking) return null;

  const { booking, service, employee, startMinutes, endMinutes, state } = targetBooking;
  const duration = service?.duration || 60;
  const startTime = booking.bookingTime;
  const endTime = addMinutesToTime(startTime, duration);
  
  // Use shared utility for precise calculations
  const { totalPrice, outstanding, isFullyPaid } = calculateBookingTotals(booking, service);

  const totalWindow = Math.max(endMinutes - startMinutes, 1);
  const progress = Math.min(100, Math.max(0, Math.round(((nowMinutes - startMinutes) / totalWindow) * 100)));
  // Dynamic labels based on state for better UX
  const statusLabel = state === 'past_pending' ? 'POR CERRAR' : state === 'active' ? 'EN CURSO' : 'SIGUIENTE';
  const headerTitle = state === 'past_pending' ? '⚠️ PENDIENTE DE COBRO' : title;

  return (
    <div className={cn(
      "bg-white border-2 rounded-[24px] md:rounded-[32px] p-5 md:p-8 shadow-sm overflow-hidden relative group transition-all",
      state === 'past_pending' ? "border-amber-400 bg-amber-50/50" : "border-neutral-100"
    )}>
      {/* Subtle Background Decor */}
      <div className={cn(
        "absolute top-0 right-0 w-64 h-64 rounded-full -mr-20 -mt-20 blur-3xl transition-all duration-700 opacity-50",
        state === 'past_pending' ? "bg-amber-200" : "bg-rose-50"
      )} />
      
      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8">
        <div className="flex-1 space-y-4 md:space-y-5">
          <div className="flex items-center gap-3">
            <span className={cn(
              "px-3 py-1 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] rounded-full",
              state === 'past_pending' ? "bg-amber-600 text-white animate-pulse" :
              state === 'active' ? "bg-rose-600 text-white" : 
              "bg-neutral-100 text-neutral-500"
            )}>
              {statusLabel}
            </span>
            <span className={cn(
              "text-[9px] md:text-[10px] font-black uppercase tracking-widest",
              state === 'past_pending' ? "text-amber-700" : "text-neutral-400"
            )}>
              {headerTitle}
            </span>
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-2xl md:text-4xl font-black text-neutral-900 tracking-tighter leading-tight mb-2 md:mb-3 uppercase italic">
                  {service?.serviceName || 'RESERVA'}
                </h3>
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span className="text-lg md:text-xl font-black text-neutral-800 tabular-nums">
                      {formatTime(startTime)} — {formatTime(endTime)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg md:text-xl font-bold text-neutral-500 uppercase tracking-tight">
                      {booking.clientName}
                    </span>
                  </div>
                </div>
              </div>
              <Link
                href={context === 'admin' ? `/dashboard/bookings/${booking.id}` : `/employee/bookings/${booking.id}`}
                className="shrink-0 px-4 py-2 md:px-6 md:py-3 rounded-xl border-2 border-neutral-200 text-[10px] md:text-xs font-black text-neutral-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all uppercase tracking-widest"
              >
                Ver Detalles →
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-3">
            <div className="px-2.5 py-1.5 rounded-lg bg-neutral-50 text-neutral-500 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.1em] border border-neutral-100">
              {duration} MIN
            </div>
            {context === 'admin' && employee && (
              <div className="px-2.5 py-1.5 rounded-lg bg-neutral-50 text-neutral-500 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.1em] flex items-center gap-2 border border-neutral-100">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {employee.firstName}
              </div>
            )}
            <div className="px-2.5 py-1.5 rounded-lg bg-neutral-50 text-neutral-500 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.1em] border border-neutral-100 flex items-center gap-2">
              Pago:
              <span className={cn("px-1.5 py-0.5 rounded-full text-[8px] md:text-[9px] font-black uppercase", getPaymentBadgeClass(booking))}>
                {getPaymentLabel(booking)}
              </span>
            </div>
          </div>
        </div>

        <div className="lg:w-72 flex flex-col gap-3">
          <div className="bg-neutral-50 rounded-2xl p-4 md:p-5 border border-neutral-100 flex md:block items-center justify-between gap-4">
            <div className="md:mb-3">
              <p className="text-[9px] md:text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">Pendiente</p>
              <p className="text-xl md:text-3xl font-black text-neutral-900 leading-none italic">
                {totalPrice === 0 ? '—' : formatCurrency(outstanding)}
              </p>
            </div>
            
            <div className="flex-1 md:flex-none flex md:flex-col gap-2">
              {totalPrice > 0 && !isFullyPaid && (
                <button
                  onClick={() => onMarkPaid?.(booking)}
                  className="flex-1 md:w-full py-3 md:py-4 text-[10px] md:text-xs font-black bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 uppercase tracking-widest leading-none"
                >
                  PAGAR
                </button>
              )}
              {onComplete && booking.status !== 'completed' && (totalPrice === 0 || isFullyPaid) && (
                <button
                  onClick={() => onComplete(booking)}
                  className="flex-1 md:w-full py-3 md:py-4 text-[10px] md:text-xs font-black bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all uppercase tracking-widest leading-none"
                >
                  CERRAR
                </button>
              )}
            </div>
          </div>
          
          {onCancel && booking.status !== 'cancelled' && !isFullyPaid && (
            <button
              onClick={() => onCancel(booking)}
              className="w-full py-2 text-[8px] md:text-[9px] font-bold text-neutral-400 hover:text-rose-600 transition-colors uppercase tracking-[0.2em]"
            >
              Cancelar cita
            </button>
          )}
        </div>
      </div>

      {state === 'active' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-50">
          <div
            className="h-full bg-rose-600 transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
