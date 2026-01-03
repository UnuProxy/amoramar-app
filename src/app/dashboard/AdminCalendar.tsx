'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { addMinutesToTime, generateTimeSlots, cn } from '@/shared/lib/utils';
import { Loading } from '@/shared/components/Loading';
import {
  createBlockedSlot,
  deleteBlockedSlot,
  getAvailability,
  getBlockedSlots,
  getBookings,
  getEmployeeServices,
  updateBlockedSlot,
  updateBooking,
} from '@/shared/lib/firestore';
import type {
  Availability,
  BlockedSlot,
  Booking,
  DayOfWeek,
  Employee,
  Service,
  TimeSlot,
} from '@/shared/lib/types';

const dayNames: Record<string, string> = {
  monday: 'Lun',
  tuesday: 'Mar',
  wednesday: 'Mié',
  thursday: 'Jue',
  friday: 'Vie',
  saturday: 'Sáb',
  sunday: 'Dom',
};

const dayKeyByIndex: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const toInputDate = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy.toISOString().split('T')[0];
};

const getStartOfWeek = (baseDate: Date = new Date()) => {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toInputDate(date);
};

const minutesFromTime = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const hasOverlap = (startA: number, endA: number, startB: number, endB: number) => {
  return (startA >= startB && startA < endB) || (startB >= startA && startB < endA);
};

const isSlotInPast = (date: string, time: string): boolean => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  if (date < today) return true;
  if (date === today) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const slotMinutes = minutesFromTime(time);
    return slotMinutes <= currentMinutes;
  }
  return false;
};

const isBookingInFuture = (bookingDate: string, bookingTime: string): boolean => {
  const now = new Date();
  const start = new Date(`${bookingDate}T${bookingTime}:00`);
  return start.getTime() > now.getTime();
};

const isDayInPast = (date: string): boolean => {
  const today = new Date().toISOString().split('T')[0];
  return date < today;
};

type BlockModalData = {
  date: string;
  startTime: string;
  endTime?: string;
  reason?: string;
  isEdit?: boolean;
  blockedSlotId?: string;
} | null;

type BookingModalData =
  | {
      booking: Booking;
      mode: 'view' | 'reschedule';
      newDate: string;
      newTime: string;
      slots: TimeSlot[];
      loadingSlots: boolean;
      slotsError: string | null;
      saving: boolean;
    }
  | null;

export interface AdminCalendarProps {
  employees: Employee[];
  services: Service[];
  refreshKey: number;
  onRequestBooking: (defaults: { employeeId: string; serviceId: string; bookingDate: string; bookingTime: string }) => void;
  onBookingPatched?: (bookingId: string, updates: Partial<Booking>) => void;
}

