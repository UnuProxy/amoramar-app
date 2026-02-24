import type { Metadata } from 'next';
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { StickyBookBar } from '@/components/StickyBookBar';
import { ADDRESS, PHONE } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Privacy Policy | Amor Amar',
  description: 'Privacy policy for Amor Amar website, booking, and WhatsApp notifications.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#F6F1EA] text-[#2A2622]">
      <NavBar />
      <section className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl sm:text-5xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-[#7B726B]">Last updated: 24.02.2026</p>

        <div className="mt-10 space-y-8 rounded-2xl border border-[#E9DED2] bg-white p-6 sm:p-8">
          <section>
            <h2 className="text-xl font-semibold">1. Who we are</h2>
            <p className="mt-2 text-[#4B443D]">
              Amor Amar Beauty Salon provides beauty services and online booking. This policy explains how we
              collect, use, and protect your personal data when you use our website, booking flow, and WhatsApp
              notifications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Data we collect</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[#4B443D]">
              <li>Identity and contact data (name, email, phone number).</li>
              <li>Booking data (service, date, time, assigned specialist, notes).</li>
              <li>Payment-related references (for example, payment intent IDs).</li>
              <li>Notification preferences, including WhatsApp opt-in status.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Why we process data</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[#4B443D]">
              <li>To create and manage bookings.</li>
              <li>To send confirmations and reminders (email and WhatsApp where enabled).</li>
              <li>To process payments and prevent fraud.</li>
              <li>To operate and improve salon services.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Sharing with third parties</h2>
            <p className="mt-2 text-[#4B443D]">
              We only share data with service providers needed to run the service, such as payment processors,
              messaging providers, hosting providers, and analytics/security tools, under contractual safeguards.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Data retention</h2>
            <p className="mt-2 text-[#4B443D]">
              We keep personal data only as long as required for booking operations, legal obligations, dispute
              handling, and security controls.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Your rights</h2>
            <p className="mt-2 text-[#4B443D]">
              You may request access, correction, deletion, restriction, portability, or objection regarding your
              personal data. You can also withdraw consent for promotional messages at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Data deletion requests</h2>
            <p className="mt-2 text-[#4B443D]">
              For account and personal data deletion instructions, visit{' '}
              <Link href="/data-deletion" className="font-semibold text-[#B08A57] hover:underline">
                /data-deletion
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Contact</h2>
            <p className="mt-2 text-[#4B443D]">
              Address: {ADDRESS}
              <br />
              Phone: {PHONE}
              <br />
              Email: unujulian@gmail.com
            </p>
          </section>
        </div>
      </section>
      <Footer />
      <StickyBookBar />
    </main>
  );
}
