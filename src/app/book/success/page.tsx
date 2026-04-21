'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BrandLogo } from '@/shared/components/BrandLogo';
import { ClientAuthModal } from '@/shared/components/ClientAuthModal';
import { useAuth } from '@/shared/hooks/useAuth';
import { useLanguage } from '@/shared/context/LanguageContext';
import { formatCurrency } from '@/shared/lib/utils';

function formatDisplayDate(dateStr: string, language: 'es' | 'en') {
  if (!dateStr) return '';

  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateStr;
  }

  return new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}

export default function BookingSuccessPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [showAuthModal, setShowAuthModal] = useState(false);

  const copy = language === 'es'
    ? {
        eyebrow: 'Pago confirmado',
        title: 'Tu reserva esta confirmada',
        subtitle: 'Hemos recibido el deposito y preparado todo para tu cita en Amor Amar.',
        service: 'Servicio',
        professional: 'Profesional',
        date: 'Fecha',
        time: 'Hora',
        deposit: 'Deposito pagado',
        remaining: 'Restante en salon',
        email: 'Email de confirmacion',
        reference: 'Referencia',
        home: 'Volver al inicio',
        bookAnother: 'Reservar otra cita',
        myBookings: 'Ver mis citas',
        createAccount: 'Crear cuenta',
        login: 'Ya tengo cuenta',
        accountHint: 'Guarda y gestiona tu reserva desde tu cuenta.',
      }
    : {
        eyebrow: 'Payment confirmed',
        title: 'Your booking is confirmed',
        subtitle: 'We have received your deposit and everything is ready for your appointment at Amor Amar.',
        service: 'Service',
        professional: 'Professional',
        date: 'Date',
        time: 'Time',
        deposit: 'Deposit paid',
        remaining: 'Remaining at salon',
        email: 'Confirmation email',
        reference: 'Reference',
        home: 'Back home',
        bookAnother: 'Book another appointment',
        myBookings: 'View my bookings',
        createAccount: 'Create account',
        login: 'I already have an account',
        accountHint: 'Save and manage this booking from your account.',
      };

  const details = useMemo(() => {
    const deposit = Number(searchParams.get('deposit') || '0');
    const remaining = Number(searchParams.get('remaining') || '0');

    return {
      bookingId: searchParams.get('bookingId') || '',
      serviceName: searchParams.get('service') || '',
      employeeName: searchParams.get('employee') || '',
      bookingDate: searchParams.get('date') || '',
      bookingTime: searchParams.get('time') || '',
      email: searchParams.get('email') || '',
      depositAmount: Number.isFinite(deposit) ? deposit : 0,
      remainingBalance: Number.isFinite(remaining) ? remaining : 0,
    };
  }, [searchParams]);

  const rows = [
    { label: copy.service, value: details.serviceName },
    { label: copy.professional, value: details.employeeName },
    { label: copy.date, value: formatDisplayDate(details.bookingDate, language) },
    { label: copy.time, value: details.bookingTime },
    { label: copy.deposit, value: details.depositAmount > 0 ? formatCurrency(details.depositAmount) : '' },
    { label: copy.remaining, value: details.remainingBalance > 0 ? formatCurrency(details.remainingBalance) : '' },
    { label: copy.email, value: details.email },
    { label: copy.reference, value: details.bookingId ? details.bookingId.slice(-8).toUpperCase() : '' },
  ].filter((row) => row.value);

  return (
    <>
      <main className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-100/70 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[32px] border border-stone-200/70 bg-white/95 p-6 shadow-xl shadow-stone-200/50 sm:rounded-[40px] sm:p-10">
            <div className="flex justify-center">
              <Link href="/" className="transition-opacity hover:opacity-80">
                <BrandLogo className="h-16 w-40 sm:h-20 sm:w-48" priority />
              </Link>
            </div>

            <div className="mt-8 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-stone-500">
                {copy.eyebrow}
              </p>
              <div className="mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 sm:h-24 sm:w-24">
                <svg className="h-10 w-10 text-emerald-600 sm:h-12 sm:w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="mt-6 text-3xl font-black uppercase tracking-tight text-stone-900 sm:text-4xl">
                {copy.title}
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-relaxed text-stone-500 sm:text-base">
                {copy.subtitle}
              </p>
            </div>

            {rows.length > 0 && (
              <div className="mt-8 rounded-[28px] bg-stone-50 p-6 sm:p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  {rows.map((row) => (
                    <div key={row.label} className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-stone-400">
                        {row.label}
                      </p>
                      <p className="mt-2 text-sm font-bold text-stone-800 sm:text-base">
                        {row.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!user && (
              <div className="mt-8 rounded-[28px] bg-stone-900 px-6 py-6 text-white sm:px-8">
                <p className="text-sm font-semibold text-white/85">
                  {copy.accountHint}
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setShowAuthModal(true);
                    }}
                    className="rounded-2xl bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-stone-800 transition hover:bg-stone-100"
                  >
                    {copy.createAccount}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setShowAuthModal(true);
                    }}
                    className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
                  >
                    {copy.login}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {user && (
                <Link
                  href="/client/bookings"
                  className="rounded-2xl bg-stone-800 px-6 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-stone-900"
                >
                  {copy.myBookings}
                </Link>
              )}
              <Link
                href="/book"
                className="rounded-2xl bg-[#8A6F58] px-6 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#775F4C]"
              >
                {copy.bookAnother}
              </Link>
              <Link
                href="/"
                className="rounded-2xl border border-stone-200 px-6 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-stone-700 transition hover:bg-stone-50"
              >
                {copy.home}
              </Link>
            </div>
          </div>
        </div>
      </main>

      <ClientAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
        mode={authMode}
      />
    </>
  );
}
