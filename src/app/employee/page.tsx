'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { getBookings, getEmployees, getServices, updateBooking } from '@/shared/lib/firestore';
import { Loading } from '@/shared/components/Loading';
import { formatDate, formatTime, cn } from '@/shared/lib/utils';
import type { Booking, Employee, Service } from '@/shared/lib/types';
import { CurrentBookingPanel } from '@/shared/components/CurrentBookingPanel';

export default function EmployeeBookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Find employee by userId
        const employees = await getEmployees();
        const foundEmployee = employees.find((e) => e.userId === user.id);
        
        if (foundEmployee) {
          setEmployee(foundEmployee);
          
          // Get bookings for this employee
          const bookingsData = await getBookings({ employeeId: foundEmployee.id });
          setBookings(bookingsData);
        }

        const servicesData = await getServices();
        setServices(servicesData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="sm" />
      </div>
    );
  }

  if (!employee) {
    return <div>Employee profile not found</div>;
  }

  const getServiceName = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    return service ? service.serviceName : 'Desconocido';
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

  const getPaymentLabel = (booking: Booking) => {
    if (booking.paymentStatus === 'paid' || booking.depositPaid) return 'Pagado';
    if (booking.paymentStatus === 'refunded') return 'Reembolsado';
    if (booking.paymentStatus === 'failed') return 'Fallido';
    return 'Pendiente';
  };

  const upcomingBookings = bookings
    .filter((b) => {
      if (b.status !== 'confirmed' && b.status !== 'pending') return false;
      const start = new Date(`${b.bookingDate}T${b.bookingTime}:00`).getTime();
      // Only show bookings that haven't started yet
      return start >= currentTime.getTime();
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.bookingDate}T${a.bookingTime}:00`);
      const dateB = new Date(`${b.bookingDate}T${b.bookingTime}:00`);
      return dateA.getTime() - dateB.getTime();
    });

  const handleMarkPaid = async (booking: Booking) => {
    if (!user || !employee) {
      alert('Inicia sesión para actualizar pagos.');
      return;
    }
    if (booking.employeeId !== employee.id) {
      alert('Solo el terapeuta asignado puede actualizar este pago.');
      return;
    }

    try {
      await updateBooking(booking.id, {
        depositPaid: true,
        paymentStatus: 'paid',
      });
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, depositPaid: true, paymentStatus: 'paid' } : b))
      );
    } catch (error) {
      console.error('Error marking paid:', error);
      alert('No se pudo marcar como pagado');
    }
  };

  const handleCancel = async (booking: Booking) => {
    try {
      const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'employee' }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'No se pudo cancelar la reserva');
      }
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: 'cancelled' } : b)));
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('No se pudo cancelar la reserva');
    }
  };

  const handleStatusChange = async (booking: Booking, status: Booking['status']) => {
    if (status === 'cancelled') {
      await handleCancel(booking);
      return;
    }
    if (!user || !employee) {
      alert('Inicia sesión para actualizar reservas.');
      return;
    }
    if (booking.employeeId !== employee.id) {
      alert('Solo el terapeuta asignado puede modificar esta reserva.');
      return;
    }

    try {
      await updateBooking(booking.id, { status });
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status } : b)));
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('No se pudo actualizar la reserva');
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-12 pb-12">
      {/* Header - Bold Premium */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
        <div>
          <h1 className="text-6xl font-black text-neutral-800 tracking-tighter uppercase leading-none">
            Agenda
          </h1>
          <p className="text-neutral-500 text-sm font-black uppercase tracking-[0.3em] mt-4">
            Gestión de citas y servicios diarios
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Hoy es</p>
          <p className="text-xl font-black text-neutral-800 uppercase tracking-tight">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Current Turn - High End */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-accent-500 to-primary-900 rounded-[40px] blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative">
          <CurrentBookingPanel
            bookings={bookings}
            services={services}
            employees={employee ? [employee] : []}
            now={currentTime}
            context="employee"
            title="TURNO ACTUAL"
            onMarkPaid={handleMarkPaid}
            onComplete={(booking) => handleStatusChange(booking, 'completed')}
            onCancel={(booking) => handleStatusChange(booking, 'cancelled')}
          />
        </div>
      </div>

      {/* Upcoming - Bold List */}
      <div className="space-y-8">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-6">
          <h2 className="text-2xl font-black text-neutral-800 uppercase tracking-tight">Citas Próximas</h2>
          <span className="px-4 py-2 bg-neutral-800 text-white text-[10px] font-black rounded-full uppercase tracking-widest">
            {upcomingBookings.length} Reservas
          </span>
        </div>
        
        {upcomingBookings.length === 0 ? (
          <div className="py-20 text-center bg-neutral-50 rounded-[40px] border border-neutral-100">
            <p className="text-neutral-400 text-sm font-black uppercase tracking-widest">No hay más citas para hoy</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {upcomingBookings.map((booking) => (
              <div
                key={booking.id}
                className="group bg-white border border-neutral-100 rounded-[32px] p-8 transition-all hover:shadow-xl hover:border-neutral-200"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-8">
                  {/* Time Badge */}
                  <div className="flex-shrink-0 w-24 h-24 bg-neutral-800 rounded-[24px] flex flex-col items-center justify-center text-white shadow-lg">
                    <p className="text-[10px] font-black text-accent-400 uppercase tracking-widest mb-1">Inicia</p>
                    <p className="text-2xl font-black tracking-tighter">{formatTime(booking.bookingTime)}</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-black text-neutral-800 uppercase tracking-tighter truncate">{booking.clientName}</h3>
                      <span
                        className={cn(
                          "px-3 py-1 text-[8px] font-black uppercase tracking-[0.15em] rounded-full border",
                          booking.status === 'pending'
                            ? 'bg-warning-500 text-primary-900 border-warning-500'
                            : 'bg-success-500 text-white border-success-500'
                        )}
                      >
                        {booking.status === 'pending' ? 'PENDIENTE' : 'CONFIRMADA'}
                      </span>
                    </div>
                    <p className="text-sm font-black text-accent-600 uppercase tracking-widest mb-2">{getServiceName(booking.serviceId)}</p>
                    <div className="flex flex-wrap gap-4">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {booking.clientEmail}
                      </p>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        {booking.clientPhone}
                      </p>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.15em]">
                        Creada por: {getCreatedByLabel(booking)}
                      </p>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.15em] flex items-center gap-2">
                        Pago:
                        <span
                          className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.15em]",
                            booking.paymentStatus === 'paid' || booking.depositPaid
                              ? 'bg-success-500 text-white'
                              : booking.paymentStatus === 'failed'
                              ? 'bg-accent-500 text-white'
                              : booking.paymentStatus === 'refunded'
                              ? 'bg-primary-200 text-primary-900'
                              : 'bg-warning-500 text-primary-900'
                          )}
                        >
                          {getPaymentLabel(booking)}
                        </span>
                      </p>
                    </div>
                  </div>

                  {booking.notes && (
                    <div className="md:w-64 bg-neutral-50 p-6 rounded-2xl border border-neutral-100">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Notas Especiales</p>
                      <p className="text-xs text-neutral-600 font-bold italic line-clamp-2">"{booking.notes}"</p>
                    </div>
                  )}

                  <div className="flex-shrink-0">
                    <button
                      onClick={() => setSelectedBooking(booking)}
                      className="px-6 py-3 rounded-2xl border-2 border-neutral-100 text-[10px] font-black text-neutral-400 hover:border-neutral-900 hover:text-neutral-900 transition-all uppercase tracking-[0.2em]"
                    >
                      Ver detalles
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History - Muted Luxury */}
      <div className="space-y-8 pt-12 border-t border-neutral-100">
        <h2 className="text-xl font-black text-neutral-800 uppercase tracking-tight opacity-50">Citas Pasadas</h2>
        <div className="grid grid-cols-1 gap-3">
          {bookings
            .filter((b) => b.status === 'completed' || b.status === 'cancelled')
            .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime())
            .slice(0, 5)
            .map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between p-6 bg-white border border-neutral-100 rounded-2xl opacity-60 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-neutral-50 rounded-xl flex items-center justify-center text-neutral-800 text-xs font-black">
                    {formatTime(booking.bookingTime)}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-neutral-800 uppercase tracking-widest">{booking.clientName}</h4>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">{getServiceName(booking.serviceId)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">{formatDate(booking.bookingDate)}</p>
                  <span
                    className={cn(
                      "px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-full",
                      booking.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    )}
                  >
                    {booking.status === 'completed' ? 'Completada' : 'Cancelada'}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {selectedBooking && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-neutral-900/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden border-2 border-white/20">
            <div className="px-8 py-6 flex items-center justify-between border-b border-neutral-100">
              <div>
                <h2 className="text-2xl font-black text-neutral-900 uppercase tracking-tight">Detalles de la Reserva</h2>
                <p className="text-neutral-400 text-xs font-black uppercase tracking-widest mt-1">
                  {getServiceName(selectedBooking.serviceId)}
                </p>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-400 hover:bg-neutral-900 hover:text-white transition-all flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Cliente</p>
                  <p className="text-base font-black text-neutral-900 uppercase tracking-tight mt-1">{selectedBooking.clientName}</p>
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mt-1">{selectedBooking.clientEmail}</p>
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mt-1">{selectedBooking.clientPhone}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Fecha / Hora</p>
                  <p className="text-base font-black text-neutral-900 uppercase tracking-tight mt-1">{formatDate(selectedBooking.bookingDate)}</p>
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mt-1">{formatTime(selectedBooking.bookingTime)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em]">Creada por</p>
                  <p className="text-sm font-black text-neutral-900 uppercase tracking-tight mt-1">{getCreatedByLabel(selectedBooking)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em]">Pago</p>
                  <span
                    className={cn(
                      "inline-flex px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.15em] mt-1",
                      selectedBooking.paymentStatus === 'paid' || selectedBooking.depositPaid
                        ? 'bg-success-500 text-white'
                        : selectedBooking.paymentStatus === 'failed'
                        ? 'bg-accent-500 text-white'
                        : selectedBooking.paymentStatus === 'refunded'
                        ? 'bg-primary-200 text-primary-900'
                        : 'bg-warning-500 text-primary-900'
                    )}
                  >
                    {getPaymentLabel(selectedBooking)}
                  </span>
                </div>
              </div>

              {selectedBooking.notes && (
                <div>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Notas</p>
                  <p className="text-sm font-bold text-neutral-700 mt-2">{selectedBooking.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
