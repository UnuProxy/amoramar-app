'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { getClients } from '@/shared/lib/firestore';
import { cn } from '@/shared/lib/utils';
import type { Client } from '@/shared/lib/types';

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
    name: 'Dashboard',
    href: '/client',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: 'My Bookings',
    href: '/client/bookings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: 'History',
    href: '/client/history',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    name: 'Profile',
    href: '/client/profile',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

interface ClientSidebarProps {
  mobileMenuOpen?: boolean;
  onMobileClose?: () => void;
}

export const ClientSidebar: React.FC<ClientSidebarProps> = ({ 
  mobileMenuOpen: externalMobileMenuOpen,
  onMobileClose 
}) => {
  const pathname = usePathname();
  const { user } = useAuth();
  const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  const mobileMenuOpen = externalMobileMenuOpen !== undefined ? externalMobileMenuOpen : internalMobileMenuOpen;

  useEffect(() => {
    const fetchClientData = async () => {
      if (!user || user.role !== 'client') {
        setLoading(false);
        return;
      }

      try {
        const clients = await getClients();
        const foundClient = clients.find((c) => c.userId === user.id);
        if (foundClient) {
          setClient(foundClient);
        }
      } catch (error) {
        console.error('Error fetching client data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClientData();
  }, [user]);

  const getDisplayName = () => {
    if (loading) return 'Loading...';
    if (!client) return user?.email?.split('@')[0] || 'Client';
    return `${client.firstName} ${client.lastName}`;
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
          <Link href="/client" className="block">
            <h1 className="text-xl font-bold text-neutral-900">
              Amor Amar
            </h1>
            <p className="text-xs text-neutral-500 mt-1">Client Portal</p>
          </Link>
        </div>

        {/* User Profile */}
        <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-500 flex items-center justify-center text-white text-sm font-semibold">
              {client
                ? `${client.firstName[0]}${client.lastName[0]}`.toUpperCase()
                : user?.email?.[0].toUpperCase() || 'C'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900 truncate">
                {getDisplayName()}
              </p>
              <p className="text-xs text-neutral-500">
                Client
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
