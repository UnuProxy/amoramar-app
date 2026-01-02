'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { Loading } from '@/shared/components/Loading';
import type { UserRole } from '@/shared/lib/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  redirectTo?: string;
  enforcePasswordReset?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  redirectTo = '/login',
  enforcePasswordReset = true,
}) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    if (!loading) {
      setInitialLoad(false);
      
      if (!user) {
        router.push(redirectTo);
      } else if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect based on role
        if (user.role === 'owner') {
          router.push('/dashboard');
        } else if (user.role === 'employee') {
          router.push('/employee');
        } else {
          router.push(redirectTo);
        }
      } else if (
        enforcePasswordReset &&
        allowedRoles?.includes('employee') &&
        user.role === 'employee' &&
        user.mustChangePassword &&
        pathname !== '/change-password'
      ) {
        router.push('/change-password');
      }
    }
  }, [user, loading, allowedRoles, redirectTo, router, enforcePasswordReset, pathname]);

  // Only show loading on initial load, not during navigation
  if (loading && initialLoad) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loading size="sm" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
};
