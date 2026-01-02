'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/shared/components/ProtectedRoute';
import { Header } from '@/shared/components/Header';
import { EmployeeSidebar } from '@/back-office/employee/components/EmployeeSidebar';
import { cn } from '@/shared/lib/utils';

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleSidebar = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <ProtectedRoute allowedRoles={['employee']}>
      <div className="flex h-screen overflow-hidden bg-neutral-50">
        <EmployeeSidebar mobileMenuOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Hamburger / Close Button - Only visible on mobile */}
          <button
            onClick={toggleSidebar}
            className={cn(
              'lg:hidden fixed z-[60] p-3 bg-neutral-800 border-2 border-neutral-700 rounded-xl text-white shadow-lg hover:bg-neutral-700 active:bg-neutral-600 transition-all',
              mobileMenuOpen ? 'top-4 left-64' : 'top-4 left-4'
            )}
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pt-20 sm:pt-6 lg:pt-8 bg-neutral-50">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}



