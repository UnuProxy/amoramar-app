'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  createAvailability,
  deleteAvailability,
  getAvailability,
} from '@/shared/lib/firestore';
import { Button } from '@/shared/components/Button';
import { Loading } from '@/shared/components/Loading';
import { generateTimeSlots } from '@/shared/lib/utils';
import type { Availability, DayOfWeek } from '@/shared/lib/types';
import { useLanguage } from '@/shared/context/LanguageContext';

const daysOfWeek: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const dayNames: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

type Props = {
  employeeId: string;
  employeeName?: string;
};

export function EmployeeScheduleManager({ employeeId, employeeName }: Props) {
  const { language } = useLanguage();
  const SLOT_PREVIEW_DURATION = 30;
  const todayStr = new Date().toISOString().split('T')[0];
  const [availability, setAvailability] = useState<Availability[]>([]);
  const copy =
    language === 'es'
      ? {
          days: {
            monday: 'Lunes',
            tuesday: 'Martes',
            wednesday: 'Miercoles',
            thursday: 'Jueves',
            friday: 'Viernes',
            saturday: 'Sabado',
            sunday: 'Domingo',
          } as Record<DayOfWeek, string>,
          startPast: 'La fecha de inicio no puede estar en el pasado.',
          endPast: 'La fecha de fin no puede estar en el pasado.',
          invalidRange: 'Rango horario invalido en',
          scheduleGenerated: 'Horario generado correctamente.',
          errorGenerating: 'Error al generar el horario.',
          overlap: 'Los rangos no pueden solaparse en',
          scheduleSaved: 'Horario guardado correctamente.',
          errorSaving: 'Error al guardar el horario.',
          title: 'Disponibilidad Laboral',
          manageFor: 'Gestionar horario de',
          manageDefault: 'Gestionar horario del empleado',
          quickGenerate: 'Generar Horario Rapido',
          employeeWide: 'Disponibilidad general del empleado',
          appliesAll: 'Este horario se aplica a todos los servicios asignados.',
          durationMatters: 'La duracion del servicio determina si queda tiempo suficiente para otra reserva.',
          preset: 'Preset rapido: Lunes-Viernes 09:00-17:00.',
          existingFound: 'Se encontro disponibilidad existente. Al guardar se reemplazara.',
          startDate: 'Fecha inicio',
          endDate: 'Fecha fin',
          slots: 'slots',
          noRanges: 'No hay rangos horarios activos para este dia.',
          to: 'a',
          remove: 'Eliminar',
          addRange: 'Anadir rango',
          saveHours: 'Guardar horario',
          generatorTitle: 'Generador Rapido de Horario',
          generatorSubtitle: 'Define horas estandar y genera bloques semanales.',
          generalPreview: 'Vista previa del horario general',
          duration: 'Duracion',
          perBooking: 'por reserva',
          slotsWeek: 'slots/semana',
          validity: 'Periodo de validez (opcional)',
          from: 'Desde',
          until: 'Hasta',
          weeklyHours: 'Horas semanales',
          cancel: 'Cancelar',
          generate: 'Generar',
        }
      : {
          days: dayNames,
          startPast: 'Start date cannot be in the past.',
          endPast: 'End date cannot be in the past.',
          invalidRange: 'Invalid time range on',
          scheduleGenerated: 'Schedule generated successfully.',
          errorGenerating: 'Error generating schedule.',
          overlap: 'Slots cannot overlap on',
          scheduleSaved: 'Schedule saved successfully.',
          errorSaving: 'Error saving schedule.',
          title: 'Working Availability',
          manageFor: 'Manage schedule for',
          manageDefault: 'Manage employee schedule',
          quickGenerate: 'Generate Quick Schedule',
          employeeWide: 'Employee-wide availability',
          appliesAll: 'This schedule applies to all assigned services.',
          durationMatters: 'Service duration determines if there is enough remaining time for another booking.',
          preset: 'Quick preset: Monday-Friday 09:00-17:00.',
          existingFound: 'Existing availability found. Saving will replace it.',
          startDate: 'Start date',
          endDate: 'End date',
          slots: 'slots',
          noRanges: 'No active time ranges for this day.',
          to: 'to',
          remove: 'Remove',
          addRange: 'Add range',
          saveHours: 'Save Working Hours',
          generatorTitle: 'Quick Schedule Generator',
          generatorSubtitle: 'Set standard hours and generate weekly slots.',
          generalPreview: 'General schedule preview',
          duration: 'Duration',
          perBooking: 'per booking',
          slotsWeek: 'slots/week',
          validity: 'Validity period (optional)',
          from: 'From',
          until: 'To',
          weeklyHours: 'Weekly hours',
          cancel: 'Cancel',
          generate: 'Generate',
        };
  const [loading, setLoading] = useState(true);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [existingAvailabilityCount, setExistingAvailabilityCount] = useState(0);

  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: todayStr,
    end: '',
  });

  const [generatorDays, setGeneratorDays] = useState<Record<DayOfWeek, { enabled: boolean; startTime: string; endTime: string }>>({
    monday: { enabled: true, startTime: '09:00', endTime: '17:00' },
    tuesday: { enabled: true, startTime: '09:00', endTime: '17:00' },
    wednesday: { enabled: true, startTime: '09:00', endTime: '17:00' },
    thursday: { enabled: true, startTime: '09:00', endTime: '17:00' },
    friday: { enabled: true, startTime: '09:00', endTime: '17:00' },
    saturday: { enabled: false, startTime: '09:00', endTime: '14:00' },
    sunday: { enabled: false, startTime: '09:00', endTime: '14:00' },
  });

  const [generatorDateRange, setGeneratorDateRange] = useState<{ start: string; end: string }>({
    start: todayStr,
    end: '',
  });

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

  const slotPreview = useMemo(() => {
    const previewDuration = SLOT_PREVIEW_DURATION;
    const preview: Record<DayOfWeek, { count: number; slots: string[] }> = {} as Record<
      DayOfWeek,
      { count: number; slots: string[] }
    >;
    let total = 0;

    daysOfWeek.forEach((day) => {
      const cfg = generatorDays[day];
      if (cfg.enabled && cfg.startTime && cfg.endTime) {
        const slots = generateTimeSlots(cfg.startTime, cfg.endTime, previewDuration);
        preview[day] = { count: slots.length, slots };
        total += slots.length;
      } else {
        preview[day] = { count: 0, slots: [] };
      }
    });

    return { days: preview, total, previewDuration };
  }, [generatorDays]);

  const loadAvailability = async () => {
    setLoadingAvailability(true);
    try {
      const allAvailability = await getAvailability(employeeId);
      const genericAvailability = allAvailability.filter((a) => !a.serviceId);
      let data = genericAvailability;
      // Legacy fallback: if no employee-wide availability exists, show first service-specific schedule.
      if (!data.length) {
        const firstLegacyServiceId = allAvailability.find((a) => !!a.serviceId)?.serviceId;
        if (firstLegacyServiceId) {
          data = allAvailability.filter((a) => a.serviceId === firstLegacyServiceId);
        }
      }
      setAvailability(data);
      setExistingAvailabilityCount(data.length);

      const firstWithDates = data.find((a) => a.startDate || a.endDate);
      const startFromExistingOrToday = firstWithDates?.startDate
        ? firstWithDates.startDate < todayStr
          ? todayStr
          : firstWithDates.startDate
        : todayStr;
      const endFromExisting = firstWithDates?.endDate && firstWithDates.endDate >= todayStr ? firstWithDates.endDate : '';
      setDateRange({ start: startFromExistingOrToday, end: endFromExisting });

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
        const dayAvailability = data.filter((a) => a.dayOfWeek === day);
        const enabled = dayAvailability.some((a) => a.isAvailable);
        const slots = dayAvailability
          .filter((a) => a.isAvailable)
          .map((a) => ({ id: a.id, startTime: a.startTime, endTime: a.endTime }));

        nextDaySlots[day] = { enabled, slots };
      });

      setDaySlots(nextDaySlots);
    } catch (error) {
      console.error('Error loading availability:', error);
    } finally {
      setLoadingAvailability(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        await loadAvailability();
      } catch (error) {
        console.error('Error fetching employee schedule data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  useEffect(() => {
    setGeneratorDateRange((prev) => ({ start: prev.start || todayStr, end: prev.end }));
  }, [todayStr]);

  const handleGenerateSchedule = async () => {
    if (generatorDateRange.start && generatorDateRange.start < todayStr) {
          alert(copy.startPast);
      return;
    }
    if (generatorDateRange.end && generatorDateRange.end < todayStr) {
          alert(copy.endPast);
      return;
    }

    setSaving(true);
    try {
      for (const day of daysOfWeek) {
        const cfg = generatorDays[day];
        if (!cfg.enabled) continue;
        if (!cfg.startTime || !cfg.endTime || cfg.startTime >= cfg.endTime) {
          alert(`${copy.invalidRange} ${copy.days[day]}.`);
          setSaving(false);
          return;
        }
      }

      const existing = await getAvailability(employeeId);
      for (const item of existing) {
        await deleteAvailability(item.id);
      }

      for (const day of daysOfWeek) {
        const cfg = generatorDays[day];
        if (cfg.enabled && cfg.startTime && cfg.endTime) {
          await createAvailability({
            employeeId,
            dayOfWeek: day,
            startTime: cfg.startTime,
            endTime: cfg.endTime,
            isAvailable: true,
            startDate: generatorDateRange.start || undefined,
            endDate: generatorDateRange.end || undefined,
          });
        }
      }

      await loadAvailability();
      setShowGenerator(false);
      alert(copy.scheduleGenerated);
    } catch (error) {
      console.error('Error generating schedule:', error);
      alert(copy.errorGenerating);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (dateRange.start && dateRange.start < todayStr) {
      alert(copy.startPast);
      return;
    }
    if (dateRange.end && dateRange.end < todayStr) {
      alert(copy.endPast);
      return;
    }

    setSaving(true);
    try {
      for (const day of daysOfWeek) {
        const state = daySlots[day];
        const sortedSlots = [...state.slots].sort((a, b) => a.startTime.localeCompare(b.startTime));

        for (let i = 0; i < sortedSlots.length - 1; i += 1) {
          const current = sortedSlots[i];
          const next = sortedSlots[i + 1];
          if (current.endTime > next.startTime) {
            alert(`${copy.overlap} ${copy.days[day]}.`);
            setSaving(false);
            return;
          }
        }
      }

      const existingAvailability = await getAvailability(employeeId);
      for (const slot of existingAvailability) {
        await deleteAvailability(slot.id);
      }

      for (const day of daysOfWeek) {
        const state = daySlots[day];
        if (!state.enabled) continue;
        for (const slot of state.slots) {
          if (!slot.startTime || !slot.endTime) continue;
          await createAvailability({
            employeeId,
            dayOfWeek: day,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isAvailable: true,
            startDate: dateRange.start || undefined,
            endDate: dateRange.end || undefined,
          });
        }
      }

      await loadAvailability();
      alert(copy.scheduleSaved);
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert(copy.errorSaving);
    } finally {
      setSaving(false);
    }
  };

  const getSlotsForDay = (day: DayOfWeek) => {
    const state = daySlots[day];
    if (!state.enabled || state.slots.length === 0) return [];
    const previewDuration = SLOT_PREVIEW_DURATION;

    const allSlots: string[] = [];
    state.slots.forEach((slot) => {
      if (slot.startTime && slot.endTime) {
        allSlots.push(...generateTimeSlots(slot.startTime, slot.endTime, previewDuration));
      }
    });

    return [...new Set(allSlots)].sort();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loading size="sm" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">{copy.title}</h2>
          <p className="text-slate-500 text-sm mt-1">
            {employeeName ? `${copy.manageFor} ${employeeName}` : copy.manageDefault}
          </p>
        </div>
        <Button onClick={() => setShowGenerator(true)} variant="outline">
          {copy.quickGenerate}
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="space-y-3">
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg">
            <p className="text-sm font-medium text-sky-800">{copy.employeeWide}</p>
            <p className="text-xs text-sky-700 mt-1">{copy.appliesAll}</p>
            <p className="text-xs text-sky-700 mt-1">{copy.durationMatters}</p>
            <p className="text-xs text-sky-700 mt-1">{copy.preset}</p>
            {existingAvailabilityCount > 0 && (
              <p className="text-xs text-sky-700 mt-2">{copy.existingFound}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">{copy.startDate}</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                min={todayStr}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">{copy.endDate}</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                min={dateRange.start || todayStr}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>
          </div>
        </div>

        {loadingAvailability ? (
          <div className="flex items-center justify-center py-6">
            <Loading size="sm" />
          </div>
        ) : (
          <div className="space-y-4">
            {daysOfWeek.map((day) => {
              const state = daySlots[day];
              const previewSlots = getSlotsForDay(day);

              return (
                <div key={day} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.enabled}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setDaySlots((prev) => ({
                            ...prev,
                            [day]: {
                              enabled,
                              slots: enabled
                                ? prev[day].slots.length > 0
                                  ? prev[day].slots
                                  : [{ startTime: '09:00', endTime: '17:00' }]
                                : [],
                            },
                          }));
                        }}
                        className="rounded border-slate-400"
                      />
                      <span className="ml-3 font-medium text-slate-800">{copy.days[day]}</span>
                    </label>

                    {state.enabled && previewSlots.length > 0 && (
                      <span className="text-xs bg-sky-100 text-sky-700 px-2 py-1 rounded">
                        {previewSlots.length} {copy.slots}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-3">
                    {!state.enabled && <p className="text-xs text-slate-500">{copy.noRanges}</p>}

                    {state.enabled &&
                      state.slots.map((slot, idx) => (
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
                                className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm"
                              />
                              <span className="text-slate-500 text-xs">{copy.to}</span>
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
                                className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm"
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
                              className="text-rose-600 text-xs underline"
                            >
                              {copy.remove}
                            </button>
                          </div>

                          {slot.startTime && slot.endTime && (
                            <div className="ml-0 sm:ml-4 flex flex-wrap gap-1">
                              {generateTimeSlots(slot.startTime, slot.endTime, slotPreview.previewDuration).map((time) => (
                                <span key={time} className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-600">
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
                      {copy.addRange}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-2">
          <Button onClick={handleSave} isLoading={saving}>
            {copy.saveHours}
          </Button>
        </div>
      </div>

      {showGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-sky-50">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{copy.generatorTitle}</h3>
                <p className="text-xs text-slate-600 mt-1">{copy.generatorSubtitle}</p>
              </div>
              <button onClick={() => setShowGenerator(false)} className="text-2xl text-slate-400 hover:text-slate-700">
                ×
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{copy.generalPreview}</p>
                <p className="text-sm text-slate-600">{copy.duration}: {slotPreview.previewDuration} min / {copy.perBooking}</p>
              </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-sky-700">{slotPreview.total}</p>
                  <p className="text-xs text-slate-500">{copy.slotsWeek}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">{copy.validity}</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{copy.from}</label>
                    <input
                      type="date"
                      value={generatorDateRange.start}
                      onChange={(e) => setGeneratorDateRange((prev) => ({ ...prev, start: e.target.value }))}
                      min={todayStr}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{copy.until}</label>
                    <input
                      type="date"
                      value={generatorDateRange.end}
                      onChange={(e) => setGeneratorDateRange((prev) => ({ ...prev, end: e.target.value }))}
                      min={generatorDateRange.start || todayStr}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">{copy.weeklyHours}</label>
                {daysOfWeek.map((day) => {
                  const cfg = generatorDays[day];
                  const dayPreview = slotPreview.days[day];
                  return (
                    <div
                      key={day}
                      className={`p-3 border rounded-lg ${cfg.enabled ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-slate-50'}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <label className="flex items-center cursor-pointer min-w-[120px]">
                          <input
                            type="checkbox"
                            checked={cfg.enabled}
                            onChange={(e) =>
                              setGeneratorDays((prev) => ({
                                ...prev,
                                [day]: { ...prev[day], enabled: e.target.checked },
                              }))
                            }
                            className="rounded border-slate-400"
                          />
                          <span className="ml-2 text-sm text-slate-800">{copy.days[day]}</span>
                        </label>

                        {cfg.enabled && (
                          <>
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="time"
                                value={cfg.startTime}
                                onChange={(e) =>
                                  setGeneratorDays((prev) => ({
                                    ...prev,
                                    [day]: { ...prev[day], startTime: e.target.value },
                                  }))
                                }
                                className="px-2 py-1.5 border border-slate-300 rounded bg-white text-slate-900 text-sm"
                              />
                              <span className="text-slate-500 text-xs">{copy.to}</span>
                              <input
                                type="time"
                                value={cfg.endTime}
                                onChange={(e) =>
                                  setGeneratorDays((prev) => ({
                                    ...prev,
                                    [day]: { ...prev[day], endTime: e.target.value },
                                  }))
                                }
                                className="px-2 py-1.5 border border-slate-300 rounded bg-white text-slate-900 text-sm"
                              />
                            </div>
                            {dayPreview && dayPreview.count > 0 && (
                              <span className="text-xs text-sky-700 bg-white px-2 py-1 rounded border border-sky-200">
                                {dayPreview.count} {copy.slots}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex gap-3 bg-slate-50">
              <Button variant="outline" onClick={() => setShowGenerator(false)} className="flex-1">
                {copy.cancel}
              </Button>
              <Button onClick={handleGenerateSchedule} isLoading={saving} className="flex-1" disabled={slotPreview.total === 0}>
                {copy.generate}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
