'use client';

import React, { useMemo } from 'react';
import { addMinutesToTime, formatTime, formatCurrency, cn } from '@/shared/lib/utils';
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
      .filter((b) => b.status !== 'cancelled' && b.bookingDate === today)
      .map((booking) => {
        const service = services.find((s) => s.id === booking.serviceId);
        const employee = employees.find((e) => e.id === booking.employeeId);
        const duration = service?.duration || 60;
        const startMinutes = minutesFromTime(booking.bookingTime);
        const endMinutes = startMinutes + duration;
        return { booking, service, employee, startMinutes, endMinutes };
      })
      .sort((a, b) => a.startMinutes - b.startMinutes);

    const active = todays.find((t) => nowMinutes >= t.startMinutes && nowMinutes < t.endMinutes);
    if (active) return { ...active, state: 'active' as const };

    const upcoming = todays.find((t) => t.startMinutes >= nowMinutes);
    if (upcoming) return { ...upcoming, state: 'upcoming' as const };

    return null;
  }, [bookings, employees, nowMinutes, services, today]);

  if (!targetBooking) return null;

  const { booking, service, employee, startMinutes, endMinutes, state } = targetBooking;
  const duration = service?.duration || 60;
  const startTime = booking.bookingTime;
  const endTime = addMinutesToTime(startTime, duration);
  const price = getPrice(service);
  const isPaid = booking.paymentStatus === 'paid';
  const depositValue =
    isPaid
      ? price
      : booking.depositAmount
        ? booking.depositAmount / 100
        : booking.depositPaid
          ? price * 0.5
          : 0;
  const remaining = Math.max(price - depositValue, 0);
  const totalWindow = Math.max(endMinutes - startMinutes, 1);
  const progress = Math.min(100, Math.max(0, Math.round(((nowMinutes - startMinutes) / totalWindow) * 100)));
  const statusLabel = state === 'active' ? 'En curso' : 'Siguiente';

  return (
    <div className="bg-white border-2 border-neutral-100 rounded-[32px] p-6 sm:p-8 shadow-sm overflow-hidden relative group">
      {/* Subtle Background Decor */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-rose-100/50 transition-all duration-700" />
      
      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] rounded-full ${
              state === 'active' ? 'bg-rose-600 text-white' : 'bg-neutral-100 text-neutral-500'
            }`}>
              {statusLabel}
            </span>
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{title}</span>
          </div>

          <div>
            <h3 className="text-3xl sm:text-4xl font-black text-neutral-800 tracking-tighter leading-none mb-3">
              {service?.serviceName?.toUpperCase() || 'RESERVA'}
            </h3>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-accent-500" />
                <span className="text-xl font-black text-accent-500 tabular-nums">
                  {formatTime(startTime)} — {formatTime(endTime)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-primary-200" />
                <span className="text-xl font-bold text-primary-900 uppercase tracking-tight">
                  {booking.clientName}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-neutral-50 text-primary-600 text-[10px] font-bold uppercase tracking-[0.15em] border border-neutral-100">
              {duration} MIN
            </div>
            {context === 'admin' && employee && (
              <div className="px-3 py-1.5 rounded-lg bg-neutral-50 text-primary-600 text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-2 border border-neutral-100">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-400" />
                {employee.firstName}
              </div>
            )}
            <div className="px-3 py-1.5 rounded-lg bg-neutral-50 text-primary-600 text-[10px] font-bold uppercase tracking-[0.15em] border border-neutral-100">
              Creada por: {getCreatedByLabel(booking)}
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-neutral-50 text-primary-600 text-[10px] font-bold uppercase tracking-[0.15em] border border-neutral-100 flex items-center gap-2">
              Pago:
              <span className={cn("px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.15em]", getPaymentBadgeClass(booking))}>
                {getPaymentLabel(booking)}
              </span>
            </div>
          </div>
        </div>

        <div className="lg:w-72 space-y-3">
          <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-100">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Saldo pendiente</p>
            <p className="text-3xl font-black text-neutral-800 mb-4">
              {price === 0 ? '—' : formatCurrency(remaining)}
            </p>
            
            <div className="space-y-2">
              {price > 0 && !isPaid && (
                <button
                  onClick={() => onMarkPaid?.(booking)}
                  className="w-full py-3 text-xs font-black bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-md shadow-rose-200 uppercase tracking-widest"
                >
                  PAGADO
                </button>
              )}
              {onComplete && booking.status !== 'completed' && (
                <button
                  onClick={() => onComplete(booking)}
                  className="w-full py-3 text-xs font-black bg-neutral-800 text-white rounded-xl hover:bg-neutral-700 transition-all uppercase tracking-widest"
                >
                  FINALIZAR
                </button>
              )}
            </div>
          </div>
          
          {onCancel && booking.status !== 'cancelled' && (
            <button
              onClick={() => onCancel(booking)}
              className="w-full py-2 text-[10px] font-bold text-neutral-400 hover:text-neutral-600 transition-colors uppercase tracking-widest"
            >
              CANCELAR CITA
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
