'use client';

import { useState } from 'react';
import { bookingLink } from '@/lib/constants';
import Link from 'next/link';
import { useAuth } from '@/shared/hooks/useAuth';
import { useLanguage } from '@/shared/context/LanguageContext';
import { ClientAuthModal } from '@/shared/components/ClientAuthModal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { BrandLogo } from '@/shared/components/BrandLogo';

export function NavBar() {
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { language } = useLanguage();
  const copy =
    language === 'es'
      ? {
          story: 'Historia',
          services: 'Servicios',
          gallery: 'Galería',
          location: 'Ubicación',
          login: 'Entrar',
          myBookings: 'Mis Citas',
          book: 'Reservar',
        }
      : {
          story: 'Story',
          services: 'Services',
          gallery: 'Gallery',
          location: 'Location',
          login: 'Login',
          myBookings: 'My Bookings',
          book: 'Book',
        };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#DDD3C8]/70 bg-[#F1F2F0]/90 backdrop-blur">
        <nav className="mx-auto flex min-h-24 w-full max-w-6xl items-center justify-between px-3 py-3 xs:px-5 sm:h-28 sm:px-6 sm:py-0 lg:px-8">
          <a href="/" className="inline-flex items-center">
            <BrandLogo
              className="h-14 w-24 xs:h-16 xs:w-32 sm:h-24 sm:w-56"
              imageClassName="drop-shadow-none"
              priority
            />
          </a>

          <div className="hidden items-center gap-7 text-sm font-medium text-[#4A3D34] md:flex">
            <a href="/#story" className="transition-colors hover:text-[#8A6F58]">
              {copy.story}
            </a>
            <a href="/#services" className="transition-colors hover:text-[#8A6F58]">
              {copy.services}
            </a>
            <a href="/#gallery" className="transition-colors hover:text-[#8A6F58]">
              {copy.gallery}
            </a>
            <a href="/#location" className="transition-colors hover:text-[#8A6F58]">
              {copy.location}
            </a>
            <LanguageSwitcher />
            {user ? (
              <Link
                href="/client/bookings"
                className="rounded-full border border-[#8A6F58]/30 px-5 py-2.5 text-[#8A6F58] transition-colors hover:border-[#8A6F58] hover:bg-[#8A6F58]/5"
              >
                {copy.myBookings}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="rounded-full border border-[#8A6F58]/30 px-5 py-2.5 text-[#8A6F58] transition-colors hover:border-[#8A6F58] hover:bg-[#8A6F58]/5"
              >
                {copy.login}
              </button>
            )}
            <a
              href={bookingLink()}
              className="rounded-full bg-[#8A6F58] px-5 py-2.5 text-white transition-colors hover:bg-[#775F4C]"
            >
              {copy.book}
            </a>
          </div>

          <div className="mr-1 flex min-w-0 max-w-[calc(100vw-8rem)] flex-wrap items-center justify-end gap-1.5 md:hidden">
            <LanguageSwitcher className="shrink-0 [&_button]:px-2 [&_button]:tracking-[0.08em] xs:[&_button]:px-3 xs:[&_button]:tracking-[0.12em]" />
            {user ? (
              <Link
                href="/client/bookings"
                className="whitespace-nowrap rounded-full border border-[#8A6F58]/30 px-3 py-2 text-xs font-semibold text-[#8A6F58] xs:px-4 xs:text-sm"
              >
                {copy.myBookings}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="whitespace-nowrap rounded-full border border-[#8A6F58]/30 px-3 py-2 text-xs font-semibold text-[#8A6F58] xs:px-4 xs:text-sm"
              >
                {copy.login}
              </button>
            )}
            <a
              href={bookingLink()}
              className="whitespace-nowrap rounded-full bg-[#8A6F58] px-3 py-2 text-xs font-semibold text-white xs:px-4 xs:text-sm"
            >
              {copy.book}
            </a>
          </div>
        </nav>
      </header>

      <ClientAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
        mode="login"
      />
    </>
  );
}
