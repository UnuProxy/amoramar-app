'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { Loading } from '@/shared/components/Loading';
import { ClientAuthModal } from '@/shared/components/ClientAuthModal';
import { formatCurrency, cn, getDateKeyInMadrid } from '@/shared/lib/utils';
import type { Service, Employee, BookingFormData, Client } from '@/shared/lib/types';
import { loadStripe, type Stripe, type StripeCardElement, type StripeElements } from '@stripe/stripe-js';
import Link from 'next/link';
import Image from 'next/image';
import { getClient, getClientByEmail } from '@/shared/lib/firestore';
import { AvailabilityCalendar } from '@/shared/components/AvailabilityCalendar';
import { useLanguage } from '@/shared/context/LanguageContext';
import { BrandLogo } from '@/shared/components/BrandLogo';

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

type MajorGroupKey = 'manicure' | 'pedicure-care' | 'combinations' | 'hair';

type LocalizedSubgroup = {
  key: string;
  label: string;
};

const MAJOR_GROUP_ORDER: MajorGroupKey[] = ['manicure', 'pedicure-care', 'combinations', 'hair'];

const MAJOR_GROUP_META: Record<MajorGroupKey, { es: string; en: string }> = {
  manicure: { es: 'Manicura', en: 'Nails / Manicure' },
  'pedicure-care': { es: 'Pedicura y Cuidado', en: 'Pedicure & Care' },
  combinations: {
    es: 'Combinaciones de Manicura y Pedicura',
    en: 'Manicure & Pedicure Combinations',
  },
  hair: { es: 'Peluqueria', en: 'Hair' },
};

type GroupTone = {
  activeCard: string;
  activeTitle: string;
  activeMeta: string;
  activeBar: string;
  badge: string;
  badgeText: string;
  panel: string;
  panelBorder: string;
  serviceHover: string;
  serviceButton: string;
  subgroupBand: string;
};

const GROUP_TONE: Record<MajorGroupKey, GroupTone> = {
  manicure: {
    activeCard: 'border-rose-300 bg-rose-50/70',
    activeTitle: 'text-rose-900',
    activeMeta: 'text-rose-700',
    activeBar: 'from-rose-400/80 via-rose-300/60 to-transparent',
    badge: 'bg-rose-100',
    badgeText: 'text-rose-700',
    panel: 'bg-rose-50/30',
    panelBorder: 'border-rose-200/70',
    serviceHover: 'hover:border-rose-300 hover:shadow-rose-100/70',
    serviceButton: 'bg-rose-700 group-hover:bg-rose-800',
    subgroupBand: 'bg-rose-50 border-rose-100',
  },
  'pedicure-care': {
    activeCard: 'border-cyan-300 bg-cyan-50/70',
    activeTitle: 'text-cyan-900',
    activeMeta: 'text-cyan-700',
    activeBar: 'from-cyan-400/80 via-cyan-300/60 to-transparent',
    badge: 'bg-cyan-100',
    badgeText: 'text-cyan-700',
    panel: 'bg-cyan-50/30',
    panelBorder: 'border-cyan-200/70',
    serviceHover: 'hover:border-cyan-300 hover:shadow-cyan-100/70',
    serviceButton: 'bg-cyan-700 group-hover:bg-cyan-800',
    subgroupBand: 'bg-cyan-50 border-cyan-100',
  },
  combinations: {
    activeCard: 'border-stone-300 bg-stone-50/70',
    activeTitle: 'text-stone-900',
    activeMeta: 'text-stone-700',
    activeBar: 'from-stone-400/80 via-stone-300/60 to-transparent',
    badge: 'bg-stone-100',
    badgeText: 'text-stone-700',
    panel: 'bg-stone-50/30',
    panelBorder: 'border-stone-200/70',
    serviceHover: 'hover:border-stone-300 hover:shadow-stone-100/70',
    serviceButton: 'bg-stone-800 group-hover:bg-stone-900',
    subgroupBand: 'bg-stone-50 border-stone-100',
  },
  hair: {
    activeCard: 'border-emerald-300 bg-emerald-50/70',
    activeTitle: 'text-emerald-900',
    activeMeta: 'text-emerald-700',
    activeBar: 'from-emerald-400/80 via-emerald-300/60 to-transparent',
    badge: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    panel: 'bg-emerald-50/30',
    panelBorder: 'border-emerald-200/70',
    serviceHover: 'hover:border-emerald-300 hover:shadow-emerald-100/70',
    serviceButton: 'bg-emerald-700 group-hover:bg-emerald-800',
    subgroupBand: 'bg-emerald-50 border-emerald-100',
  },
};

const getMajorGroupForService = (service: Service): MajorGroupKey => {
  const category = service.category || 'other';
  const serviceName = service.serviceName.toLowerCase();

  if (category === 'manicure' || category === 'nail-art-care-manicure') return 'manicure';
  if (category === 'pedicure-care' || category === 'professional-foot-services' || category === 'foot-sole-treatments') return 'pedicure-care';
  if (category === 'nail-art-care-combinations') return 'combinations';
  if (String(category).startsWith('hair-')) return 'hair';

  if (serviceName.includes('pedicure') || serviceName.includes('planta') || serviceName.includes('sole') || serviceName.includes('foot')) {
    return 'pedicure-care';
  }
  if (serviceName.includes('combo') || serviceName.includes('combin')) {
    return 'combinations';
  }
  if (serviceName.includes('manicure') || serviceName.includes('gel') || serviceName.includes('nail')) {
    return 'manicure';
  }
  return 'hair';
};

