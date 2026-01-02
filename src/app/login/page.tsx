'use client';

import React from 'react';
import { LoginForm } from '@/shared/components/LoginForm';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-950 text-white">
      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-96 w-96 rounded-full bg-rose-600/10 blur-[120px]" />
        <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-rose-900/10 blur-[120px]" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-[48px] border border-white/5 bg-white/[0.02] backdrop-blur-3xl p-12 shadow-2xl">
          <div className="mb-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400">Acceso VIP</p>
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">AMOR <span className="text-rose-600">&</span> AMAR</h2>
            <p className="text-neutral-500 font-bold uppercase tracking-widest text-[10px]">
              Panel de Gestión Exclusivo para el Equipo
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
