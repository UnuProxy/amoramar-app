'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
    return services.find(s => s.id === serviceId)?.serviceName || 'Servicio';
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
    <div className="max-w-[1400px] mx-auto space-y-12 pb-12">
      {/* Header - Bold Premium */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
        <div>
          <h1 className="text-6xl font-black text-neutral-900 tracking-tighter uppercase leading-none">
            Historial
          </h1>
          <p className="text-neutral-400 text-sm font-black uppercase tracking-[0.3em] mt-4">
            Tus experiencias en Amor & Amar
          </p>
        </div>
      </div>

      {/* Stats Grid - Luxury High Impact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="bg-white border border-neutral-100 rounded-[40px] p-10 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] mb-4">Completadas</p>
            <p className="text-6xl font-black text-neutral-900 tracking-tighter">{stats.completedCount}</p>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-2">SESIONES ÉXITO</p>
          </div>
        </div>

        <div className="bg-white border border-neutral-100 rounded-[40px] p-10 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] mb-4">Canceladas</p>
            <p className="text-6xl font-black text-neutral-900 tracking-tighter">{stats.cancelledCount}</p>
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-2">CITAS BAJA</p>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-[40px] p-10 shadow-2xl group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
          <div className="relative">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-4">Tiempo Total</p>
            <p className="text-6xl font-black text-white tracking-tighter">{stats.totalHours}<span className="text-2xl">H</span></p>
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mt-2">TU BIENESTAR</p>
          </div>
        </div>
      </div>

      {/* Favorite Service Card - Refined */}
      {stats.completedCount > 0 && stats.favoriteService && (
        <div className="bg-neutral-900 rounded-[40px] p-10 shadow-2xl border border-white/5 flex flex-col md:flex-row items-center gap-10">
          <div className="w-24 h-24 bg-rose-600 rounded-[32px] flex items-center justify-center shadow-2xl shadow-rose-900/40">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div className="text-center md:text-left flex-1">
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.4em] mb-2">Tratamiento Estrella</p>
            <h3 className="text-4xl font-black text-white uppercase tracking-tighter">{stats.favoriteService}</h3>
          </div>
          <button className="px-10 py-5 bg-white text-black text-xs font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-rose-600 hover:text-white transition-all">
            Reservar de Nuevo
          </button>
        </div>
      )}

      {/* Filters - Modern Style */}
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
        {[
          { id: 'all', label: `Todos (${stats.completedCount + stats.cancelledCount})` },
          { id: 'completed', label: `Completados (${stats.completedCount})` },
          { id: 'cancelled', label: `Cancelados (${stats.cancelledCount})` },
        ].map((btn) => (
          <button
            key={btn.id}
            onClick={() => setFilter(btn.id as any)}
            className={cn(
              "px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap border-2",
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
        <div className="grid gap-8">
          {pastBookings.map((booking) => {
            const service = getService(booking.serviceId);
            const employee = getEmployee(booking.employeeId);
            
            return (
              <div
                key={booking.id}
                className="group p-10 bg-white border border-neutral-100 rounded-[48px] hover:shadow-2xl transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-10"
              >
                <div className="flex items-center gap-10">
                  <div className={cn(
                    "w-24 h-24 rounded-[32px] flex flex-col items-center justify-center text-white shadow-xl group-hover:scale-105 transition-all duration-500",
                    booking.status === 'completed' ? 'bg-neutral-900' : 'bg-amber-600'
                  )}>
                    <span className="text-xs font-black uppercase tracking-widest opacity-60">
                      {new Date(booking.bookingDate + 'T00:00:00').toLocaleString('es', { month: 'short' }).toUpperCase()}
                    </span>
                    <span className="text-4xl font-black leading-none mt-1">
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
                    <h3 className="text-3xl font-black text-neutral-900 uppercase tracking-tighter leading-none">{service?.serviceName || 'TRATAMIENTO'}</h3>
                    <div className="flex items-center gap-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">
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

                <div className="flex items-center gap-6">
                  <button className="px-8 py-4 rounded-2xl bg-rose-600 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-neutral-900 transition-all shadow-lg">
                    Reservar de Nuevo
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-neutral-50 rounded-[64px] p-24 text-center border-2 border-dashed border-neutral-200">
          <div className="w-24 h-24 bg-white rounded-[32px] shadow-xl flex items-center justify-center mx-auto mb-10">
            <svg className="w-12 h-12 text-neutral-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-3xl font-black text-neutral-900 uppercase tracking-tighter mb-4">Aún no hay historia</h3>
          <p className="text-neutral-400 font-bold uppercase tracking-widest text-xs mb-12 max-w-xs mx-auto leading-relaxed">
            Tu viaje de cuidado personal en Amor & Amar comienza con tu primera reserva.
          </p>
          <button className="px-12 py-6 bg-rose-600 text-white text-xs font-black uppercase tracking-[0.3em] rounded-[24px] hover:bg-neutral-900 transition-all shadow-2xl shadow-rose-200">
            Comenzar Ahora
          </button>
        </div>
      )}
    </div>
  );
}

