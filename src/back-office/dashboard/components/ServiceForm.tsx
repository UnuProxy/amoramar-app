'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { createService, updateService, getEmployees, getEmployeeServices, createEmployeeService, deleteEmployeeService, deleteService, getServices } from '@/shared/lib/firestore';
import type { Service, ServiceFormData, Employee } from '@/shared/lib/types';
import { SERVICE_CATEGORIES, formatServiceCategory, getOrderedServiceCategories } from '@/shared/lib/serviceCategories';

interface ServiceFormProps {
  service?: Service;
}


export const ServiceForm: React.FC<ServiceFormProps> = ({ service }) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(SERVICE_CATEGORIES);

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

  useEffect(() => {
    const fetchCategoryOptions = async () => {
      try {
        const servicesData = await getServices();
        const options = getOrderedServiceCategories(servicesData, { includeEmptyDefaults: true });
        if (service?.category && !options.includes(service.category)) {
          options.push(service.category);
        }
        setCategoryOptions(options);
      } catch (error) {
        console.error('Error fetching service categories:', error);
        setCategoryOptions(SERVICE_CATEGORIES);
      }
    };

    fetchCategoryOptions();
  }, [service?.category]);

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
          offersConsultation: service.offersConsultation || false,
          consultationDuration: service.consultationDuration || 20,
        }
      : {
          offersConsultation: false,
          consultationDuration: 20,
        },
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
          offersConsultation: data.offersConsultation || false,
          consultationDuration: data.consultationDuration || 20,
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
          offersConsultation: data.offersConsultation || false,
          consultationDuration: data.consultationDuration || 20,
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

  const handleDelete = async () => {
    if (!service) return;

    const confirmDelete = window.confirm(
      `Delete "${service.serviceName}"? This will remove the service and its employee assignments.`
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      const assignments = await getEmployeeServices(undefined, service.id);
      for (const assignment of assignments) {
        await deleteEmployeeService(assignment.id);
      }

      await deleteService(service.id);
      router.push('/dashboard/services');
    } catch (err: any) {
      setError(err?.message || 'Error al eliminar el servicio');
    } finally {
      setIsDeleting(false);
    }
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
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {formatServiceCategory(cat)}
            </option>
          ))}
        </select>
        {errors.category && (
          <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
        )}
      </div>

      {/* Free Consultation Options */}
      <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            {...register('offersConsultation')}
            id="offersConsultation"
            className="w-4 h-4 text-accent-600 border-primary-300 rounded focus:ring-accent-500"
          />
          <label htmlFor="offersConsultation" className="text-sm font-medium text-primary-900">
            Ofrecer Consultas Gratuitas
          </label>
        </div>
        <p className="text-xs text-primary-600 italic">
          Para servicios complejos como Balayage o Air Touch, permite a los clientes reservar consultas gratuitas de 15-30 minutos
        </p>
        <Input
          label="Duración de Consulta (minutos)"
          type="number"
          {...register('consultationDuration', {
            valueAsNumber: true,
            min: { value: 15, message: 'Mínimo 15 minutos' },
            max: { value: 30, message: 'Máximo 30 minutos' },
          })}
          placeholder="20"
          error={errors.consultationDuration?.message}
        />
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

      <div className="flex flex-wrap gap-4">
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
        {service && (
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            isLoading={isDeleting}
          >
            Eliminar Servicio
          </Button>
        )}
      </div>
    </form>
  );
};