export function AdminCalendar({
  employees,
  services,
  refreshKey,
  onRequestBooking,
  onBookingPatched,
}: AdminCalendarProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [employeeServices, setEmployeeServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [calendarStartDate, setCalendarStartDate] = useState<string>(() => getStartOfWeek());
  const [blockModal, setBlockModal] = useState<BlockModalData>(null);
  const [savingBlock, setSavingBlock] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [bookingModal, setBookingModal] = useState<BookingModalData>(null);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (employees.length && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  const loadAvailability = async (employeeId: string, serviceId?: string) => {
    try {
      let data = await getAvailability(employeeId, serviceId);
      if (serviceId && data.length === 0) {
        data = await getAvailability(employeeId);
      }
      setAvailability(data);
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  };

  const loadCalendarData = async (employeeId: string, serviceId: string, startDateValue: string) => {
    if (!startDateValue || !employeeId || !serviceId) return;
    setLoadingCalendar(true);
    try {
      const startDateObj = new Date(`${startDateValue}T12:00:00`);
      const endDateObj = new Date(startDateObj);
      endDateObj.setDate(endDateObj.getDate() + 6);
      const endDateValue = toInputDate(endDateObj);

      const [bookingsData, blockedData] = await Promise.all([
        getBookings({
          employeeId,
          startDate: startDateValue,
          endDate: endDateValue,
        }),
        getBlockedSlots({
          employeeId,
          serviceId,
          startDate: startDateValue,
          endDate: endDateValue,
        }),
      ]);
      setBookings(bookingsData);
      setBlockedSlots(blockedData);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoadingCalendar(false);
    }
  };

  useEffect(() => {
    const loadEmployeeServices = async () => {
      if (!selectedEmployeeId) return;
      setLoading(true);
      try {
        const assignments = await getEmployeeServices(selectedEmployeeId);
        const assignedServices = services.filter((s) => assignments.some((a) => a.serviceId === s.id));
        setEmployeeServices(assignedServices);
        const defaultService = assignedServices[0];
        setSelectedServiceId(defaultService?.id || '');
        if (defaultService?.id) {
          await Promise.all([
            loadAvailability(selectedEmployeeId, defaultService.id),
            loadCalendarData(selectedEmployeeId, defaultService.id, calendarStartDate),
          ]);
        } else {
          setAvailability([]);
          setBookings([]);
          setBlockedSlots([]);
        }
      } catch (error) {
        console.error('Error loading employee services:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEmployeeServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId, services]);

  useEffect(() => {
    if (!selectedEmployeeId || !selectedServiceId) return;
    loadAvailability(selectedEmployeeId, selectedServiceId);
    loadCalendarData(selectedEmployeeId, selectedServiceId, calendarStartDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceId, calendarStartDate, refreshKey]);

  const changeWeek = (direction: number) => {
    const baseDate = new Date(`${calendarStartDate}T12:00:00`);
    baseDate.setDate(baseDate.getDate() + direction * 7);
    setCalendarStartDate(toInputDate(baseDate));
  };

  const goToToday = () => setCalendarStartDate(getStartOfWeek());

  const selectedService = employeeServices.find((service) => service.id === selectedServiceId);
  const slotDuration = selectedService?.duration || 30;

  const getAvailabilitiesForDay = (day: DayOfWeek, date: string): Availability[] => {
    const dayAvailabilities = availability.filter((a) => {
      if (a.dayOfWeek !== day || !a.isAvailable) return false;
      if (a.startDate && date < a.startDate) return false;
      if (a.endDate && date > a.endDate) return false;
      return true;
    });
    const exact = dayAvailabilities.filter((a) => a.serviceId === selectedServiceId);
    if (exact.length > 0) return exact;
    return dayAvailabilities.filter((a) => !a.serviceId);
  };

  const findBookingForSlot = (date: string, time: string) => {
    const slotStart = minutesFromTime(time);
    const slotEnd = slotStart + slotDuration;
    return bookings.find(
      (booking) =>
        booking.bookingDate === date &&
        booking.status !== 'cancelled' &&
        hasOverlap(
          slotStart,
          slotEnd,
          minutesFromTime(booking.bookingTime),
          minutesFromTime(booking.bookingTime) + slotDuration
        )
    );
  };

  const findBlockedSlot = (date: string, time: string) => {
    const slotStart = minutesFromTime(time);
    const slotEnd = slotStart + slotDuration;
    return blockedSlots.find((blocked) => {
      if (blocked.date !== date) return false;
      const blockStart = minutesFromTime(blocked.startTime);
      const blockEnd = blocked.endTime ? minutesFromTime(blocked.endTime) : blockStart + slotDuration;
      return hasOverlap(slotStart, slotEnd, blockStart, blockEnd);
    });
  };

  const openBlockModal = (date: string, startTime: string, blocked?: BlockedSlot) => {
    if (!selectedEmployeeId || !selectedServiceId) return;
    if (blocked) {
      setBlockModal({
        date,
        startTime: blocked.startTime,
        endTime: blocked.endTime || addMinutesToTime(blocked.startTime, slotDuration),
        reason: blocked.reason || '',
        isEdit: true,
        blockedSlotId: blocked.id,
      });
    } else {
      setBlockModal({
        date,
        startTime,
        endTime: addMinutesToTime(startTime, slotDuration),
        reason: '',
        isEdit: false,
      });
    }
  };

  const handleSaveBlock = async () => {
    if (!selectedEmployeeId || !selectedServiceId || !blockModal) return;
    setSavingBlock(true);
    try {
      if (blockModal.isEdit && blockModal.blockedSlotId) {
        await updateBlockedSlot(blockModal.blockedSlotId, {
          startTime: blockModal.startTime,
          endTime: blockModal.endTime || undefined,
          reason: blockModal.reason || undefined,
        });
      } else {
        await createBlockedSlot({
          employeeId: selectedEmployeeId,
          serviceId: selectedServiceId,
          date: blockModal.date,
          startTime: blockModal.startTime,
          endTime: blockModal.endTime,
          reason: blockModal.reason || 'Bloqueado',
        });
      }
      await loadCalendarData(selectedEmployeeId, selectedServiceId, calendarStartDate);
      setBlockModal(null);
    } catch (error) {
      console.error('Error saving block:', error);
      alert('No se pudo guardar el bloqueo');
    } finally {
      setSavingBlock(false);
    }
  };

  const handleDeleteBlock = async () => {
    if (!selectedEmployeeId || !selectedServiceId || !blockModal?.blockedSlotId) return;
    setSavingBlock(true);
    try {
      await deleteBlockedSlot(blockModal.blockedSlotId);
      await loadCalendarData(selectedEmployeeId, selectedServiceId, calendarStartDate);
      setBlockModal(null);
    } catch (error) {
      console.error('Error deleting block:', error);
      alert('No se pudo eliminar el bloqueo');
    } finally {
      setSavingBlock(false);
    }
  };

  const handleBookingStatus = async (booking: Booking, newStatus: Booking['status']) => {
    if (newStatus === 'completed' && isBookingInFuture(booking.bookingDate, booking.bookingTime)) {
      alert('No puedes marcar como completada una reserva futura. Puedes cancelarla o reprogramarla.');
      return;
    }
    if (newStatus === 'cancelled') {
      try {
        const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'owner' }),
        });
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'No se pudo cancelar la reserva');
        }
        setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: 'cancelled' } : b)));
        onBookingPatched?.(booking.id, { status: 'cancelled' });
      } catch (error) {
        console.error('Error cancelling booking:', error);
        alert('No se pudo cancelar la reserva');
      }
      return;
    }
    try {
      await updateBooking(booking.id, {
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date() : undefined,
      });
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: newStatus } : b)));
      onBookingPatched?.(booking.id, { status: newStatus });
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('No se pudo actualizar la reserva');
    }
  };

  const openBookingModal = (booking: Booking) => {
    setBookingModal({
      booking,
      mode: 'view',
      newDate: booking.bookingDate,
      newTime: booking.bookingTime,
      slots: [],
      loadingSlots: false,
      slotsError: null,
      saving: false,
    });
  };

  const loadAvailableSlotsForReschedule = async (booking: Booking, date: string) => {
    setBookingModal((prev) => (prev ? { ...prev, loadingSlots: true, slotsError: null, slots: [] } : prev));
    try {
      const params = new URLSearchParams({
        employeeId: booking.employeeId,
        serviceId: booking.serviceId,
        date,
      });
      const res = await fetch(`/api/slots/available?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'No se pudieron cargar los horarios');
      }
      const slots: TimeSlot[] = json.data?.slots || [];
      setBookingModal((prev) => (prev ? { ...prev, slots, loadingSlots: false, slotsError: null } : prev));
    } catch (e: any) {
      setBookingModal((prev) =>
        prev
          ? {
              ...prev,
              loadingSlots: false,
              slotsError: e?.message || 'No se pudieron cargar los horarios',
              slots: [],
            }
          : prev
      );
    }
  };

  const startReschedule = async () => {
    if (!bookingModal) return;
    const { booking } = bookingModal;
    if (booking.status === 'completed') return;
    setBookingModal((prev) => (prev ? { ...prev, mode: 'reschedule', newDate: booking.bookingDate, newTime: booking.bookingTime } : prev));
    await loadAvailableSlotsForReschedule(booking, booking.bookingDate);
  };

  const cancelBookingFromModal = async () => {
    if (!bookingModal) return;
    const { booking } = bookingModal;
    if (booking.status === 'completed') return;
    const ok = window.confirm('¿Cancelar esta reserva? Esta acción liberará el horario.');
    if (!ok) return;
    setBookingModal((prev) => (prev ? { ...prev, saving: true } : prev));
    try {
      const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'owner' }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'No se pudo cancelar la reserva');
      }
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: 'cancelled' } : b)));
      onBookingPatched?.(booking.id, { status: 'cancelled' });
      setBookingModal(null);
    } catch (e) {
      console.error(e);
      alert('No se pudo cancelar la reserva');
      setBookingModal((prev) => (prev ? { ...prev, saving: false } : prev));
    }
  };

  const saveRescheduleFromModal = async () => {
    if (!bookingModal) return;
    const { booking, newDate, newTime } = bookingModal;
    if (booking.status === 'completed') return;
    if (!newDate || !newTime) {
      alert('Selecciona una fecha y hora.');
      return;
    }
    if (isBookingInFuture(newDate, newTime) === false && (newDate < new Date().toISOString().split('T')[0] || isSlotInPast(newDate, newTime))) {
      alert('No puedes reprogramar a un horario pasado.');
      return;
    }
    setBookingModal((prev) => (prev ? { ...prev, saving: true } : prev));
    try {
      await updateBooking(booking.id, {
        bookingDate: newDate,
        bookingTime: newTime,
        status: 'confirmed',
      });
      setBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id ? { ...b, bookingDate: newDate, bookingTime: newTime, status: 'confirmed' } : b
        )
      );
      onBookingPatched?.(booking.id, { bookingDate: newDate, bookingTime: newTime, status: 'confirmed' });
      setBookingModal(null);
    } catch (e) {
      console.error(e);
      alert('No se pudo reprogramar la reserva');
      setBookingModal((prev) => (prev ? { ...prev, saving: false } : prev));
    }
  };

  const weekStats = useMemo(() => {
    const confirmedBookings = bookings.filter((b) => b.status !== 'cancelled').length;
    const blockedCount = blockedSlots.length;

    let availableCount = 0;
    let pastCount = 0;
    const weekStart = new Date(`${calendarStartDate}T12:00:00`);

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = toInputDate(date);
      const dayKey = dayKeyByIndex[date.getDay()];
      const dayAvailabilities = getAvailabilitiesForDay(dayKey, dateStr);

      if (dayAvailabilities.length > 0) {
        const slotSet = new Set<string>();
        dayAvailabilities.forEach((avail) => {
          generateTimeSlots(avail.startTime, avail.endTime, slotDuration).forEach((slot) => slotSet.add(slot));
        });

        slotSet.forEach((slot) => {
          const booking = findBookingForSlot(dateStr, slot);
          const blocked = findBlockedSlot(dateStr, slot);
          const isPast = isSlotInPast(dateStr, slot);

          if (isPast) {
            pastCount++;
          } else if (!booking && !blocked) {
            availableCount++;
          }
        });
      }
    }

    return { confirmedBookings, blockedCount, availableCount, pastCount };
  }, [bookings, blockedSlots, availability, calendarStartDate, slotDuration, currentTime]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="sm" />
      </div>
    );
  }

  if (!selectedEmployeeId) {
    return <div className="p-6 bg-white rounded-xl border border-primary-100">No hay empleados disponibles.</div>;
  }

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  const weekStart = new Date(`${calendarStartDate}T12:00:00`);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekRangeLabel = `${weekStart.toLocaleDateString('es-ES', { month: 'long', day: 'numeric' })} - ${weekEnd.toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' })}`;

  const calendarDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${calendarStartDate}T12:00:00`);
    date.setDate(date.getDate() + index);
    const dateStr = toInputDate(date);
    const isToday = dateStr === toInputDate(new Date());
    const isPast = isDayInPast(dateStr);
    return {
      date: dateStr,
      label: date.toLocaleDateString('es-ES', { weekday: 'long' }),
      dayKey: dayKeyByIndex[date.getDay()],
      dayNumber: date.getDate(),
      monthShort: date.toLocaleDateString('es-ES', { month: 'short' }),
      isToday,
      isPast,
    };
  });

  return (
    <div className="space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
        <div>
          <h1 className="text-5xl font-black text-neutral-800 tracking-tighter uppercase leading-none">Calendario</h1>
          <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.3em] mt-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-600 animate-pulse" />
            {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()} •{' '}
            {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="px-6 py-4 bg-white border border-neutral-200 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] focus:border-accent-600 outline-none cursor-pointer shadow-sm transition-all text-neutral-800"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName.toUpperCase()} {emp.lastName.toUpperCase()}
              </option>
            ))}
          </select>

          <select
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value || '')}
            className="px-6 py-4 bg-white border border-neutral-200 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] focus:border-accent-600 outline-none cursor-pointer shadow-sm transition-all text-neutral-800"
          >
            {employeeServices.length === 0 && <option value="">SIN SERVICIOS</option>}
            {employeeServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.serviceName.toUpperCase()} • {service.duration}MIN
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-neutral-100 border-t-4 border-info-500 rounded-[32px] p-8 shadow-[0_1px_3px_rgba(0,0,0,0.1)] group hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all">
          <p className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2">Reservas</p>
          <p className="text-4xl font-black text-neutral-800 tabular-nums">{weekStats.confirmedBookings}</p>
        </div>
        <div className="bg-white border border-neutral-100 border-t-4 border-success-500 rounded-[32px] p-8 shadow-[0_1px_3px_rgba(0,0,0,0.1)] group hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all">
          <p className="text-[9px] font-black text-success-600 uppercase tracking-[0.2em] mb-2">Libres</p>
          <p className="text-4xl font-black text-success-600 tabular-nums">{weekStats.availableCount}</p>
        </div>
        <div className="bg-white border border-neutral-100 border-t-4 border-primary-900 rounded-[32px] p-8 shadow-[0_1px_3px_rgba(0,0,0,0.1)] group hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all">
          <p className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2">Bloqueos</p>
          <p className="text-4xl font-black text-primary-900 tabular-nums">{weekStats.blockedCount}</p>
        </div>
        <div className="bg-primary-900 rounded-[32px] p-8 shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
          <p className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em] mb-2">Pasados</p>
          <p className="text-4xl font-black text-white tabular-nums">{weekStats.pastCount}</p>
        </div>
      </div>

      <div className="bg-white border border-neutral-100 rounded-[48px] shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-neutral-100 bg-neutral-50/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-6">
              <button
                onClick={() => changeWeek(-1)}
                disabled={loadingCalendar}
                className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 text-neutral-400 hover:bg-neutral-800 hover:text-white hover:border-neutral-800 transition-all flex items-center justify-center disabled:opacity-30"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-lg font-black text-neutral-800 uppercase tracking-[0.2em]">{weekRangeLabel}</h2>
              <button
                onClick={() => changeWeek(1)}
                disabled={loadingCalendar}
                className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 text-neutral-400 hover:bg-neutral-800 hover:text-white hover:border-neutral-800 transition-all flex items-center justify-center disabled:opacity-30"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <button
              onClick={goToToday}
              className="px-8 py-3 text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] border-2 border-neutral-100 rounded-xl hover:border-neutral-800 hover:text-neutral-800 transition-all"
            >
              Ir a Hoy
            </button>
          </div>
        </div>

        <div className="px-10 py-4 border-b border-neutral-100 bg-neutral-50/50 flex flex-wrap gap-8">
          {[
            { color: 'bg-success-500', label: 'Disponible' },
            { color: 'bg-info-500', label: 'Reservado' },
            { color: 'bg-primary-900', label: 'Bloqueado' },
            { color: 'bg-[#9CA3AF]', label: 'Pasado' },
          ].map(status => (
            <span key={status.label} className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400">
              <span className={`w-2 h-2 rounded-full ${status.color}`} /> {status.label}
            </span>
          ))}
        </div>

        {!selectedServiceId ? (
          <div className="p-20 text-center">
            <p className="text-sm font-black text-neutral-300 uppercase tracking-[0.3em]">Selecciona un servicio para visualizar el calendario</p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <div className="grid grid-cols-7 min-w-[1000px]">
              {calendarDays.map((day) => (
                <div
                  key={day.date}
                  className={cn(
                    "px-4 py-8 text-center border-b border-r border-neutral-100 last:border-r-0 transition-colors",
                    day.isToday ? 'bg-accent-50/30' : day.isPast ? 'bg-neutral-50/50' : 'bg-white'
                  )}
                >
                  <p className={cn(
                    "text-[10px] font-black uppercase tracking-[0.3em] mb-2",
                    day.isToday ? 'text-accent-600' : 'text-neutral-400'
                  )}>
                    {dayNames[day.dayKey]}
                  </p>
                  <p className={cn(
                    "text-4xl font-black tabular-nums tracking-tighter leading-none",
                    day.isToday ? 'text-accent-600' : day.isPast ? 'text-neutral-200' : 'text-neutral-800'
                  )}>
                    {day.dayNumber}
                  </p>
                </div>
              ))}

              {calendarDays.map((day) => {
                const dayAvailabilities = getAvailabilitiesForDay(day.dayKey, day.date);
                const showSlots = dayAvailabilities.length > 0;

                const slotSet = new Set<string>();
                if (showSlots) {
                  dayAvailabilities.forEach((avail) => {
                    generateTimeSlots(avail.startTime, avail.endTime, slotDuration).forEach((slot) => slotSet.add(slot));
                  });
                }
                const slotsForDay = Array.from(slotSet).sort();

                return (
                  <div
                    key={`slots-${day.date}`}
                    className={cn(
                      "border-r border-neutral-100 last:border-r-0 min-h-[500px]",
                      day.isToday ? 'bg-accent-50/10' : day.isPast ? 'bg-neutral-50/30' : 'bg-white'
                    )}
                  >
                    {loadingCalendar ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="w-2 h-2 rounded-full bg-accent-600 animate-ping" />
                      </div>
                    ) : slotsForDay.length === 0 ? (
                      <div className="p-6 text-center">
                        <p className="text-[9px] font-black text-neutral-200 uppercase tracking-widest">Cerrado</p>
                      </div>
                    ) : (
                      <div className="p-3 space-y-2">
                        {slotsForDay.map((slot) => {
                          const booking = findBookingForSlot(day.date, slot);
                          const blocked = findBlockedSlot(day.date, slot);
                          const isPast = isSlotInPast(day.date, slot);
                          const pastClass = isPast ? 'opacity-50' : '';

                          if (booking) {
                            return (
                              <button
                                key={slot}
                                type="button"
                                className={cn(
                                  "w-full text-left px-4 py-4 rounded-2xl bg-info-500 text-white shadow-lg shadow-info-500/25 transition-all cursor-pointer group",
                                  "hover:-translate-y-0.5 hover:shadow-xl",
                                  pastClass
                                )}
                                onClick={() => openBookingModal(booking)}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-black tabular-nums tracking-tight">{slot}</span>
                                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                </div>
                                <p className="text-[10px] font-black uppercase truncate tracking-tight opacity-90 group-hover:opacity-100">
                                  {booking.clientName}
                                </p>
                              </button>
                            );
                          }

                          if (blocked) {
                            return (
                              <button
                                key={slot}
                                onClick={() => openBlockModal(day.date, slot, blocked)}
                                className={cn(
                                  "w-full text-left px-4 py-4 rounded-2xl border border-primary-200 text-primary-700 shadow-sm transition-all",
                                  "hover:-translate-y-0.5 hover:shadow-md",
                                  pastClass
                                )}
                                style={{
                                  backgroundImage:
                                    'repeating-linear-gradient(135deg, #e5e7eb 0, #e5e7eb 10px, #f3f4f6 10px, #f3f4f6 20px)',
                                }}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-black tabular-nums tracking-tight opacity-70">{slot}</span>
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                                </div>
                                <p className="text-[9px] font-black uppercase tracking-tight text-primary-700 truncate">
                                  {blocked.reason || 'BLOQUEADO'}
                                </p>
                              </button>
                            );
                          }

                          return (
                            <div
                              key={slot}
                              className={cn(
                                "group relative w-full p-3 rounded-2xl bg-card border border-neutral-200 transition-all",
                                "hover:-translate-y-0.5 hover:shadow-md",
                                "border-l-4 border-success-500",
                                pastClass
                              )}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-black text-primary-900 tabular-nums tracking-tight">{slot}</span>
                                <div className="w-1.5 h-1.5 rounded-full bg-success-500 opacity-80" />
                              </div>
                              <div className="grid grid-cols-1 gap-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity duration-150">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onRequestBooking({
                                      employeeId: selectedEmployeeId,
                                      serviceId: selectedServiceId,
                                      bookingDate: day.date,
                                      bookingTime: slot,
                                    })
                                  }
                                  className="w-full py-2 bg-accent-50 text-[9px] font-black text-accent-700 uppercase tracking-[0.15em] rounded-lg hover:bg-accent-600 hover:text-white transition-all duration-150 hover:brightness-95"
                                >
                                  Reservar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openBlockModal(day.date, slot)}
                                  className="w-full py-2 bg-primary-50 text-[9px] font-black text-primary-600 uppercase tracking-[0.15em] rounded-lg hover:bg-primary-900 hover:text-white transition-all duration-150 hover:brightness-95"
                                >
                                  Bloquear
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* Modals */}
      {blockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white shadow-2xl rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-primary-100 bg-gradient-to-r from-primary-50 to-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-primary-900">
                    {blockModal.isEdit ? 'Editar Bloqueo' : 'Bloquear Horario'}
                  </h2>
                  <p className="text-sm text-primary-600 mt-0.5">
                    {new Date(blockModal.date + 'T12:00:00').toLocaleDateString('es-ES', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setBlockModal(null)}
                  className="p-2 rounded-lg hover:bg-primary-100 text-primary-400 hover:text-primary-600 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-primary-700 mb-1.5">Inicio</label>
                  <input
                    type="time"
                    value={blockModal.startTime}
                    onChange={(e) => setBlockModal({ ...blockModal, startTime: e.target.value })}
                    className="w-full px-3 py-2.5 border border-primary-200 rounded-lg bg-white text-primary-900 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-primary-700 mb-1.5">Fin</label>
                  <input
                    type="time"
                    value={blockModal.endTime}
                    onChange={(e) => setBlockModal({ ...blockModal, endTime: e.target.value })}
                    className="w-full px-3 py-2.5 border border-primary-200 rounded-lg bg-white text-primary-900 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-primary-700 mb-1.5">Motivo (opcional)</label>
                <input
                  type="text"
                  value={blockModal.reason || ''}
                  onChange={(e) => setBlockModal({ ...blockModal, reason: e.target.value })}
                  placeholder="Ej: Cita médica, descanso..."
                  className="w-full px-3 py-2.5 border border-primary-200 rounded-lg bg-white text-primary-900 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 placeholder:text-primary-400"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-primary-100 bg-primary-50/50 flex gap-3">
              {blockModal.isEdit && (
                <button
                  onClick={handleDeleteBlock}
                  disabled={savingBlock}
                  className="px-4 py-2.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                >
                  Eliminar
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setBlockModal(null)}
                disabled={savingBlock}
                className="px-4 py-2.5 text-sm font-medium text-primary-700 bg-white border border-primary-200 hover:bg-primary-50 rounded-lg transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveBlock}
                disabled={savingBlock}
                className="px-4 py-2.5 text-sm font-medium text-white bg-accent-600 hover:bg-accent-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
              >
                {savingBlock && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                {blockModal.isEdit ? 'Guardar' : 'Bloquear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white shadow-2xl rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-primary-100 bg-gradient-to-r from-primary-50 to-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-primary-900">Reserva</h2>
                  <p className="text-sm text-primary-600 mt-0.5">
                    {new Date(bookingModal.booking.bookingDate + 'T12:00:00').toLocaleDateString('es-ES', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}{' '}
                    • {bookingModal.booking.bookingTime}
                  </p>
                </div>
                <button
                  onClick={() => setBookingModal(null)}
                  className="p-2 rounded-lg hover:bg-primary-100 text-primary-400 hover:text-primary-600 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-primary-50 rounded-lg">
                  <p className="text-[11px] text-primary-600">Cliente</p>
                  <p className="text-sm font-medium text-primary-900 truncate">{bookingModal.booking.clientName}</p>
                </div>
                <div className="p-3 bg-primary-50 rounded-lg">
                  <p className="text-[11px] text-primary-600">Estado</p>
                  <p className="text-sm font-medium text-primary-900 capitalize">{bookingModal.booking.status}</p>
                </div>
              </div>

              {bookingModal.mode === 'view' ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={startReschedule}
                    disabled={bookingModal.booking.status === 'completed' || bookingModal.saving}
                    className="px-4 py-2.5 text-sm font-medium text-white bg-accent-600 hover:bg-accent-700 rounded-lg transition disabled:opacity-50"
                  >
                    Cambiar reserva
                  </button>
                  <button
                    onClick={cancelBookingFromModal}
                    disabled={bookingModal.booking.status === 'completed' || bookingModal.saving}
                    className="px-4 py-2.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  {bookingModal.booking.status === 'completed' && (
                    <p className="text-xs text-primary-500">Esta reserva está completada; no se puede modificar desde el calendario.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-primary-700 mb-1.5">Nueva fecha</label>
                      <input
                        type="date"
                        value={bookingModal.newDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={async (e) => {
                          const newDate = e.target.value;
                          setBookingModal((prev) => (prev ? { ...prev, newDate, newTime: '' } : prev));
                          await loadAvailableSlotsForReschedule(bookingModal.booking, newDate);
                        }}
                        className="w-full px-3 py-2.5 border border-primary-200 rounded-lg bg-white text-primary-900 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-700 mb-1.5">Nueva hora</label>
                      <select
                        value={bookingModal.newTime}
                        onChange={(e) => setBookingModal((prev) => (prev ? { ...prev, newTime: e.target.value } : prev))}
                        className="w-full px-3 py-2.5 border border-primary-200 rounded-lg bg-white text-primary-900 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                      >
                        <option value="">Selecciona una hora</option>
                        {bookingModal.slots
                          .filter((s) => s.available)
                          .map((s) => (
                            <option key={s.time} value={s.time}>
                              {s.time}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {bookingModal.loadingSlots ? (
                    <div className="flex items-center gap-2 text-sm text-primary-600">
                      <Loading size="sm" />
                      Cargando horarios...
                    </div>
                  ) : bookingModal.slotsError ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      {bookingModal.slotsError}
                    </div>
                  ) : bookingModal.slots.filter((s) => s.available).length === 0 ? (
                    <div className="p-3 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-700">
                      No hay horarios disponibles para esta fecha.
                    </div>
                  ) : null}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setBookingModal((prev) => (prev ? { ...prev, mode: 'view' } : prev))}
                      disabled={bookingModal.saving}
                      className="px-4 py-2.5 text-sm font-medium text-primary-700 bg-white border border-primary-200 hover:bg-primary-50 rounded-lg transition disabled:opacity-50"
                    >
                      Volver
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={saveRescheduleFromModal}
                      disabled={bookingModal.saving || !bookingModal.newDate || !bookingModal.newTime}
                      className="px-4 py-2.5 text-sm font-medium text-white bg-accent-600 hover:bg-accent-700 rounded-lg transition disabled:opacity-50"
                    >
                      Guardar cambios
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
