'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { Loading } from '@/shared/components/Loading';
import { ClientAuthModal } from '@/shared/components/ClientAuthModal';
import { formatCurrency } from '@/shared/lib/utils';
import type { Service, Employee, BookingFormData } from '@/shared/lib/types';
import { formatServiceCategory } from '@/shared/lib/serviceCategories';
import { loadStripe, type Stripe, type StripeCardElement, type StripeElements } from '@stripe/stripe-js';

type Step = 1 | 2 | 3 | 4;

type LandingService = {
  id: string;
  name: string;
  description: string;
  price: string;
  priceValue: number;
  duration: string;
  category: string;
  requiresApproval: boolean;
};

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

const TESTIMONIALS = [
  { name: 'Sofia, Italy', text: 'I come back every month. The only place in Ibiza that truly understands wellness. Not just treatments—it feels like family.', service: 'Full Body Massage' },
  { name: 'Elena, Spain', text: 'My skin has never looked better. But what amazes me most is how they remember everything about me.', service: 'Jade Facial' },
  { name: 'Marcus, Germany', text: 'As someone who tried many places, this is the real deal. The difference is the people—they genuinely care.', service: 'Couples Massage' },
  { name: 'Yuki, Japan', text: 'I felt so welcome. The therapist understood exactly what I needed without me saying a word. Pure magic.', service: 'Balayage' },
  { name: 'Lena, Austria', text: 'Finally found a place that respects both luxury AND the human touch. Coming back next week.', service: 'Hair Treatment' },
  { name: 'Pablo, Madrid', text: 'The best €580 I spent in Ibiza. My girlfriend and I felt like we were floating.', service: 'Couples Massage' },
];

const clampStep = (n: number): Step => Math.min(4, Math.max(1, n)) as Step;


