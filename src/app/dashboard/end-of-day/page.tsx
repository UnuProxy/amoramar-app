'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Loading } from '@/shared/components/Loading';
import { getBookings, getEmployees, getServices } from '@/shared/lib/firestore';
import type { Booking, Employee, Service } from '@/shared/lib/types';
import { formatCurrency, cn } from '@/shared/lib/utils';

export default function EndOfDayPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [filterMethod, setFilterMethod] = useState<'all' | 'cash' | 'pos'>('all');
  const [filterStaff, setFilterStaff] = useState<string>('all');

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

  // Filter bookings for selected date with payments
  const paymentsForDay = useMemo(() => {
    return bookings
      .filter((booking) => {
        // Must have payment registered
        const hasPayment = booking.depositPaid || booking.paymentStatus === 'paid';
        if (!hasPayment) return false;

        // Must match selected date
        if (booking.bookingDate !== selectedDate) return false;

        // Filter by payment method
        if (filterMethod !== 'all') {
          const bookingMethod = booking.finalPaymentMethod;
          if (filterMethod === 'cash' && bookingMethod !== 'cash') return false;
          if (filterMethod === 'pos' && bookingMethod !== 'pos') return false;
        }

        // Filter by staff (who closed the sale)
        if (filterStaff !== 'all') {
          const closedBy = booking.completedBy || booking.finalPaymentReceivedBy || booking.createdByUserId;
          if (closedBy !== filterStaff) return false;
        }

        return true;
      })
      .sort((a, b) => `${a.bookingTime}`.localeCompare(`${b.bookingTime}`));
  }, [bookings, selectedDate, filterMethod, filterStaff]);

  // Calculate totals
  const totals = useMemo(() => {
    let totalCash = 0;
    let totalPos = 0;
    let totalAmount = 0;

    const byStaff: Record<string, { name: string; amount: number; count: number }> = {};
    const byMethod: Record<string, { amount: number; count: number }> = {
      cash: { amount: 0, count: 0 },
      pos: { amount: 0, count: 0 },
    };

    paymentsForDay.forEach((booking) => {
      const service = services.find((s) => s.id === booking.serviceId);
      const servicePrice = service?.price || 0;
      const employee = employees.find((e) => e.id === booking.employeeId);
      
      // Calculate actual amount collected by the salon
      let amountCollected = servicePrice;
      
      // For self-employed, only count the deposit (50%)
      if (employee?.employmentType === 'self-employed') {
        amountCollected = servicePrice * 0.5;
      }

      // Add additional services
      const additionalTotal = (booking.additionalServices || []).reduce((sum, item) => sum + item.price, 0);
      amountCollected += additionalTotal;

      // Count by payment method
      const method = booking.finalPaymentMethod || 'cash';
      if (method === 'cash') {
        totalCash += amountCollected;
        byMethod.cash.amount += amountCollected;
        byMethod.cash.count += 1;
      } else if (method === 'pos') {
        totalPos += amountCollected;
        byMethod.pos.amount += amountCollected;
        byMethod.pos.count += 1;
      }

      totalAmount += amountCollected;

      // Count by staff member who CLOSED/COMPLETED the booking (not who created it)
      const staffId = booking.completedBy || booking.finalPaymentReceivedBy || booking.createdByUserId || 'unknown';
      
      // Try to get the name with fallback logic
      let staffName = booking.completedByName || booking.finalPaymentReceivedByName;
      if (!staffName && staffId !== 'unknown') {
        // Look up employee by user ID
        const emp = employees.find(e => e.userId === staffId);
        if (emp) {
          staffName = `${emp.firstName} ${emp.lastName}`.trim();
        } else {
          staffName = booking.createdByName || 'Unspecified';
        }
      }
      if (!staffName) staffName = 'Unspecified';
      
      if (!byStaff[staffId]) {
        byStaff[staffId] = {
          name: staffName,
          amount: 0,
          count: 0,
        };
      }
      byStaff[staffId].amount += amountCollected;
      byStaff[staffId].count += 1;
    });

    return {
      totalCash,
      totalPos,
      totalAmount,
      byStaff: Object.entries(byStaff).map(([id, data]) => ({ id, ...data })),
      byMethod,
      transactionCount: paymentsForDay.length,
    };
  }, [paymentsForDay, services, employees]);

  // Get unique staff members who CLOSED sales (collected final payments)
  const staffMembers = useMemo(() => {
    const uniqueStaff = new Map<string, string>();
    bookings.forEach((b) => {
      if (b.depositPaid || b.paymentStatus === 'paid') {
        const closedBy = b.completedBy || b.finalPaymentReceivedBy || b.createdByUserId;
        
        // Try to get the name with fallback logic
        let closedByName = b.completedByName || b.finalPaymentReceivedByName;
        if (!closedByName && closedBy) {
          // Look up employee by user ID
          const emp = employees.find(e => e.userId === closedBy);
          if (emp) {
            closedByName = `${emp.firstName} ${emp.lastName}`.trim();
          } else {
            closedByName = b.createdByName || 'Sin especificar';
          }
        }
        if (!closedByName) closedByName = 'Unspecified';
        
        if (closedBy) {
          uniqueStaff.set(closedBy, closedByName);
        }
      }
    });
    return Array.from(uniqueStaff).map(([id, name]) => ({ id, name }));
  }, [bookings, employees]);

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
          <h1 className="text-4xl font-bold text-primary-800 tracking-tight">
            End of Day
          </h1>
          <p className="text-primary-400 text-sm font-medium mt-2">
            Payment Control & Reconciliation
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-neutral-600 uppercase">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-medium focus:border-accent-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Cash */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">€</span>
            </div>
          </div>
          <p className="text-sm font-medium text-neutral-500 mb-1">Cash</p>
          <p className="text-3xl font-bold text-success-600 mb-2">{formatCurrency(totals.totalCash)}</p>
          <p className="text-xs text-neutral-400">{totals.byMethod.cash.count} transactions</p>
        </div>

        {/* Total POS */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-accent-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect width="20" height="14" x="2" y="5" rx="2" strokeWidth={2} />
                <path d="M2 10h20" strokeWidth={2} />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium text-neutral-500 mb-1">Card Terminal</p>
          <p className="text-3xl font-bold text-accent-600 mb-2">{formatCurrency(totals.totalPos)}</p>
          <p className="text-xs text-neutral-400">{totals.byMethod.pos.count} transactions</p>
        </div>

        {/* Total Amount */}
        <div className="bg-primary-800 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium text-white/60 mb-1">Daily Total</p>
          <p className="text-3xl font-bold text-white mb-2">{formatCurrency(totals.totalAmount)}</p>
          <p className="text-xs text-white/50">{totals.transactionCount} transactions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-neutral-600">Filter:</span>
          
          {/* Payment Method Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterMethod('all')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                filterMethod === 'all'
                  ? "bg-primary-800 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilterMethod('cash')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                filterMethod === 'cash'
                  ? "bg-success-600 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              )}
            >
              € Cash
            </button>
            <button
              onClick={() => setFilterMethod('pos')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                filterMethod === 'pos'
                  ? "bg-accent-600 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              )}
            >
              💳 Card
            </button>
          </div>

          {/* Staff Filter */}
          <select
            value={filterStaff}
            onChange={(e) => setFilterStaff(e.target.value)}
            className="px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-lg text-sm font-medium focus:border-accent-500 outline-none cursor-pointer"
          >
            <option value="all">All Staff</option>
            {staffMembers.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Revenue by Staff */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50">
          <h2 className="text-lg font-semibold text-primary-800">
            Collections by Staff
          </h2>
        </div>
        
        <div className="p-6">
          {totals.byStaff.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-sm">
              No data for this day
            </div>
          ) : (
            <div className="space-y-4">
              {totals.byStaff.sort((a, b) => b.amount - a.amount).map((staff, index) => (
                <div key={staff.id} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-800 flex items-center justify-center text-white font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-neutral-900">
                          {staff.name}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {staff.count} {staff.count === 1 ? 'payment' : 'payments'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary-800 tabular-nums">
                        {formatCurrency(staff.amount)}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {((staff.amount / totals.totalAmount) * 100).toFixed(0)}% of total
                      </p>
                    </div>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-1 overflow-hidden">
                    <div
                      className="h-full bg-rose-600 rounded-full transition-all duration-1000"
                      style={{ width: `${(staff.amount / totals.totalAmount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment Details Table */}
      <div className="bg-white border border-neutral-100 rounded-[48px] overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-neutral-100 bg-neutral-50/30">
          <h2 className="text-sm font-black text-neutral-800 tracking-[0.3em] uppercase text-center">
            Detalle de Transacciones
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50/50">
                <th className="px-6 sm:px-10 py-6 text-left text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">
                  Time / Client
                </th>
                <th className="px-6 sm:px-10 py-6 text-left text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">
                  Service
                </th>
                <th className="px-6 sm:px-10 py-6 text-center text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">
                  Método
                </th>
                <th className="px-6 sm:px-10 py-6 text-left text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">
                  Creado / Cerrado Por
                </th>
                <th className="px-6 sm:px-10 py-6 text-right text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {paymentsForDay.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-10 py-12 text-center text-neutral-300 font-bold uppercase tracking-widest text-xs">
                    Sin transacciones para este día
                  </td>
                </tr>
              ) : (
                paymentsForDay.map((booking) => {
                  const service = services.find((s) => s.id === booking.serviceId);
                  const employee = employees.find((e) => e.id === booking.employeeId);
                  const servicePrice = service?.price || 0;
                  
                  // Calculate actual amount collected
                  let amountCollected = servicePrice;
                  if (employee?.employmentType === 'self-employed') {
                    amountCollected = servicePrice * 0.5;
                  }
                  
                  const additionalTotal = (booking.additionalServices || []).reduce((sum, item) => sum + item.price, 0);
                  amountCollected += additionalTotal;

                  const method = booking.finalPaymentMethod || 'cash';

                  return (
                    <tr key={booking.id} className="hover:bg-neutral-50 transition-all group">
                      <td className="px-6 sm:px-10 py-6">
                        <div className="text-sm font-black text-neutral-800 uppercase tracking-tight leading-none mb-1">
                          {booking.bookingTime}
                        </div>
                        <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
                          {booking.clientName}
                        </div>
                      </td>
                      <td className="px-6 sm:px-10 py-6">
                        <div className="text-sm font-bold text-neutral-700 uppercase tracking-wide">
                          {service?.serviceName || 'Service'}
                        </div>
                        {employee?.employmentType === 'self-employed' && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 rounded-md">
                            50% (Autónomo)
                          </span>
                        )}
                      </td>
                      <td className="px-6 sm:px-10 py-6 text-center">
                        {method === 'cash' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-black uppercase tracking-wider">
                            € Cash
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-100 text-blue-700 text-xs font-black uppercase tracking-wider">
                            💳 Card Terminal
                          </span>
                        )}
                      </td>
                      <td className="px-6 sm:px-10 py-6">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-neutral-400 uppercase tracking-wider">Creó:</span>
                            <span className="text-xs font-bold text-neutral-600 uppercase tracking-wide">
                              {booking.createdByName || 'Sin especificar'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Cerró:</span>
                            <span className="text-xs font-black text-emerald-700 uppercase tracking-wide">
                              {(() => {
                                // Try to get the name from the booking
                                if (booking.completedByName) return booking.completedByName;
                                if (booking.finalPaymentReceivedByName) return booking.finalPaymentReceivedByName;
                                
                                // Fallback: look up by user ID
                                const closedByUserId = booking.completedBy || booking.finalPaymentReceivedBy || booking.createdByUserId;
                                if (closedByUserId) {
                                  const emp = employees.find(e => e.userId === closedByUserId);
                                  if (emp) return `${emp.firstName} ${emp.lastName}`.trim();
                                }
                                
                                // Last resort: use createdByName if it exists
                                return booking.createdByName || 'Sin especificar';
                              })()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 sm:px-10 py-6 text-right">
                        <p className="text-lg font-black text-neutral-900 tabular-nums">
                          {formatCurrency(amountCollected)}
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

