'use client';

import React, { Suspense, useMemo, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { Loading } from '@/shared/components/Loading';
import { ClientAuthModal } from '@/shared/components/ClientAuthModal';
import { buildBookingSuccessUrl } from '@/shared/lib/bookingSuccess';
import { formatCurrency, cn, getDateKeyInMadrid } from '@/shared/lib/utils';
import type { Service, Employee, BookingFormData, Client, ServiceCatalogConfig } from '@/shared/lib/types';
import { loadStripe, type Stripe, type StripeCardElement, type StripeElements } from '@stripe/stripe-js';
import Link from 'next/link';
import Image from 'next/image';
import { getClient, getServiceCatalogConfig } from '@/shared/lib/firestore';
import { AvailabilityCalendar } from '@/shared/components/AvailabilityCalendar';
import { useLanguage } from '@/shared/context/LanguageContext';
import { BrandLogo } from '@/shared/components/BrandLogo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { getLocalizedServiceDescription, getServiceDescriptionSearchText } from '@/shared/lib/serviceLocalization';
import { type ServiceMainGroupKey } from '@/shared/lib/serviceCategories';
import {
  compareServicesByDisplayOrder,
  DEFAULT_SALON_ID,
  getDefaultServiceCatalogConfig,
  getServiceGroupId,
  getServiceGroupLabel,
  getServiceSubgroupId,
  getServiceSubgroupLabel,
} from '@/shared/lib/serviceCatalog';
import {
  ArrowLeft,
  Check,
  LogIn,
} from 'lucide-react';

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

type MajorGroupKey = string;

type LocalizedSubgroup = {
  key: string;
  label: string;
};

const HAIR_SUBGROUP_ORDER = [
  'haircuts',
  'styling',
  'color',
  'bleach-highlights',
  'treatments-signature',
  'mens-services',
  'kids-cuts',
  'extensions',
] as const;

const BEAUTY_SUBGROUP_ORDER = [
  'lamination',
  'brow-services',
  'lash-extensions-full-set',
  'led-extensions',
  'lash-refill-infill',
  'lash-removal',
  'semi-permanent-makeup',
  'touch-up',
  'professional-makeup',
] as const;

const NAILS_SUBGROUP_ORDER = [
  'manicure',
  'pedicure',
  'with-cleaning',
  'without-cleaning',
] as const;

const SUBGROUP_NOTES: Partial<Record<MajorGroupKey, Record<string, { es: string; en: string }>>> = {
  hair: {
    haircuts: {
      en: 'When a haircut is added to any women service, haircut price is EUR 56 instead of EUR 78.',
      es: 'Al añadir corte de pelo a cualquier servicio para mujer, el precio del corte es de 56 EUR en lugar de 78 EUR.',
    },
    color: {
      en: 'Each color service includes blow dry.',
      es: 'Cada servicio de color incluye lavado y peinado.',
    },
    'bleach-highlights': {
      en: 'Consultation required. Online booking unavailable. Includes toning, K18 and blow dry.',
      es: 'Consulta previa obligatoria. No disponible para reserva online. Incluye tonalización, K18, lavado y peinado.',
    },
    'treatments-signature': {
      en: 'Includes blow dry.',
      es: 'Incluye lavado y peinado.',
    },
    'mens-services': {
      en: 'Hair wash and blow dry included.',
      es: 'Incluyen lavado y peinado.',
    },
    extensions: {
      en: 'If hair purchase is required, a prior consultation is mandatory before booking.',
      es: 'Si se requiere compra de cabello, la consulta previa es obligatoria antes de reservar.',
    },
  },
  'beauty-face': {
    lamination: {
      en: 'Lash and brow tint are included in lamination services.',
      es: 'La tintura de pestañas y cejas está incluida en los servicios de laminación.',
    },
    'brow-services': {
      en: 'Brow services in this subgroup are provided without lamination.',
      es: 'Los servicios de esta sección se realizan sin laminación.',
    },
    'semi-permanent-makeup': {
      en: 'Initial procedures include a 6-week touch-up in the price.',
      es: 'Los procedimientos iniciales incluyen un retoque a las 6 semanas en el precio.',
    },
    'touch-up': {
      en: 'Touch-up has a fixed price regardless of the initial semi-permanent procedure.',
      es: 'El retoque tiene precio fijo independientemente del procedimiento inicial.',
    },
  },
  nails: {
    manicure: {
      en: 'Gel, refill and extension services include manicure and removal of previous material.\nBasic design for 1-2 nails (stones, stickers, glitter) included.\nFrench included.\nWe do not offer hand-painted designs.',
      es: 'Los servicios de gel, relleno y extensiones incluyen manicura y retirada del material previo.\nDiseno basico para 1-2 unas (piedras, pegatinas, brillos) incluido.\nFrench incluido.\nNo realizamos disenos pintados a mano.',
    },
    pedicure: {
      en: 'Sole treatments use professional KART products and are recommended in winter or 2 weeks before/after sun or sea exposure.\nA salon consultation is required before these treatments to create a personalized protocol.\nClients with diabetes or neuropathy should not book these treatments; medical protocol is required.',
      es: 'Los tratamientos de planta se realizan con productos profesionales KART y se recomiendan en invierno o 2 semanas antes/despues de exposicion al sol o al mar.\nAntes del tratamiento se realiza consulta en salon para crear un protocolo personalizado.\nLas personas con diabetes o neuropatia no deben reservar estas sesiones; se requiere protocolo medico.',
    },
    'with-cleaning': {
      en: 'Combinations with classic cleaning of the sole of the foot.',
      es: 'Combinaciones con limpieza clasica de la planta del pie.',
    },
    'without-cleaning': {
      en: 'Combinations without cleaning of the sole of the foot.',
      es: 'Combinaciones sin limpieza de la planta del pie.',
    },
  },
};

const getHairSubgroup = (service: Service, language: 'es' | 'en'): LocalizedSubgroup => {
  const category = (service.category || '').toLowerCase();
  const name = service.serviceName.toLowerCase();
  const es = language === 'es';

  const toLabel = (key: string): LocalizedSubgroup => {
    if (key === 'haircuts') return { key, label: es ? 'Cortes' : 'Haircuts' };
    if (key === 'styling') return { key, label: es ? 'Peinado' : 'Styling' };
    if (key === 'color') return { key, label: es ? 'Color' : 'Color' };
    if (key === 'bleach-highlights') return { key, label: es ? 'Decoloración y mechas' : 'Bleach & Highlights' };
    if (key === 'treatments-signature') return { key, label: es ? 'Tratamientos & Tratamientos Signature' : 'Treatments & Signature Treatments' };
    if (key === 'mens-services') return { key, label: es ? 'Servicios para hombre' : "Men's Services" };
    if (key === 'kids-cuts') return { key, label: es ? 'Cortes infantiles' : 'Kids Cuts' };
    return { key: 'extensions', label: es ? 'Extensiones' : 'Extensions' };
  };

  if (category === 'hair-men' || /(beard|barba|caballero|grey|canas|waxing|depilaci)/.test(name)) {
    return toLabel('mens-services');
  }
  if (category === 'hair-kids' || /(girls|boys|niñ|hasta 9|9-14|9–14|y\\.o)/.test(name)) {
    return toLabel('kids-cuts');
  }
  if (category === 'hair-extensions' || /(extension|capsulation|capsulaci|retirada)/.test(name)) {
    return toLabel('extensions');
  }
  if (category === 'hair-bleach-highlights' || /(airtouch|highlight|mechas|decolor|contouring)/.test(name)) {
    return toLabel('bleach-highlights');
  }
  if (category === 'hair-color' || /(roots|root|ra[ií]z|re-growth|highlift|tint|color|colour|toning|tonalizaci[oó]n|matiz)/.test(name)) {
    return toLabel('color');
  }
  if (category === 'hair-treatments-signature' || /(tokio|nashi|brae|therapy|tratamiento|treatment|inkarami)/.test(name)) {
    return toLabel('treatments-signature');
  }
  if (category === 'hair-haircuts-styling') {
    if (/(haircut|corte|flequillo|fringe|trim)/.test(name)) {
      return toLabel('haircuts');
    }
    return toLabel('styling');
  }
  if (/(haircut|corte|flequillo|fringe|trim)/.test(name)) {
    return toLabel('haircuts');
  }
  if (/(blow dry|peinado|recogido|hair up)/.test(name)) {
    return toLabel('styling');
  }

  return toLabel('styling');
};

const getBeautySubgroup = (service: Service, language: 'es' | 'en'): LocalizedSubgroup => {
  const category = (service.category || '').toLowerCase();
  const name = service.serviceName.toLowerCase();
  const es = language === 'es';

  const toLabel = (key: string): LocalizedSubgroup => {
    if (key === 'lamination') return { key, label: es ? 'Laminación' : 'Lamination' };
    if (key === 'brow-services') return { key, label: es ? 'Servicios de Cejas (sin laminación)' : 'Brow Services (without lamination)' };
    if (key === 'lash-extensions-full-set') return { key, label: es ? 'Extensiones de Pestañas - Aplicación completa' : 'Lash Extensions - Full Set' };
    if (key === 'led-extensions') return { key, label: es ? 'Extensiones LED' : 'LED Extensions' };
    if (key === 'lash-refill-infill') return { key, label: es ? 'Corrección y Relleno de Extensiones' : 'Lash Extension Refill / Infill' };
    if (key === 'lash-removal') return { key, label: es ? 'Retirada de Extensiones de Pestañas' : 'Lash Extension Removal' };
    if (key === 'semi-permanent-makeup') return { key, label: es ? 'Maquillaje Semipermanente' : 'Semi-Permanent Makeup' };
    if (key === 'touch-up') return { key, label: es ? 'Retoque' : 'Touch-up' };
    return { key: 'professional-makeup', label: es ? 'Maquillaje Profesional' : 'Professional Makeup' };
  };

  if (category === 'beauty-lamination' || /(laminat|laminaci)/.test(name)) {
    return toLabel('lamination');
  }
  if (category === 'beauty-brow-services' || /(brow|ceja|bigote|upper lip|nose waxing|nariz|ear waxing|oreja)/.test(name)) {
    return toLabel('brow-services');
  }
  if (category === 'beauty-lash-extensions-full-set') {
    return /(led)/.test(name) ? toLabel('led-extensions') : toLabel('lash-extensions-full-set');
  }
  if (category === 'beauty-lash-refill-infill' || /(refill|infill|relleno|correcci)/.test(name)) {
    return toLabel('lash-refill-infill');
  }
  if (category === 'beauty-lash-removal' || /(lash removal|retirada de extensiones)/.test(name)) {
    return toLabel('lash-removal');
  }
  if (category === 'beauty-semi-permanent-makeup') {
    return /(touch[- ]?up|retoque)/.test(name) ? toLabel('touch-up') : toLabel('semi-permanent-makeup');
  }
  if (category === 'beauty-professional-makeup') {
    return toLabel('professional-makeup');
  }
  if (/(touch[- ]?up|retoque)/.test(name)) {
    return toLabel('touch-up');
  }
  if (/(powder|cejas efecto polvo|eyeliner|labios|lips|semi[- ]?permanent|semipermanente|lash density|contorno de ojos)/.test(name)) {
    return toLabel('semi-permanent-makeup');
  }
  if (/(led)/.test(name)) {
    return toLabel('led-extensions');
  }
  if (/(lash|pestañ|volumen|classic 1:1|wet look|mega volume|extensiones)/.test(name)) {
    return toLabel('lash-extensions-full-set');
  }

  return toLabel('professional-makeup');
};

const getManicurePedicureSubgroup = (service: Service, language: 'es' | 'en'): LocalizedSubgroup => {
  const category = (service.category || '').toLowerCase();
  const name = service.serviceName.toLowerCase();
  const es = language === 'es';

  if (
    category === 'manicure' ||
    category === 'nail-art-care-manicure' ||
    /(manicur|gel|relleno|refill|french|higienic manicure|retirada de gel|gel removal)/.test(name)
  ) {
    return { key: 'manicure', label: es ? 'Manicura' : 'Manicure' };
  }

  return { key: 'pedicure', label: es ? 'Pedicura' : 'Pedicure' };
};

const getCombinationsSubgroup = (service: Service, language: 'es' | 'en'): LocalizedSubgroup => {
  const name = service.serviceName.toLowerCase();
  const es = language === 'es';

  if (name.includes('sin limpieza') || name.includes('without cleaning')) {
    return {
      key: 'without-cleaning',
      label: es
        ? 'Sin limpieza de la planta del pie'
        : 'Without cleaning of the sole of the foot',
    };
  }

  return {
    key: 'with-cleaning',
    label: es
      ? 'Con limpieza clasica de la planta del pie'
      : 'With classic cleaning of the sole of the foot',
  };
};

const MAJOR_GROUP_ORDER: MajorGroupKey[] = ['beauty-face', 'nails', 'hair', 'estetica'];
const BOOKING_GROUP_ORDER: MajorGroupKey[] = ['beauty-face', 'nails', 'hair', 'estetica'];

const STEP1_GROUP_CONFIG: Array<{ key: MajorGroupKey; name: string }> = [
  { key: 'beauty-face', name: 'Brows, Lashes, Permanent Makeup & Makeup' },
  { key: 'nails', name: 'Manicure, Pedicure & Combinations' },
  { key: 'hair', name: 'Hair' },
  { key: 'estetica', name: 'Estetica' },
];

const MAJOR_GROUP_META: Record<MajorGroupKey, { es: string; en: string }> = {
  'beauty-face': {
    es: 'Cejas, Pestanas, Maquillaje Permanente y Maquillaje',
    en: 'Brows, Lashes, Permanent Makeup & Makeup',
  },
  nails: {
    es: 'Manicura, Pedicura y Combinaciones',
    en: 'Manicure, Pedicure & Combinations',
  },
  hair: { es: 'Peluqueria', en: 'Hair' },
  estetica: { es: 'Estetica', en: 'Estetica' },
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
  nails: {
    activeCard: 'border-amber-300 bg-amber-50/70',
    activeTitle: 'text-amber-900',
    activeMeta: 'text-amber-700',
    activeBar: 'from-amber-400/80 via-amber-300/60 to-transparent',
    badge: 'bg-amber-100',
    badgeText: 'text-amber-700',
    panel: 'bg-amber-50/30',
    panelBorder: 'border-amber-200/70',
    serviceHover: 'hover:border-amber-300 hover:shadow-amber-100/70',
    serviceButton: 'bg-amber-700 group-hover:bg-amber-800',
    subgroupBand: 'bg-amber-50 border-amber-100',
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
  'beauty-face': {
    activeCard: 'border-amber-300 bg-amber-50/70',
    activeTitle: 'text-amber-900',
    activeMeta: 'text-amber-700',
    activeBar: 'from-amber-400/80 via-amber-300/60 to-transparent',
    badge: 'bg-amber-100',
    badgeText: 'text-amber-700',
    panel: 'bg-amber-50/30',
    panelBorder: 'border-amber-200/70',
    serviceHover: 'hover:border-amber-300 hover:shadow-amber-100/70',
    serviceButton: 'bg-amber-700 group-hover:bg-amber-800',
    subgroupBand: 'bg-amber-50 border-amber-100',
  },
  estetica: {
    activeCard: 'border-violet-300 bg-violet-50/70',
    activeTitle: 'text-violet-900',
    activeMeta: 'text-violet-700',
    activeBar: 'from-violet-400/80 via-violet-300/60 to-transparent',
    badge: 'bg-violet-100',
    badgeText: 'text-violet-700',
    panel: 'bg-violet-50/30',
    panelBorder: 'border-violet-200/70',
    serviceHover: 'hover:border-violet-300 hover:shadow-violet-100/70',
    serviceButton: 'bg-violet-700 group-hover:bg-violet-800',
    subgroupBand: 'bg-violet-50 border-violet-100',
  },
};

const getMajorGroupForService = (service: Service): MajorGroupKey => {
  return getServiceGroupId(service);
};

const getServiceSubgroup = (service: Service, language: 'es' | 'en'): LocalizedSubgroup => {
  const category = service.category || 'other';
  const name = service.serviceName.toLowerCase();
  const es = language === 'es';
  const majorGroup = getMajorGroupForService(service);

  if (majorGroup === 'hair') {
    return getHairSubgroup(service, language);
  }
  if (majorGroup === 'beauty-face') {
    return getBeautySubgroup(service, language);
  }
  if (majorGroup === 'nails') {
    if (category === 'nail-art-care-combinations') {
      return getCombinationsSubgroup(service, language);
    }
    return getManicurePedicureSubgroup(service, language);
  }
  if (majorGroup === 'estetica') {
    return {
      key: 'lamination',
      label: language === 'es' ? 'Estetica' : 'Estetica',
    };
  }

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
    return getCombinationsSubgroup(service, language);
  }

  return { key: 'general', label: es ? 'Servicios' : 'Services' };
};

const isOnlineBookingRestricted = (service: Service): boolean => {
  return service.category === 'hair-bleach-highlights';
};

const sortSubgroupsForGroup = (
  groupKey: MajorGroupKey,
  subgroups: Array<{ key: string; label: string; services: Service[] }>
): Array<{ key: string; label: string; services: Service[] }> => {
  if (groupKey !== 'hair' && groupKey !== 'beauty-face' && groupKey !== 'nails') {
    return subgroups.sort((a, b) => a.label.localeCompare(b.label));
  }

  const subgroupOrder =
    groupKey === 'hair'
      ? HAIR_SUBGROUP_ORDER
      : groupKey === 'beauty-face'
        ? BEAUTY_SUBGROUP_ORDER
        : NAILS_SUBGROUP_ORDER;
  const orderIndex = new Map<string, number>(subgroupOrder.map((key, index) => [key, index]));
  return subgroups.sort((a, b) => {
    const aIndex = orderIndex.has(a.key) ? orderIndex.get(a.key)! : Number.MAX_SAFE_INTEGER;
    const bIndex = orderIndex.has(b.key) ? orderIndex.get(b.key)! : Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.label.localeCompare(b.label);
  });
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

function BookAllServicesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  
  const [services, setServices] = useState<Service[]>([]);
  const [catalogConfig, setCatalogConfig] = useState<ServiceCatalogConfig>(getDefaultServiceCatalogConfig(DEFAULT_SALON_ID));
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [expandedServiceDescriptions, setExpandedServiceDescriptions] = useState<string[]>([]);
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
        chooseServiceGroupTitle: 'Elige un grupo de servicios',
        chooseGroupStep: '1. Elige un grupo',
        chooseSubgroupStep: '2. Elige una categoria',
        chooseServiceStep: '3. Elige un servicio',
        stepProgressService: 'Elige servicio',
        stepProgressDetails: 'Datos',
        stepProgressDate: 'Fecha',
        stepProgressPayment: 'Pago',
        stepWord: 'Paso',
        ofWord: 'de',
        noServicesNow: 'No hay servicios disponibles en este momento',
        search: 'Buscar servicio o grupo...',
        clearSearch: 'Limpiar busqueda',
        mainGroups: 'Grupos principales',
        chooseGroupHint: '1. Elige un grupo para ver sus servicios.',
        groups: 'grupos',
        services: 'servicios',
        from: 'Desde',
        scrollForMoreGroups: 'Desliza para ver mas grupos',
        noServicesForGroup: 'No encontramos servicios para este grupo.',
        noServicesForGroupHint: 'Prueba con otro nombre o cambia de grupo.',
        selected: 'Seleccionado',
        currentGroup: 'Grupo actual',
        currentSubgroup: 'Subgrupo actual',
        currentService: 'Servicio actual',
        availableBadge: 'Disponible',
        hidden: 'Oculto',
        noSpecialist: 'Sin especialista',
        specialistSingular: 'especialista',
        specialistPlural: 'especialistas',
        book: 'Reservar',
        showMore: 'Ver mas',
        showLess: 'Ver menos',
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
        selectGroupValidation: 'Selecciona un grupo',
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
      chooseServiceGroupTitle: 'Choose a service group',
      chooseGroupStep: '1. Choose a group',
      chooseSubgroupStep: '2. Choose a category',
      chooseServiceStep: '3. Choose a service',
      stepProgressService: 'Choose service',
      stepProgressDetails: 'Details',
      stepProgressDate: 'Date',
      stepProgressPayment: 'Payment',
      stepWord: 'Step',
      ofWord: 'of',
      noServicesNow: 'No services are available right now',
      search: 'Search service or group...',
      clearSearch: 'Clear search',
      mainGroups: 'Main groups',
      chooseGroupHint: '1. Choose a group to see services.',
      groups: 'groups',
      services: 'services',
      from: 'From',
      scrollForMoreGroups: 'Scroll to view more groups',
      noServicesForGroup: 'No services were found for this group.',
      noServicesForGroupHint: 'Try another term or switch to a different group.',
      selected: 'Selected',
      currentGroup: 'Current group',
      currentSubgroup: 'Current subgroup',
      currentService: 'Current service',
      availableBadge: 'Available',
      hidden: 'Hidden',
      noSpecialist: 'No specialist',
      specialistSingular: 'specialist',
      specialistPlural: 'specialists',
      book: 'Book',
      showMore: 'Show more',
      showLess: 'Show less',
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
      selectGroupValidation: 'Select a group',
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
        return compareServicesByDisplayOrder(a, b);
      }
      if (serviceSort === 'durationAsc') {
        if (a.duration !== b.duration) return a.duration - b.duration;
        return compareServicesByDisplayOrder(a, b);
      }
      if (serviceSort === 'nameAsc') {
        return a.serviceName.localeCompare(b.serviceName);
      }
      return compareServicesByDisplayOrder(a, b);
    });
    return next;
  };

  const filteredServices = useMemo(() => {
    if (!normalizedServiceSearch) return services;

    return services.filter((service) => {
      const groupLabel = getServiceGroupLabel(service, catalogConfig, language).toLowerCase();
      const subgroupLabel = getServiceSubgroupLabel(service, catalogConfig, language).toLowerCase();

      return (
        service.serviceName.toLowerCase().includes(normalizedServiceSearch) ||
        getServiceDescriptionSearchText(service).includes(normalizedServiceSearch) ||
        subgroupLabel.includes(normalizedServiceSearch) ||
        groupLabel.includes(normalizedServiceSearch)
      );
    });
  }, [services, normalizedServiceSearch, language, catalogConfig]);

  const groupedCatalog = useMemo(() => {
    return catalogConfig.groups
      .map((group) => {
        const groupServices = filteredServices.filter((service) => getServiceGroupId(service) === group.id);
        const prices = groupServices.map((s) => s.price).filter((p) => typeof p === 'number');
        const durations = groupServices.map((s) => s.duration).filter((d) => typeof d === 'number');
        const subgroups = group.subgroups
          .map((subgroup) => ({
            key: subgroup.id,
            label: getServiceSubgroupLabel(
              { mainGroupId: group.id, subgroupId: subgroup.id, category: subgroup.id } as Service,
              catalogConfig,
              language
            ),
            services: sortServices(groupServices.filter((service) => getServiceSubgroupId(service) === subgroup.id)),
          }))
          .filter((subgroup) => subgroup.services.length > 0);

        return {
          key: group.id,
          label: getServiceGroupLabel({ mainGroupId: group.id, category: group.id } as Service, catalogConfig, language),
          count: groupServices.length,
          minPrice: prices.length ? Math.min(...prices) : 0,
          maxPrice: prices.length ? Math.max(...prices) : 0,
          minDuration: durations.length ? Math.min(...durations) : 0,
          maxDuration: durations.length ? Math.max(...durations) : 0,
          subgroups,
        };
      })
      .filter((group) => group.count > 0);
  }, [filteredServices, language, serviceSort, catalogConfig]);

  const visibleCategories = groupedCatalog.map((group) => group.key);
  const activeCategory = selectedCategory && visibleCategories.includes(selectedCategory as MajorGroupKey)
    ? selectedCategory
    : null;
  const activeGroup = activeCategory
    ? groupedCatalog.find((group) => group.key === activeCategory) || null
    : null;
  const totalVisibleServices = filteredServices.length;
  const activeGroupTone = activeGroup
    ? GROUP_TONE[activeGroup.key as ServiceMainGroupKey] || GROUP_TONE['beauty-face']
    : GROUP_TONE['beauty-face'];
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [pendingClientDataRefresh, setPendingClientDataRefresh] = useState<boolean>(false);
  const [bookingStep, setBookingStep] = useState<Step>(1);
  const [formData, setFormData] = useState<FormData>({
    name: '', email: '', phone: '', date: '', time: '', employeeId: '',
  });
  const [selectedSubgroupKey, setSelectedSubgroupKey] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const cardElementRef = useRef<StripeCardElement | null>(null);
  const paymentRequestRef = useRef<any>(null);
  const paymentRequestButtonRef = useRef<any>(null);
  const handledAuthQueryRef = useRef(false);
  const cardMountId = 'book-all-card-element';
  const paymentRequestMountId = 'book-all-wallet-element';
  const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  const [walletLabel, setWalletLabel] = useState<string | null>(null);
  const activeSubgroup = activeGroup && selectedSubgroupKey
    ? activeGroup.subgroups.find((subgroup) => subgroup.key === selectedSubgroupKey) || null
    : null;
  const mobileSubgroupChoices = activeGroup
    ? activeSubgroup
      ? [activeSubgroup]
      : activeGroup.subgroups
    : [];

  // Fetch all services
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const [response, config] = await Promise.all([
          fetch('/api/services?withEmployees=true'),
          getServiceCatalogConfig(DEFAULT_SALON_ID),
        ]);
        const data = await response.json();
        
        if (data.success) {
          const activeServices = (data.data as Service[]).filter((service) => service.isActive);
          setServices(activeServices);
        }
        setCatalogConfig(config);
      } catch (err) {
        console.error('Error fetching services:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  useEffect(() => {
    if (
      selectedCategory &&
      !visibleCategories.includes(selectedCategory as MajorGroupKey)
    ) {
      setSelectedCategory(null);
    }
  }, [selectedCategory, visibleCategories]);

  useEffect(() => {
    if (bookingStep !== 2 || !selectedService || !activeGroup) return;
    if (getMajorGroupForService(selectedService) !== activeGroup.key) return;

    const subgroupKey = getServiceSubgroupId(selectedService);
    if (activeGroup.subgroups.some((item) => item.key === subgroupKey)) {
      setSelectedSubgroupKey(subgroupKey);
    }
  }, [bookingStep, selectedService, activeGroup]);

  useEffect(() => {
    if (!activeGroup) {
      setSelectedSubgroupKey(null);
      return;
    }

    if (selectedSubgroupKey && !activeGroup.subgroups.some((subgroup) => subgroup.key === selectedSubgroupKey)) {
      setSelectedSubgroupKey(null);
    }
  }, [activeGroup, selectedSubgroupKey]);

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

  useEffect(() => {
    const walletAmount = depositAmount ?? Math.round((selectedService?.price || 0) * 50);
    if (bookingStep !== 4 || !stripePublicKey || !walletAmount) {
      setWalletLabel(null);
      if (paymentRequestButtonRef.current) {
        paymentRequestButtonRef.current.unmount();
        paymentRequestButtonRef.current = null;
      }
      paymentRequestRef.current = null;
      return;
    }

    let isActive = true;

    const setupPaymentRequest = async () => {
      if (!stripeRef.current) {
        stripeRef.current = await loadStripe(stripePublicKey);
      }
      if (!stripeRef.current) return;
      if (!elementsRef.current) {
        elementsRef.current = stripeRef.current.elements();
      }
      if (!elementsRef.current) return;

      if (paymentRequestButtonRef.current) {
        paymentRequestButtonRef.current.unmount();
        paymentRequestButtonRef.current = null;
      }

      const paymentRequest = stripeRef.current.paymentRequest({
        country: 'ES',
        currency: 'eur',
        total: {
          label: selectedService?.serviceName || 'Booking deposit',
          amount: walletAmount,
        },
        requestPayerName: true,
        requestPayerEmail: true,
        requestPayerPhone: true,
      });

      const wallet = await paymentRequest.canMakePayment();
      if (!isActive || !wallet) {
        setWalletLabel(null);
        return;
      }

      const nextWalletLabel = wallet.applePay ? 'Apple Pay' : wallet.googlePay ? 'Google Pay' : 'Fast checkout';
      setWalletLabel(nextWalletLabel);
      paymentRequestRef.current = paymentRequest;

      paymentRequest.on('paymentmethod', async (event: any) => {
        setSubmitting(true);
        setPaymentLoading(true);
        setPaymentError(null);

        try {
          if (!selectedService) {
            throw new Error(copy.serviceUnavailable);
          }

          const intent = await ensurePaymentIntent();
          const initialResult = await stripeRef.current!.confirmCardPayment(
            intent.clientSecret,
            {
              payment_method: event.paymentMethod.id,
            },
            { handleActions: false }
          );

          if (initialResult.error || !initialResult.paymentIntent) {
            event.complete('fail');
            throw new Error(initialResult.error?.message || copy.paymentCouldNotComplete);
          }

          event.complete('success');

          let confirmedPaymentIntent = initialResult.paymentIntent;
          if (confirmedPaymentIntent.status === 'requires_action') {
            const actionResult = await stripeRef.current!.confirmCardPayment(intent.clientSecret);
            if (actionResult.error || !actionResult.paymentIntent) {
              throw new Error(actionResult.error?.message || copy.paymentRetry);
            }
            confirmedPaymentIntent = actionResult.paymentIntent;
          }

          if (confirmedPaymentIntent.status !== 'succeeded') {
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
            paymentIntentId: confirmedPaymentIntent.id,
          };

          const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData),
          });

          const result = await response.json();
          if (!result.success) {
            throw new Error(result.error || copy.bookingCreateFailed);
          }

          setPaymentError(null);
          const selectedEmployee = serviceEmployees.find((employee) => employee.id === formData.employeeId);
          router.push(
            buildBookingSuccessUrl({
              bookingId: result.data?.id,
              serviceName: selectedService.serviceName,
              employeeName: selectedEmployee
                ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`.trim()
                : undefined,
              bookingDate: formData.date,
              bookingTime: formData.time,
              email: formData.email,
              depositAmount: depositAmount ? depositAmount / 100 : selectedService.price * 0.5,
              remainingBalance: selectedService.price - (depositAmount ? depositAmount / 100 : selectedService.price * 0.5),
            })
          );
        } catch (err: any) {
          console.error('Wallet booking error:', err);
          setPaymentError(err.message || copy.paymentProcessError);
        } finally {
          setSubmitting(false);
          setPaymentLoading(false);
        }
      });

      const button = elementsRef.current.create('paymentRequestButton', {
        paymentRequest,
        style: {
          paymentRequestButton: {
            type: 'book',
            theme: 'dark',
            height: '48px',
          },
        },
      });

      paymentRequestButtonRef.current = button;
      button.mount(`#${paymentRequestMountId}`);
    };

    setupPaymentRequest().catch((err) => {
      console.error('Error setting up wallet payment:', err);
      if (isActive) setWalletLabel(null);
    });

    return () => {
      isActive = false;
      if (paymentRequestButtonRef.current) {
        paymentRequestButtonRef.current.unmount();
        paymentRequestButtonRef.current = null;
      }
      paymentRequestRef.current = null;
    };
  }, [
    bookingStep,
    stripePublicKey,
    depositAmount,
    selectedService?.id,
    selectedService?.price,
    selectedService?.serviceName,
    formData.name,
    formData.email,
    formData.phone,
    formData.date,
    formData.time,
    formData.employeeId,
    copy,
    router,
    serviceEmployees,
  ]);

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
    setWalletLabel(null);
    if (cardElementRef.current) {
      cardElementRef.current.destroy();
      cardElementRef.current = null;
    }
    if (paymentRequestButtonRef.current) {
      paymentRequestButtonRef.current.unmount();
      paymentRequestButtonRef.current = null;
    }
    paymentRequestRef.current = null;
  };

  const handleClientLoginSuccess = async () => {
    setShowLoginModal(false);
    const redirectTarget = searchParams.get('redirect');
    if (redirectTarget) {
      router.push(redirectTarget);
      return;
    }
    // Mark that we need to refresh client data once auth state updates
    setPendingClientDataRefresh(true);
  };

  const openAuthModal = (mode: 'login' | 'signup') => {
    setAuthModalMode(mode);
    setShowLoginModal(true);
  };

  useEffect(() => {
    if (handledAuthQueryRef.current) return;

    const authMode = searchParams.get('auth');
    if (!authMode || user?.role === 'client') return;

    handledAuthQueryRef.current = true;
    openAuthModal(authMode === 'signup' ? 'signup' : 'login');
  }, [searchParams, user?.role]);

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
    setBookingStep(2);
    setSelectedService(null);
    setFormData({ name: '', email: '', phone: '', date: '', time: '', employeeId: '' });
    resetPaymentState();
  };

  const next = () => setBookingStep((s) => clampStep(s + 1));
  const back = () => {
    if (bookingStep === 2) {
      if (selectedService) {
        goBackToServices();
      } else {
        setBookingStep(1);
      }
    } else {
      setBookingStep((s) => clampStep(s - 1));
    }
  };

  const renderSubgroupCard = (subgroup: { key: string; label: string; services: Service[] }) => {
    const isSelected = selectedSubgroupKey === subgroup.key;

    return (
      <button
        key={subgroup.key}
        type="button"
        onClick={() =>
          setSelectedSubgroupKey((prev) => (prev === subgroup.key ? null : subgroup.key))
        }
        className={cn(
          'relative w-full rounded-[20px] sm:rounded-[16px] border px-5 sm:px-4 pr-12 py-4 sm:py-3 text-left transition-all',
          isSelected
            ? 'border-stone-700 bg-white shadow-sm ring-1 ring-stone-700/15'
            : 'border-stone-200/90 bg-stone-50/35 hover:border-stone-300 hover:bg-white'
        )}
      >
        <span
          className={cn(
            'pointer-events-none absolute right-4 top-1/2 -translate-y-1/2',
            isSelected ? 'text-stone-700' : 'text-stone-400'
          )}
        >
          <svg className={cn('h-4 w-4 transition-transform', isSelected ? 'rotate-90' : '')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
        <p className={cn('text-[17px] sm:text-sm font-semibold leading-tight', isSelected ? 'text-stone-900' : 'text-stone-700')}>
          {subgroup.label}
        </p>
        <p className="mt-1.5 text-[15px] sm:text-xs text-stone-400">{subgroup.services.length} {copy.services}</p>
      </button>
    );
  };

  const renderServiceCard = (service: Service) => {
    const hasEmployees = (service.employees?.length ?? 0) > 0;
    const isActive = service.isActive;
    const isRestrictedOnline = isOnlineBookingRestricted(service);
    const canBook = isActive && hasEmployees && !isRestrictedOnline;
    const specialistCount = service.employees?.length || 0;
    const isSelectedService = selectedService?.id === service.id;
    const localizedDescription = getLocalizedServiceDescription(service, language).trim();
    const isDescriptionExpanded = expandedServiceDescriptions.includes(service.id);
    const canExpandDescription = localizedDescription.length > 140 || localizedDescription.includes('\n');

    return (
      <div
        key={service.id}
        role={canBook ? 'button' : undefined}
        tabIndex={canBook ? 0 : -1}
        onClick={() => canBook && selectService(service)}
        onKeyDown={(event) => {
          if (!canBook) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectService(service);
          }
        }}
        aria-disabled={!canBook}
        className={cn(
          'group rounded-[16px] sm:rounded-[18px] border p-3.5 sm:p-4 text-left transition-all',
          isSelectedService ? 'ring-2 ring-stone-700 border-stone-700 shadow-sm' : '',
          canBook
            ? cn('cursor-pointer border-stone-200 bg-white hover:-translate-y-0.5 hover:shadow-lg', activeGroupTone.serviceHover)
            : 'cursor-not-allowed border-stone-200 bg-stone-50/70'
        )}
      >
        <div className="mb-2">
          {isSelectedService ? (
            <span className="inline-flex rounded-full bg-stone-800 px-2.5 py-1 text-[10px] font-semibold text-white">
              {copy.selected}
            </span>
          ) : canBook ? (
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-stone-800 leading-snug whitespace-normal break-words">
              {service.serviceName}
            </p>
            {localizedDescription ? (
              <>
                <p className={cn(
                  'mt-2 text-sm leading-6 text-stone-500 whitespace-pre-line',
                  !isDescriptionExpanded && 'line-clamp-4'
                )}>
                  {localizedDescription}
                </p>
                {canExpandDescription ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedServiceDescriptions((prev) =>
                        prev.includes(service.id)
                          ? prev.filter((id) => id !== service.id)
                          : [...prev, service.id]
                      );
                    }}
                    className="mt-2 text-xs font-semibold text-stone-600 underline underline-offset-2 hover:text-stone-900"
                  >
                    {isDescriptionExpanded ? copy.showLess : copy.showMore}
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="flex shrink-0 items-end justify-between gap-3 sm:block sm:text-right">
            <p className="text-xl sm:text-2xl leading-none font-semibold text-stone-700">
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
            <span className={cn('inline-flex w-full items-center justify-center gap-1 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-white transition-all', activeGroupTone.serviceButton)}>
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
      </div>
    );
  };

  const stepValid = useMemo<boolean>(() => {
    if (bookingStep === 1) return !!selectedCategory;
    if (bookingStep === 2 && !selectedService) return false;
    if (bookingStep === 2) return !!(formData.name && formData.email && formData.phone && formData.employeeId);
    if (bookingStep === 3) return !!(formData.date && formData.time);
    return true;
  }, [bookingStep, selectedCategory, selectedService, formData]);

  const stepMissingItems = useMemo<string[]>(() => {
    if (bookingStep === 1 && !selectedCategory) return [copy.selectGroupValidation];
    if (bookingStep === 2 && !selectedService) return [copy.selectServiceValidation];

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
        setPaymentError(null);
        const selectedEmployee = serviceEmployees.find((employee) => employee.id === formData.employeeId);
        router.push(
          buildBookingSuccessUrl({
            bookingId: result.data?.id,
            serviceName: selectedService.serviceName,
            employeeName: selectedEmployee
              ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`.trim()
              : undefined,
            bookingDate: formData.date,
            bookingTime: formData.time,
            email: formData.email,
            depositAmount: depositAmount ? depositAmount / 100 : selectedService.price * 0.5,
            remainingBalance: selectedService.price - (depositAmount ? depositAmount / 100 : selectedService.price * 0.5),
          })
        );
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
  const isGroupSelectionStep = bookingStep === 1;
  const isServiceSelectionStep = bookingStep === 2 && !selectedService;
  const visualProgressStep = isGroupSelectionStep || isServiceSelectionStep ? 1 : bookingStep;
  const progressStepLabelByStep = {
    1: copy.stepProgressService,
    2: copy.stepProgressDetails,
    3: copy.stepProgressDate,
    4: copy.stepProgressPayment,
  } as const;
  const progressStepLabel = progressStepLabelByStep[visualProgressStep];
  const progressWidth = `${(visualProgressStep / 4) * 100}%`;

  const step1Groups = groupedCatalog.map((group) => ({
    key: group.key,
    name: group.label,
    count: group.count,
  }));
  const handleSelectGroup = (groupKey: MajorGroupKey) => {
    setSelectedCategory(groupKey);
    setSelectedSubgroupKey(null);
    setSelectedService(null);
    setBookingStep(2);
  };

  const handleStepHeaderBack = () => {
    if (bookingStep === 1) {
      router.back();
      return;
    }
    if (bookingStep === 2 && !selectedService) {
      setBookingStep(1);
      return;
    }
    back();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-stone-50/30 overflow-x-hidden w-full">
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="mx-auto max-w-7xl px-3 sm:px-8">
          <div className="flex h-16 items-center justify-between gap-3 sm:gap-4">
            <Link href="/" className="transition-opacity hover:opacity-80">
              <BrandLogo className="h-12 w-36 sm:h-12 sm:w-40" priority />
            </Link>
            
            <div className="flex items-center justify-end gap-2 sm:gap-3">
              <LanguageSwitcher className="border-stone-200 bg-white/90 shadow-none" />
              {user ? (
                <>
                  <span className="hidden md:block text-xs font-bold text-neutral-400 uppercase tracking-widest">
                    {copy.hello}, {user.firstName || user.email?.split('@')[0]}
                  </span>
                  <Link
                    href="/client/bookings"
                    className="min-w-0 rounded-xl bg-stone-700 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-neutral-900 sm:px-5 sm:py-2.5 sm:text-xs sm:tracking-widest"
                  >
                    {copy.myBookings}
                  </Link>
                </>
              ) : (
                <>
                  <button
                    onClick={() => openAuthModal('login')}
                    aria-label={copy.login}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:text-stone-800 sm:h-auto sm:w-auto sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-xs sm:font-black sm:uppercase sm:tracking-widest"
                  >
                    <LogIn className="h-4 w-4" />
                    <span className="hidden sm:inline">{copy.login}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="pt-20 sm:pt-20 pb-8 sm:pb-12 px-3 sm:px-8 lg:pb-6 lg:flex lg:flex-col">
        <div className="max-w-6xl mx-auto lg:flex lg:flex-col">
          {/* Booking Header + Progress */}
          <div className="mb-5 border-b border-stone-200/70 pb-4 sm:mb-6 sm:pb-5">
            <div className="flex items-start gap-3 sm:gap-4">
              <button
                type="button"
                onClick={handleStepHeaderBack}
                aria-label={copy.back}
                className="mt-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-700 transition-colors hover:border-stone-300 hover:text-stone-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-[2.2rem] sm:text-4xl lg:text-5xl font-semibold tracking-tight text-stone-800 leading-[0.95] sm:leading-tight">
                  {copy.title}
                </h1>
                <p className="mt-1 text-stone-500 font-medium text-sm sm:text-base">
                  {copy.subtitle}
                </p>
              </div>
            </div>

            <div className="mt-4 sm:mt-5 pl-12 sm:pl-14">
              <div className="h-1.5 rounded-full bg-stone-200/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#9a7f6b] transition-all"
                  style={{ width: progressWidth }}
                />
              </div>
              <p className="mt-2 text-sm font-medium text-stone-500">
                {copy.stepWord} {visualProgressStep} {copy.ofWord} 4 · {progressStepLabel}
              </p>
            </div>
          </div>

          {bookingStep === 1 && (
            <section className="mb-4 sm:mb-6">
              {services.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-200 bg-white/70 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-stone-500">{copy.noServicesNow}</p>
                </div>
              ) : (
                <>
                  <h2 className="text-[2rem] sm:text-2xl font-semibold leading-tight text-stone-800">{copy.chooseServiceGroupTitle}</h2>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
                    {step1Groups.map((group) => {
                      const isSelected = selectedCategory === group.key;
                      return (
                        <button
                          key={group.key}
                          type="button"
                          onClick={() => handleSelectGroup(group.key)}
                          className={cn(
                            'relative min-h-[118px] sm:min-h-[156px] rounded-2xl border bg-white px-3 py-4 text-center transition-all flex flex-col items-center justify-center',
                            isSelected
                              ? 'border-emerald-500 ring-2 ring-emerald-200/70'
                              : 'border-stone-200 hover:border-stone-300'
                          )}
                        >
                          {isSelected && (
                            <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                              <Check className="h-4 w-4" />
                            </span>
                          )}
                          <p className="text-[16px] sm:text-base font-semibold leading-snug text-stone-800">
                            {group.name}
                          </p>
                          {group.count > 0 && (
                            <p className="mt-1 text-xs sm:text-xs text-stone-400">
                              {group.count} {copy.services}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          )}

          {/* Main Content Card */}
          {bookingStep !== 1 && (
          <div className="bg-white rounded-[24px] sm:rounded-[40px] shadow-xl sm:shadow-2xl overflow-hidden border border-neutral-100">
            <div className="p-4 sm:p-6 lg:p-6">
              
              {/* Step 2: Select Category and Service */}
              {bookingStep === 2 && !selectedService && (
                <div className="space-y-6 lg:space-y-4">
                  {services.length === 0 ? (
                    <div className="text-center py-12 sm:py-16">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-stone-50 rounded-[20px] sm:rounded-[24px] flex items-center justify-center mx-auto mb-4 sm:mb-6">
                        <svg className="w-8 h-8 sm:w-10 sm:h-10 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <p className="text-stone-500 font-medium text-sm sm:text-base">{copy.noServicesNow}</p>
                    </div>
                  ) : activeGroup ? (
                          <div className={cn(
                            activeGroup.key === 'hair' || activeGroup.key === 'beauty-face' || activeGroup.key === 'nails'
                              ? 'p-0'
                              : 'rounded-[20px] bg-white/95 p-4 sm:p-6',
                            activeGroup.key === 'hair' || activeGroup.key === 'beauty-face' || activeGroup.key === 'nails' ? '' : activeGroupTone.panel
                          )}>
                            {activeGroup.count === 0 ? (
                              <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/60 p-8 text-center">
                                <p className="text-sm font-medium text-stone-600">
                                  {copy.noServicesForGroup}
                                </p>
                                <p className="mt-1 text-xs text-stone-400">
                                  {copy.noServicesForGroupHint}
                                </p>
                              </div>
                            ) : (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-stone-700">{copy.chooseSubgroupStep}</p>
                              </div>

                              <div className="sm:hidden space-y-3">
                                {mobileSubgroupChoices.map((subgroup) => renderSubgroupCard(subgroup))}
                              </div>

                              <div
                                className={cn(
                                  'hidden sm:grid grid-cols-1 sm:grid-cols-2 gap-3',
                                  activeGroup.subgroups.length <= 2 ? 'xl:grid-cols-2' : 'xl:grid-cols-3'
                                )}
                              >
                                {activeGroup.subgroups.map((subgroup) => renderSubgroupCard(subgroup))}
                              </div>

                              {activeSubgroup && (
                                <div className="pt-1">
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedSubgroupKey(null)}
                                        aria-label={copy.change}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 text-stone-600 transition-colors hover:border-stone-300 hover:text-stone-900 sm:hidden"
                                      >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                      </button>
                                      <p className="text-sm font-semibold text-stone-800">
                                        {copy.chooseServiceStep}: {activeSubgroup.label}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedSubgroupKey(null)}
                                      className="hidden sm:inline-flex text-xs font-semibold text-stone-600 underline underline-offset-2 hover:text-stone-900"
                                    >
                                      {copy.change}
                                    </button>
                                  </div>

                                  {SUBGROUP_NOTES[activeGroup.key]?.[activeSubgroup.key]?.[language] && (
                                    <p className="mt-2 mb-3 whitespace-pre-line rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">
                                      {SUBGROUP_NOTES[activeGroup.key]?.[activeSubgroup.key]?.[language]}
                                    </p>
                                  )}

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                                    {activeSubgroup.services.map((service) => renderServiceCard(service))}
                                  </div>
                                </div>
                              )}
                            </div>
                            )}
                          </div>
                  ) : null}

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

                        {walletLabel && (
                          <div className="space-y-3">
                            <p className="text-xs font-bold text-neutral-500">{walletLabel}</p>
                            <div
                              id={paymentRequestMountId}
                              className="min-h-12 overflow-hidden rounded-xl"
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
              {!bookingSuccess && bookingStep > 1 && !(bookingStep === 2 && !selectedService) && (
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
          )}
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

export default function BookAllServicesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BookAllServicesPageContent />
    </Suspense>
  );
}
