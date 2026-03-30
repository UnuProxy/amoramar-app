'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { useLanguage } from '@/shared/context/LanguageContext';
import { cn } from '@/shared/lib/utils';
import {
  createEmployeeService,
  createService,
  deleteEmployeeService,
  deleteService,
  getEmployees,
  getEmployeeServices,
  getServices,
  getServiceCatalogConfig,
  updateService,
} from '@/shared/lib/firestore';
import type { Employee, Service, ServiceCatalogConfig, ServiceFormData } from '@/shared/lib/types';
import { normalizeServiceDescriptions } from '@/shared/lib/serviceLocalization';
import {
  DEFAULT_SALON_ID,
  findCatalogGroup,
  getCatalogGroupLabel,
  getCatalogSubgroupLabel,
  getNextServiceDisplayOrder,
  getDefaultServiceCatalogConfig,
  getServiceGroupId,
  getServiceSubgroupId,
} from '@/shared/lib/serviceCatalog';

interface ServiceFormProps {
  service?: Service;
}

export const ServiceForm: React.FC<ServiceFormProps> = ({ service }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [catalogConfig, setCatalogConfig] = useState<ServiceCatalogConfig>(getDefaultServiceCatalogConfig());
  const requestedGroupId = searchParams.get('group') || undefined;
  const requestedSubgroupId = searchParams.get('subgroup') || undefined;

  const copy =
    language === 'es'
      ? {
          saveError: 'Error al guardar el servicio',
          deleteError: 'Error al eliminar el servicio',
          deleteConfirm: (name: string) => `¿Eliminar "${name}"? Esto borrara el servicio y sus asignaciones.`,
          serviceName: 'Nombre del servicio',
          serviceNameRequired: 'El nombre del servicio es obligatorio',
          serviceNamePlaceholder: 'Ej. Balayage, Manicura spa, Laminacion',
          details: 'Datos basicos',
          placement: 'Grupo y subgrupo',
          mainGroup: 'Grupo principal',
          subgroup: 'Subgrupo',
          chooseGroupFirst: 'Selecciona primero un grupo principal.',
          noSubgroups: 'Este grupo no tiene subgrupos todavia. Ve a la pagina de servicios para crear uno antes de guardar.',
          subgroupRequired: 'El subgrupo es obligatorio',
          duration: 'Duracion (minutos)',
          durationRequired: 'La duracion es obligatoria',
          durationMin: 'La duracion minima es de 15 minutos',
          price: 'Precio (€)',
          priceRequired: 'El precio es obligatorio',
          priceMin: 'El precio debe ser positivo',
          moreOptions: 'Opciones extra',
          descriptionEn: 'Descripcion en ingles',
          descriptionEs: 'Descripcion en espanol',
          offerConsultation: 'Permitir consulta gratuita',
          consultationDuration: 'Duracion de la consulta (minutos)',
          consultationMin: 'Minimo 15 minutos',
          consultationMax: 'Maximo 30 minutos',
          assignedEmployees: 'Especialistas',
          assignedEmployeesHint: 'Opcional',
          noEmployeesAvailable: 'No hay especialistas activos disponibles.',
          noEmployeesSelected: 'Sin especialistas asignados todavia',
          selectedEmployees: 'especialistas seleccionados',
          createService: 'Crear servicio',
          updateService: 'Actualizar servicio',
          cancel: 'Cancelar',
          deleteService: 'Eliminar servicio',
          minutes: 'min',
        }
      : {
          saveError: 'Error saving service',
          deleteError: 'Error deleting service',
          deleteConfirm: (name: string) => `Delete "${name}"? This will remove the service and its assignments.`,
          serviceName: 'Service name',
          serviceNameRequired: 'Service name is required',
          serviceNamePlaceholder: 'Ex. Balayage, Spa manicure, Lamination',
          details: 'Basic details',
          placement: 'Group and subgroup',
          mainGroup: 'Main group',
          subgroup: 'Subgroup',
          chooseGroupFirst: 'Select a main group first.',
          noSubgroups: 'This group has no subgroups yet. Go to the services page to create one before saving.',
          subgroupRequired: 'Subgroup is required',
          duration: 'Duration (minutes)',
          durationRequired: 'Duration is required',
          durationMin: 'Minimum duration is 15 minutes',
          price: 'Price (€)',
          priceRequired: 'Price is required',
          priceMin: 'Price must be positive',
          moreOptions: 'More options',
          descriptionEn: 'English description',
          descriptionEs: 'Spanish description',
          offerConsultation: 'Allow free consultation',
          consultationDuration: 'Consultation duration (minutes)',
          consultationMin: 'Minimum 15 minutes',
          consultationMax: 'Maximum 30 minutes',
          assignedEmployees: 'Specialists',
          assignedEmployeesHint: 'Optional',
          noEmployeesAvailable: 'No active specialists available.',
          noEmployeesSelected: 'No specialists assigned yet',
          selectedEmployees: 'selected specialists',
          createService: 'Create service',
          updateService: 'Update service',
          cancel: 'Cancel',
          deleteService: 'Delete service',
          minutes: 'min',
        };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ServiceFormData>({
    defaultValues: service
      ? {
          serviceName: service.serviceName,
          descriptionEn: service.descriptionEn ?? service.description ?? '',
          descriptionEs: service.descriptionEs ?? service.description ?? '',
          duration: service.duration,
          price: service.price,
          category: service.category,
          mainGroupId: getServiceGroupId(service),
          subgroupId: getServiceSubgroupId(service),
          offersConsultation: service.offersConsultation || false,
          consultationDuration: service.consultationDuration || 20,
          employeeIds: [],
        }
      : {
          serviceName: '',
          descriptionEn: '',
          descriptionEs: '',
          duration: 60,
          price: 0,
          category: '' as ServiceFormData['category'],
          mainGroupId: '',
          subgroupId: '',
          offersConsultation: false,
          consultationDuration: 20,
          employeeIds: [],
        },
  });

  const selectedMainGroup = watch('mainGroupId');
  const selectedSubgroup = watch('subgroupId');
  const offersConsultation = watch('offersConsultation');
  const visibleSubgroups = selectedMainGroup ? findCatalogGroup(catalogConfig, selectedMainGroup)?.subgroups || [] : [];
  const activeGroup = useMemo(
    () => (selectedMainGroup ? findCatalogGroup(catalogConfig, selectedMainGroup) : undefined),
    [catalogConfig, selectedMainGroup]
  );
  const activeSubgroup = useMemo(
    () => visibleSubgroups.find((subgroup) => subgroup.id === selectedSubgroup),
    [visibleSubgroups, selectedSubgroup]
  );
  const backToServicesPath = requestedGroupId || selectedMainGroup
    ? `/dashboard/services?group=${encodeURIComponent(requestedGroupId || selectedMainGroup)}`
    : '/dashboard/services';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [employeeData, servicesData, config] = await Promise.all([
          getEmployees(),
          getServices(),
          getServiceCatalogConfig(DEFAULT_SALON_ID),
        ]);

        setEmployees(employeeData.filter((employee) => employee.status === 'active'));
        setAllServices(servicesData);
        setCatalogConfig(config);

        if (service) {
          const employeeServices = await getEmployeeServices(undefined, service.id);
          setSelectedEmployees(employeeServices.map((entry) => entry.employeeId));
        } else if (!selectedMainGroup && config.groups[0]) {
          const initialGroup =
            config.groups.find((group) => group.id === requestedGroupId) || config.groups[0];
          const initialSubgroup =
            initialGroup.subgroups.find((subgroup) => subgroup.id === requestedSubgroupId) || initialGroup.subgroups[0];
          setValue('mainGroupId', initialGroup.id);
          setValue('subgroupId', initialSubgroup?.id || '');
          setValue('category', (initialSubgroup?.id || '') as ServiceFormData['category']);
        }
      } catch (fetchError) {
        console.error('Error fetching service form data:', fetchError);
      }
    };

    fetchData();
  }, [service, setValue, requestedGroupId, requestedSubgroupId, selectedMainGroup]);

  useEffect(() => {
    if (!selectedMainGroup) return;
    const group = findCatalogGroup(catalogConfig, selectedMainGroup);
    if (!group || group.subgroups.length === 0) return;
    const subgroupExists = group.subgroups.some((subgroup) => subgroup.id === selectedSubgroup);
    const nextSubgroup = subgroupExists ? selectedSubgroup : group.subgroups[0].id;
    setValue('subgroupId', nextSubgroup);
    setValue('category', nextSubgroup as ServiceFormData['category']);
  }, [catalogConfig, selectedMainGroup, selectedSubgroup, setValue]);

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId) ? prev.filter((id) => id !== employeeId) : [...prev, employeeId]
    );
  };

  const handleMainGroupSelect = (groupId: string) => {
    setValue('mainGroupId', groupId, { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (data: ServiceFormData) => {
    setError(null);

    if (!data.subgroupId) {
      setError(copy.subgroupRequired);
      return;
    }

    setIsLoading(true);

    try {
      const descriptions = normalizeServiceDescriptions({
        description: data.description,
        descriptionEn: data.descriptionEn,
        descriptionEs: data.descriptionEs,
      });
      const placementChanged =
        !!service &&
        (getServiceGroupId(service) !== data.mainGroupId || getServiceSubgroupId(service) !== data.subgroupId);
      const nextDisplayOrder = service
        ? placementChanged
          ? getNextServiceDisplayOrder(
              allServices.filter((item) => item.id !== service.id),
              data.mainGroupId,
              data.subgroupId
            )
          : service.displayOrder
        : getNextServiceDisplayOrder(allServices, data.mainGroupId, data.subgroupId);

      const payload = {
        serviceName: data.serviceName,
        ...descriptions,
        duration: data.duration,
        price: data.price,
        category: (data.subgroupId || data.category) as ServiceFormData['category'],
        mainGroupId: data.mainGroupId,
        subgroupId: data.subgroupId,
        displayOrder: nextDisplayOrder,
        offersConsultation: data.offersConsultation || false,
        consultationDuration: data.consultationDuration || 20,
      };

      if (service) {
        await updateService(service.id, payload);

        const existingEmployeeServices = await getEmployeeServices(undefined, service.id);
        const existingEmployeeIds = existingEmployeeServices.map((entry) => entry.employeeId);

        for (const assignment of existingEmployeeServices) {
          if (!selectedEmployees.includes(assignment.employeeId)) {
            await deleteEmployeeService(assignment.id);
          }
        }

        for (const employeeId of selectedEmployees) {
          if (!existingEmployeeIds.includes(employeeId)) {
            await createEmployeeService({ employeeId, serviceId: service.id, isOffered: true });
          }
        }
      } else {
        const serviceId = await createService({
          salonId: DEFAULT_SALON_ID,
          ...payload,
          isActive: true,
        });

        for (const employeeId of selectedEmployees) {
          await createEmployeeService({ employeeId, serviceId, isOffered: true });
        }
      }

      router.push(backToServicesPath);
    } catch (submitError: any) {
      setError(submitError.message || copy.saveError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!service) return;

    const confirmDelete = window.confirm(copy.deleteConfirm(service.serviceName));
    if (!confirmDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      const assignments = await getEmployeeServices(undefined, service.id);
      for (const assignment of assignments) {
        await deleteEmployeeService(assignment.id);
      }

      await deleteService(service.id);
      router.push(backToServicesPath);
    } catch (deleteError: any) {
      setError(deleteError?.message || copy.deleteError);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <input type="hidden" {...register('mainGroupId')} />
      <input type="hidden" {...register('subgroupId', { required: copy.subgroupRequired })} />
      <input type="hidden" {...register('category')} />
      {error && <div className="p-4 text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-sm font-light">{error}</div>}

      <section className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-semibold text-slate-900">{copy.placement}</p>
          {activeGroup && (
            <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              {getCatalogGroupLabel(activeGroup, language === 'es' ? 'es' : 'en')}
            </span>
          )}
          {activeSubgroup && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {getCatalogSubgroupLabel(activeSubgroup, language === 'es' ? 'es' : 'en')}
            </span>
          )}
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">{copy.mainGroup}</label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {catalogConfig.groups.map((group) => {
              const isSelected = selectedMainGroup === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleMainGroupSelect(group.id)}
                  className={cn(
                    'rounded-2xl px-4 py-4 text-left transition-all',
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  <span className="block text-sm font-semibold">
                    {getCatalogGroupLabel(group, language === 'es' ? 'es' : 'en')}
                  </span>
                  <span className={cn("mt-1 block text-xs", isSelected ? "text-white/70" : "text-slate-500")}>
                    {group.subgroups.length} {copy.subgroup.toLowerCase()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">{copy.subgroup}</label>
            {errors.subgroupId && <p className="text-sm text-red-600">{errors.subgroupId.message}</p>}
          </div>

          {!selectedMainGroup ? (
            <div className="rounded-2xl bg-slate-100 px-4 py-5 text-sm text-slate-500">
              {copy.chooseGroupFirst}
            </div>
          ) : visibleSubgroups.length === 0 ? (
            <div className="rounded-2xl bg-amber-50 px-4 py-5 text-sm text-amber-800">
              {copy.noSubgroups}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {visibleSubgroups.map((subgroup) => {
                const isSelected = selectedSubgroup === subgroup.id;
                return (
                  <button
                    key={subgroup.id}
                    type="button"
                    onClick={() => {
                      setValue('subgroupId', subgroup.id, { shouldDirty: true, shouldValidate: true });
                      setValue('category', subgroup.id as ServiceFormData['category'], { shouldDirty: true, shouldValidate: true });
                    }}
                    className={cn(
                      'rounded-full px-4 py-2.5 text-left transition-all',
                      isSelected
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    )}
                  >
                    <span className="block text-sm font-semibold">
                      {getCatalogSubgroupLabel(subgroup, language === 'es' ? 'es' : 'en')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-slate-200 pt-8 space-y-5">
        <p className="text-lg font-semibold text-slate-900">{copy.details}</p>
        <div className="space-y-5">
          <Input
            label={copy.serviceName}
            placeholder={copy.serviceNamePlaceholder}
            {...register('serviceName', { required: copy.serviceNameRequired })}
            error={errors.serviceName?.message}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={copy.duration}
              type="number"
              {...register('duration', {
                required: copy.durationRequired,
                valueAsNumber: true,
                min: { value: 15, message: copy.durationMin },
              })}
              error={errors.duration?.message}
            />
            <Input
              label={copy.price}
              type="number"
              step="0.01"
              {...register('price', {
                required: copy.priceRequired,
                valueAsNumber: true,
                min: { value: 0, message: copy.priceMin },
              })}
              error={errors.price?.message}
            />
          </div>
        </div>
      </section>

      <details className="border-t border-slate-200 pt-8">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
          <span className="text-lg font-semibold text-slate-900">{copy.moreOptions}</span>
          <span className="text-xs text-slate-500">+</span>
        </summary>
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-light tracking-wide text-slate-600 uppercase mb-2">{copy.descriptionEn}</label>
              <textarea
                {...register('descriptionEn')}
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white text-slate-900 font-light"
              />
            </div>
            <div>
              <label className="block text-xs font-light tracking-wide text-slate-600 uppercase mb-2">{copy.descriptionEs}</label>
              <textarea
                {...register('descriptionEs')}
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white text-slate-900 font-light"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label htmlFor="offersConsultation" className="flex items-center gap-3">
              <input
                type="checkbox"
                {...register('offersConsultation')}
                id="offersConsultation"
                className="w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
              />
              <span className="text-sm font-medium text-slate-900">{copy.offerConsultation}</span>
            </label>
            {offersConsultation && (
              <Input
                label={copy.consultationDuration}
                type="number"
                {...register('consultationDuration', {
                  valueAsNumber: true,
                  min: { value: 15, message: copy.consultationMin },
                  max: { value: 30, message: copy.consultationMax },
                })}
                placeholder="20"
                error={errors.consultationDuration?.message}
              />
            )}
          </div>
        </div>
      </details>

      <section className="border-t border-slate-200 pt-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">{copy.assignedEmployees}</p>
            <p className="mt-1 text-sm text-slate-500">{copy.assignedEmployeesHint}</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {selectedEmployees.length > 0 ? `${selectedEmployees.length} ${copy.selectedEmployees}` : copy.noEmployeesSelected}
          </span>
        </div>

        {employees.length === 0 ? (
          <div className="rounded-2xl bg-slate-100 px-4 py-5 text-sm text-slate-500">
            {copy.noEmployeesAvailable}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {employees.map((employee) => {
              const isSelected = selectedEmployees.includes(employee.id);
              const initials = `${employee.firstName?.[0] || ''}${employee.lastName?.[0] || ''}`.trim() || employee.firstName?.[0] || 'E';
              return (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => toggleEmployee(employee.id)}
                  className={cn(
                    'rounded-full px-4 py-2.5 text-left transition-all',
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold',
                      isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                    )}>
                      {initials}
                    </div>
                    <p className={cn("text-sm font-medium truncate", isSelected ? "text-white" : "text-slate-700")}>
                      {employee.firstName} {employee.lastName}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-4">
        <Button type="submit" isLoading={isLoading}>
          {service ? copy.updateService : copy.createService}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(backToServicesPath)}>
          {copy.cancel}
        </Button>
        {service && (
          <Button type="button" variant="danger" onClick={handleDelete} isLoading={isDeleting}>
            {copy.deleteService}
          </Button>
        )}
      </div>
    </form>
  );
};
