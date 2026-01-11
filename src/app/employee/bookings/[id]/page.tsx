'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBooking, getEmployee, getService, updateBooking, getEmployees } from '@/shared/lib/firestore';
import { Loading } from '@/shared/components/Loading';
import { Button } from '@/shared/components/Button';
import { AuditTrailPanel } from '@/shared/components/AuditTrailPanel';
import { formatDate, formatTime, formatCurrency, cn } from '@/shared/lib/utils';
import { trackStatusChange, trackNoShow, addModificationToBooking } from '@/shared/lib/audit-trail';
import type { Booking, Employee, Service } from '@/shared/lib/types';
import { useAuth } from '@/shared/hooks/useAuth';

export default function EmployeeBookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const bookingId = params.id as string;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [therapist, setTherapist] = useState<Employee | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const bookingData = await getBooking(bookingId);
        if (bookingData) {
          setBooking(bookingData);
          const [therapistData, serviceData] = await Promise.all([
            getEmployee(bookingData.employeeId),
            getService(bookingData.serviceId),
          ]);
          setTherapist(therapistData);
          setService(serviceData);

          // Get current employee info
          if (user) {
            const employees = await getEmployees();
            const emp = employees.find(e => e.userId === user.id);
            setCurrentEmployee(emp || null);
          }
        }
      } catch (error) {
        console.error('Error fetching booking:', error);
      } finally {
        setLoading(false);
      }
    };

    if (bookingId) {
      fetchData();
    }
  }, [bookingId, user]);

  const handleStatusChange = async (newStatus: Booking['status']) => {
    if (!booking || !user || !currentEmployee) return;
    
    try {
      // Create audit context
      const auditContext = {
        userId: user.id,
        userName: `${currentEmployee.firstName} ${currentEmployee.lastName}`,
        userRole: user.role,
      };

      if (newStatus === 'cancelled') {
        const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'employee' }),
        });
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'No se pudo cancelar la reserva');
        }
        
        // Track cancellation in audit trail
        const modification = trackStatusChange(auditContext, booking.status, 'cancelled');
        const updatedBooking = addModificationToBooking(booking, modification);
        
        await updateBooking(booking.id, { 
          status: 'cancelled', 
          cancelledAt: new Date(),
          modifications: updatedBooking.modifications 
        });
        
        setBooking({ 
          ...booking, 
          status: 'cancelled', 
          cancelledAt: new Date(), 
          paymentStatus: result.data?.refundStatus === 'refunded' ? 'refunded' : booking.paymentStatus,
          modifications: updatedBooking.modifications 
        });
        return;
      }

      const updates: Partial<Booking> = {
        status: newStatus,
      };
      
      // Track status change in audit trail
      const modification = newStatus === 'no-show' 
        ? trackNoShow(auditContext)
        : trackStatusChange(auditContext, booking.status, newStatus);
      
      const updatedBooking = addModificationToBooking(booking, modification);
      updates.modifications = updatedBooking.modifications;
      
      if (newStatus === 'completed') {
        updates.completedAt = new Date();
      }
      
      if (newStatus === 'no-show') {
        updates.noShowAt = new Date();
        updates.noShowBy = user.id;
        updates.noShowByName = `${currentEmployee.firstName} ${currentEmployee.lastName}`;
      }
      
      await updateBooking(booking.id, updates);
      setBooking({ ...booking, ...updates });
      alert('Estado actualizado correctamente');
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('Error al actualizar el estado de la reserva');
    }
  };

  const getPaymentLabel = (booking: Booking) => {
    if (booking.paymentStatus === 'paid' || booking.depositPaid) return 'Pagado';
    if (booking.paymentStatus === 'refunded') return 'Reembolsado';
    if (booking.paymentStatus === 'failed') return 'Fallido';
    return 'Pendiente';
  };

  if (loading) {
    return <Loading />;
  }

  if (!booking || !service) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-neutral-500">Reserva no encontrada</p>
      </div>
    );
  }

  const totalPrice = service?.price || 0;

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-12 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">Detalles de la Reserva</h1>
          <p className="text-neutral-500 text-sm font-medium">Información completa de la cita</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/employee')}>
          Volver
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white shadow-lg">
          <p className="text-xs uppercase tracking-[0.25em] text-white/60 mb-2">Estado</p>
          <div className="flex items-center justify-between">
            <span className="text-xl font-black uppercase">{booking.status === 'no-show' ? 'No Presentado' : booking.status}</span>
            <span className="px-3 py-1 text-[11px] font-black rounded-full bg-white/15">
              {formatDate(booking.bookingDate)}
            </span>
          </div>
          <p className="text-sm text-white/70 mt-2">{formatTime(booking.bookingTime)}</p>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-700 mb-2">Pago</p>
          <div className="flex items-center justify-between">
            <span className="text-xl font-black text-emerald-800">{getPaymentLabel(booking)}</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-white border border-blue-100">
          <p className="text-xs uppercase tracking-[0.25em] text-blue-700 mb-2">Precio</p>
          <span className="text-2xl font-black text-blue-900">{formatCurrency(totalPrice)}</span>
        </div>
      </div>

      {/* Client & Service Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Client Info */}
        <div className="bg-white border border-neutral-100 rounded-3xl shadow-md p-6 space-y-4">
          <h2 className="text-xl font-black text-neutral-900 tracking-tight">Información del Cliente</h2>
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Nombre</p>
              <p className="text-lg font-semibold text-neutral-900 mt-1">{booking.clientName}</p>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Email</p>
              <p className="text-lg font-semibold text-neutral-900 mt-1">{booking.clientEmail}</p>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Teléfono</p>
              <p className="text-lg font-semibold text-neutral-900 mt-1">{booking.clientPhone}</p>
            </div>
          </div>
        </div>

        {/* Service Info */}
        <div className="bg-white border border-neutral-100 rounded-3xl shadow-md p-6 space-y-4">
          <h2 className="text-xl font-black text-neutral-900 tracking-tight">Detalles del Servicio</h2>
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200">
              <p className="text-[10px] font-black text-blue-700 uppercase tracking-[0.2em] mb-1">Servicio</p>
              <p className="text-lg font-black text-blue-900">{service?.serviceName}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Duración</p>
                <p className="text-base font-semibold text-neutral-900 mt-1">{service?.duration} min</p>
              </div>
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Precio</p>
                <p className="text-base font-semibold text-neutral-900 mt-1">{formatCurrency(totalPrice)}</p>
              </div>
            </div>
            {therapist && (
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Terapeuta</p>
                <p className="text-base font-semibold text-neutral-900 mt-1">
                  {therapist.firstName} {therapist.lastName}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Actions - No-Show Option */}
      {booking?.status !== 'completed' && booking?.status !== 'cancelled' && booking?.status !== 'no-show' && (
        <div className="bg-white border border-neutral-100 rounded-3xl shadow-md p-6">
          <h2 className="text-xl font-black text-neutral-900 tracking-tight mb-4">Acciones Rápidas</h2>
          <div className="flex flex-wrap gap-3">
            {booking.status !== 'confirmed' && (
              <Button
                variant="primary"
                onClick={() => handleStatusChange('confirmed')}
                className="text-sm"
              >
                ✓ Confirmar Reserva
              </Button>
            )}
            {booking.status === 'confirmed' && (
              <Button
                variant="primary"
                onClick={() => handleStatusChange('completed')}
                className="text-sm"
              >
                ✓ Marcar Completada
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                if (confirm('¿Marcar esta reserva como "No Presentado"? El cliente no asistió a la cita.')) {
                  handleStatusChange('no-show');
                }
              }}
              className="text-sm border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              ⚠️ No Presentado
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (confirm('¿Cancelar esta reserva?')) {
                  handleStatusChange('cancelled');
                }
              }}
              className="text-sm border-red-200 text-red-700 hover:bg-red-50"
            >
              ✕ Cancelar Cita
            </Button>
          </div>
        </div>
      )}

      {/* Audit Trail */}
      <div className="bg-white border border-neutral-100 rounded-3xl shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-black text-neutral-900 tracking-tight">Historial de Modificaciones</h2>
            <p className="text-xs text-neutral-500 mt-1">Registro completo de cambios en esta reserva</p>
          </div>
        </div>
        <AuditTrailPanel modifications={booking?.modifications || []} />
      </div>
    </div>
  );
}
