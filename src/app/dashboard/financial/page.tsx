'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Loading } from '@/shared/components/Loading';
import { getBookings, getServices, getExpenses, getEmployees } from '@/shared/lib/firestore';
import { calculateBookingTotals } from '@/shared/lib/booking-utils';
import type { Booking, Service, Expense, Employee, ExpenseCategory, ExpenseFrequency } from '@/shared/lib/types';
import { formatCurrency, cn } from '@/shared/lib/utils';

type DateRange = 'month' | 'quarter' | 'year' | 'all';

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; icon: string }[] = [
  { value: 'rent', label: 'Rent', icon: '🏠' },
  { value: 'utilities', label: 'Utilities', icon: '⚡' },
  { value: 'products', label: 'Products', icon: '💄' },
  { value: 'supplies', label: 'Supplies', icon: '📦' },
  { value: 'staff', label: 'Staff', icon: '👥' },
  { value: 'marketing', label: 'Marketing', icon: '📢' },
  { value: 'equipment', label: 'Equipment', icon: '🔧' },
  { value: 'insurance', label: 'Insurance', icon: '🛡️' },
  { value: 'taxes', label: 'Taxes', icon: '📋' },
  { value: 'maintenance', label: 'Maintenance', icon: '🔨' },
  { value: 'other', label: 'Other', icon: '📌' },
];

