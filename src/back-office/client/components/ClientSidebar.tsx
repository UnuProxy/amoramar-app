'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { cn } from '@/shared/lib/utils';

interface ClientSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const ClientSidebar: React.FC<ClientSidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const navItems = [
    { 
      name: 'Resumen', 
      href: '/client', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    },
    { 
      name: 'Nueva Reserva', 
      href: '/book', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
    },
    { 
      name: 'Mis Reservas', 
      href: '/client/bookings', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    },
    { 
      name: 'Historial', 
      href: '/client/history', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
    },
    { 
      name: 'Mi Perfil', 
      href: '/client/profile', 
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isActive = (href: string) => {
    if (href === '/client') return pathname === href;
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[45] bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'bg-neutral-800 text-white h-screen border-r border-neutral-700/50 fixed lg:sticky lg:top-0 z-[50] flex flex-col w-72 transition-transform duration-300 shadow-2xl shadow-black/30',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 pt-14 pb-6 lg:pt-8 border-b border-white/5 bg-neutral-900/20 relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[20px] bg-neutral-700 flex items-center justify-center border border-white/10 shadow-lg">
                <span className="text-white font-black text-xl">
                  {user?.firstName?.[0] || user?.email?.[0].toUpperCase() || 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Portal Cliente</p>
                <h2 className="text-base font-bold text-white truncate uppercase tracking-tight">
                  {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email?.split('@')[0]}
                </h2>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto mt-4 px-3 space-y-1.5 no-scrollbar">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 px-5 py-3.5 text-sm font-bold tracking-widest rounded-2xl transition-all duration-200 border border-transparent uppercase',
                  isActive(item.href)
                    ? 'text-white bg-rose-600/10 border border-rose-600/20 shadow-xl'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive(item.href) ? 'text-rose-400' : 'text-neutral-500 group-hover:text-white'
                )}>
                  {item.icon}
                </span>
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>

          {/* User Profile & Logout */}
          <div className="p-6 border-t border-white/10 bg-white/5">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-4 bg-white/10 text-white border border-white/20 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-white/15 active:bg-rose-600 active:border-rose-600 transition-all duration-200 shadow-xl"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Button - Floating button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed left-4 z-[60] w-16 h-16 bg-neutral-900 text-white rounded-2xl shadow-2xl flex items-center justify-center border-2 border-white/10 active:scale-95 transition-transform"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
    </>
  );
};

export default ClientSidebar;
