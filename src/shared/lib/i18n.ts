export type Language = 'en' | 'es';

export const LANGUAGE_STORAGE_KEY = 'amoramar-language';

export const translations: Record<Language, Record<string, string>> = {
  en: {
    language: 'Language',
    language_en: 'English',
    language_es: 'Spanish',
    language_switch: 'Switch language',
    overview: 'Overview',
    end_of_day: 'End of Day',
    financial: 'Financial',
    employees: 'Employees',
    admins: 'Admins',
    services: 'Services',
    bookings: 'Bookings',
    booking: 'Booking',
    business_management: 'Business Management',
    admin_panel: 'Admin Panel',
    role_employee: 'Employee',
    role_owner: 'Salon Owner',
    loading: 'Loading...',
    logout: 'Logout',
    dashboard: 'Dashboard',
    calendar: 'Calendar',
    filters: 'Filters',
    go_to_today: 'Go to today',
    go_to_date: 'Go to date',
    select_date: 'Select date',
    day: 'Day',
    week: 'Week',
    today: 'Today',
    tomorrow: 'Tomorrow',
    search_client_service: 'Search client, service...',
    status: 'Status',
    all: 'All',
    confirmed: 'Confirmed',
    pending: 'Pending',
    completed: 'Completed',
    cancelled: 'Cancelled',
    employee: 'Employee',
    clear_filters: 'Clear filters',
    keyboard_shortcuts: 'Keyboard shortcuts',
    previous_next_day: 'Previous/Next day',
    previous_next_week: 'Previous/Next week',
    no_bookings: 'No bookings',
    no_bookings_day: 'No bookings for this day',
    no_bookings_week: 'No bookings this week',
    no_bookings_filters: 'No bookings match the filters',
    filters_active: 'Active filters',
    pending_payments: 'Pending payments',
    view_details: 'View details',
    by: 'By',
    client: 'Client',
    no_name: 'No name',
    paid: 'Paid',
    refunded: 'Refunded',
    failed: 'Failed',
    service: 'Service',
    with: 'with',
  },
  es: {
    language: 'Idioma',
    language_en: 'Ingles',
    language_es: 'Espanol',
    language_switch: 'Cambiar idioma',
    overview: 'Resumen',
    end_of_day: 'Cierre del dia',
    financial: 'Finanzas',
    employees: 'Equipo',
    admins: 'Administradores',
    services: 'Servicios',
    bookings: 'Reservas',
    booking: 'Reserva',
    business_management: 'Gestion del negocio',
    admin_panel: 'Panel de administracion',
    role_employee: 'Empleado',
    role_owner: 'Propietario',
    loading: 'Cargando...',
    logout: 'Salir',
    dashboard: 'Panel',
    calendar: 'Calendario',
    filters: 'Filtros',
    go_to_today: 'Ir a hoy',
    go_to_date: 'Ir a fecha',
    select_date: 'Seleccionar fecha',
    day: 'Dia',
    week: 'Semana',
    today: 'Hoy',
    tomorrow: 'Manana',
    search_client_service: 'Buscar cliente, servicio...',
    status: 'Estado',
    all: 'Todos',
    confirmed: 'Confirmada',
    pending: 'Pendiente',
    completed: 'Completada',
    cancelled: 'Cancelada',
    employee: 'Empleado',
    clear_filters: 'Limpiar filtros',
    keyboard_shortcuts: 'Atajos de teclado',
    previous_next_day: 'Dia anterior/siguiente',
    previous_next_week: 'Semana anterior/siguiente',
    no_bookings: 'Sin reservas',
    no_bookings_day: 'No hay reservas para este dia',
    no_bookings_week: 'No hay reservas esta semana',
    no_bookings_filters: 'No hay reservas con esos filtros',
    filters_active: 'Filtros activos',
    pending_payments: 'Pagos pendientes',
    view_details: 'Ver detalles',
    by: 'Por',
    client: 'Cliente',
    no_name: 'Sin nombre',
    paid: 'Pagado',
    refunded: 'Reembolsado',
    failed: 'Fallido',
    service: 'Servicio',
    with: 'con',
  },
};

const normalizeLanguage = (value?: string | null): Language | null => {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('en')) return 'en';
  return null;
};

export const getBrowserLanguage = (): Language => {
  if (typeof navigator === 'undefined') return 'en';
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of languages) {
    const normalized = normalizeLanguage(candidate);
    if (normalized) return normalized;
  }
  return 'en';
};

export const normalizeStoredLanguage = (value?: string | null): Language | null => {
  return normalizeLanguage(value);
};
