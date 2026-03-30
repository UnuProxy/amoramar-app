'use client';

import { bookingLink } from '@/lib/constants';
import { useLanguage } from '@/shared/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { BrandLogo } from '@/shared/components/BrandLogo';

export function NavBar() {
  const { language } = useLanguage();
  const copy =
    language === 'es'
      ? { story: 'Historia', services: 'Servicios', gallery: 'Galería', location: 'Ubicación', book: 'Reservar' }
      : { story: 'Story', services: 'Services', gallery: 'Gallery', location: 'Location', book: 'Book' };

  return (
    <header className="sticky top-0 z-40 border-b border-[#DDD3C8]/70 bg-[#F1F2F0]/90 backdrop-blur">
      <nav className="mx-auto flex h-28 w-full max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <a href="/" className="inline-flex items-center">
          <BrandLogo
            className="h-16 w-32 sm:h-24 sm:w-56"
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
          <a
            href={bookingLink()}
            className="rounded-full bg-[#8A6F58] px-5 py-2.5 text-white transition-colors hover:bg-[#775F4C]"
          >
            {copy.book}
          </a>
        </div>

        <div className="mr-1 flex items-center gap-1.5 md:hidden">
          <LanguageSwitcher />
          <a
            href={bookingLink()}
            className="rounded-full bg-[#8A6F58] px-4 py-2 text-sm font-semibold text-white"
          >
            {copy.book}
          </a>
        </div>
      </nav>
    </header>
  );
}
