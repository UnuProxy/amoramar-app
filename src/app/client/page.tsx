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
    <div className="mx-auto max-w-[1400px] space-y-8 pb-8 sm:space-y-10 sm:pb-10 lg:space-y-12 lg:pb-12">
      {/* Header - Bold Premium */}
      <div className="flex flex-col gap-5 sm:gap-6 md:flex-row md:items-end md:justify-between md:gap-8">
        <div>
          <h1 className="text-4xl font-black uppercase leading-none tracking-tighter text-neutral-900 sm:text-5xl lg:text-6xl">
            Hola, <span className="text-rose-600">{user?.firstName || user?.email?.split('@')[0] || 'Invitado'}</span>
          </h1>
          <p className="mt-3 text-[11px] font-black uppercase tracking-[0.22em] text-neutral-400 sm:mt-4 sm:text-sm sm:tracking-[0.3em]">
            Tu Salón de Belleza en Ibiza
          </p>
        </div>
        <Link
          href="/book"
          className="flex w-full items-center justify-center gap-3 rounded-[18px] bg-neutral-900 px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all hover:bg-rose-600 sm:w-auto sm:px-10 sm:py-5 sm:text-sm sm:hover:-translate-y-1"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
          </svg>
          New Booking
        </Link>
      </div>

      {/* Quick Stats - Luxury Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        <div className="group relative flex min-h-[190px] items-center justify-center overflow-hidden rounded-[28px] border border-neutral-100 bg-white p-6 shadow-sm transition-all hover:shadow-xl sm:min-h-[220px] sm:rounded-[40px] sm:p-8">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] mb-4">Upcoming Appointments</p>
            <div className="flex items-baseline justify-center gap-3">
              <p className="whitespace-nowrap text-5xl font-black leading-none tracking-tight text-neutral-800 sm:text-6xl">{upcomingBookings.length}</p>
              <p className="text-sm font-bold text-rose-600 uppercase tracking-widest">Activas</p>
            </div>
          </div>
        </div>

        <div className="group relative flex min-h-[190px] items-center justify-center overflow-hidden rounded-[28px] bg-neutral-900 p-6 shadow-2xl transition-all duration-500 hover:bg-rose-600 sm:min-h-[220px] sm:rounded-[40px] sm:p-8">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
          <div className="relative text-center w-full px-4">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-4">Tratamientos</p>
            <div className="flex items-baseline justify-center gap-3 text-white">
              <p className="whitespace-nowrap text-5xl font-black leading-none tracking-tight sm:text-6xl">{pastBookings}</p>
              <p className="text-sm font-bold uppercase tracking-widest opacity-60">Realizados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions - Modern Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
        {[
          { name: 'Book', href: '/book', icon: 'M12 4v16m8-8H4', color: 'rose' },
          { name: 'My Bookings', href: '/client/bookings', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'neutral' },
          { name: 'Profile', href: '/client/profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: 'neutral' },
        ].map((action) => (
          <Link
            key={action.name}
            href={action.href}
            className="group flex flex-col items-center gap-4 rounded-[24px] border border-neutral-100 bg-white p-6 text-center transition-all hover:border-rose-100 hover:shadow-xl sm:rounded-[32px] sm:p-8"
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 ${
              action.color === 'rose' ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-neutral-50 text-neutral-400 group-hover:bg-neutral-900 group-hover:text-white'
            }`}>
              <svg className="h-7 w-7 sm:h-8 sm:w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-black uppercase tracking-[0.2em] text-neutral-900 sm:text-2xl sm:tracking-widest">Upcoming Appointments</h2>
          <div className="h-px flex-1 bg-neutral-100 mx-8 hidden sm:block" />
          <Link
            href="/client/bookings"
            className="text-[10px] font-black text-rose-600 uppercase tracking-[0.3em] hover:text-neutral-900 transition-colors"
          >
            View History →
          </Link>
        </div>

        {upcomingBookings.length > 0 ? (
          <div className="grid gap-6">
            {upcomingBookings.map((booking) => (
              <div
                key={booking.id}
                className="group flex flex-col justify-between gap-6 rounded-[28px] border border-neutral-100 bg-white p-5 transition-all hover:shadow-xl sm:flex-row sm:items-center sm:gap-8 sm:rounded-[40px] sm:p-8"
              >
                <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8">
                  <div className="flex h-16 w-16 flex-col items-center justify-center rounded-[22px] bg-neutral-900 text-white shadow-xl transition-colors duration-500 group-hover:bg-rose-600 sm:h-20 sm:w-20 sm:rounded-[28px]">
                    <span className="text-xs font-black uppercase tracking-widest opacity-60">{new Date(booking.bookingDate).toLocaleString('es', { month: 'short' })}</span>
                    <span className="mt-1 text-2xl font-black leading-none sm:text-3xl">{new Date(booking.bookingDate).getDate()}</span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black uppercase tracking-tighter leading-none text-neutral-900 sm:text-2xl">{booking.serviceName || 'TRATAMIENTO'}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                      <span className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                        {formatTime(booking.bookingTime)}
                      </span >
                      <span className="text-neutral-200">•</span>
                      <span>Ibiza Centro</span>
                    </div>
                  </div>
                </div>
                <div className="flex w-full items-center gap-4 sm:w-auto sm:gap-6">
                  <span className="px-6 py-3 rounded-2xl bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-[0.3em]">
                    Confirmada
                  </span>
                  <Link
                    href={`/client/bookings`}
                    className="ml-auto flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-neutral-100 text-neutral-300 transition-all hover:border-neutral-900 hover:bg-neutral-900 hover:text-white sm:ml-0 sm:h-14 sm:w-14"
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
          <div className="rounded-[32px] border-2 border-dashed border-neutral-200 bg-neutral-50 p-8 text-center sm:rounded-[48px] sm:p-14 lg:p-20">
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[24px] bg-white shadow-xl sm:h-24 sm:w-24 sm:rounded-[32px]">
              <svg className="w-10 h-10 text-neutral-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="mb-4 text-2xl font-black uppercase tracking-widest text-neutral-900">No hay citas pendientes</h3>
            <p className="mx-auto mb-8 max-w-xs text-[11px] font-bold uppercase leading-relaxed tracking-[0.24em] text-neutral-400 sm:mb-10 sm:text-xs sm:tracking-widest">
              Book your next luxury experience at Amor & Amar
            </p>
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-rose-600 px-8 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-white shadow-2xl shadow-rose-200 transition-all hover:bg-neutral-900 sm:w-auto sm:px-12 sm:py-5 sm:text-xs sm:tracking-[0.3em]"
            >
              Comenzar Ahora
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

