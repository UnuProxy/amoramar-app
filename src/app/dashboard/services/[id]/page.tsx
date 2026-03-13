'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getService } from '@/shared/lib/firestore';
import { ServiceForm } from '@/back-office/dashboard/components/ServiceForm';
import { Loading } from '@/shared/components/Loading';
import { useLanguage } from '@/shared/context/LanguageContext';
import type { Service } from '@/shared/lib/types';

export default function EditServicePage() {
  const params = useParams();
  const router = useRouter();
  const { language } = useLanguage();
  const serviceId = params.id as string;
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);

  const copy =
    language === 'es'
      ? {
          notFound: 'Servicio no encontrado',
          back: 'Volver a servicios',
          title: 'Editar servicio',
          subtitle: 'Actualiza el servicio',
        }
      : {
          notFound: 'Service not found',
          back: 'Back to services',
          title: 'Edit service',
          subtitle: 'Update the service',
        };

  useEffect(() => {
    const fetchService = async () => {
      try {
        const data = await getService(serviceId);
        setService(data);
      } catch (error) {
        console.error('Error fetching service:', error);
      } finally {
        setLoading(false);
      }
    };

    if (serviceId) {
      fetchService();
    }
  }, [serviceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="sm" />
      </div>
    );
  }

  if (!service) {
    return <div>{copy.notFound}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/services')}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 mb-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {copy.back}
        </button>
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">{copy.title}</h1>
        <p className="text-gray-600 mt-1">{copy.subtitle}</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <ServiceForm service={service} />
      </div>
    </div>
  );
}