const getServiceSubgroup = (service: Service, language: 'es' | 'en'): LocalizedSubgroup => {
  const category = service.category || 'other';
  const name = service.serviceName.toLowerCase();
  const es = language === 'es';

  if (category === 'manicure' || category === 'nail-art-care-manicure') {
    if (name.includes('relleno') || name.includes('refill')) return { key: 'gel-refill', label: es ? 'Relleno con gel' : 'Gel refill' };
    if (name.includes('extension')) return { key: 'extensions', label: es ? 'Extensiones' : 'Extensions' };
    if (name.includes('french glass') || name.includes('french interior')) return { key: 'special-techniques', label: es ? 'Técnicas especiales' : 'Special techniques' };
    if (name.includes('retirada') || name.includes('removal')) return { key: 'removal', label: es ? 'Retirada de material' : 'Removal' };
    if (name.includes('higien')) return { key: 'hygienic', label: es ? 'Manicura higiénica' : 'Hygienic manicure' };
    return { key: 'semi-permanent', label: es ? 'Esmaltado semipermanente' : 'Semi-permanent gel polish' };
  }

  if (category === 'pedicure-care' || category === 'professional-foot-services' || category === 'foot-sole-treatments') {
    if (name.includes('planta') || name.includes('sole') || name.includes('peeling') || name.includes('queratol') || name.includes('cleaning')) {
      return { key: 'sole-treatments', label: es ? 'Tratamientos de planta del pie' : 'Sole treatments' };
    }
    return { key: 'pedicure-nails', label: es ? 'Pedicura uñas' : 'Pedicure nails' };
  }

  if (category === 'nail-art-care-combinations') {
    if (name.includes('sin limpieza') || name.includes('without cleaning')) {
      return { key: 'without-cleaning', label: es ? 'Combinaciones sin limpieza de planta' : 'Combinations without sole cleaning' };
    }
    return { key: 'with-cleaning', label: es ? 'Combinaciones con limpieza de planta' : 'Combinations with sole cleaning' };
  }

  if (String(category).startsWith('hair-')) {
    if (category === 'hair-haircuts-styling') return { key: 'haircuts-styling', label: es ? 'Corte y peinado' : 'Haircuts & Styling' };
    if (category === 'hair-color') return { key: 'color', label: es ? 'Color' : 'Color' };
    if (category === 'hair-bleach-highlights') return { key: 'bleach-highlights', label: es ? 'Decoloración y mechas' : 'Bleach & Highlights' };
    if (category === 'hair-treatments-signature') return { key: 'treatments-signature', label: es ? 'Tratamientos & Signature' : 'Treatments & Signature' };
    if (category === 'hair-men') return { key: 'mens-services', label: es ? 'Servicios para hombre' : "Men's Services" };
    if (category === 'hair-kids') return { key: 'kids-cuts', label: es ? 'Cortes infantiles' : 'Kids Cuts' };
    if (category === 'hair-extensions') return { key: 'extensions', label: es ? 'Extensiones' : 'Extensions' };
  }

  return { key: 'general', label: es ? 'Servicios' : 'Services' };
};

const isOnlineBookingRestricted = (service: Service): boolean => {
  return service.category === 'hair-bleach-highlights';
};


const clampStep = (n: number): Step => Math.min(4, Math.max(1, n)) as Step;
const getLocalDateKey = (): string => {
  return getDateKeyInMadrid();
};

// Format date from yyyy-mm-dd to dd.mm.yyyy
const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
};

