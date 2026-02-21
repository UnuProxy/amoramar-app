'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { useLanguage } from '@/shared/context/LanguageContext';
import { Loading } from '@/shared/components/Loading';
import { ClientAuthModal } from '@/shared/components/ClientAuthModal';
import { BrandLogo } from '@/shared/components/BrandLogo';
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

type MajorGroupKey = 'manicure' | 'pedicure-care' | 'combinations' | 'hair';

const MAJOR_GROUP_ORDER: MajorGroupKey[] = ['manicure', 'pedicure-care', 'combinations', 'hair'];

const getMajorGroupForService = (service: Service): MajorGroupKey => {
  const category = service.category || 'other';
  const name = service.serviceName.toLowerCase();
  if (category === 'manicure' || category === 'nail-art-care-manicure') return 'manicure';
  if (category === 'pedicure-care' || category === 'professional-foot-services' || category === 'foot-sole-treatments') return 'pedicure-care';
  if (category === 'nail-art-care-combinations') return 'combinations';
  if (String(category).startsWith('hair-')) return 'hair';
  if (name.includes('pedicure') || name.includes('foot') || name.includes('sole')) return 'pedicure-care';
  if (name.includes('combo') || name.includes('combin')) return 'combinations';
  if (name.includes('manicure') || name.includes('gel') || name.includes('nail')) return 'manicure';
  return 'hair';
};

const getMajorGroupLabel = (key: MajorGroupKey, isSpanish: boolean): string => {
  if (key === 'manicure') return isSpanish ? 'Manicura' : 'Nails / Manicure';
  if (key === 'pedicure-care') return 'Pedicura & Care';
  if (key === 'combinations') return 'Manicura & Pedicura — Combinaciones / Combinations';
  return 'Hair';
};

const getSubgroupLabel = (service: Service, isSpanish: boolean): string => {
  const category = service.category || 'other';
  const name = service.serviceName.toLowerCase();
  if (category === 'nail-art-care-combinations') {
    return name.includes('sin limpieza') || name.includes('without cleaning')
      ? (isSpanish ? 'Combinaciones sin limpieza de planta' : 'Combinations without sole cleaning')
      : (isSpanish ? 'Combinaciones con limpieza de planta' : 'Combinations with sole cleaning');
  }
  if (category === 'pedicure-care' || category === 'professional-foot-services' || category === 'foot-sole-treatments') {
    return name.includes('sole') || name.includes('planta') || name.includes('peeling') || name.includes('queratol')
      ? (isSpanish ? 'Tratamientos de planta del pie' : 'Sole treatments')
      : (isSpanish ? 'Pedicura uñas' : 'Pedicure nails');
  }
  if (category === 'manicure' || category === 'nail-art-care-manicure') {
    if (name.includes('relleno') || name.includes('refill')) return isSpanish ? 'Relleno con gel' : 'Gel refill';
    if (name.includes('extension')) return isSpanish ? 'Extensiones' : 'Extensions';
    return isSpanish ? 'Manicura' : 'Manicure';
  }
  if (String(category).startsWith('hair-')) {
    if (category === 'hair-haircuts-styling') return isSpanish ? 'Corte y peinado' : 'Haircuts & Styling';
    if (category === 'hair-color') return 'Color';
    if (category === 'hair-bleach-highlights') return isSpanish ? 'Decoloración y mechas' : 'Bleach & Highlights';
    if (category === 'hair-treatments-signature') return isSpanish ? 'Tratamientos & Signature' : 'Treatments & Signature';
    if (category === 'hair-men') return isSpanish ? 'Servicios para hombre' : "Men's Services";
    if (category === 'hair-kids') return isSpanish ? 'Cortes infantiles' : 'Kids Cuts';
    if (category === 'hair-extensions') return isSpanish ? 'Extensiones' : 'Extensions';
  }
  return isSpanish ? 'Servicios' : 'Services';
};

