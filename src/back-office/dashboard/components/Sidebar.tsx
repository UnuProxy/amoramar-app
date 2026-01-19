'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { getEmployees } from '@/shared/lib/firestore';
import { cn } from '@/shared/lib/utils';
import type { Employee } from '@/shared/lib/types';

const LogoutButton = () => {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full px-4 py-2.5 text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 transition-all duration-150 flex items-center justify-center gap-2 rounded-lg border border-neutral-200"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      Logout
    </button>
  );
};

const navigation = [
  {
    name: 'Overview',
    href: '/dashboard',
    icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
    ),
  },
  {
    name: 'End of Day',
    href: '/dashboard/end-of-day',
    icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
    ),
  },
  {
    name: 'Financial',
    href: '/dashboard/financial',
    icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    ),
  },
  {
    name: 'Employees',
    href: '/dashboard/employees',
    icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
    ),
  },
  {
    name: 'Admins',
    href: '/dashboard/admins/new',
    icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 0c-3.866 0-7 2.239-7 5v2h14v-2c0-2.761-3.134-5-7-5z" />
    </svg>
    ),
  },
  {
    name: 'Services',
    href: '/dashboard/services',
    icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
    ),
  },
  {
    name: 'Bookings',
    href: '/dashboard/bookings',
    icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
    ),
  },
];

interface SidebarProps {
  mobileMenuOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  mobileMenuOpen: externalMobileMenuOpen,
  onMobileClose 
}) => {
  const pathname = usePathname();
  const { user } = useAuth();
  const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  const mobileMenuOpen = externalMobileMenuOpen !== undefined ? externalMobileMenuOpen : internalMobileMenuOpen;

  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        if (user.role === 'employee') {
          const employees = await getEmployees();
          const foundEmployee = employees.find((e) => e.userId === user.id);
          if (foundEmployee) {
            setEmployee(foundEmployee);
          }
        }
      } catch (error) {
        console.error('Error fetching employee data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeData();
  }, [user]);

  const getDisplayName = () => {
    if (loading) return 'Loading...';
    if (!user) return 'User';
    
    if (user.role === 'employee' && employee) {
      return `${employee.firstName} ${employee.lastName}`;
    }
    
    return user.email?.split('@')[0] || 'Owner';
  };

  const getDisplayRole = () => {
    if (!user) return 'Admin Panel';
    if (user.role === 'employee') return 'Employee';
    return 'Salon Owner';
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 z-[45] bg-black/40 backdrop-blur-sm transition-opacity duration-200',
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => {
          if (onMobileClose) {
            onMobileClose();
          } else if (externalMobileMenuOpen === undefined) {
            setInternalMobileMenuOpen(false);
          }
        }}
        aria-hidden="true"
      />

      {/* Sidebar - Clean Booksy Style */}
      <div
        className={cn(
          'bg-white h-screen border-r border-neutral-200 fixed lg:sticky lg:top-0 z-[50] flex flex-col w-64 shadow-sm transform transition-all duration-200 lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="px-6 py-5 border-b border-neutral-100">
          <Link href="/dashboard" className="block">
            <h1 className="text-xl font-bold text-neutral-900">
              Amor Amar
            </h1>
            <p className="text-xs text-neutral-500 mt-1">Business Management</p>
          </Link>
        </div>

        {/* User Profile */}
        <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-500 flex items-center justify-center text-white text-sm font-semibold">
              {user && employee
                ? `${employee.firstName[0]}${employee.lastName[0]}`.toUpperCase()
                : user?.email?.[0].toUpperCase() || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900 truncate">
                {getDisplayName()}
              </p>
              <p className="text-xs text-neutral-500">
                {getDisplayRole()}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => {
                    if (onMobileClose) {
                      onMobileClose();
                    } else if (externalMobileMenuOpen === undefined) {
                      setInternalMobileMenuOpen(false);
                    }
                  }}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150',
                    isActive
                      ? 'text-accent-600 bg-accent-50'
                      : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50'
                  )}
                >
                  <span className={cn(
                    'flex-shrink-0',
                    isActive ? 'text-accent-600' : 'text-neutral-400'
                  )}>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-neutral-100">
          <LogoutButton />
        </div>
      </div>
    </>
  );
};
