'use client';

import React, { useEffect, useState } from 'react';
import { Sidebar } from '@/back-office/dashboard/components/Sidebar';
import { ProtectedRoute } from '@/shared/components/ProtectedRoute';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const toggleSidebar = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  useEffect(() => {
    setIsTransitioning(true);
    const timeout = setTimeout(() => setIsTransitioning(false), 200);
    return () => clearTimeout(timeout);
  }, [pathname]);

  return (
    <ProtectedRoute allowedRoles={['owner']} enforcePasswordReset={false}>
      {/* Keep sidebar fixed/sticky by making the shell full-height and only main content scroll */}
      <div className="flex h-screen overflow-hidden bg-neutral-50">
        <Sidebar mobileMenuOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Hamburger / Close Button - Only visible on mobile */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden fixed z-[60] left-4 p-3 bg-neutral-800 border-2 border-neutral-700 rounded-xl text-white shadow-lg hover:bg-neutral-700 active:bg-neutral-600 transition-all"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <main
            className={cn(
              'flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pt-20 sm:pt-8 lg:pt-10 bg-neutral-50 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
              isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100'
            )}
          >
            <div className="transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