const isOnlineBookingRestricted = (service: Service): boolean => {
  return service.category === 'hair-bleach-highlights';
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
  const { language } = useLanguage();
  const isSpanish = language === 'es';
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
  const [selectedMajorGroup, setSelectedMajorGroup] = useState<MajorGroupKey | null>(null);
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

  const copy = {
    navExperiences: isSpanish ? 'Experiencias' : 'Experiences',
    navStory: isSpanish ? 'Nuestra Historia' : 'Our Story',
    navReviews: isSpanish ? 'Reseñas' : 'Reviews',
    navLogin: isSpanish ? 'INICIAR SESIÓN' : 'LOG IN',
    navBook: isSpanish ? 'RESERVAR' : 'BOOK',
    heroLocation: isSpanish ? 'IBIZA, ESPAÑA' : 'IBIZA, SPAIN',
    heroWelcome: isSpanish ? 'BIENVENIDOS A' : 'WELCOME TO',
    heroTagline: isSpanish ? 'Donde la belleza y el lujo se unen' : 'Where beauty and luxury meet',
    heroBookCta: isSpanish ? 'RESERVA TU CITA' : 'BOOK YOUR APPOINTMENT',
    heroDiscover: isSpanish ? 'DESCUBRE MÁS' : 'DISCOVER MORE',
    heroDescription: isSpanish
      ? 'Inspirados por la esencia de Ibiza, cada uno de nuestros tratamientos expresa una visión de cuidado personalizada.'
      : 'Inspired by the essence of Ibiza, each treatment reflects a personalized care philosophy.',
    loading: isSpanish ? 'Cargando...' : 'Loading...',
    redirecting: isSpanish ? 'Redirigiendo...' : 'Redirecting...',
    noServicesNow: isSpanish ? 'No hay servicios disponibles en este momento.' : 'No services are available right now.',
    noEmployeesNow: isSpanish ? 'No hay empleados disponibles en este momento.' : 'No team members are available right now.',
    experiencesTitle: isSpanish ? 'Experiencias' : 'Experiences',
    experiencesSubtitle: isSpanish
      ? 'Cada tratamiento está cuidadosamente diseñado. No apresurado. No de talla única. Creado para ti.'
      : 'Every treatment is carefully designed. Never rushed. Never one-size-fits-all. Created for you.',
    teamTitle: isSpanish ? 'Conoce al Equipo' : 'Meet the Team',
    teamSubtitle: isSpanish
      ? 'Las personas detrás de tu experiencia. Entrenadas. Reflexivas. Dedicadas a tu cuidado.'
      : 'The people behind your experience. Skilled. Thoughtful. Dedicated to your care.',
    therapist: isSpanish ? 'Terapeuta' : 'Therapist',
    defaultBio: isSpanish ? 'Experto en belleza y cuidado personal.' : 'Expert in beauty and personal care.',
    bookExperienceTitle: isSpanish ? 'Reserva de Experiencia' : 'Experience Booking',
    stepOf: isSpanish ? 'Paso' : 'Step',
    reserveFaster: isSpanish ? 'Reserva más rápido' : 'Book faster',
    reserveFasterDesc: isSpanish
      ? 'Inicia sesión y completaremos tus datos. Solo un click para confirmar.'
      : 'Log in and we will prefill your details. Just one click to confirm.',
    iHaveAccount: isSpanish ? 'Ya tengo cuenta' : 'I have an account',
    createAccount: isSpanish ? 'Crear cuenta' : 'Create account',
    bookingQuestion: isSpanish ? '¿Qué tratamiento te llama?' : 'Which treatment are you looking for?',
    noServices: isSpanish ? 'No hay servicios disponibles.' : 'No services available.',
  };

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
              setSlotsError(
                isSpanish
                  ? 'No hay horarios disponibles para esta fecha. El terapeuta no tiene disponibilidad configurada.'
                  : 'No slots are available for this date. The therapist has no configured availability.'
              );
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
      if (isOnlineBookingRestricted(svc)) {
        alert(
          isSpanish
            ? 'Este servicio requiere consulta previa y no se puede reservar online.'
            : 'This service requires consultation and cannot be booked online.'
        );
        return;
      }
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
      setSelectedMajorGroup(getMajorGroupForService(svc));
      setBookingStep(2);
    } else {
      setSelectedService(null);
      setSelectedMajorGroup(null);
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
    setSelectedMajorGroup(null);
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

  const groupedBookingServices = useMemo(() => {
    const groups = MAJOR_GROUP_ORDER.map((key) => {
      const groupServices = services.filter((service) => getMajorGroupForService(service) === key);
      const subgroupMap = new Map<string, Service[]>();
      groupServices.forEach((service) => {
        const subgroup = getSubgroupLabel(service, isSpanish);
        subgroupMap.set(subgroup, [...(subgroupMap.get(subgroup) || []), service]);
      });
      return {
        key,
        label: getMajorGroupLabel(key, isSpanish),
        services: groupServices,
        subgroups: Array.from(subgroupMap.entries()).map(([label, entries]) => ({
          label,
          services: entries.sort((a, b) => a.serviceName.localeCompare(b.serviceName)),
        })),
      };
    });
    return groups;
  }, [services, isSpanish]);

  const activeMajorGroup = selectedMajorGroup && groupedBookingServices.some((group) => group.key === selectedMajorGroup)
    ? selectedMajorGroup
    : (groupedBookingServices[0]?.key || null);
  const activeMajorGroupData = groupedBookingServices.find((group) => group.key === activeMajorGroup) || null;

  useEffect(() => {
    if (!showBooking) return;
    if (!activeMajorGroup && groupedBookingServices[0]) {
      setSelectedMajorGroup(groupedBookingServices[0].key);
      return;
    }
    if (selectedMajorGroup && !groupedBookingServices.some((group) => group.key === selectedMajorGroup)) {
      setSelectedMajorGroup(groupedBookingServices[0]?.key || null);
    }
  }, [showBooking, activeMajorGroup, groupedBookingServices, selectedMajorGroup]);

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
      throw new Error(isSpanish ? 'Selecciona un servicio antes de pagar.' : 'Select a service before paying.');
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
      throw new Error(result.error || (isSpanish ? 'No se pudo iniciar el pago' : 'Payment could not be started'));
    }

    setClientSecret(result.data.clientSecret);
    setPaymentIntentId(result.data.paymentIntentId);
    setDepositAmount(result.data.amount);
    return result.data as { clientSecret: string; paymentIntentId: string; amount: number };
  };

  const handleSubmitBooking = async () => {
    if (!selectedService || !formData.employeeId) return;
    if (!stripePublicKey) {
      alert(isSpanish ? 'La pasarela de pago no está configurada. Contacta con soporte.' : 'Payment gateway is not configured. Contact support.');
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
        throw new Error(isSpanish ? 'No se pudo inicializar Stripe' : 'Stripe could not be initialized');
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
        throw new Error(isSpanish ? 'El formulario de pago no está listo.' : 'Payment form is not ready.');
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
        throw new Error(error?.message || (isSpanish ? 'El pago no pudo completarse' : 'Payment could not be completed'));
      }
      if (paymentIntent.status !== 'succeeded') {
        throw new Error(isSpanish ? 'El pago no se completó. Inténtalo de nuevo.' : 'Payment was not completed. Try again.');
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
        throw new Error(result.error || (isSpanish ? 'No se pudo crear la reserva' : 'Booking could not be created'));
      }
    } catch (error: any) {
      console.error('Booking error:', error);
      setPaymentError(error.message || (isSpanish ? 'Error al procesar el pago' : 'Error processing payment'));
    } finally {
      setSubmitting(false);
      setPaymentLoading(false);
    }
  };

  // Show loading while checking auth or fetching data
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loading text={copy.loading} />
      </div>
    );
  }

  // If user is logged in, they'll be redirected by useEffect
  // But show loading just in case
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loading text={copy.redirecting} />
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
            <a href="#" className="transition-opacity hover:opacity-80">
              <BrandLogo className="h-11 w-36 sm:h-12 sm:w-40" priority />
            </a>

            <nav className="hidden md:flex items-center gap-12">
              <a href="#experiences" className="text-sm text-neutral-700 hover:text-accent-600 transition font-light tracking-wide">{copy.navExperiences}</a>
              <a href="#story" className="text-sm text-neutral-700 hover:text-accent-600 transition font-light tracking-wide">{copy.navStory}</a>
              <a href="#testimonials" className="text-sm text-neutral-700 hover:text-accent-600 transition font-light tracking-wide">{copy.navReviews}</a>
              <button
                onClick={login}
                className="px-4 py-2 text-sm text-neutral-600 hover:text-accent-600 font-light border border-neutral-300 hover:border-accent-600 transition"
              >
                {copy.navLogin}
              </button>
              <button
                onClick={() => router.push('/book')}
                className="px-6 py-2 bg-accent-700 text-white text-sm font-light tracking-wider hover:bg-accent-800 transition"
              >
                {copy.navBook}
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
              <a onClick={() => setMobileMenuOpen(false)} href="#experiences" className="text-sm text-neutral-700 font-light">{copy.navExperiences}</a>
              <a onClick={() => setMobileMenuOpen(false)} href="#story" className="text-sm text-neutral-700 font-light">{copy.navStory}</a>
              <a onClick={() => setMobileMenuOpen(false)} href="#testimonials" className="text-sm text-neutral-700 font-light">{copy.navReviews}</a>
              <button onClick={login} className="text-sm text-neutral-600 font-light">{copy.navLogin}</button>
              <button onClick={() => { setMobileMenuOpen(false); router.push('/book'); }} className="px-6 py-2 bg-accent-700 text-white text-sm font-light">
                {copy.navBook}
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
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-900/70 via-neutral-800/60 to-accent-900/70"></div>
          </div>

          {/* Subtle Pattern Overlay */}
          <div className="absolute inset-0 opacity-5 z-[1]">
            <div className="absolute inset-0" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`}}></div>
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-8 w-full">
            <div className="max-w-4xl mx-auto text-center">
              {/* Location Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full mb-6 hover:bg-white/15 transition-colors">
                <svg className="w-4 h-4 text-accent-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                <span className="text-white/90 text-sm font-medium tracking-widest">{copy.heroLocation}</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light tracking-tight mb-6 leading-tight">
                <span className="text-white">{copy.heroWelcome}</span>
                <br />
                <span className="text-white">AMOR </span>
                <span className="text-accent-400 text-5xl sm:text-6xl md:text-7xl lg:text-8xl">&</span>
                <span className="text-white"> AMAR</span>
              </h1>

              {/* Tagline */}
              <p className="text-lg sm:text-xl md:text-2xl text-white/90 font-light tracking-wide mb-10">
                {copy.heroTagline}
              </p>

              {/* CTA Buttons - Made MUCH more prominent */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
                <button
                  onClick={() => router.push('/book')}
                  className="group relative px-12 py-6 bg-accent-600 text-white text-base sm:text-lg font-bold tracking-widest hover:bg-accent-500 transition-all duration-300 overflow-hidden shadow-2xl hover:shadow-accent-500/60 hover:scale-105 w-full sm:w-auto"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {copy.heroBookCta}
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-accent-500 to-accent-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
                <a 
                  href="#experiences" 
                  className="group px-12 py-6 border-2 border-white/50 text-white text-base sm:text-lg font-bold tracking-widest hover:bg-white hover:border-white hover:text-neutral-900 transition-all duration-300 text-center backdrop-blur-sm hover:scale-105 w-full sm:w-auto"
                >
                  <span className="group-hover:text-neutral-900 transition-colors flex items-center justify-center gap-2">
                    {copy.heroDiscover}
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </a>
              </div>

              {/* Description - Moved below buttons */}
              <p className="text-sm sm:text-base text-white/60 font-light leading-relaxed max-w-2xl mx-auto">
                {copy.heroDescription}
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
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-accent-50 to-accent-100/50 rounded-full border border-accent-200 mb-4">
                <svg className="w-6 h-6 text-accent-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                <span className="text-sm font-semibold text-accent-800 tracking-wider">{isSpanish ? 'EXCELENCIA EN BELLEZA' : 'BEAUTY EXCELLENCE'}</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-neutral-900 mb-4">
                {isSpanish ? 'Reconocidos por nuestra dedicación al cuidado excepcional' : 'Recognized for our dedication to exceptional care'}
              </h2>
              <p className="text-lg text-neutral-600 font-light max-w-3xl mx-auto">
                {isSpanish
                  ? <>En <strong className="font-medium">Amor Amar</strong>, cada tratamiento es una experiencia transformadora, diseñada con precisión y ejecutada con cuidado por terapeutas altamente cualificados.</>
                  : <>At <strong className="font-medium">Amor Amar</strong>, each treatment is a transformative experience, designed with precision and delivered with care by highly qualified therapists.</>}
              </p>
            </div>
          </div>
        </section>

        {/* Founder Story */}
        <section id="story" className="py-32 md:py-48 bg-neutral-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="mb-8 h-1 w-20 bg-accent-700" />
                
                <h2 className="text-6xl md:text-7xl font-light tracking-tight text-neutral-900 mb-8">
                  {isSpanish ? 'Por qué' : 'Why'}<br />Amor Amar
                </h2>

                <p className="text-lg text-neutral-700 font-light leading-relaxed mb-6">
                  {isSpanish
                    ? 'Soy terapeuta. Llegué a Ibiza hace años y noté algo: un lugar tan hermoso, tan lleno de personas hermosas, merecía algo más. No solo tratamientos, sino cuidado real. El tipo que cambia cómo te sientes.'
                    : 'I am a therapist. I arrived in Ibiza years ago and noticed something: a place this beautiful, full of beautiful people, deserved more. Not just treatments, but real care. The kind that changes how you feel.'}
                </p>

                <p className="text-lg text-neutral-700 font-light leading-relaxed mb-6">
                  {isSpanish
                    ? 'Vi a personas llegar tensas, cargando el peso del mundo. Y las vi irse transformadas. Ligeras. Cuidadas. Ahí supe que esto tenía que existir.'
                    : 'I saw people arrive tense, carrying the weight of the world. Then I saw them leave transformed. Lighter. Cared for. That is when I knew this had to exist.'}
                </p>

                <p className="text-lg text-neutral-700 font-light leading-relaxed mb-12">
                  {isSpanish
                    ? 'Cada tratamiento en Amor Amar se basa en un principio: mereces cuidado genuino. No apresurado. No corporativo. No olvidable. Cuidado que realmente importa, porque tú importas.'
                    : 'Every treatment at Amor Amar is built on one principle: you deserve genuine care. Not rushed. Not corporate. Not forgettable. Care that truly matters, because you matter.'}
                </p>

                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="text-2xl">💚</div>
                    <div>
                      <p className="font-medium text-neutral-900 mb-1">{isSpanish ? 'Cuidado Genuino' : 'Genuine Care'}</p>
                      <p className="text-sm text-neutral-600 font-light">{isSpanish ? 'Te recordamos. Tus preferencias. Tu historia. Atención personal, siempre.' : 'We remember you. Your preferences. Your story. Personal attention, always.'}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-2xl">✨</div>
                    <div>
                      <p className="font-medium text-neutral-900 mb-1">{isSpanish ? 'Creado por Expertos' : 'Expert Crafted'}</p>
                      <p className="text-sm text-neutral-600 font-light">{isSpanish ? 'Años de formación. Técnicas precisas. Cada detalle importa.' : 'Years of training. Precise techniques. Every detail matters.'}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-2xl">🏡</div>
                    <div>
                      <p className="font-medium text-neutral-900 mb-1">{isSpanish ? 'Un Espacio Que Se Siente Bien' : 'A Space That Feels Right'}</p>
                      <p className="text-sm text-neutral-600 font-light">{isSpanish ? 'Calma. Reflexivo. Seguro. Diseñado para tu restauración completa.' : 'Calm. Thoughtful. Safe. Designed for your full restoration.'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="aspect-square bg-accent-100 border-2 border-accent-200 overflow-hidden">
                  <img 
                    src="/images/hero/FounderImage.jpg" 
                    alt={isSpanish ? 'Fundador de Amor Amar' : 'Founder of Amor Amar'} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/20 to-transparent" />
                </div>
                <div className="absolute -bottom-6 -right-6 bg-white border-2 border-accent-700 p-6 max-w-sm shadow-xl">
                  <p className="text-sm font-light text-neutral-700 italic mb-3">{isSpanish ? '"El lujo no es lo que te rodea. Es qué tan profundamente te cuidan."' : '"Luxury is not what surrounds you. It is how deeply you are cared for."'}</p>
                  <p className="font-light text-neutral-900">— Amor Amar</p>
                  <p className="text-xs text-neutral-500 mt-1">{isSpanish ? 'Fundador & Terapeuta' : 'Founder & Therapist'}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-32 md:py-48 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="mb-16">
              <div className="mb-6 h-1 w-20 bg-accent-700" />
              <h2 className="text-6xl md:text-7xl font-light tracking-tight text-neutral-900 mb-6">
                {isSpanish ? 'Lo Que Dicen' : 'What Our'}<br />{isSpanish ? 'Los Invitados' : 'Guests Say'}
              </h2>
              <p className="text-lg text-neutral-700 font-light max-w-2xl">
                {isSpanish ? 'Personas reales. Experiencias reales. Transformación real.' : 'Real people. Real experiences. Real transformation.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {TESTIMONIALS.map((testimonial, idx) => (
                <div key={idx} className="bg-neutral-50 border-l-4 border-accent-700 p-8 hover:shadow-lg transition">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium text-neutral-900">{testimonial.name}</p>
                    <p className="text-xs text-accent-700 font-light tracking-widest">{testimonial.service}</p>
                  </div>
                  <p className="text-neutral-700 font-light leading-relaxed mb-4">"{testimonial.text}"</p>
                  <div className="text-accent-700">★★★★★</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Experiences */}
        <section id="experiences" className="py-32 md:py-48 bg-neutral-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="mb-24">
              <div className="mb-6 h-1 w-20 bg-accent-700" />
              <h2 className="text-6xl md:text-7xl font-light tracking-tight text-neutral-900 mb-8">
                {copy.experiencesTitle}
              </h2>
              <p className="text-lg text-neutral-700 font-light max-w-2xl leading-relaxed">
                {copy.experiencesSubtitle}
              </p>
            </div>

            {landingServices.length === 0 ? (
              <p className="text-neutral-600 font-light">{copy.noServicesNow}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {landingServices.map((svc) => (
                  <button
                    key={svc.id}
                    onClick={() => router.push(`/book/${svc.id}`)}
                    className="group text-left bg-white border-2 border-neutral-200 p-8 hover:border-accent-700 hover:shadow-xl transition duration-300 relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 h-1 w-0 bg-accent-700 group-hover:w-full transition-all duration-300" />
                    
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-light text-neutral-900 tracking-wide mb-2 group-hover:text-accent-700 transition">{svc.name}</h3>
                        <p className="text-xs tracking-widest text-neutral-600 uppercase">{svc.category}</p>
                      </div>
                    </div>
                    
                    <p className="text-sm text-neutral-700 font-light leading-relaxed mb-6 line-clamp-3">{svc.description}</p>
                    
                    <div className="flex items-baseline justify-between pt-6 border-t border-neutral-200">
                      <div className="text-right">
                        <div className="text-2xl font-light text-accent-700">{svc.price}</div>
                        <div className="text-xs text-neutral-600 mt-1 font-light">{svc.duration}</div>
                      </div>
                      {svc.requiresApproval && (
                        <span className="text-xs tracking-widest text-accent-700 uppercase font-light">Bespoke</span>
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
              <div className="mb-6 h-1 w-20 bg-accent-700" />
              <h2 className="text-6xl md:text-7xl font-light tracking-tight text-neutral-900 mb-8">
                {copy.teamTitle}
              </h2>
              <p className="text-lg text-neutral-700 font-light max-w-2xl">
                {copy.teamSubtitle}
              </p>
            </div>

            {employees.length === 0 ? (
              <p className="text-neutral-600 font-light">{copy.noEmployeesNow}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                {employees.map((member, idx) => (
                  <div key={member.id} className="text-center">
                    <div className="aspect-square bg-accent-100 border-2 border-accent-200 mb-6 overflow-hidden rounded-full mx-auto max-w-[200px]">
                      {member.profileImage ? (
                        <img src={member.profileImage} alt={member.firstName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl text-accent-700">
                          {member.firstName[0]}{member.lastName[0]}
                        </div>
                      )}
                    </div>
                    <h3 className="text-2xl font-light text-neutral-900 mb-2">{member.firstName} {member.lastName}</h3>
                    <p className="text-sm text-accent-700 font-light tracking-widest uppercase mb-4">{copy.therapist}</p>
                    <p className="text-neutral-700 font-light leading-relaxed">{member.bio || copy.defaultBio}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 md:py-48 bg-accent-700 text-white">
          <div className="mx-auto max-w-4xl px-4 sm:px-8 text-center">
            <h2 className="text-6xl md:text-7xl font-light tracking-tight mb-8">
              {isSpanish ? 'Listo para Sentirlo' : 'Ready to Feel It'}
            </h2>
            <p className="text-xl text-white/90 font-light mb-12 max-w-2xl mx-auto leading-relaxed">
              {isSpanish ? 'Sabes cuando algo es realmente correcto. Esto es eso.' : 'You know when something feels truly right. This is it.'}
            </p>
            <button
              onClick={() => router.push('/book')}
              className="px-10 py-4 bg-white text-accent-700 font-light tracking-wider hover:shadow-xl transition text-sm"
            >
              {isSpanish ? 'RESERVA TU EXPERIENCIA' : 'BOOK YOUR EXPERIENCE'}
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-neutral-900 text-neutral-300">
          <div className="mx-auto max-w-7xl px-4 sm:px-8 py-16">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
              <div>
                <h3 className="text-sm font-light tracking-widest text-white uppercase mb-4">Amor Amar</h3>
                <p className="text-sm text-neutral-400 font-light">{isSpanish ? 'Bienestar en Ibiza. Cuidado. Precisión. Transformación.' : 'Wellness in Ibiza. Care. Precision. Transformation.'}</p>
              </div>
              <div>
                <h4 className="text-sm font-light tracking-widest text-white uppercase mb-4">{isSpanish ? 'Tratamientos' : 'Treatments'}</h4>
                <ul className="space-y-2 text-sm text-neutral-400 font-light">
                  <li><a href="#experiences" className="hover:text-accent-400 transition">{isSpanish ? 'Todas las Experiencias' : 'All Experiences'}</a></li>
                  <li><a href="#experiences" className="hover:text-accent-400 transition">{isSpanish ? 'Para Parejas' : 'For Couples'}</a></li>
                  <li><a href="#experiences" className="hover:text-accent-400 transition">Spa</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-light tracking-widest text-white uppercase mb-4">{isSpanish ? 'Empresa' : 'Company'}</h4>
                <ul className="space-y-2 text-sm text-neutral-400 font-light">
                  <li><a href="#story" className="hover:text-accent-400 transition">{copy.navStory}</a></li>
                  <li><a href="#testimonials" className="hover:text-accent-400 transition">{copy.navReviews}</a></li>
                  <li><a href="#" className="hover:text-accent-400 transition">{isSpanish ? 'Tarjetas Regalo' : 'Gift Cards'}</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-light tracking-widest text-white uppercase mb-4">{isSpanish ? 'Conectar' : 'Connect'}</h4>
                <ul className="space-y-2 text-sm text-neutral-400 font-light">
                  <li><a href="#" className="hover:text-accent-400 transition">Instagram</a></li>
                  <li><a href="#" className="hover:text-accent-400 transition">{isSpanish ? 'Contacto' : 'Contact'}</a></li>
                  <li><a href="#" className="hover:text-accent-400 transition">WhatsApp</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-neutral-700 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-neutral-500 font-light">
              <p>&copy; 2024 Amor Amar. {isSpanish ? 'Creado con cuidado para Ibiza.' : 'Crafted with care for Ibiza.'}</p>
              <div className="flex gap-8 mt-6 md:mt-0">
                <a href="#" className="hover:text-accent-400 transition">{isSpanish ? 'Privacidad' : 'Privacy'}</a>
                <a href="#" className="hover:text-accent-400 transition">{isSpanish ? 'Términos' : 'Terms'}</a>
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
            
            <div className="sticky top-0 bg-accent-50 px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between border-b border-accent-200">
              <div>
                <p className="text-xs tracking-widest text-accent-700 uppercase font-medium">{copy.bookExperienceTitle}</p>
                <p className="text-xs sm:text-sm text-neutral-700 mt-1 font-light">{copy.stepOf} {bookingStep} / 4</p>
              </div>
              <button aria-label="Close" onClick={closeBooking} className="text-2xl text-neutral-400 hover:text-neutral-600 transition min-w-[44px] min-h-[44px] flex items-center justify-center">✕</button>
            </div>

            <div className="h-1 bg-accent-200">
              <div className="h-full bg-accent-700 transition-all duration-300" style={{ width: `${(bookingStep/4)*100}%` }} />
            </div>

            <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6 max-h-[calc(90vh-180px)] overflow-y-auto flex-1">

              {!user && (
                <div className="p-4 sm:p-5 rounded-2xl border border-accent-100 bg-accent-50/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{copy.reserveFaster}</p>
                    <p className="text-xs text-neutral-600">
                      {copy.reserveFasterDesc}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={login}
                      className="px-4 py-2 rounded-xl border border-accent-200 text-[11px] font-bold uppercase tracking-[0.18em] text-accent-700 hover:bg-accent-600 hover:text-white transition-all"
                    >
                      {copy.iHaveAccount}
                    </button>
                    <button
                      onClick={login}
                      className="px-4 py-2 rounded-xl bg-accent-700 text-white text-[11px] font-bold uppercase tracking-[0.18em] hover:brightness-95 transition-all"
                    >
                      {copy.createAccount}
                    </button>
                  </div>
                </div>
              )}
              
              {bookingStep === 1 && (
                <div>
                  <p className="text-sm font-light text-neutral-900 mb-6 tracking-wide">{copy.bookingQuestion}</p>
                  {groupedBookingServices.length === 0 ? (
                    <p className="text-neutral-600 font-light">{copy.noServices}</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
                      <div className="space-y-2">
                        {groupedBookingServices.map((group, index) => {
                          const active = group.key === activeMajorGroup;
                          return (
                            <button
                              key={group.key}
                              onClick={() => setSelectedMajorGroup(group.key)}
                              className={`w-full rounded-xl border px-3 py-3 text-left transition ${active ? 'border-accent-600 bg-accent-50' : 'border-accent-200 bg-white hover:border-accent-400'}`}
                            >
                              <p className="text-sm font-medium text-neutral-900">{index + 1}. {group.label}</p>
                              <p className="text-xs text-neutral-500 mt-1">{group.services.length} {isSpanish ? 'servicios' : 'services'}</p>
                            </button>
                          );
                        })}
                      </div>
                      <div className="space-y-5">
                        <div className="text-xs text-neutral-600">
                          {activeMajorGroupData?.label || (isSpanish ? 'Elige un grupo' : 'Choose a group')}
                        </div>
                        {activeMajorGroupData?.subgroups.map((subgroup) => (
                          <div key={subgroup.label} className="space-y-2">
                            <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                              <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-neutral-600">{subgroup.label}</h4>
                              <span className="text-xs text-neutral-400">{subgroup.services.length}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {subgroup.services.map((service) => {
                                const isRestrictedOnline = isOnlineBookingRestricted(service);
                                return (
                                  <button
                                    key={service.id}
                                    onClick={() => !isRestrictedOnline && openBooking(service)}
                                    disabled={isRestrictedOnline}
                                    className={`p-4 border-2 text-left transition rounded-xl ${
                                      isRestrictedOnline
                                        ? 'border-amber-200 bg-amber-50/60 cursor-not-allowed'
                                        : selectedService?.id === service.id
                                          ? 'border-accent-700 bg-accent-50'
                                          : 'border-accent-200/50 bg-white hover:border-accent-400'
                                    }`}
                                  >
                                    <h4 className="font-light text-sm text-neutral-900 mb-1">{service.serviceName}</h4>
                                    <p className="text-xs text-neutral-600 mb-3 font-light">{service.duration} min</p>
                                    <p className="text-lg font-light text-accent-700">{formatCurrency(service.price)}</p>
                                    {isRestrictedOnline ? (
                                      <p className="mt-2 text-[11px] font-medium text-amber-700">
                                        {isSpanish ? 'Consulta previa obligatoria • No disponible online' : 'Consultation required • Not available online'}
                                      </p>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {bookingStep === 2 && (
                <div className="space-y-6">
                  <div className="bg-accent-50 p-4 border-2 border-accent-200">
                    <p className="text-sm text-neutral-700 font-light">{isSpanish ? 'Elegiste:' : 'Selected:'} <span className="font-medium text-neutral-900">{selectedService?.name}</span></p>
                  </div>

                  <div>
                    <label className="block text-sm font-light text-neutral-900 mb-2">{isSpanish ? 'Tu Nombre' : 'Your Name'}</label>
                    <input 
                      value={formData.name} 
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                      placeholder={isSpanish ? 'Tu nombre' : 'Your name'} 
                      className="w-full border-2 border-accent-200 px-4 py-3 text-sm focus:outline-none focus:border-accent-700 transition font-light" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-light text-neutral-900 mb-2">{isSpanish ? 'Tu Correo' : 'Your Email'}</label>
                    <input 
                      type="email" 
                      value={formData.email} 
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                      placeholder={isSpanish ? 'tu@correo.com' : 'you@email.com'} 
                      className="w-full border-2 border-accent-200 px-4 py-3 text-sm focus:outline-none focus:border-accent-700 transition font-light" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-light text-neutral-900 mb-2">{isSpanish ? 'Tu Teléfono' : 'Your Phone'}</label>
                    <input 
                      type="tel" 
                      value={formData.phone} 
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                      placeholder="+34 600 000000" 
                      className="w-full border-2 border-accent-200 px-4 py-3 text-sm focus:outline-none focus:border-accent-700 transition font-light" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-light text-neutral-900 mb-3">{isSpanish ? 'Selecciona tu Terapeuta' : 'Select your therapist'}</label>
                    {serviceEmployees.length === 0 ? (
                      <p className="text-neutral-600 font-light text-sm">
                        {selectedService
                          ? (isSpanish ? 'Cargando terapeutas disponibles...' : 'Loading available therapists...')
                          : (isSpanish ? 'Primero selecciona un servicio' : 'Select a service first')}
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
                                ? 'border-accent-600 bg-accent-50'
                                : 'border-accent-200 bg-white hover:border-accent-400'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {emp.profileImage ? (
                                <img
                                  src={emp.profileImage}
                                  alt={`${emp.firstName} ${emp.lastName}`}
                                  className="w-12 h-12 rounded-full object-cover border-2 border-accent-300"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-white font-semibold">
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
                                <svg className="w-5 h-5 text-accent-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
                    <label className="block text-sm font-light text-neutral-900 mb-2">{isSpanish ? '¿Qué día?' : 'Which day?'}</label>
                    <input 
                      type="date" 
                      value={formData.date} 
                      onChange={(e) => setFormData({ ...formData, date: e.target.value, time: '' })} 
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full border-2 border-accent-200 px-4 py-3 text-sm focus:outline-none focus:border-accent-700 transition font-light rounded-lg" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-light text-neutral-900 mb-3">{isSpanish ? '¿Qué hora?' : 'What time?'}</label>
                    {!formData.date || !selectedService || !formData.employeeId ? (
                      <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg text-center">
                        <p className="text-sm text-neutral-600 font-light">{isSpanish ? 'Selecciona una fecha para ver los horarios disponibles' : 'Select a date to see available slots'}</p>
                      </div>
                    ) : loadingSlots ? (
                      <div className="flex flex-col items-center gap-3 py-8">
                        <div className="w-8 h-8 border-3 border-accent-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-neutral-600 font-light">{isSpanish ? 'Buscando horarios disponibles...' : 'Looking for available slots...'}</p>
                      </div>
                    ) : slotsError ? (
                      <div className="p-5 bg-amber-50 border border-amber-200 rounded-lg text-center">
                        <div className="w-12 h-12 mx-auto mb-3 bg-amber-100 rounded-full flex items-center justify-center">
                          <span className="text-2xl">📅</span>
                        </div>
                        <p className="text-sm text-amber-800 font-medium">{slotsError}</p>
                        <p className="text-xs text-amber-600 mt-2">{isSpanish ? 'Prueba seleccionando otra fecha' : 'Try selecting another date'}</p>
                      </div>
                    ) : availableSlots.filter(slot => slot.available).length === 0 ? (
                      <div className="p-5 bg-neutral-50 border border-neutral-200 rounded-lg text-center">
                        <div className="w-12 h-12 mx-auto mb-3 bg-neutral-100 rounded-full flex items-center justify-center">
                          <span className="text-2xl">⏰</span>
                        </div>
                        <p className="text-sm text-neutral-700 font-medium">{isSpanish ? 'Sin horarios disponibles' : 'No available slots'}</p>
                        <p className="text-xs text-neutral-500 mt-2">{isSpanish ? 'Todos los horarios están ocupados. Prueba con otra fecha.' : 'All slots are booked. Try another date.'}</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-accent-600 mb-3">
                          ✓ {availableSlots.filter(s => s.available).length} horarios disponibles
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {availableSlots.filter(slot => slot.available).map((slot) => (
                            <button
                              key={slot.time}
                              onClick={() => setFormData({ ...formData, time: slot.time })}
                              className={`py-3 text-sm font-medium rounded-lg transition-all ${
                                formData.time === slot.time
                                  ? 'bg-accent-600 text-white shadow-lg shadow-accent-500/30 scale-105'
                                  : 'bg-white border border-accent-200 text-accent-800 hover:border-accent-400 hover:bg-accent-50'
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
                      <div className="bg-accent-50 p-6 border-2 border-accent-200 space-y-3">
                        <Row label={isSpanish ? 'Tratamiento' : 'Service'} value={selectedService?.name} />
                        <Row label={isSpanish ? 'Fecha' : 'Date'} value={formData.date} />
                        <Row label={isSpanish ? 'Hora' : 'Time'} value={formData.time} />
                        <Row label={isSpanish ? 'Terapeuta' : 'Therapist'} value={employees.find(e => e.id === formData.employeeId)?.firstName + ' ' + employees.find(e => e.id === formData.employeeId)?.lastName} />
                        <div className="flex justify-between pt-4 border-t border-accent-300 font-light">
                          <span className="text-neutral-900">{isSpanish ? 'Precio' : 'Price'}</span>
                          <span className="text-accent-700 text-lg font-medium">{selectedService?.price ?? '—'}</span>
                        </div>
                      </div>

                      <div className="border-2 border-accent-700 bg-white p-6 text-center">
                        <p className="text-lg font-light text-neutral-900 mb-1">{isSpanish ? '¡Hermoso! ✨' : 'Beautiful! ✨'}</p>
                        <p className="text-sm text-neutral-700 font-light">{isSpanish ? 'Tu reserva está confirmada. No podemos esperar a cuidarte.' : 'Your booking is confirmed. We can’t wait to take care of you.'}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-accent-50 p-6 border-2 border-accent-200 space-y-3">
                        <Row label={isSpanish ? 'Tratamiento' : 'Service'} value={selectedService?.name} />
                        <Row label={isSpanish ? 'Fecha' : 'Date'} value={formData.date} />
                        <Row label={isSpanish ? 'Hora' : 'Time'} value={formData.time} />
                        <div className="flex justify-between pt-4 border-t border-accent-300 font-light">
                          <span className="text-neutral-900">{isSpanish ? 'Depósito (50%)' : 'Deposit (50%)'}</span>
                          <span className="text-accent-700 text-lg font-medium">{depositDisplay ?? '—'}</span>
                        </div>
                        <div className="flex justify-between font-light">
                          <span className="text-neutral-900">{isSpanish ? 'Restante en salón' : 'Remaining at salon'}</span>
                          <span className="text-neutral-700 text-lg font-medium">
                            {remainingBalance !== null ? formatCurrency(remainingBalance) : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between font-light">
                          <span className="text-neutral-900">Total</span>
                          <span className="text-accent-700 text-lg font-medium">{selectedService?.price ?? '—'}</span>
                        </div>
                      </div>

                      <div className="p-6 border-2 border-neutral-200 rounded-2xl bg-white space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-neutral-900">{isSpanish ? 'Paga el depósito ahora' : 'Pay deposit now'}</p>
                            <p className="text-xs text-neutral-500">{isSpanish ? 'Cobramos el 50% para confirmar. El resto lo abonas en el salón.' : 'We charge 50% to confirm. You pay the rest at the salon.'}</p>
                          </div>
                          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-accent-100 text-accent-700">
                            {isSpanish ? 'Seguro' : 'Secure'}
                          </span>
                        </div>

                        {stripePublicKey ? (
                          <div
                            id={cardMountId}
                            className="p-4 border-2 border-neutral-200 rounded-xl bg-neutral-50"
                          />
                        ) : (
                          <div className="p-4 border-2 border-amber-200 rounded-xl bg-amber-50 text-amber-800 text-sm">
                            {isSpanish
                              ? 'Falta la clave pública de Stripe. Contacta con soporte para habilitar pagos.'
                              : 'Stripe public key is missing. Contact support to enable payments.'}
                          </div>
                        )}
                        {paymentError && (
                          <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-xl px-4 py-3">
                            {paymentError}
                          </p>
                        )}
                        <p className="text-xs text-neutral-500">
                          {isSpanish ? 'Al continuar se realizará un cargo de ' : 'By continuing, you will be charged '}
                          {depositDisplay ?? (isSpanish ? '50% del servicio' : '50% of the service')}
                          {isSpanish ? ' para asegurar tu cita.' : ' to secure your appointment.'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-accent-50 border-t border-accent-200 px-4 sm:px-8 py-3 sm:py-4 flex gap-2 sm:gap-3">
              {bookingStep > 1 && (
                <button onClick={back} className="flex-1 py-3 sm:py-3 min-h-[48px] border-2 border-accent-200 text-neutral-900 text-sm font-light hover:bg-white transition touch-manipulation">
                  {isSpanish ? 'Atrás' : 'Back'}
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
                className="flex-1 py-3 sm:py-3 min-h-[48px] bg-accent-700 text-white text-sm font-light hover:bg-accent-800 disabled:opacity-50 disabled:cursor-not-allowed transition touch-manipulation"
              >
                {submitting || paymentLoading
                  ? (isSpanish ? 'Procesando...' : 'Processing...')
                  : bookingStep === 4
                    ? bookingSuccess
                      ? '✓ Completar'
                      : (isSpanish ? 'Pagar y confirmar' : 'Pay and confirm')
                    : (isSpanish ? 'Continuar' : 'Continue')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
