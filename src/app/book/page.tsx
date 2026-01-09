'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { Loading } from '@/shared/components/Loading';
import { ClientAuthModal } from '@/shared/components/ClientAuthModal';
import { formatCurrency, cn } from '@/shared/lib/utils';
import type { Service, Employee, BookingFormData, Client } from '@/shared/lib/types';
import { loadStripe, type Stripe, type StripeCardElement, type StripeElements } from '@stripe/stripe-js';
import Link from 'next/link';
import Image from 'next/image';
import { getClient, getClientByEmail } from '@/shared/lib/firestore';
import { AvailabilityCalendar } from '@/shared/components/AvailabilityCalendar';

type Step = 1 | 2 | 3 | 4;

type FormData = {
  name: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  employeeId: string;
};

type TimeSlot = {
  time: string;
  available: boolean;
};

// Category display labels
const categoryDisplayLabels: Record<string, string> = {
  'nails': 'Uñas',
  'hair': 'Cabello',
  'balayage': 'Balayage',
  'air-touch': 'Air Touch',
  'babylight': 'Babylight',
  'filler-therapy': 'Terapia de Relleno',
  'brows-lashes': 'Cejas y Pestañas',
  'makeup': 'Maquillaje',
  'haircut': 'Corte',
  'styling': 'Peinado',
  'coloring': 'Coloración',
  'skincare': 'Cuidado de la Piel',
  'massage': 'Masaje',
  'facial': 'Facial',
  'other': 'Otro',
};

