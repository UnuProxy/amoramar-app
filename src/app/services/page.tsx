import type { Metadata } from 'next';
import { NavBar } from '@/components/NavBar';
import { ServiceCards } from '@/components/ServiceCards';
import { Footer } from '@/components/Footer';
import { StickyBookBar } from '@/components/StickyBookBar';

export const metadata: Metadata = {
  title: 'Services | Amor Amar Ibiza',
  description: 'Explore manicure, pedicure, hair styling, and makeup services at Amor Amar in Ibiza.',
};

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-[#F6F1EA] text-[#2A2622]">
      <NavBar />
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 text-center sm:px-6 lg:px-8">
        <h1 className="font-display text-5xl sm:text-6xl">Our Services</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-[#7B726B]">
          Select your treatment and book in seconds.
        </p>
      </section>
      <ServiceCards />
      <Footer />
      <StickyBookBar />
    </main>
  );
}
