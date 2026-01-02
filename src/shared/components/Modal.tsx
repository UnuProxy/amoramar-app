'use client';

import React, { useEffect } from 'react';
import { cn } from '@/shared/lib/utils';
import { useDelayedRender } from '@/shared/hooks/useDelayedRender';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}) => {
  const transitionMs = 220;
  const shouldRender = useDelayedRender(isOpen, transitionMs);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!shouldRender) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-0"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          'fixed inset-0 bg-neutral-900/70 transition-opacity duration-200 ease-out backdrop-blur-sm',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative flex min-h-screen w-full items-center justify-center sm:block sm:pt-16">
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div
          className={cn(
            'inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] sm:my-8 sm:align-middle w-full',
            sizes[size],
            isOpen
              ? 'opacity-100 translate-y-0 sm:translate-y-0 scale-100'
              : 'opacity-0 translate-y-3 sm:translate-y-2 scale-[0.98]'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            </div>
          )}
          <div className="px-6 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
};
