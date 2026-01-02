import React from 'react';

interface DashboardCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, subtitle }) => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-xl border border-white/10 ring-1 ring-black/5">
      <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,#22d3ee,transparent_40%)]" aria-hidden />
      <div className="absolute -right-10 -bottom-14 h-32 w-32 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <div className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">{title}</p>
            <p className="text-4xl font-semibold leading-tight">{value}</p>
            {subtitle && (
              <p className="text-sm text-white/70">{subtitle}</p>
            )}
          </div>
          <div className="h-12 w-12 rounded-xl border border-white/10 bg-white/10 shadow-inner flex items-center justify-center">
            <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4 4L19 6" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
