'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { getBookings, getServices, getEmployees, getClient, updateBooking } from '@/shared/lib/firestore';
import { Loading } from '@/shared/components/Loading';
import type { Booking, Service, Employee, BookingFormData, Client } from '@/shared/lib/types';
import { formatDate, formatTime, formatCurrency, cn, canCancelWithNotice, hoursUntilBooking } from '@/shared/lib/utils';
import Link from 'next/link';
import { loadStripe, type Stripe, type StripeCardElement, type StripeElements } from '@stripe/stripe-js';
import { getLocalizedServiceDescription } from '@/shared/lib/serviceLocalization';

export default function ClientBookingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [serviceEmployees, setServiceEmployees] = useState<Employee[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [clientData, setClientData] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    employeeId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState<number | null>(null); // cents
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const cardElementRef = useRef<StripeCardElement | null>(null);
  const expressElementsRef = useRef<StripeElements | null>(null);
  const expressCheckoutElementRef = useRef<any>(null);
  const handledRebookIdRef = useRef<string | null>(null);
  const cardMountId = 'client-booking-card-element';
  const paymentRequestMountId = 'client-booking-wallet-element';
  const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  const [walletLabel, setWalletLabel] = useState<string | null>(null);

  // Fetch services and employees immediately (like the homepage does)
  useEffect(() => {
    const fetchStaticData = async () => {
      try {
        const [servicesRes, employeesRes] = await Promise.all([
          fetch('/api/services?withEmployees=true'),
          fetch('/api/employees'),
        ]);

        const servicesData = await servicesRes.json();
        const employeesData = await employeesRes.json();

        if (servicesData.success) {
          const activeServices = servicesData.data.filter((s: Service) => s.isActive);
          setServices(activeServices);
        }
        if (employeesData.success) {
          const activeEmployees = employeesData.data.filter((e: Employee) => e.status === 'active');
          setEmployees(activeEmployees);
        }
      } catch (error) {
        console.error('Error fetching services/employees:', error);
      }
    };

    fetchStaticData();
  }, []); // Run once on mount

  // Fetch user-specific bookings when user is available
  useEffect(() => {
    if (user?.id) {
      fetchData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    
    try {
      const bookingsData = await getBookings();
      
      // Fetch client data separately with error handling
      let client = null;
      try {
        client = await getClient(user.id);
      } catch (err) {
        console.warn('Client data not found');
      }

      const clientBookings = bookingsData.filter(b => b.clientEmail === user.email);
      
      setBookings(clientBookings);
      setClientData(client);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch employees for selected service
  useEffect(() => {
    if (selectedService?.id) {
      const fetchServiceEmployees = async () => {
        try {
          const response = await fetch(`/api/services/${selectedService.id}/employees`);
          const data = await response.json();
          if (data.success) {
            setServiceEmployees(data.data);
          }
        } catch (error) {
          console.error('Error fetching service employees:', error);
        }
      };
      fetchServiceEmployees();
    } else {
      setServiceEmployees([]);
    }
  }, [selectedService?.id]);

  // Fetch available slots
  useEffect(() => {
    if (formData.date && selectedService?.id && formData.employeeId) {
      const fetchSlots = async () => {
        setLoadingSlots(true);
        try {
          const response = await fetch(
            `/api/slots/available?employeeId=${formData.employeeId}&serviceId=${selectedService.id}&date=${formData.date}`
          );
          const data = await response.json();
          if (data.success) {
            // API returns {time, available} objects - filter for available and extract time
            const slots = data.data?.slots || [];
            const availableTimes = slots
              .filter((slot: { time: string; available: boolean }) => slot.available)
              .map((slot: { time: string; available: boolean }) => slot.time);
            setAvailableSlots(availableTimes);
          } else {
            setAvailableSlots([]);
          }
        } catch (error) {
          console.error('Error fetching slots:', error);
          setAvailableSlots([]);
        } finally {
          setLoadingSlots(false);
        }
      };
      fetchSlots();
    } else {
      setAvailableSlots([]);
      setLoadingSlots(false);
    }
  }, [formData.date, selectedService?.id, formData.employeeId]);

  // Stripe setup
  useEffect(() => {
    if (!stripePublicKey || stripeRef.current) return;
    loadStripe(stripePublicKey)
      .then((stripe) => {
        stripeRef.current = stripe;
        if (stripe) {
          elementsRef.current = stripe.elements();
        }
      })
      .catch((error) => console.error('Error loading Stripe:', error));
  }, [stripePublicKey]);

  useEffect(() => {
    if (!showNewBookingModal || bookingStep !== 3) return;
    if (!elementsRef.current && stripeRef.current) {
      elementsRef.current = stripeRef.current.elements();
    }
    if (!elementsRef.current || cardElementRef.current) return;

    const card = elementsRef.current.create('card', { hidePostalCode: true });
    card.mount(`#${cardMountId}`);
    cardElementRef.current = card;

    return () => {
      if (cardElementRef.current) {
        cardElementRef.current.destroy();
        cardElementRef.current = null;
      }
    };
  }, [bookingStep, showNewBookingModal, cardMountId]);

  useEffect(() => {
    const walletAmount = depositAmount ?? Math.round((selectedService?.price || 0) * 50);
    if (!showNewBookingModal || bookingStep !== 3 || !stripePublicKey || !walletAmount || !user || !selectedService) {
      setWalletLabel(null);
      if (expressCheckoutElementRef.current) {
        try { expressCheckoutElementRef.current.unmount(); } catch (_e) { /* noop */ }
        expressCheckoutElementRef.current = null;
      }
      expressElementsRef.current = null;
      return;
    }

    const clientName = clientData
      ? `${clientData.firstName} ${clientData.lastName}`
      : user.email?.split('@')[0] || 'Client';
    const clientEmail = user.email || '';
    const clientPhone = clientData?.phone || '';

    let isActive = true;
    let mountedElement: any = null;

    const setupExpressCheckout = async () => {
      if (!stripeRef.current) {
        stripeRef.current = await loadStripe(stripePublicKey);
      }
      if (!stripeRef.current || !isActive) return;

      if (expressCheckoutElementRef.current) {
        try { expressCheckoutElementRef.current.unmount(); } catch (_e) { /* noop */ }
        expressCheckoutElementRef.current = null;
      }

      const expressElements = stripeRef.current.elements({
        mode: 'payment',
        amount: walletAmount,
        currency: 'eur',
      });
      expressElementsRef.current = expressElements;

      const expressCheckout = expressElements.create('expressCheckout', {
        paymentMethodOrder: ['applePay', 'googlePay', 'link'],
        buttonHeight: 48,
        buttonType: { applePay: 'book', googlePay: 'book' },
      } as any);

      expressCheckout.on('ready', (event: any) => {
        if (!isActive) return;
        const methods = event?.availablePaymentMethods || {};
        if (methods.applePay) setWalletLabel('Apple Pay');
        else if (methods.googlePay) setWalletLabel('Google Pay');
        else if (methods.link) setWalletLabel('Link');
        else setWalletLabel(null);
      });

      expressCheckout.on('confirm', async () => {
        setSubmitting(true);
        setPaymentLoading(true);
        setPaymentError(null);

        try {
          if (!selectedService) {
            throw new Error('No se ha seleccionado un servicio.');
          }

          const ensureIntent = async () => {
            if (clientSecret && paymentIntentId && depositAmount) {
              return { clientSecret, paymentIntentId, amount: depositAmount };
            }
            const response = await fetch('/api/payments/create-intent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                serviceId: selectedService.id,
                bookingDate: formData.date,
                bookingTime: formData.time,
                clientName,
                clientEmail,
                depositPercentage: 50,
              }),
            });
            const result = await response.json();
            if (!result.success) {
              throw new Error(result.error || 'No se pudo iniciar el pago');
            }
            setClientSecret(result.data.clientSecret);
            setPaymentIntentId(result.data.paymentIntentId);
            setDepositAmount(result.data.amount);
            return result.data as { clientSecret: string; paymentIntentId: string; amount: number };
          };

          const { error: submitError } = await expressElements.submit();
          if (submitError) {
            throw new Error(submitError.message || 'El pago no pudo completarse');
          }

          const intent = await ensureIntent();

          const { error, paymentIntent } = await stripeRef.current!.confirmPayment({
            elements: expressElements,
            clientSecret: intent.clientSecret,
            confirmParams: {
              return_url: `${window.location.origin}/client/bookings`,
              payment_method_data: {
                billing_details: {
                  name: clientName || undefined,
                  email: clientEmail || undefined,
                  phone: clientPhone || undefined,
                },
              },
            },
            redirect: 'if_required',
          });

          if (error) {
            throw new Error(error.message || 'El pago no pudo completarse');
          }
          if (!paymentIntent || paymentIntent.status !== 'succeeded') {
            throw new Error('El pago no se completó. Inténtalo de nuevo.');
          }

          const bookingData: BookingFormData = {
            serviceId: selectedService.id,
            employeeId: formData.employeeId,
            bookingDate: formData.date,
            bookingTime: formData.time,
            clientName,
            clientEmail,
            clientPhone,
            paymentIntentId: paymentIntent.id,
          };

          const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData),
          });

          const result = await response.json();
          if (!result.success) {
            throw new Error(result.error || 'No se pudo crear la reserva');
          }

          if (user?.id) {
            const updatedBookings = await getBookings();
            const clientBookings = updatedBookings.filter((booking) => booking.clientEmail === user.email);
            setBookings(clientBookings);
          }
          closeNewBooking();
          alert('Booking created successfully!');
        } catch (error: any) {
          console.error('Wallet booking error:', error);
          setPaymentError(error.message || 'Error al procesar el pago');
        } finally {
          setSubmitting(false);
          setPaymentLoading(false);
        }
      });

      mountedElement = expressCheckout;
      expressCheckoutElementRef.current = expressCheckout;
      expressCheckout.mount(`#${paymentRequestMountId}`);
    };

    setupExpressCheckout().catch((error) => {
      console.error('Error setting up wallet payment:', error);
      if (isActive) setWalletLabel(null);
    });

    return () => {
      isActive = false;
      if (mountedElement) {
        try { mountedElement.unmount(); } catch (_e) { /* noop */ }
      }
      if (expressCheckoutElementRef.current === mountedElement) {
        expressCheckoutElementRef.current = null;
      }
      expressElementsRef.current = null;
    };
  }, [
    showNewBookingModal,
    bookingStep,
    stripePublicKey,
    depositAmount,
    selectedService?.id,
    selectedService?.price,
    selectedService?.serviceName,
    formData.date,
    formData.time,
    formData.employeeId,
    clientData,
    user,
    clientSecret,
    paymentIntentId,
  ]);

  useEffect(() => {
    setClientSecret(null);
    setPaymentIntentId(null);
    setDepositAmount(null);
    setPaymentError(null);
  }, [selectedService?.id, formData.date, formData.time, bookingStep]);

  const resetPaymentState = () => {
    setClientSecret(null);
    setPaymentIntentId(null);
    setDepositAmount(null);
    setPaymentError(null);
    setPaymentLoading(false);
    setWalletLabel(null);
    if (cardElementRef.current) {
      cardElementRef.current.destroy();
      cardElementRef.current = null;
    }
    if (expressCheckoutElementRef.current) {
      try { expressCheckoutElementRef.current.unmount(); } catch (_e) { /* noop */ }
      expressCheckoutElementRef.current = null;
    }
    expressElementsRef.current = null;
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    if (!canCancelWithNotice(selectedBooking.bookingDate, selectedBooking.bookingTime)) {
      alert('Solo puedes cancelar hasta 24 horas antes de la cita.');
      return;
    }

    try {
      const response = await fetch(`/api/bookings/${selectedBooking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: user?.role || 'client' }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'No se pudo cancelar la reserva');
      }
      if (result.data?.requiresClientWrite) {
        await updateBooking(selectedBooking.id, {
          status: 'cancelled',
          cancelledAt: new Date(),
          paymentStatus: result.data?.refundStatus === 'refunded' ? 'refunded' : selectedBooking.paymentStatus,
          depositPaid: result.data?.refundStatus === 'refunded' ? false : selectedBooking.depositPaid,
        });
      }
      await fetchData(); // Refresh
      setShowCancelModal(false);
      setSelectedBooking(null);
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      alert(error?.message || 'Error al cancelar la reserva');
    }
  };

  const openNewBooking = () => {
    if (loading) {
      alert('Cargando datos... Por favor espera un momento.');
      return;
    }
    
    if (services.length === 0) {
      alert('No hay servicios disponibles. Por favor, contacta con el salón.');
      return;
    }
    
    setShowNewBookingModal(true);
    setBookingStep(1);
    setSelectedService(null);
    setSelectedEmployee(null);
    setFormData({ date: '', time: '', employeeId: '' });
    resetPaymentState();
  };

  const startRebooking = (booking: Booking) => {
    const service = getService(booking.serviceId);
    if (!service) {
      alert('Este servicio ya no está disponible. Por favor, elige otro.');
      return;
    }

    const preferredEmployee = employees.find((employee) => employee.id === booking.employeeId) || null;

    setShowNewBookingModal(true);
    setSelectedService(service);
    setSelectedEmployee(preferredEmployee);
    setBookingStep(preferredEmployee ? 3 : 2);
    setFormData({
      date: '',
      time: '',
      employeeId: preferredEmployee?.id || '',
    });
    setAvailableSlots([]);
    resetPaymentState();
  };

  const closeNewBooking = () => {
    setShowNewBookingModal(false);
    setBookingStep(1);
    setSelectedService(null);
    setSelectedEmployee(null);
    setFormData({ date: '', time: '', employeeId: '' });
    setAvailableSlots([]);
    resetPaymentState();
  };

  const handleSubmitNewBooking = async () => {
    if (!selectedService || !formData.employeeId || !user) return;

    const clientName = clientData 
      ? `${clientData.firstName} ${clientData.lastName}` 
      : user.email?.split('@')[0] || 'Client';
    const clientEmail = user.email || '';
    const clientPhone = clientData?.phone || '';

    const ensureIntent = async () => {
      if (clientSecret && paymentIntentId && depositAmount) {
        return { clientSecret, paymentIntentId, amount: depositAmount };
      }
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          bookingDate: formData.date,
          bookingTime: formData.time,
          clientName,
          clientEmail,
          depositPercentage: 50,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'No se pudo iniciar el pago');
      }
      setClientSecret(result.data.clientSecret);
      setPaymentIntentId(result.data.paymentIntentId);
      setDepositAmount(result.data.amount);
      return result.data as { clientSecret: string; paymentIntentId: string; amount: number };
    };

    setSubmitting(true);
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      if (!stripePublicKey) {
        throw new Error('La pasarela de pago no está configurada. Contacta con soporte.');
      }
      if (!stripeRef.current) {
        stripeRef.current = await loadStripe(stripePublicKey);
      }
      if (!stripeRef.current) {
        throw new Error('No se pudo inicializar Stripe');
      }
      if (!elementsRef.current) {
        elementsRef.current = stripeRef.current.elements();
      }
      if (!cardElementRef.current && elementsRef.current) {
        const card = elementsRef.current.create('card', { hidePostalCode: true });
        card.mount(`#${cardMountId}`);
        cardElementRef.current = card;
      }
      if (!cardElementRef.current) {
        throw new Error('El formulario de pago no está listo.');
      }

      const intent = await ensureIntent();

      const { error, paymentIntent } = await stripeRef.current.confirmCardPayment(intent.clientSecret, {
        payment_method: {
          card: cardElementRef.current,
          billing_details: {
            name: clientName,
            email: clientEmail,
            phone: clientPhone,
          },
        },
      });

      if (error || !paymentIntent) {
        throw new Error(error?.message || 'El pago no pudo completarse');
      }
      if (paymentIntent.status !== 'succeeded') {
        throw new Error('El pago no se completó. Inténtalo de nuevo.');
      }

      const bookingData: BookingFormData = {
        serviceId: selectedService.id,
        employeeId: formData.employeeId,
        bookingDate: formData.date,
        bookingTime: formData.time,
        clientName,
        clientEmail,
        clientPhone,
        paymentIntentId: paymentIntent.id,
      };

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
      });

      const result = await response.json();

      if (result.success) {
        if (user?.id) {
          const updatedBookings = await getBookings();
          const clientBookings = updatedBookings.filter(b => b.clientEmail === user.email);
          setBookings(clientBookings);
        }
        closeNewBooking();
        alert('Booking created successfully!');
      } else {
        throw new Error(result.error || 'No se pudo crear la reserva');
      }
    } catch (error: any) {
      console.error('Booking error:', error);
      setPaymentError(error.message || 'Error al procesar el pago');
    } finally {
      setSubmitting(false);
      setPaymentLoading(false);
    }
  };

  const stepValid = useMemo(() => {
    if (bookingStep === 1) return !!selectedService;
    if (bookingStep === 2) return !!formData.employeeId;
    if (bookingStep === 3) return !!(formData.date && formData.time);
    return true;
  }, [bookingStep, selectedService, formData]);

  useEffect(() => {
    const rebookId = searchParams.get('rebook');
    if (!rebookId || loading) return;
    if (handledRebookIdRef.current === rebookId) return;

    const bookingToRepeat = bookings.find((booking) => booking.id === rebookId);
    if (!bookingToRepeat) return;

    handledRebookIdRef.current = rebookId;
    startRebooking(bookingToRepeat);
    router.replace('/client/bookings');
  }, [searchParams, loading, bookings, router, employees]);

  if (loading) {
    return <Loading />;
  }

  // Get today's date string (YYYY-MM-DD) for comparison
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Show all future bookings that aren't cancelled (including confirmed, pending, and completed)
  const upcomingBookings = bookings
    .filter(b => b.status !== 'cancelled' && b.bookingDate >= todayStr)
    .sort((a, b) => a.bookingDate.localeCompare(b.bookingDate) || a.bookingTime.localeCompare(b.bookingTime));

  const selectedPriceValue = selectedService?.price ?? null;
  const estimatedDepositValue = selectedPriceValue ? selectedPriceValue * 0.5 : null;
  const depositDisplay = depositAmount
    ? formatCurrency(depositAmount / 100)
    : estimatedDepositValue
      ? formatCurrency(estimatedDepositValue)
      : null;
  const remainingBalance =
    selectedPriceValue && (depositAmount || estimatedDepositValue)
      ? selectedPriceValue - (depositAmount ? depositAmount / 100 : estimatedDepositValue || 0)
      : null;

  const getService = (serviceId: string) => {
    return services.find(s => s.id === serviceId);
  };

  const getServiceName = (serviceId: string) => {
    return services.find(s => s.id === serviceId)?.serviceName || 'Service';
  };

  const getEmployee = (employeeId: string) => {
    return employees.find(e => e.id === employeeId);
  };

  const selectedBookingHoursLeft = selectedBooking
    ? hoursUntilBooking(selectedBooking.bookingDate, selectedBooking.bookingTime)
    : null;
  const canCancelSelected = selectedBooking
    ? canCancelWithNotice(selectedBooking.bookingDate, selectedBooking.bookingTime)
    : true;

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 pb-8 sm:space-y-10 sm:pb-10 lg:space-y-12 lg:pb-12">
      {/* Header - Bold Premium */}
      <div className="flex flex-col gap-5 sm:gap-6 md:flex-row md:items-end md:justify-between md:gap-8">
        <div>
          <h1 className="text-4xl font-black uppercase leading-none tracking-tighter text-neutral-900 sm:text-5xl lg:text-6xl">
            My Appointments
          </h1>
          <p className="mt-3 text-[11px] font-black uppercase tracking-[0.22em] text-neutral-400 sm:mt-4 sm:text-sm sm:tracking-[0.3em]">
            Gestión de tus reservas activas
          </p>
        </div>
        <button
          onClick={openNewBooking}
          className="flex w-full items-center justify-center gap-3 rounded-[18px] bg-neutral-900 px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all hover:bg-rose-600 sm:w-auto sm:px-10 sm:py-5 sm:text-sm sm:hover:-translate-y-1"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
          </svg>
          New Booking
        </button>
      </div>

      {/* Bookings List - High End Design */}
      {upcomingBookings.length > 0 ? (
        <div className="grid gap-8">
          {upcomingBookings.map((booking) => {
            const service = getService(booking.serviceId);
            const employee = getEmployee(booking.employeeId);
            const canCancel = canCancelWithNotice(booking.bookingDate, booking.bookingTime);
            
            return (
              <div
                key={booking.id}
                className="group flex flex-col justify-between gap-6 rounded-[28px] border border-neutral-100 bg-white p-5 transition-all hover:shadow-2xl sm:gap-8 sm:rounded-[40px] sm:p-8 lg:flex-row lg:items-center lg:gap-10 lg:rounded-[48px] lg:p-10"
              >
                <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8 lg:gap-10">
                  <div className={cn(
                    "flex h-20 w-20 flex-col items-center justify-center rounded-[24px] text-white shadow-xl transition-all duration-500 group-hover:scale-105 sm:h-24 sm:w-24 sm:rounded-[32px]",
                    booking.status === 'confirmed' ? 'bg-success-600' : 'bg-success-500'
                  )}>
                    <span className="text-xs font-black uppercase tracking-widest opacity-60">
                      {new Date(booking.bookingDate + 'T00:00:00').toLocaleString('es', { month: 'short' }).toUpperCase()}
                    </span>
                    <span className="mt-1 text-3xl font-black leading-none sm:text-4xl">
                      {new Date(booking.bookingDate + 'T00:00:00').getDate()}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em]",
                        booking.status === 'confirmed'
                          ? 'bg-success-500 text-white'
                          : 'bg-success-600 text-white'
                      )}>
                        {booking.status === 'confirmed' ? 'CONFIRMADA' : 'LISTA'}
                      </span>
                      <span className="text-[10px] font-black text-accent-600 tabular-nums uppercase tracking-widest">{formatTime(booking.bookingTime)}</span>
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter leading-none text-neutral-900 sm:text-3xl">{service?.serviceName || 'TRATAMIENTO'}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                      <span className="flex items-center gap-2">
                        {employee?.profileImage ? (
                          <img src={employee.profileImage} alt="" className="w-5 h-5 rounded-full object-cover grayscale" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                        )}
                        {employee?.firstName}
                      </span>
                      <span className="text-neutral-200">•</span>
                      <span>{service?.duration} MIN</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-stretch gap-4 border-t pt-6 sm:flex-row sm:items-center sm:gap-6 lg:gap-10 lg:border-t-0 lg:pt-0">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Inversión</p>
                    <p className="text-2xl font-black text-neutral-900 tabular-nums sm:text-3xl">{formatCurrency(service?.price || 0)}</p>
                  </div>
                  <button
                    onClick={() => startRebooking(booking)}
                    className="rounded-[18px] bg-rose-600 px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all hover:bg-neutral-900 sm:rounded-[20px]"
                  >
                    Repetir
                  </button>
                  <button
                    onClick={() => {
                      setSelectedBooking(booking);
                      setShowCancelModal(true);
                    }}
                    disabled={!canCancel}
                    className={`flex h-12 w-full items-center justify-center rounded-[18px] transition-all shadow-sm sm:h-16 sm:w-16 sm:rounded-[24px] ${
                      canCancel
                        ? 'bg-neutral-50 text-neutral-300 hover:bg-amber-600 hover:text-white'
                        : 'bg-neutral-100 text-neutral-300 cursor-not-allowed'
                    }`}
                  >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[32px] border-2 border-dashed border-neutral-200 bg-neutral-50 p-8 text-center sm:rounded-[48px] sm:p-14 lg:rounded-[64px] lg:p-24">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[24px] bg-white shadow-xl sm:mb-10 sm:h-24 sm:w-24 sm:rounded-[32px]">
            <svg className="w-12 h-12 text-neutral-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="mb-4 text-2xl font-black uppercase tracking-tighter text-neutral-900 sm:text-3xl">No hay citas activas</h3>
          <p className="mx-auto mb-8 max-w-xs text-[11px] font-bold uppercase leading-relaxed tracking-[0.24em] text-neutral-400 sm:mb-12 sm:text-xs sm:tracking-widest">
            Book your next luxury experience at Amor & Amar
          </p>
          <button
            onClick={openNewBooking}
            className="w-full rounded-[20px] bg-rose-600 px-8 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-white shadow-2xl shadow-rose-200 transition-all hover:bg-neutral-900 sm:w-auto sm:rounded-[24px] sm:px-12 sm:py-6 sm:text-xs sm:tracking-[0.3em]"
          >
            Comenzar Ahora
          </button>
        </div>
      )}

      {/* Cancel Modal - Bold Luxury */}
      {showCancelModal && selectedBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/90 backdrop-blur-xl">
          <div className="w-full max-w-md rounded-[28px] border-2 border-white/20 bg-white p-6 shadow-2xl sm:rounded-[40px] sm:p-12">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[22px] bg-amber-50 sm:mb-8 sm:h-20 sm:w-20 sm:rounded-[28px]">
              <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="mb-4 text-2xl font-black uppercase tracking-tighter text-neutral-900 sm:text-3xl">
              Cancel Appointment?
            </h3>
            <p className="text-neutral-400 font-bold uppercase tracking-widest text-[10px] leading-relaxed mb-10">
              Vas a anular tu cita para <span className="text-neutral-900">{getServiceName(selectedBooking.serviceId)}</span> el {formatDate(selectedBooking.bookingDate)}. Esta acción no se puede deshacer.
              {!canCancelSelected && (
                <span className="text-amber-600 block mt-2">Solo se permiten cancelaciones con 24 horas de antelación.</span>
              )}
              {selectedBookingHoursLeft !== null && (
                <span className="text-neutral-500 block mt-2">
                  Tiempo restante: {Math.max(0, Math.floor(selectedBookingHoursLeft))}h.
                </span>
              )}
            </p>
            <div className="flex flex-col gap-4">
              <button
                onClick={handleCancelBooking}
                disabled={!canCancelSelected}
                className={`w-full py-5 text-xs font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl ${
                  canCancelSelected
                    ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-100'
                    : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                }`}
              >
                Confirmar Baja
              </button>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedBooking(null);
                }}
                className="w-full py-5 bg-neutral-50 text-neutral-400 text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-neutral-900 hover:text-white transition-all"
              >
                Keep Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Booking Modal - Reusing the same Premium style */}
      {showNewBookingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/90 backdrop-blur-xl">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border-2 border-white/20 bg-white shadow-2xl sm:rounded-[40px]">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/5 bg-neutral-900 p-5 text-white sm:items-center sm:p-8 lg:p-10">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400">STEP {bookingStep} OF 3</p>
                </div>
                <h2 className="text-2xl font-black uppercase leading-none tracking-tighter sm:text-4xl">New Booking</h2>
              </div>
              <button
                onClick={closeNewBooking}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-white/40 transition-all hover:bg-rose-600 hover:text-white sm:h-12 sm:w-12"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 no-scrollbar sm:p-8 lg:p-10">
              {bookingStep === 1 && (
                <div className="space-y-8">
                  <h3 className="text-xl font-black text-neutral-900 uppercase tracking-widest border-b border-neutral-100 pb-4">Selecciona una Experiencia</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {services.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => setSelectedService(service)}
                        className={cn(
                          "rounded-[24px] border-2 p-5 text-left transition-all sm:rounded-[32px] sm:p-8",
                          selectedService?.id === service.id
                            ? "border-rose-600 bg-rose-50/50 shadow-xl"
                            : "border-neutral-100 hover:border-rose-200 hover:bg-neutral-50"
                        )}
                      >
                        <h4 className="mb-2 text-xl font-black uppercase tracking-tighter text-neutral-900 sm:text-2xl">{service.serviceName}</h4>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-6 line-clamp-2">
                          {getLocalizedServiceDescription(service, 'es')}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xl font-black text-rose-600 tabular-nums">{formatCurrency(service.price)}</span>
                          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{service.duration} MIN</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {bookingStep === 2 && (
                <div className="space-y-8">
                  <h3 className="text-xl font-black text-neutral-900 uppercase tracking-widest border-b border-neutral-100 pb-4">Tu Profesional de Confianza</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {serviceEmployees.map((employee) => (
                      <button
                        key={employee.id}
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setFormData({ ...formData, employeeId: employee.id });
                        }}
                        className={cn(
                          "flex flex-col items-start gap-4 rounded-[24px] border-2 p-5 text-left transition-all sm:flex-row sm:items-center sm:gap-6 sm:rounded-[32px] sm:p-8",
                          formData.employeeId === employee.id
                            ? "border-rose-600 bg-rose-50/50 shadow-xl"
                            : "border-neutral-100 hover:border-rose-200 hover:bg-neutral-50"
                        )}
                      >
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] bg-neutral-900 text-xl font-black uppercase text-white shadow-lg sm:h-20 sm:w-20 sm:rounded-[24px] sm:text-2xl">
                          {employee.profileImage ? (
                            <img src={employee.profileImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{employee.firstName[0]}{employee.lastName[0]}</span>
                          )}
                        </div>
                        <div>
                          <h4 className="text-lg font-black uppercase tracking-tighter text-neutral-900 sm:text-xl">{employee.firstName} {employee.lastName}</h4>
                          <p className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] mt-1">{employee.position || 'SPECIALIST'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {bookingStep === 3 && (
                <div className="space-y-10">
                  <h3 className="text-xl font-black text-neutral-900 uppercase tracking-widest border-b border-neutral-100 pb-4">El Momento Perfecto</h3>
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
                    <div className="space-y-4">
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Selecciona Fecha</label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value, time: '' })}
                        min={todayStr}
                        className="w-full rounded-[20px] border-2 border-neutral-100 bg-neutral-50 px-5 py-4 font-black uppercase text-neutral-900 outline-none transition-all focus:border-rose-500 sm:rounded-[24px] sm:px-8 sm:py-6"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Selecciona Horario</label>
                      {!formData.date ? (
                        <div className="rounded-[20px] border-2 border-dashed border-neutral-200 bg-neutral-50 p-6 text-center sm:rounded-[24px] sm:p-8">
                          <p className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">Primero elige una fecha</p>
                        </div>
                      ) : loadingSlots ? (
                        <div className="flex justify-center py-8"><div className="w-2 h-2 rounded-full bg-rose-600 animate-ping" /></div>
                      ) : (
                        <div className="grid grid-cols-3 gap-3">
                          {availableSlots.map((slot) => (
                            <button
                              key={slot}
                              onClick={() => setFormData({ ...formData, time: slot })}
                              className={cn(
                                "py-4 text-xs font-black rounded-xl transition-all tabular-nums",
                                formData.time === slot
                                  ? "bg-rose-600 text-white shadow-lg"
                                  : "bg-white border-2 border-neutral-100 text-neutral-400 hover:border-neutral-900 hover:text-neutral-900"
                              )}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                      <p className="text-sm font-black text-neutral-900 uppercase tracking-widest">Pago de depósito (50%)</p>
                      <span className="text-xs font-bold text-rose-600">
                        {depositDisplay || '—'}
                      </span>
                    </div>
                    {walletLabel && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-neutral-500">{walletLabel}</p>
                        <div
                          id={paymentRequestMountId}
                          className="min-h-12 overflow-hidden rounded-[16px]"
                        />
                        <div className="flex items-center gap-3">
                          <div className="h-px flex-1 bg-neutral-200" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                            o tarjeta
                          </span>
                          <div className="h-px flex-1 bg-neutral-200" />
                        </div>
                      </div>
                    )}
                    {stripePublicKey ? (
                      <div
                        id={cardMountId}
                        className="p-4 bg-neutral-50 border-2 border-neutral-100 rounded-[16px]"
                      />
                    ) : (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-[16px] text-amber-800 text-sm">
                        Falta la clave pública de Stripe. Contacta con soporte.
                      </div>
                    )}
                    {paymentError && (
                      <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                        {paymentError}
                      </p>
                    )}
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                      Se cobrará {depositDisplay ?? 'el 50%'} ahora. El resto ({remainingBalance !== null ? formatCurrency(remainingBalance) : 'restante'}) al llegar.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse items-stretch justify-between gap-4 border-t border-neutral-100 bg-neutral-50 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-8 lg:p-10">
              <button
                onClick={() => {
                  if (bookingStep > 1) setBookingStep(bookingStep - 1);
                  else closeNewBooking();
                }}
                className="px-8 py-4 text-center text-xs font-black uppercase tracking-[0.2em] text-neutral-400 transition-colors hover:text-neutral-900"
              >
                {bookingStep === 1 ? 'CANCELAR' : 'VOLVER'}
              </button>
              
              {bookingStep < 3 ? (
                <button
                  onClick={() => setBookingStep(bookingStep + 1)}
                  disabled={!stepValid}
                  className="rounded-2xl bg-neutral-900 px-12 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-rose-200 transition-all hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  CONTINUAR
                </button>
              ) : (
                <button
                  onClick={handleSubmitNewBooking}
                  disabled={!stepValid || submitting || paymentLoading}
                  className="flex items-center justify-center gap-3 rounded-2xl bg-neutral-900 px-12 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-rose-200 transition-all hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {(submitting || paymentLoading) && <div className="w-2 h-2 rounded-full bg-white animate-ping" />}
                  {submitting || paymentLoading ? 'PROCESANDO...' : 'PAGAR Y RESERVAR'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
