'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Loading } from '@/shared/components/Loading';
import { getBookings, getServices, getExpenses, getEmployees } from '@/shared/lib/firestore';
import type { Booking, Service, Expense, Employee, ExpenseCategory, ExpenseFrequency } from '@/shared/lib/types';
import { formatCurrency, cn } from '@/shared/lib/utils';

type DateRange = 'month' | 'quarter' | 'year' | 'all';

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; icon: string }[] = [
  { value: 'rent', label: 'Alquiler', icon: '🏠' },
  { value: 'utilities', label: 'Servicios (luz, agua)', icon: '⚡' },
  { value: 'products', label: 'Productos', icon: '💄' },
  { value: 'supplies', label: 'Suministros', icon: '📦' },
  { value: 'staff', label: 'Personal', icon: '👥' },
  { value: 'marketing', label: 'Marketing', icon: '📢' },
  { value: 'equipment', label: 'Equipo', icon: '🔧' },
  { value: 'insurance', label: 'Seguros', icon: '🛡️' },
  { value: 'taxes', label: 'Impuestos', icon: '📋' },
  { value: 'maintenance', label: 'Mantenimiento', icon: '🔨' },
  { value: 'other', label: 'Otros', icon: '📌' },
];

export default function FinancialDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [showAddExpense, setShowAddExpense] = useState(false);
  
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

  useEffect(() => {
    if (showAddExpense) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAddExpense]);

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

  // Date range filtering
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    let start = new Date();

    if (dateRange === 'month') {
      start.setMonth(today.getMonth() - 1);
    } else if (dateRange === 'quarter') {
      start.setMonth(today.getMonth() - 3);
    } else if (dateRange === 'year') {
      start.setFullYear(today.getFullYear() - 1);
    } else {
      start = new Date(0); // all time
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
    };
  }, [dateRange]);

  // Filter bookings and expenses by date range
  const filteredBookings = useMemo(() => {
    return bookings.filter(
      (b) =>
        (b.status === 'confirmed' || b.status === 'completed') &&
        b.bookingDate >= startDate &&
        b.bookingDate <= endDate
    );
  }, [bookings, startDate, endDate]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => e.date >= startDate && e.date <= endDate);
  }, [expenses, startDate, endDate]);

  // Calculate financials
  const financials = useMemo(() => {
    const totalRevenue = filteredBookings.reduce(
      (sum, booking) => sum + getServicePrice(booking.serviceId),
      0
    );

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
        const revenue = serviceBookings.reduce((sum, b) => sum + getServicePrice(b.serviceId), 0);
        return {
          service,
          revenue,
          bookingsCount: serviceBookings.length,
          percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
        };
      })
      .filter((item) => item.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    // Revenue by Employee
    const revenueByEmployee = employees
      .map((employee) => {
        const employeeBookings = filteredBookings.filter((b) => b.employeeId === employee.id);
        const revenue = employeeBookings.reduce((sum, b) => sum + getServicePrice(b.serviceId), 0);
        return {
          employee,
          revenue,
          bookingsCount: employeeBookings.length,
          percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
        };
      })
      .filter((item) => item.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      expensesByCategory,
      revenueByService,
      revenueByEmployee,
    };
  }, [filteredBookings, filteredExpenses, services, employees]);

  const handleAddExpense = async () => {
    if (!newExpense.name || !newExpense.amount) {
      alert('Por favor completa los campos requeridos');
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
      alert('Error al añadir el gasto');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este gasto?')) return;

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
          <h1 className="text-6xl font-black text-neutral-800 tracking-tighter uppercase leading-none">
            Finanzas
          </h1>
          <p className="text-neutral-500 text-sm font-black uppercase tracking-[0.3em] mt-4">
            Análisis de Rentabilidad y Gastos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="px-6 py-4 bg-white border border-neutral-200 rounded-2xl text-xs font-black uppercase tracking-[0.2em] focus:border-rose-600 outline-none cursor-pointer shadow-sm transition-all"
          >
            <option value="month">ESTE MES</option>
            <option value="quarter">3 MESES</option>
            <option value="year">1 AÑO</option>
            <option value="all">HISTÓRICO</option>
          </select>

          <button
            onClick={() => setShowAddExpense(true)}
            className="px-8 py-4 bg-neutral-800 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-rose-600 transition-all shadow-2xl shadow-rose-900/20"
          >
            + Añadir Gasto
          </button>
        </div>
      </div>

      {/* Summary Cards - High Impact */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Revenue */}
        <div className="bg-white border border-neutral-100 rounded-[40px] p-8 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative min-h-[220px] flex items-center justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] mb-4">Ingresos Brutos</p>
            <p className="text-4xl font-black text-neutral-800 tracking-tight leading-none whitespace-nowrap">{formatCurrency(financials.totalRevenue)}</p>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-4">{filteredBookings.length} RESERVAS</p>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white border border-neutral-100 rounded-[40px] p-8 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative min-h-[220px] flex items-center justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] mb-4">Gastos Totales</p>
            <p className="text-4xl font-black text-neutral-800 tracking-tight leading-none whitespace-nowrap">{formatCurrency(financials.totalExpenses)}</p>
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-4">{filteredExpenses.length} TRANSACCIONES</p>
          </div>
        </div>

        {/* Net Profit */}
        <div className={cn(
          "rounded-[40px] p-8 shadow-2xl transition-all group overflow-hidden relative min-h-[220px] flex items-center justify-center",
          financials.netProfit >= 0 ? "bg-neutral-800" : "bg-amber-600"
        )}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-4">Beneficio Neto</p>
            <p className="text-4xl font-black text-white tracking-tight leading-none whitespace-nowrap">{formatCurrency(financials.netProfit)}</p>
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mt-4">RESULTADO FINAL</p>
          </div>
        </div>

        {/* Profit Margin */}
        <div className="bg-white border border-neutral-100 rounded-[40px] p-8 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative min-h-[220px] flex items-center justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] mb-4">Margen %</p>
            <p className="text-4xl font-black text-neutral-800 tracking-tight leading-none whitespace-nowrap">{financials.profitMargin.toFixed(1)}%</p>
            <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mt-4">RENTABILIDAD</p>
          </div>
        </div>
      </div>

      {/* Revenue Analytics Grid - High End Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Revenue by Service */}
        <div className="bg-white border border-neutral-100 rounded-[48px] overflow-hidden shadow-sm">
          <div className="px-10 py-8 border-b border-neutral-100 bg-neutral-50/30">
            <h2 className="text-sm font-black text-neutral-800 tracking-[0.3em] uppercase text-center">Ingresos por Servicio</h2>
          </div>
          
          <div className="p-10">
            {financials.revenueByService.length === 0 ? (
              <div className="text-center py-12 text-neutral-300 font-bold uppercase tracking-widest text-xs">Sin datos</div>
            ) : (
              <div className="space-y-8">
                {financials.revenueByService.map((item, index) => (
                  <div key={item.service.id} className="group">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-white font-black text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-lg font-black text-neutral-800 uppercase tracking-tighter leading-none">{item.service.serviceName}</p>
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">{item.bookingsCount} RESERVAS</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-rose-600 tabular-nums leading-none">{formatCurrency(item.revenue)}</p>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">{item.percentage.toFixed(0)}% DEL TOTAL</p>
                      </div>
                    </div>
                    <div className="w-full bg-neutral-100 rounded-full h-1 overflow-hidden">
                      <div
                        className="h-full bg-rose-600 rounded-full transition-all duration-1000"
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
        <div className="bg-white border border-neutral-100 rounded-[48px] overflow-hidden shadow-sm">
          <div className="px-10 py-8 border-b border-neutral-100 bg-neutral-50/30">
            <h2 className="text-sm font-black text-neutral-800 tracking-[0.3em] uppercase text-center">Ingresos por Terapeuta</h2>
          </div>
          
          <div className="p-10">
            {financials.revenueByEmployee.length === 0 ? (
              <div className="text-center py-12 text-neutral-300 font-bold uppercase tracking-widest text-xs">Sin datos</div>
            ) : (
              <div className="space-y-8">
                {financials.revenueByEmployee.map((item, index) => (
                  <div key={item.employee.id} className="group">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-neutral-800 flex items-center justify-center text-white font-black text-lg overflow-hidden">
                          {item.employee.profileImage ? (
                            <img src={item.employee.profileImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{item.employee.firstName[0]}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-lg font-black text-neutral-800 uppercase tracking-tighter leading-none">{item.employee.firstName} {item.employee.lastName}</p>
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">{item.bookingsCount} RESERVAS</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-rose-600 tabular-nums leading-none">{formatCurrency(item.revenue)}</p>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">{item.percentage.toFixed(0)}% DEL TOTAL</p>
                      </div>
                    </div>
                    <div className="w-full bg-neutral-100 rounded-full h-1 overflow-hidden">
                      <div
                        className="h-full bg-neutral-800 rounded-full transition-all duration-1000"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expenses by Category */}
      <div className="bg-white border border-neutral-100 rounded-[48px] overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-neutral-100 bg-neutral-50/30">
          <h2 className="text-sm font-black text-neutral-800 tracking-[0.3em] uppercase text-center">Desglose de Gastos</h2>
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
                <th className="px-10 py-6 text-left text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Fecha / Proveedor</th>
                <th className="px-10 py-6 text-left text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Concepto</th>
                <th className="px-10 py-6 text-left text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Categoría</th>
                <th className="px-10 py-6 text-right text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Importe</th>
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
                        {new Date(expense.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
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

      {/* Add Expense Modal - Clean & Focused */}
      {showAddExpense && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-neutral-800/90 backdrop-blur-xl p-4">
          <div className="w-full max-w-2xl bg-white rounded-[32px] sm:rounded-[40px] shadow-2xl overflow-hidden border-2 border-white/20 max-h-[90vh] flex flex-col">
            <div className="px-6 sm:px-12 py-6 sm:py-10 flex items-center justify-between border-b border-neutral-100">
              <div>
                <h2 className="text-3xl font-black text-neutral-800 tracking-tighter uppercase">Nuevo Gasto</h2>
                <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs mt-1">Operativa del Salón</p>
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
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Categoría</label>
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
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Importe (€)</label>
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
                <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Proveedor (Opcional)</label>
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
