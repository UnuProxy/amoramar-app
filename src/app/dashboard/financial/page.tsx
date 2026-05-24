'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { auth } from '@/shared/lib/firebase';
import { Loading } from '@/shared/components/Loading';
import { getBookings, getServices, getExpenses, getEmployees } from '@/shared/lib/firestore';
import { calculateBookingTotals } from '@/shared/lib/booking-utils';
import { uploadExpenseReceipt, deleteStorageFileByUrl } from '@/shared/lib/storage';
import type { Booking, Service, Expense, Employee, ExpenseCategory, ExpenseFrequency, ManualRevenue } from '@/shared/lib/types';
import { formatCurrency, cn } from '@/shared/lib/utils';
import { useLanguage } from '@/shared/context/LanguageContext';

type DateRange = 'month' | 'quarter' | 'year' | 'all';

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: { en: string; es: string }; icon: string }[] = [
  { value: 'rent', label: { en: 'Rent', es: 'Alquiler' }, icon: '🏠' },
  { value: 'utilities', label: { en: 'Utilities', es: 'Suministros' }, icon: '⚡' },
  { value: 'products', label: { en: 'Products', es: 'Productos' }, icon: '💄' },
  { value: 'nashi-argan', label: { en: 'Nashi Argan', es: 'Nashi Argan' }, icon: '🧴' },
  { value: 'supplies', label: { en: 'Supplies', es: 'Materiales' }, icon: '📦' },
  { value: 'staff', label: { en: 'Staff', es: 'Personal' }, icon: '👥' },
  { value: 'marketing', label: { en: 'Marketing', es: 'Marketing' }, icon: '📢' },
  { value: 'equipment', label: { en: 'Equipment', es: 'Equipamiento' }, icon: '🔧' },
  { value: 'insurance', label: { en: 'Insurance', es: 'Seguro' }, icon: '🛡️' },
  { value: 'taxes', label: { en: 'Taxes', es: 'Impuestos' }, icon: '📋' },
  { value: 'maintenance', label: { en: 'Maintenance', es: 'Mantenimiento' }, icon: '🔨' },
  { value: 'other', label: { en: 'Other', es: 'Otros' }, icon: '📌' },
];

const EXPENSE_NAME_SUGGESTIONS = [
  'Nashi Argan',
  'Products Restock',
  'Salon Supplies',
  'Cleaning Products',
  'Rent',
];

const MANUAL_REVENUE_SUGGESTIONS = [
  'Nashi Argan',
  'Retail Product Sale',
  'External Service',
  'Package Sale',
  'Voucher Sale',
];

const MANUAL_REVENUE_CATEGORIES: { value: string; label: { en: string; es: string }; icon: string }[] = [
  { value: 'service', label: { en: 'Service', es: 'Servicio' }, icon: '💇' },
  { value: 'retail', label: { en: 'Retail', es: 'Retail' }, icon: '🛍️' },
  { value: 'voucher', label: { en: 'Voucher', es: 'Bono' }, icon: '🎟️' },
  { value: 'package', label: { en: 'Package', es: 'Paquete' }, icon: '📦' },
  { value: 'other', label: { en: 'Other', es: 'Otros' }, icon: '📌' },
];

const normalizeCategoryValue = (value: string, fallback = 'other') => {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
};

const categoryKey = (value: string) => value.trim().toLowerCase();

