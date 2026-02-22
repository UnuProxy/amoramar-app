import type { Metadata } from 'next';
import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { StickyBookBar } from '@/components/StickyBookBar';
import { ADDRESS, HOURS, PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Contact | Amor Amar Ibiza',
  description: 'Contact Amor Amar in Ibiza Town. Find our address, opening hours, and booking access.',
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#F6F1EA] text-[#2A2622]">
      <NavBar />
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <h1 className="font-display text-5xl sm:text-6xl">Contact</h1>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <article className="rounded-2xl border border-[#E9DED2] bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7B726B]">Address</p>
            <p className="mt-3 text-lg">{ADDRESS}</p>
          </article>
          <article className="rounded-2xl border border-[#E9DED2] bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7B726B]">Hours</p>
            <p className="mt-3 text-lg">{HOURS}</p>
          </article>
          <article className="rounded-2xl border border-[#E9DED2] bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7B726B]">Phone</p>
            <p className="mt-3 text-lg">{PHONE}</p>
          </article>
        </div>
      </section>
      <Footer />
      <StickyBookBar />
    </main>
  );
}