export default function FinancialDashboard() {
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
    const employee = employees.find((e) => e.id === booking.employeeId);
    
    // For self-employed, we only collect 50% deposit (the other 50% is their business)
    if (employee?.employmentType === 'self-employed') {
      return servicePrice * 0.5;
    }
    
    // For regular employees, we collect 100%
    return servicePrice;
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
        const hasPaidDeposit = b.depositPaid === true;
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
        const hasPaidDeposit = b.depositPaid === true;
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
    const expensesByCategory = EXPENSE_CATEGORIES.map((cat) => {
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
  }, [filteredBookings, filteredExpenses, services, employees, payoutBookings]);

  const handleAddExpense = async () => {
    if (!newExpense.name || !newExpense.amount) {
      alert('Please fill in required fields');
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
      alert('Error adding expense');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

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
          <h1 className="text-5xl font-black text-primary-800 tracking-tighter uppercase leading-none bg-gradient-to-r from-primary-900 to-accent-600 bg-clip-text text-transparent">
            Financials
          </h1>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-500 shadow-lg shadow-accent-500/50" />
            <p className="text-primary-400 text-[10px] font-black uppercase tracking-[0.4em]">
              Profitability & Expense Analysis
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="px-6 py-4 bg-white border border-primary-100 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] focus:border-accent-500 outline-none cursor-pointer shadow-sm hover:shadow-md transition-all"
          >
            <option value="month">THIS MONTH</option>
            <option value="quarter">LAST 3 MONTHS</option>
            <option value="year">1 YEAR</option>
            <option value="all">ALL TIME</option>
          </select>

          <button
            onClick={() => setShowAddExpense(true)}
            className="px-8 py-4 bg-primary-800 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-accent-600 hover:-translate-y-0.5 transition-all shadow-xl shadow-primary-900/10 flex items-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
            </svg>
            Add Expense
          </button>
        </div>
      </div>

      {/* Summary Cards - Elegant & Light */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Revenue */}
        <div className="bg-white border-2 border-accent-100/50 rounded-[40px] p-8 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative min-h-[220px] flex items-center justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-primary-400 uppercase tracking-[0.3em] mb-4">Gross Income</p>
            <p className="text-4xl font-black text-primary-800 tracking-tight leading-none whitespace-nowrap">{formatCurrency(financials.totalRevenue)}</p>
            <p className="text-[10px] font-black text-accent-500 uppercase tracking-widest mt-4">{filteredBookings.length} BOOKINGS</p>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white border-2 border-accent-100/50 rounded-[40px] p-8 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative min-h-[220px] flex items-center justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-primary-400 uppercase tracking-[0.3em] mb-4">Total Expenses</p>
            <p className="text-4xl font-black text-primary-800 tracking-tight leading-none whitespace-nowrap">{formatCurrency(financials.totalExpenses)}</p>
            <p className="text-[10px] font-black text-accent-500 uppercase tracking-widest mt-4">{filteredExpenses.length} TRANSACTIONS</p>
          </div>
        </div>

        {/* Net Profit */}
        <div className={cn(
          "rounded-[40px] p-8 shadow-xl transition-all group overflow-hidden relative min-h-[220px] flex items-center justify-center border-2",
          financials.netProfit >= 0 ? "bg-accent-50 border-accent-200" : "bg-warning-50 border-warning-200"
        )}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-primary-500 uppercase tracking-[0.3em] mb-4">Net Profit</p>
            <p className="text-4xl font-black text-primary-900 tracking-tight leading-none whitespace-nowrap">{formatCurrency(financials.netProfit)}</p>
            <p className="text-[10px] font-black text-accent-600 uppercase tracking-widest mt-4">FINAL RESULT</p>
          </div>
        </div>

        {/* Profit Margin */}
        <div className="bg-white border-2 border-accent-100/50 rounded-[40px] p-8 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative min-h-[220px] flex items-center justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-primary-400 uppercase tracking-[0.3em] mb-4">Margin %</p>
            <p className="text-4xl font-black text-primary-800 tracking-tight leading-none whitespace-nowrap">{financials.profitMargin.toFixed(1)}%</p>
            <p className="text-[10px] font-black text-accent-500 uppercase tracking-widest mt-4">PROFITABILITY</p>
          </div>
        </div>
      </div>

      {/* Revenue Analytics Grid - Professional Ibiza Style */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Revenue by Service */}
        <div className="bg-white border-2 border-accent-100/50 rounded-[48px] overflow-hidden shadow-sm">
          <div className="px-10 py-8 border-b-2 border-accent-100/50 bg-accent-50/30">
            <h2 className="text-sm font-black text-primary-800 tracking-[0.3em] uppercase text-center">Revenue by Service</h2>
          </div>
          
          <div className="p-10">
            {financials.revenueByService.length === 0 ? (
              <div className="text-center py-12 text-primary-200 font-bold uppercase tracking-widest text-[10px]">No data available</div>
            ) : (
              <div className="space-y-8">
                {financials.revenueByService.map((item, index) => (
                  <div key={item.service.id} className="group">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary-800 flex items-center justify-center text-white font-black text-sm shadow-md">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-lg font-black text-primary-800 uppercase tracking-tighter leading-none">{item.service.serviceName}</p>
                          <p className="text-[10px] font-bold text-primary-400 uppercase tracking-widest mt-1">{item.bookingsCount} BOOKINGS</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-accent-600 tabular-nums leading-none">{formatCurrency(item.revenue)}</p>
                        <p className="text-[10px] font-bold text-primary-400 uppercase tracking-widest mt-1">{item.percentage.toFixed(0)}% OF TOTAL</p>
                      </div>
                    </div>
                    <div className="w-full bg-accent-50 rounded-full h-1 overflow-hidden">
                      <div
                        className="h-full bg-accent-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(197,160,89,0.3)]"
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
        <div className="bg-white border-2 border-accent-100/50 rounded-[48px] overflow-hidden shadow-sm">
          <div className="px-10 py-8 border-b-2 border-accent-100/50 bg-accent-50/30 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <h2 className="text-sm font-black text-primary-800 tracking-[0.3em] uppercase text-center lg:text-left">
              Revenue by Therapist
            </h2>
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-black text-primary-400 uppercase tracking-[0.2em]">Month</label>
              <input
                type="month"
                value={payoutMonth}
                onChange={(e) => setPayoutMonth(e.target.value)}
                className="px-4 py-2 border border-accent-100 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] focus:border-accent-500 outline-none bg-white shadow-sm"
              />
            </div>
          </div>
          
          <div className="p-10">
            {financials.payoutByEmployee.length === 0 ? (
              <div className="text-center py-12 text-primary-200 font-bold uppercase tracking-widest text-[10px]">
                No data for {payoutMonth || 'selected month'}
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex items-center justify-between bg-accent-50/50 border border-accent-100 rounded-2xl p-4">
                  <div className="text-[10px] font-black text-primary-500 uppercase tracking-[0.2em]">
                    Monthly Total
                  </div>
                  <div className="text-lg font-black text-primary-900">
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
                        <div className="w-12 h-12 rounded-xl bg-primary-800 flex items-center justify-center text-white font-black text-lg overflow-hidden shadow-md group-hover:scale-105 transition-transform ring-2 ring-accent-50">
                          {item.employee.profileImage ? (
                            <img src={item.employee.profileImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{item.employee.firstName[0]}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-black text-primary-800 uppercase tracking-tighter leading-none group-hover:text-accent-600 transition-colors">
                              {item.employee.firstName} {item.employee.lastName}
                            </p>
                            {item.employee.employmentType === 'self-employed' && (
                              <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-accent-100 text-accent-700 rounded-md">
                                50%
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-primary-400 uppercase tracking-widest mt-1">
                            {item.bookingsCount} {item.bookingsCount === 1 ? 'booking' : 'bookings'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-primary-900 tabular-nums leading-none">
                          {formatCurrency(item.revenue)}
                        </p>
                        <p className="text-[10px] font-bold text-primary-400 uppercase tracking-widest mt-1 uppercase">
                          {item.employee.employmentType === 'self-employed' ? 'DEPOSITS COLLECTED' : 'TOTAL GENERATED'}
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-accent-50 rounded-full h-1 overflow-hidden">
                      <div
                        className="h-full bg-primary-800 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(38,38,38,0.2)]"
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
      <div className="bg-white border border-neutral-100 rounded-[48px] overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-neutral-100 bg-neutral-50/30">
          <h2 className="text-sm font-black text-neutral-800 tracking-[0.3em] uppercase text-center">Expense Breakdown</h2>
        </div>
        
        <div className="p-10">
          {financials.expensesByCategory.length === 0 ? (
            <div className="text-center py-12 text-neutral-300 font-bold uppercase tracking-widest text-xs">Sin gastos</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8">
              {financials.expensesByCategory.map((cat) => (
                <div key={cat.value} className="group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">{cat.icon}</span>
                      <div>
                        <p className="text-lg font-black text-neutral-800 uppercase tracking-tighter leading-none">{cat.label}</p>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">{cat.count} FACTURAS</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-neutral-800 tabular-nums leading-none">{formatCurrency(cat.total)}</p>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">{cat.percentage.toFixed(0)}%</p>
                    </div>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-1 overflow-hidden">
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
      <div className="bg-white border border-neutral-100 rounded-[48px] overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/30">
          <h2 className="text-sm font-black text-neutral-800 tracking-[0.3em] uppercase">Transacciones Recientes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50/50">
                <th className="px-10 py-6 text-left text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Date / Vendor</th>
                <th className="px-10 py-6 text-left text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Description</th>
                <th className="px-10 py-6 text-left text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Category</th>
                <th className="px-10 py-6 text-right text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Amount</th>
                <th className="px-10 py-6 text-right text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredExpenses.slice(0, 10).map((expense) => {
                const category = EXPENSE_CATEGORIES.find((c) => c.value === expense.category);
                return (
                  <tr key={expense.id} className="hover:bg-neutral-50 transition-all group">
                    <td className="px-10 py-8">
                      <div className="text-lg font-black text-neutral-800 uppercase tracking-tighter leading-none mb-1">
                        {new Date(expense.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                      </div>
                      <div className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">{expense.vendor || '—'}</div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="text-sm font-bold text-neutral-700 uppercase tracking-widest">{expense.name}</div>
                    </td>
                    <td className="px-10 py-8">
                      <span className="px-4 py-2 rounded-2xl bg-neutral-100 text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em]">
                        {category?.label || expense.category}
                      </span>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <p className="text-xl font-black text-neutral-800 tabular-nums">{formatCurrency(expense.amount)}</p>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="w-10 h-10 bg-neutral-50 text-neutral-300 rounded-xl hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center mx-auto lg:ml-auto lg:mr-0"
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
        <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center bg-neutral-900/70 backdrop-blur-lg p-4">
          <div className="w-full max-w-3xl bg-white rounded-[32px] sm:rounded-[40px] shadow-2xl overflow-hidden border border-neutral-100 max-h-[90vh] flex flex-col">
            <div className="px-6 sm:px-10 py-6 sm:py-8 flex items-start sm:items-center justify-between gap-4 border-b border-neutral-100">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-400">
                  Payment details • {new Date(payoutStartDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-black text-lg overflow-hidden">
                    {payoutDetail.employee.profileImage ? (
                      <img src={payoutDetail.employee.profileImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{payoutDetail.employee.firstName?.[0] || 'T'}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-neutral-900 tracking-tight leading-none">
                      {payoutDetail.employee.firstName} {payoutDetail.employee.lastName}
                    </h3>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mt-1">
                      {payoutDetail.bookings.length} {payoutDetail.bookings.length === 1 ? 'booking' : 'bookings'}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setPayoutDetail(null)}
                className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-all flex items-center justify-center"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 sm:px-10 py-6 bg-neutral-50/60 border-b border-neutral-100 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-neutral-500">
                  {payoutDetail.employee.employmentType === 'self-employed' 
                    ? 'Total Revenue (50% Deposit)' 
                    : 'Total Revenue (100%)'}
                </p>
                <p className="text-3xl font-black text-rose-600">{formatCurrency(payoutDetail.totalRevenue)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-neutral-500">Total Services</p>
                <p className="text-xl font-black text-neutral-900">{payoutDetail.bookings.length} BOOKINGS</p>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-10 py-6 space-y-4">
              {payoutDetail.bookings.length === 0 ? (
                <div className="text-center py-12 text-neutral-300 font-bold uppercase tracking-widest text-xs">
                  No bookings for this month.
                </div>
              ) : (
                payoutDetail.bookings.map((booking) => {
                  const service = services.find((s) => s.id === booking.serviceId);
                  return (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between bg-white border border-neutral-100 rounded-2xl p-4 shadow-sm"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-black text-neutral-900 uppercase tracking-tight">
                          {service?.serviceName || 'Service'}
                        </p>
                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-[0.2em]">
                          {new Date(booking.bookingDate + 'T00:00:00').toLocaleDateString('en-US', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          · {booking.bookingTime}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-neutral-900 tabular-nums">
                          {formatCurrency(getBookingAmount(booking))}
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
                          {booking.status === 'completed' ? 'Paid' : booking.status}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-6 sm:px-10 py-6 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end">
              <button
                onClick={() => setPayoutDetail(null)}
                className="px-8 py-3 text-sm font-black uppercase tracking-[0.2em] text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal - Clean & Focused */}
      {showAddExpense && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-neutral-800/90 backdrop-blur-xl p-4">
          <div className="w-full max-w-2xl bg-white rounded-[32px] sm:rounded-[40px] shadow-2xl overflow-hidden border-2 border-white/20 max-h-[90vh] flex flex-col">
            <div className="px-6 sm:px-12 py-6 sm:py-10 flex items-center justify-between border-b border-neutral-100">
              <div>
                <h2 className="text-3xl font-black text-neutral-800 tracking-tighter uppercase">New Expense</h2>
                <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs mt-1">Salon Operations</p>
              </div>
              <button
                onClick={() => setShowAddExpense(false)}
                className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-all flex items-center justify-center"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 sm:p-12 space-y-8 flex-1 min-h-0 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Concepto</label>
                  <input
                    type="text"
                    value={newExpense.name}
                    onChange={(e) => setNewExpense({ ...newExpense, name: e.target.value })}
                    className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-800 font-bold focus:border-rose-500 transition-all outline-none"
                    placeholder="ALQUILER, PRODUCTOS..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Category</label>
                  <select
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value as ExpenseCategory })}
                    className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-800 font-black focus:border-rose-500 transition-all outline-none appearance-none"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.icon} {cat.label.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Amount (€)</label>
                  <input
                    type="number"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-800 font-bold focus:border-rose-500 transition-all outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Fecha</label>
                  <input
                    type="date"
                    value={newExpense.date}
                    onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                    className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-800 font-bold focus:border-rose-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Vendor (Optional)</label>
                <input
                  type="text"
                  value={newExpense.vendor}
                  onChange={(e) => setNewExpense({ ...newExpense, vendor: e.target.value })}
                  className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-800 font-bold focus:border-rose-500 transition-all outline-none"
                  placeholder="NOMBRE DEL PROVEEDOR"
                />
              </div>
            </div>

            <div className="px-6 sm:px-12 py-6 sm:py-8 bg-neutral-50 border-t border-neutral-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-4">
              <button
                onClick={() => setShowAddExpense(false)}
                className="px-8 py-4 text-sm font-bold text-neutral-400 uppercase tracking-widest hover:text-neutral-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddExpense}
                className="px-12 py-4 text-sm font-black text-white bg-neutral-800 rounded-2xl hover:bg-rose-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-rose-200 uppercase tracking-[0.2em]"
              >
                REGISTRAR GASTO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
