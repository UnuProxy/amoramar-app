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
      className="w-full px-4 py-3 text-primary-300 font-bold text-xs uppercase tracking-widest hover:text-rosegold-400 transition-all duration-200 flex items-center justify-center gap-2 group"
    >
      <svg className="w-5 h-5 text-primary-400 group-hover:text-rosegold-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      Logout
    </button>
  );
};

const navigation = [
  { name: 'My Bookings', href: '/employee', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )},
  { name: 'Calendar', href: '/employee/calendar', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8h18M3 13h18M8 3v2m8-2v2M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )},
  { name: 'Clients', href: '/employee/clients', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )},
  { name: 'Schedule', href: '/employee/schedule', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )},
];

interface EmployeeSidebarProps {
  mobileMenuOpen?: boolean;
  onMobileClose?: () => void;
}

export const EmployeeSidebar: React.FC<EmployeeSidebarProps> = ({ 
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
        const employees = await getEmployees();
        const foundEmployee = employees.find((e) => e.userId === user.id);
        if (foundEmployee) {
          setEmployee(foundEmployee);
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
    if (loading) return 'Cargando...';
    if (!user) return 'Usuario';
    
    if (employee) {
      return `${employee.firstName} ${employee.lastName}`;
    }
    
    return user.email?.split('@')[0] || 'Empleado';
  };

  return (
    <>

      {/* Mobile overlay - appears when sidebar is open on mobile */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-[45] transition-opacity duration-300"
          onClick={() => {
            if (onMobileClose) {
              onMobileClose();
            } else if (externalMobileMenuOpen === undefined) {
              setInternalMobileMenuOpen(false);
            }
          }}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'bg-primary-800 h-screen border-r border-primary-700/50 fixed lg:sticky lg:top-0 z-[50] flex flex-col w-64 shadow-2xl',
          mobileMenuOpen ? 'flex' : 'hidden lg:flex'
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="p-8 border-b border-white/5 bg-primary-900/30">
          <Link href="/employee" className="block">
            <h1 className="text-xl font-black text-white tracking-tighter uppercase leading-none">
              Amor Amar
            </h1>
            <p className="text-[10px] font-black text-rosegold-400 uppercase tracking-[0.3em] mt-1">Employee Portal</p>
          </Link>
        </div>

        {/* User Profile Summary */}
        <div className="px-6 py-8 border-b border-white/5 bg-white/[0.01]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-neutral-700 flex items-center justify-center text-white text-lg font-black shadow-lg">
              {employee
                ? `${employee.firstName[0]}${employee.lastName[0]}`.toUpperCase()
                : user?.email?.[0].toUpperCase() || 'E'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-white uppercase tracking-tight truncate">
                {getDisplayName()}
              </p>
              <p className="text-[10px] font-bold text-luxury-400 uppercase tracking-widest mt-0.5">
                {employee?.position || 'Therapist'}
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
                  'flex items-center gap-4 px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all duration-300',
                  isActive
                    ? 'text-white bg-rosegold-500/15 shadow-sm border border-rosegold-400/30'
                    : 'text-primary-300 hover:text-white hover:bg-white/[0.05]'
                )}
              >
                <span className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive ? 'text-rosegold-400' : 'text-primary-400'
                )}>{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-6 border-t border-white/5">
          <LogoutButton />
        </div>
      </div>
    </>
  );
};


