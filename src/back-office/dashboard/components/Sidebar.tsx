'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { getEmployees } from '@/shared/lib/firestore';
import { Button } from '@/shared/components/Button';
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
      className="w-full px-4 py-3 text-primary-500 font-bold text-[10px] uppercase tracking-widest hover:text-primary-900 hover:bg-primary-50 transition-all duration-200 flex items-center justify-center gap-2 group rounded-xl border border-primary-100"
    >
      <svg className="w-4 h-4 text-primary-300 group-hover:text-primary-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 11V3a1 1 0 112 0v8m-2 0H5a1 1 0 000 2h6m0-2h6a1 1 0 010 2h-6m0 0v8a1 1 0 102 0v-8" />
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

  // Use external state if provided, otherwise use internal state
  const mobileMenuOpen = externalMobileMenuOpen !== undefined ? externalMobileMenuOpen : internalMobileMenuOpen;

  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // If user is an employee, fetch their employee data
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

  // Get display name
  const getDisplayName = () => {
    if (loading) return 'Loading...';
    if (!user) return 'User';
    
    if (user.role === 'employee' && employee) {
      return `${employee.firstName} ${employee.lastName}`;
    }
    
    // For owners, use email or a default name
    return user.email?.split('@')[0] || 'Owner';
  };

  // Get display role
  const getDisplayRole = () => {
    if (!user) return 'Admin Panel';
    if (user.role === 'employee') return 'Employee';
    return 'Salon Owner';
  };

  return (
    <>

      {/* Mobile overlay - appears when sidebar is open on mobile */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 z-[45] bg-black/60 backdrop-blur-[1px] transition-opacity duration-200 ease-out',
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

      {/* Sidebar */}
      <div
        className={cn(
          'bg-white h-screen border-r border-primary-100 fixed lg:sticky lg:top-0 z-[50] flex flex-col w-64 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transform transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] lg:translate-x-0 lg:opacity-100 lg:pointer-events-auto',
          mobileMenuOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : '-translate-x-full opacity-0 pointer-events-none lg:opacity-100'
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="p-8 border-b border-primary-50">
          <Link href="/dashboard" className="block text-center">
            <h1 className="text-xl font-black text-primary-800 tracking-[0.1em] uppercase leading-none">
              Amor Amar
            </h1>
            <p className="text-[9px] font-bold text-accent-500 uppercase tracking-[0.4em] mt-2">Management</p>
          </Link>
        </div>

        {/* User Profile Summary */}
        <div className="px-6 py-6 border-b border-primary-50 bg-softcream/50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary-800 flex items-center justify-center text-white text-sm font-black shadow-md shadow-primary-900/10">
              {user && employee
                ? `${employee.firstName[0]}${employee.lastName[0]}`.toUpperCase()
                : user?.email?.[0].toUpperCase() || 'O'}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black text-primary-900 uppercase tracking-tight truncate">
                {getDisplayName()}
              </p>
              <p className="text-[9px] font-bold text-primary-400 uppercase tracking-widest mt-0.5">
                {getDisplayRole()}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-8 overflow-y-auto space-y-1">
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
                  'flex items-center gap-4 px-5 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all duration-200',
                  isActive
                    ? 'text-white bg-primary-800 shadow-lg shadow-primary-900/10'
                    : 'text-primary-600 hover:text-primary-900 hover:bg-primary-50'
                )}
              >
                <span className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive ? 'text-accent-300' : 'text-primary-300'
                )}>{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-6 border-t border-primary-50">
          <LogoutButton />
        </div>
      </div>
      </div>
    </>
  );
};
