'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { Loading } from '@/shared/components/Loading';
import ClientSidebar from '@/back-office/client/components/ClientSidebar';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'client')) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return <Loading />;
  }

  if (!user || user.role !== 'client') {
    return null;
  }

  return (
    <div className="h-screen overflow-hidden bg-neutral-50 flex">
      {/* Sidebar */}
      <ClientSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 pt-20 sm:p-6 sm:pt-20 lg:p-8 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