const formatCategoryLabel = (value: string) => {
  return value
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export default function FinancialDashboard() {
  const { language } = useLanguage();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [manualRevenues, setManualRevenues] = useState<ManualRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('month');
  // YYYY-MM. When set, it takes precedence over `dateRange` and pins the
  // report to that exact calendar month (e.g. April 1 – April 30).
  const [specificMonth, setSpecificMonth] = useState<string>('');
  const [payoutMonth, setPayoutMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [expenseSearchTerm, setExpenseSearchTerm] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<'all' | ExpenseCategory>('all');
  const [expenseStartDateFilter, setExpenseStartDateFilter] = useState('');
  const [expenseEndDateFilter, setExpenseEndDateFilter] = useState('');
  const [expensePage, setExpensePage] = useState(1);
  const [expensePageSize, setExpensePageSize] = useState(25);
  const [expensePageInput, setExpensePageInput] = useState('1');
  const [selectedExpenseSummaryCategory, setSelectedExpenseSummaryCategory] = useState<string | null>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddRevenue, setShowAddRevenue] = useState(false);
  const [expenseReceiptFile, setExpenseReceiptFile] = useState<File | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingRevenue, setSavingRevenue] = useState(false);
  const [expandedRevenueItems, setExpandedRevenueItems] = useState<string[]>([]);
  const [showRevenueByServiceModal, setShowRevenueByServiceModal] = useState(false);
  const [payoutDetail, setPayoutDetail] = useState<{
    employee: Employee;
    bookings: Booking[];
    totalRevenue: number;
  } | null>(null);
  
  // New expense form
  const [newExpense, setNewExpense] = useState<{
    category: ExpenseCategory;
    name: string;
    amount: string;
    date: string;
    frequency: ExpenseFrequency;
    isRecurring: boolean;
    isPaid: boolean;
    vendor: string;
    notes: string;
    paymentMethod: 'cash' | 'card';
  }>({
    category: 'other',
    name: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    frequency: 'one-time',
    isRecurring: false,
    isPaid: true,
    vendor: '',
    notes: '',
    paymentMethod: 'cash',
  });

  const [newManualRevenue, setNewManualRevenue] = useState<{
    serviceName: string;
    category: string;
    amount: string;
    date: string;
    notes: string;
    paymentMethod: 'cash' | 'card';
  }>({
    serviceName: '',
    category: 'other',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    paymentMethod: 'cash',
  });

  const copy =
    language === 'es'
      ? {
          title: 'Finanzas',
          subtitle: 'Analisis de rentabilidad y gastos',
          thisMonth: 'ESTE MES',
          last3Months: 'ULTIMOS 3 MESES',
          oneYear: '1 ANO',
          allTime: 'TODO EL TIEMPO',
          periodLabel: 'Periodo',
          quickRanges: 'Rangos rapidos',
          customMonth: 'Mes personalizado',
          specificMonthLabel: 'MES ESPECIFICO',
          specificMonthHint: 'Elige un mes natural completo',
          clearSpecificMonth: 'Limpiar',
          activeMonthBadge: 'Mes activo',
          paymentMethodLabel: 'Metodo de pago',
          paymentCash: 'Efectivo',
          paymentCard: 'Tarjeta',
          cashFlowTitle: 'Flujo de caja',
          cashFlowSubtitle: 'Cuanto entra y sale por cada metodo en el periodo seleccionado',
          incomeShort: 'Ingreso',
          expensesShort: 'Gasto',
          netShort: 'Neto',
          onlineMethod: 'Online',
          unspecifiedMethod: 'Sin metodo',
          addExpense: 'Anadir gasto',
          addRevenue: 'Anadir ingreso',
          grossIncome: 'Ingreso bruto',
          bookings: 'RESERVAS',
          totalExpenses: 'Gastos totales',
          transactions: 'TRANSACCIONES',
          transactionSingular: 'transaccion',
          transactionsLower: 'transacciones',
          netProfit: 'Beneficio neto',
          finalResult: 'RESULTADO FINAL',
          margin: 'Margen %',
          profitability: 'RENTABILIDAD',
          revenueByService: 'Ingresos por servicio',
          noDataAvailable: 'Sin datos disponibles',
          ofTotal: 'DEL TOTAL',
          revenueByTherapist: 'Ingresos por especialista',
          month: 'Mes',
          noDataFor: 'Sin datos para',
          selectedMonth: 'mes seleccionado',
          monthlyTotal: 'Total mensual',
          booking: 'reserva',
          bookingsLower: 'reservas',
          depositsCollected: 'DEPOSITOS COBRADOS',
          totalGenerated: 'TOTAL GENERADO',
          expenseBreakdown: 'Desglose de gastos',
          invoices: 'FACTURAS',
          noExpenses: 'Sin gastos',
          recentExpenses: 'Gastos recientes',
          manualRevenue: 'Ingresos manuales',
          noManualRevenue: 'No hay ingresos manuales',
          manualRevenueHelp: 'Servicios cobrados fuera del sistema de reservas.',
          manualRevenueEntries: 'ingresos manuales',
          revenueServiceName: 'Servicio / Concepto',
          incomeCategory: 'Categoria de ingreso',
          revenueDate: 'Fecha',
          revenueNotes: 'Notas',
          newRevenue: 'Nuevo ingreso',
          registerRevenue: 'Registrar ingreso',
          savingRevenue: 'Guardando...',
          errorAddingRevenue: 'Error al anadir el ingreso.',
          confirmDeleteRevenue: 'Estas seguro de que quieres eliminar este ingreso?',
          placeholderRevenueConcept: 'SERVICIO EXTERNO, BONO, VENTA...',
          existingIncomeGroups: 'Grupos de ingresos existentes',
          existingIncomeGroupsHelp: 'Elige un grupo para reutilizar su concepto y categoria, o escribe uno nuevo arriba.',
          newIncomeGroupHelp: 'Si escribes un concepto nuevo, se creara como nuevo grupo de ingresos.',
          placeholderCategory: 'ESCRIBE O ELIGE CATEGORIA',
          expand: 'Ver mas',
          collapse: 'Ver menos',
          viewAllServices: 'Ver todos',
          expensesWord: 'GASTOS',
          dateVendor: 'Fecha / Proveedor',
          description: 'Descripcion',
          category: 'Categoria',
          amount: 'Importe',
          action: 'Accion',
          searchExpenses: 'Buscar gasto',
          searchExpensesPlaceholder: 'Buscar por concepto, proveedor o nota',
          allCategories: 'Todas las categorias',
          totalsBySubcategory: 'Totales por subcategoria',
          filteredExpensesTotal: 'Total filtrado',
          noSubcategory: 'Sin subcategoria',
          openBreakdown: 'Ver detalle',
          backToCategories: 'Volver a categorias',
          fromDate: 'Desde',
          toDate: 'Hasta',
          matchingExpenses: 'gastos encontrados',
          noMatchingExpenses: 'No hay gastos con esos filtros.',
          showing: 'Mostrando',
          of: 'de',
          page: 'Pagina',
          first: 'Primera',
          last: 'Ultima',
          goToPage: 'Ir a pagina',
          previous: 'Anterior',
          next: 'Siguiente',
          perPage: 'por pagina',
          date: 'Fecha',
          paymentDetails: 'Detalles de pagos',
          totalRevenueDeposit: 'Ingresos totales (deposito 50%)',
          totalRevenueFull: 'Ingresos totales (100%)',
          totalServices: 'Servicios totales',
          noBookingsMonth: 'No hay reservas para este mes.',
          serviceFallback: 'Servicio',
          paid: 'Pagado',
          close: 'Cerrar',
          newExpense: 'Nuevo gasto',
          salonOperations: 'Operacion del salon',
          concept: 'Concepto',
          amountEuro: 'Importe (EUR)',
          vendorOptional: 'Proveedor (opcional)',
          receiptOptional: 'Recibo (opcional)',
          uploadReceipt: 'Subir recibo',
          changeReceipt: 'Cambiar recibo',
          receiptReady: 'Archivo listo',
          viewReceipt: 'Ver recibo',
          removeReceipt: 'Quitar',
          fillRequiredFields: 'Completa los campos obligatorios.',
          errorAddingExpense: 'Error al anadir el gasto.',
          confirmDeleteExpense: 'Estas seguro de que quieres eliminar este gasto?',
          placeholderConcept: 'ALQUILER, PRODUCTOS...',
          existingExpenseGroups: 'Grupos de gastos existentes',
          existingExpenseGroupsHelp: 'Elige un grupo para reutilizar su concepto y categoria, o escribe uno nuevo arriba.',
          newExpenseGroupHelp: 'Si escribes un concepto nuevo, se creara como nuevo grupo de gastos.',
          cancel: 'Cancelar',
          registerExpense: 'Registrar gasto',
          savingExpense: 'Guardando...',
        }
      : {
          title: 'Financials',
          subtitle: 'Profitability & Expense Analysis',
          thisMonth: 'THIS MONTH',
          last3Months: 'LAST 3 MONTHS',
          oneYear: '1 YEAR',
          allTime: 'ALL TIME',
          periodLabel: 'Period',
          quickRanges: 'Quick ranges',
          customMonth: 'Custom month',
          specificMonthLabel: 'SPECIFIC MONTH',
          specificMonthHint: 'Pick an exact calendar month',
          clearSpecificMonth: 'Clear',
          activeMonthBadge: 'Active month',
          paymentMethodLabel: 'Payment method',
          paymentCash: 'Cash',
          paymentCard: 'Card',
          cashFlowTitle: 'Cash flow',
          cashFlowSubtitle: 'Money in and out by method for the selected period',
          incomeShort: 'Income',
          expensesShort: 'Expenses',
          netShort: 'Net',
          onlineMethod: 'Online',
          unspecifiedMethod: 'No method',
          addExpense: 'Add Expense',
          addRevenue: 'Add Revenue',
          grossIncome: 'Gross Income',
          bookings: 'BOOKINGS',
          totalExpenses: 'Total Expenses',
          transactions: 'TRANSACTIONS',
          transactionSingular: 'transaction',
          transactionsLower: 'transactions',
          netProfit: 'Net Profit',
          finalResult: 'FINAL RESULT',
          margin: 'Margin %',
          profitability: 'PROFITABILITY',
          revenueByService: 'Revenue by Service',
          noDataAvailable: 'No data available',
          ofTotal: '% OF TOTAL',
          revenueByTherapist: 'Revenue by Therapist',
          month: 'Month',
          noDataFor: 'No data for',
          selectedMonth: 'selected month',
          monthlyTotal: 'Monthly Total',
          booking: 'booking',
          bookingsLower: 'bookings',
          depositsCollected: 'DEPOSITS COLLECTED',
          totalGenerated: 'TOTAL GENERATED',
          expenseBreakdown: 'Expense Breakdown',
          invoices: 'INVOICES',
          noExpenses: 'No expenses',
          recentExpenses: 'Recent Expenses',
          manualRevenue: 'Manual Revenue',
          noManualRevenue: 'No manual revenue yet',
          manualRevenueHelp: 'Services charged outside the booking system.',
          manualRevenueEntries: 'manual revenue entries',
          revenueServiceName: 'Service / Concept',
          incomeCategory: 'Income Category',
          revenueDate: 'Date',
          revenueNotes: 'Notes',
          newRevenue: 'New revenue',
          registerRevenue: 'Register Revenue',
          savingRevenue: 'Saving...',
          errorAddingRevenue: 'Error adding revenue.',
          confirmDeleteRevenue: 'Are you sure you want to delete this revenue entry?',
          placeholderRevenueConcept: 'EXTERNAL SERVICE, PACKAGE, SALE...',
          existingIncomeGroups: 'Existing income groups',
          existingIncomeGroupsHelp: 'Choose a group to reuse its concept and category, or type a new one above.',
          newIncomeGroupHelp: 'Typing a new concept will create a new income group.',
          placeholderCategory: 'TYPE OR PICK CATEGORY',
          expand: 'See more',
          collapse: 'Show less',
          viewAllServices: 'View all',
          expensesWord: 'EXPENSES',
          dateVendor: 'Date / Vendor',
          description: 'Description',
          category: 'Category',
          amount: 'Amount',
          action: 'Action',
          searchExpenses: 'Search expenses',
          searchExpensesPlaceholder: 'Search by concept, vendor, or note',
          allCategories: 'All categories',
          totalsBySubcategory: 'Totals by subcategory',
          filteredExpensesTotal: 'Filtered total',
          noSubcategory: 'No subcategory',
          openBreakdown: 'Open breakdown',
          backToCategories: 'Back to categories',
          fromDate: 'From',
          toDate: 'To',
          matchingExpenses: 'matching expenses',
          noMatchingExpenses: 'No expenses match these filters.',
          showing: 'Showing',
          of: 'of',
          page: 'Page',
          first: 'First',
          last: 'Last',
          goToPage: 'Go to page',
          previous: 'Previous',
          next: 'Next',
          perPage: 'per page',
          date: 'Date',
          paymentDetails: 'Payment details',
          totalRevenueDeposit: 'Total Revenue (50% Deposit)',
          totalRevenueFull: 'Total Revenue (100%)',
          totalServices: 'Total Services',
          noBookingsMonth: 'No bookings for this month.',
          serviceFallback: 'Service',
          paid: 'Paid',
          close: 'Close',
          newExpense: 'New Expense',
          salonOperations: 'Salon Operations',
          concept: 'Concept',
          amountEuro: 'Amount (€)',
          vendorOptional: 'Vendor (Optional)',
          receiptOptional: 'Receipt (Optional)',
          uploadReceipt: 'Upload receipt',
          changeReceipt: 'Change receipt',
          receiptReady: 'File ready',
          viewReceipt: 'View receipt',
          removeReceipt: 'Remove',
          fillRequiredFields: 'Please fill in required fields.',
          errorAddingExpense: 'Error adding expense.',
          confirmDeleteExpense: 'Are you sure you want to delete this expense?',
          placeholderConcept: 'RENT, PRODUCTS...',
          existingExpenseGroups: 'Existing expense groups',
          existingExpenseGroupsHelp: 'Choose a group to reuse its concept and category, or type a new one above.',
          newExpenseGroupHelp: 'Typing a new concept will create a new expense group.',
          cancel: 'Cancel',
          registerExpense: 'Register Expense',
          savingExpense: 'Saving...',
        };

  const defaultExpenseCategoryOptions = useMemo(
    () =>
      EXPENSE_CATEGORIES.map((category) => ({
        value: category.value,
        icon: category.icon,
        label: category.label[language],
      })),
    [language]
  );

  const expenseCategoryOptions = useMemo(() => {
    const options = [...defaultExpenseCategoryOptions];
    const seen = new Set(options.map((option) => categoryKey(option.value)));
    const categoryValues = new Set<string>([
      ...expenses.map((expense) => normalizeCategoryValue(String(expense.category || 'other'))),
      normalizeCategoryValue(String(newExpense.category || 'other')),
    ]);

    categoryValues.forEach((value) => {
      const key = categoryKey(value);
      if (!key || seen.has(key)) return;
      seen.add(key);
      options.push({
        value,
        icon: '🏷️',
        label: formatCategoryLabel(value),
      });
    });

    return options;
  }, [defaultExpenseCategoryOptions, expenses, newExpense.category]);

  const expenseGroupOptions = useMemo(() => {
    const groups = new Map<
      string,
      {
        name: string;
        category: ExpenseCategory;
        vendor?: string;
        count: number;
        total: number;
        latestDate: string;
      }
    >();

    expenses.forEach((expense) => {
      const name = expense.name?.trim();
      if (!name) return;

      const key = name.toLowerCase();
      const current = groups.get(key);
      const category = normalizeCategoryValue(String(expense.category || 'other')) as ExpenseCategory;

      if (!current) {
        groups.set(key, {
          name,
          category,
          vendor: expense.vendor,
          count: 1,
          total: expense.amount || 0,
          latestDate: expense.date || '',
        });
        return;
      }

      current.count += 1;
      current.total += expense.amount || 0;

      if ((expense.date || '') >= current.latestDate) {
        current.category = category;
        current.vendor = expense.vendor || current.vendor;
        current.latestDate = expense.date || current.latestDate;
      }
    });

    EXPENSE_NAME_SUGGESTIONS.forEach((name) => {
      const key = name.toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, {
          name,
          category: 'other',
          count: 0,
          total: 0,
          latestDate: '',
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }, [expenses]);

  const manualRevenueCategoryOptions = useMemo(() => {
    const options = MANUAL_REVENUE_CATEGORIES.map((category) => ({
      value: category.value,
      icon: category.icon,
      label: category.label[language],
    }));
    const seen = new Set(options.map((option) => categoryKey(option.value)));
    const categoryValues = new Set<string>([
      ...manualRevenues.map((item) => normalizeCategoryValue(String(item.category || 'other'))),
      normalizeCategoryValue(String(newManualRevenue.category || 'other')),
    ]);

    categoryValues.forEach((value) => {
      const key = categoryKey(value);
      if (!key || seen.has(key)) return;
      seen.add(key);
      options.push({
        value,
        icon: '🏷️',
        label: formatCategoryLabel(value),
      });
    });

    return options;
  }, [language, manualRevenues, newManualRevenue.category]);

  const manualRevenueGroupOptions = useMemo(() => {
    const groups = new Map<
      string,
      {
        serviceName: string;
        category: string;
        notes?: string;
        count: number;
        total: number;
        latestDate: string;
      }
    >();

    manualRevenues.forEach((item) => {
      const serviceName = item.serviceName?.trim();
      if (!serviceName) return;

      const key = serviceName.toLowerCase();
      const current = groups.get(key);
      const category = normalizeCategoryValue(String(item.category || 'other'));

      if (!current) {
        groups.set(key, {
          serviceName,
          category,
          notes: item.notes,
          count: 1,
          total: item.amount || 0,
          latestDate: item.date || '',
        });
        return;
      }

      current.count += 1;
      current.total += item.amount || 0;

      if ((item.date || '') >= current.latestDate) {
        current.category = category;
        current.notes = item.notes || current.notes;
        current.latestDate = item.date || current.latestDate;
      }
    });

    MANUAL_REVENUE_SUGGESTIONS.forEach((serviceName) => {
      const key = serviceName.toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, {
          serviceName,
          category: 'other',
          count: 0,
          total: 0,
          latestDate: '',
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.serviceName.localeCompare(b.serviceName);
    });
  }, [manualRevenues]);

  useEffect(() => {
    loadData();
  }, []);

  const overlayOpen = showAddExpense || showAddRevenue || showRevenueByServiceModal || Boolean(payoutDetail);

  useEffect(() => {
    if (overlayOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [overlayOpen]);

  const loadData = async () => {
    try {
      const [bookingsData, servicesData, employeesData, expensesData] = await Promise.all([
        getBookings(),
        getServices(),
        getEmployees(),
        getExpenses(),
      ]);
      setBookings(bookingsData);
      setServices(servicesData);
      setEmployees(employeesData);
      setExpenses(expensesData);

      try {
        const token = await auth?.currentUser?.getIdToken();
        if (!token) {
          setManualRevenues([]);
        } else {
          const response = await fetch('/api/manual-revenues', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const payload = await response.json();
          if (response.ok && payload.success) {
            setManualRevenues(payload.data || []);
          } else {
            console.warn('Manual revenue unavailable:', payload.error);
            setManualRevenues([]);
          }
        }
      } catch (manualRevenueError) {
        console.warn('Error loading manual revenue:', manualRevenueError);
        setManualRevenues([]);
      }
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServicePrice = useCallback((serviceId: string): number => {
    const service = services.find((s) => s.id === serviceId);
    if (!service) return 0;
    return typeof service.price === 'number' ? service.price : parseFloat(String(service.price || 0));
  }, [services]);

  const getBookingAmount = useCallback((booking: Booking): number => {
    const servicePrice = getServicePrice(booking.serviceId);
    const employee = employees.find((e) => e.id === booking.employeeId);
    const totals = calculateBookingTotals(booking, {
      id: booking.serviceId,
      serviceName: booking.serviceName || '',
      price: servicePrice,
    } as Service);
    
    // For self-employed, we only collect 50% deposit (the other 50% is their business)
    if (employee?.employmentType === 'self-employed') {
      return totals.depositPaidValue;
    }

    return totals.collectedAmount;
  }, [employees, getServicePrice]);

  // Date range filtering (confirmed or completed bookings for accurate revenue)
  const { startDate, endDate } = useMemo(() => {
    const toYYYYMMDD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    // Specific month picker overrides every other range so the user can
    // inspect a finished calendar month (e.g. April 1 – April 30).
    if (specificMonth) {
      const [yearStr, monthStr] = specificMonth.split('-');
      const y = Number.parseInt(yearStr, 10);
      const m = Number.parseInt(monthStr, 10);
      if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0); // last day of month m
        return {
          startDate: toYYYYMMDD(start),
          endDate: toYYYYMMDD(end),
        };
      }
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    let start = new Date(year, month, 1);
    let end = new Date(year, month + 1, 0);

    if (dateRange === 'quarter') {
      start = new Date(year, month - 2, 1);
    } else if (dateRange === 'year') {
      start = new Date(year - 1, month, 1);
    } else if (dateRange === 'all') {
      start = new Date(2025, 0, 1);
    }

    return {
      startDate: toYYYYMMDD(start),
      endDate: toYYYYMMDD(end),
    };
  }, [dateRange, specificMonth]);

  // Filter bookings and expenses by date range
  const filteredBookings = useMemo(() => {
    return bookings.filter(
      (b) => {
        // Only count bookings that have ACTUAL PAYMENT or are completed
        const isCompleted = b.status === 'completed';
        const hasPaidDeposit = b.depositPaid === true || b.paymentStatus === 'deposit_paid';
        const isPaid = b.paymentStatus === 'paid';
        
        // Must have either: completed status, paid deposit, or paid payment status
        if (!isCompleted && !hasPaidDeposit && !isPaid) return false;
        
        return b.bookingDate >= startDate && b.bookingDate <= endDate;
      }
    );
  }, [bookings, startDate, endDate]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => e.date >= startDate && e.date <= endDate);
  }, [expenses, startDate, endDate]);

  const filteredManualRevenues = useMemo(() => {
    return manualRevenues.filter((item) => item.date >= startDate && item.date <= endDate);
  }, [manualRevenues, startDate, endDate]);

  const manageableExpenses = useMemo(() => {
    const search = expenseSearchTerm.trim().toLowerCase();

    return filteredExpenses.filter((expense) => {
      if (expenseStartDateFilter && expense.date < expenseStartDateFilter) {
        return false;
      }

      if (expenseEndDateFilter && expense.date > expenseEndDateFilter) {
        return false;
      }

      if (
        expenseCategoryFilter !== 'all' &&
        categoryKey(String(expense.category || 'other')) !== categoryKey(String(expenseCategoryFilter))
      ) {
        return false;
      }

      if (!search) return true;

      const searchableText = [
        expense.name,
        expense.vendor,
        expense.notes,
        expense.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [filteredExpenses, expenseCategoryFilter, expenseEndDateFilter, expenseSearchTerm, expenseStartDateFilter]);

  useEffect(() => {
    setExpensePage(1);
  }, [expenseSearchTerm, expenseCategoryFilter, expenseStartDateFilter, expenseEndDateFilter, dateRange]);

  const expensePagination = useMemo(() => {
    const totalItems = manageableExpenses.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / expensePageSize));
    const currentPage = Math.min(expensePage, totalPages);
    const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * expensePageSize;
    const endIndex = Math.min(startIndex + expensePageSize, totalItems);

    return {
      totalItems,
      totalPages,
      currentPage,
      startIndex,
      endIndex,
      items: manageableExpenses.slice(startIndex, endIndex),
    };
  }, [manageableExpenses, expensePage, expensePageSize]);

  const expenseTotalsByCategory = useMemo(() => {
    const totals = new Map<
      string,
      { categoryValue: string; label: string; icon: string; total: number; count: number }
    >();

    manageableExpenses.forEach((expense) => {
      const categoryValue = normalizeCategoryValue(String(expense.category || 'other'));
      const categoryOption = expenseCategoryOptions.find(
        (option) => categoryKey(option.value) === categoryKey(categoryValue)
      );
      const mapKey = categoryKey(categoryValue);
      const current = totals.get(mapKey) || {
        categoryValue,
        label: categoryOption?.label || formatCategoryLabel(categoryValue),
        icon: categoryOption?.icon || '🏷️',
        total: 0,
        count: 0,
      };
      current.total += expense.amount;
      current.count += 1;
      totals.set(mapKey, current);
    });

    return Array.from(totals.values()).sort((a, b) => b.total - a.total);
  }, [manageableExpenses, expenseCategoryOptions]);

  const selectedExpenseSummaryCategoryMeta = useMemo(() => {
    if (!selectedExpenseSummaryCategory) return null;
    return (
      expenseTotalsByCategory.find(
        (item) => categoryKey(item.categoryValue) === categoryKey(selectedExpenseSummaryCategory)
      ) || null
    );
  }, [expenseTotalsByCategory, selectedExpenseSummaryCategory]);

  const visibleExpenseTotalsBySubcategory = useMemo(() => {
    const totals = new Map<string, { label: string; total: number; count: number }>();

    manageableExpenses.forEach((expense) => {
      const categoryValue = normalizeCategoryValue(String(expense.category || 'other'));
      if (
        selectedExpenseSummaryCategory &&
        categoryKey(categoryValue) !== categoryKey(selectedExpenseSummaryCategory)
      ) {
        return;
      }

      const rawSubcategory = normalizeCategoryValue(
        String(expense.name || expense.description || copy.noSubcategory),
        copy.noSubcategory
      );
      const subcategoryLabel = formatCategoryLabel(rawSubcategory);
      const subcategoryKey = subcategoryLabel.toLowerCase();

      const current = totals.get(subcategoryKey) || {
        label: subcategoryLabel,
        total: 0,
        count: 0,
      };
      current.total += expense.amount;
      current.count += 1;
      totals.set(subcategoryKey, current);
    });

    return Array.from(totals.values()).sort((a, b) => b.total - a.total);
  }, [manageableExpenses, selectedExpenseSummaryCategory, copy.noSubcategory]);

  const filteredExpensesTotal = useMemo(
    () => manageableExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [manageableExpenses]
  );

  useEffect(() => {
    if (!selectedExpenseSummaryCategory) return;
    const existsInCurrentFilters = expenseTotalsByCategory.some(
      (item) => categoryKey(item.categoryValue) === categoryKey(selectedExpenseSummaryCategory)
    );
    if (!existsInCurrentFilters) {
      setSelectedExpenseSummaryCategory(null);
    }
  }, [expenseTotalsByCategory, selectedExpenseSummaryCategory]);

  useEffect(() => {
    if (expensePage !== expensePagination.currentPage) {
      setExpensePage(expensePagination.currentPage);
    }
  }, [expensePage, expensePagination.currentPage]);

  useEffect(() => {
    setExpensePageInput(String(expensePagination.currentPage));
  }, [expensePagination.currentPage]);

  const goToExpensePage = useCallback(
    (nextPage: number) => {
      const clampedPage = Math.min(expensePagination.totalPages, Math.max(1, nextPage));
      setExpensePage(clampedPage);
    },
    [expensePagination.totalPages]
  );

  const applyExpensePageInput = useCallback(() => {
    const parsed = Number(expensePageInput);
    if (!Number.isFinite(parsed)) {
      setExpensePageInput(String(expensePagination.currentPage));
      return;
    }
    goToExpensePage(Math.trunc(parsed));
  }, [expensePageInput, expensePagination.currentPage, goToExpensePage]);

  // Month-specific window for therapist payouts
  const { payoutStartDate, payoutEndDate } = useMemo(() => {
    if (!payoutMonth) {
      return {
        payoutStartDate: startDate,
        payoutEndDate: endDate,
      };
    }
    const [yearStr, monthStr] = payoutMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr) - 1; // zero-based
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return {
      payoutStartDate: start.toISOString().split('T')[0],
      payoutEndDate: end.toISOString().split('T')[0],
    };
  }, [payoutMonth, startDate, endDate]);

  const payoutBookings = useMemo(() => {
    return bookings.filter(
      (b) => {
        // Only count bookings that have ACTUAL PAYMENT or are completed
        const isCompleted = b.status === 'completed';
        const hasPaidDeposit = b.depositPaid === true || b.paymentStatus === 'deposit_paid';
        const isPaid = b.paymentStatus === 'paid';
        
        // Must have either: completed status, paid deposit, or paid payment status
        if (!isCompleted && !hasPaidDeposit && !isPaid) return false;
        
        return b.bookingDate >= payoutStartDate && b.bookingDate <= payoutEndDate;
      }
    );
  }, [bookings, payoutStartDate, payoutEndDate]);

  // Calculate financials
  const financials = useMemo(() => {
    const bookingRevenue = filteredBookings.reduce((sum, booking) => sum + getBookingAmount(booking), 0);
    const manualRevenueTotal = filteredManualRevenues.reduce((sum, item) => sum + item.amount, 0);
    const totalRevenue = bookingRevenue + manualRevenueTotal;

    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Revenue by Service
    const revenueByService = services
      .map((service) => {
        const serviceBookings = filteredBookings.filter((b) => b.serviceId === service.id);
        const revenue = serviceBookings.reduce((sum, b) => sum + getBookingAmount(b), 0);
        return {
          service,
          revenue,
          bookingsCount: serviceBookings.length,
          countLabel: copy.bookings,
          percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
        };
      })
      .filter((item) => item.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    // Add "Unknown Services" if any bookings don't match existing services
    const unknownServiceBookings = filteredBookings.filter(
      (b) => !services.find((s) => s.id === b.serviceId)
    );
    if (unknownServiceBookings.length > 0) {
      const unknownRevenue = unknownServiceBookings.reduce((sum, b) => sum + getBookingAmount(b), 0);
      revenueByService.push({
        service: { id: 'unknown', serviceName: 'Unknown / Deleted Service', price: 0 } as any,
        revenue: unknownRevenue,
        bookingsCount: unknownServiceBookings.length,
        countLabel: copy.bookings,
        percentage: totalRevenue > 0 ? (unknownRevenue / totalRevenue) * 100 : 0,
      });
    }

    const manualRevenueByService = filteredManualRevenues.reduce<Record<string, { revenue: number; count: number }>>((acc, item) => {
      const key = item.serviceName.trim() || copy.serviceFallback;
      if (!acc[key]) {
        acc[key] = { revenue: 0, count: 0 };
      }
      acc[key].revenue += item.amount;
      acc[key].count += 1;
      return acc;
    }, {});

    Object.entries(manualRevenueByService).forEach(([serviceName, entry]) => {
      revenueByService.push({
        service: { id: `manual-${serviceName}`, serviceName, price: 0 } as any,
        revenue: entry.revenue,
        bookingsCount: entry.count,
        countLabel: copy.manualRevenueEntries,
        percentage: totalRevenue > 0 ? (entry.revenue / totalRevenue) * 100 : 0,
      });
    });

    revenueByService.sort((a, b) => b.revenue - a.revenue);

    // Revenue by Employee
    const revenueByEmployee = employees
      .map((employee) => {
        const employeeBookings = filteredBookings.filter((b) => b.employeeId === employee.id);
        const revenue = employeeBookings.reduce((sum, b) => sum + getBookingAmount(b), 0);
        return {
          employee,
          revenue,
          bookingsCount: employeeBookings.length,
          percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
        };
      })
      .filter((item) => item.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    const payoutTotalRevenue = payoutBookings.reduce((sum, booking) => sum + getBookingAmount(booking), 0);

    const payoutByEmployee = employees
      .map((employee) => {
        const employeeBookings = payoutBookings.filter((b) => b.employeeId === employee.id);
        const revenue = employeeBookings.reduce((sum, b) => sum + getBookingAmount(b), 0);
        
        return {
          employee,
          revenue,
          bookingsCount: employeeBookings.length,
          percentage: payoutTotalRevenue > 0 ? (revenue / payoutTotalRevenue) * 100 : 0,
        };
      })
      .filter((item) => item.bookingsCount > 0)
      .sort((a, b) => b.revenue - a.revenue);

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      revenueByService,
      revenueByEmployee,
      payoutByEmployee,
      payoutTotalRevenue,
    };
  }, [filteredBookings, filteredExpenses, filteredManualRevenues, services, employees, payoutBookings, getBookingAmount, copy.bookings, copy.manualRevenueEntries, copy.serviceFallback]);

  // Cash vs card breakdown for the selected period.
  // Money in = paid deposits + final payments + manual revenues, split by
  // method (cash, card terminal, online/Stripe). Money out = expenses split by
  // payment method. Final payments are only attributed to the salon for
  // non-self-employed staff (autonomos take the closing amount themselves).
  const cashFlowByMethod = useMemo(() => {
    const inflow = { cash: 0, card: 0, online: 0, unspecified: 0 };
    const outflow = { cash: 0, card: 0, unspecified: 0 };

    filteredBookings.forEach((booking) => {
      const service = services.find((s) => s.id === booking.serviceId);
      const employee = employees.find((e) => e.id === booking.employeeId);
      const totals = calculateBookingTotals(booking, service);

      if (totals.depositPaidValue > 0) {
        if (booking.paymentIntentId) {
          inflow.online += totals.depositPaidValue;
        } else if (booking.finalPaymentMethod === 'pos') {
          inflow.card += totals.depositPaidValue;
        } else {
          inflow.cash += totals.depositPaidValue;
        }
      }

      const closingForSalon =
        employee?.employmentType === 'self-employed' ? 0 : totals.closingAmount;
      if (closingForSalon > 0 && booking.finalPaymentReceived === true) {
        if (booking.finalPaymentMethod === 'pos') {
          inflow.card += closingForSalon;
        } else {
          inflow.cash += closingForSalon;
        }
      }
    });

    filteredManualRevenues.forEach((item) => {
      if (item.paymentMethod === 'cash') inflow.cash += item.amount;
      else if (item.paymentMethod === 'card') inflow.card += item.amount;
      else inflow.unspecified += item.amount;
    });

    filteredExpenses.forEach((expense) => {
      if (expense.paymentMethod === 'cash') outflow.cash += expense.amount;
      else if (expense.paymentMethod === 'card') outflow.card += expense.amount;
      else outflow.unspecified += expense.amount;
    });

    const totalInflow = inflow.cash + inflow.card + inflow.online + inflow.unspecified;
    const totalOutflow = outflow.cash + outflow.card + outflow.unspecified;
    const net = {
      cash: inflow.cash - outflow.cash,
      card: inflow.card - outflow.card,
      online: inflow.online,
      unspecified: inflow.unspecified - outflow.unspecified,
      total: totalInflow - totalOutflow,
    };

    return { inflow, outflow, net, totalInflow, totalOutflow };
  }, [filteredBookings, filteredExpenses, filteredManualRevenues, services, employees]);

  const getOwnerAuthHeaders = async () => {
    const token = await auth?.currentUser?.getIdToken();
    if (!token) {
      throw new Error('Debes iniciar sesion como administrador para gestionar gastos.');
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const selectManualRevenueGroup = (group: { serviceName: string; category: string; notes?: string }) => {
    setNewManualRevenue((current) => ({
      ...current,
      serviceName: group.serviceName,
      category: group.category,
      notes: group.notes || current.notes,
    }));
  };

  const handleAddManualRevenue = async () => {
    if (!newManualRevenue.serviceName || !newManualRevenue.amount) {
      alert(copy.fillRequiredFields);
      return;
    }

    try {
      setSavingRevenue(true);
      const headers = await getOwnerAuthHeaders();
      const response = await fetch('/api/manual-revenues', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...newManualRevenue,
          category: normalizeCategoryValue(newManualRevenue.category),
          amount: parseFloat(newManualRevenue.amount),
        }),
      });
      const payload = await response.json();

      if (response.ok && payload.success) {
        await loadData();
        setShowAddRevenue(false);
        setNewManualRevenue({
          serviceName: '',
          category: 'other',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          notes: '',
          paymentMethod: 'cash',
        });
      } else {
        throw new Error(payload.error || copy.errorAddingRevenue);
      }
    } catch (error: any) {
      console.error('Error adding manual revenue:', error);
      alert(error?.message || copy.errorAddingRevenue);
    } finally {
      setSavingRevenue(false);
    }
  };

  const selectExpenseGroup = (group: { name: string; category: ExpenseCategory; vendor?: string }) => {
    setNewExpense((current) => ({
      ...current,
      name: group.name,
      category: group.category,
      vendor: group.vendor || current.vendor,
    }));
  };

  const handleAddExpense = async () => {
    if (!newExpense.name || !newExpense.amount) {
      alert(copy.fillRequiredFields);
      return;
    }

    let receiptUrl: string | undefined;
    try {
      setSavingExpense(true);
      const headers = await getOwnerAuthHeaders();
      if (expenseReceiptFile) {
        receiptUrl = await uploadExpenseReceipt(expenseReceiptFile, newExpense.date);
      }
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...newExpense,
          category: normalizeCategoryValue(String(newExpense.category || 'other')),
          amount: parseFloat(newExpense.amount),
          receiptUrl,
        }),
      });
      const payload = await response.json();

      if (response.ok && payload.success) {
        await loadData();
        setShowAddExpense(false);
        setNewExpense({
          category: 'other',
          name: '',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          frequency: 'one-time',
          isRecurring: false,
          isPaid: true,
          vendor: '',
          notes: '',
          paymentMethod: 'cash',
        });
        setExpenseReceiptFile(null);
      } else {
        if (receiptUrl) {
          await deleteStorageFileByUrl(receiptUrl);
        }
        throw new Error(payload.error || copy.errorAddingExpense);
      }
    } catch (error: any) {
      if (receiptUrl) {
        await deleteStorageFileByUrl(receiptUrl);
      }
      console.error('Error adding expense:', error);
      alert(error?.message || copy.errorAddingExpense);
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm(copy.confirmDeleteExpense)) return;

    try {
      const expense = expenses.find((item) => item.id === id);
      const headers = await getOwnerAuthHeaders();
      const response = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers,
      });
      const payload = await response.json();

      if (response.ok && payload.success) {
        if (expense?.receiptUrl) {
          await deleteStorageFileByUrl(expense.receiptUrl);
        }
        await loadData();
      } else {
        throw new Error(payload.error || 'Error al eliminar el gasto');
      }
    } catch (error: any) {
      console.error('Error deleting expense:', error);
      alert(error?.message || 'Error al eliminar el gasto');
    }
  };

  const handleDeleteManualRevenue = async (id: string) => {
    if (!confirm(copy.confirmDeleteRevenue)) return;

    try {
      const headers = await getOwnerAuthHeaders();
      const response = await fetch(`/api/manual-revenues/${id}`, {
        method: 'DELETE',
        headers,
      });
      const payload = await response.json();

      if (response.ok && payload.success) {
        await loadData();
      } else {
        throw new Error(payload.error || copy.errorAddingRevenue);
      }
    } catch (error: any) {
      console.error('Error deleting manual revenue:', error);
      alert(error?.message || copy.errorAddingRevenue);
    }
  };

  const toggleRevenueItemExpansion = (itemId: string) => {
    setExpandedRevenueItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const openPayoutModal = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return;
    const bookingsForEmployee = payoutBookings.filter((b) => b.employeeId === employeeId);
    const totalRevenue = bookingsForEmployee.reduce((sum, b) => sum + getBookingAmount(b), 0);

    setPayoutDetail({
      employee,
      bookings: bookingsForEmployee.sort((a, b) =>
        `${b.bookingDate}T${b.bookingTime}`.localeCompare(`${a.bookingDate}T${a.bookingTime}`)
      ),
      totalRevenue,
    });
  };

  const displayLocale = language === 'es' ? 'es-ES' : 'en-US';
  const rangeOptions: { value: DateRange; label: string }[] = [
    { value: 'month', label: copy.thisMonth },
    { value: 'quarter', label: copy.last3Months },
    { value: 'year', label: copy.oneYear },
    { value: 'all', label: copy.allTime },
  ];
  const activePeriodLabel = `${new Date(`${startDate}T00:00:00`).toLocaleDateString(displayLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })} - ${new Date(`${endDate}T00:00:00`).toLocaleDateString(displayLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 pb-12">
      {/* Header - Premium Luxury */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
        <div>
          <h1 className="text-5xl font-black text-slate-800 tracking-tighter uppercase leading-none bg-gradient-to-r from-slate-900 to-sky-600 bg-clip-text text-transparent">
            {copy.title}
          </h1>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-500 shadow-lg shadow-sky-500/50" />
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">
              {copy.subtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex w-full flex-col gap-3 rounded-[24px] border border-slate-100 bg-white p-3 shadow-sm lg:w-auto">
            <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">{copy.periodLabel}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-600">{activePeriodLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {rangeOptions.map((option) => {
                const isActive = !specificMonth && dateRange === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setDateRange(option.value);
                      setSpecificMonth('');
                    }}
                    className={cn(
                      'rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition-all',
                      isActive
                        ? 'bg-slate-800 text-white shadow-lg shadow-slate-900/10'
                        : 'bg-slate-50 text-slate-500 hover:bg-sky-50 hover:text-sky-700'
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={cn(
              "flex w-full flex-col gap-2 rounded-[24px] border p-3 shadow-sm transition-all sm:w-auto",
              specificMonth
                ? "bg-sky-50 border-sky-300 ring-1 ring-sky-200"
                : "bg-white border-slate-100 hover:border-sky-300"
            )}
          >
            <label
              htmlFor="financial-specific-month"
              className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500"
            >
              {copy.customMonth}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="financial-specific-month"
                type="month"
                value={specificMonth}
                onChange={(e) => setSpecificMonth(e.target.value)}
                aria-label={copy.specificMonthHint}
                className="min-h-10 rounded-xl border border-slate-100 bg-white px-3 text-[11px] font-black uppercase tracking-[0.12em] text-slate-700 outline-none cursor-pointer focus:border-sky-500"
              />
              {specificMonth && (
                <button
                  type="button"
                  onClick={() => setSpecificMonth('')}
                  className="px-3 py-2 rounded-xl bg-white text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200"
                >
                  {copy.clearSpecificMonth}
                </button>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowAddRevenue(true)}
            className="px-8 py-4 bg-white border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:border-sky-500 hover:text-sky-600 transition-all shadow-sm flex items-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
            </svg>
            {copy.addRevenue}
          </button>

          <button
            onClick={() => {
              setExpenseReceiptFile(null);
              setShowAddExpense(true);
            }}
            className="px-8 py-4 bg-slate-800 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-sky-600 hover:-translate-y-0.5 transition-all shadow-xl shadow-slate-900/10 flex items-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
            </svg>
            {copy.addExpense}
          </button>
        </div>
      </div>

      {/* Summary Cards - Elegant & Light */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Revenue */}
        <div className="bg-white border-2 border-sky-100/50 rounded-[40px] p-8 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative min-h-[220px] flex items-center justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">{copy.grossIncome}</p>
            <p className="mx-auto max-w-full text-[clamp(1.5rem,2vw,2.75rem)] font-black text-slate-800 tracking-tight leading-none whitespace-nowrap text-center">
              {formatCurrency(financials.totalRevenue)}
            </p>
            <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mt-4">{filteredBookings.length + filteredManualRevenues.length} {copy.transactions}</p>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white border-2 border-sky-100/50 rounded-[40px] p-8 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative min-h-[220px] flex items-center justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">{copy.totalExpenses}</p>
            <p className="mx-auto max-w-full text-[clamp(1.5rem,2vw,2.75rem)] font-black text-slate-800 tracking-tight leading-none whitespace-nowrap text-center">
              {formatCurrency(financials.totalExpenses)}
            </p>
            <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mt-4">{filteredExpenses.length} {copy.expensesWord}</p>
          </div>
        </div>

        {/* Net Profit */}
        <div className={cn(
          "rounded-[40px] p-8 shadow-xl transition-all group overflow-hidden relative min-h-[220px] flex items-center justify-center border-2",
          financials.netProfit >= 0 ? "bg-sky-50 border-sky-200" : "bg-warning-50 border-warning-200"
        )}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">{copy.netProfit}</p>
            <p className="mx-auto max-w-full text-[clamp(1.5rem,2vw,2.75rem)] font-black text-slate-900 tracking-tight leading-none whitespace-nowrap text-center">
              {formatCurrency(financials.netProfit)}
            </p>
            <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest mt-4">{copy.finalResult}</p>
          </div>
        </div>

        {/* Profit Margin */}
        <div className="bg-white border-2 border-sky-100/50 rounded-[40px] p-8 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative min-h-[220px] flex items-center justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">{copy.margin}</p>
            <p className="mx-auto max-w-full text-[clamp(1.5rem,2vw,2.75rem)] font-black text-slate-800 tracking-tight leading-none whitespace-nowrap text-center">
              {financials.profitMargin.toFixed(1)}%
            </p>
            <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mt-4">{copy.profitability}</p>
          </div>
        </div>
      </div>

      {/* Cash flow by payment method */}
      <div className="bg-white border-2 border-sky-100/50 rounded-[40px] overflow-hidden shadow-sm">
        <div className="px-6 sm:px-10 py-6 sm:py-8 border-b-2 border-sky-100/50 bg-sky-50/30 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-800 tracking-[0.3em] uppercase">{copy.cashFlowTitle}</h2>
            <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em]">{copy.cashFlowSubtitle}</p>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            {startDate} → {endDate}
          </p>
        </div>

        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {([
            {
              key: 'cash' as const,
              label: copy.paymentCash,
              icon: '€',
              accent: 'emerald',
              income: cashFlowByMethod.inflow.cash,
              expense: cashFlowByMethod.outflow.cash,
              net: cashFlowByMethod.net.cash,
            },
            {
              key: 'card' as const,
              label: copy.paymentCard,
              icon: '💳',
              accent: 'sky',
              income: cashFlowByMethod.inflow.card,
              expense: cashFlowByMethod.outflow.card,
              net: cashFlowByMethod.net.card,
            },
            {
              key: 'online' as const,
              label: copy.onlineMethod,
              icon: '🌐',
              accent: 'violet',
              income: cashFlowByMethod.inflow.online,
              expense: 0,
              net: cashFlowByMethod.net.online,
            },
          ]).map((bucket) => (
            <div
              key={bucket.key}
              className={cn(
                "rounded-[28px] border-2 p-5 sm:p-6 flex flex-col gap-4 transition-all",
                bucket.accent === 'emerald' && "border-emerald-100 bg-emerald-50/40",
                bucket.accent === 'sky' && "border-sky-100 bg-sky-50/40",
                bucket.accent === 'violet' && "border-violet-100 bg-violet-50/40"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-black",
                      bucket.accent === 'emerald' && "bg-emerald-100 text-emerald-700",
                      bucket.accent === 'sky' && "bg-sky-100 text-sky-700",
                      bucket.accent === 'violet' && "bg-violet-100 text-violet-700"
                    )}
                  >
                    {bucket.icon}
                  </div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{bucket.label}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{copy.incomeShort}</span>
                  <span className="text-base sm:text-lg font-black tabular-nums text-slate-800">+ {formatCurrency(bucket.income)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{copy.expensesShort}</span>
                  <span className="text-base sm:text-lg font-black tabular-nums text-rose-600">
                    {bucket.expense > 0 ? `- ${formatCurrency(bucket.expense)}` : formatCurrency(0)}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex items-baseline justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{copy.netShort}</span>
                  <span
                    className={cn(
                      "text-lg sm:text-xl font-black tabular-nums",
                      bucket.net >= 0 ? "text-slate-900" : "text-rose-700"
                    )}
                  >
                    {bucket.net < 0 ? '- ' : ''}{formatCurrency(Math.abs(bucket.net))}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {(cashFlowByMethod.inflow.unspecified > 0 || cashFlowByMethod.outflow.unspecified > 0) && (
          <div className="px-6 sm:px-10 pb-6 sm:pb-8 -mt-2 flex flex-col sm:flex-row gap-2 sm:gap-6 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            <span>
              {copy.unspecifiedMethod} · + {formatCurrency(cashFlowByMethod.inflow.unspecified)} / - {formatCurrency(cashFlowByMethod.outflow.unspecified)}
            </span>
          </div>
        )}
      </div>

      {/* Revenue Analytics Grid - Professional Ibiza Style */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Revenue by Service */}
        <div className="bg-white border-2 border-sky-100/50 rounded-[48px] overflow-hidden shadow-sm">
          <div className="px-10 py-8 border-b-2 border-sky-100/50 bg-sky-50/30 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-black text-slate-800 tracking-[0.3em] uppercase text-center sm:text-left">{copy.revenueByService}</h2>
            {financials.revenueByService.length > 0 && (
              <button
                type="button"
                onClick={() => setShowRevenueByServiceModal(true)}
                className="rounded-2xl bg-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-sky-600 shadow-sm transition-all hover:bg-sky-600 hover:text-white"
              >
                {copy.viewAllServices}
              </button>
            )}
          </div>
          
          <div className="p-10">
            {financials.revenueByService.length === 0 ? (
              <div className="text-center py-12 text-slate-200 font-bold uppercase tracking-widest text-[10px]">{copy.noDataAvailable}</div>
            ) : (
              <div className="space-y-8">
                {financials.revenueByService.slice(0, 5).map((item, index) => {
                  return (
                    <div key={item.service.id} className="group">
                      <div className="mb-4 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[auto,minmax(0,1fr),auto] lg:items-start lg:gap-x-4 lg:gap-y-3">
                        <div className="flex items-start gap-4 min-w-0 lg:col-span-2">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white font-black text-sm shadow-md">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-lg font-black text-slate-800 uppercase tracking-tighter leading-[1.05] break-words">
                              {item.service.serviceName}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{item.bookingsCount} {item.countLabel || copy.bookings}</p>
                          </div>
                        </div>
                        <div className="text-right self-start whitespace-nowrap lg:pl-2">
                          <p className="text-base sm:text-lg xl:text-xl font-black text-sky-600 tabular-nums leading-none">{formatCurrency(item.revenue)}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{item.percentage.toFixed(0)}{copy.ofTotal}</p>
                        </div>
                      </div>
                      <div className="w-full bg-sky-50 rounded-full h-1 overflow-hidden">
                        <div
                          className="h-full bg-sky-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(197,160,89,0.3)]"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {financials.revenueByService.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowRevenueByServiceModal(true)}
                    className="w-full rounded-2xl border-2 border-dashed border-sky-100 px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-sky-600 transition-all hover:border-sky-300 hover:bg-sky-50"
                  >
                    {copy.viewAllServices} ({financials.revenueByService.length})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Revenue by Employee */}
        <div className="bg-white border-2 border-sky-100/50 rounded-[48px] overflow-hidden shadow-sm">
          <div className="px-10 py-8 border-b-2 border-sky-100/50 bg-sky-50/30 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <h2 className="text-sm font-black text-slate-800 tracking-[0.3em] uppercase text-center lg:text-left">
              {copy.revenueByTherapist}
            </h2>
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{copy.month}</label>
              <input
                type="month"
                value={payoutMonth}
                onChange={(e) => setPayoutMonth(e.target.value)}
                className="px-4 py-2 border border-sky-100 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] focus:border-sky-500 outline-none bg-white shadow-sm"
              />
            </div>
          </div>
          
          <div className="p-10">
            {financials.payoutByEmployee.length === 0 ? (
              <div className="text-center py-12 text-slate-200 font-bold uppercase tracking-widest text-[10px]">
                {copy.noDataFor} {payoutMonth || copy.selectedMonth}
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex items-center justify-between bg-sky-50/50 border border-sky-100 rounded-2xl p-4">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    {copy.monthlyTotal}
                  </div>
                  <div className="text-lg font-black text-slate-900">
                    {formatCurrency(financials.payoutTotalRevenue)}
                  </div>
                </div>
                {financials.payoutByEmployee.map((item) => (
                  <button
                    key={item.employee.id}
                    type="button"
                    onClick={() => openPayoutModal(item.employee.id)}
                    className="group w-full text-left"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-white font-black text-lg overflow-hidden shadow-md group-hover:scale-105 transition-transform ring-2 ring-sky-50">
                          {item.employee.profileImage ? (
                            <img src={item.employee.profileImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{item.employee.firstName[0]}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-black text-slate-800 uppercase tracking-tighter leading-none group-hover:text-sky-600 transition-colors">
                              {item.employee.firstName} {item.employee.lastName}
                            </p>
                            {item.employee.employmentType === 'self-employed' && (
                              <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-sky-100 text-sky-700 rounded-md">
                                50%
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {item.bookingsCount} {item.bookingsCount === 1 ? copy.booking : copy.bookingsLower}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-slate-900 tabular-nums leading-none">
                          {formatCurrency(item.revenue)}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          {item.employee.employmentType === 'self-employed' ? copy.depositsCollected : copy.totalGenerated}
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-sky-50 rounded-full h-1 overflow-hidden">
                      <div
                        className="h-full bg-slate-800 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(38,38,38,0.2)]"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-[48px] overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/30 space-y-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-sm font-black text-slate-800 tracking-[0.3em] uppercase">{copy.manualRevenue}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
              {filteredManualRevenues.length} {copy.manualRevenueEntries}
            </p>
          </div>
          <p className="text-xs text-slate-500">{copy.manualRevenueHelp}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{copy.revenueDate}</th>
                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{copy.revenueServiceName}</th>
                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{copy.incomeCategory}</th>
                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{copy.revenueNotes}</th>
                <th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{copy.amount}</th>
                <th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{copy.action}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredManualRevenues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-10 py-12 text-center text-sm font-semibold text-slate-400">
                    {copy.noManualRevenue}
                  </td>
                </tr>
              ) : filteredManualRevenues.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-10 py-8">
                    <div className="text-lg font-black text-slate-800 uppercase tracking-tighter leading-none">
                      {new Date(item.date + 'T00:00:00').toLocaleDateString(displayLocale, { day: 'numeric', month: 'short' })}
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="text-sm font-bold text-slate-700 uppercase tracking-widest">{item.serviceName}</div>
                  </td>
                  <td className="px-10 py-8">
                    {(() => {
                      const categoryValue = normalizeCategoryValue(String(item.category || 'other'));
                      const category = manualRevenueCategoryOptions.find(
                        (option) => categoryKey(option.value) === categoryKey(categoryValue)
                      );
                      return (
                        <span className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                          {category?.label || formatCategoryLabel(categoryValue)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-10 py-8 text-sm text-slate-500">{item.notes || '—'}</td>
                  <td className="px-10 py-8 text-right">
                    <p className="text-xl font-black text-sky-600 tabular-nums">{formatCurrency(item.amount)}</p>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <button
                      onClick={() => handleDeleteManualRevenue(item.id)}
                      className="w-10 h-10 bg-slate-50 text-slate-300 rounded-xl hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center mx-auto lg:ml-auto lg:mr-0"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {expensePagination.totalPages > 1 && (
            <div className="border-t border-slate-100 px-6 sm:px-10 py-4 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {copy.page} {expensePagination.currentPage} / {expensePagination.totalPages}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => goToExpensePage(expensePagination.currentPage - 1)}
                    disabled={expensePagination.currentPage === 1}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-all hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copy.previous}
                  </button>
                  <button
                    onClick={() => goToExpensePage(expensePagination.currentPage + 1)}
                    disabled={expensePagination.currentPage === expensePagination.totalPages}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-all hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copy.next}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Expenses Table */}
      <div className="bg-white border border-slate-100 rounded-[48px] overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/30 space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-sm font-black text-slate-800 tracking-[0.3em] uppercase">{copy.recentExpenses}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
              {manageableExpenses.length} {copy.matchingExpenses}
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_170px_170px]">
            <input
              type="text"
              value={expenseSearchTerm}
              onChange={(event) => setExpenseSearchTerm(event.target.value)}
              placeholder={copy.searchExpensesPlaceholder}
              aria-label={copy.searchExpenses}
              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-700 outline-none transition-all focus:border-sky-400"
            />
            <select
              value={expenseCategoryFilter}
              onChange={(event) => setExpenseCategoryFilter(event.target.value as 'all' | ExpenseCategory)}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-sky-400"
            >
              <option value="all">{copy.allCategories}</option>
              {expenseCategoryOptions.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={expenseStartDateFilter}
              onChange={(event) => setExpenseStartDateFilter(event.target.value)}
              aria-label={copy.fromDate}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-sky-400"
            />
            <input
              type="date"
              value={expenseEndDateFilter}
              onChange={(event) => setExpenseEndDateFilter(event.target.value)}
              aria-label={copy.toDate}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-sky-400"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="border-b border-slate-100 px-6 sm:px-10 py-5 space-y-4 bg-white">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                {copy.totalsBySubcategory}
              </p>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                {copy.filteredExpensesTotal}: {formatCurrency(filteredExpensesTotal)}
              </p>
            </div>
            {expenseTotalsByCategory.length === 0 ? (
              <p className="text-sm font-semibold text-slate-400">{copy.noMatchingExpenses}</p>
            ) : (
              <div className="space-y-4">
                {selectedExpenseSummaryCategoryMeta && (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedExpenseSummaryCategory(null)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-all hover:border-slate-400"
                    >
                      {copy.backToCategories}
                    </button>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                      {selectedExpenseSummaryCategoryMeta.label}
                    </p>
                  </div>
                )}

                {!selectedExpenseSummaryCategoryMeta && (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {expenseTotalsByCategory.map((item) => (
                      <button
                        key={item.categoryValue}
                        type="button"
                        onClick={() => setSelectedExpenseSummaryCategory(item.categoryValue)}
                        className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-left transition-all hover:border-slate-300 hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-700 break-words">
                            {item.label}
                          </p>
                          <span className="text-base">{item.icon}</span>
                        </div>
                        <div className="mt-2 flex items-end justify-between gap-2">
                          <p className="text-lg font-black text-slate-900 tabular-nums">
                            {formatCurrency(item.total)}
                          </p>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            {item.count} {item.count === 1 ? copy.transactionSingular : copy.transactionsLower}
                          </p>
                        </div>
                        <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          {copy.openBreakdown}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {selectedExpenseSummaryCategoryMeta && (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleExpenseTotalsBySubcategory.map((item) => (
                      <div
                        key={`${selectedExpenseSummaryCategoryMeta.categoryValue}-${item.label}`}
                        className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                      >
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-700 break-words">
                          {item.label}
                        </p>
                        <div className="mt-2 flex items-end justify-between gap-2">
                          <p className="text-lg font-black text-slate-900 tabular-nums">
                            {formatCurrency(item.total)}
                          </p>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            {item.count} {item.count === 1 ? copy.transactionSingular : copy.transactionsLower}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedExpenseSummaryCategoryMeta && visibleExpenseTotalsBySubcategory.length === 0 && (
                  <p className="text-sm font-semibold text-slate-400">{copy.noMatchingExpenses}</p>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 sm:px-10 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              {expensePagination.totalItems === 0
                ? `${copy.showing} 0 ${copy.of} 0`
                : `${copy.showing} ${expensePagination.startIndex + 1}-${expensePagination.endIndex} ${copy.of} ${expensePagination.totalItems}`}
            </div>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <label className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                <span>{copy.perPage}</span>
                <select
                  value={expensePageSize}
                  onChange={(event) => setExpensePageSize(Number(event.target.value))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 outline-none transition-all focus:border-sky-400"
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => goToExpensePage(1)}
                  disabled={expensePagination.currentPage === 1}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-all hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copy.first}
                </button>
                <button
                  onClick={() => goToExpensePage(expensePagination.currentPage - 1)}
                  disabled={expensePagination.currentPage === 1}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-all hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copy.previous}
                </button>
                <div className="min-w-[120px] text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {copy.page} {expensePagination.currentPage} / {expensePagination.totalPages}
                </div>
                <button
                  onClick={() => goToExpensePage(expensePagination.currentPage + 1)}
                  disabled={expensePagination.currentPage === expensePagination.totalPages}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-all hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copy.next}
                </button>
                <button
                  onClick={() => goToExpensePage(expensePagination.totalPages)}
                  disabled={expensePagination.currentPage === expensePagination.totalPages}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-all hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copy.last}
                </button>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                <span>{copy.goToPage}</span>
                <input
                  type="number"
                  min={1}
                  max={expensePagination.totalPages}
                  value={expensePageInput}
                  onChange={(event) => setExpensePageInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      applyExpensePageInput();
                    }
                  }}
                  className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 outline-none transition-all focus:border-sky-400"
                />
                <button
                  type="button"
                  onClick={applyExpensePageInput}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-all hover:border-slate-400"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{copy.dateVendor}</th>
                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{copy.description}</th>
                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{copy.category}</th>
                <th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{copy.amount}</th>
                <th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{copy.action}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expensePagination.totalItems === 0 ? (
                <tr>
                  <td colSpan={5} className="px-10 py-12 text-center text-sm font-semibold text-slate-400">
                    {copy.noMatchingExpenses}
                  </td>
                </tr>
              ) : expensePagination.items.map((expense) => {
                const category = expenseCategoryOptions.find(
                  (c) => categoryKey(c.value) === categoryKey(String(expense.category || 'other'))
                );
                return (
                  <tr key={expense.id} className="hover:bg-slate-50 transition-all group">
                    <td className="px-10 py-8">
                      <div className="text-lg font-black text-slate-800 uppercase tracking-tighter leading-none mb-1">
                        {new Date(expense.date + 'T00:00:00').toLocaleDateString(displayLocale, { day: 'numeric', month: 'short' })}
                      </div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{expense.vendor || '—'}</div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="text-sm font-bold text-slate-700 uppercase tracking-widest">{expense.name}</div>
                      {expense.receiptUrl && (
                        <a
                          href={expense.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex text-[10px] font-black uppercase tracking-[0.2em] text-sky-600 hover:text-sky-800"
                        >
                          {copy.viewReceipt}
                        </a>
                      )}
                    </td>
                    <td className="px-10 py-8">
                      <span className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                        {category?.label || expense.category}
                      </span>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <p className="text-xl font-black text-slate-800 tabular-nums">{formatCurrency(expense.amount)}</p>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="w-10 h-10 bg-slate-50 text-slate-300 rounded-xl hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center mx-auto lg:ml-auto lg:mr-0"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payout detail modal */}
      {payoutDetail && (
        <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center bg-slate-900/70 backdrop-blur-lg p-4">
          <div className="w-full max-w-3xl bg-white rounded-[32px] sm:rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="px-6 sm:px-10 py-6 sm:py-8 flex items-start sm:items-center justify-between gap-4 border-b border-slate-100">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  {copy.paymentDetails} • {new Date(payoutStartDate + 'T00:00:00').toLocaleDateString(displayLocale, { month: 'long', year: 'numeric' })}
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg overflow-hidden">
                    {payoutDetail.employee.profileImage ? (
                      <img src={payoutDetail.employee.profileImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{payoutDetail.employee.firstName?.[0] || 'T'}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                      {payoutDetail.employee.firstName} {payoutDetail.employee.lastName}
                    </h3>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mt-1">
                      {payoutDetail.bookings.length} {payoutDetail.bookings.length === 1 ? copy.booking : copy.bookingsLower}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setPayoutDetail(null)}
                className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 sm:px-10 py-6 bg-slate-50/60 border-b border-slate-100 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
                  {payoutDetail.employee.employmentType === 'self-employed' 
                    ? copy.totalRevenueDeposit
                    : copy.totalRevenueFull}
                </p>
                <p className="text-3xl font-black text-rose-600">{formatCurrency(payoutDetail.totalRevenue)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">{copy.totalServices}</p>
                <p className="text-xl font-black text-slate-900">{payoutDetail.bookings.length} {copy.bookings}</p>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-10 py-6 space-y-4">
              {payoutDetail.bookings.length === 0 ? (
                <div className="text-center py-12 text-slate-300 font-bold uppercase tracking-widest text-xs">
                  {copy.noBookingsMonth}
                </div>
              ) : (
                payoutDetail.bookings.map((booking) => {
                  const service = services.find((s) => s.id === booking.serviceId);
                  return (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between bg-white border border-slate-100 rounded-2xl p-4 shadow-sm"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                          {service?.serviceName || copy.serviceFallback}
                        </p>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">
                          {new Date(booking.bookingDate + 'T00:00:00').toLocaleDateString(displayLocale, {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          · {booking.bookingTime}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-900 tabular-nums">
                          {formatCurrency(getBookingAmount(booking))}
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
                          {booking.status === 'completed' ? copy.paid : booking.status}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-6 sm:px-10 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setPayoutDetail(null)}
                className="px-8 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900 transition-colors"
              >
                {copy.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRevenueByServiceModal && (
        <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center bg-slate-900/70 backdrop-blur-lg p-4">
          <div className="w-full max-w-4xl bg-white rounded-[32px] sm:rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="px-6 sm:px-10 py-6 sm:py-8 flex items-start sm:items-center justify-between gap-4 border-b border-slate-100">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  {copy.periodLabel} • {activePeriodLabel}
                </p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none">
                  {copy.revenueByService}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRevenueByServiceModal(false)}
                className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 sm:px-10 py-6 bg-slate-50/60 border-b border-slate-100 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">{copy.grossIncome}</p>
                <p className="text-3xl font-black text-sky-600">{formatCurrency(financials.totalRevenue)}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">{copy.totalServices}</p>
                <p className="text-xl font-black text-slate-900">{financials.revenueByService.length}</p>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-10 py-6 space-y-5">
              {financials.revenueByService.length === 0 ? (
                <div className="text-center py-12 text-slate-300 font-bold uppercase tracking-widest text-xs">
                  {copy.noDataAvailable}
                </div>
              ) : (
                financials.revenueByService.map((item, index) => (
                  <div key={item.service.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-sm font-black text-white shadow-md">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-black uppercase leading-tight tracking-tight text-slate-900">
                            {item.service.serviceName}
                          </p>
                          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {item.bookingsCount} {item.countLabel || copy.bookings}
                          </p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xl font-black tabular-nums text-sky-600">{formatCurrency(item.revenue)}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {item.percentage.toFixed(0)}{copy.ofTotal}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-sky-50">
                      <div
                        className="h-full rounded-full bg-sky-500 transition-all duration-1000"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 sm:px-10 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowRevenueByServiceModal(false)}
                className="px-8 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900 transition-colors"
              >
                {copy.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddRevenue && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-slate-800/90 backdrop-blur-xl p-4">
          <div className="w-full max-w-2xl bg-white rounded-[32px] sm:rounded-[40px] shadow-2xl overflow-hidden border-2 border-white/20 max-h-[90vh] flex flex-col">
            <div className="px-6 sm:px-12 py-6 sm:py-10 flex items-center justify-between border-b border-slate-100">
              <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">{copy.newRevenue}</h2>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">{copy.manualRevenueHelp}</p>
              </div>
              <button
                onClick={() => setShowAddRevenue(false)}
                className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 sm:p-12 space-y-8 flex-1 min-h-0 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.revenueServiceName}</label>
                  <input
                    type="text"
                    value={newManualRevenue.serviceName}
                    onChange={(e) => {
                      const nextServiceName = e.target.value;
                      const existingGroup = manualRevenueGroupOptions.find(
                        (group) => group.serviceName.toLowerCase() === nextServiceName.trim().toLowerCase()
                      );

                      if (existingGroup) {
                        selectManualRevenueGroup(existingGroup);
                        return;
                      }

                      setNewManualRevenue({ ...newManualRevenue, serviceName: nextServiceName });
                    }}
                    list="manual-revenue-concepts"
                    className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-bold focus:border-sky-500 transition-all outline-none"
                    placeholder={copy.placeholderRevenueConcept}
                  />
                  <datalist id="manual-revenue-concepts">
                    {manualRevenueGroupOptions.map((item) => (
                      <option key={item.serviceName} value={item.serviceName} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.incomeCategory}</label>
                  <input
                    type="text"
                    value={newManualRevenue.category}
                    onChange={(e) => setNewManualRevenue({ ...newManualRevenue, category: e.target.value })}
                    list="manual-revenue-categories"
                    className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-bold focus:border-sky-500 transition-all outline-none uppercase"
                    placeholder={copy.placeholderCategory}
                  />
                  <datalist id="manual-revenue-categories">
                    {manualRevenueCategoryOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.amountEuro}</label>
                  <input
                    type="number"
                    value={newManualRevenue.amount}
                    onChange={(e) => setNewManualRevenue({ ...newManualRevenue, amount: e.target.value })}
                    className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-bold focus:border-sky-500 transition-all outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                    {copy.existingIncomeGroups}
                  </p>
                  <p className="text-xs font-semibold text-slate-400">
                    {manualRevenueGroupOptions.length > 0 ? copy.existingIncomeGroupsHelp : copy.newIncomeGroupHelp}
                  </p>
                </div>

                {manualRevenueGroupOptions.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {manualRevenueGroupOptions.slice(0, 12).map((group) => {
                      const category = manualRevenueCategoryOptions.find(
                        (option) => categoryKey(option.value) === categoryKey(String(group.category || 'other'))
                      );
                      const active = newManualRevenue.serviceName.trim().toLowerCase() === group.serviceName.toLowerCase();

                      return (
                        <button
                          key={group.serviceName}
                          type="button"
                          onClick={() => selectManualRevenueGroup(group)}
                          className={cn(
                            "min-w-[160px] rounded-2xl border px-4 py-3 text-left transition-all",
                            active
                              ? "border-sky-300 bg-white shadow-sm ring-2 ring-sky-100"
                              : "border-slate-100 bg-white/80 hover:border-slate-300"
                          )}
                        >
                          <p className="truncate text-xs font-black uppercase tracking-[0.16em] text-slate-800">
                            {group.serviceName}
                          </p>
                          <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                            {category?.label || formatCategoryLabel(String(group.category || 'other'))}
                          </p>
                          {group.count > 0 && (
                            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-sky-600">
                              {group.count} {group.count === 1 ? copy.transactionSingular : copy.transactionsLower}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.revenueDate}</label>
                  <input
                    type="date"
                    value={newManualRevenue.date}
                    onChange={(e) => setNewManualRevenue({ ...newManualRevenue, date: e.target.value })}
                    className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-bold focus:border-sky-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.paymentMethodLabel}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['cash', 'card'] as const).map((method) => {
                      const active = newManualRevenue.paymentMethod === method;
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setNewManualRevenue({ ...newManualRevenue, paymentMethod: method })}
                          className={cn(
                            "py-4 rounded-2xl border-2 text-xs font-black uppercase tracking-[0.18em] transition-all",
                            active
                              ? method === 'cash'
                                ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
                                : "bg-sky-50 border-sky-500 text-sky-700 shadow-sm"
                              : "bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-300"
                          )}
                        >
                          {method === 'cash' ? `€ ${copy.paymentCash}` : `💳 ${copy.paymentCard}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.revenueNotes}</label>
                  <textarea
                    value={newManualRevenue.notes}
                    onChange={(e) => setNewManualRevenue({ ...newManualRevenue, notes: e.target.value })}
                    rows={4}
                    className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-medium focus:border-sky-500 transition-all outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 sm:px-12 py-6 sm:py-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-4">
              <button
                onClick={() => setShowAddRevenue(false)}
                className="px-8 py-4 text-sm font-bold text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors"
              >
                {copy.cancel}
              </button>
              <button
                onClick={handleAddManualRevenue}
                disabled={savingRevenue}
                className="px-12 py-4 text-sm font-black text-white bg-slate-800 rounded-2xl hover:bg-sky-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl uppercase tracking-[0.2em] disabled:opacity-60 disabled:hover:bg-slate-800 disabled:hover:scale-100"
              >
                {savingRevenue ? copy.savingRevenue : copy.registerRevenue}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal - Clean & Focused */}
      {showAddExpense && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-slate-800/90 backdrop-blur-xl p-3 sm:p-4">
          <div className="w-full max-w-2xl bg-white rounded-[28px] sm:rounded-[40px] shadow-2xl overflow-hidden border-2 border-white/20 max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] flex flex-col overflow-x-hidden">
            <div className="px-4 sm:px-12 py-5 sm:py-10 flex items-center justify-between gap-4 border-b border-slate-100">
              <div className="min-w-0">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tighter uppercase break-words">{copy.newExpense}</h2>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">{copy.salonOperations}</p>
              </div>
              <button
                onClick={() => {
                  setShowAddExpense(false);
                  setExpenseReceiptFile(null);
                }}
                className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-2xl bg-slate-100 text-slate-400 hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-12 space-y-6 sm:space-y-8 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.concept}</label>
                  <input
                    type="text"
                    value={newExpense.name}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      const existingGroup = expenseGroupOptions.find(
                        (group) => group.name.toLowerCase() === nextName.trim().toLowerCase()
                      );

                      if (existingGroup) {
                        selectExpenseGroup(existingGroup);
                        return;
                      }

                      setNewExpense({ ...newExpense, name: nextName });
                    }}
                    list="expense-concepts"
                    className="w-full px-4 sm:px-6 py-4 sm:py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-bold focus:border-rose-500 transition-all outline-none"
                    placeholder={copy.placeholderConcept}
                  />
                  <datalist id="expense-concepts">
                    {expenseGroupOptions.map((item) => (
                      <option key={item.name} value={item.name} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.category}</label>
                  <input
                    type="text"
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value as ExpenseCategory })}
                    list="expense-categories"
                    className="w-full px-4 sm:px-6 py-4 sm:py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-black focus:border-rose-500 transition-all outline-none uppercase"
                    placeholder={copy.placeholderCategory}
                  />
                  <datalist id="expense-categories">
                    {expenseCategoryOptions.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                    {copy.existingExpenseGroups}
                  </p>
                  <p className="text-xs font-semibold text-slate-400">
                    {expenseGroupOptions.length > 0 ? copy.existingExpenseGroupsHelp : copy.newExpenseGroupHelp}
                  </p>
                </div>

                {expenseGroupOptions.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {expenseGroupOptions.slice(0, 12).map((group) => {
                      const category = expenseCategoryOptions.find(
                        (option) => categoryKey(option.value) === categoryKey(String(group.category || 'other'))
                      );
                      const active = newExpense.name.trim().toLowerCase() === group.name.toLowerCase();

                      return (
                        <button
                          key={group.name}
                          type="button"
                          onClick={() => selectExpenseGroup(group)}
                          className={cn(
                            "min-w-[160px] rounded-2xl border px-4 py-3 text-left transition-all",
                            active
                              ? "border-rose-300 bg-white shadow-sm ring-2 ring-rose-100"
                              : "border-slate-100 bg-white/80 hover:border-slate-300"
                          )}
                        >
                          <p className="truncate text-xs font-black uppercase tracking-[0.16em] text-slate-800">
                            {group.name}
                          </p>
                          <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                            {category?.label || formatCategoryLabel(String(group.category || 'other'))}
                          </p>
                          {group.count > 0 && (
                            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">
                              {group.count} {group.count === 1 ? copy.transactionSingular : copy.transactionsLower}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.amountEuro}</label>
                  <input
                    type="number"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    className="w-full px-4 sm:px-6 py-4 sm:py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-bold focus:border-rose-500 transition-all outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.date}</label>
                  <input
                    type="date"
                    value={newExpense.date}
                    onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                    className="w-full px-4 sm:px-6 py-4 sm:py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-bold focus:border-rose-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.vendorOptional}</label>
                  <input
                    type="text"
                    value={newExpense.vendor}
                    onChange={(e) => setNewExpense({ ...newExpense, vendor: e.target.value })}
                    className="w-full px-4 sm:px-6 py-4 sm:py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-bold focus:border-rose-500 transition-all outline-none"
                    placeholder="NOMBRE DEL PROVEEDOR"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.paymentMethodLabel}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['cash', 'card'] as const).map((method) => {
                      const active = newExpense.paymentMethod === method;
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setNewExpense({ ...newExpense, paymentMethod: method })}
                          className={cn(
                            "py-4 rounded-2xl border-2 text-xs font-black uppercase tracking-[0.18em] transition-all",
                            active
                              ? method === 'cash'
                                ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
                                : "bg-sky-50 border-sky-500 text-sky-700 shadow-sm"
                              : "bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-300"
                          )}
                        >
                          {method === 'cash' ? `€ ${copy.paymentCash}` : `💳 ${copy.paymentCard}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.receiptOptional}</label>
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-700 break-all">
                        {expenseReceiptFile ? `${copy.receiptReady}: ${expenseReceiptFile.name}` : copy.uploadReceipt}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-400">JPG, PNG o PDF. Max 10MB.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="cursor-pointer rounded-xl bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] sm:tracking-[0.2em] text-slate-700 shadow-sm ring-1 ring-slate-200 transition-all hover:ring-slate-400">
                        {expenseReceiptFile ? copy.changeReceipt : copy.uploadReceipt}
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(event) => setExpenseReceiptFile(event.target.files?.[0] || null)}
                        />
                      </label>
                      {expenseReceiptFile && (
                        <button
                          type="button"
                          onClick={() => setExpenseReceiptFile(null)}
                          className="text-[10px] font-black uppercase tracking-[0.12em] sm:tracking-[0.2em] text-slate-400 hover:text-slate-700"
                        >
                          {copy.removeReceipt}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-12 py-5 sm:py-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4">
              <button
                onClick={() => {
                  setShowAddExpense(false);
                  setExpenseReceiptFile(null);
                }}
                className="w-full sm:w-auto px-8 py-4 text-sm font-bold text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors"
              >
                {copy.cancel}
              </button>
              <button
                onClick={handleAddExpense}
                disabled={savingExpense}
                className="w-full sm:w-auto px-8 sm:px-12 py-4 text-sm font-black text-white bg-slate-800 rounded-2xl hover:bg-rose-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-rose-200 uppercase tracking-[0.12em] sm:tracking-[0.2em] disabled:opacity-60 disabled:hover:bg-slate-800 disabled:hover:scale-100"
              >
                {savingExpense ? copy.savingExpense : copy.registerExpense}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
