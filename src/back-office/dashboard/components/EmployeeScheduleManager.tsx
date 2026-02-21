'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  createAvailability,
  deleteAvailability,
  getAvailability,
  getEmployeeServices,
  getServices,
  updateAvailability,
} from '@/shared/lib/firestore';
import { Button } from '@/shared/components/Button';
import { Loading } from '@/shared/components/Loading';
import { generateTimeSlots } from '@/shared/lib/utils';
import type { Availability, DayOfWeek, Service } from '@/shared/lib/types';

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
  const todayStr = new Date().toISOString().split('T')[0];
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined);
  const [availability, setAvailability] = useState<Availability[]>([]);
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
    monday: { enabled: true, startTime: '10:00', endTime: '18:00' },
    tuesday: { enabled: true, startTime: '10:00', endTime: '18:00' },
    wednesday: { enabled: true, startTime: '10:00', endTime: '18:00' },
    thursday: { enabled: true, startTime: '10:00', endTime: '18:00' },
    friday: { enabled: true, startTime: '10:00', endTime: '18:00' },
    saturday: { enabled: false, startTime: '10:00', endTime: '14:00' },
    sunday: { enabled: false, startTime: '10:00', endTime: '14:00' },
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

  const selectedService = useMemo(() => services.find((s) => s.id === selectedServiceId), [services, selectedServiceId]);

  const slotPreview = useMemo(() => {
    if (!selectedService) return null;
    const preview: Record<DayOfWeek, { count: number; slots: string[] }> = {} as Record<
      DayOfWeek,
      { count: number; slots: string[] }
    >;
    let total = 0;

    daysOfWeek.forEach((day) => {
      const cfg = generatorDays[day];
      if (cfg.enabled && cfg.startTime && cfg.endTime) {
        const slots = generateTimeSlots(cfg.startTime, cfg.endTime, selectedService.duration);
        preview[day] = { count: slots.length, slots };
        total += slots.length;
      } else {
        preview[day] = { count: 0, slots: [] };
      }
    });

    return { days: preview, total };
  }, [generatorDays, selectedService]);

  const loadAvailability = async (serviceId?: string) => {
    setLoadingAvailability(true);
    try {
      let data = await getAvailability(employeeId, serviceId);
      if (serviceId && data.length === 0) {
        data = await getAvailability(employeeId);
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
        const [employeeServices, allServices] = await Promise.all([getEmployeeServices(employeeId), getServices()]);
        const assignedServices = allServices.filter((s) => employeeServices.some((es) => es.serviceId === s.id));
        setServices(assignedServices);
        const defaultServiceId = assignedServices[0]?.id;
        setSelectedServiceId(defaultServiceId);
        if (defaultServiceId) {
          await loadAvailability(defaultServiceId);
        }
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
    if (selectedServiceId) {
      loadAvailability(selectedServiceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceId]);

  useEffect(() => {
    setGeneratorDateRange((prev) => ({ start: prev.start || todayStr, end: prev.end }));
  }, [selectedServiceId, todayStr]);

  const handleGenerateSchedule = async () => {
    if (!selectedServiceId || !selectedService) {
      alert('Select a service first.');
      return;
    }
    if (generatorDateRange.start && generatorDateRange.start < todayStr) {
      alert('Start date cannot be in the past.');
      return;
    }
    if (generatorDateRange.end && generatorDateRange.end < todayStr) {
      alert('End date cannot be in the past.');
      return;
    }

    setSaving(true);
    try {
      const existing = await getAvailability(employeeId, selectedServiceId);
      for (const item of existing) {
        await deleteAvailability(item.id);
      }

      for (const day of daysOfWeek) {
        const cfg = generatorDays[day];
        if (cfg.enabled && cfg.startTime && cfg.endTime) {
          await createAvailability({
            employeeId,
            serviceId: selectedServiceId,
            dayOfWeek: day,
            startTime: cfg.startTime,
            endTime: cfg.endTime,
            isAvailable: true,
            startDate: generatorDateRange.start || undefined,
            endDate: generatorDateRange.end || undefined,
          });
        }
      }

      await loadAvailability(selectedServiceId);
      setShowGenerator(false);
      alert('Schedule generated successfully.');
    } catch (error) {
      console.error('Error generating schedule:', error);
      alert('Error generating schedule.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedServiceId) {
      alert('Select a service first.');
      return;
    }
    if (dateRange.start && dateRange.start < todayStr) {
      alert('Start date cannot be in the past.');
      return;
    }
    if (dateRange.end && dateRange.end < todayStr) {
      alert('End date cannot be in the past.');
      return;
    }

    setSaving(true);
    try {
      for (const day of daysOfWeek) {
        const state = daySlots[day];
        const existing = availability.filter((a) => a.dayOfWeek === day);
        const usedIds = new Set<string>();
        const sortedSlots = [...state.slots].sort((a, b) => a.startTime.localeCompare(b.startTime));

        for (let i = 0; i < sortedSlots.length - 1; i += 1) {
          const current = sortedSlots[i];
          const next = sortedSlots[i + 1];
          if (current.endTime > next.startTime) {
            alert(`Slots cannot overlap on ${dayNames[day]}.`);
            setSaving(false);
            return;
          }
        }

        if (!state.enabled) {
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

        for (const slot of state.slots) {
          if (!slot.startTime || !slot.endTime) continue;
          if (slot.startTime >= slot.endTime) {
            alert('Each slot start time must be before end time.');
            setSaving(false);
            return;
          }

          if (slot.id) {
            usedIds.add(slot.id);
            await updateAvailability(slot.id, {
              startTime: slot.startTime,
              endTime: slot.endTime,
              isAvailable: true,
              serviceId: selectedServiceId,
              startDate: dateRange.start || undefined,
              endDate: dateRange.end || undefined,
            });
          } else {
            const createdId = await createAvailability({
              employeeId,
              serviceId: selectedServiceId,
              dayOfWeek: day,
              startTime: slot.startTime,
              endTime: slot.endTime,
              isAvailable: true,
              startDate: dateRange.start || undefined,
              endDate: dateRange.end || undefined,
            });
            usedIds.add(createdId);
          }
        }

        for (const slot of existing) {
          if (!usedIds.has(slot.id)) {
            await deleteAvailability(slot.id);
          }
        }
      }

      await loadAvailability(selectedServiceId);
      alert('Schedule saved successfully.');
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Error saving schedule.');
    } finally {
      setSaving(false);
    }
  };

  const getSlotsForDay = (day: DayOfWeek) => {
    if (!selectedService) return [];
    const state = daySlots[day];
    if (!state.enabled || state.slots.length === 0) return [];

    const allSlots: string[] = [];
    state.slots.forEach((slot) => {
      if (slot.startTime && slot.endTime) {
        allSlots.push(...generateTimeSlots(slot.startTime, slot.endTime, selectedService.duration));
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
          <h2 className="text-2xl font-semibold text-slate-800">Working Availability</h2>
          <p className="text-slate-500 text-sm mt-1">
            {employeeName ? `Manage schedule for ${employeeName}` : 'Manage employee schedule'}
          </p>
        </div>
        <Button onClick={() => setShowGenerator(true)} variant="outline" disabled={!selectedServiceId}>
          Generate Quick Schedule
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">Service</label>
            <select
              value={selectedServiceId || ''}
              onChange={(e) => setSelectedServiceId(e.target.value || undefined)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              {services.length === 0 && <option value="">No assigned services</option>}
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.serviceName} ({service.duration} min)
                </option>
              ))}
            </select>
            {selectedService && (
              <div className="mt-3 p-3 bg-sky-50 border border-sky-200 rounded-lg">
                <p className="text-sm font-medium text-sky-800">Duration: {selectedService.duration} minutes</p>
                <p className="text-xs text-sky-700 mt-1">Generated slots follow this service duration.</p>
                {existingAvailabilityCount > 0 && (
                  <p className="text-xs text-sky-700 mt-2">Existing schedule found for this service. Saving will update it.</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">Start date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                min={todayStr}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">End date</label>
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
                      <span className="ml-3 font-medium text-slate-800">{dayNames[day]}</span>
                    </label>

                    {state.enabled && previewSlots.length > 0 && (
                      <span className="text-xs bg-sky-100 text-sky-700 px-2 py-1 rounded">
                        {previewSlots.length} slots
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-3">
                    {!state.enabled && <p className="text-xs text-slate-500">No active time ranges for this day.</p>}

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
                              <span className="text-slate-500 text-xs">to</span>
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
                              Remove
                            </button>
                          </div>

                          {selectedService && slot.startTime && slot.endTime && (
                            <div className="ml-0 sm:ml-4 flex flex-wrap gap-1">
                              {generateTimeSlots(slot.startTime, slot.endTime, selectedService.duration).map((time) => (
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
                      Add range
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-2">
          <Button onClick={handleSave} isLoading={saving}>
            Save Working Hours
          </Button>
        </div>
      </div>

      {showGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-sky-50">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Quick Schedule Generator</h3>
                <p className="text-xs text-slate-600 mt-1">Set standard hours and generate weekly slots.</p>
              </div>
              <button onClick={() => setShowGenerator(false)} className="text-2xl text-slate-400 hover:text-slate-700">
                ×
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {selectedService && (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{selectedService.serviceName}</p>
                    <p className="text-sm text-slate-600">Duration: {selectedService.duration} min / booking</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-sky-700">{slotPreview?.total || 0}</p>
                    <p className="text-xs text-slate-500">slots/week</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">Validity period (optional)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">From</label>
                    <input
                      type="date"
                      value={generatorDateRange.start}
                      onChange={(e) => setGeneratorDateRange((prev) => ({ ...prev, start: e.target.value }))}
                      min={todayStr}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">To</label>
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
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Weekly hours</label>
                {daysOfWeek.map((day) => {
                  const cfg = generatorDays[day];
                  const dayPreview = slotPreview?.days[day];
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
                          <span className="ml-2 text-sm text-slate-800">{dayNames[day]}</span>
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
                              <span className="text-slate-500 text-xs">to</span>
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
                                {dayPreview.count} slots
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
                Cancel
              </Button>
              <Button onClick={handleGenerateSchedule} isLoading={saving} className="flex-1" disabled={!slotPreview || slotPreview.total === 0}>
                Generate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
