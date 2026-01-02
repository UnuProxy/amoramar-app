'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { createService, updateService, getEmployees, getEmployeeServices, createEmployeeService, deleteEmployeeService } from '@/shared/lib/firestore';
import type { Service, ServiceFormData, ServiceCategory, Employee } from '@/shared/lib/types';

interface ServiceFormProps {
  service?: Service;
}

const categories: ServiceCategory[] = [
  'nails',
  'hair',
  'balayage',
  'air-touch',
  'babylight',
  'filler-therapy',
  'brows-lashes',
  'makeup',
  'haircut',
  'styling',
  'coloring',
  'skincare',
  'massage',
  'facial',
  'other',
];

const categoryLabels: Record<ServiceCategory, string> = {
  'nails': 'Uñas',
  'hair': 'Cabello',
  'balayage': 'Balayage',
  'air-touch': 'Air Touch',
  'babylight': 'Babylight',
  'filler-therapy': 'Terapia de Relleno',
  'brows-lashes': 'Cejas y Pestañas',
  'makeup': 'Maquillaje',
  'haircut': 'Corte de Cabello',
  'styling': 'Peinado',
  'coloring': 'Coloración',
  'skincare': 'Cuidado de la Piel',
  'massage': 'Masaje',
  'facial': 'Facial',
  'other': 'Otro',
};

export const ServiceForm: React.FC<ServiceFormProps> = ({ service }) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await getEmployees();
        setEmployees(data.filter(e => e.status === 'active'));
        
        if (service) {
          const employeeServices = await getEmployeeServices(undefined, service.id);
          setSelectedEmployees(employeeServices.map(es => es.employeeId));
        }
      } catch (error) {
        console.error('Error fetching employees:', error);
      }
    };

    fetchEmployees();
  }, [service]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ServiceFormData>({
    defaultValues: service
      ? {
          serviceName: service.serviceName,
          description: service.description,
          duration: service.duration,
          price: service.price,
          category: service.category,
        }
      : undefined,
  });

  const onSubmit = async (data: ServiceFormData) => {
    setError(null);
    
    // Validate that at least one employee is selected
    if (selectedEmployees.length === 0) {
      setError('Debes asignar al menos un empleado a este servicio');
      return;
    }
    
    setIsLoading(true);

    try {
      const salonId = 'default-salon-id';

      if (service) {
        // Update service
        await updateService(service.id, {
          serviceName: data.serviceName,
          description: data.description,
          duration: data.duration,
          price: data.price,
          category: data.category,
        });

        // Update employee assignments
        const existingEmployeeServices = await getEmployeeServices(undefined, service.id);
        const existingEmployeeIds = existingEmployeeServices.map(es => es.employeeId);

        // Remove employees that are no longer selected
        for (const es of existingEmployeeServices) {
          if (!selectedEmployees.includes(es.employeeId)) {
            await deleteEmployeeService(es.id);
          }
        }

        // Add new employee assignments
        for (const employeeId of selectedEmployees) {
          if (!existingEmployeeIds.includes(employeeId)) {
            await createEmployeeService({
              employeeId,
              serviceId: service.id,
              isOffered: true,
            });
          }
        }
      } else {
        // Create new service
        const serviceId = await createService({
          salonId,
          serviceName: data.serviceName,
          description: data.description,
          duration: data.duration,
          price: data.price,
          category: data.category,
          isActive: true,
        });

        // Create employee assignments
        for (const employeeId of selectedEmployees) {
          await createEmployeeService({
            employeeId,
            serviceId,
            isOffered: true,
          });
        }
      }

      router.push('/dashboard/services');
    } catch (err: any) {
      setError(err.message || 'Error al guardar el servicio');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="p-4 text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-sm font-light">
          {error}
        </div>
      )}

      <Input
        label="Nombre del Servicio"
        {...register('serviceName', { required: 'El nombre del servicio es obligatorio' })}
        error={errors.serviceName?.message}
      />

      <div>
        <label className="block text-xs font-light tracking-wide text-primary-600 uppercase mb-2">
          Descripción
        </label>
        <textarea
          {...register('description', { required: 'La descripción es obligatoria' })}
          rows={4}
          className="w-full px-4 py-3 border border-primary-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-500 bg-white text-primary-900 font-light"
        />
        {errors.description && (
          <p className="mt-2 text-xs text-red-600 font-light">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Duración (minutos)"
          type="number"
          {...register('duration', {
            required: 'La duración es obligatoria',
            valueAsNumber: true,
            min: { value: 15, message: 'La duración mínima es de 15 minutos' },
          })}
          error={errors.duration?.message}
        />
        <Input
          label="Precio (€)"
          type="number"
          step="0.01"
          {...register('price', {
            required: 'El precio es obligatorio',
            valueAsNumber: true,
            min: { value: 0, message: 'El precio debe ser positivo' },
          })}
          error={errors.price?.message}
        />
      </div>

        <div>
          <label className="block text-xs font-light tracking-wide text-primary-600 uppercase mb-2">
            Categoría
          </label>
          <select
            {...register('category', { required: 'La categoría es obligatoria' })}
            className="w-full px-4 py-3 border border-primary-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-500 bg-white text-primary-900 font-light"
          >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {categoryLabels[cat]}
            </option>
          ))}
        </select>
        {errors.category && (
          <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-light tracking-wide text-primary-600 uppercase mb-2">
          Empleados Asignados
        </label>
        <div className="space-y-2">
          {employees.map((employee) => (
            <label key={employee.id} className="flex items-center">
              <input
                type="checkbox"
                checked={selectedEmployees.includes(employee.id)}
                onChange={() => toggleEmployee(employee.id)}
                className="rounded border-primary-300 text-accent-500 focus:ring-accent-500"
              />
              <span className="ml-2 text-sm text-primary-900 font-light">
                {employee.firstName} {employee.lastName}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" isLoading={isLoading}>
          {service ? 'Actualizar Servicio' : 'Crear Servicio'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard/services')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
};