function formatCategory(category: string): string {
  return categoryDisplayLabels[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

const clampStep = (n: number): Step => Math.min(4, Math.max(1, n)) as Step;

// Format date from yyyy-mm-dd to dd-mm-yyyy
const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year}`;
};

export default function BookAllServicesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [serviceEmployees, setServiceEmployees] = useState<Employee[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [clientData, setClientData] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState<number | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [pendingClientDataRefresh, setPendingClientDataRefresh] = useState<boolean>(false);
  const [bookingStep, setBookingStep] = useState<Step>(1);
  const [formData, setFormData] = useState<FormData>({
    name: '', email: '', phone: '', date: '', time: '', employeeId: '',
  });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const cardElementRef = useRef<StripeCardElement | null>(null);
  const cardMountId = 'book-all-card-element';
  const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

  // Fetch all services
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await fetch('/api/services?withEmployees=true');
        const data = await response.json();
        
        if (data.success) {
          // Only show active services
          setServices(data.data.filter((s: Service) => s.isActive));
        }
      } catch (err) {
        console.error('Error fetching services:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  // Fetch employees for selected service
  useEffect(() => {
    if (selectedService?.id) {
      const fetchServiceEmployees = async () => {
        try {
          const response = await fetch(`/api/services/${selectedService.id}/employees`);
          const data = await response.json();
          if (data.success) {
            setServiceEmployees(data.data);
            // Auto-select if only one employee
            if (data.data.length === 1) {
              setFormData(prev => ({ ...prev, employeeId: data.data[0].id }));
            }
          }
        } catch (err) {
          console.error('Error fetching service employees:', err);
        }
      };
      fetchServiceEmployees();
    } else {
      setServiceEmployees([]);
    }
  }, [selectedService?.id]);

  // Pre-fill form with user data if logged in
  const fetchAndApplyClientData = async (currentUser: typeof user) => {
    if (!currentUser) return;
    
    try {
      // First try to get client by user ID
      let client = await getClient(currentUser.id);
      
      // If not found by ID, try by email as fallback
      if (!client && currentUser.email) {
        client = await getClientByEmail(currentUser.email);
      }
      
      if (client) {
        setClientData(client);
        // Build name from firstName/lastName, handling null/undefined
        const firstName = client.firstName || '';
        const lastName = client.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        
        setFormData(prev => ({
          ...prev,
          name: fullName || prev.name,
          email: client.email || currentUser.email || prev.email,
          phone: client.phone || prev.phone,
        }));
      } else {
        // Fallback to user data if no client profile
        const userFirstName = currentUser.firstName || '';
        const userLastName = currentUser.lastName || '';
        const userFullName = `${userFirstName} ${userLastName}`.trim();
        
        setFormData(prev => ({
          ...prev,
          name: userFullName || prev.name,
          email: currentUser.email || prev.email,
        }));
      }
    } catch (err) {
      console.warn('Could not fetch client profile:', err);
      // Fallback to user data
      const userFirstName = currentUser.firstName || '';
      const userLastName = currentUser.lastName || '';
      const userFullName = `${userFirstName} ${userLastName}`.trim();
      
      setFormData(prev => ({
        ...prev,
        name: userFullName || prev.name,
        email: currentUser.email || prev.email,
      }));
    }
  };

  useEffect(() => {
    if (user && !authLoading) {
      fetchAndApplyClientData(user);
    }
  }, [user, authLoading]);

  // Handle pending client data refresh after login
  useEffect(() => {
    if (pendingClientDataRefresh && user && !authLoading) {
      fetchAndApplyClientData(user);
      setPendingClientDataRefresh(false);
    }
  }, [pendingClientDataRefresh, user, authLoading]);

  // Fetch available slots
  useEffect(() => {
    if (formData.date && selectedService?.id && formData.employeeId) {
      const fetchSlots = async () => {
        setLoadingSlots(true);
        setSlotsError(null);
        try {
          const response = await fetch(
            `/api/slots/available?employeeId=${formData.employeeId}&serviceId=${selectedService.id}&date=${formData.date}`
          );
          const data = await response.json();
          if (data.success) {
            const slots = data.data?.slots || [];
            setAvailableSlots(slots);
            if (slots.length === 0) {
              setSlotsError('No hay horarios disponibles para esta fecha.');
            }
          } else {
            setSlotsError(data.error || 'Error al cargar horarios');
            setAvailableSlots([]);
          }
        } catch (err) {
          console.error('Error fetching slots:', err);
          setSlotsError('Error de conexión');
          setAvailableSlots([]);
        } finally {
          setLoadingSlots(false);
        }
      };
      fetchSlots();
    } else {
      setAvailableSlots([]);
      setSlotsError(null);
      setLoadingSlots(false);
    }
  }, [formData.date, selectedService?.id, formData.employeeId]);

  // Load Stripe
  useEffect(() => {
    if (!stripePublicKey || stripeRef.current) return;
    loadStripe(stripePublicKey)
      .then((stripe) => {
        stripeRef.current = stripe;
        if (stripe) {
          elementsRef.current = stripe.elements();
        }
      })
      .catch((err) => console.error('Error loading Stripe:', err));
  }, [stripePublicKey]);

  // Mount card element on payment step
  useEffect(() => {
    if (bookingStep !== 4) return;
    if (!elementsRef.current && stripeRef.current) {
      elementsRef.current = stripeRef.current.elements();
    }
    if (!elementsRef.current || cardElementRef.current) return;

    const card = elementsRef.current.create('card', {
      hidePostalCode: true,
      style: {
        base: {
          fontSize: '16px',
          color: '#111827',
        },
      },
    });
    card.mount(`#${cardMountId}`);
    cardElementRef.current = card;

    return () => {
      if (cardElementRef.current) {
        cardElementRef.current.destroy();
        cardElementRef.current = null;
      }
    };
  }, [bookingStep, cardMountId]);

  // Reset payment intent if selection changes
  useEffect(() => {
    setClientSecret(null);
    setPaymentIntentId(null);
    setDepositAmount(null);
    setPaymentError(null);
  }, [selectedService?.id, formData.date, formData.time]);

  const resetPaymentState = () => {
    setClientSecret(null);
    setPaymentIntentId(null);
    setDepositAmount(null);
    setPaymentError(null);
    setPaymentLoading(false);
    setBookingSuccess(false);
    if (cardElementRef.current) {
      cardElementRef.current.destroy();
      cardElementRef.current = null;
    }
  };

  const handleClientLoginSuccess = async () => {
    setShowLoginModal(false);
    // Mark that we need to refresh client data once auth state updates
    setPendingClientDataRefresh(true);
  };

  const openAuthModal = (mode: 'login' | 'signup') => {
    setAuthModalMode(mode);
    setShowLoginModal(true);
  };

  const selectService = (service: Service, employeeId?: string) => {
    setSelectedService(service);
    setBookingStep(2);
    // Pre-fill with client data if available
    if (clientData) {
      const firstName = clientData.firstName || '';
      const lastName = clientData.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      
      setFormData({
        name: fullName,
        email: clientData.email || '',
        phone: clientData.phone || '',
        date: '',
        time: '',
        employeeId: employeeId || '',
      });
    } else if (user) {
      const userFirstName = user.firstName || '';
      const userLastName = user.lastName || '';
      const userFullName = `${userFirstName} ${userLastName}`.trim();
      
      setFormData({
        name: userFullName,
        email: user.email || '',
        phone: '',
        date: '',
        time: '',
        employeeId: employeeId || '',
      });
    } else {
      setFormData({ name: '', email: '', phone: '', date: '', time: '', employeeId: employeeId || '' });
    }
  };

  const goBackToServices = () => {
    setSelectedService(null);
    setBookingStep(1);
    setFormData({ name: '', email: '', phone: '', date: '', time: '', employeeId: '' });
    resetPaymentState();
  };

  const next = () => setBookingStep((s) => clampStep(s + 1));
  const back = () => {
    if (bookingStep === 2) {
      goBackToServices();
    } else {
      setBookingStep((s) => clampStep(s - 1));
    }
  };

  const stepValid = useMemo<boolean>(() => {
    if (bookingStep === 1) return !!selectedService;
    if (bookingStep === 2) return !!(formData.name && formData.email && formData.phone && formData.employeeId);
    if (bookingStep === 3) return !!(formData.date && formData.time);
    return true;
  }, [bookingStep, selectedService, formData]);

  const ensurePaymentIntent = async () => {
    if (clientSecret && paymentIntentId && depositAmount) {
      return { clientSecret, paymentIntentId, amount: depositAmount };
    }

    if (!selectedService) {
      throw new Error('Servicio no disponible.');
    }

    const response = await fetch('/api/payments/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: selectedService.id,
        bookingDate: formData.date,
        bookingTime: formData.time,
        clientName: formData.name,
        clientEmail: formData.email,
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

  const handleSubmitBooking = async () => {
    if (!selectedService || !formData.employeeId) return;
    if (!stripePublicKey) {
      alert('La pasarela de pago no está configurada. Contacta con soporte.');
      return;
    }

    setSubmitting(true);
    setPaymentLoading(true);
    setPaymentError(null);

    try {
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

      const intent = await ensurePaymentIntent();

      const { error, paymentIntent } = await stripeRef.current.confirmCardPayment(intent.clientSecret, {
        payment_method: {
          card: cardElementRef.current,
          billing_details: {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
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
        clientName: formData.name,
        clientEmail: formData.email,
        clientPhone: formData.phone,
        paymentIntentId: paymentIntent.id,
      };

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
      });

      const result = await response.json();

      if (result.success) {
        setBookingSuccess(true);
        setPaymentError(null);
      } else {
        throw new Error(result.error || 'No se pudo crear la reserva');
      }
    } catch (err: any) {
      console.error('Booking error:', err);
      setPaymentError(err.message || 'Error al procesar el pago');
    } finally {
      setSubmitting(false);
      setPaymentLoading(false);
    }
  };

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loading text="Cargando servicios..." />
      </div>
    );
  }

  const selectedPriceValue = selectedService?.price || 0;
  const estimatedDepositValue = selectedPriceValue * 0.5;
  const depositDisplay = depositAmount
    ? formatCurrency(depositAmount / 100)
    : formatCurrency(estimatedDepositValue);
  const remainingBalance = selectedPriceValue - (depositAmount ? depositAmount / 100 : estimatedDepositValue);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-rose-50/30 overflow-x-hidden w-full">
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="mx-auto max-w-7xl px-3 sm:px-8">
          <div className="h-14 sm:h-16 flex items-center justify-between">
            <Link href="/" className="text-base sm:text-lg font-light tracking-wider text-neutral-900 hover:text-rose-600 transition">
              AMOR AMAR
            </Link>
            
            <div className="flex items-center gap-2 sm:gap-3">
              {user ? (
                <>
                  <span className="hidden md:block text-xs font-bold text-neutral-400 uppercase tracking-widest">
                    Hola, {user.firstName || user.email?.split('@')[0]}
                  </span>
                  <Link
                    href="/client/bookings"
                    className="px-3 sm:px-5 py-2 sm:py-2.5 text-[10px] sm:text-xs font-black text-white bg-rose-600 hover:bg-neutral-900 uppercase tracking-wider sm:tracking-widest transition rounded-xl flex items-center gap-1.5 sm:gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="hidden xs:inline">Mis Citas</span>
                  </Link>
                </>
              ) : (
                <>
                  <button
                    onClick={() => openAuthModal('login')}
                    className="px-2 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs font-black text-neutral-600 hover:text-rose-600 uppercase tracking-wider sm:tracking-widest transition"
                  >
                    Entrar
                  </button>
                  <button
                    onClick={() => openAuthModal('signup')}
                    className="px-3 sm:px-5 py-2 sm:py-2.5 text-[10px] sm:text-xs font-black text-white bg-rose-600 hover:bg-neutral-900 uppercase tracking-wider sm:tracking-widest transition rounded-xl flex items-center gap-1.5 sm:gap-2"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    <span className="hidden xs:inline">Crear</span> Cuenta
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-6 sm:mb-12">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] text-rose-600 mb-2 sm:mb-4">
              Amor & Amar
            </p>
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-neutral-800 uppercase leading-tight mb-2 sm:mb-4">
              Reserva Tu Experiencia
            </h1>
            <p className="text-neutral-500 font-medium text-sm sm:text-lg max-w-2xl mx-auto px-4">
              Elige el tratamiento perfecto para ti y reserva en minutos
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 mb-4 sm:mb-8">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center gap-2 sm:gap-4">
                <div className={cn(
                  "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-xs sm:text-sm transition-all",
                  bookingStep >= step 
                    ? "bg-rose-600 text-white" 
                    : "bg-neutral-100 text-neutral-400"
                )}>
                  {bookingStep > step ? (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : step}
                </div>
                {step < 4 && (
                  <div className={cn(
                    "w-6 sm:w-12 md:w-16 h-0.5 sm:h-1 rounded-full transition-all",
                    bookingStep > step ? "bg-rose-600" : "bg-neutral-100"
                  )} />
                )}
              </div>
            ))}
          </div>

          {/* Step Labels - Hidden on very small screens, shown compactly on mobile */}
          <div className="hidden xs:flex justify-center gap-4 sm:gap-8 md:gap-16 mb-6 sm:mb-12 text-center">
            <span className={cn("text-[8px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest", bookingStep === 1 ? "text-rose-600" : "text-neutral-400")}>Servicio</span>
            <span className={cn("text-[8px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest", bookingStep === 2 ? "text-rose-600" : "text-neutral-400")}>Datos</span>
            <span className={cn("text-[8px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest", bookingStep === 3 ? "text-rose-600" : "text-neutral-400")}>Fecha</span>
            <span className={cn("text-[8px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest", bookingStep === 4 ? "text-rose-600" : "text-neutral-400")}>Pago</span>
          </div>

          {/* Main Content Card */}
          <div className="bg-white rounded-[24px] sm:rounded-[40px] shadow-xl sm:shadow-2xl overflow-hidden border border-neutral-100">
            <div className="p-4 sm:p-8 md:p-12">
              
              {/* Step 1: Select Service */}
              {bookingStep === 1 && (
                <div className="space-y-8">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-neutral-800 uppercase tracking-tight">Nuestros Servicios</h2>
                  </div>

                  {services.length === 0 ? (
                    <div className="text-center py-12 sm:py-16">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-neutral-50 rounded-[20px] sm:rounded-[24px] flex items-center justify-center mx-auto mb-4 sm:mb-6">
                        <svg className="w-8 h-8 sm:w-10 sm:h-10 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <p className="text-neutral-500 font-medium text-sm sm:text-base">No hay servicios disponibles en este momento</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                      {services.map((service) => (
                        <button
                          key={service.id}
                          onClick={() => selectService(service)}
                          className="group p-5 sm:p-8 rounded-[20px] sm:rounded-[32px] text-left transition-all border-2 border-neutral-100 bg-white hover:border-rose-300 hover:shadow-xl active:scale-[0.98] relative overflow-hidden"
                        >
                          <div className="absolute top-0 left-0 h-1 w-0 bg-rose-600 group-hover:w-full transition-all duration-300" />
                          
                          <div className="mb-3 sm:mb-4">
                            <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-neutral-50 text-neutral-500 text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest">
                              {formatCategory(service.category)}
                            </span>
                          </div>
                          
                          <h3 className="text-lg sm:text-xl font-black text-neutral-800 uppercase tracking-tight mb-1.5 sm:mb-2 group-hover:text-rose-600 transition-colors">
                            {service.serviceName}
                          </h3>
                          
                          <p className="text-xs sm:text-sm text-neutral-500 font-medium leading-relaxed mb-4 sm:mb-6 line-clamp-2">
                            {service.description}
                          </p>

                          {/* Therapists on Stage 1 */}
                          {service.employees && service.employees.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-6">
                              {service.employees.map((emp) => (
                                <div
                                  key={emp.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectService(service, emp.id);
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      selectService(service, emp.id);
                                    }
                                  }}
                                  className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 text-[9px] font-bold uppercase tracking-wider border border-rose-100 hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
                                >
                                  {emp.firstName}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="flex items-end justify-between pt-3 sm:pt-4 border-t border-neutral-100">
                            <div>
                              <p className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight">{formatCurrency(service.price)}</p>
                              <p className="text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-wider sm:tracking-widest mt-0.5 sm:mt-1">{service.duration} min</p>
                            </div>
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-neutral-50 flex items-center justify-center group-hover:bg-rose-600 transition-colors">
                              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Account Benefits Banner */}
                  {!user && (
                    <div className="bg-gradient-to-r from-rose-600 to-rose-700 rounded-[32px] p-8 text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20" />
                      <div className="relative">
                        <div className="flex items-start gap-4 mb-6">
                          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-xl font-black uppercase tracking-tight mb-1">¡Únete a Amor Amar!</h3>
                            <p className="text-white/80 text-sm font-medium">Crea tu cuenta gratis y disfruta de beneficios exclusivos</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-white/80" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs font-bold uppercase tracking-widest">Gestiona tus citas</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-white/80" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs font-bold uppercase tracking-widest">Acumula puntos</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-white/80" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs font-bold uppercase tracking-widest">Ofertas VIP</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-white/80" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs font-bold uppercase tracking-widest">Historial completo</span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={() => openAuthModal('signup')}
                            className="flex-1 px-6 py-4 bg-white text-rose-600 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-neutral-100 transition-all flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                            Crear Cuenta Gratis
                          </button>
                          <button
                            onClick={() => openAuthModal('login')}
                            className="px-6 py-4 bg-white/20 text-white font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-white/30 transition-all"
                          >
                            Ya tengo cuenta
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Logged-in user welcome */}
                  {user && (
                    <div className="bg-emerald-50 rounded-[24px] p-6 border border-emerald-100">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-black text-emerald-800 uppercase tracking-tight">
                            ¡Hola, {user.firstName || user.email?.split('@')[0]}!
                          </p>
                          <p className="text-sm text-emerald-600">Tu reserva se guardará en tu cuenta automáticamente</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Contact Info & Employee */}
              {bookingStep === 2 && selectedService && (
                <div className="max-w-2xl mx-auto space-y-8">
                  {/* Selected Service Summary */}
                  <div className="bg-gradient-to-r from-neutral-800 to-rose-900 rounded-[24px] p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">Servicio seleccionado</p>
                        <p className="text-xl font-black uppercase tracking-tight">{selectedService.serviceName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black">{formatCurrency(selectedService.price)}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">{selectedService.duration} min</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-neutral-800 uppercase tracking-tight mb-2">Tus Datos</h2>
                    <p className="text-neutral-500 font-medium">Cuéntanos cómo contactarte</p>
                  </div>

                  {/* Smart Login Prompt - Non-intrusive */}
                  {!user && (
                    <div className="bg-gradient-to-r from-rose-50 to-amber-50 border-2 border-rose-200 rounded-[24px] p-4 sm:p-6 mb-6">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-rose-600 flex items-center justify-center">
                          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm sm:text-base font-black text-neutral-900 mb-1">¿Ya tienes cuenta? Reserva en segundos</p>
                          <p className="text-xs sm:text-sm text-neutral-600 font-medium mb-3">
                            Inicia sesión y rellenaremos todo automáticamente. O continúa como invitado.
                          </p>
                          <div className="flex flex-col xs:flex-row gap-2">
                            <button
                              onClick={() => openAuthModal('login')}
                              className="px-4 py-2.5 bg-neutral-900 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-rose-600 transition-all"
                            >
                              Ya tengo cuenta
                            </button>
                            <button
                              onClick={() => openAuthModal('signup')}
                              className="px-4 py-2.5 border-2 border-neutral-900 text-neutral-900 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-neutral-900 hover:text-white transition-all"
                            >
                              Crear cuenta gratis
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Tu Nombre</label>
                      <input 
                        value={formData.name} 
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                        placeholder="María García" 
                        className="w-full px-6 py-4 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-800 font-bold focus:border-rose-500 transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Tu Email</label>
                      <input 
                        type="email" 
                        value={formData.email} 
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                        placeholder="tu@email.com" 
                        className="w-full px-6 py-4 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-800 font-bold focus:border-rose-500 transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Tu Teléfono</label>
                      <input 
                        type="tel" 
                        value={formData.phone} 
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                        placeholder="+34 600 000 000" 
                        className="w-full px-6 py-4 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-800 font-bold focus:border-rose-500 transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Employee Selection */}
                  {serviceEmployees.length > 1 && (
                    <div className="pt-6 border-t border-neutral-100">
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">Elige Tu Profesional</label>
                      {serviceEmployees.length === 0 ? (
                        <div className="p-8 bg-neutral-50 rounded-2xl text-center">
                          <div className="w-3 h-3 rounded-full bg-rose-600 animate-ping mx-auto mb-4" />
                          <p className="text-neutral-500 font-medium">Cargando profesionales...</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {serviceEmployees.map((emp) => (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => setFormData({ ...formData, employeeId: emp.id })}
                              className={cn(
                                "p-4 rounded-[24px] text-left transition-all border-2 flex items-center gap-4 relative overflow-hidden",
                                formData.employeeId === emp.id
                                  ? "border-rose-600 bg-rose-50/50 shadow-lg"
                                  : "border-neutral-100 bg-white hover:border-rose-200 hover:shadow-md"
                              )}
                            >
                              {/* Checkmark for selected */}
                              {formData.employeeId === emp.id && (
                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-rose-600 flex items-center justify-center z-10">
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              
                              {/* Therapist Photo - Small and Round */}
                              <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-neutral-100 to-neutral-200 flex-shrink-0 border-2 border-white shadow-sm">
                                {emp.profileImage ? (
                                  <Image
                                    src={emp.profileImage}
                                    alt={`${emp.firstName} ${emp.lastName}`}
                                    fill
                                    className="object-cover"
                                    sizes="64px"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white font-black text-xl">
                                    {emp.firstName[0]}{emp.lastName[0]}
                                  </div>
                                )}
                              </div>
                              
                              {/* Therapist Info */}
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-neutral-900 uppercase tracking-tight truncate">
                                  {emp.firstName} {emp.lastName}
                                </p>
                                {emp.position && (
                                  <p className="text-[9px] font-bold text-rose-600 uppercase tracking-widest truncate">{emp.position}</p>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Summary if only one therapist */}
                  {serviceEmployees.length === 1 && (
                    <div className="pt-6 border-t border-neutral-100">
                      <div className="p-4 bg-neutral-50 rounded-[24px] flex items-center gap-4 border border-neutral-100">
                        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-white shadow-sm flex-shrink-0">
                          {serviceEmployees[0].profileImage ? (
                            <Image src={serviceEmployees[0].profileImage} alt="" fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full bg-rose-600 text-white flex items-center justify-center font-black text-xs">
                              {serviceEmployees[0].firstName[0]}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">Profesional asignado</p>
                          <p className="font-black text-neutral-900 uppercase tracking-tight">{serviceEmployees[0].firstName} {serviceEmployees[0].lastName}</p>
                        </div>
                        <div className="ml-auto w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                          <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Date & Time */}
              {bookingStep === 3 && selectedService && (
                <div className="max-w-2xl mx-auto space-y-8">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-neutral-800 uppercase tracking-tight">Fecha y Hora</h2>
                  </div>

                  <div>
                    {formData.employeeId && selectedService?.id ? (
                      <AvailabilityCalendar
                        selectedDate={formData.date}
                        onDateSelect={(date) => setFormData({ ...formData, date, time: '' })}
                        employeeId={formData.employeeId}
                        serviceId={selectedService.id}
                        minDate={new Date().toISOString().split('T')[0]}
                        isConsultation={false}
                      />
                    ) : (
                      <div className="p-8 bg-neutral-50 rounded-2xl text-center border-2 border-dashed border-neutral-200">
                        <p className="text-neutral-400 font-bold">Selecciona un empleado primero</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">Selecciona Hora</label>
                    {!formData.date ? (
                      <div className="p-8 bg-neutral-50 rounded-2xl text-center border-2 border-dashed border-neutral-200">
                        <p className="text-neutral-400 font-bold">Primero elige una fecha</p>
                      </div>
                    ) : loadingSlots ? (
                      <div className="p-8 bg-neutral-50 rounded-2xl text-center">
                        <div className="w-3 h-3 rounded-full bg-rose-600 animate-ping mx-auto mb-4" />
                        <p className="text-neutral-500 font-medium">Buscando horarios...</p>
                      </div>
                    ) : slotsError ? (
                      <div className="p-8 bg-amber-50 rounded-2xl text-center border border-amber-200">
                        <p className="text-amber-700 font-bold">{slotsError}</p>
                        <p className="text-amber-600 text-sm mt-2">Prueba con otra fecha</p>
                      </div>
                    ) : availableSlots.filter(s => s.available).length === 0 ? (
                      <div className="p-8 bg-neutral-50 rounded-2xl text-center border border-neutral-200">
                        <p className="text-neutral-700 font-bold">Sin horarios disponibles</p>
                        <p className="text-neutral-500 text-sm mt-2">Prueba con otra fecha</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
                        {availableSlots.filter(s => s.available).map((slot) => (
                          <button
                            key={slot.time}
                            onClick={() => setFormData({ ...formData, time: slot.time })}
                            className={cn(
                              "py-4 text-sm font-black rounded-xl transition-all",
                              formData.time === slot.time
                                ? "bg-rose-600 text-white shadow-xl shadow-rose-200"
                                : "bg-white border-2 border-neutral-100 text-neutral-600 hover:border-rose-300 hover:text-rose-600"
                            )}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Payment & Confirmation */}
              {bookingStep === 4 && selectedService && (
                <div className="max-w-2xl mx-auto space-y-8">
                  {bookingSuccess ? (
                    <div className="text-center py-12">
                      <div className="w-24 h-24 bg-emerald-50 rounded-[32px] flex items-center justify-center mx-auto mb-8">
                        <svg className="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h2 className="text-3xl font-black text-neutral-800 uppercase tracking-tight mb-4">¡Reserva Confirmada!</h2>
                      <p className="text-neutral-500 font-medium mb-8 max-w-md mx-auto">
                        Hemos enviado un email de confirmación a {formData.email}. ¡Te esperamos!
                      </p>
                      
                      <div className="bg-neutral-50 rounded-[24px] p-8 mb-8 text-left">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Servicio</p>
                            <p className="font-bold text-neutral-800">{selectedService.serviceName}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Profesional</p>
                            <p className="font-bold text-neutral-800">
                              {serviceEmployees.find(e => e.id === formData.employeeId)?.firstName}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Fecha</p>
                            <p className="font-bold text-neutral-800">{formatDisplayDate(formData.date)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Hora</p>
                            <p className="font-bold text-neutral-800">{formData.time}</p>
                          </div>
                        </div>
                      </div>

                      {/* Encourage account creation */}
                      {!user ? (
                        <div className="bg-gradient-to-r from-rose-600 to-rose-700 rounded-[24px] p-8 text-white mb-8">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <p className="font-black uppercase tracking-tight">¡No pierdas tu reserva!</p>
                              <p className="text-white/80 text-sm">Crea tu cuenta para gestionar y modificar tus citas</p>
                            </div>
                          </div>
                          <button
                            onClick={() => openAuthModal('signup')}
                            className="w-full px-6 py-4 bg-white text-rose-600 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-neutral-100 transition-all flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                            Crear Mi Cuenta Ahora
                          </button>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 rounded-[24px] p-6 border border-emerald-100 mb-8">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <p className="font-black text-emerald-800 uppercase tracking-tight">Reserva guardada en tu cuenta</p>
                              <p className="text-sm text-emerald-600">Puedes verla y gestionarla desde "Mis Citas"</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        {user ? (
                          <Link
                            href="/client/bookings"
                            className="px-8 py-4 bg-rose-600 text-white font-bold uppercase tracking-widest rounded-2xl hover:bg-neutral-800 transition-all text-center"
                          >
                            Ver Mis Citas
                          </Link>
                        ) : (
                          <button
                            onClick={() => openAuthModal('login')}
                            className="px-8 py-4 bg-neutral-100 text-neutral-700 font-bold uppercase tracking-widest rounded-2xl hover:bg-neutral-200 transition-all"
                          >
                            Ya tengo cuenta
                          </button>
                        )}
                        <Link
                          href="/"
                          className="px-8 py-4 bg-neutral-100 text-neutral-700 font-bold uppercase tracking-widest rounded-2xl hover:bg-neutral-200 transition-all text-center"
                        >
                          Volver al inicio
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-center mb-8">
                        <h2 className="text-2xl font-black text-neutral-800 uppercase tracking-tight mb-2">Confirmar y Pagar</h2>
                        <p className="text-neutral-500 font-medium">Revisa tu reserva y completa el pago</p>
                      </div>

                      {/* Booking Summary */}
                      <div className="bg-neutral-50 rounded-[24px] p-8 space-y-4">
                        <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
                          <span className="text-neutral-600 font-medium">Servicio</span>
                          <span className="font-bold text-neutral-800">{selectedService.serviceName}</span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
                          <span className="text-neutral-600 font-medium">Profesional</span>
                          <span className="font-bold text-neutral-800">
                            {serviceEmployees.find(e => e.id === formData.employeeId)?.firstName} {serviceEmployees.find(e => e.id === formData.employeeId)?.lastName}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
                          <span className="text-neutral-600 font-medium">Fecha</span>
                          <span className="font-bold text-neutral-800">{formatDisplayDate(formData.date)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
                          <span className="text-neutral-600 font-medium">Hora</span>
                          <span className="font-bold text-neutral-800">{formData.time}</span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
                          <span className="text-neutral-600 font-medium">Depósito (50%)</span>
                          <span className="font-black text-rose-600 text-lg">{depositDisplay}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-600 font-medium">Restante en salón</span>
                          <span className="font-bold text-neutral-800">{formatCurrency(remainingBalance)}</span>
                        </div>
                      </div>

                      {/* Payment Form */}
                      <div className="bg-white rounded-[24px] p-8 border-2 border-neutral-100 space-y-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="font-bold text-neutral-800">Datos de pago</p>
                            <p className="text-sm text-neutral-500">Pago seguro con tarjeta</p>
                          </div>
                          <div className="flex gap-2">
                            <div className="w-10 h-6 bg-neutral-100 rounded flex items-center justify-center">
                              <span className="text-[10px] font-bold text-blue-600">VISA</span>
                            </div>
                            <div className="w-10 h-6 bg-neutral-100 rounded flex items-center justify-center">
                              <span className="text-[10px] font-bold text-orange-600">MC</span>
                            </div>
                          </div>
                        </div>

                        {stripePublicKey ? (
                          <div
                            id={cardMountId}
                            className="p-4 border-2 border-neutral-100 rounded-xl bg-neutral-50"
                          />
                        ) : (
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                            Pagos no disponibles. Contacta con soporte.
                          </div>
                        )}

                        {paymentError && (
                          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                            {paymentError}
                          </div>
                        )}

                        <p className="text-xs text-neutral-400 text-center">
                          Al confirmar, aceptas nuestros términos y condiciones.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              {!bookingSuccess && bookingStep > 1 && (
                <div className="max-w-2xl mx-auto mt-8 sm:mt-12 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
                  <button
                    onClick={back}
                    className="flex-1 py-4 sm:py-5 border-2 border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider sm:tracking-widest rounded-xl sm:rounded-2xl hover:bg-neutral-50 active:scale-[0.98] transition-all text-sm sm:text-base"
                  >
                    {bookingStep === 2 ? 'Cambiar' : 'Atrás'}
                  </button>
                  <button
                    onClick={bookingStep === 4 ? handleSubmitBooking : next}
                    disabled={!stepValid || submitting || paymentLoading}
                    className="flex-1 py-4 sm:py-5 bg-rose-600 text-white font-bold uppercase tracking-wider sm:tracking-widest rounded-xl sm:rounded-2xl hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base"
                  >
                    {(submitting || paymentLoading) && (
                      <div className="w-3 h-3 rounded-full bg-white animate-ping" />
                    )}
                    {submitting || paymentLoading
                      ? 'Procesando...'
                      : bookingStep === 4
                        ? `Pagar ${depositDisplay}`
                        : 'Continuar'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Login Modal */}
      <ClientAuthModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleClientLoginSuccess}
        mode={authModalMode}
      />
    </div>
  );
}

