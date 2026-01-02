'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getBooking, getEmployee, getService, updateBooking } from '@/shared/lib/firestore';
import { Loading } from '@/shared/components/Loading';
import { Button } from '@/shared/components/Button';
import { formatDate, formatTime, formatCurrency, cn } from '@/shared/lib/utils';
import type { Booking, Employee, Service } from '@/shared/lib/types';
import { useRouter } from 'next/navigation';

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const bookingData = await getBooking(bookingId);
        if (bookingData) {
          setBooking(bookingData);
          const [employeeData, serviceData] = await Promise.all([
            getEmployee(bookingData.employeeId),
            getService(bookingData.serviceId),
          ]);
          setEmployee(employeeData);
          setService(serviceData);
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
  }, [bookingId]);

  const handleStatusChange = async (newStatus: Booking['status']) => {
    if (!booking) return;
    
    try {
      if (newStatus === 'cancelled') {
        const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'owner' }),
        });
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'No se pudo cancelar la reserva');
        }
        setBooking({ ...booking, status: 'cancelled', cancelledAt: new Date(), paymentStatus: result.data?.refundStatus === 'refunded' ? 'refunded' : booking.paymentStatus });
        return;
      }

      const updates: Partial<Booking> = {
        status: newStatus,
      };
      
      if (newStatus === 'completed') {
        updates.completedAt = new Date();
      } else if (newStatus === 'cancelled') {
        updates.cancelledAt = new Date();
      }
      
      await updateBooking(booking.id, updates);
      setBooking({ ...booking, ...updates });
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('Error al actualizar el estado de la reserva');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="sm" />
      </div>
    );
  }

  if (!booking) {
    return <div>Reserva no encontrada</div>;
  }

  const getCreatedByLabel = (target: Booking) => {
    const createdName = target.createdByName?.trim();
    const clientName = target.clientName?.trim();
    const normalizedCreated = createdName?.toLowerCase();
    const normalizedClient = clientName?.toLowerCase();
    const isClientMatch = Boolean(
      normalizedCreated && normalizedClient && normalizedCreated === normalizedClient
    );

    let roleLabel: 'Cliente' | 'Equipo';
    if (target.createdByRole === 'client' || isClientMatch) {
      roleLabel = 'Cliente';
    } else if (target.createdByRole === 'owner' || target.createdByRole === 'employee') {
      roleLabel = 'Equipo';
    } else if (createdName) {
      roleLabel = 'Equipo';
    } else if (target.paymentStatus === 'pending' && !target.depositPaid) {
      roleLabel = 'Equipo';
    } else {
      roleLabel = 'Cliente';
    }

    const displayName = createdName || (roleLabel === 'Cliente' ? clientName : undefined);
    return displayName ? `${displayName} (${roleLabel})` : roleLabel;
  };

  const getPaymentLabel = (target: Booking) => {
    if (target.paymentStatus === 'paid' || target.depositPaid) return 'Pagado';
    if (target.paymentStatus === 'refunded') return 'Reembolsado';
    if (target.paymentStatus === 'failed') return 'Fallido';
    return 'Pendiente';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-light tracking-wide text-primary-900">Detalles de la Reserva</h1>
          <p className="text-primary-600 text-sm mt-2 font-light">Ver y gestionar información de la reserva</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard/bookings')}>
          Volver
        </Button>
      </div>

      <div className="bg-white border border-primary-200 rounded-sm shadow-sm p-4 sm:p-6 space-y-6">
        {/* Client Information */}
        <div>
          <h2 className="text-xl font-light tracking-wide text-primary-900 mb-4">Información del Cliente</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-primary-600 font-light uppercase tracking-wide">Nombre</p>
              <p className="text-base font-light text-primary-900 mt-1">{booking.clientName}</p>
            </div>
            <div>
              <p className="text-xs text-primary-600 font-light uppercase tracking-wide">Correo</p>
              <p className="text-base font-light text-primary-900 mt-1">{booking.clientEmail}</p>
            </div>
            <div>
              <p className="text-xs text-primary-600 font-light uppercase tracking-wide">Teléfono</p>
              <p className="text-base font-light text-primary-900 mt-1">{booking.clientPhone}</p>
            </div>
          </div>
        </div>

        {/* Service Information */}
        <div>
          <h2 className="text-xl font-light tracking-wide text-primary-900 mb-4">Información del Servicio</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-primary-600 font-light uppercase tracking-wide">Servicio</p>
              <p className="text-base font-light text-primary-900 mt-1">{service?.serviceName}</p>
            </div>
            <div>
              <p className="text-xs text-primary-600 font-light uppercase tracking-wide">Precio</p>
              <p className="text-base font-light text-primary-900 mt-1">
                {service ? formatCurrency(service.price) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-primary-600 font-light uppercase tracking-wide">Duración</p>
              <p className="text-base font-light text-primary-900 mt-1">
                {service ? `${service.duration} minutos` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-primary-600 font-light uppercase tracking-wide">Empleado</p>
              <p className="text-base font-light text-primary-900 mt-1">
                {employee ? `${employee.firstName} ${employee.lastName}` : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Appointment Details */}
        <div>
          <h2 className="text-xl font-light tracking-wide text-primary-900 mb-4">Detalles de la Cita</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-primary-600 font-light uppercase tracking-wide">Fecha</p>
              <p className="text-base font-light text-primary-900 mt-1">
                {formatDate(booking.bookingDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-primary-600 font-light uppercase tracking-wide">Hora</p>
              <p className="text-base font-light text-primary-900 mt-1">
                {formatTime(booking.bookingTime)}
              </p>
            </div>
            <div>
              <p className="text-xs text-primary-600 font-light uppercase tracking-wide">Estado</p>
              <span
                className={cn(
                  "px-3 py-1 inline-flex text-sm leading-5 font-light rounded-md border",
                  booking.status === 'confirmed'
                    ? 'bg-success-500 text-white border-success-500'
                    : booking.status === 'completed'
                    ? 'bg-success-600 text-white border-success-600'
                    : booking.status === 'cancelled'
                    ? 'bg-accent-500 text-white border-accent-500'
                    : 'bg-warning-500 text-primary-900 border-warning-500'
                )}
              >
                {booking.status === 'confirmed' ? 'Confirmada' : 
                 booking.status === 'completed' ? 'Completada' : 
                 booking.status === 'cancelled' ? 'Cancelada' : 
                 booking.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-primary-600 font-light uppercase tracking-wide">Creada por</p>
              <p className="text-base font-light text-primary-900 mt-1">{getCreatedByLabel(booking)}</p>
            </div>
            <div>
              <p className="text-xs text-primary-600 font-light uppercase tracking-wide">Pago</p>
              <span
                className={cn(
                  "inline-flex px-3 py-1 rounded-md text-sm font-light mt-1 border",
                  booking.paymentStatus === 'paid' || booking.depositPaid
                    ? 'bg-success-500 text-white border-success-500'
                    : booking.paymentStatus === 'failed'
                    ? 'bg-accent-500 text-white border-accent-500'
                    : booking.paymentStatus === 'refunded'
                    ? 'bg-primary-200 text-primary-900 border-primary-200'
                    : 'bg-warning-500 text-primary-900 border-warning-500'
                )}
              >
                {getPaymentLabel(booking)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {booking.notes && (
          <div>
            <h2 className="text-xl font-light tracking-wide text-primary-900 mb-4">Notas</h2>
            <p className="text-base text-primary-700 font-light">{booking.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t border-primary-200">
          {booking.status === 'confirmed' && (
            <>
              <Button onClick={() => handleStatusChange('completed')}>
                Marcar como Completada
              </Button>
              <Button variant="danger" onClick={() => handleStatusChange('cancelled')}>
                Cancelar Reserva
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
