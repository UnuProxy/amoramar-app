'use client';

import React from 'react';

export default function ClientFavoritesPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Favoritos</h1>
        <p className="text-neutral-600">
          Accede rápidamente a tus servicios y terapeutas favoritos
        </p>
      </div>

      {/* Coming Soon */}
      <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-2xl p-16 text-center">
        <div className="w-24 h-24 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-12 h-12 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
        <h3 className="text-2xl font-light text-neutral-900 mb-3">
          Próximamente
        </h3>
        <p className="text-neutral-600 mb-8 max-w-lg mx-auto">
          Pronto podrás guardar tus servicios y terapeutas favoritos para reservar más rápido
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-2xl mx-auto">
          <div className="flex-1 p-6 bg-white border border-amber-200 rounded-xl hover:shadow-md transition-all duration-300">
            <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-neutral-900">Servicios Favoritos</p>
            <p className="text-xs text-neutral-600 mt-2">Reserva rápida</p>
          </div>
          <div className="flex-1 p-6 bg-white border border-amber-200 rounded-xl hover:shadow-md transition-all duration-300">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-neutral-900">Terapeutas Favoritos</p>
            <p className="text-xs text-neutral-600 mt-2">Tu equipo preferido</p>
          </div>
        </div>
      </div>
    </div>
  );
}

