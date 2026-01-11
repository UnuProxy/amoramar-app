'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getBooking, getEmployee, getService, updateBooking, getClientByEmail, updateClient, createClient, getClients, getServices } from '@/shared/lib/firestore';
import { Loading } from '@/shared/components/Loading';
import { Button } from '@/shared/components/Button';
import { AuditTrailPanel } from '@/shared/components/AuditTrailPanel';
import { formatDate, formatTime, formatCurrency, cn } from '@/shared/lib/utils';
import { trackStatusChange, trackNoShow, addModificationToBooking } from '@/shared/lib/audit-trail';
import type { Booking, Client, Employee, Service, AdditionalServiceItem } from '@/shared/lib/types';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const bookingId = params.id as string;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientProfile, setClientProfile] = useState<Client | null>(null);
  const [hairNotes, setHairNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [newHistoryEntry, setNewHistoryEntry] = useState('');
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [showAddService, setShowAddService] = useState(false);
  const [newServiceType, setNewServiceType] = useState<'catalog' | 'custom'>('catalog');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState('');
  const [addingService, setAddingService] = useState(false);
  const [isEditingDateTime, setIsEditingDateTime] = useState(false);
  const [newBookingDate, setNewBookingDate] = useState('');
  const [newBookingTime, setNewBookingTime] = useState('');
  const [updatingDateTime, setUpdatingDateTime] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const bookingData = await getBooking(bookingId);
        if (bookingData) {
          setBooking(bookingData);
          const [employeeData, serviceData, servicesData] = await Promise.all([
            getEmployee(bookingData.employeeId),
            getService(bookingData.serviceId),
            getServices(),
          ]);
          setEmployee(employeeData);
          setService(serviceData);
          setAvailableServices(servicesData);

          // Load client profile by email to allow hair color notes edits
          if (bookingData.clientEmail) {
            const email = bookingData.clientEmail.toLowerCase().trim();
            const profile =
              (await getClientByEmail(email)) ||
              (await getClients()).find((c) => c.email.toLowerCase() === email);
            if (profile) {
              setClientProfile(profile as any);
              setHairNotes(profile.hairColorNotes || '');
            }
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
  }, [bookingId]);

  const handleStatusChange = async (newStatus: Booking['status']) => {
    if (!booking || !user) return;
    
    try {
      // Create audit context
      const auditContext = {
        userId: user.id,
        userName: user.email?.split('@')[0] || 'Admin',
        userRole: user.role,
      };

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
        updates.noShowByName = user.email?.split('@')[0] || 'Admin';
      }
      
      await updateBooking(booking.id, updates);
      setBooking({ ...booking, ...updates });
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('Error al actualizar el estado de la reserva');
    }
  };

  const handleAddAdditionalService = async () => {
    if (!booking) return;
    
    try {
      setAddingService(true);
      
      let newItem: AdditionalServiceItem;
      
      if (newServiceType === 'catalog') {
        const selectedService = availableServices.find(s => s.id === selectedServiceId);
        if (!selectedService) {
          alert('Por favor selecciona un servicio');
          return;
        }
        newItem = {
          id: `${Date.now()}-${Math.random()}`,
          serviceId: selectedService.id,
          serviceName: selectedService.serviceName,
          price: selectedService.price,
          addedAt: new Date(),
        };
      } else {
        if (!customServiceName.trim() || !customServicePrice) {
          alert('Por favor completa el nombre y precio del servicio');
          return;
        }
        const price = parseFloat(customServicePrice);
        if (isNaN(price) || price <= 0) {
          alert('Por favor ingresa un precio válido');
          return;
        }
        newItem = {
          id: `${Date.now()}-${Math.random()}`,
          serviceName: customServiceName.trim(),
          price: price,
          addedAt: new Date(),
        };
      }
      
      const currentAdditional = booking.additionalServices || [];
      const updatedAdditional = [...currentAdditional, newItem];
      
      await updateBooking(booking.id, { additionalServices: updatedAdditional });
      setBooking({ ...booking, additionalServices: updatedAdditional });
      
      // Reset form
      setShowAddService(false);
      setSelectedServiceId('');
      setCustomServiceName('');
      setCustomServicePrice('');
      setNewServiceType('catalog');
    } catch (error) {
      console.error('Error adding service:', error);
      alert('Error al agregar el servicio');
    } finally {
      setAddingService(false);
    }
  };

  const handleRemoveAdditionalService = async (itemId: string) => {
    if (!booking) return;
    
    try {
      const currentAdditional = booking.additionalServices || [];
      const updatedAdditional = currentAdditional.filter(item => item.id !== itemId);
      
      await updateBooking(booking.id, { additionalServices: updatedAdditional });
      setBooking({ ...booking, additionalServices: updatedAdditional });
    } catch (error) {
      console.error('Error removing service:', error);
      alert('Error al eliminar el servicio');
    }
  };

  const calculateTotalPrice = () => {
    if (!service) return 0;
    const basePrice = service.price;
    const additionalTotal = (booking?.additionalServices || []).reduce((sum, item) => sum + item.price, 0);
    return basePrice + additionalTotal;
  };

  const handleUpdateDateTime = async () => {
    if (!booking) return;
    
    if (!newBookingDate || !newBookingTime) {
      alert('Por favor selecciona fecha y hora');
      return;
    }

    // Validate date is not in the past
    const selectedDateTime = new Date(`${newBookingDate}T${newBookingTime}`);
    const now = new Date();
    if (selectedDateTime < now) {
      alert('No puedes seleccionar una fecha y hora en el pasado');
      return;
    }

    try {
      setUpdatingDateTime(true);
      await updateBooking(booking.id, {
        bookingDate: newBookingDate,
        bookingTime: newBookingTime,
      });
      setBooking({ ...booking, bookingDate: newBookingDate, bookingTime: newBookingTime });
      setIsEditingDateTime(false);
    } catch (error) {
      console.error('Error updating date/time:', error);
      alert('Error al actualizar la fecha y hora');
    } finally {
      setUpdatingDateTime(false);
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
    <div className="space-y-8 pb-16">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">Detalles de la Reserva</h1>
          <p className="text-neutral-500 text-sm font-medium">Ficha completa del cliente y la cita</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard/bookings')}>
          Volver
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white shadow-lg">
          <p className="text-xs uppercase tracking-[0.25em] text-white/60 mb-2">Estado</p>
          <div className="flex items-center justify-between">
            <span className="text-xl font-black">{booking.status.toUpperCase()}</span>
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
            <span className="px-3 py-1 text-[11px] font-black rounded-full bg-emerald-100 text-emerald-800">
              {service ? formatCurrency(service.price) : '—'}
            </span>
          </div>
          <p className="text-sm text-emerald-700 mt-2">{booking.depositPaid ? 'Depósito pagado' : 'Depósito pendiente'}</p>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-white border border-rose-100">
          <p className="text-xs uppercase tracking-[0.25em] text-rose-700 mb-2">Empleado</p>
          <div className="text-xl font-black text-rose-900">{employee ? `${employee.firstName} ${employee.lastName}` : '—'}</div>
          <p className="text-sm text-rose-700 mt-2">{service?.serviceName}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-neutral-100 rounded-3xl shadow-md p-6 space-y-4">
          <h2 className="text-xl font-black text-neutral-900 tracking-tight">Información del Cliente</h2>
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Nombre</p>
              <p className="text-lg font-semibold text-neutral-900 mt-1">{booking.clientName}</p>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Correo</p>
              <p className="text-lg font-semibold text-neutral-900 mt-1">{booking.clientEmail}</p>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Teléfono</p>
              <p className="text-lg font-semibold text-neutral-900 mt-1">{booking.clientPhone}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-100 rounded-3xl shadow-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-neutral-900 tracking-tight">Detalles de la Cita</h2>
            {booking?.status !== 'completed' && booking?.status !== 'cancelled' && !isEditingDateTime && (
              <Button
                variant="outline"
                onClick={() => {
                  setNewBookingDate(booking.bookingDate);
                  setNewBookingTime(booking.bookingTime);
                  setIsEditingDateTime(true);
                }}
                className="text-xs"
              >
                Cambiar Fecha/Hora
              </Button>
            )}
          </div>
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Servicio</p>
              <p className="text-lg font-semibold text-neutral-900 mt-1">{service?.serviceName}</p>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Precio</p>
                <p className="text-base font-semibold text-neutral-900 mt-1">{service ? formatCurrency(service.price) : '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Duración</p>
                <p className="text-base font-semibold text-neutral-900 mt-1">{service ? `${service.duration} min` : '—'}</p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Empleado</p>
              <p className="text-lg font-semibold text-neutral-900 mt-1">{employee ? `${employee.firstName} ${employee.lastName}` : '—'}</p>
            </div>
            
            {/* Date/Time Section - Editable */}
            {isEditingDateTime ? (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-white border-2 border-blue-300 space-y-3">
                <p className="text-[10px] font-black text-blue-700 uppercase tracking-[0.2em]">Cambiar Fecha y Hora</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] block mb-2">
                      Nueva Fecha
                    </label>
                    <input
                      type="date"
                      value={newBookingDate}
                      onChange={(e) => setNewBookingDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-neutral-200 rounded-xl text-neutral-900 font-medium focus:border-accent-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] block mb-2">
                      Nueva Hora
                    </label>
                    <input
                      type="time"
                      value={newBookingTime}
                      onChange={(e) => setNewBookingTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-neutral-200 rounded-xl text-neutral-900 font-medium focus:border-accent-500 outline-none transition"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="primary"
                    onClick={handleUpdateDateTime}
                    disabled={updatingDateTime}
                    className="flex-1"
                  >
                    {updatingDateTime ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditingDateTime(false);
                      setNewBookingDate('');
                      setNewBookingTime('');
                    }}
                    disabled={updatingDateTime}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Fecha</p>
                  <p className="text-base font-semibold text-neutral-900 mt-1">{formatDate(booking.bookingDate)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Hora</p>
                  <p className="text-base font-semibold text-neutral-900 mt-1">{formatTime(booking.bookingTime)}</p>
                </div>
              </div>
            )}
            
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Estado</p>
                <span
                  className={cn(
                    "inline-flex px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.15em] mt-1",
                    booking.status === 'confirmed'
                      ? 'bg-success-500 text-white'
                      : booking.status === 'completed'
                      ? 'bg-success-600 text-white'
                      : booking.status === 'pending'
                      ? 'bg-warning-500 text-primary-900'
                      : booking.status === 'no-show'
                      ? 'bg-amber-500 text-white'
                      : 'bg-accent-500 text-white'
                  )}
                >
                  {booking.status === 'no-show' ? 'No Presentado' : booking.status}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Creada por</p>
                <p className="text-sm font-semibold text-neutral-900 mt-1">{getCreatedByLabel(booking)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Services Section */}
      <div className="bg-white border border-neutral-100 rounded-3xl shadow-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-neutral-900 tracking-tight">Servicios de la Cita</h2>
            <p className="text-xs text-neutral-500 mt-1">Servicio principal y servicios adicionales</p>
          </div>
          {booking?.status !== 'completed' && booking?.status !== 'cancelled' && (
            <Button
              variant="primary"
              onClick={() => setShowAddService(!showAddService)}
              className="text-xs"
            >
              {showAddService ? 'Cancelar' : '+ Agregar Servicio'}
            </Button>
          )}
        </div>

        {/* Main Service */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-[10px] font-black text-blue-700 uppercase tracking-[0.2em] mb-1">Servicio Principal</p>
              <p className="text-base font-black text-blue-900">{service?.serviceName}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-blue-900">{service ? formatCurrency(service.price) : '—'}</p>
            </div>
          </div>
        </div>

        {/* Additional Services List */}
        {booking?.additionalServices && booking.additionalServices.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Servicios Adicionales</p>
            {booking.additionalServices.map((item) => (
              <div key={item.id} className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-between group">
                <div className="flex-1">
                  <p className="text-sm font-bold text-neutral-900">{item.serviceName}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Agregado: {new Date(item.addedAt).toLocaleString('es-ES', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-black text-neutral-900">{formatCurrency(item.price)}</p>
                  {booking?.status !== 'completed' && booking?.status !== 'cancelled' && (
                    <button
                      onClick={() => {
                        if (confirm('¿Eliminar este servicio adicional?')) {
                          handleRemoveAdditionalService(item.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-all flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Service Form */}
        {showAddService && (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-neutral-50 to-white border-2 border-neutral-200 space-y-4">
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setNewServiceType('catalog')}
                className={cn(
                  "flex-1 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                  newServiceType === 'catalog'
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                )}
              >
                Del Catálogo
              </button>
              <button
                onClick={() => setNewServiceType('custom')}
                className={cn(
                  "flex-1 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                  newServiceType === 'custom'
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                )}
              >
                Servicio Personalizado
              </button>
            </div>

            {newServiceType === 'catalog' ? (
              <div className="space-y-3">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                  Seleccionar Servicio
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-neutral-200 rounded-xl text-neutral-900 font-medium focus:border-accent-500 outline-none transition"
                >
                  <option value="">Selecciona un servicio...</option>
                  {availableServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.serviceName} - {formatCurrency(s.price)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                    Nombre del Servicio
                  </label>
                  <input
                    type="text"
                    value={customServiceName}
                    onChange={(e) => setCustomServiceName(e.target.value)}
                    placeholder="Ej. Tratamiento especial, Producto adicional"
                    className="w-full px-4 py-3 mt-2 bg-white border-2 border-neutral-200 rounded-xl text-neutral-900 font-medium focus:border-accent-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                    Precio (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={customServicePrice}
                    onChange={(e) => setCustomServicePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 mt-2 bg-white border-2 border-neutral-200 rounded-xl text-neutral-900 font-medium focus:border-accent-500 outline-none transition"
                  />
                </div>
              </div>
            )}

            <Button
              variant="primary"
              onClick={handleAddAdditionalService}
              disabled={addingService || (newServiceType === 'catalog' && !selectedServiceId) || (newServiceType === 'custom' && (!customServiceName.trim() || !customServicePrice))}
              className="w-full"
            >
              {addingService ? 'Agregando...' : 'Agregar Servicio'}
            </Button>
          </div>
        )}

        {/* Total Price */}
        <div className="pt-4 border-t-2 border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Total</p>
              <p className="text-xs text-neutral-500 mt-1">
                {service ? 1 : 0} servicio{(booking?.additionalServices?.length || 0) > 0 ? ` + ${booking.additionalServices.length} adicional${booking.additionalServices.length > 1 ? 'es' : ''}` : ''}
              </p>
            </div>
            <div className="text-3xl font-black text-neutral-900">
              {formatCurrency(calculateTotalPrice())}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-neutral-100 rounded-3xl shadow-md p-6 space-y-4">
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-neutral-900 tracking-tight">Notas de Tinte y Fórmulas</h2>
              <p className="text-xs text-neutral-500 mt-1">Información confidencial del cliente</p>
            </div>
            <svg className="w-5 h-5 text-neutral-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          
          <div className="mt-4 space-y-4">
            {hairNotes && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em] mb-1">Última fórmula usada</p>
                <p className="text-sm font-medium text-amber-900">{hairNotes}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                Agregar nueva fórmula
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newHistoryEntry}
                  onChange={(e) => setNewHistoryEntry(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-medium focus:border-accent-500 outline-none transition"
                  placeholder="Ej. Wella 6/7 + 6%"
                />
                <Button
                  type="button"
                  variant="primary"
                  disabled={savingNotes || !newHistoryEntry.trim()}
                  onClick={async () => {
                    const noteToSave = newHistoryEntry.trim();
                    if (!noteToSave) return;
                    try {
                      setSavingNotes(true);
                      let profileId = clientProfile?.id;
                      if (!profileId) {
                        if (!booking.clientEmail) {
                          alert('No hay email del cliente en la reserva. Actualiza el email para guardar notas.');
                          return;
                        }
                        const nameParts = (booking.clientName || '').trim().split(' ');
                        const firstName = nameParts.shift() || booking.clientName || '';
                        const lastName = nameParts.join(' ') || '';
                        profileId = await createClient(null, {
                          userId: '',
                          firstName,
                          lastName,
                          email: booking.clientEmail,
                          phone: booking.clientPhone || '',
                          hairColorNotes: noteToSave,
                          hairColorHistory: [{ note: noteToSave, date: new Date().toISOString(), bookingId: booking.id }],
                          totalSpent: 0,
                          totalBookings: 0,
                          favoriteServices: [],
                          favoriteEmployees: [],
                          notificationPreferences: {
                            email: true,
                            sms: false,
                            promotions: true,
                          },
                          createdAt: new Date(),
                          updatedAt: new Date(),
                        });
                        setClientProfile({
                          id: profileId,
                          userId: '',
                          firstName,
                          lastName,
                          email: booking.clientEmail,
                          phone: booking.clientPhone || '',
                          hairColorNotes: noteToSave,
                          hairColorHistory: [{ note: noteToSave, date: new Date().toISOString(), bookingId: booking.id }],
                          totalSpent: 0,
                          totalBookings: 0,
                          favoriteServices: [],
                          favoriteEmployees: [],
                          notificationPreferences: {
                            email: true,
                            sms: false,
                            promotions: true,
                          },
                          createdAt: new Date(),
                          updatedAt: new Date(),
                        });
                      } else {
                        const history = clientProfile?.hairColorHistory || [];
                        const newEntry = { note: noteToSave, date: new Date().toISOString(), bookingId: booking.id };
                        await updateClient(profileId, { hairColorNotes: noteToSave, hairColorHistory: [...history, newEntry] });
                        setClientProfile({ ...clientProfile, hairColorNotes: noteToSave, hairColorHistory: [...history, newEntry] });
                      }
                      setHairNotes(noteToSave);
                      setNewHistoryEntry('');
                    } catch (error) {
                      console.error('Error guardando notas de color:', error);
                      alert('No se pudieron guardar las notas de color.');
                    } finally {
                      setSavingNotes(false);
                    }
                  }}
                >
                  {savingNotes ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>

            {clientProfile?.hairColorHistory && clientProfile.hairColorHistory.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Historial</p>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {[...clientProfile.hairColorHistory]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((entry, idx) => (
                      <div
                        key={`${entry.date}-${idx}`}
                        className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-between text-sm"
                      >
                        <span className="font-medium text-neutral-700">{entry.note}</span>
                        <span className="text-xs text-neutral-500 font-semibold ml-3">{new Date(entry.date).toLocaleDateString()}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </details>
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
