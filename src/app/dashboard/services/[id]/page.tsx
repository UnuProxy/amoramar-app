'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getService } from '@/shared/lib/firestore';
import { ServiceForm } from '@/back-office/dashboard/components/ServiceForm';
import { Loading } from '@/shared/components/Loading';
import type { Service } from '@/shared/lib/types';

export default function EditServicePage() {
  const params = useParams();
  const serviceId = params.id as string;
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);

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
    return <div>Service not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Edit Service</h1>
        <p className="text-gray-600 mt-1">Update service information</p>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <ServiceForm service={service} />
      </div>
    </div>
  );
}





