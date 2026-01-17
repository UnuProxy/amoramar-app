'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/hooks/useAuth';
import { getBookings, getEmployees, getServices, updateBooking, getClientByEmail, updateClient, createClient, getClients } from '@/shared/lib/firestore';
import { Loading } from '@/shared/components/Loading';
import { formatDate, formatTime, formatCurrency, cn } from '@/shared/lib/utils';
import type { Booking, Employee, Service, Client, AdditionalServiceItem, PaymentMethod } from '@/shared/lib/types';
import { CurrentBookingPanel } from '@/shared/components/CurrentBookingPanel';
import { PaymentMethodModal } from '@/shared/components/PaymentMethodModal';
import { ClosingSaleModal } from '@/shared/components/ClosingSaleModal';

export default function EmployeeBookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [clientProfile, setClientProfile] = useState<Client | null>(null);
  const [hairNotes, setHairNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [newHistoryEntry, setNewHistoryEntry] = useState('');
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
  const [showFinalPayment, setShowFinalPayment] = useState(false);
  const [finalPaymentMethod, setFinalPaymentMethod] = useState<'cash' | 'pos'>('cash');
  const [processingFinalPayment, setProcessingFinalPayment] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showClosingSaleModal, setShowClosingSaleModal] = useState(false);
  const [bookingToMarkPaid, setBookingToMarkPaid] = useState<Booking | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

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

  // Load client profile when a booking is selected
  useEffect(() => {
    const loadProfile = async () => {
      if (!selectedBooking?.clientEmail) {
        setClientProfile(null);
        setHairNotes('');
        setNewHistoryEntry('');
        return;
      }
      try {
        const email = selectedBooking.clientEmail.toLowerCase().trim();
        const profile =
          (await getClientByEmail(email)) ||
          (await getClients()).find((c) => c.email.toLowerCase() === email);
        setClientProfile(profile || null);
        setHairNotes(profile?.hairColorNotes || '');
        setNewHistoryEntry('');
      } catch (error) {
        console.error('Error loading client profile:', error);
      }
    };
    loadProfile();
  }, [selectedBooking]);

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

    let roleLabel: 'Client' | 'Staff';
    if (booking.createdByRole === 'client' || isClientMatch) {
      roleLabel = 'Client';
    } else if (booking.createdByRole === 'owner' || booking.createdByRole === 'employee') {
      roleLabel = 'Staff';
    } else if (createdName) {
      roleLabel = 'Equipo';
    } else if (booking.paymentStatus === 'pending' && !booking.depositPaid) {
      roleLabel = 'Staff';
    } else {
      roleLabel = 'Client';
    }

    const displayName = createdName || (roleLabel === 'Client' ? clientName : undefined);
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
      if (b.paymentStatus === 'paid') return false; // Hide paid bookings from the list
      
      const today = new Date().toISOString().split('T')[0];
      
      // If it's a future date, show it
      if (b.bookingDate > today) return true;
      
      // If it's today, ONLY show it if the start time is in the future
      if (b.bookingDate === today) {
        const [hours, minutes] = b.bookingTime.split(':').map(Number);
        const bookingMinutes = hours * 60 + minutes;
        const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
        return bookingMinutes > nowMinutes;
      }
      
      return false;
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

    // Show luxurious checkout modal
    setBookingToMarkPaid(booking);
    setShowClosingSaleModal(true);
  };

  const handleConfirmFinalPayment = async (paymentMethod: PaymentMethod, finalAmount: number, notes: string, currentUserId?: string) => {
    if (!bookingToMarkPaid || !user) return;

    try {
      setProcessingPayment(true);
      
      const isFullPayment = employee?.employmentType === 'employee';
      
      // Get the name of the person closing the sale
      const closedByName = employee 
        ? `${employee.firstName} ${employee.lastName}`.trim()
        : user.email?.split('@')[0] || 'Staff';
      
      if (isFullPayment) {
        await updateBooking(bookingToMarkPaid.id, {
          status: 'completed',
          paymentStatus: 'paid',
          depositPaid: true,
          finalPaymentReceived: true,
          finalPaymentAmount: finalAmount,
          finalPaymentMethod: paymentMethod,
          finalPaymentReceivedAt: new Date(),
          finalPaymentReceivedBy: user.id,
          finalPaymentReceivedByName: closedByName,
          completedBy: user.id,
          completedByName: closedByName,
          completedByRole: user.role,
          completedAt: new Date(),
          paymentNotes: notes || undefined,
        });
        setBookings((prev) => prev.map((b) => 
          b.id === bookingToMarkPaid.id 
            ? { 
                ...b, 
                status: 'completed',
                paymentStatus: 'paid',
                depositPaid: true,
                finalPaymentReceived: true, 
                finalPaymentAmount: finalAmount, 
                finalPaymentMethod: paymentMethod,
                completedByName: closedByName,
                paymentNotes: notes || undefined,
              } 
            : b
        ));
      } else {
        await updateBooking(bookingToMarkPaid.id, {
          status: 'completed',
          paymentStatus: 'paid',
          depositPaid: true,
          finalPaymentMethod: paymentMethod,
          finalPaymentReceivedAt: new Date(),
          finalPaymentReceivedBy: user.id,
          finalPaymentReceivedByName: closedByName,
          completedBy: user.id,
          completedByName: closedByName,
          completedByRole: user.role,
          completedAt: new Date(),
          paymentNotes: notes || undefined,
        });
        setBookings((prev) => prev.map((b) => 
          b.id === bookingToMarkPaid.id 
            ? { 
                ...b, 
                status: 'completed',
                paymentStatus: 'paid', 
                depositPaid: true, 
                finalPaymentMethod: paymentMethod,
                completedByName: closedByName,
                paymentNotes: notes || undefined 
              } 
            : b
        ));
      }
      
      setShowClosingSaleModal(false);
      setBookingToMarkPaid(null);
    } catch (error) {
      console.error('Error closing sale:', error);
      alert('No se pudo cerrar la venta');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleConfirmPayment = async (paymentMethod: PaymentMethod, adjustedAmount?: number, notes?: string) => {
    if (!bookingToMarkPaid || !user) return;

    try {
      setProcessingPayment(true);
      
      const selectedService = services.find(s => s.id === bookingToMarkPaid.serviceId);
      const basePrice = selectedService?.price || 0;
      
      const isFullPayment = employee?.employmentType === 'employee';
      const noPaymentCollected = adjustedAmount === 0;
      
      if (isFullPayment) {
        await updateBooking(bookingToMarkPaid.id, {
          depositPaid: !noPaymentCollected,
          paymentStatus: noPaymentCollected ? 'pending' : 'paid',
          finalPaymentReceived: !noPaymentCollected,
          finalPaymentAmount: adjustedAmount,
          finalPaymentMethod: noPaymentCollected ? undefined : paymentMethod,
          finalPaymentReceivedAt: noPaymentCollected ? undefined : new Date(),
          finalPaymentReceivedBy: noPaymentCollected ? undefined : user.id,
          paymentNotes: notes || undefined,
        });
        setBookings((prev) => prev.map((b) => 
          b.id === bookingToMarkPaid.id 
            ? { 
                ...b, 
                depositPaid: !noPaymentCollected, 
                paymentStatus: noPaymentCollected ? 'pending' : 'paid', 
                finalPaymentReceived: !noPaymentCollected, 
                finalPaymentAmount: adjustedAmount, 
                finalPaymentMethod: noPaymentCollected ? undefined : paymentMethod,
                paymentNotes: notes || undefined,
              } 
            : b
        ));
      } else {
        await updateBooking(bookingToMarkPaid.id, {
          depositPaid: !noPaymentCollected,
          paymentStatus: noPaymentCollected ? 'pending' : 'paid',
          finalPaymentMethod: noPaymentCollected ? undefined : paymentMethod,
          paymentNotes: notes || undefined,
        });
        setBookings((prev) => prev.map((b) => 
          b.id === bookingToMarkPaid.id 
            ? { ...b, depositPaid: !noPaymentCollected, paymentStatus: noPaymentCollected ? 'pending' : 'paid', finalPaymentMethod: noPaymentCollected ? undefined : paymentMethod, paymentNotes: notes || undefined } 
            : b
        ));
      }
      
      setShowPaymentMethodModal(false);
      setBookingToMarkPaid(null);
    } catch (error) {
      console.error('Error marking paid:', error);
      alert('No se pudo marcar como pagado');
    } finally {
      setProcessingPayment(false);
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

  const handleAddAdditionalService = async () => {
    if (!selectedBooking) return;
    
    try {
      setAddingService(true);
      
      let newItem: AdditionalServiceItem;
      
      if (newServiceType === 'catalog') {
        const selectedService = services.find(s => s.id === selectedServiceId);
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
      
      const currentAdditional = selectedBooking.additionalServices || [];
      const updatedAdditional = [...currentAdditional, newItem];
      
      await updateBooking(selectedBooking.id, { additionalServices: updatedAdditional });
      setSelectedBooking({ ...selectedBooking, additionalServices: updatedAdditional });
      setBookings((prev) => prev.map((b) => 
        b.id === selectedBooking.id ? { ...b, additionalServices: updatedAdditional } : b
      ));
      
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
    if (!selectedBooking) return;
    
    try {
      const currentAdditional = selectedBooking.additionalServices || [];
      const updatedAdditional = currentAdditional.filter(item => item.id !== itemId);
      
      await updateBooking(selectedBooking.id, { additionalServices: updatedAdditional });
      setSelectedBooking({ ...selectedBooking, additionalServices: updatedAdditional });
      setBookings((prev) => prev.map((b) => 
        b.id === selectedBooking.id ? { ...b, additionalServices: updatedAdditional } : b
      ));
    } catch (error) {
      console.error('Error removing service:', error);
      alert('Error al eliminar el servicio');
    }
  };

  const calculateTotalPrice = () => {
    if (!selectedBooking) return 0;
    const selectedService = services.find(s => s.id === selectedBooking.serviceId);
    const basePrice = selectedService?.price || 0;
    const additionalTotal = (selectedBooking.additionalServices || []).reduce((sum, item) => sum + item.price, 0);
    return basePrice + additionalTotal;
  };

  const handleCollectFinalPayment = async () => {
    if (!selectedBooking || !user) return;
    
    try {
      setProcessingFinalPayment(true);
      
      const totalPrice = calculateTotalPrice();
      const depositAmount = (selectedBooking.depositAmount || 0) / 100; // Convert from cents to euros
      const finalAmount = totalPrice - depositAmount;
      
      await updateBooking(selectedBooking.id, {
        finalPaymentReceived: true,
        finalPaymentAmount: finalAmount,
        finalPaymentMethod: finalPaymentMethod,
        finalPaymentReceivedAt: new Date(),
        finalPaymentReceivedBy: user.id,
        paymentStatus: 'paid',
      });
      
      setSelectedBooking({
        ...selectedBooking,
        finalPaymentReceived: true,
        finalPaymentAmount: finalAmount,
        finalPaymentMethod: finalPaymentMethod,
        finalPaymentReceivedAt: new Date(),
        finalPaymentReceivedBy: user.id,
        paymentStatus: 'paid',
      });
      
      setBookings((prev) => prev.map((b) => 
        b.id === selectedBooking.id 
          ? { 
              ...b, 
              finalPaymentReceived: true, 
              finalPaymentAmount: finalAmount,
              finalPaymentMethod: finalPaymentMethod,
              paymentStatus: 'paid'
            } 
          : b
      ));
      
      setShowFinalPayment(false);
    } catch (error) {
      console.error('Error collecting final payment:', error);
      alert('Error al registrar el pago final');
    } finally {
      setProcessingFinalPayment(false);
    }
  };

  const handleUpdateDateTime = async () => {
    if (!selectedBooking) return;
    
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
      await updateBooking(selectedBooking.id, {
        bookingDate: newBookingDate,
        bookingTime: newBookingTime,
      });
      setSelectedBooking({ ...selectedBooking, bookingDate: newBookingDate, bookingTime: newBookingTime });
      setBookings((prev) => prev.map((b) => 
        b.id === selectedBooking.id ? { ...b, bookingDate: newBookingDate, bookingTime: newBookingTime } : b
      ));
      setIsEditingDateTime(false);
    } catch (error) {
      console.error('Error updating date/time:', error);
      alert('Error al actualizar la fecha y hora');
    } finally {
      setUpdatingDateTime(false);
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
        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex gap-3">
            <Link
              href="/employee/calendar"
              className="px-6 py-3 bg-gradient-to-r from-rose-600 to-rose-700 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:from-rose-700 hover:to-rose-800 transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Booking
            </Link>
            <Link
              href="/employee/clients"
              className="px-6 py-3 bg-neutral-800 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-neutral-900 transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Clients
            </Link>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Today is</p>
            <p className="text-xl font-black text-neutral-800 uppercase tracking-tight">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
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
          <h2 className="text-2xl font-black text-neutral-800 uppercase tracking-tight">Upcoming Appointments</h2>
          <span className="px-4 py-2 bg-neutral-800 text-white text-[10px] font-black rounded-full uppercase tracking-widest">
            {upcomingBookings.length} Bookings
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
                      View details
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
        <h2 className="text-xl font-black text-neutral-800 uppercase tracking-tight opacity-50">Past Appointments</h2>
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
          <div className="w-full max-w-3xl bg-white rounded-[32px] shadow-2xl overflow-y-auto max-h-[90vh] border-2 border-white/20">
            <div className="sticky top-0 bg-white px-8 py-6 flex items-center justify-between border-b border-neutral-100 z-10">
              <div>
                <h2 className="text-2xl font-black text-neutral-900 uppercase tracking-tight">Booking Details</h2>
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
              {/* Client Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-black text-neutral-900 uppercase tracking-tight">Client Information</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Nombre</p>
                    <p className="text-base font-black text-neutral-900 uppercase tracking-tight mt-1">{selectedBooking.clientName}</p>
                </div>
                  <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Correo</p>
                    <p className="text-sm font-bold text-neutral-700 mt-1">{selectedBooking.clientEmail}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Teléfono</p>
                    <p className="text-sm font-bold text-neutral-700 mt-1">{selectedBooking.clientPhone}</p>
                  </div>
                </div>
              </div>

              {/* Appointment Details Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-neutral-900 uppercase tracking-tight">Appointment Details</h3>
                  {selectedBooking.status !== 'completed' && selectedBooking.status !== 'cancelled' && !isEditingDateTime && (
                    <button
                      onClick={() => {
                        setNewBookingDate(selectedBooking.bookingDate);
                        setNewBookingTime(selectedBooking.bookingTime);
                        setIsEditingDateTime(true);
                      }}
                      className="px-3 py-1.5 bg-neutral-100 text-neutral-700 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-neutral-200 transition"
                    >
                      Cambiar Fecha/Hora
                    </button>
                  )}
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
                          className="w-full px-3 py-2 bg-white border-2 border-neutral-200 rounded-xl text-neutral-900 text-sm font-medium focus:border-accent-500 outline-none transition"
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
                          className="w-full px-3 py-2 bg-white border-2 border-neutral-200 rounded-xl text-neutral-900 text-sm font-medium focus:border-accent-500 outline-none transition"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleUpdateDateTime}
                        disabled={updatingDateTime}
                        className="flex-1 px-4 py-2 bg-neutral-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-accent-600 transition disabled:opacity-50"
                      >
                        {updatingDateTime ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingDateTime(false);
                          setNewBookingDate('');
                          setNewBookingTime('');
                        }}
                        disabled={updatingDateTime}
                        className="px-4 py-2 bg-neutral-100 text-neutral-700 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-neutral-200 transition disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Fecha</p>
                      <p className="text-base font-bold text-neutral-900 mt-1">{formatDate(selectedBooking.bookingDate)}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Hora</p>
                      <p className="text-base font-bold text-neutral-900 mt-1">{formatTime(selectedBooking.bookingTime)}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em]">Creada por</p>
                    <p className="text-sm font-bold text-neutral-900 mt-1">{getCreatedByLabel(selectedBooking)}</p>
                </div>
                  <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
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
              </div>

              {selectedBooking.notes && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em]">Notas especiales</p>
                  <p className="text-sm font-bold text-amber-900 mt-2">{selectedBooking.notes}</p>
                </div>
              )}

              {/* Additional Services Section */}
              <div className="space-y-4 border-t border-neutral-100 pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-neutral-900 uppercase tracking-tight">Appointment Services</h3>
                    <p className="text-[10px] text-neutral-500 mt-1">Main service and additional services</p>
                  </div>
                  {selectedBooking.status !== 'completed' && selectedBooking.status !== 'cancelled' && (
                    <button
                      onClick={() => setShowAddService(!showAddService)}
                      className="px-4 py-2 bg-neutral-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-[14px] hover:bg-accent-600 transition"
                    >
                      {showAddService ? 'Cancelar' : '+ Agregar'}
                    </button>
                  )}
                </div>

                {/* Main Service */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-blue-700 uppercase tracking-[0.2em] mb-1">Main Service</p>
                      <p className="text-base font-black text-blue-900">{getServiceName(selectedBooking.serviceId)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-blue-900">
                        {formatCurrency(services.find(s => s.id === selectedBooking.serviceId)?.price || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional Services List */}
                {selectedBooking.additionalServices && selectedBooking.additionalServices.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Additional Services</p>
                    {selectedBooking.additionalServices.map((item) => (
                      <div key={item.id} className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-between group">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-neutral-900">{item.serviceName}</p>
                          <p className="text-xs text-neutral-500 mt-1">
                            {new Date(item.addedAt).toLocaleString('es-ES', { 
                              day: '2-digit', 
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-base font-black text-neutral-900">{formatCurrency(item.price)}</p>
                          {selectedBooking.status !== 'completed' && selectedBooking.status !== 'cancelled' && (
                            <button
                              onClick={() => {
                                if (confirm('¿Eliminar este servicio adicional?')) {
                                  handleRemoveAdditionalService(item.id);
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-all flex items-center justify-center"
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
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-neutral-50 to-white border-2 border-neutral-200 space-y-4">
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => setNewServiceType('catalog')}
                        className={cn(
                          "flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all",
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
                          "flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all",
                          newServiceType === 'custom'
                            ? "bg-neutral-900 text-white"
                            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                        )}
                      >
                        Personalizado
                      </button>
                    </div>

                    {newServiceType === 'catalog' ? (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                          Select Service
                        </label>
                        <select
                          value={selectedServiceId}
                          onChange={(e) => setSelectedServiceId(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border-2 border-neutral-200 rounded-xl text-neutral-900 font-medium focus:border-accent-500 outline-none transition"
                        >
                          <option value="">Selecciona...</option>
                          {services.map((s) => (
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
                            Service Name
                          </label>
                          <input
                            type="text"
                            value={customServiceName}
                            onChange={(e) => setCustomServiceName(e.target.value)}
                            placeholder="Ej. Tratamiento especial"
                            className="w-full px-3 py-2 mt-1 text-sm bg-white border-2 border-neutral-200 rounded-xl text-neutral-900 font-medium focus:border-accent-500 outline-none transition"
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
                            className="w-full px-3 py-2 mt-1 text-sm bg-white border-2 border-neutral-200 rounded-xl text-neutral-900 font-medium focus:border-accent-500 outline-none transition"
                          />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleAddAdditionalService}
                      disabled={addingService || (newServiceType === 'catalog' && !selectedServiceId) || (newServiceType === 'custom' && (!customServiceName.trim() || !customServicePrice))}
                      className="w-full px-4 py-2 bg-neutral-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-[14px] hover:bg-accent-600 transition disabled:opacity-50"
                    >
                      {addingService ? 'Agregando...' : 'Agregar'}
                    </button>
                  </div>
                )}

                {/* Final Payment Collection (Only for regular employees) */}
                {employee?.employmentType === 'employee' && !selectedBooking.finalPaymentReceived && selectedBooking.depositPaid && (
                  <div className="pt-3 border-t-2 border-neutral-200">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-50 to-white border-2 border-orange-300 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-orange-700 uppercase tracking-[0.2em]">Cobrar Pago Final</p>
                          <p className="text-xs text-orange-600 mt-1">El depósito ya fue pagado</p>
                        </div>
                        {!showFinalPayment && (
                          <button
                            onClick={() => setShowFinalPayment(true)}
                            className="px-4 py-2 bg-orange-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-orange-700 transition"
                          >
                            Cobrar
                          </button>
                        )}
                      </div>
                      
                      {showFinalPayment && (
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-bold text-neutral-900 mb-2">
                              Monto a cobrar: {formatCurrency(calculateTotalPrice() - ((selectedBooking.depositAmount || 0) / 100))}
                            </p>
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] block mb-2">
                              Método de Pago
                            </label>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setFinalPaymentMethod('cash')}
                                className={cn(
                                  "flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                                  finalPaymentMethod === 'cash'
                                    ? "bg-neutral-900 text-white"
                                    : "bg-white border-2 border-neutral-200 text-neutral-600 hover:border-neutral-400"
                                )}
                              >
                                💵 Cash
                              </button>
                              <button
                                onClick={() => setFinalPaymentMethod('pos')}
                                className={cn(
                                  "flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                                  finalPaymentMethod === 'pos'
                                    ? "bg-neutral-900 text-white"
                                    : "bg-white border-2 border-neutral-200 text-neutral-600 hover:border-neutral-400"
                                )}
                              >
                                💳 Card Terminal
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={handleCollectFinalPayment}
                              disabled={processingFinalPayment}
                              className="flex-1 px-4 py-2 bg-green-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-green-700 transition disabled:opacity-50"
                            >
                              {processingFinalPayment ? 'Procesando...' : 'Confirmar Pago'}
                            </button>
                            <button
                              onClick={() => setShowFinalPayment(false)}
                              disabled={processingFinalPayment}
                              className="px-4 py-2 bg-neutral-100 text-neutral-700 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-neutral-200 transition disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment Status for Self-Employed */}
                {employee?.employmentType === 'self-employed' && (
                  <div className="pt-3 border-t-2 border-neutral-200">
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                      <p className="text-xs font-bold text-blue-800">
                        ℹ️ Este empleado es autónomo y gestiona sus propios pagos
                      </p>
                    </div>
                  </div>
                )}

                {/* Final Payment Received Status */}
                {employee?.employmentType === 'employee' && selectedBooking.finalPaymentReceived && (
                  <div className="pt-3 border-t-2 border-neutral-200">
                    <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                      <p className="text-xs font-bold text-green-800">
                        ✓ Final payment received ({selectedBooking.finalPaymentMethod === 'cash' ? 'Cash' : 'Card Terminal'}) - {formatCurrency(selectedBooking.finalPaymentAmount || 0)}
                      </p>
                      {selectedBooking.finalPaymentReceivedAt && (
                        <p className="text-xs text-green-700 mt-1">
                          {new Date(selectedBooking.finalPaymentReceivedAt).toLocaleString('es-ES')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Total Price */}
                <div className="pt-3 border-t-2 border-neutral-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Total</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        1 servicio{(selectedBooking.additionalServices?.length || 0) > 0 ? ` + ${selectedBooking.additionalServices?.length}` : ''}
                      </p>
                    </div>
                    <div className="text-2xl font-black text-neutral-900">
                      {formatCurrency(calculateTotalPrice())}
                    </div>
                  </div>
                </div>
              </div>

              {/* Collapsible Color Notes Section */}
              <details className="group border-t border-neutral-100 pt-6">
                <summary className="cursor-pointer list-none flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-neutral-900 uppercase tracking-tight">Notas de Tinte y Fórmulas</h3>
                    <p className="text-[10px] text-neutral-500 mt-1">Información confidencial del cliente</p>
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
                  <button
                    type="button"
                    disabled={savingNotes || !newHistoryEntry.trim()}
                    onClick={async () => {
                      try {
                        const noteToSave = newHistoryEntry.trim();
                        if (!noteToSave) return;
                        setSavingNotes(true);
                        let profileId = clientProfile?.id;
                      if (!profileId && selectedBooking) {
                        if (!selectedBooking.clientEmail) {
                          alert('No hay email del cliente en la reserva. Actualiza el email para guardar notas.');
                          return;
                        }
                        const nameParts = (selectedBooking.clientName || '').trim().split(' ');
                          const firstName = nameParts.shift() || selectedBooking.clientName || '';
                          const lastName = nameParts.join(' ') || '';
                          profileId = await createClient(null, {
                            userId: '',
                            firstName,
                            lastName,
                            email: selectedBooking.clientEmail,
                            phone: selectedBooking.clientPhone || '',
                          hairColorNotes: noteToSave,
                          hairColorHistory: [{ note: noteToSave, date: new Date().toISOString(), bookingId: selectedBooking.id }],
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
                        const newProfile: Client = {
                          id: profileId,
                          userId: '',
                          firstName,
                          lastName,
                          email: selectedBooking.clientEmail,
                          phone: selectedBooking.clientPhone || '',
                          hairColorNotes: noteToSave,
                          hairColorHistory: [{ note: noteToSave, date: new Date().toISOString(), bookingId: selectedBooking.id }],
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
                          };
                          setClientProfile(newProfile);
                        } else if (profileId) {
                          const history = clientProfile?.hairColorHistory || [];
                          const newEntry = { note: noteToSave, date: new Date().toISOString(), bookingId: selectedBooking.id };
                          await updateClient(profileId, { hairColorNotes: noteToSave, hairColorHistory: [...history, newEntry] });
                          setClientProfile(clientProfile ? { ...clientProfile, hairColorNotes: noteToSave, hairColorHistory: [...history, newEntry] } : null);
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
                        className="px-6 py-2 bg-neutral-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-[14px] hover:bg-accent-600 transition disabled:opacity-60"
                  >
                    {savingNotes ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
                  </div>

                {clientProfile?.hairColorHistory && clientProfile.hairColorHistory.length > 0 && (
                  <div className="space-y-2">
                      <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Historial</p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {[...clientProfile.hairColorHistory]
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((entry, idx) => (
                            <div key={`${entry.date}-${idx}`} className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-between text-sm">
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
          </div>
        </div>
      )}

      <PaymentMethodModal
        isOpen={showPaymentMethodModal}
        onClose={() => {
          setShowPaymentMethodModal(false);
          setBookingToMarkPaid(null);
        }}
        onConfirm={handleConfirmPayment}
        amount={bookingToMarkPaid ? (() => {
          const service = services.find(s => s.id === bookingToMarkPaid.serviceId);
          return (service?.price || 0) * 0.5;
        })() : 0}
        mode="deposit"
        isProcessing={processingPayment}
      />

      <ClosingSaleModal
        isOpen={showClosingSaleModal}
        onClose={() => {
          setShowClosingSaleModal(false);
          setBookingToMarkPaid(null);
        }}
        booking={bookingToMarkPaid}
        services={services}
        currentUserId={user?.id}
        onConfirm={handleConfirmFinalPayment}
        isProcessing={processingPayment}
      />
    </div>
  );
}
