'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Loading } from '@/shared/components/Loading';
import { getBookings, getEmployees, getServices } from '@/shared/lib/firestore';
import type { Booking, Employee, Service } from '@/shared/lib/types';
import { calculateBookingTotals } from '@/shared/lib/booking-utils';
import { formatCurrency, cn } from '@/shared/lib/utils';
import { useLanguage } from '@/shared/context/LanguageContext';

type EndOfDayMethod = 'cash' | 'pos' | 'online';
type EndOfDayTransactionType = 'deposit' | 'final_payment' | 'refund';

interface EndOfDayTransaction {
  id: string;
  bookingId: string;
  dateKey: string;
  timestamp: Date;
  displayTime: string;
  clientName: string;
  serviceName: string;
  employeeType?: Employee['employmentType'];
  method: EndOfDayMethod;
  type: EndOfDayTransactionType;
  amount: number; // refunds are negative
  createdByName?: string;
  closedByName?: string;
  staffId: string;
  staffName: string;
}

export default function EndOfDayPage() {
  const { language } = useLanguage();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [filterMethod, setFilterMethod] = useState<'all' | EndOfDayMethod>('all');
  const [filterStaff, setFilterStaff] = useState<string>('all');
  const [expandedTransactionIds, setExpandedTransactionIds] = useState<string[]>([]);

  const copy =
    language === 'es'
      ? {
          unspecified: 'Sin especificar',
          serviceFallback: 'Servicio',
          title: 'Fin del Dia',
          subtitle: 'Control de pagos y conciliacion',
          date: 'Fecha',
          cash: 'Efectivo',
          cardTerminal: 'Terminal',
          onlineStripe: 'Online / Stripe',
          dailyTotal: 'Total diario',
          transactions: 'transacciones',
          refunds: 'reembolsos',
          filter: 'Filtro:',
          all: 'Todos',
          card: 'Tarjeta',
          online: 'Online',
          allStaff: 'Todo el equipo',
          transactionDetail: 'Detalle de Transacciones',
          timeClient: 'Hora / Cliente',
          service: 'Servicio',
          method: 'Metodo',
          createdClosedBy: 'Creado / Cerrado Por',
          amount: 'Importe',
          noTransactions: 'Sin transacciones para este dia',
          deposit: 'Deposito',
          finalPayment: 'Pago final',
          refund: 'Reembolso',
          createdBy: 'Creo:',
          closedBy: 'Cerro:',
          refundedBy: 'Reembolso:',
          selfEmployed: '50% (Autonomo)',
          expand: 'Expandir',
          collapse: 'Ver menos',
        }
      : {
          unspecified: 'Unspecified',
          serviceFallback: 'Service',
          title: 'End of Day',
          subtitle: 'Payment Control & Reconciliation',
          date: 'Date',
          cash: 'Cash',
          cardTerminal: 'Card Terminal',
          onlineStripe: 'Online / Stripe',
          dailyTotal: 'Daily Total',
          transactions: 'transactions',
          refunds: 'refunds',
          filter: 'Filter:',
          all: 'All',
          card: 'Card',
          online: 'Online',
          allStaff: 'All Staff',
          transactionDetail: 'Transaction Detail',
          timeClient: 'Time / Client',
          service: 'Service',
          method: 'Method',
          createdClosedBy: 'Created / Closed By',
          amount: 'Amount',
          noTransactions: 'No transactions for this day',
          deposit: 'Deposit',
          finalPayment: 'Final payment',
          refund: 'Refund',
          createdBy: 'Created:',
          closedBy: 'Closed:',
          refundedBy: 'Refunded:',
          selfEmployed: '50% (Self-employed)',
          expand: 'Expand',
          collapse: 'Show less',
        };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [bookingsData, employeesData, servicesData] = await Promise.all([
        getBookings(),
        getEmployees(),
        getServices(),
      ]);
      setBookings(bookingsData);
      setEmployees(employeesData);
      setServices(servicesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toDateKey = (value: unknown): string | null => {
    if (!value) return null;
    const date =
      value instanceof Date
        ? value
        : typeof (value as any)?.toDate === 'function'
        ? (value as any).toDate()
        : new Date(value as any);
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof (value as any)?.toDate === 'function') return (value as any).toDate();
    const parsed = new Date(value as any);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const toTimeLabel = (date: Date | null, fallback: string): string => {
    if (!date) return fallback;
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const allTransactions = useMemo<EndOfDayTransaction[]>(() => {
    const rows: EndOfDayTransaction[] = [];

    bookings.forEach((booking) => {
      const service = services.find((s) => s.id === booking.serviceId);
      const employee = employees.find((e) => e.id === booking.employeeId);
      const assignedStaffId = employee?.id || booking.employeeId || 'unassigned';
      const assignedStaffName =
        employee ? `${employee.firstName} ${employee.lastName}`.trim() : copy.unspecified;
      const { depositPaidValue: depositAmount, closingAmount: finalAmount } = calculateBookingTotals(booking, service);

      const createdAt = toDate(booking.createdAt);
      const finalPaymentAt = toDate(booking.finalPaymentReceivedAt);
      const cancelledAt = toDate(booking.cancelledAt);

      const creatorId = booking.createdByUserId || 'unknown';
      const creatorName = booking.createdByName || booking.clientName || copy.unspecified;

      const closerId = booking.finalPaymentReceivedBy || booking.completedBy || creatorId;
      const closerName =
        booking.finalPaymentReceivedByName ||
        booking.completedByName ||
        creatorName ||
        copy.unspecified;

      const cancellationModification = [...(booking.modifications || [])]
        .reverse()
        .find((mod) => mod.action === 'cancelled' || (mod.action === 'status_changed' && mod.newValue === 'cancelled'));
      const refundStaffId = cancellationModification?.userId || closerId;
      const refundStaffName = cancellationModification?.userName || closerName || copy.unspecified;

      const depositMethod: EndOfDayMethod = booking.paymentIntentId ? 'online' : (booking.finalPaymentMethod === 'pos' ? 'pos' : 'cash');
      const finalMethod: EndOfDayMethod = booking.finalPaymentMethod === 'pos' ? 'pos' : 'cash';
      const refundMethod: EndOfDayMethod = booking.paymentIntentId ? 'online' : finalMethod;

      const hasDepositEvent =
        depositAmount > 0 &&
        (
          booking.depositPaid === true ||
          booking.paymentStatus === 'deposit_paid' ||
          booking.paymentStatus === 'refunded' ||
          Boolean(booking.paymentIntentId)
        );

      if (hasDepositEvent && createdAt) {
        rows.push({
          id: `${booking.id}-deposit`,
          bookingId: booking.id,
          dateKey: toDateKey(createdAt)!,
          timestamp: createdAt,
          displayTime: toTimeLabel(createdAt, booking.bookingTime),
          clientName: booking.clientName,
          serviceName: service?.serviceName || booking.serviceName || copy.serviceFallback,
          employeeType: employee?.employmentType,
          method: depositMethod,
          type: 'deposit',
          amount: depositAmount,
          createdByName: creatorName,
          closedByName: closerName,
          staffId: assignedStaffId,
          staffName: assignedStaffName,
        });
      }

      if (finalPaymentAt && finalAmount > 0) {
        rows.push({
          id: `${booking.id}-final`,
          bookingId: booking.id,
          dateKey: toDateKey(finalPaymentAt)!,
          timestamp: finalPaymentAt,
          displayTime: toTimeLabel(finalPaymentAt, booking.bookingTime),
          clientName: booking.clientName,
          serviceName: service?.serviceName || booking.serviceName || copy.serviceFallback,
          employeeType: employee?.employmentType,
          method: finalMethod,
          type: 'final_payment',
          amount: finalAmount,
          createdByName: creatorName,
          closedByName: closerName,
          staffId: assignedStaffId,
          staffName: assignedStaffName,
        });
      }

      if (booking.paymentStatus === 'refunded' && cancelledAt) {
        rows.push({
          id: `${booking.id}-refund`,
          bookingId: booking.id,
          dateKey: toDateKey(cancelledAt)!,
          timestamp: cancelledAt,
          displayTime: toTimeLabel(cancelledAt, booking.bookingTime),
          clientName: booking.clientName,
          serviceName: service?.serviceName || booking.serviceName || copy.serviceFallback,
          employeeType: employee?.employmentType,
          method: refundMethod,
          type: 'refund',
          amount: -Math.abs(depositAmount),
          createdByName: creatorName,
          closedByName: refundStaffName,
          staffId: assignedStaffId,
          staffName: assignedStaffName,
        });
      }
    });

    return rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [bookings, services, employees]);

  const transactionsForDay = useMemo(() => {
    return allTransactions
      .filter((tx) => tx.dateKey === selectedDate)
      .filter((tx) => (filterMethod === 'all' ? true : tx.method === filterMethod))
      .filter((tx) => (filterStaff === 'all' ? true : tx.staffId === filterStaff));
  }, [allTransactions, selectedDate, filterMethod, filterStaff]);

  const toggleTransactionExpansion = (transactionId: string) => {
    setExpandedTransactionIds((prev) =>
      prev.includes(transactionId) ? prev.filter((id) => id !== transactionId) : [...prev, transactionId]
    );
  };

  // Calculate totals
  const totals = useMemo(() => {
    let totalCash = 0;
    let totalPos = 0;
    let totalOnline = 0;
    let totalAmount = 0;
    let grossCollected = 0;
    let totalRefunds = 0;

    const byStaff: Record<string, { name: string; amount: number; count: number }> = {};
    const byMethod: Record<EndOfDayMethod, { amount: number; count: number }> = {
      cash: { amount: 0, count: 0 },
      pos: { amount: 0, count: 0 },
      online: { amount: 0, count: 0 },
    };

    transactionsForDay.forEach((tx) => {
      totalAmount += tx.amount;
      if (tx.amount >= 0) {
        grossCollected += tx.amount;
      } else {
        totalRefunds += Math.abs(tx.amount);
      }

      if (tx.method === 'cash') totalCash += tx.amount;
      if (tx.method === 'pos') totalPos += tx.amount;
      if (tx.method === 'online') totalOnline += tx.amount;

      byMethod[tx.method].amount += tx.amount;
      byMethod[tx.method].count += 1;

      if (!byStaff[tx.staffId]) {
        byStaff[tx.staffId] = {
          name: tx.staffName || copy.unspecified,
          amount: 0,
          count: 0,
        };
      }
      byStaff[tx.staffId].amount += tx.amount;
      byStaff[tx.staffId].count += 1;
    });

    const byStaffList = Object.entries(byStaff).map(([id, data]) => ({ id, ...data }));
    const totalAbsAmount = byStaffList.reduce((sum, item) => sum + Math.abs(item.amount), 0);

    return {
      totalCash,
      totalPos,
      totalOnline,
      totalAmount,
      grossCollected,
      totalRefunds,
      byStaff: byStaffList,
      byMethod,
      totalAbsAmount,
      transactionCount: transactionsForDay.length,
    };
  }, [transactionsForDay, copy.unspecified]);

  const staffMembers = useMemo(() => {
    return employees
      .map((employee) => ({
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`.trim() || copy.unspecified,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, copy.unspecified]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-800 tracking-tight">{copy.title}</h1>
          <p className="text-slate-400 text-sm font-medium mt-2">
            {copy.subtitle}
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-600 uppercase">{copy.date}</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:border-sky-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Cash */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">€</span>
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">{copy.cash}</p>
          <p className="text-3xl font-bold text-success-600 mb-2">{formatCurrency(totals.totalCash)}</p>
          <p className="text-xs text-slate-400">{totals.byMethod.cash.count} {copy.transactions}</p>
        </div>

        {/* Total POS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-sky-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect width="20" height="14" x="2" y="5" rx="2" strokeWidth={2} />
                <path d="M2 10h20" strokeWidth={2} />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">{copy.cardTerminal}</p>
          <p className="text-3xl font-bold text-sky-600 mb-2">{formatCurrency(totals.totalPos)}</p>
          <p className="text-xs text-slate-400">{totals.byMethod.pos.count} {copy.transactions}</p>
        </div>

        {/* Total Online / Stripe */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7h-5a3 3 0 000 6h2a3 3 0 010 6H8m4-14v14" />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">{copy.onlineStripe}</p>
          <p className="text-3xl font-bold text-violet-600 mb-2">{formatCurrency(totals.totalOnline)}</p>
          <p className="text-xs text-slate-400">{totals.byMethod.online.count} {copy.transactions}</p>
        </div>

        {/* Total Amount */}
        <div className="bg-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium text-white/60 mb-1">{copy.dailyTotal}</p>
          <p className="text-3xl font-bold text-white mb-2">{formatCurrency(totals.totalAmount)}</p>
          <p className="text-xs text-white/50">
            {totals.transactionCount} {copy.transactions} · {copy.refunds} {formatCurrency(totals.totalRefunds)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-600">{copy.filter}</span>
          
          {/* Payment Method Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterMethod('all')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                filterMethod === 'all'
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {copy.all}
            </button>
            <button
              onClick={() => setFilterMethod('cash')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                filterMethod === 'cash'
                  ? "bg-success-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              € {copy.cash}
            </button>
            <button
              onClick={() => setFilterMethod('pos')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                filterMethod === 'pos'
                  ? "bg-sky-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              💳 {copy.card}
            </button>
            <button
              onClick={() => setFilterMethod('online')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                filterMethod === 'online'
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              🌐 {copy.online}
            </button>
          </div>

          {/* Staff Filter */}
          <select
            value={filterStaff}
            onChange={(e) => setFilterStaff(e.target.value)}
            className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium focus:border-sky-500 outline-none cursor-pointer"
          >
            <option value="all">{copy.allStaff}</option>
            {staffMembers.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Payment Details Table */}
      <div className="bg-white border border-slate-100 rounded-[48px] overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/30">
          <h2 className="text-sm font-black text-slate-800 tracking-[0.3em] uppercase text-center">
            {copy.transactionDetail}
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 sm:px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  {copy.timeClient}
                </th>
                <th className="px-6 sm:px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  {copy.service}
                </th>
                <th className="px-6 sm:px-10 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  {copy.method}
                </th>
                <th className="px-6 sm:px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  {copy.createdClosedBy}
                </th>
                <th className="px-6 sm:px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  {copy.amount}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactionsForDay.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-10 py-12 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">
                    {copy.noTransactions}
                  </td>
                </tr>
              ) : (
                transactionsForDay.map((tx) => {
                  const transactionTypeLabel =
                    tx.type === 'deposit'
                      ? copy.deposit
                      : tx.type === 'final_payment'
                      ? copy.finalPayment
                      : copy.refund;
                  const shouldShowToggle = tx.serviceName.length > 70;
                  const isExpanded = expandedTransactionIds.includes(tx.id);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-all group">
                      <td className="px-6 sm:px-10 py-6">
                        <div className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none mb-1">
                          {tx.displayTime}
                        </div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          {tx.clientName}
                        </div>
                      </td>
                      <td className="px-6 sm:px-10 py-6">
                        <div
                          className="text-sm font-bold text-slate-700 uppercase tracking-wide break-words"
                          style={
                            shouldShowToggle && !isExpanded
                              ? {
                                  display: '-webkit-box',
                                  WebkitBoxOrient: 'vertical',
                                  WebkitLineClamp: 4,
                                  overflow: 'hidden',
                                }
                              : undefined
                          }
                        >
                          {tx.serviceName}
                        </div>
                        {shouldShowToggle && (
                          <button
                            type="button"
                            onClick={() => toggleTransactionExpansion(tx.id)}
                            className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 hover:text-violet-700 transition-colors"
                          >
                            {isExpanded ? copy.collapse : copy.expand}
                          </button>
                        )}
                        {tx.employeeType === 'self-employed' && tx.type !== 'refund' && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 rounded-md">
                            {copy.selfEmployed}
                          </span>
                        )}
                        <span
                          className={cn(
                            "inline-block mt-1 ml-2 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md",
                            tx.type === 'refund'
                              ? "bg-rose-100 text-rose-700"
                              : tx.type === 'final_payment'
                              ? "bg-sky-100 text-sky-700"
                              : "bg-emerald-100 text-emerald-700"
                          )}
                        >
                          {transactionTypeLabel}
                        </span>
                      </td>
                      <td className="px-6 sm:px-10 py-6 text-center">
                        {tx.method === 'cash' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-black uppercase tracking-wider">
                            € {copy.cash}
                          </span>
                        ) : tx.method === 'pos' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-100 text-blue-700 text-xs font-black uppercase tracking-wider">
                            💳 {copy.cardTerminal}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-100 text-violet-700 text-xs font-black uppercase tracking-wider">
                            🌐 {copy.online}
                          </span>
                        )}
                      </td>
                      <td className="px-6 sm:px-10 py-6">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{copy.createdBy}</span>
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                              {tx.createdByName || copy.unspecified}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">
                              {tx.type === 'refund' ? copy.refundedBy : copy.closedBy}
                            </span>
                            <span className="text-xs font-black text-emerald-700 uppercase tracking-wide">
                              {tx.closedByName || copy.unspecified}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 sm:px-10 py-6 text-right">
                        <p
                          className={cn(
                            "text-lg font-black tabular-nums",
                            tx.amount < 0 ? 'text-rose-700' : 'text-slate-900'
                          )}
                        >
                          {tx.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(tx.amount))}
                        </p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
