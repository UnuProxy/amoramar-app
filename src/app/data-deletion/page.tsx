import type { Metadata } from 'next';
import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { StickyBookBar } from '@/components/StickyBookBar';

export const metadata: Metadata = {
  title: 'Data Deletion Instructions | Amor Amar',
  description: 'Instructions to request account and personal data deletion for Amor Amar.',
};

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-[#F6F1EA] text-[#2A2622]">
      <NavBar />
      <section className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl sm:text-5xl">Data Deletion Instructions</h1>
        <p className="mt-3 text-sm text-[#7B726B]">Last updated: 24.02.2026</p>

        <div className="mt-10 space-y-8 rounded-2xl border border-[#E9DED2] bg-white p-6 sm:p-8">
          <section>
            <h2 className="text-xl font-semibold">How to request deletion</h2>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-[#4B443D]">
              <li>
                Send an email to <span className="font-semibold">unujulian@gmail.com</span> with subject:{' '}
                <span className="font-semibold">Data Deletion Request</span>.
              </li>
              <li>Include your full name and phone/email used in bookings.</li>
              <li>Specify what you want deleted: account, booking data, or all personal data.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Verification</h2>
            <p className="mt-2 text-[#4B443D]">
              For security, we may ask for additional verification before deleting data to prevent unauthorized
              requests.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Processing time</h2>
            <p className="mt-2 text-[#4B443D]">
              Verified requests are processed as quickly as possible, usually within 30 days unless legal retention
              obligations apply.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">What may be retained</h2>
            <p className="mt-2 text-[#4B443D]">
              We may retain minimal records required by law (for example accounting, fraud prevention, or dispute
              resolution obligations).
            </p>
          </section>
        </div>
      </section>
      <Footer />
      <StickyBookBar />
    </main>
  );
}