export default function BookAllServicesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<MajorGroupKey | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceSort, setServiceSort] = useState<'recommended' | 'priceAsc' | 'durationAsc' | 'nameAsc'>('recommended');
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

  const copy = useMemo(() => {
    if (language === 'es') {
      return {
        myBookings: 'Mis Citas',
        createAccount: 'Crear Cuenta',
        hello: 'Hola',
        login: 'Entrar',
        title: 'Reserva tu experiencia',
        subtitle: 'Elige y reserva en minutos.',
        stepService: 'Servicio',
        stepDetails: 'Datos',
        stepDate: 'Fecha',
        stepPayment: 'Pago',
        servicesTitle: 'Nuestros servicios',
        noServicesNow: 'No hay servicios disponibles en este momento',
        search: 'Buscar servicio o grupo...',
        clearSearch: 'Limpiar busqueda',
        mainGroups: 'Grupos principales',
        groups: 'grupos',
        services: 'servicios',
        from: 'Desde',
        scrollForMoreGroups: 'Desliza para ver mas grupos',
        noServicesForGroup: 'No encontramos servicios para este grupo.',
        noServicesForGroupHint: 'Prueba con otro nombre o cambia de grupo.',
        selected: 'Seleccionado',
        availableBadge: 'Disponible',
        hidden: 'Oculto',
        noSpecialist: 'Sin especialista',
        specialistSingular: 'especialista',
        specialistPlural: 'especialistas',
        book: 'Reservar',
        unavailable: 'No disponible',
        onlineBookingUnavailable: 'No disponible online',
        consultationRequired: 'Consulta previa obligatoria',
        autoSaveBooking: 'Tu reserva se guardara en tu cuenta automaticamente',
        selectedService: 'Servicio seleccionado',
        yourDetails: 'Tus Datos',
        contactPrompt: 'Cuentanos como contactarte',
        alreadyHaveAccount: 'Ya tienes cuenta? Reserva en segundos',
        loginAutofill: 'Inicia sesion y rellenaremos todo automaticamente. O continua como invitado.',
        iHaveAccount: 'Ya tengo cuenta',
        createFreeAccount: 'Crear cuenta gratis',
        yourName: 'Tu Nombre *',
        namePlaceholder: 'Maria Garcia',
        fullNameHint: 'Escribe tu nombre completo.',
        yourEmail: 'Tu Email *',
        emailPlaceholder: 'tu@email.com',
        validEmailHint: 'Introduce un email valido.',
        yourPhone: 'Tu Teléfono *',
        phoneHint: 'Anade un telefono de contacto.',
        chooseSpecialist: 'Elige Tu Profesional *',
        loadingSpecialists: 'Cargando profesionales...',
        chooseSpecialistHint: 'Selecciona un especialista para continuar.',
        assignedSpecialist: 'Profesional asignado',
        dateAndTime: 'Fecha y Hora',
        selectEmployeeFirst: 'Selecciona un empleado primero',
        selectTime: 'Selecciona Hora',
        pickDateFirst: 'Primero elige una fecha',
        searchingTimes: 'Buscando horarios...',
        tryAnotherDate: 'Prueba con otra fecha',
        noSlotsAvailable: 'Sin horarios disponibles',
        noSlotsForDate: 'No hay horarios disponibles para esta fecha.',
        slotsLoadError: 'Error al cargar horarios',
        connectionError: 'Error de conexion',
        bookingConfirmed: 'Reserva Confirmada!',
        confirmationEmail: 'Hemos enviado un email de confirmacion a',
        weAreWaiting: 'Te esperamos!',
        professional: 'Profesional',
        date: 'Fecha',
        time: 'Hora',
        dontLoseBooking: 'No pierdas tu reserva!',
        createAccountManage: 'Crea tu cuenta para gestionar y modificar tus citas',
        createMyAccountNow: 'Crear Mi Cuenta Ahora',
        bookingSavedInAccount: 'Reserva guardada en tu cuenta',
        bookingManageFromMyBookings: 'Puedes verla y gestionarla desde "Mis Citas"',
        viewMyBookings: 'Ver Mis Citas',
        backHome: 'Volver al inicio',
        confirmAndPay: 'Confirmar y Pagar',
        reviewAndPay: 'Revisa tu reserva y completa el pago',
        service: 'Servicio',
        deposit: 'Deposito (50%)',
        remainingAtSalon: 'Restante en salon',
        paymentDetails: 'Datos de pago',
        secureCardPayment: 'Pago seguro con tarjeta',
        paymentsUnavailable: 'Pagos no disponibles. Contacta con soporte.',
        termsAcceptance: 'Al confirmar, aceptas nuestros terminos y condiciones.',
        complete: 'Completa',
        pay: 'Pagar',
        change: 'Cambiar',
        back: 'Atrás',
        processing: 'Procesando...',
        next: 'Continuar',
        loadingServices: 'Cargando servicios...',
        paymentGatewayNotConfigured: 'La pasarela de pago no esta configurada. Contacta con soporte.',
        selectServiceValidation: 'Selecciona un servicio',
        nameValidation: 'Nombre',
        emailValidation: 'Email',
        validEmailValidation: 'Email valido',
        phoneValidation: 'Telefono',
        specialistValidation: 'Especialista',
        dateValidation: 'Fecha',
        timeValidation: 'Hora',
        serviceUnavailable: 'Servicio no disponible.',
        paymentInitFailed: 'No se pudo iniciar el pago',
        stripeInitFailed: 'No se pudo inicializar Stripe',
        paymentFormNotReady: 'El formulario de pago no esta listo.',
        paymentCouldNotComplete: 'El pago no pudo completarse',
        paymentRetry: 'El pago no se completo. Intentalo de nuevo.',
        bookingCreateFailed: 'No se pudo crear la reserva',
        paymentProcessError: 'Error al procesar el pago',
      };
    }

    return {
      myBookings: 'My Bookings',
      createAccount: 'Create Account',
      hello: 'Hello',
      login: 'Login',
      title: 'Book your experience',
      subtitle: 'Choose and book in minutes.',
      stepService: 'Service',
      stepDetails: 'Details',
      stepDate: 'Date',
      stepPayment: 'Payment',
      servicesTitle: 'Our services',
      noServicesNow: 'No services are available right now',
      search: 'Search service or group...',
      clearSearch: 'Clear search',
      mainGroups: 'Main groups',
      groups: 'groups',
      services: 'services',
      from: 'From',
      scrollForMoreGroups: 'Scroll to view more groups',
      noServicesForGroup: 'No services were found for this group.',
      noServicesForGroupHint: 'Try another term or switch to a different group.',
      selected: 'Selected',
      availableBadge: 'Available',
      hidden: 'Hidden',
      noSpecialist: 'No specialist',
      specialistSingular: 'specialist',
      specialistPlural: 'specialists',
      book: 'Book',
      unavailable: 'Unavailable',
      onlineBookingUnavailable: 'Not available online',
      consultationRequired: 'Consultation required',
      autoSaveBooking: 'Your booking will be saved to your account automatically',
      selectedService: 'Selected service',
      yourDetails: 'Your Details',
      contactPrompt: 'Tell us how to reach you',
      alreadyHaveAccount: 'Already have an account? Book in seconds',
      loginAutofill: 'Log in and we will autofill your details. Or continue as guest.',
      iHaveAccount: 'I have an account',
      createFreeAccount: 'Create free account',
      yourName: 'Your Name *',
      namePlaceholder: 'Maria Garcia',
      fullNameHint: 'Enter your full name.',
      yourEmail: 'Your Email *',
      emailPlaceholder: 'you@email.com',
      validEmailHint: 'Enter a valid email.',
      yourPhone: 'Your Phone *',
      phoneHint: 'Add a contact phone number.',
      chooseSpecialist: 'Choose Specialist *',
      loadingSpecialists: 'Loading specialists...',
      chooseSpecialistHint: 'Select a specialist to continue.',
      assignedSpecialist: 'Assigned specialist',
      dateAndTime: 'Date and Time',
      selectEmployeeFirst: 'Select a specialist first',
      selectTime: 'Select Time',
      pickDateFirst: 'Choose a date first',
      searchingTimes: 'Searching time slots...',
      tryAnotherDate: 'Try another date',
      noSlotsAvailable: 'No available times',
      noSlotsForDate: 'No available times for this date.',
      slotsLoadError: 'Error loading time slots',
      connectionError: 'Connection error',
      bookingConfirmed: 'Booking Confirmed!',
      confirmationEmail: 'We sent a confirmation email to',
      weAreWaiting: 'See you soon!',
      professional: 'Specialist',
      date: 'Date',
      time: 'Time',
      dontLoseBooking: 'Do not lose your booking!',
      createAccountManage: 'Create your account to manage and edit your bookings',
      createMyAccountNow: 'Create My Account Now',
      bookingSavedInAccount: 'Booking saved in your account',
      bookingManageFromMyBookings: 'You can view and manage it from "My Bookings"',
      viewMyBookings: 'View My Bookings',
      backHome: 'Back to home',
      confirmAndPay: 'Confirm and Pay',
      reviewAndPay: 'Review your booking and complete payment',
      service: 'Service',
      deposit: 'Deposit (50%)',
      remainingAtSalon: 'Remaining at salon',
      paymentDetails: 'Payment details',
      secureCardPayment: 'Secure card payment',
      paymentsUnavailable: 'Payments are unavailable. Contact support.',
      termsAcceptance: 'By confirming, you accept our terms and conditions.',
      complete: 'Complete',
      pay: 'Pay',
      change: 'Change',
      back: 'Back',
      processing: 'Processing...',
      next: 'Continue',
      loadingServices: 'Loading services...',
      paymentGatewayNotConfigured: 'Payment gateway is not configured. Contact support.',
      selectServiceValidation: 'Select a service',
      nameValidation: 'Name',
      emailValidation: 'Email',
      validEmailValidation: 'Valid email',
      phoneValidation: 'Phone',
      specialistValidation: 'Specialist',
      dateValidation: 'Date',
      timeValidation: 'Time',
      serviceUnavailable: 'Service unavailable.',
      paymentInitFailed: 'Could not start payment',
      stripeInitFailed: 'Could not initialize Stripe',
      paymentFormNotReady: 'Payment form is not ready.',
      paymentCouldNotComplete: 'Payment could not be completed',
      paymentRetry: 'Payment did not complete. Please try again.',
      bookingCreateFailed: 'Could not create booking',
      paymentProcessError: 'Error processing payment',
    };
  }, [language]);

  const normalizedServiceSearch = serviceSearch.trim().toLowerCase();

  const sortServices = (items: Service[]): Service[] => {
    const next = [...items];
    next.sort((a, b) => {
      if (serviceSort === 'priceAsc') {
        if (a.price !== b.price) return a.price - b.price;
        return a.serviceName.localeCompare(b.serviceName);
      }
      if (serviceSort === 'durationAsc') {
        if (a.duration !== b.duration) return a.duration - b.duration;
        return a.serviceName.localeCompare(b.serviceName);
      }
      if (serviceSort === 'nameAsc') {
        return a.serviceName.localeCompare(b.serviceName);
      }
      const aEmployees = a.employees?.length || 0;
      const bEmployees = b.employees?.length || 0;
      if (aEmployees !== bEmployees) return bEmployees - aEmployees;
      if (a.price !== b.price) return a.price - b.price;
      return a.serviceName.localeCompare(b.serviceName);
    });
    return next;
  };

  const filteredServices = useMemo(() => {
    if (!normalizedServiceSearch) return services;

    return services.filter((service) => {
      const groupKey = getMajorGroupForService(service);
      const subgroup = getServiceSubgroup(service, language);
      const groupLabel = MAJOR_GROUP_META[groupKey][language].toLowerCase();

      return (
        service.serviceName.toLowerCase().includes(normalizedServiceSearch) ||
        (service.description || '').toLowerCase().includes(normalizedServiceSearch) ||
        subgroup.label.toLowerCase().includes(normalizedServiceSearch) ||
        groupLabel.includes(normalizedServiceSearch)
      );
    });
  }, [services, normalizedServiceSearch, language]);

  const groupedCatalog = useMemo(() => {
    const initial = MAJOR_GROUP_ORDER.reduce(
      (acc, group) => {
        acc[group] = {
          key: group,
          label: MAJOR_GROUP_META[group][language],
          services: [] as Service[],
          subgroups: new Map<string, { key: string; label: string; services: Service[] }>(),
        };
        return acc;
      },
      {} as Record<MajorGroupKey, { key: MajorGroupKey; label: string; services: Service[]; subgroups: Map<string, { key: string; label: string; services: Service[] }> }>
    );

    for (const service of filteredServices) {
      const group = getMajorGroupForService(service);
      const subgroup = getServiceSubgroup(service, language);
      initial[group].services.push(service);

      if (!initial[group].subgroups.has(subgroup.key)) {
        initial[group].subgroups.set(subgroup.key, { key: subgroup.key, label: subgroup.label, services: [] });
      }
      initial[group].subgroups.get(subgroup.key)!.services.push(service);
    }

    return MAJOR_GROUP_ORDER.map((group) => {
      const entry = initial[group];
      const prices = entry.services.map((s) => s.price).filter((p) => typeof p === 'number');
      const durations = entry.services.map((s) => s.duration).filter((d) => typeof d === 'number');
      const subgroups = Array.from(entry.subgroups.values()).map((subgroup) => ({
        ...subgroup,
        services: sortServices(subgroup.services),
      }));

      return {
        key: entry.key,
        label: entry.label,
        count: entry.services.length,
        minPrice: prices.length ? Math.min(...prices) : 0,
        maxPrice: prices.length ? Math.max(...prices) : 0,
        minDuration: durations.length ? Math.min(...durations) : 0,
        maxDuration: durations.length ? Math.max(...durations) : 0,
        subgroups,
      };
    });
  }, [filteredServices, language, serviceSort]);

  const visibleCategories = groupedCatalog.map((group) => group.key);
  const defaultCategory = visibleCategories[0] || null;
  const activeCategory = selectedCategory && visibleCategories.includes(selectedCategory as MajorGroupKey)
    ? selectedCategory
    : defaultCategory;
  const activeGroup = groupedCatalog.find((group) => group.key === activeCategory) || null;
  const totalVisibleServices = filteredServices.length;
  const activeGroupTone = activeGroup ? GROUP_TONE[activeGroup.key] : GROUP_TONE.manicure;
  
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
          const activeServices = (data.data as Service[]).filter((service) => service.isActive);
          setServices(activeServices);
        }
      } catch (err) {
        console.error('Error fetching services:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  useEffect(() => {
    if (!selectedCategory && defaultCategory) {
      setSelectedCategory(defaultCategory as MajorGroupKey);
      return;
    }

    if (
      selectedCategory &&
      !visibleCategories.includes(selectedCategory as MajorGroupKey) &&
      defaultCategory
    ) {
      setSelectedCategory(defaultCategory as MajorGroupKey);
    }
  }, [selectedCategory, defaultCategory, visibleCategories]);

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
              setSlotsError(copy.noSlotsForDate);
            }
          } else {
            setSlotsError(data.error || copy.slotsLoadError);
            setAvailableSlots([]);
          }
        } catch (err) {
          console.error('Error fetching slots:', err);
          setSlotsError(copy.connectionError);
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
  }, [formData.date, selectedService?.id, formData.employeeId, copy]);

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
    const preselectedEmployeeId = employeeId || service.employees?.[0]?.id || '';
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
        employeeId: preselectedEmployeeId,
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
        employeeId: preselectedEmployeeId,
      });
    } else {
      setFormData({ name: '', email: '', phone: '', date: '', time: '', employeeId: preselectedEmployeeId });
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

  const stepMissingItems = useMemo<string[]>(() => {
    if (bookingStep === 1 && !selectedService) return [copy.selectServiceValidation];

    if (bookingStep === 2) {
      const missing: string[] = [];
      if (!formData.name.trim()) missing.push(copy.nameValidation);
      if (!formData.email.trim()) missing.push(copy.emailValidation);
      if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) missing.push(copy.validEmailValidation);
      if (!formData.phone.trim()) missing.push(copy.phoneValidation);
      if (!formData.employeeId) missing.push(copy.specialistValidation);
      return missing;
    }

    if (bookingStep === 3) {
      const missing: string[] = [];
      if (!formData.date) missing.push(copy.dateValidation);
      if (!formData.time) missing.push(copy.timeValidation);
      return missing;
    }

    return [];
  }, [bookingStep, selectedService, formData, copy]);

  const ensurePaymentIntent = async () => {
    if (clientSecret && paymentIntentId && depositAmount) {
      return { clientSecret, paymentIntentId, amount: depositAmount };
    }

    if (!selectedService) {
      throw new Error(copy.serviceUnavailable);
    }
    if (isOnlineBookingRestricted(selectedService)) {
      throw new Error(
        language === 'es'
          ? 'Este servicio requiere consulta previa y no se puede reservar online.'
          : 'This service requires consultation and cannot be booked online.'
      );
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
      throw new Error(result.error || copy.paymentInitFailed);
    }

    setClientSecret(result.data.clientSecret);
    setPaymentIntentId(result.data.paymentIntentId);
    setDepositAmount(result.data.amount);
    return result.data as { clientSecret: string; paymentIntentId: string; amount: number };
  };

  const handleSubmitBooking = async () => {
    if (!selectedService || !formData.employeeId) return;
    if (!stripePublicKey) {
      alert(copy.paymentGatewayNotConfigured);
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
        throw new Error(copy.stripeInitFailed);
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
        throw new Error(copy.paymentFormNotReady);
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
        throw new Error(error?.message || copy.paymentCouldNotComplete);
      }
      if (paymentIntent.status !== 'succeeded') {
        throw new Error(copy.paymentRetry);
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
        throw new Error(result.error || copy.bookingCreateFailed);
      }
    } catch (err: any) {
      console.error('Booking error:', err);
      setPaymentError(err.message || copy.paymentProcessError);
    } finally {
      setSubmitting(false);
      setPaymentLoading(false);
    }
  };

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loading text={copy.loadingServices} />
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
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-stone-50/30 overflow-x-hidden w-full">
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="mx-auto max-w-7xl px-3 sm:px-8">
          <div className="h-14 sm:h-16 flex items-center justify-between">
            <Link href="/" className="transition-opacity hover:opacity-80">
              <BrandLogo className="h-11 w-36 sm:h-12 sm:w-40" priority />
            </Link>
            
            <div className="flex items-center gap-2 sm:gap-3">
              {user ? (
                <>
                  <span className="hidden md:block text-xs font-bold text-neutral-400 uppercase tracking-widest">
                    {copy.hello}, {user.firstName || user.email?.split('@')[0]}
                  </span>
                  <Link
                    href="/client/bookings"
                    className="px-3 sm:px-5 py-2 sm:py-2.5 text-[10px] sm:text-xs font-black text-white bg-stone-700 hover:bg-neutral-900 uppercase tracking-wider sm:tracking-widest transition rounded-xl flex items-center gap-1.5 sm:gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="hidden xs:inline">{copy.myBookings}</span>
                  </Link>
                </>
              ) : (
                <>
                  <button
                    onClick={() => openAuthModal('login')}
                    className="px-2 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs font-black text-neutral-600 hover:text-stone-700 uppercase tracking-wider sm:tracking-widest transition"
                  >
                    {copy.login}
                  </button>
                  <button
                    onClick={() => openAuthModal('signup')}
                    className="px-3 sm:px-5 py-2 sm:py-2.5 text-[10px] sm:text-xs font-black text-white bg-stone-700 hover:bg-neutral-900 uppercase tracking-wider sm:tracking-widest transition rounded-xl flex items-center gap-1.5 sm:gap-2"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    {copy.createAccount}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className={cn(
        "pt-16 sm:pt-20 pb-8 sm:pb-12 px-3 sm:px-8 lg:pb-6 lg:flex lg:flex-col",
        bookingStep === 1 && ""
      )}>
        <div className="max-w-6xl mx-auto lg:flex lg:flex-col">
          {/* Hero + Progress */}
          <div className="mb-6 sm:mb-8 lg:mb-4 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div className="text-center lg:text-left">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-stone-800 leading-tight mb-2">
                {copy.title}
              </h1>
              <p className="text-stone-500 font-medium text-sm sm:text-base max-w-2xl mx-auto lg:mx-0">
                {copy.subtitle}
              </p>
            </div>

            <div className="mt-6 lg:mt-0">
              <div className="flex items-start justify-center lg:justify-end">
                {[
                  { step: 1, label: copy.stepService },
                  { step: 2, label: copy.stepDetails },
                  { step: 3, label: copy.stepDate },
                  { step: 4, label: copy.stepPayment }
                ].map(({ step, label }, index, items) => (
                  <React.Fragment key={step}>
                    <div className="flex flex-col items-center min-w-[44px] sm:min-w-[56px]">
                      <div className={cn(
                        "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm transition-all border",
                        bookingStep > step
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : bookingStep === step
                            ? "bg-stone-800 border-stone-800 text-white shadow-md"
                            : "bg-white border-stone-200 text-stone-400"
                      )}>
                        {bookingStep > step ? (
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : step}
                      </div>
                      <span className={cn(
                        "hidden xs:block mt-2 text-[9px] sm:text-[10px] font-medium tracking-wide text-center",
                        bookingStep === step ? "text-stone-600" : "text-stone-400"
                      )}>
                        {label}
                      </span>
                    </div>
                    {index < items.length - 1 && (
                      <div className={cn(
                        "w-6 sm:w-12 md:w-16 h-0.5 sm:h-1 rounded-full transition-all mt-4 sm:mt-5 mx-2 sm:mx-3 md:mx-4",
                        bookingStep > step ? "bg-emerald-400" : "bg-stone-100"
                      )} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content Card */}
          <div className="bg-white rounded-[24px] sm:rounded-[40px] shadow-xl sm:shadow-2xl overflow-hidden border border-neutral-100">
            <div className="p-4 sm:p-6 lg:p-6">
              
              {/* Step 1: Select Service */}
              {bookingStep === 1 && (
                <div className="space-y-6 lg:space-y-4">
                  <div className="text-center mb-4">
                    <h2 className="text-xl sm:text-2xl font-semibold text-stone-800">{copy.servicesTitle}</h2>
                  </div>

                  {services.length === 0 ? (
                    <div className="text-center py-12 sm:py-16">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-stone-50 rounded-[20px] sm:rounded-[24px] flex items-center justify-center mx-auto mb-4 sm:mb-6">
                        <svg className="w-8 h-8 sm:w-10 sm:h-10 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <p className="text-stone-500 font-medium text-sm sm:text-base">{copy.noServicesNow}</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute -top-10 right-6 h-28 w-28 rounded-full bg-stone-100/60 blur-2xl" />
                      <div className="absolute bottom-8 left-4 h-24 w-24 rounded-full bg-amber-100/70 blur-2xl" />
                      <div className={cn(
                        "relative rounded-[28px] border p-4 sm:p-6",
                        activeGroupTone.panelBorder,
                        activeGroupTone.panel
                      )}>
                        <div className="grid gap-6 lg:grid-cols-[minmax(250px,290px)_1fr]">
                          <div className="space-y-3 lg:sticky lg:top-6 lg:self-start">
                            <div className="relative">
                              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <input
                                type="text"
                                value={serviceSearch}
                                onChange={(event) => setServiceSearch(event.target.value)}
                                placeholder={copy.search}
                                className="w-full rounded-2xl border border-stone-200 bg-white py-3 pl-10 pr-10 text-sm font-medium text-stone-700 placeholder:text-stone-400 focus:border-stone-300 focus:outline-none"
                              />
                              {serviceSearch && (
                                <button
                                  type="button"
                                  onClick={() => setServiceSearch('')}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                                  aria-label={copy.clearSearch}
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>

                            <div className="sm:hidden">
                              <select
                                value={activeCategory || ''}
                                onChange={(event) => setSelectedCategory(event.target.value as MajorGroupKey)}
                                className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 focus:border-stone-300 focus:outline-none"
                              >
                                {groupedCatalog.map((group, index) => (
                                  <option key={group.key} value={group.key}>
                                    {index + 1}. {group.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="hidden sm:block rounded-2xl border border-stone-200 bg-white px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                                {copy.mainGroups}
                              </p>
                              <p className="mt-1 text-xs text-stone-400">
                                {visibleCategories.length} {copy.groups} · {totalVisibleServices} {copy.services}
                              </p>
                            </div>

                            <div className="hidden sm:flex max-h-[560px] gap-3 overflow-y-auto pb-2 lg:flex-col lg:pb-0 lg:pr-2">
                              {groupedCatalog.map((group, index) => {
                                const isActive = group.key === activeCategory;
                                const groupTone = GROUP_TONE[group.key];
                                const priceLabel = group.count === 0
                                  ? copy.unavailable
                                  : `${copy.from} ${formatCurrency(group.minPrice)}`;
                                const durationLabel = `${group.minDuration}-${group.maxDuration} min`;

                                return (
                                  <button
                                    key={group.key}
                                    onClick={() => setSelectedCategory(group.key)}
                                    className={cn(
                                      "min-w-[220px] rounded-[18px] border px-4 py-3.5 text-left transition-all relative",
                                      isActive
                                        ? cn(groupTone.activeCard, "shadow-sm ring-2 ring-white/60")
                                        : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50"
                                    )}
                                  >
                                    {isActive && (
                                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        {copy.selected}
                                      </span>
                                    )}
                                    <div className="flex items-start justify-between gap-2">
                                      <span className={cn("text-sm font-semibold", isActive ? groupTone.activeTitle : "text-stone-700")}>
                                        {index + 1}. {group.label}
                                      </span>
                                      <span className={cn("text-xs", isActive ? groupTone.activeMeta : "text-stone-400")}>{group.count}</span>
                                    </div>
                                    <div className={cn("mt-2 flex items-center justify-between text-xs", isActive ? groupTone.activeMeta : "text-stone-500")}>
                                      <span>{priceLabel}</span>
                                      {durationLabel && <span>{durationLabel}</span>}
                                    </div>
                                    <div
                                      className={cn(
                                        "mt-3 h-1 rounded-full bg-gradient-to-r",
                                        isActive
                                          ? groupTone.activeBar
                                          : "from-stone-200 to-transparent"
                                      )}
                                    />
                                  </button>
                                );
                              })}
                            </div>
                            {groupedCatalog.length > 4 && (
                              <div className="hidden lg:flex items-center justify-center text-[11px] text-stone-400">
                                {copy.scrollForMoreGroups}
                              </div>
                            )}
                          </div>
                          <div className={cn(
                            "rounded-[24px] border bg-white/95 p-4 sm:p-6 shadow-sm backdrop-blur-sm",
                            activeGroupTone.panelBorder
                          )}>
                            {!activeGroup || activeGroup.count === 0 ? (
                              <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/60 p-8 text-center">
                                <p className="text-sm font-medium text-stone-600">
                                  {copy.noServicesForGroup}
                                </p>
                                <p className="mt-1 text-xs text-stone-400">
                                  {copy.noServicesForGroupHint}
                                </p>
                              </div>
                            ) : (
                            <div className="space-y-6">
                              {activeGroup.subgroups.map((subgroup) => (
                                <div key={subgroup.key} className="space-y-3">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4 lg:pr-2">
                              {subgroup.services.map((service) => {
                                const hasEmployees = (service.employees?.length ?? 0) > 0;
                                const isActive = service.isActive;
                                const isRestrictedOnline = isOnlineBookingRestricted(service);
                                const canBook = isActive && hasEmployees && !isRestrictedOnline;
                                const specialistCount = service.employees?.length || 0;

                                return (
                                  <button
                                    key={service.id}
                                    onClick={() => canBook && selectService(service)}
                                    disabled={!canBook}
                                    className={cn(
                                      "group rounded-[18px] border p-4 text-left transition-all",
                                      canBook
                                        ? cn("border-stone-200 bg-white hover:-translate-y-0.5 hover:shadow-lg", activeGroupTone.serviceHover)
                                        : "cursor-not-allowed border-stone-200 bg-stone-50/70"
                                    )}
                                  >
                                  <div className="mb-2">
                                    {canBook ? (
                                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">{copy.availableBadge}</span>
                                    ) : !isActive ? (
                                      <span className="inline-flex rounded-full bg-stone-200 px-2.5 py-1 text-[10px] font-semibold text-stone-600">{copy.hidden}</span>
                                    ) : isRestrictedOnline ? (
                                      <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-semibold text-rose-700">{copy.consultationRequired}</span>
                                    ) : (
                                      <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-700">
                                        {copy.noSpecialist}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-base font-semibold text-stone-800 leading-snug line-clamp-2">
                                        {service.serviceName}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-2xl leading-none font-semibold text-stone-700">
                                        {formatCurrency(service.price)}
                                      </p>
                                      <p className="text-xs text-stone-400 mt-1">{service.duration} min</p>
                                    </div>
                                  </div>

                                  {hasEmployees ? (
                                    <p className="mt-3 text-xs text-stone-500">
                                      {specialistCount} {specialistCount === 1 ? copy.specialistSingular : copy.specialistPlural}
                                    </p>
                                  ) : null}

                                  <div className="mt-4 pt-3 border-t border-stone-100">
                                    {canBook ? (
                                      <span className={cn("inline-flex w-full items-center justify-center gap-1 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-white transition-all", activeGroupTone.serviceButton)}>
                                        {copy.book}
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                      </span>
                                    ) : !isActive ? (
                                      <span className="text-stone-400 text-[11px] font-medium">
                                        {copy.hidden}
                                      </span>
                                    ) : isRestrictedOnline ? (
                                      <span className="text-rose-600 text-[11px] font-medium">
                                        {copy.onlineBookingUnavailable}
                                      </span>
                                    ) : (
                                      <span className="text-stone-500 text-[11px] font-medium">
                                        {copy.unavailable}
                                      </span>
                                    )}
                                  </div>
                                  </button>
                                );
                              })}
                                  </div>
                                </div>
                              ))}
                            </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Logged-in user welcome */}
                  {user && (
                    <div className="bg-stone-50 rounded-[24px] p-6 border border-stone-100">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-black text-stone-800 uppercase tracking-tight">
                            {copy.hello}, {user.firstName || user.email?.split('@')[0]}!
                          </p>
                          <p className="text-sm text-stone-600">{copy.autoSaveBooking}</p>
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
                  <div className="bg-gradient-to-r from-neutral-800 to-stone-900 rounded-[24px] p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">{copy.selectedService}</p>
                        <p className="text-xl font-black uppercase tracking-tight">{selectedService.serviceName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black">{formatCurrency(selectedService.price)}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">{selectedService.duration} min</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-neutral-800 uppercase tracking-tight mb-2">{copy.yourDetails}</h2>
                    <p className="text-neutral-500 font-medium">{copy.contactPrompt}</p>
                  </div>

                  {/* Smart Login Prompt - Non-intrusive */}
                  {!user && (
                    <div className="bg-gradient-to-r from-stone-50 to-amber-50 border-2 border-stone-200 rounded-[24px] p-4 sm:p-6 mb-6">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-stone-700 flex items-center justify-center">
                          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm sm:text-base font-black text-neutral-900 mb-1">{copy.alreadyHaveAccount}</p>
                          <p className="text-xs sm:text-sm text-neutral-600 font-medium mb-3">
                            {copy.loginAutofill}
                          </p>
                          <div className="flex flex-col xs:flex-row gap-2">
                            <button
                              onClick={() => openAuthModal('login')}
                              className="px-4 py-2.5 bg-neutral-900 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-stone-700 transition-all"
                            >
                              {copy.iHaveAccount}
                            </button>
                            <button
                              onClick={() => openAuthModal('signup')}
                              className="px-4 py-2.5 border-2 border-neutral-900 text-neutral-900 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-neutral-900 hover:text-white transition-all"
                            >
                              {copy.createFreeAccount}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">{copy.yourName}</label>
                      <input 
                        value={formData.name} 
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                        placeholder={copy.namePlaceholder}
                        className="w-full px-6 py-4 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-800 font-bold focus:border-stone-600 transition-all outline-none"
                      />
                      {!formData.name.trim() && (
                        <p className="mt-2 text-xs text-amber-700">{copy.fullNameHint}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">{copy.yourEmail}</label>
                      <input 
                        type="email" 
                        value={formData.email} 
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                        placeholder={copy.emailPlaceholder}
                        className="w-full px-6 py-4 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-800 font-bold focus:border-stone-600 transition-all outline-none"
                      />
                      {formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()) && (
                        <p className="mt-2 text-xs text-amber-700">{copy.validEmailHint}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">{copy.yourPhone}</label>
                      <input 
                        type="tel" 
                        value={formData.phone} 
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                        placeholder="+34 600 000 000" 
                        className="w-full px-6 py-4 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-800 font-bold focus:border-stone-600 transition-all outline-none"
                      />
                      {!formData.phone.trim() && (
                        <p className="mt-2 text-xs text-amber-700">{copy.phoneHint}</p>
                      )}
                    </div>
                  </div>

                  {/* Employee Selection */}
                  {serviceEmployees.length > 1 && (
                    <div className="pt-6 border-t border-neutral-100">
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">{copy.chooseSpecialist}</label>
                      {serviceEmployees.length === 0 ? (
                        <div className="p-8 bg-neutral-50 rounded-2xl text-center">
                          <div className="w-3 h-3 rounded-full bg-stone-700 animate-ping mx-auto mb-4" />
                          <p className="text-neutral-500 font-medium">{copy.loadingSpecialists}</p>
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
                                  ? "border-stone-700 bg-stone-50/50 shadow-lg"
                                  : "border-neutral-100 bg-white hover:border-stone-200 hover:shadow-md"
                              )}
                            >
                              {/* Checkmark for selected */}
                              {formData.employeeId === emp.id && (
                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-stone-700 flex items-center justify-center z-10">
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
                                  <div className="w-full h-full bg-gradient-to-br from-stone-500 to-stone-700 flex items-center justify-center text-white font-black text-xl">
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
                                  <p className="text-[9px] font-bold text-stone-700 uppercase tracking-widest truncate">{emp.position}</p>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {!formData.employeeId && (
                        <p className="mt-3 text-xs text-amber-700">{copy.chooseSpecialistHint}</p>
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
                            <div className="w-full h-full bg-stone-700 text-white flex items-center justify-center font-black text-xs">
                              {serviceEmployees[0].firstName[0]}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">{copy.assignedSpecialist}</p>
                          <p className="font-black text-neutral-900 uppercase tracking-tight">{serviceEmployees[0].firstName} {serviceEmployees[0].lastName}</p>
                        </div>
                        <div className="ml-auto w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center">
                          <svg className="w-4 h-4 text-stone-600" fill="currentColor" viewBox="0 0 20 20">
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
                    <h2 className="text-2xl font-black text-neutral-800 uppercase tracking-tight">{copy.dateAndTime}</h2>
                  </div>

                  <div>
                    {formData.employeeId && selectedService?.id ? (
                      <AvailabilityCalendar
                        selectedDate={formData.date}
                        onDateSelect={(date) => setFormData({ ...formData, date, time: '' })}
                        employeeId={formData.employeeId}
                        serviceId={selectedService.id}
                        minDate={getLocalDateKey()}
                        isConsultation={false}
                      />
                    ) : (
                      <div className="p-8 bg-neutral-50 rounded-2xl text-center border-2 border-dashed border-neutral-200">
                        <p className="text-neutral-400 font-bold">{copy.selectEmployeeFirst}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">{copy.selectTime}</label>
                    {!formData.date ? (
                      <div className="p-8 bg-neutral-50 rounded-2xl text-center border-2 border-dashed border-neutral-200">
                        <p className="text-neutral-400 font-bold">{copy.pickDateFirst}</p>
                      </div>
                    ) : loadingSlots ? (
                      <div className="p-8 bg-neutral-50 rounded-2xl text-center">
                        <div className="w-3 h-3 rounded-full bg-stone-700 animate-ping mx-auto mb-4" />
                        <p className="text-neutral-500 font-medium">{copy.searchingTimes}</p>
                      </div>
                    ) : slotsError ? (
                      <div className="p-8 bg-amber-50 rounded-2xl text-center border border-amber-200">
                        <p className="text-amber-700 font-bold">{slotsError}</p>
                        <p className="text-amber-600 text-sm mt-2">{copy.tryAnotherDate}</p>
                      </div>
                    ) : availableSlots.filter(s => s.available).length === 0 ? (
                      <div className="p-8 bg-neutral-50 rounded-2xl text-center border border-neutral-200">
                        <p className="text-neutral-700 font-bold">{copy.noSlotsAvailable}</p>
                        <p className="text-neutral-500 text-sm mt-2">{copy.tryAnotherDate}</p>
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
                                ? "bg-stone-700 text-white shadow-xl shadow-stone-200"
                                : "bg-white border-2 border-neutral-100 text-neutral-600 hover:border-stone-300 hover:text-stone-700"
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
                      <div className="w-24 h-24 bg-stone-50 rounded-[32px] flex items-center justify-center mx-auto mb-8">
                        <svg className="w-12 h-12 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h2 className="text-3xl font-black text-neutral-800 uppercase tracking-tight mb-4">{copy.bookingConfirmed}</h2>
                      <p className="text-neutral-500 font-medium mb-8 max-w-md mx-auto">
                        {copy.confirmationEmail} {formData.email}. {copy.weAreWaiting}
                      </p>
                      
                      <div className="bg-neutral-50 rounded-[24px] p-8 mb-8 text-left">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">{copy.service}</p>
                            <p className="font-bold text-neutral-800">{selectedService.serviceName}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">{copy.professional}</p>
                            <p className="font-bold text-neutral-800">
                              {serviceEmployees.find(e => e.id === formData.employeeId)?.firstName}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">{copy.date}</p>
                            <p className="font-bold text-neutral-800">{formatDisplayDate(formData.date)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">{copy.time}</p>
                            <p className="font-bold text-neutral-800">{formData.time}</p>
                          </div>
                        </div>
                      </div>

                      {/* Encourage account creation */}
                      {!user ? (
                        <div className="bg-gradient-to-r from-stone-700 to-stone-800 rounded-[24px] p-8 text-white mb-8">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <p className="font-black uppercase tracking-tight">{copy.dontLoseBooking}</p>
                              <p className="text-white/80 text-sm">{copy.createAccountManage}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => openAuthModal('signup')}
                            className="w-full px-6 py-4 bg-white text-stone-700 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-neutral-100 transition-all flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                            {copy.createMyAccountNow}
                          </button>
                        </div>
                      ) : (
                        <div className="bg-stone-50 rounded-[24px] p-6 border border-stone-100 mb-8">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center">
                              <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <p className="font-black text-stone-800 uppercase tracking-tight">{copy.bookingSavedInAccount}</p>
                              <p className="text-sm text-stone-600">{copy.bookingManageFromMyBookings}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        {user ? (
                          <Link
                            href="/client/bookings"
                            className="px-8 py-4 bg-stone-700 text-white font-bold uppercase tracking-widest rounded-2xl hover:bg-neutral-800 transition-all text-center"
                          >
                            {copy.viewMyBookings}
                          </Link>
                        ) : (
                          <button
                            onClick={() => openAuthModal('login')}
                            className="px-8 py-4 bg-neutral-100 text-neutral-700 font-bold uppercase tracking-widest rounded-2xl hover:bg-neutral-200 transition-all"
                          >
                            {copy.iHaveAccount}
                          </button>
                        )}
                        <Link
                          href="/"
                          className="px-8 py-4 bg-neutral-100 text-neutral-700 font-bold uppercase tracking-widest rounded-2xl hover:bg-neutral-200 transition-all text-center"
                        >
                          {copy.backHome}
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-center mb-8">
                        <h2 className="text-2xl font-black text-neutral-800 uppercase tracking-tight mb-2">{copy.confirmAndPay}</h2>
                        <p className="text-neutral-500 font-medium">{copy.reviewAndPay}</p>
                      </div>

                      {/* Booking Summary */}
                      <div className="bg-neutral-50 rounded-[24px] p-8 space-y-4">
                        <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
                          <span className="text-neutral-600 font-medium">{copy.service}</span>
                          <span className="font-bold text-neutral-800">{selectedService.serviceName}</span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
                          <span className="text-neutral-600 font-medium">{copy.professional}</span>
                          <span className="font-bold text-neutral-800">
                            {serviceEmployees.find(e => e.id === formData.employeeId)?.firstName} {serviceEmployees.find(e => e.id === formData.employeeId)?.lastName}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
                          <span className="text-neutral-600 font-medium">{copy.date}</span>
                          <span className="font-bold text-neutral-800">{formatDisplayDate(formData.date)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
                          <span className="text-neutral-600 font-medium">{copy.time}</span>
                          <span className="font-bold text-neutral-800">{formData.time}</span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
                          <span className="text-neutral-600 font-medium">{copy.deposit}</span>
                          <span className="font-black text-stone-700 text-lg">{depositDisplay}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-600 font-medium">{copy.remainingAtSalon}</span>
                          <span className="font-bold text-neutral-800">{formatCurrency(remainingBalance)}</span>
                        </div>
                      </div>

                      {/* Payment Form */}
                      <div className="bg-white rounded-[24px] p-8 border-2 border-neutral-100 space-y-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="font-bold text-neutral-800">{copy.paymentDetails}</p>
                            <p className="text-sm text-neutral-500">{copy.secureCardPayment}</p>
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
                            {copy.paymentsUnavailable}
                          </div>
                        )}

                        {paymentError && (
                          <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-sm">
                            {paymentError}
                          </div>
                        )}

                        <p className="text-xs text-neutral-400 text-center">
                          {copy.termsAcceptance}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              {!bookingSuccess && bookingStep > 1 && (
                <div className="max-w-2xl mx-auto mt-8 sm:mt-12 space-y-3">
                  {!stepValid && stepMissingItems.length > 0 && (
                    <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {copy.complete}: {stepMissingItems.join(', ')}
                    </div>
                  )}
                  <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
                    <button
                      onClick={back}
                      className="flex-1 py-4 sm:py-5 border-2 border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider sm:tracking-widest rounded-xl sm:rounded-2xl hover:bg-neutral-50 active:scale-[0.98] transition-all text-sm sm:text-base"
                    >
                      {bookingStep === 2 ? copy.change : copy.back}
                    </button>
                    <button
                      onClick={bookingStep === 4 ? handleSubmitBooking : next}
                      disabled={!stepValid || submitting || paymentLoading}
                      className="flex-1 py-4 sm:py-5 bg-stone-700 text-white font-bold uppercase tracking-wider sm:tracking-widest rounded-xl sm:rounded-2xl hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base"
                    >
                      {(submitting || paymentLoading) && (
                        <div className="w-3 h-3 rounded-full bg-white animate-ping" />
                      )}
                      {submitting || paymentLoading
                        ? copy.processing
                        : bookingStep === 4
                          ? `${copy.pay} ${depositDisplay}`
                          : copy.next}
                    </button>
                  </div>
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
