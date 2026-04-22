'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/hooks/useAuth';
import { getBookings } from '@/shared/lib/firestore';
import { Loading } from '@/shared/components/Loading';
import type { Booking, Service, Employee } from '@/shared/lib/types';
import { formatDate, formatTime, formatCurrency, cn } from '@/shared/lib/utils';

export default function ClientHistoryPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    const fetchStaticData = async () => {
      try {
        const [servicesRes, employeesRes] = await Promise.all([
          fetch('/api/services?withEmployees=true'),
          fetch('/api/employees'),
        ]);

        const servicesData = await servicesRes.json();
        const employeesData = await employeesRes.json();

        if (servicesData.success) {
          setServices(servicesData.data);
        }
        if (employeesData.success) {
          setEmployees(employeesData.data);
        }
      } catch (error) {
        console.error('Error fetching services/employees:', error);
      }
    };

    fetchStaticData();
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    
    try {
      const allBookings = await getBookings();
      const clientBookings = allBookings.filter(b => b.clientEmail === user.email);
      setBookings(clientBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const getService = (serviceId: string) => {
    return services.find(s => s.id === serviceId);
  };

  const getServiceName = (serviceId: string) => {
    return services.find(s => s.id === serviceId)?.serviceName || 'Service';
  };

  const getEmployee = (employeeId: string) => {
    return employees.find(e => e.id === employeeId);
  };

  const getEmployeeName = (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Terapeuta';
  };

  // Calculate statistics (MUST be before any conditional returns)
  const stats = useMemo(() => {
    const completed = bookings.filter(b => b.status === 'completed');
    const cancelled = bookings.filter(b => b.status === 'cancelled');
    
    const totalSpent = completed.reduce((sum, booking) => {
      const service = services.find(s => s.id === booking.serviceId);
      return sum + (service?.price || 0);
    }, 0);

    const totalMinutes = completed.reduce((sum, booking) => {
      const service = services.find(s => s.id === booking.serviceId);
      return sum + (service?.duration || 0);
    }, 0);

    // Find favorite service (most booked)
    const serviceCounts: Record<string, number> = {};
    completed.forEach(booking => {
      serviceCounts[booking.serviceId] = (serviceCounts[booking.serviceId] || 0) + 1;
    });
    const favoriteServiceId = Object.keys(serviceCounts).reduce((a, b) => 
      serviceCounts[a] > serviceCounts[b] ? a : b, Object.keys(serviceCounts)[0] || '');
    
    const favoriteServiceName = services.find(s => s.id === favoriteServiceId)?.serviceName || '';

    return {
      completedCount: completed.length,
      cancelledCount: cancelled.length,
      totalSpent,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      favoriteService: favoriteServiceName,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, services]);

  const todayStr = new Date().toISOString().split('T')[0];

  const pastBookings = bookings
    .filter(b => {
      const isPast = b.bookingDate < todayStr || b.status === 'completed' || b.status === 'cancelled';
      if (filter === 'all') return isPast;
      return isPast && b.status === filter;
    })
    .sort((a, b) => b.bookingDate.localeCompare(a.bookingDate) || b.bookingTime.localeCompare(a.bookingTime));

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 pb-8 sm:space-y-10 sm:pb-10 lg:space-y-12 lg:pb-12">
      {/* Header - Bold Premium */}
      <div className="flex flex-col gap-5 sm:gap-6 md:flex-row md:items-end md:justify-between md:gap-8">
        <div>
          <h1 className="text-4xl font-black uppercase leading-none tracking-tighter text-neutral-900 sm:text-5xl lg:text-6xl">
            History
          </h1>
          <p className="mt-3 text-[11px] font-black uppercase tracking-[0.22em] text-neutral-400 sm:mt-4 sm:text-sm sm:tracking-[0.3em]">
            Tus experiencias en Amor & Amar
          </p>
        </div>
      </div>

      {/* Stats Grid - Luxury High Impact */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        <div className="group relative overflow-hidden rounded-[28px] border border-neutral-100 bg-white p-6 shadow-sm transition-all hover:shadow-xl sm:rounded-[40px] sm:p-8 lg:p-10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] mb-4">Completed</p>
            <p className="text-5xl font-black tracking-tighter text-neutral-900 sm:text-6xl">{stats.completedCount}</p>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-2">SUCCESSFUL SESSIONS</p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-[28px] border border-neutral-100 bg-white p-6 shadow-sm transition-all hover:shadow-xl sm:rounded-[40px] sm:p-8 lg:p-10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] mb-4">Canceladas</p>
            <p className="text-5xl font-black tracking-tighter text-neutral-900 sm:text-6xl">{stats.cancelledCount}</p>
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-2">CITAS BAJA</p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-[28px] bg-neutral-900 p-6 shadow-2xl sm:rounded-[40px] sm:p-8 lg:p-10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
          <div className="relative">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-4">Tiempo Total</p>
            <p className="text-5xl font-black tracking-tighter text-white sm:text-6xl">{stats.totalHours}<span className="text-xl sm:text-2xl">H</span></p>
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mt-2">TU BIENESTAR</p>
          </div>
        </div>
      </div>

      {/* Favorite Service Card - Refined */}
      {stats.completedCount > 0 && stats.favoriteService && (
        <div className="flex flex-col items-center gap-6 rounded-[28px] border border-white/5 bg-neutral-900 p-6 shadow-2xl sm:gap-8 sm:rounded-[40px] sm:p-8 md:flex-row md:gap-10 lg:p-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-rose-600 shadow-2xl shadow-rose-900/40 sm:h-24 sm:w-24 sm:rounded-[32px]">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div className="text-center md:text-left flex-1">
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.4em] mb-2">Tratamiento Estrella</p>
            <h3 className="text-2xl font-black uppercase tracking-tighter text-white sm:text-4xl">{stats.favoriteService}</h3>
          </div>
          <Link
            href="/client/bookings"
            className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-8 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-black transition-all hover:bg-rose-600 hover:text-white sm:w-auto sm:px-10 sm:py-5 sm:text-xs sm:tracking-[0.3em]"
          >
            Book Again
          </Link>
        </div>
      )}

      {/* Filters - Modern Style */}
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar sm:gap-4">
        {[
          { id: 'all', label: `Todos (${stats.completedCount + stats.cancelledCount})` },
          { id: 'completed', label: `Completados (${stats.completedCount})` },
          { id: 'cancelled', label: `Cancelados (${stats.cancelledCount})` },
        ].map((btn) => (
          <button
            key={btn.id}
            onClick={() => setFilter(btn.id as any)}
            className={cn(
              "whitespace-nowrap rounded-2xl border-2 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all sm:px-8 sm:py-4",
              filter === btn.id 
                ? "bg-neutral-900 border-neutral-900 text-white shadow-xl" 
                : "bg-white border-neutral-100 text-neutral-400 hover:border-neutral-900 hover:text-neutral-900"
            )}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Bookings List - High End Design */}
      {pastBookings.length > 0 ? (
        <div className="grid gap-6 sm:gap-8">
          {pastBookings.map((booking) => {
            const service = getService(booking.serviceId);
            const employee = getEmployee(booking.employeeId);
            
            return (
              <div
                key={booking.id}
                className="group flex flex-col justify-between gap-6 rounded-[28px] border border-neutral-100 bg-white p-5 transition-all hover:shadow-2xl sm:gap-8 sm:rounded-[40px] sm:p-8 lg:flex-row lg:items-center lg:gap-10 lg:rounded-[48px] lg:p-10"
              >
                <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8 lg:gap-10">
                  <div className={cn(
                    "flex h-20 w-20 flex-col items-center justify-center rounded-[24px] text-white shadow-xl transition-all duration-500 group-hover:scale-105 sm:h-24 sm:w-24 sm:rounded-[32px]",
                    booking.status === 'completed' ? 'bg-neutral-900' : 'bg-amber-600'
                  )}>
                    <span className="text-xs font-black uppercase tracking-widest opacity-60">
                      {new Date(booking.bookingDate + 'T00:00:00').toLocaleString('es', { month: 'short' }).toUpperCase()}
                    </span>
                    <span className="mt-1 text-3xl font-black leading-none sm:text-4xl">
                      {new Date(booking.bookingDate + 'T00:00:00').getDate()}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em]",
                        booking.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      )}>
                        {booking.status === 'completed' ? 'Éxito' : 'Baja'}
                      </span>
                      <span className="text-[10px] font-black text-rose-600 tabular-nums uppercase tracking-widest">{formatTime(booking.bookingTime)}</span>
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter leading-none text-neutral-900 sm:text-3xl">{service?.serviceName || 'TRATAMIENTO'}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                      <span className="flex items-center gap-2">
                        {employee?.profileImage ? (
                          <img src={employee.profileImage} alt="" className="w-5 h-5 rounded-full object-cover grayscale" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                        )}
                        {employee?.firstName}
                      </span>
                      <span className="text-neutral-200">•</span>
                      <span>{service?.duration} MIN</span>
                    </div>
                  </div>
                </div>

                <div className="flex w-full items-center gap-4 sm:w-auto sm:gap-6">
                  <Link
                    href={`/client/bookings?rebook=${booking.id}`}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-rose-600 px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all hover:bg-neutral-900 sm:w-auto"
                  >
                    Book Again
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[32px] border-2 border-dashed border-neutral-200 bg-neutral-50 p-8 text-center sm:rounded-[48px] sm:p-14 lg:rounded-[64px] lg:p-24">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[24px] bg-white shadow-xl sm:mb-10 sm:h-24 sm:w-24 sm:rounded-[32px]">
            <svg className="w-12 h-12 text-neutral-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="mb-4 text-2xl font-black uppercase tracking-tighter text-neutral-900 sm:text-3xl">Aún no hay historia</h3>
          <p className="mx-auto mb-8 max-w-xs text-[11px] font-bold uppercase leading-relaxed tracking-[0.24em] text-neutral-400 sm:mb-12 sm:text-xs sm:tracking-widest">
            Tu viaje de cuidado personal en Amor & Amar comienza con tu primera reserva.
          </p>
          <Link
            href="/book"
            className="inline-flex w-full items-center justify-center rounded-[20px] bg-rose-600 px-8 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-white shadow-2xl shadow-rose-200 transition-all hover:bg-neutral-900 sm:w-auto sm:rounded-[24px] sm:px-12 sm:py-6 sm:text-xs sm:tracking-[0.3em]"
          >
            Comenzar Ahora
          </Link>
        </div>
      )}
    </div>
  );
}

