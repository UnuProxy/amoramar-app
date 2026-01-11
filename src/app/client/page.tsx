'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { getBookings } from '@/shared/lib/firestore';
import { Loading } from '@/shared/components/Loading';
import Link from 'next/link';
import type { Booking } from '@/shared/lib/types';
import { formatDate, formatTime } from '@/shared/lib/utils';

export default function ClientDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        const allBookings = await getBookings();
        // Filter bookings for this client (by email)
        const clientBookings = allBookings.filter(b => b.clientEmail === user.email);
        setBookings(clientBookings);
      } catch (error) {
        console.error('Error fetching bookings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return <Loading />;
  }

  // Get today's date string (YYYY-MM-DD) for comparison
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Show all future bookings (confirmed, pending, completed) that aren't cancelled
  const upcomingBookings = bookings
    .filter(b => b.status !== 'cancelled' && b.bookingDate >= todayStr)
    .sort((a, b) => a.bookingDate.localeCompare(b.bookingDate))
    .slice(0, 3);

  const pastBookings = bookings
    .filter(b => b.bookingDate < todayStr)
    .length;

  const totalSpent = bookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + (parseFloat(b.notes || '0') || 0), 0);

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-12">
      {/* Header - Bold Premium */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
        <div>
          <h1 className="text-6xl font-black text-neutral-900 tracking-tighter uppercase leading-none">
            Hola, <span className="text-rose-600">{user?.firstName || user?.email?.split('@')[0] || 'Invitado'}</span>
          </h1>
          <p className="text-neutral-400 text-sm font-black uppercase tracking-[0.3em] mt-4">
            Tu Salón de Belleza en Ibiza
          </p>
        </div>
        <Link
          href="/book"
          className="px-10 py-5 rounded-[20px] bg-neutral-900 text-white text-sm font-black shadow-2xl hover:bg-rose-600 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em]"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Reserva
        </Link>
      </div>

      {/* Quick Stats - Luxury Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="group relative bg-white border border-neutral-100 rounded-[40px] p-8 shadow-sm hover:shadow-xl transition-all overflow-hidden min-h-[220px] flex items-center justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] mb-4">Próximas Citas</p>
            <div className="flex items-baseline justify-center gap-3">
              <p className="text-6xl font-black text-neutral-800 tracking-tight leading-none whitespace-nowrap">{upcomingBookings.length}</p>
              <p className="text-sm font-bold text-rose-600 uppercase tracking-widest">Activas</p>
            </div>
          </div>
        </div>

        <div className="group relative bg-neutral-900 rounded-[40px] p-8 shadow-2xl hover:bg-rose-600 transition-all duration-500 overflow-hidden min-h-[220px] flex items-center justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-4">Tratamientos</p>
            <div className="flex items-baseline justify-center gap-3 text-white">
              <p className="text-6xl font-black tracking-tight leading-none whitespace-nowrap">{pastBookings}</p>
              <p className="text-sm font-bold uppercase tracking-widest opacity-60">Realizados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions - Modern Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { name: 'Reservar', href: '/book', icon: 'M12 4v16m8-8H4', color: 'rose' },
          { name: 'Mis Citas', href: '/client/bookings', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'neutral' },
          { name: 'Perfil', href: '/client/profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: 'neutral' },
        ].map((action) => (
          <Link
            key={action.name}
            href={action.href}
            className="group p-8 bg-white border border-neutral-100 rounded-[32px] hover:shadow-xl hover:border-rose-100 transition-all flex flex-col items-center text-center gap-4"
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 ${
              action.color === 'rose' ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-neutral-50 text-neutral-400 group-hover:bg-neutral-900 group-hover:text-white'
            }`}>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={action.icon} />
              </svg>
            </div>
            <span className="text-xs font-black uppercase tracking-[0.3em] text-neutral-900 group-hover:text-rose-600 transition-colors">
              {action.name}
            </span>
          </Link>
        ))}
      </div>

      {/* Upcoming Bookings - Premium List */}
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-neutral-900 tracking-widest uppercase">Próximas Citas</h2>
          <div className="h-px flex-1 bg-neutral-100 mx-8 hidden sm:block" />
          <Link
            href="/client/bookings"
            className="text-[10px] font-black text-rose-600 uppercase tracking-[0.3em] hover:text-neutral-900 transition-colors"
          >
            Ver Historial →
          </Link>
        </div>

        {upcomingBookings.length > 0 ? (
          <div className="grid gap-6">
            {upcomingBookings.map((booking) => (
              <div
                key={booking.id}
                className="group p-8 bg-white border border-neutral-100 rounded-[40px] hover:shadow-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-8"
              >
                <div className="flex items-center gap-8">
                  <div className="w-20 h-20 bg-neutral-900 rounded-[28px] flex flex-col items-center justify-center text-white shadow-xl group-hover:bg-rose-600 transition-colors duration-500">
                    <span className="text-xs font-black uppercase tracking-widest opacity-60">{new Date(booking.bookingDate).toLocaleString('es', { month: 'short' })}</span>
                    <span className="text-3xl font-black leading-none mt-1">{new Date(booking.bookingDate).getDate()}</span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-neutral-900 uppercase tracking-tighter leading-none">{booking.serviceName || 'TRATAMIENTO'}</h3>
                    <div className="flex items-center gap-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">
                      <span className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                        {formatTime(booking.bookingTime)}
                      </span >
                      <span className="text-neutral-200">•</span>
                      <span>Ibiza Centro</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span className="px-6 py-3 rounded-2xl bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-[0.3em]">
                    Confirmada
                  </span>
                  <Link
                    href={`/client/bookings`}
                    className="w-14 h-14 rounded-2xl border-2 border-neutral-100 flex items-center justify-center text-neutral-300 hover:bg-neutral-900 hover:text-white hover:border-neutral-900 transition-all"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-neutral-50 rounded-[48px] p-20 text-center border-2 border-dashed border-neutral-200">
            <div className="w-24 h-24 bg-white rounded-[32px] shadow-xl flex items-center justify-center mx-auto mb-8">
              <svg className="w-10 h-10 text-neutral-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-neutral-900 uppercase tracking-widest mb-4">No hay citas pendientes</h3>
            <p className="text-neutral-400 font-bold uppercase tracking-widest text-xs mb-10 max-w-xs mx-auto leading-relaxed">
              Reserva tu próxima experiencia de lujo en Amor & Amar
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-3 px-12 py-5 bg-rose-600 text-white text-xs font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-neutral-900 transition-all shadow-2xl shadow-rose-200"
            >
              Comenzar Ahora
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

