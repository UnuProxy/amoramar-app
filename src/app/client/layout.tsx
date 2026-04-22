'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { Loading } from '@/shared/components/Loading';
import { ClientSidebar } from '@/back-office/client/components/ClientSidebar';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sectionLabel = pathname === '/client'
    ? 'Dashboard'
    : pathname === '/client/bookings'
      ? 'My Bookings'
      : pathname === '/client/history'
        ? 'History'
        : pathname === '/client/profile'
          ? 'Profile'
          : 'Client Area';

  useEffect(() => {
    if (!loading && (!user || user.role !== 'client')) {
      router.push('/book?auth=login&redirect=%2Fclient%2Fbookings');
    }
  }, [user, loading, router]);

  if (loading) {
    return <Loading />;
  }

  if (!user || user.role !== 'client') {
    return null;
  }

  return (
    <div className="min-h-screen lg:h-screen overflow-hidden bg-neutral-50 flex">
      {/* Sidebar */}
      <ClientSidebar mobileMenuOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-4 pb-6 sm:p-6 lg:p-8">
          <div className="lg:hidden sticky top-0 z-40 mb-4 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 transition-colors hover:border-neutral-900 hover:text-neutral-900"
              aria-label="Open client menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0 flex-1 px-3 text-center">
              <p className="truncate text-[11px] font-black uppercase tracking-[0.24em] text-neutral-400">
                Client Portal
              </p>
              <p className="truncate text-sm font-black uppercase tracking-[0.16em] text-neutral-900">
                {sectionLabel}
              </p>
            </div>
            <div className="h-11 w-11 shrink-0" aria-hidden="true" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