function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between py-2.5">
      <span className="text-sm text-neutral-600">{label}</span>
      <span className="text-sm font-medium text-neutral-900">{value || '—'}</span>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [serviceEmployees, setServiceEmployees] = useState<Employee[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState<number | null>(null); // cents
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [showBooking, setShowBooking] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [bookingStep, setBookingStep] = useState<Step>(1);
  const [selectedService, setSelectedService] = useState<LandingService | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '', email: '', phone: '', date: '', time: '', employeeId: '',
  });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const cardElementRef = useRef<StripeCardElement | null>(null);
  const cardMountId = 'landing-card-element';
  const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

  // Check if we're in backoffice mode (client-side only)
  const [isBackofficeMode, setIsBackofficeMode] = useState(false);

  useEffect(() => {
    // Check mode on client side only
    setIsBackofficeMode(typeof window !== 'undefined' && (process.env.NEXT_PUBLIC_APP_MODE === 'backoffice'));
  }, []);

  // Redirect if logged in or if in backoffice mode
  useEffect(() => {
    if (!authLoading) {
      if (user) {
        // If logged in, redirect to appropriate dashboard
        if (user.role === 'owner') {
          router.push('/dashboard');
        } else if (user.role === 'employee') {
          router.push('/employee');
        } else if (user.role === 'client') {
          router.push('/client');
        }
      } else if (isBackofficeMode) {
        // If in backoffice mode and not logged in, redirect to login
        router.push('/login');
      }
    }
  }, [user, authLoading, router, isBackofficeMode]);

  // Fetch services (only those with employees assigned) and all employees
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [servicesRes, employeesRes] = await Promise.all([
          fetch('/api/services?withEmployees=true'),
          fetch('/api/employees'),
        ]);

        const servicesData = await servicesRes.json();
        const employeesData = await employeesRes.json();

        if (servicesData.success) {
          // Only show active services that have employees assigned
          setServices(servicesData.data.filter((s: Service) => s.isActive));
        }
        if (employeesData.success) {
          // Store all employees for team section
          setEmployees(employeesData.data.filter((e: Employee) => e.status === 'active'));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch employees for selected service
  useEffect(() => {
    if (selectedService) {
      const fetchServiceEmployees = async () => {
        try {
          const response = await fetch(`/api/services/${selectedService.id}/employees`);
          const data = await response.json();
          if (data.success) {
            setServiceEmployees(data.data);
            // Reset employee selection if current selection is not available for this service
            if (formData.employeeId && !data.data.find((e: Employee) => e.id === formData.employeeId)) {
              setFormData(prev => ({ ...prev, employeeId: '' }));
            }
          }
        } catch (error) {
          console.error('Error fetching service employees:', error);
        }
      };
      fetchServiceEmployees();
    } else {
      setServiceEmployees([]);
    }
  }, [selectedService]);

  // Fetch available slots when date, service, and employee are selected
  useEffect(() => {
    if (formData.date && selectedService && formData.employeeId) {
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
              setSlotsError('No hay horarios disponibles para esta fecha. El terapeuta no tiene disponibilidad configurada.');
            }
          } else {
            setSlotsError(data.error || 'Error al cargar horarios');
            setAvailableSlots([]);
          }
        } catch (error) {
          console.error('Error fetching slots:', error);
          setSlotsError('Error de conexión al cargar horarios');
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
  }, [formData.date, selectedService, formData.employeeId]);

  // Load Stripe on demand
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

  // Mount card element when we are on the payment step
  useEffect(() => {
    if (!showBooking || bookingStep !== 4) return;
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
  }, [bookingStep, showBooking, cardMountId]);

  // Reset payment intent if the selection changes
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

  const openBooking = (svc?: Service) => {
    resetPaymentState();
    if (svc) {
      const landingService: LandingService = {
        id: svc.id,
        name: svc.serviceName,
        description: svc.description,
        price: formatCurrency(svc.price),
        priceValue: svc.price,
        duration: `${svc.duration} min`,
        category: svc.category,
        requiresApproval: false, // You can add this field to Service type if needed
      };
      setSelectedService(landingService);
      setBookingStep(2);
    } else {
      setSelectedService(null);
      setBookingStep(1);
    }
    setFormData({ name: '', email: '', phone: '', date: '', time: '', employeeId: '' });
    setShowBooking(true);
    setBookingSuccess(false);
  };

  const closeBooking = () => {
    resetPaymentState();
    setShowBooking(false);
    setSelectedService(null);
    setBookingStep(1);
    setFormData({ name: '', email: '', phone: '', date: '', time: '', employeeId: '' });
    setAvailableSlots([]);
    setLoadingSlots(false);
    setSlotsError(null);
  };

  const login = () => {
    setShowLoginModal(true);
  };

  const handleClientLoginSuccess = () => {
    setShowLoginModal(false);
    router.push('/client');
  };

  const next = () => setBookingStep((s) => clampStep(s + 1));
  const back = () => setBookingStep((s) => clampStep(s - 1));

  const stepValid = useMemo<boolean>(() => {
    if (bookingStep === 1) return !!selectedService;
    if (bookingStep === 2) return !!(formData.name && formData.email && formData.phone && formData.employeeId);
    if (bookingStep === 3) return !!(formData.date && formData.time);
    return true;
  }, [bookingStep, selectedService, formData]);

  // If in backoffice mode and not logged in, show loading while redirecting
  // This check must be AFTER all hooks are called
  if (isBackofficeMode && !user && !authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loading size="sm" />
      </div>
    );
  }

  const ensurePaymentIntent = async () => {
    if (clientSecret && paymentIntentId && depositAmount) {
      return { clientSecret, paymentIntentId, amount: depositAmount };
    }

    if (!selectedService) {
      throw new Error('Selecciona un servicio antes de pagar.');
    }

    const response = await fetch('/api/payments/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: selectedService?.id,
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
    } catch (error: any) {
      console.error('Booking error:', error);
      setPaymentError(error.message || 'Error al procesar el pago');
    } finally {
      setSubmitting(false);
      setPaymentLoading(false);
    }
  };

  // Show loading while checking auth or fetching data
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loading text="Cargando..." />
      </div>
    );
  }

  // If user is logged in, they'll be redirected by useEffect
  // But show loading just in case
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loading text="Redirigiendo..." />
      </div>
    );
  }

  // Convert services to landing format
  const landingServices: LandingService[] = services.map((s) => ({
    id: s.id,
    name: s.serviceName,
    description: s.description,
    price: formatCurrency(s.price),
    priceValue: s.price,
    duration: `${s.duration} min`,
    category: formatServiceCategory(s.category),
    requiresApproval: false,
  }));
  const selectedPriceValue = selectedService?.priceValue ?? null;
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

  return (
    <div className="overflow-x-hidden w-full">
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="h-16 flex items-center justify-between">
            <a href="#" className="text-lg font-light tracking-wider text-neutral-900">
              AMOR AMAR
            </a>

            <nav className="hidden md:flex items-center gap-12">
              <a href="#experiences" className="text-sm text-neutral-700 hover:text-rose-600 transition font-light tracking-wide">Experiencias</a>
              <a href="#story" className="text-sm text-neutral-700 hover:text-rose-600 transition font-light tracking-wide">Nuestra Historia</a>
              <a href="#testimonials" className="text-sm text-neutral-700 hover:text-rose-600 transition font-light tracking-wide">Reseñas</a>
              <button
                onClick={login}
                className="px-4 py-2 text-sm text-neutral-600 hover:text-rose-600 font-light border border-neutral-300 hover:border-rose-600 transition"
              >
                INICIAR SESIÓN
              </button>
              <button
                onClick={() => router.push('/book')}
                className="px-6 py-2 bg-rose-700 text-white text-sm font-light tracking-wider hover:bg-rose-800 transition"
              >
                RESERVAR
              </button>
            </nav>

            <button aria-label="Open menu" className="md:hidden text-lg text-neutral-900" onClick={() => setMobileMenuOpen((v) => !v)}>
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-200 bg-white">
            <nav className="mx-auto max-w-7xl px-4 sm:px-8 py-6 flex flex-col gap-4">
              <a onClick={() => setMobileMenuOpen(false)} href="#experiences" className="text-sm text-neutral-700 font-light">Experiencias</a>
              <a onClick={() => setMobileMenuOpen(false)} href="#story" className="text-sm text-neutral-700 font-light">Nuestra Historia</a>
              <a onClick={() => setMobileMenuOpen(false)} href="#testimonials" className="text-sm text-neutral-700 font-light">Reseñas</a>
              <button onClick={login} className="text-sm text-neutral-600 font-light">Iniciar Sesión</button>
              <button onClick={() => { setMobileMenuOpen(false); router.push('/book'); }} className="px-6 py-2 bg-rose-700 text-white text-sm font-light">
                RESERVAR
              </button>
            </nav>
          </div>
        )}
      </header>

      <main className="pt-16">
        {/* Hero Section - Toni & Guy Inspired */}
        <section className="relative w-full h-screen flex items-center justify-center overflow-hidden">
          {/* Hero Background Image */}
          <div className="absolute inset-0">
            <img 
              src="/images/hero/heroImage.webp" 
              alt="Amor & Amar Spa" 
              className="w-full h-full object-cover"
            />
            {/* Dark Overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-900/70 via-neutral-800/60 to-rose-950/70"></div>
          </div>

          {/* Subtle Pattern Overlay */}
          <div className="absolute inset-0 opacity-5 z-[1]">
            <div className="absolute inset-0" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`}}></div>
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-8 w-full">
            <div className="max-w-4xl mx-auto text-center">
              {/* Location Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full mb-6 hover:bg-white/15 transition-colors">
                <svg className="w-4 h-4 text-rose-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                <span className="text-white/90 text-sm font-medium tracking-widest">IBIZA, ESPAÑA</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light tracking-tight mb-6 leading-tight">
                <span className="text-white">BIENVENIDOS A</span>
                <br />
                <span className="text-white">AMOR </span>
                <span className="text-rose-400 text-5xl sm:text-6xl md:text-7xl lg:text-8xl">&</span>
                <span className="text-white"> AMAR</span>
              </h1>

              {/* Tagline */}
              <p className="text-lg sm:text-xl md:text-2xl text-white/90 font-light tracking-wide mb-10">
                Donde la belleza y el lujo se unen
              </p>

              {/* CTA Buttons - Made MUCH more prominent */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
                <button
                  onClick={() => router.push('/book')}
                  className="group relative px-12 py-6 bg-rose-600 text-white text-base sm:text-lg font-bold tracking-widest hover:bg-rose-500 transition-all duration-300 overflow-hidden shadow-2xl hover:shadow-rose-500/60 hover:scale-105 w-full sm:w-auto"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    RESERVA TU CITA
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
                <a 
                  href="#experiences" 
                  className="group px-12 py-6 border-2 border-white/50 text-white text-base sm:text-lg font-bold tracking-widest hover:bg-white hover:border-white hover:text-neutral-900 transition-all duration-300 text-center backdrop-blur-sm hover:scale-105 w-full sm:w-auto"
                >
                  <span className="group-hover:text-neutral-900 transition-colors flex items-center justify-center gap-2">
                    DESCUBRE MÁS
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </a>
              </div>

              {/* Description - Moved below buttons */}
              <p className="text-sm sm:text-base text-white/60 font-light leading-relaxed max-w-2xl mx-auto">
                Inspirados por la esencia de Ibiza, cada uno de nuestros tratamientos expresa una visión de cuidado personalizada.
              </p>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-2">
              <div className="w-1 h-3 bg-white/60 rounded-full animate-pulse"></div>
            </div>
          </div>
        </section>

        {/* Recognition Banner */}
        <section className="bg-white border-y border-neutral-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-8 py-16">
            <div className="text-center">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-rose-50 to-rose-100/50 rounded-full border border-rose-200 mb-4">
                <svg className="w-6 h-6 text-rose-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                <span className="text-sm font-semibold text-rose-800 tracking-wider">EXCELENCIA EN BELLEZA</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-neutral-900 mb-4">
                Reconocidos por nuestra dedicación al cuidado excepcional
              </h2>
              <p className="text-lg text-neutral-600 font-light max-w-3xl mx-auto">
                En <strong className="font-medium">Amor Amar</strong>, cada tratamiento es una experiencia transformadora, 
                diseñada con precisión y ejecutada con cuidado por terapeutas altamente cualificados.
              </p>
            </div>
          </div>
        </section>

        {/* Founder Story */}
        <section id="story" className="py-32 md:py-48 bg-neutral-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="mb-8 h-1 w-20 bg-rose-700" />
                
                <h2 className="text-6xl md:text-7xl font-light tracking-tight text-neutral-900 mb-8">
                  Por qué<br />Amor Amar
                </h2>

                <p className="text-lg text-neutral-700 font-light leading-relaxed mb-6">
                  Soy terapeuta. Llegué a Ibiza hace años y noté algo: un lugar tan hermoso, tan lleno de personas hermosas, merecía algo más. No solo tratamientos, sino cuidado real. El tipo que cambia cómo te sientes.
                </p>

                <p className="text-lg text-neutral-700 font-light leading-relaxed mb-6">
                  Vi a personas llegar tensas, cargando el peso del mundo. Y las vi irse transformadas. Ligeras. Cuidadas. Ahí supe que esto tenía que existir.
                </p>

                <p className="text-lg text-neutral-700 font-light leading-relaxed mb-12">
                  Cada tratamiento en Amor Amar se basa en un principio: mereces cuidado genuino. No apresurado. No corporativo. No olvidable. Cuidado que realmente importa, porque tú importas.
                </p>

                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="text-2xl">💚</div>
                    <div>
                      <p className="font-medium text-neutral-900 mb-1">Cuidado Genuino</p>
                      <p className="text-sm text-neutral-600 font-light">Te recordamos. Tus preferencias. Tu historia. Atención personal, siempre.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-2xl">✨</div>
                    <div>
                      <p className="font-medium text-neutral-900 mb-1">Creado por Expertos</p>
                      <p className="text-sm text-neutral-600 font-light">Años de formación. Técnicas precisas. Cada detalle importa.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-2xl">🏡</div>
                    <div>
                      <p className="font-medium text-neutral-900 mb-1">Un Espacio Que Se Siente Bien</p>
                      <p className="text-sm text-neutral-600 font-light">Calma. Reflexivo. Seguro. Diseñado para tu restauración completa.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="aspect-square bg-rose-100 border-2 border-rose-200 overflow-hidden">
                  <img 
                    src="/images/hero/FounderImage.jpg" 
                    alt="Fundador de Amor Amar" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/20 to-transparent" />
                </div>
                <div className="absolute -bottom-6 -right-6 bg-white border-2 border-rose-700 p-6 max-w-sm shadow-xl">
                  <p className="text-sm font-light text-neutral-700 italic mb-3">"El lujo no es lo que te rodea. Es qué tan profundamente te cuidan."</p>
                  <p className="font-light text-neutral-900">— Amor Amar</p>
                  <p className="text-xs text-neutral-500 mt-1">Fundador & Terapeuta</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-32 md:py-48 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="mb-16">
              <div className="mb-6 h-1 w-20 bg-rose-700" />
              <h2 className="text-6xl md:text-7xl font-light tracking-tight text-neutral-900 mb-6">
                Lo Que Dicen<br />Los Invitados
              </h2>
              <p className="text-lg text-neutral-700 font-light max-w-2xl">
                Personas reales. Experiencias reales. Transformación real.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {TESTIMONIALS.map((testimonial, idx) => (
                <div key={idx} className="bg-neutral-50 border-l-4 border-rose-700 p-8 hover:shadow-lg transition">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium text-neutral-900">{testimonial.name}</p>
                    <p className="text-xs text-rose-700 font-light tracking-widest">{testimonial.service}</p>
                  </div>
                  <p className="text-neutral-700 font-light leading-relaxed mb-4">"{testimonial.text}"</p>
                  <div className="text-rose-700">★★★★★</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Experiences */}
        <section id="experiences" className="py-32 md:py-48 bg-neutral-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="mb-24">
              <div className="mb-6 h-1 w-20 bg-rose-700" />
              <h2 className="text-6xl md:text-7xl font-light tracking-tight text-neutral-900 mb-8">
                Experiencias
              </h2>
              <p className="text-lg text-neutral-700 font-light max-w-2xl leading-relaxed">
                Cada tratamiento está cuidadosamente diseñado. No apresurado. No de talla única. Creado para ti.
              </p>
            </div>

            {landingServices.length === 0 ? (
              <p className="text-neutral-600 font-light">No hay servicios disponibles en este momento.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {landingServices.map((svc) => (
                  <button
                    key={svc.id}
                    onClick={() => router.push(`/book/${svc.id}`)}
                    className="group text-left bg-white border-2 border-neutral-200 p-8 hover:border-rose-700 hover:shadow-xl transition duration-300 relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 h-1 w-0 bg-rose-700 group-hover:w-full transition-all duration-300" />
                    
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-light text-neutral-900 tracking-wide mb-2 group-hover:text-rose-700 transition">{svc.name}</h3>
                        <p className="text-xs tracking-widest text-neutral-600 uppercase">{svc.category}</p>
                      </div>
                    </div>
                    
                    <p className="text-sm text-neutral-700 font-light leading-relaxed mb-6 line-clamp-3">{svc.description}</p>
                    
                    <div className="flex items-baseline justify-between pt-6 border-t border-neutral-200">
                      <div className="text-right">
                        <div className="text-2xl font-light text-rose-700">{svc.price}</div>
                        <div className="text-xs text-neutral-600 mt-1 font-light">{svc.duration}</div>
                      </div>
                      {svc.requiresApproval && (
                        <span className="text-xs tracking-widest text-rose-700 uppercase font-light">Bespoke</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Team */}
        <section className="py-32 md:py-48 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="mb-24">
              <div className="mb-6 h-1 w-20 bg-rose-700" />
              <h2 className="text-6xl md:text-7xl font-light tracking-tight text-neutral-900 mb-8">
                Conoce al Equipo
              </h2>
              <p className="text-lg text-neutral-700 font-light max-w-2xl">
                Las personas detrás de tu experiencia. Entrenadas. Reflexivas. Dedicadas a tu cuidado.
              </p>
            </div>

            {employees.length === 0 ? (
              <p className="text-neutral-600 font-light">No hay empleados disponibles en este momento.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                {employees.map((member, idx) => (
                  <div key={member.id} className="text-center">
                    <div className="aspect-square bg-rose-100 border-2 border-rose-200 mb-6 overflow-hidden rounded-full mx-auto max-w-[200px]">
                      {member.profileImage ? (
                        <img src={member.profileImage} alt={member.firstName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl text-rose-700">
                          {member.firstName[0]}{member.lastName[0]}
                        </div>
                      )}
                    </div>
                    <h3 className="text-2xl font-light text-neutral-900 mb-2">{member.firstName} {member.lastName}</h3>
                    <p className="text-sm text-rose-700 font-light tracking-widest uppercase mb-4">Terapeuta</p>
                    <p className="text-neutral-700 font-light leading-relaxed">{member.bio || 'Experto en belleza y cuidado personal.'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 md:py-48 bg-rose-700 text-white">
          <div className="mx-auto max-w-4xl px-4 sm:px-8 text-center">
            <h2 className="text-6xl md:text-7xl font-light tracking-tight mb-8">
              Listo para Sentirlo
            </h2>
            <p className="text-xl text-white/90 font-light mb-12 max-w-2xl mx-auto leading-relaxed">
              Sabes cuando algo es realmente correcto. Esto es eso.
            </p>
            <button
              onClick={() => router.push('/book')}
              className="px-10 py-4 bg-white text-rose-700 font-light tracking-wider hover:shadow-xl transition text-sm"
            >
              RESERVA TU EXPERIENCIA
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-neutral-900 text-neutral-300">
          <div className="mx-auto max-w-7xl px-4 sm:px-8 py-16">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
              <div>
                <h3 className="text-sm font-light tracking-widest text-white uppercase mb-4">Amor Amar</h3>
                <p className="text-sm text-neutral-400 font-light">Bienestar en Ibiza. Cuidado. Precisión. Transformación.</p>
              </div>
              <div>
                <h4 className="text-sm font-light tracking-widest text-white uppercase mb-4">Tratamientos</h4>
                <ul className="space-y-2 text-sm text-neutral-400 font-light">
                  <li><a href="#experiences" className="hover:text-rose-400 transition">Todas las Experiencias</a></li>
                  <li><a href="#experiences" className="hover:text-rose-400 transition">Para Parejas</a></li>
                  <li><a href="#experiences" className="hover:text-rose-400 transition">Spa</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-light tracking-widest text-white uppercase mb-4">Empresa</h4>
                <ul className="space-y-2 text-sm text-neutral-400 font-light">
                  <li><a href="#story" className="hover:text-rose-400 transition">Nuestra Historia</a></li>
                  <li><a href="#testimonials" className="hover:text-rose-400 transition">Reseñas</a></li>
                  <li><a href="#" className="hover:text-rose-400 transition">Tarjetas Regalo</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-light tracking-widest text-white uppercase mb-4">Conectar</h4>
                <ul className="space-y-2 text-sm text-neutral-400 font-light">
                  <li><a href="#" className="hover:text-rose-400 transition">Instagram</a></li>
                  <li><a href="#" className="hover:text-rose-400 transition">Contacto</a></li>
                  <li><a href="#" className="hover:text-rose-400 transition">WhatsApp</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-neutral-700 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-neutral-500 font-light">
              <p>&copy; 2024 Amor Amar. Creado con cuidado para Ibiza.</p>
              <div className="flex gap-8 mt-6 md:mt-0">
                <a href="#" className="hover:text-rose-400 transition">Privacidad</a>
                <a href="#" className="hover:text-rose-400 transition">Términos</a>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* Client Authentication Modal */}
      <ClientAuthModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleClientLoginSuccess}
        mode="login"
      />

      {/* Booking Modal */}
      {showBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] sm:rounded-lg overflow-hidden">
            
            <div className="sticky top-0 bg-rose-50 px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between border-b border-rose-200">
              <div>
                <p className="text-xs tracking-widest text-rose-700 uppercase font-medium">Reserva de Experiencia</p>
                <p className="text-xs sm:text-sm text-neutral-700 mt-1 font-light">Paso {bookingStep} de 4</p>
              </div>
              <button aria-label="Close" onClick={closeBooking} className="text-2xl text-neutral-400 hover:text-neutral-600 transition min-w-[44px] min-h-[44px] flex items-center justify-center">✕</button>
            </div>

            <div className="h-1 bg-rose-200">
              <div className="h-full bg-rose-700 transition-all duration-300" style={{ width: `${(bookingStep/4)*100}%` }} />
            </div>

            <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6 max-h-[calc(90vh-180px)] overflow-y-auto flex-1">

              {!user && (
                <div className="p-4 sm:p-5 rounded-2xl border border-rose-100 bg-rose-50/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">Reserva más rápido</p>
                    <p className="text-xs text-neutral-600">
                      Inicia sesión y completaremos tus datos. Solo un click para confirmar.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={login}
                      className="px-4 py-2 rounded-xl border border-rose-200 text-[11px] font-bold uppercase tracking-[0.18em] text-rose-700 hover:bg-rose-600 hover:text-white transition-all"
                    >
                      Ya tengo cuenta
                    </button>
                    <button
                      onClick={login}
                      className="px-4 py-2 rounded-xl bg-rose-700 text-white text-[11px] font-bold uppercase tracking-[0.18em] hover:brightness-95 transition-all"
                    >
                      Crear cuenta
                    </button>
                  </div>
                </div>
              )}
              
              {bookingStep === 1 && (
                <div>
                  <p className="text-sm font-light text-neutral-900 mb-6 tracking-wide">¿Qué tratamiento te llama?</p>
                  {landingServices.length === 0 ? (
                    <p className="text-neutral-600 font-light">No hay servicios disponibles.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {landingServices.map((svc) => (
                        <button
                          key={svc.id}
                          onClick={() => {
                            const fullService = services.find(s => s.id === svc.id);
                            if (fullService) openBooking(fullService);
                          }}
                          className={`p-4 border-2 text-left transition ${selectedService?.id === svc.id ? 'border-rose-700 bg-rose-50' : 'border-rose-200/50 bg-white hover:border-rose-400'}`}
                        >
                          <h4 className="font-light text-sm text-neutral-900 mb-1">{svc.name}</h4>
                          <p className="text-xs text-neutral-600 mb-3 font-light">{svc.duration}</p>
                          <p className="text-lg font-light text-rose-700">{svc.price}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {bookingStep === 2 && (
                <div className="space-y-6">
                  <div className="bg-rose-50 p-4 border-2 border-rose-200">
                    <p className="text-sm text-neutral-700 font-light">Elegiste: <span className="font-medium text-neutral-900">{selectedService?.name}</span></p>
                  </div>

                  <div>
                    <label className="block text-sm font-light text-neutral-900 mb-2">Tu Nombre</label>
                    <input 
                      value={formData.name} 
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                      placeholder="Tu nombre" 
                      className="w-full border-2 border-rose-200 px-4 py-3 text-sm focus:outline-none focus:border-rose-700 transition font-light" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-light text-neutral-900 mb-2">Tu Correo</label>
                    <input 
                      type="email" 
                      value={formData.email} 
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                      placeholder="tu@correo.com" 
                      className="w-full border-2 border-rose-200 px-4 py-3 text-sm focus:outline-none focus:border-rose-700 transition font-light" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-light text-neutral-900 mb-2">Tu Teléfono</label>
                    <input 
                      type="tel" 
                      value={formData.phone} 
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                      placeholder="+34 600 000000" 
                      className="w-full border-2 border-rose-200 px-4 py-3 text-sm focus:outline-none focus:border-rose-700 transition font-light" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-light text-neutral-900 mb-3">Selecciona tu Terapeuta</label>
                    {serviceEmployees.length === 0 ? (
                      <p className="text-neutral-600 font-light text-sm">
                        {selectedService ? 'Cargando terapeutas disponibles...' : 'Primero selecciona un servicio'}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {serviceEmployees.map((emp) => (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, employeeId: emp.id })}
                            className={`p-4 border-2 rounded-lg transition text-left ${
                              formData.employeeId === emp.id
                                ? 'border-rose-600 bg-rose-50'
                                : 'border-rose-200 bg-white hover:border-rose-400'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {emp.profileImage ? (
                                <img
                                  src={emp.profileImage}
                                  alt={`${emp.firstName} ${emp.lastName}`}
                                  className="w-12 h-12 rounded-full object-cover border-2 border-rose-300"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white font-semibold">
                                  {emp.firstName[0]}{emp.lastName[0]}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-primary-900">
                                  {emp.firstName} {emp.lastName}
                                </p>
                                {emp.position && (
                                  <p className="text-xs text-primary-600">{emp.position}</p>
                                )}
                              </div>
                              {formData.employeeId === emp.id && (
                                <svg className="w-5 h-5 text-rose-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            {emp.bio && (
                              <p className="text-xs text-primary-600 mt-2 line-clamp-2">{emp.bio}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {bookingStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-light text-neutral-900 mb-2">¿Qué día?</label>
                    <input 
                      type="date" 
                      value={formData.date} 
                      onChange={(e) => setFormData({ ...formData, date: e.target.value, time: '' })} 
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full border-2 border-rose-200 px-4 py-3 text-sm focus:outline-none focus:border-rose-700 transition font-light rounded-lg" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-light text-neutral-900 mb-3">¿Qué hora?</label>
                    {!formData.date || !selectedService || !formData.employeeId ? (
                      <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg text-center">
                        <p className="text-sm text-neutral-600 font-light">Selecciona una fecha para ver los horarios disponibles</p>
                      </div>
                    ) : loadingSlots ? (
                      <div className="flex flex-col items-center gap-3 py-8">
                        <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-neutral-600 font-light">Buscando horarios disponibles...</p>
                      </div>
                    ) : slotsError ? (
                      <div className="p-5 bg-amber-50 border border-amber-200 rounded-lg text-center">
                        <div className="w-12 h-12 mx-auto mb-3 bg-amber-100 rounded-full flex items-center justify-center">
                          <span className="text-2xl">📅</span>
                        </div>
                        <p className="text-sm text-amber-800 font-medium">{slotsError}</p>
                        <p className="text-xs text-amber-600 mt-2">Prueba seleccionando otra fecha</p>
                      </div>
                    ) : availableSlots.filter(slot => slot.available).length === 0 ? (
                      <div className="p-5 bg-neutral-50 border border-neutral-200 rounded-lg text-center">
                        <div className="w-12 h-12 mx-auto mb-3 bg-neutral-100 rounded-full flex items-center justify-center">
                          <span className="text-2xl">⏰</span>
                        </div>
                        <p className="text-sm text-neutral-700 font-medium">Sin horarios disponibles</p>
                        <p className="text-xs text-neutral-500 mt-2">Todos los horarios están ocupados. Prueba con otra fecha.</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-rose-600 mb-3">
                          ✓ {availableSlots.filter(s => s.available).length} horarios disponibles
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {availableSlots.filter(slot => slot.available).map((slot) => (
                            <button
                              key={slot.time}
                              onClick={() => setFormData({ ...formData, time: slot.time })}
                              className={`py-3 text-sm font-medium rounded-lg transition-all ${
                                formData.time === slot.time
                                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/30 scale-105'
                                  : 'bg-white border border-rose-200 text-rose-800 hover:border-rose-400 hover:bg-rose-50'
                              }`}
                            >
                              {slot.time}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {bookingStep === 4 && (
                <div className="space-y-6">
                  {bookingSuccess ? (
                    <>
                      <div className="bg-rose-50 p-6 border-2 border-rose-200 space-y-3">
                        <Row label="Tratamiento" value={selectedService?.name} />
                        <Row label="Fecha" value={formData.date} />
                        <Row label="Hora" value={formData.time} />
                        <Row label="Terapeuta" value={employees.find(e => e.id === formData.employeeId)?.firstName + ' ' + employees.find(e => e.id === formData.employeeId)?.lastName} />
                        <div className="flex justify-between pt-4 border-t border-rose-300 font-light">
                          <span className="text-neutral-900">Precio</span>
                          <span className="text-rose-700 text-lg font-medium">{selectedService?.price ?? '—'}</span>
                        </div>
                      </div>

                      <div className="border-2 border-rose-700 bg-white p-6 text-center">
                        <p className="text-lg font-light text-neutral-900 mb-1">¡Hermoso! ✨</p>
                        <p className="text-sm text-neutral-700 font-light">Tu reserva está confirmada. No podemos esperar a cuidarte.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-rose-50 p-6 border-2 border-rose-200 space-y-3">
                        <Row label="Tratamiento" value={selectedService?.name} />
                        <Row label="Fecha" value={formData.date} />
                        <Row label="Hora" value={formData.time} />
                        <div className="flex justify-between pt-4 border-t border-rose-300 font-light">
                          <span className="text-neutral-900">Depósito (50%)</span>
                          <span className="text-rose-700 text-lg font-medium">{depositDisplay ?? '—'}</span>
                        </div>
                        <div className="flex justify-between font-light">
                          <span className="text-neutral-900">Restante en salón</span>
                          <span className="text-neutral-700 text-lg font-medium">
                            {remainingBalance !== null ? formatCurrency(remainingBalance) : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between font-light">
                          <span className="text-neutral-900">Total</span>
                          <span className="text-rose-700 text-lg font-medium">{selectedService?.price ?? '—'}</span>
                        </div>
                      </div>

                      <div className="p-6 border-2 border-neutral-200 rounded-2xl bg-white space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-neutral-900">Paga el depósito ahora</p>
                            <p className="text-xs text-neutral-500">Cobramos el 50% para confirmar. El resto lo abonas en el salón.</p>
                          </div>
                          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-700">
                            Seguro
                          </span>
                        </div>

                        {stripePublicKey ? (
                          <div
                            id={cardMountId}
                            className="p-4 border-2 border-neutral-200 rounded-xl bg-neutral-50"
                          />
                        ) : (
                          <div className="p-4 border-2 border-amber-200 rounded-xl bg-amber-50 text-amber-800 text-sm">
                            Falta la clave pública de Stripe. Contacta con soporte para habilitar pagos.
                          </div>
                        )}
                        {paymentError && (
                          <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                            {paymentError}
                          </p>
                        )}
                        <p className="text-xs text-neutral-500">
                          Al continuar se realizará un cargo de {depositDisplay ?? '50% del servicio'} para asegurar tu cita.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-rose-50 border-t border-rose-200 px-4 sm:px-8 py-3 sm:py-4 flex gap-2 sm:gap-3">
              {bookingStep > 1 && (
                <button onClick={back} className="flex-1 py-3 sm:py-3 min-h-[48px] border-2 border-rose-200 text-neutral-900 text-sm font-light hover:bg-white transition touch-manipulation">
                  Atrás
                </button>
              )}
                <button
                onClick={async () => {
                  if (bookingStep === 1 && !selectedService) return;
                  if (bookingStep === 4) {
                    if (bookingSuccess) {
                      closeBooking();
                    } else {
                      await handleSubmitBooking();
                    }
                  } else {
                    next();
                  }
                }}
                disabled={!stepValid || submitting || paymentLoading}
                className="flex-1 py-3 sm:py-3 min-h-[48px] bg-rose-700 text-white text-sm font-light hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed transition touch-manipulation"
              >
                {submitting || paymentLoading
                  ? 'Procesando...'
                  : bookingStep === 4
                    ? bookingSuccess
                      ? '✓ Completar'
                      : 'Pagar y confirmar'
                    : 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
