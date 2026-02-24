import type { Metadata } from 'next';
import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { StickyBookBar } from '@/components/StickyBookBar';

export const metadata: Metadata = {
  title: 'Terms of Service | Amor Amar',
  description: 'Terms and conditions for using Amor Amar website and booking services.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#F6F1EA] text-[#2A2622]">
      <NavBar />
      <section className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl sm:text-5xl">Terms of Service</h1>
        <p className="mt-3 text-sm text-[#7B726B]">Last updated: 24.02.2026</p>

        <div className="mt-10 space-y-8 rounded-2xl border border-[#E9DED2] bg-white p-6 sm:p-8">
          <section>
            <h2 className="text-xl font-semibold">1. Scope</h2>
            <p className="mt-2 text-[#4B443D]">
              These terms govern your use of Amor Amar services, including website access, booking functionality,
              payment flow, and client notifications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Bookings</h2>
            <p className="mt-2 text-[#4B443D]">
              Bookings are subject to staff availability, service duration, and operational constraints. You are
              responsible for providing accurate contact and booking information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Payments and deposits</h2>
            <p className="mt-2 text-[#4B443D]">
              Certain services may require a deposit to confirm an appointment. Fees, accepted methods, and refund
              conditions follow salon policy shown during booking.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Cancellations and rescheduling</h2>
            <p className="mt-2 text-[#4B443D]">
              Cancellation and rescheduling windows may apply. Late cancellations or no-shows may affect refunds or
              future booking eligibility.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Notifications</h2>
            <p className="mt-2 text-[#4B443D]">
              By providing your contact details and opting in where applicable, you agree to receive operational
              notifications related to your booking (confirmation, reminders, status updates).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Liability</h2>
            <p className="mt-2 text-[#4B443D]">
              To the maximum extent allowed by law, Amor Amar is not liable for indirect damages, third-party
              platform outages, or delays outside reasonable operational control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Changes to terms</h2>
            <p className="mt-2 text-[#4B443D]">
              We may update these terms when needed. Updated terms become effective upon publication on this page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Governing law</h2>
            <p className="mt-2 text-[#4B443D]">
              These terms are governed by applicable laws in Spain, unless mandatory local rules require otherwise.
            </p>
          </section>
        </div>
      </section>
      <Footer />
      <StickyBookBar />
    </main>
  );
}
