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
    <header className="sticky top-0 z-40 border-b border-[#E9DED2]/70 bg-[#F6F1EA]/90 backdrop-blur">
      <nav className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="/" className="inline-flex items-center">
          <BrandLogo
            className="h-11 sm:h-12"
            imageClassName="drop-shadow-none"
            priority
          />
        </a>

        <div className="hidden items-center gap-7 text-sm font-medium text-[#2A2622] md:flex">
          <a href="/#story" className="transition-colors hover:text-[#B08A57]">
            {copy.story}
          </a>
          <a href="/#services" className="transition-colors hover:text-[#B08A57]">
            {copy.services}
          </a>
          <a href="/#gallery" className="transition-colors hover:text-[#B08A57]">
            {copy.gallery}
          </a>
          <a href="/#location" className="transition-colors hover:text-[#B08A57]">
            {copy.location}
          </a>
          <LanguageSwitcher />
          <a
            href={bookingLink()}
            className="rounded-full bg-[#B08A57] px-5 py-2.5 text-white transition-colors hover:bg-[#9D794C]"
          >
            {copy.book}
          </a>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <LanguageSwitcher />
          <a
            href={bookingLink()}
            className="rounded-full bg-[#B08A57] px-4 py-2 text-sm font-semibold text-white"
          >
            {copy.book}
          </a>
        </div>
      </nav>
    </header>
  );
}
