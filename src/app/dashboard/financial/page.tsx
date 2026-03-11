'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Loading } from '@/shared/components/Loading';
import { getBookings, getServices, getExpenses, getEmployees } from '@/shared/lib/firestore';
import { calculateBookingTotals } from '@/shared/lib/booking-utils';
import type { Booking, Service, Expense, Employee, ExpenseCategory, ExpenseFrequency } from '@/shared/lib/types';
import { formatCurrency, cn } from '@/shared/lib/utils';
import { useLanguage } from '@/shared/context/LanguageContext';

type DateRange = 'month' | 'quarter' | 'year' | 'all';

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: { en: string; es: string }; icon: string }[] = [
  { value: 'rent', label: { en: 'Rent', es: 'Alquiler' }, icon: '🏠' },
  { value: 'utilities', label: { en: 'Utilities', es: 'Suministros' }, icon: '⚡' },
  { value: 'products', label: { en: 'Products', es: 'Productos' }, icon: '💄' },
  { value: 'supplies', label: { en: 'Supplies', es: 'Materiales' }, icon: '📦' },
  { value: 'staff', label: { en: 'Staff', es: 'Personal' }, icon: '👥' },
  { value: 'marketing', label: { en: 'Marketing', es: 'Marketing' }, icon: '📢' },
  { value: 'equipment', label: { en: 'Equipment', es: 'Equipamiento' }, icon: '🔧' },
  { value: 'insurance', label: { en: 'Insurance', es: 'Seguro' }, icon: '🛡️' },
  { value: 'taxes', label: { en: 'Taxes', es: 'Impuestos' }, icon: '📋' },
  { value: 'maintenance', label: { en: 'Maintenance', es: 'Mantenimiento' }, icon: '🔨' },
  { value: 'other', label: { en: 'Other', es: 'Otros' }, icon: '📌' },
];

