'use client';

import React from 'react';
import type { BookingModification } from '@/shared/lib/types';
import { cn } from '@/shared/lib/utils';

interface AuditTrailPanelProps {
  modifications: BookingModification[];
  className?: string;
}

const getActionIcon = (action: BookingModification['action']) => {
  switch (action) {
    case 'created':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      );
    case 'updated':
    case 'rescheduled':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case 'status_changed':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      );
    case 'payment_received':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'completed':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'cancelled':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
};

const getActionColor = (action: BookingModification['action']) => {
  switch (action) {
    case 'created':
      return 'bg-blue-50 text-blue-600 border-blue-200';
    case 'updated':
    case 'rescheduled':
      return 'bg-amber-50 text-amber-600 border-amber-200';
    case 'status_changed':
      return 'bg-purple-50 text-purple-600 border-purple-200';
    case 'payment_received':
      return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    case 'completed':
      return 'bg-green-50 text-green-600 border-green-200';
    case 'cancelled':
      return 'bg-red-50 text-red-600 border-red-200';
    default:
      return 'bg-neutral-50 text-neutral-600 border-neutral-200';
  }
};

export function AuditTrailPanel({ modifications, className }: AuditTrailPanelProps) {
  if (!modifications || modifications.length === 0) {
    return (
      <div className={cn('bg-neutral-50 rounded-2xl p-8 border border-neutral-100', className)}>
        <p className="text-sm text-neutral-400 text-center font-medium">
          No hay historial de modificaciones
        </p>
      </div>
    );
  }

  // Sort by timestamp descending (newest first)
  const sortedModifications = [...modifications].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className={cn('space-y-4', className)}>
      {sortedModifications.map((mod) => (
        <div
          key={mod.id}
          className="bg-white border border-neutral-100 rounded-2xl p-5 hover:shadow-lg transition-all group"
        >
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center border transition-all group-hover:scale-110',
              getActionColor(mod.action)
            )}>
              {getActionIcon(mod.action)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-neutral-900 leading-relaxed">
                {mod.description}
              </p>
              
              {/* Metadata */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em]">
                  {new Date(mod.timestamp).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-neutral-200">•</span>
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em]">
                  {new Date(mod.timestamp).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {mod.userRole && (
                  <>
                    <span className="text-neutral-200">•</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider",
                      mod.userRole === 'owner' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                    )}>
                      {mod.userRole === 'owner' ? 'Admin' : 'Empleado'}
                    </span>
                  </>
                )}
              </div>

              {/* Field changes (if any) */}
              {mod.oldValue && mod.newValue && (
                <div className="mt-3 pt-3 border-t border-neutral-100">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 bg-red-50 text-red-600 rounded font-mono">
                      {mod.oldValue}
                    </span>
                    <svg className="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded font-mono">
                      {mod.newValue}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
