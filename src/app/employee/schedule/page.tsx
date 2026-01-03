'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  getAvailability,
  getEmployees,
  createAvailability,
  updateAvailability,
  getServices,
  getEmployeeServices,
  deleteAvailability,
} from '@/shared/lib/firestore';
import { Loading } from '@/shared/components/Loading';
import { Button } from '@/shared/components/Button';
import { generateTimeSlots } from '@/shared/lib/utils';
import type { Availability, Employee, DayOfWeek, Service } from '@/shared/lib/types';

const daysOfWeek: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const dayNames: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

type GenerationMode = 'weekly' | 'custom';

export default function SchedulePage() {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  
  // Schedule generator state
  const [showGenerator, setShowGenerator] = useState(false);
  const [generationMode, setGenerationMode] = useState<GenerationMode>('weekly');
  const [generatorDays, setGeneratorDays] = useState<Record<DayOfWeek, { enabled: boolean; startTime: string; endTime: string }>>({
    monday: { enabled: true, startTime: '10:00', endTime: '18:00' },
    tuesday: { enabled: true, startTime: '10:00', endTime: '18:00' },
    wednesday: { enabled: true, startTime: '10:00', endTime: '18:00' },
    thursday: { enabled: true, startTime: '10:00', endTime: '18:00' },
    friday: { enabled: true, startTime: '10:00', endTime: '18:00' },
    saturday: { enabled: false, startTime: '10:00', endTime: '14:00' },
    sunday: { enabled: false, startTime: '10:00', endTime: '14:00' },
  });
  const [generatorDateRange, setGeneratorDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });
  const todayStr = new Date().toISOString().split('T')[0];
  
  const [daySlots, setDaySlots] = useState<
    Record<DayOfWeek, { enabled: boolean; slots: { id?: string; startTime: string; endTime: string }[] }>
  >({
    monday: { enabled: false, slots: [] },
    tuesday: { enabled: false, slots: [] },
    wednesday: { enabled: false, slots: [] },
    thursday: { enabled: false, slots: [] },
    friday: { enabled: false, slots: [] },
    saturday: { enabled: false, slots: [] },
    sunday: { enabled: false, slots: [] },
  });

  // Get selected service details
  const selectedService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId);
  }, [services, selectedServiceId]);

  // Calculate slot preview for generator
  const slotPreview = useMemo(() => {
    if (!selectedService) return null;
    
    const duration = selectedService.duration;
    const preview: Record<DayOfWeek, { count: number; slots: string[] }> = {} as any;
    let totalSlots = 0;
    
    daysOfWeek.forEach((day) => {
      const dayConfig = generatorDays[day];
      if (dayConfig.enabled && dayConfig.startTime && dayConfig.endTime) {
        const slots = generateTimeSlots(dayConfig.startTime, dayConfig.endTime, duration);
        preview[day] = { count: slots.length, slots };
        totalSlots += slots.length;
      } else {
        preview[day] = { count: 0, slots: [] };
      }
    });
    
    return { days: preview, total: totalSlots };
  }, [selectedService, generatorDays]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        const employees = await getEmployees();
        const foundEmployee = employees.find((e) => e.userId === user.id);
        
        if (foundEmployee) {
          setEmployee(foundEmployee);

          // Fetch services assigned to this employee
          const [employeeServices, allServices] = await Promise.all([
            getEmployeeServices(foundEmployee.id),
            getServices()
          ]);
          const assignedServices = allServices.filter((s) =>
            employeeServices.some((es) => es.serviceId === s.id)
          );
          setServices(assignedServices);
          const defaultServiceId = assignedServices[0]?.id;
          setSelectedServiceId(defaultServiceId);

          if (defaultServiceId) {
            await loadAvailability(foundEmployee.id, defaultServiceId);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const loadAvailability = async (employeeId: string, serviceId?: string) => {
    setLoadingAvailability(true);
    try {
      let availabilityData = await getAvailability(employeeId, serviceId);
      // Fallback: if no availability tied to this service yet, show general availability
      if (serviceId && availabilityData.length === 0) {
        availabilityData = await getAvailability(employeeId);
      }
      setAvailability(availabilityData);
      const firstWithDates = availabilityData.find((a) => a.startDate || a.endDate);
      setDateRange({
        start: firstWithDates?.startDate || '',
        end: firstWithDates?.endDate || '',
      });

      // Map availability to per-day slots
      const nextDaySlots: typeof daySlots = {
        monday: { enabled: false, slots: [] },
        tuesday: { enabled: false, slots: [] },
        wednesday: { enabled: false, slots: [] },
        thursday: { enabled: false, slots: [] },
        friday: { enabled: false, slots: [] },
        saturday: { enabled: false, slots: [] },
        sunday: { enabled: false, slots: [] },
      };

      daysOfWeek.forEach((day) => {
        const dayAvailabilities = availabilityData.filter((a) => a.dayOfWeek === day);
        const enabled = dayAvailabilities.some((a) => a.isAvailable);
        const slots = dayAvailabilities
          .filter((a) => a.isAvailable)
          .map((a) => ({
            id: a.id,
            startTime: a.startTime,
            endTime: a.endTime,
          }));
        nextDaySlots[day] = {
          enabled,
          slots,
        };
      });

      setDaySlots(nextDaySlots);
    } catch (error) {
      console.error('Error loading availability:', error);
    } finally {
      setLoadingAvailability(false);
    }
  };

  useEffect(() => {
    if (employee) {
      loadAvailability(employee.id, selectedServiceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceId]);

  const handleGenerateSchedule = async () => {
    if (!employee || !selectedServiceId || !selectedService) {
      alert('Primero selecciona un servicio.');
      return;
    }
    if (generatorDateRange.start && generatorDateRange.start < todayStr) {
      alert('La fecha "Desde" no puede estar en el pasado.');
      return;
    }
    if (generatorDateRange.end && generatorDateRange.end < todayStr) {
      alert('La fecha "Hasta" no puede estar en el pasado.');
      return;
    }

    setSaving(true);
    try {
      // First, delete existing availability for this service
      const existingAvailability = await getAvailability(employee.id, selectedServiceId);
      for (const avail of existingAvailability) {
        await deleteAvailability(avail.id);
      }

      // Create new availability based on generator settings
      for (const day of daysOfWeek) {
        const dayConfig = generatorDays[day];
        if (dayConfig.enabled && dayConfig.startTime && dayConfig.endTime) {
          await createAvailability({
            employeeId: employee.id,
            serviceId: selectedServiceId,
            dayOfWeek: day,
            startTime: dayConfig.startTime,
            endTime: dayConfig.endTime,
            isAvailable: true,
            startDate: generatorDateRange.start || undefined,
            endDate: generatorDateRange.end || undefined,
          });
        }
      }

      // Refresh availability
      await loadAvailability(employee.id, selectedServiceId);
      setShowGenerator(false);
      alert('¡Horario generado con éxito! Los slots se calcularán automáticamente según la duración del servicio.');
    } catch (error) {
      console.error('Error generating schedule:', error);
      alert('Error al generar el horario');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!employee) return;
    if (!selectedServiceId) {
      alert('Primero asigna un servicio para configurar tu disponibilidad.');
      return;
    }
    if (dateRange.start && dateRange.start < todayStr) {
      alert('La fecha "Desde" no puede estar en el pasado.');
      return;
    }
    if (dateRange.end && dateRange.end < todayStr) {
      alert('La fecha "Hasta" no puede estar en el pasado.');
      return;
    }

    setSaving(true);
    try {
      // For each day, create/update/delete availability based on slots
      for (const day of daysOfWeek) {
        const dayState = daySlots[day];
        const existing = availability.filter((a) => a.dayOfWeek === day);
        const usedIds = new Set<string>();
        const sortedSlots = [...dayState.slots].sort((a, b) => a.startTime.localeCompare(b.startTime));

        // Basic overlap validation per day
        for (let i = 0; i < sortedSlots.length - 1; i++) {
          const current = sortedSlots[i];
          const next = sortedSlots[i + 1];
          if (current.endTime > next.startTime) {
            alert(`Las franjas no pueden solaparse en ${dayNames[day]}. Ajusta los horarios.`);
            setSaving(false);
            return;
          }
        }

        if (!dayState.enabled) {
          // Disable all existing slots for that day
          for (const slot of existing) {
            await updateAvailability(slot.id, {
              isAvailable: false,
              serviceId: selectedServiceId,
              startDate: dateRange.start || undefined,
              endDate: dateRange.end || undefined,
            });
          }
          continue;
        }

        // Validate and save active slots
        for (const slot of dayState.slots) {
          const startTime = slot.startTime;
          const endTime = slot.endTime;
          if (!startTime || !endTime) {
            continue;
          }
          if (startTime >= endTime) {
            alert('La hora de inicio debe ser anterior a la hora de fin en cada franja.');
            setSaving(false);
            return;
          }

          if (slot.id) {
            usedIds.add(slot.id);
            await updateAvailability(slot.id, {
              startTime,
              endTime,
              isAvailable: true,
              serviceId: selectedServiceId,
              startDate: dateRange.start || undefined,
              endDate: dateRange.end || undefined,
            });
          } else {
            const newId = await createAvailability({
              employeeId: employee.id,
              serviceId: selectedServiceId,
              dayOfWeek: day,
              startTime,
              endTime,
              isAvailable: true,
              startDate: dateRange.start || undefined,
              endDate: dateRange.end || undefined,
            });
            usedIds.add(newId);
          }
        }

        // Remove any existing slots not present in the form
        for (const slot of existing) {
          if (!usedIds.has(slot.id)) {
            await deleteAvailability(slot.id);
          }
        }
      }

      // Refresh availability
      await loadAvailability(employee.id, selectedServiceId);
      alert('¡Horario guardado con éxito!');
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Error al guardar el horario');
    } finally {
      setSaving(false);
    }
  };

  // Calculate slots for current day config
  const getSlotsForDay = (day: DayOfWeek) => {
    if (!selectedService) return [];
    const dayState = daySlots[day];
    if (!dayState.enabled || dayState.slots.length === 0) return [];
    
    const allSlots: string[] = [];
    dayState.slots.forEach((slot) => {
      if (slot.startTime && slot.endTime) {
        const generated = generateTimeSlots(slot.startTime, slot.endTime, selectedService.duration);
        allSlots.push(...generated);
      }
    });
    return [...new Set(allSlots)].sort();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="sm" />
      </div>
    );
  }

  if (!employee) {
    return <div>Perfil de empleado no encontrado</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-light tracking-wide text-primary-900">Mi Horario</h1>
          <p className="text-primary-600 text-sm mt-2 font-light">Gestiona tu disponibilidad semanal</p>
        </div>
        <Button 
          onClick={() => setShowGenerator(true)} 
          variant="outline"
          disabled={!selectedServiceId}
        >
          ✨ Generar Horario Rápido
        </Button>
      </div>

      {/* Service Selection with Duration Info */}
      <div className="bg-white border border-primary-200 rounded-sm shadow-sm p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-primary-700 mb-2">
              Servicio
            </label>
            <select
              value={selectedServiceId || ''}
              onChange={(e) => setSelectedServiceId(e.target.value || undefined)}
              className="w-full px-4 py-3 border border-primary-300 rounded-sm bg-white text-primary-900 focus:outline-none focus:ring-1 focus:ring-accent-500"
            >
              {services.length === 0 && <option value="">No tienes servicios asignados</option>}
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.serviceName} ({service.duration} min)
                </option>
              ))}
            </select>
            
            {/* Service Duration Info */}
            {selectedService && (
              <div className="mt-3 p-3 bg-accent-50 border border-accent-200 rounded-sm">
                <div className="flex items-center gap-2">
                  <span className="text-accent-700 text-lg">⏱</span>
                  <div>
                    <p className="text-sm font-medium text-accent-800">
                      Duración: {selectedService.duration} minutos
                    </p>
                    <p className="text-xs text-accent-600">
                      Los slots se generarán automáticamente según esta duración
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-primary-700 mb-2">
                Desde (opcional)
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                min={todayStr}
                className="w-full px-3 py-2 border border-primary-300 rounded-sm bg-white text-primary-900 focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-primary-700 mb-2">
                Hasta (opcional)
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                min={dateRange.start || todayStr}
                className="w-full px-3 py-2 border border-primary-300 rounded-sm bg-white text-primary-900 focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
            </div>
          </div>
        </div>

        {loadingAvailability ? (
          <div className="flex items-center justify-center py-6">
            <Loading size="sm" />
          </div>
        ) : (
        <form id="schedule-form" className="space-y-4">
          {daysOfWeek.map((day) => {
            const dayState = daySlots[day];
            const previewSlots = getSlotsForDay(day);

            return (
              <div
                key={day}
                id={`schedule-${day}`}
                className="border border-primary-200 rounded-sm p-4 bg-primary-50"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-4 flex-1">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="isAvailable"
                        checked={dayState.enabled}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setDaySlots((prev) => ({
                            ...prev,
                            [day]: {
                              enabled,
                              slots:
                                enabled && prev[day].slots.length === 0
                                  ? [{ startTime: '09:00', endTime: '17:00' }]
                                  : enabled
                                  ? prev[day].slots
                                  : [],
                            },
                          }));
                        }}
                        className="rounded-sm border-primary-600 bg-white text-accent-500 focus:ring-accent-500 focus:ring-1"
                      />
                      <span className="ml-3 font-light text-primary-900 capitalize tracking-wide text-sm">
                        {dayNames[day] || day}
                      </span>
                    </label>
                  </div>
                  
                  {/* Slot count preview */}
                  {dayState.enabled && previewSlots.length > 0 && (
                    <div className="text-xs bg-accent-100 text-accent-700 px-2 py-1 rounded-sm">
                      {previewSlots.length} slot{previewSlots.length !== 1 ? 's' : ''} disponibles
                    </div>
                  )}
                </div>

                <div className="mt-3 space-y-3">
                  {!dayState.enabled && (
                    <p className="text-xs text-primary-600 font-light">No hay franjas activas para este día.</p>
                  )}

                  {dayState.enabled &&
                    dayState.slots.map((slot, idx) => (
                      <div key={`${slot.id || idx}`} className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) =>
                                setDaySlots((prev) => {
                                  const next = { ...prev };
                                  next[day] = { ...prev[day], slots: [...prev[day].slots] };
                                  next[day].slots[idx] = { ...slot, startTime: e.target.value };
                                  return next;
                                })
                              }
                              className="px-3 py-2 border border-primary-300 bg-white text-primary-900 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-500 text-sm font-light"
                            />
                            <span className="text-primary-600 text-xs">a</span>
                            <input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) =>
                                setDaySlots((prev) => {
                                  const next = { ...prev };
                                  next[day] = { ...prev[day], slots: [...prev[day].slots] };
                                  next[day].slots[idx] = { ...slot, endTime: e.target.value };
                                  return next;
                                })
                              }
                              className="px-3 py-2 border border-primary-300 bg-white text-primary-900 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-500 text-sm font-light"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setDaySlots((prev) => {
                                const nextSlots = prev[day].slots.filter((_, i) => i !== idx);
                                return {
                                  ...prev,
                                  [day]: {
                                    ...prev[day],
                                    slots: nextSlots,
                                    enabled: nextSlots.length > 0,
                                  },
                                };
                              })
                            }
                            className="text-red-600 text-xs underline"
                          >
                            Eliminar
                          </button>
                        </div>
                        
                        {/* Slot preview for this time window */}
                        {selectedService && slot.startTime && slot.endTime && (
                          <div className="ml-0 sm:ml-4 flex flex-wrap gap-1">
                            {generateTimeSlots(slot.startTime, slot.endTime, selectedService.duration).map((time) => (
                              <span key={time} className="text-[10px] px-1.5 py-0.5 bg-white border border-primary-200 rounded text-primary-600">
                                {time}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDaySlots((prev) => ({
                        ...prev,
                        [day]: {
                          ...prev[day],
                          enabled: true,
                          slots:
                            prev[day].slots.length > 0
                              ? [...prev[day].slots, { startTime: '09:00', endTime: '17:00' }]
                              : [{ startTime: '09:00', endTime: '17:00' }],
                        },
                      }))
                    }
                  >
                    Añadir franja
                  </Button>
                </div>
              </div>
            );
          })}
        </form>
        )}

        <div className="mt-6 flex gap-4">
          <Button onClick={handleSave} isLoading={saving}>
            Guardar Horario
          </Button>
        </div>
      </div>

      {/* Quick Schedule Generator Modal */}
      {showGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white shadow-2xl rounded-sm max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-primary-200 flex items-center justify-between bg-accent-50">
              <div>
                <h2 className="text-lg font-light text-primary-900">✨ Generador de Horario</h2>
                <p className="text-xs text-primary-600 mt-1">
                  Configura tu horario de trabajo y generaremos los slots automáticamente
                </p>
              </div>
              <button
                onClick={() => setShowGenerator(false)}
                className="text-2xl text-primary-400 hover:text-primary-600"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Service Info */}
              {selectedService && (
                <div className="p-4 bg-accent-50 border border-accent-200 rounded-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-primary-900">{selectedService.serviceName}</p>
                      <p className="text-sm text-primary-600">Duración: {selectedService.duration} minutos por cita</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-light text-accent-700">{slotPreview?.total || 0}</p>
                      <p className="text-xs text-primary-600">slots/semana</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Date Range */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-primary-700 mb-2">
                  Período de Validez (opcional)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-primary-600 mb-1">Desde</label>
                    <input
                      type="date"
                      value={generatorDateRange.start}
                      onChange={(e) => setGeneratorDateRange((prev) => ({ ...prev, start: e.target.value }))}
                      min={todayStr}
                      className="w-full px-3 py-2 border border-primary-300 rounded-sm bg-white text-primary-900 focus:outline-none focus:ring-1 focus:ring-accent-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-primary-600 mb-1">Hasta</label>
                    <input
                      type="date"
                      value={generatorDateRange.end}
                      onChange={(e) => setGeneratorDateRange((prev) => ({ ...prev, end: e.target.value }))}
                      min={generatorDateRange.start || todayStr}
                      className="w-full px-3 py-2 border border-primary-300 rounded-sm bg-white text-primary-900 focus:outline-none focus:ring-1 focus:ring-accent-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-primary-500 mt-1">
                  Deja vacío para disponibilidad indefinida
                </p>
              </div>

              {/* Days Configuration */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-primary-700">
                  Horario por Día
                </label>
                
                {daysOfWeek.map((day) => {
                  const dayConfig = generatorDays[day];
                  const dayPreview = slotPreview?.days[day];
                  
                  return (
                    <div
                      key={day}
                      className={`p-3 border rounded-sm transition-colors ${
                        dayConfig.enabled 
                          ? 'border-accent-300 bg-accent-50' 
                          : 'border-primary-200 bg-primary-50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <label className="flex items-center cursor-pointer min-w-[120px]">
                          <input
                            type="checkbox"
                            checked={dayConfig.enabled}
                            onChange={(e) =>
                              setGeneratorDays((prev) => ({
                                ...prev,
                                [day]: { ...prev[day], enabled: e.target.checked },
                              }))
                            }
                            className="rounded-sm border-primary-600 bg-white text-accent-500 focus:ring-accent-500"
                          />
                          <span className="ml-2 font-light text-primary-900 text-sm">
                            {dayNames[day]}
                          </span>
                        </label>

                        {dayConfig.enabled && (
                          <>
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="time"
                                value={dayConfig.startTime}
                                onChange={(e) =>
                                  setGeneratorDays((prev) => ({
                                    ...prev,
                                    [day]: { ...prev[day], startTime: e.target.value },
                                  }))
                                }
                                className="px-2 py-1.5 border border-primary-300 rounded-sm bg-white text-primary-900 text-sm"
                              />
                              <span className="text-primary-500 text-xs">a</span>
                              <input
                                type="time"
                                value={dayConfig.endTime}
                                onChange={(e) =>
                                  setGeneratorDays((prev) => ({
                                    ...prev,
                                    [day]: { ...prev[day], endTime: e.target.value },
                                  }))
                                }
                                className="px-2 py-1.5 border border-primary-300 rounded-sm bg-white text-primary-900 text-sm"
                              />
                            </div>
                            
                            {dayPreview && dayPreview.count > 0 && (
                              <div className="text-xs text-accent-700 bg-white px-2 py-1 rounded border border-accent-200">
                                {dayPreview.count} slots
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      
                      {/* Slot preview */}
                      {dayConfig.enabled && dayPreview && dayPreview.slots.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {dayPreview.slots.slice(0, 12).map((time) => (
                            <span key={time} className="text-[10px] px-1.5 py-0.5 bg-white border border-primary-200 rounded text-primary-600">
                              {time}
                            </span>
                          ))}
                          {dayPreview.slots.length > 12 && (
                            <span className="text-[10px] px-1.5 py-0.5 text-primary-500">
                              +{dayPreview.slots.length - 12} más
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              {slotPreview && slotPreview.total > 0 && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📅</span>
                    <div>
                      <p className="font-medium text-emerald-800">
                        {slotPreview.total} slots por semana
                      </p>
                      <p className="text-sm text-emerald-600">
                        Cada slot tiene una duración de {selectedService?.duration} minutos
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-primary-200 flex gap-3 bg-primary-50">
              <Button
                variant="outline"
                onClick={() => setShowGenerator(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleGenerateSchedule}
                isLoading={saving}
                className="flex-1"
                disabled={!slotPreview || slotPreview.total === 0}
              >
                Generar Horario
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
