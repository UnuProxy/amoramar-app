'use client';

import React from 'react';

export default function ClientLoyaltyPage() {
  return (
    <div className="max-w-[1200px] mx-auto space-y-12 pb-12">
      {/* Header - Bold Premium */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
        <div>
          <h1 className="text-6xl font-black text-neutral-900 tracking-tighter uppercase leading-none">
            Fidelidad
          </h1>
          <p className="text-neutral-400 text-sm font-black uppercase tracking-[0.3em] mt-4">
            Tu Exclusividad Recompensada
          </p>
        </div>
      </div>

      {/* Points Balance - Luxury Card */}
      <div className="bg-neutral-900 rounded-[48px] p-12 shadow-2xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-rose-600/20 transition-all duration-700" />
        
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="text-center md:text-left space-y-4">
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.4em]">Balance Amor Amar</p>
            <div className="flex items-baseline gap-4 justify-center md:justify-start">
              <p className="text-9xl font-black text-white tracking-tighter leading-none">150</p>
              <p className="text-2xl font-black text-white/40 uppercase tracking-widest">Puntos</p>
            </div>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest pt-4 border-t border-white/5">Próximo Nivel: <span className="text-white">VIP GOLD (500 pts)</span></p>
          </div>
          
          <div className="w-32 h-32 bg-white/5 rounded-[40px] border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-md">
            <svg className="w-16 h-16 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Benefits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', title: 'RESERVA', desc: 'Cada visita suma valor' },
          { icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z', title: 'ACUMULA', desc: 'Puntos por cada € invertido' },
          { icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7', title: 'CANJEA', desc: 'Recompensas exclusivas' },
        ].map((item) => (
          <div key={item.title} className="bg-white border border-neutral-100 rounded-[32px] p-10 text-center hover:shadow-xl transition-all">
            <div className="w-16 h-16 bg-neutral-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-rose-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={item.icon} />
              </svg>
            </div>
            <h3 className="text-xl font-black text-neutral-900 uppercase tracking-widest mb-2">{item.title}</h3>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Rewards Catalog */}
      <div className="space-y-8">
        <h2 className="text-2xl font-black text-neutral-900 uppercase tracking-widest">Catálogo VIP</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { points: 100, benefit: 'MANICURA EXPRESS', color: 'rose' },
            { points: 250, benefit: 'TRATAMIENTO FACIAL', color: 'purple' },
            { points: 500, benefit: 'SESIÓN COMPLETA IBIZA', color: 'emerald' },
          ].map((reward) => (
            <div
              key={reward.benefit}
              className="group bg-white border border-neutral-100 rounded-[40px] p-10 text-center relative overflow-hidden transition-all hover:border-rose-600 shadow-sm"
            >
              <div className="absolute top-4 right-4 bg-neutral-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">
                {reward.points} PTS
              </div>
              <div className="w-20 h-20 bg-neutral-50 rounded-[28px] flex items-center justify-center mx-auto mb-8 group-hover:bg-rose-600 group-hover:text-white transition-all">
                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize="16" fontWeight="900">€</text>
                </svg>
              </div>
              <h3 className="text-2xl font-black text-neutral-900 uppercase tracking-tighter mb-2 leading-none">{reward.benefit}</h3>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-6 bg-neutral-50 py-3 rounded-xl group-hover:bg-rose-50 group-hover:text-rose-600 transition-colors">Próximamente Disponible</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