export default function FinancialDashboard() {
  const { language } = useLanguage();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [payoutMonth, setPayoutMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [showAddExpense, setShowAddExpense] = useState(false);
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
          addExpense: 'Anadir gasto',
          grossIncome: 'Ingreso bruto',
          bookings: 'RESERVAS',
          totalExpenses: 'Gastos totales',
          transactions: 'TRANSACCIONES',
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
          recentTransactions: 'Transacciones recientes',
          dateVendor: 'Fecha / Proveedor',
          description: 'Descripcion',
          category: 'Categoria',
          amount: 'Importe',
          action: 'Accion',
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
          fillRequiredFields: 'Completa los campos obligatorios.',
          errorAddingExpense: 'Error al anadir el gasto.',
          confirmDeleteExpense: 'Estas seguro de que quieres eliminar este gasto?',
          placeholderConcept: 'ALQUILER, PRODUCTOS...',
          cancel: 'Cancelar',
          registerExpense: 'Registrar gasto',
        }
      : {
          title: 'Financials',
          subtitle: 'Profitability & Expense Analysis',
          thisMonth: 'THIS MONTH',
          last3Months: 'LAST 3 MONTHS',
          oneYear: '1 YEAR',
          allTime: 'ALL TIME',
          addExpense: 'Add Expense',
          grossIncome: 'Gross Income',
          bookings: 'BOOKINGS',
          totalExpenses: 'Total Expenses',
          transactions: 'TRANSACTIONS',
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
          recentTransactions: 'Recent Transactions',
          dateVendor: 'Date / Vendor',
          description: 'Description',
          category: 'Category',
          amount: 'Amount',
          action: 'Action',
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
          fillRequiredFields: 'Please fill in required fields.',
          errorAddingExpense: 'Error adding expense.',
          confirmDeleteExpense: 'Are you sure you want to delete this expense?',
          placeholderConcept: 'RENT, PRODUCTS...',
          cancel: 'Cancel',
          registerExpense: 'Register Expense',
        };

  const expenseCategories = useMemo(
    () =>
      EXPENSE_CATEGORIES.map((category) => ({
        value: category.value,
        icon: category.icon,
        label: category.label[language],
      })),
    [language]
  );

  useEffect(() => {
    loadData();
  }, []);

  const overlayOpen = showAddExpense || Boolean(payoutDetail);

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
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServicePrice = (serviceId: string): number => {
    const service = services.find((s) => s.id === serviceId);
    if (!service) return 0;
    return typeof service.price === 'number' ? service.price : parseFloat(String(service.price || 0));
  };

  const getBookingAmount = (booking: Booking): number => {
    const servicePrice = getServicePrice(booking.serviceId);
    const additionalServicesTotal = (booking.additionalServices || []).reduce((sum, item) => sum + item.price, 0);
    const totalPrice = servicePrice + additionalServicesTotal;
    const depositAmount = booking.depositAmount !== undefined ? booking.depositAmount / 100 : totalPrice * 0.5;
    const hasDepositPaid = booking.depositPaid === true || booking.paymentStatus === 'deposit_paid' || booking.paymentStatus === 'paid';
    const isFullyPaid = booking.paymentStatus === 'paid' && (booking.finalPaymentReceived === true || booking.status === 'completed');
    const employee = employees.find((e) => e.id === booking.employeeId);
    
    // For self-employed, we only collect 50% deposit (the other 50% is their business)
    if (employee?.employmentType === 'self-employed') {
      return hasDepositPaid ? depositAmount : 0;
    }

    if (isFullyPaid) return totalPrice;
    if (hasDepositPaid) return depositAmount;
    return 0;
  };

  // Date range filtering (confirmed or completed bookings for accurate revenue)
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    let start = new Date(year, month, 1);
    let end = new Date(year, month + 1, 0);

    if (dateRange === 'quarter') {
      start = new Date(year, month - 3, 1);
    } else if (dateRange === 'year') {
      start = new Date(year - 1, month, 1);
    } else if (dateRange === 'all') {
      start = new Date(2025, 0, 1);
    }

    const toYYYYMMDD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    return {
      startDate: toYYYYMMDD(start),
      endDate: toYYYYMMDD(end),
    };
  }, [dateRange]);

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
    const totalRevenue = filteredBookings.reduce((sum, booking) => sum + getBookingAmount(booking), 0);

    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Group expenses by category
    const expensesByCategory = expenseCategories.map((cat) => {
      const categoryExpenses = filteredExpenses.filter((e) => e.category === cat.value);
      const total = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
      return {
        ...cat,
        total,
        count: categoryExpenses.length,
        percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
      };
    }).filter((cat) => cat.total > 0).sort((a, b) => b.total - a.total);

    // Revenue by Service
    const revenueByService = services
      .map((service) => {
        const serviceBookings = filteredBookings.filter((b) => b.serviceId === service.id);
        const revenue = serviceBookings.reduce((sum, b) => sum + getBookingAmount(b), 0);
        return {
          service,
          revenue,
          bookingsCount: serviceBookings.length,
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
        percentage: totalRevenue > 0 ? (unknownRevenue / totalRevenue) * 100 : 0,
      });
    }

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
      expensesByCategory,
      revenueByService,
      revenueByEmployee,
      payoutByEmployee,
      payoutTotalRevenue,
    };
  }, [filteredBookings, filteredExpenses, services, employees, payoutBookings, expenseCategories]);

  const handleAddExpense = async () => {
    if (!newExpense.name || !newExpense.amount) {
      alert(copy.fillRequiredFields);
      return;
    }

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newExpense,
          amount: parseFloat(newExpense.amount),
        }),
      });

      if (response.ok) {
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
        });
      }
    } catch (error) {
      console.error('Error adding expense:', error);
      alert(copy.errorAddingExpense);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm(copy.confirmDeleteExpense)) return;

    try {
      const response = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Error al eliminar el gasto');
    }
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
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] focus:border-sky-500 outline-none cursor-pointer shadow-sm hover:shadow-md transition-all"
          >
            <option value="month">{copy.thisMonth}</option>
            <option value="quarter">{copy.last3Months}</option>
            <option value="year">{copy.oneYear}</option>
            <option value="all">{copy.allTime}</option>
          </select>

          <button
            onClick={() => setShowAddExpense(true)}
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
            <p className="text-4xl font-black text-slate-800 tracking-tight leading-none whitespace-nowrap">{formatCurrency(financials.totalRevenue)}</p>
            <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mt-4">{filteredBookings.length} {copy.bookings}</p>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white border-2 border-sky-100/50 rounded-[40px] p-8 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative min-h-[220px] flex items-center justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">{copy.totalExpenses}</p>
            <p className="text-4xl font-black text-slate-800 tracking-tight leading-none whitespace-nowrap">{formatCurrency(financials.totalExpenses)}</p>
            <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mt-4">{filteredExpenses.length} {copy.transactions}</p>
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
            <p className="text-4xl font-black text-slate-900 tracking-tight leading-none whitespace-nowrap">{formatCurrency(financials.netProfit)}</p>
            <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest mt-4">{copy.finalResult}</p>
          </div>
        </div>

        {/* Profit Margin */}
        <div className="bg-white border-2 border-sky-100/50 rounded-[40px] p-8 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative min-h-[220px] flex items-center justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">{copy.margin}</p>
            <p className="text-4xl font-black text-slate-800 tracking-tight leading-none whitespace-nowrap">{financials.profitMargin.toFixed(1)}%</p>
            <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mt-4">{copy.profitability}</p>
          </div>
        </div>
      </div>

      {/* Revenue Analytics Grid - Professional Ibiza Style */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Revenue by Service */}
        <div className="bg-white border-2 border-sky-100/50 rounded-[48px] overflow-hidden shadow-sm">
          <div className="px-10 py-8 border-b-2 border-sky-100/50 bg-sky-50/30">
            <h2 className="text-sm font-black text-slate-800 tracking-[0.3em] uppercase text-center">{copy.revenueByService}</h2>
          </div>
          
          <div className="p-10">
            {financials.revenueByService.length === 0 ? (
              <div className="text-center py-12 text-slate-200 font-bold uppercase tracking-widest text-[10px]">{copy.noDataAvailable}</div>
            ) : (
              <div className="space-y-8">
                {financials.revenueByService.map((item, index) => (
                  <div key={item.service.id} className="group">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white font-black text-sm shadow-md">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-lg font-black text-slate-800 uppercase tracking-tighter leading-none">{item.service.serviceName}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{item.bookingsCount} {copy.bookings}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-sky-600 tabular-nums leading-none">{formatCurrency(item.revenue)}</p>
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
                ))}
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

      {/* Expenses by Category */}
      <div className="bg-white border border-slate-100 rounded-[48px] overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/30">
          <h2 className="text-sm font-black text-slate-800 tracking-[0.3em] uppercase text-center">{copy.expenseBreakdown}</h2>
        </div>
        
        <div className="p-10">
          {financials.expensesByCategory.length === 0 ? (
            <div className="text-center py-12 text-slate-300 font-bold uppercase tracking-widest text-xs">{copy.noExpenses}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8">
              {financials.expensesByCategory.map((cat) => (
                <div key={cat.value} className="group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">{cat.icon}</span>
                      <div>
                        <p className="text-lg font-black text-slate-800 uppercase tracking-tighter leading-none">{cat.label}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{cat.count} {copy.invoices}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-slate-800 tabular-nums leading-none">{formatCurrency(cat.total)}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{cat.percentage.toFixed(0)}%</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Expenses Table */}
      <div className="bg-white border border-slate-100 rounded-[48px] overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <h2 className="text-sm font-black text-slate-800 tracking-[0.3em] uppercase">{copy.recentTransactions}</h2>
        </div>
        <div className="overflow-x-auto">
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
              {filteredExpenses.slice(0, 10).map((expense) => {
                const category = expenseCategories.find((c) => c.value === expense.category);
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

      {/* Add Expense Modal - Clean & Focused */}
      {showAddExpense && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-slate-800/90 backdrop-blur-xl p-4">
          <div className="w-full max-w-2xl bg-white rounded-[32px] sm:rounded-[40px] shadow-2xl overflow-hidden border-2 border-white/20 max-h-[90vh] flex flex-col">
            <div className="px-6 sm:px-12 py-6 sm:py-10 flex items-center justify-between border-b border-slate-100">
              <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">{copy.newExpense}</h2>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">{copy.salonOperations}</p>
              </div>
              <button
                onClick={() => setShowAddExpense(false)}
                className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 sm:p-12 space-y-8 flex-1 min-h-0 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.concept}</label>
                  <input
                    type="text"
                    value={newExpense.name}
                    onChange={(e) => setNewExpense({ ...newExpense, name: e.target.value })}
                    className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-bold focus:border-rose-500 transition-all outline-none"
                    placeholder={copy.placeholderConcept}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.category}</label>
                  <select
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value as ExpenseCategory })}
                    className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-black focus:border-rose-500 transition-all outline-none appearance-none"
                  >
                    {expenseCategories.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.icon} {cat.label.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.amountEuro}</label>
                  <input
                    type="number"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-bold focus:border-rose-500 transition-all outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.date}</label>
                  <input
                    type="date"
                    value={newExpense.date}
                    onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                    className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-bold focus:border-rose-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{copy.vendorOptional}</label>
                <input
                  type="text"
                  value={newExpense.vendor}
                  onChange={(e) => setNewExpense({ ...newExpense, vendor: e.target.value })}
                  className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 font-bold focus:border-rose-500 transition-all outline-none"
                  placeholder="NOMBRE DEL PROVEEDOR"
                />
              </div>
            </div>

            <div className="px-6 sm:px-12 py-6 sm:py-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-4">
              <button
                onClick={() => setShowAddExpense(false)}
                className="px-8 py-4 text-sm font-bold text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors"
              >
                {copy.cancel}
              </button>
              <button
                onClick={handleAddExpense}
                className="px-12 py-4 text-sm font-black text-white bg-slate-800 rounded-2xl hover:bg-rose-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-rose-200 uppercase tracking-[0.2em]"
              >
                {copy.registerExpense}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
