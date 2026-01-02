'use client';

import React from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { Button } from './Button';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const { user, logout } = useAuth();
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
    <header className="bg-primary-900 border-b border-primary-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <h1 className="text-lg font-light tracking-wide text-white">
            {title || 'Amor Amar'}
          </h1>
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-xs text-primary-400 font-light hidden sm:block">
                {user.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};



