'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  getAvailability,
  getBlockedSlots,
  getBookings,
  getEmployees,
  getEmployeeServices,
  getServices,
  getService,
  getClients,
  createBlockedSlot,
  updateBlockedSlot,
  deleteBlockedSlot,
  updateBooking,
} from '@/shared/lib/firestore';
import { sendEmployeeNotification } from '@/shared/lib/email';
import { Loading } from '@/shared/components/Loading';
import { PaymentMethodModal } from '@/shared/components/PaymentMethodModal';
import { addMinutesToTime, generateTimeSlots, formatDate, formatTime, formatCurrency, cn } from '@/shared/lib/utils';
import { ClosingSaleModal } from '@/shared/components/ClosingSaleModal';
import { calculateBookingTotals } from '@/shared/lib/booking-utils';
import type {
  Availability,
  BlockedSlot,
  Booking,
  Client,
  DayOfWeek,
  Employee,
  Service,
  TimeSlot,
  BookingFormData,
  PaymentMethod,
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
  const diff = day === 0 ? -6 : 1 - day; // move to Monday
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

// Check if a slot is in the past
const isSlotInPast = (date: string, time: string): boolean => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // If date is before today, it's in the past
  if (date < today) return true;
  
  // If date is today, check the time
  if (date === today) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const slotMinutes = minutesFromTime(time);
    return slotMinutes <= currentMinutes;
  }
  
  return false;
};

// Check if a booking (date + time) is in the future (local time)
const isBookingInFuture = (bookingDate: string, bookingTime: string): boolean => {
  const now = new Date();
  const start = new Date(`${bookingDate}T${bookingTime}:00`);
  return start.getTime() > now.getTime();
};

// Check if entire day is in the past
const isDayInPast = (date: string): boolean => {
  const today = new Date().toISOString().split('T')[0];
  return date < today;
};

const getBookingStatusLabel = (status: Booking['status']) => {
  switch (status) {
    case 'confirmed':
      return 'CONFIRMADA';
    case 'completed':
      return 'LISTA';
    case 'pending':
      return 'PENDIENTE';
    case 'cancelled':
      return 'BAJA';
    default:
      return status.toUpperCase();
  }
};

const getCreatedByLabel = (booking: Booking) => {
  const createdName = booking.createdByName?.trim();
  const clientName = booking.clientName?.trim();
  const normalizedCreated = createdName?.toLowerCase();
  const normalizedClient = clientName?.toLowerCase();
  const isClientMatch = Boolean(
    normalizedCreated && normalizedClient && normalizedCreated === normalizedClient
  );

  let roleLabel: 'Cliente' | 'Equipo';
  if (booking.createdByRole === 'client' || isClientMatch) {
    roleLabel = 'Cliente';
  } else if (booking.createdByRole === 'owner' || booking.createdByRole === 'employee') {
    roleLabel = 'Equipo';
  } else if (createdName) {
    roleLabel = 'Equipo';
  } else if (booking.paymentStatus === 'pending' && !booking.depositPaid) {
    roleLabel = 'Equipo';
  } else {
    roleLabel = 'Cliente';
  }

  const displayName = createdName || (roleLabel === 'Cliente' ? clientName : undefined);
  return displayName ? `${displayName} (${roleLabel})` : roleLabel;
};

const getPaymentLabel = (booking: Booking) => {
  if (booking.paymentStatus === 'paid' || booking.depositPaid) return 'Pagado';
  if (booking.paymentStatus === 'refunded') return 'Reembolsado';
  if (booking.paymentStatus === 'failed') return 'Fallido';
  return 'Pendiente';
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

type ClientSuggestion = {
  key: string;
  name: string;
  email: string;
  phone: string;
};

const buildClientKey = (name: string, email: string, phone: string) => {
  if (email) return email.toLowerCase();
  const normalizedName = name.trim().toLowerCase();
  if (normalizedName && phone) return `${normalizedName}|${phone}`;
  if (normalizedName) return normalizedName;
  return phone;
};

const buildClientDirectory = (bookingsData: Booking[]): ClientSuggestion[] => {
  const clientMap = new Map<string, ClientSuggestion>();

  bookingsData.forEach((booking) => {
    const name = booking.clientName?.trim() || '';
    const email = booking.clientEmail?.trim() || '';
    const phone = booking.clientPhone?.trim() || '';
    const key = buildClientKey(name, email, phone);
    if (!key) return;
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        key,
        name,
        email,
        phone,
      });
    }
  });

  return Array.from(clientMap.values()).sort((a, b) => {
    const aLabel = a.name || a.email || a.phone;
    const bLabel = b.name || b.email || b.phone;
    return aLabel.localeCompare(bLabel);
  });
};

const buildClientDirectoryFromProfiles = (clientsData: Client[]): ClientSuggestion[] => {
  const clientMap = new Map<string, ClientSuggestion>();

  clientsData.forEach((client) => {
    const name = `${client.firstName || ''} ${client.lastName || ''}`.trim();
    const email = client.email?.trim() || '';
    const phone = client.phone?.trim() || '';
    const key = buildClientKey(name, email, phone);
    if (!key) return;
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        key,
        name,
        email,
        phone,
      });
    }
  });

  return Array.from(clientMap.values()).sort((a, b) => {
    const aLabel = a.name || a.email || a.phone;
    const bLabel = b.name || b.email || b.phone;
    return aLabel.localeCompare(bLabel);
  });
};

const mergeClientDirectories = (primary: ClientSuggestion[], secondary: ClientSuggestion[]) => {
  const map = new Map<string, ClientSuggestion>();
  primary.forEach((client) => map.set(client.key, client));
  secondary.forEach((client) => {
    if (!map.has(client.key)) {
      map.set(client.key, client);
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    const aLabel = a.name || a.email || a.phone;
    const bLabel = b.name || b.email || b.phone;
    return aLabel.localeCompare(bLabel);
  });
};

export default function EmployeeCalendarPage() {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [clientDirectory, setClientDirectory] = useState<ClientSuggestion[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [calendarStartDate, setCalendarStartDate] = useState<string>(() => getStartOfWeek());
  const [busySlotId, setBusySlotId] = useState<string | null>(null);
  const [blockModal, setBlockModal] = useState<BlockModalData>(null);
  const [savingBlock, setSavingBlock] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [bookingModal, setBookingModal] = useState<BookingModalData>(null);
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [bookingForm, setBookingForm] = useState<BookingFormData>({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    serviceId: '',
    employeeId: '',
    bookingDate: '',
    bookingTime: '',
    notes: '',
  });
  const [bookingSlots, setBookingSlots] = useState<TimeSlot[]>([]);
  const [loadingBookingSlots, setLoadingBookingSlots] = useState(false);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [bookingToMarkPaid, setBookingToMarkPaid] = useState<Booking | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [newBookingNeedsPayment, setNewBookingNeedsPayment] = useState(false);
  const [showClosingSaleModal, setShowClosingSaleModal] = useState(false);

  // Update current time every minute for accurate "past" calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch available slots for new booking
  useEffect(() => {
    if (bookingForm.employeeId && bookingForm.serviceId && bookingForm.bookingDate) {
      const fetchSlots = async () => {
        setLoadingBookingSlots(true);
        try {
          const params = new URLSearchParams({
            employeeId: bookingForm.employeeId,
            serviceId: bookingForm.serviceId,
            date: bookingForm.bookingDate,
            isStaffBooking: 'true',
          });
          const res = await fetch(`/api/slots/available?${params.toString()}`);
          const json = await res.json();
          if (json.success) {
            setBookingSlots(json.data.slots || []);
          }
        } catch (error) {
          console.error('Error fetching slots:', error);
        } finally {
          setLoadingBookingSlots(false);
        }
      };
      fetchSlots();
    }
  }, [bookingForm.employeeId, bookingForm.serviceId, bookingForm.bookingDate]);

  const clientMatches = useMemo(() => {
    const term = bookingForm.clientName.trim().toLowerCase();
    
    // If no search term, show recent 10 clients
    if (term.length === 0) {
      return clientDirectory.slice(0, 10);
    }
    
    // If search term is less than 2 chars, still show matches
    return clientDirectory
      .filter((client) => {
        const name = client.name.toLowerCase();
        const email = client.email.toLowerCase();
        const phone = client.phone || '';
        return name.includes(term) || email.includes(term) || phone.includes(term);
      })
      .slice(0, 10);
  }, [bookingForm.clientName, clientDirectory]);

  const handleSelectClient = (client: ClientSuggestion) => {
    setBookingForm((prev) => ({
      ...prev,
      clientName: client.name || client.email || prev.clientName,
      clientEmail: client.email || '',
      clientPhone: client.phone || '',
    }));
    setClientSearchOpen(false);
  };

  const openNewBooking = (defaults: Partial<BookingFormData>) => {
    if (defaults.bookingDate && defaults.bookingTime && isSlotInPast(defaults.bookingDate, defaults.bookingTime)) {
      alert('No puedes reservar en un horario pasado.');
      return;
    }
    setBookingForm({
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      serviceId: defaults.serviceId || selectedServiceId || '',
      employeeId: employee?.id || '',
      bookingDate: defaults.bookingDate || '',
      bookingTime: defaults.bookingTime || '',
      notes: '',
    });
    setNewBookingOpen(true);
    setClientSearchOpen(false);
  };

  const handleCreateBooking = async () => {
    if (!bookingForm.clientName || !bookingForm.serviceId || !bookingForm.bookingDate || !bookingForm.bookingTime) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }
    if (isSlotInPast(bookingForm.bookingDate, bookingForm.bookingTime)) {
      alert('No puedes crear una reserva en el pasado.');
      return;
    }

    // Show payment modal first
    setNewBookingNeedsPayment(true);
    setShowPaymentMethodModal(true);
  };

  const handleConfirmNewBookingPayment = async (paymentMethod: PaymentMethod, adjustedAmount?: number, notes?: string) => {
    setBookingSaving(true);
    setProcessingPayment(true);
    
    try {
      const noPaymentCollected = adjustedAmount === 0;
      
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bookingForm,
          allowUnpaid: noPaymentCollected,
          depositPaid: !noPaymentCollected,
          finalPaymentMethod: noPaymentCollected ? undefined : paymentMethod,
          paymentNotes: notes || undefined,
          createdByRole: user?.role ?? 'employee',
          createdByName: employee ? `${employee.firstName} ${employee.lastName}` : 'Empleado',
          createdByUserId: user?.id,
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (employee && selectedServiceId) {
          await loadCalendarData(employee.id, selectedServiceId, calendarStartDate);
        }
        const clientKey = buildClientKey(
          bookingForm.clientName,
          bookingForm.clientEmail,
          bookingForm.clientPhone
        );
        if (clientKey) {
          setClientDirectory((prev) => {
            if (prev.some((client) => client.key === clientKey)) {
              return prev;
            }
            const next = [
              ...prev,
              {
                key: clientKey,
                name: bookingForm.clientName,
                email: bookingForm.clientEmail,
                phone: bookingForm.clientPhone,
              },
            ];
            return next.sort((a, b) => a.name.localeCompare(b.name));
          });
        }
        setNewBookingOpen(false);
        setShowPaymentMethodModal(false);
        setNewBookingNeedsPayment(false);
      } else {
        alert(json.error || 'Error al crear la reserva');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Error al crear la reserva');
    } finally {
      setBookingSaving(false);
      setProcessingPayment(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        const employees = await getEmployees();
        const foundEmployee = employees.find((e) => e.userId === user.id);
        if (!foundEmployee) return;
        setEmployee(foundEmployee);

        setLoadingClients(true);
        const bookingFilters = foundEmployee.salonId
          ? { salonId: foundEmployee.salonId }
          : { employeeId: foundEmployee.id };
        const [employeeServices, allServices, clientsData, bookingClients] = await Promise.all([
          getEmployeeServices(foundEmployee.id),
          getServices(),
          getClients().catch((error) => {
            console.error('Error fetching clients:', error);
            return [];
          }),
          getBookings(bookingFilters).catch((error) => {
            console.error('Error fetching client suggestions:', error);
            return [];
          }),
        ]);
        const assignedServices = allServices.filter((s) =>
          employeeServices.some((es) => es.serviceId === s.id)
        );
        setServices(assignedServices);
        const clientsFromProfiles = buildClientDirectoryFromProfiles(clientsData);
        const clientsFromBookings = buildClientDirectory(bookingClients);
        setClientDirectory(mergeClientDirectories(clientsFromProfiles, clientsFromBookings));
        setLoadingClients(false);
        const defaultServiceId = assignedServices[0]?.id;
        setSelectedServiceId(defaultServiceId);

        if (defaultServiceId) {
          await Promise.all([
            loadAvailability(foundEmployee.id, defaultServiceId),
            loadCalendarData(foundEmployee.id, defaultServiceId, calendarStartDate),
          ]);
        }
      } catch (error) {
        console.error('Error loading calendar:', error);
      } finally {
        setLoading(false);
        setLoadingClients(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
    if (!startDateValue) return;
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
    if (!employee || !selectedServiceId) return;
    loadAvailability(employee.id, selectedServiceId);
    loadCalendarData(employee.id, selectedServiceId, calendarStartDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceId, calendarStartDate]);

  const changeWeek = (direction: number) => {
    const baseDate = new Date(`${calendarStartDate}T12:00:00`);
    baseDate.setDate(baseDate.getDate() + direction * 7);
    setCalendarStartDate(toInputDate(baseDate));
  };

  const goToToday = () => {
    setCalendarStartDate(getStartOfWeek());
  };

  const selectedService = services.find((service) => service.id === selectedServiceId);
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
        booking.paymentStatus !== 'paid' && // Hide paid bookings from calendar slots
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
    if (!blocked && isSlotInPast(date, startTime)) {
      alert('No puedes bloquear un horario pasado.');
      return;
    }
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
    if (!employee || !selectedServiceId || !blockModal) return;

    if (isSlotInPast(blockModal.date, blockModal.startTime)) {
      alert('No puedes guardar un bloqueo en una fecha u horario pasado.');
      return;
    }
    
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
          employeeId: employee.id,
          serviceId: selectedServiceId,
          date: blockModal.date,
          startTime: blockModal.startTime,
          endTime: blockModal.endTime,
          reason: blockModal.reason || 'Bloqueado',
        });
      }
      await loadCalendarData(employee.id, selectedServiceId, calendarStartDate);
      setBlockModal(null);
    } catch (error) {
      console.error('Error saving block:', error);
      alert('No se pudo guardar el bloqueo');
    } finally {
      setSavingBlock(false);
    }
  };

  const handleDeleteBlock = async () => {
    if (!employee || !selectedServiceId || !blockModal?.blockedSlotId) return;
    
    setSavingBlock(true);
    try {
      await deleteBlockedSlot(blockModal.blockedSlotId);
      await loadCalendarData(employee.id, selectedServiceId, calendarStartDate);
      setBlockModal(null);
    } catch (error) {
      console.error('Error deleting block:', error);
      alert('No se pudo eliminar el bloqueo');
    } finally {
      setSavingBlock(false);
    }
  };

  const handleBookingStatus = async (booking: Booking, newStatus: Booking['status']) => {
    // Guardrails:
    // - Do not allow completing a booking that hasn't happened yet
    if (newStatus === 'completed' && isBookingInFuture(booking.bookingDate, booking.bookingTime)) {
      alert('No puedes marcar como completada una reserva futura. Puedes cancelarla o reprogramarla.');
      return;
    }

    if (newStatus === 'cancelled') {
      try {
        const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'employee' }),
        });
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'No se pudo cancelar la reserva');
        }
        setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: 'cancelled' } : b)));
      } catch (error) {
        console.error('Error cancelling booking:', error);
        alert('No se pudo cancelar la reserva');
      }
      return;
    }

    try {
      await updateBookingWithGuard(booking, {
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date() : undefined,
      });
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, status: newStatus } : b))
      );
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('No se pudo actualizar la reserva');
    }
  };

  const handleMarkPaid = async (booking: Booking) => {
    // Show high-end closing sale modal
    setBookingToMarkPaid(booking);
    setShowClosingSaleModal(true);
  };

  const handleConfirmFinalPayment = async (paymentMethod: PaymentMethod, finalAmount: number, notes: string) => {
    if (!bookingToMarkPaid || !user) return;

    try {
      setProcessingPayment(true);
      
      const isFullPayment = employee?.employmentType === 'employee';
      
      // Get the name of the person closing the sale
      const closedByName = employee 
        ? `${employee.firstName} ${employee.lastName}`.trim()
        : user.email?.split('@')[0] || 'Staff';
      
      if (isFullPayment) {
        await updateBookingWithGuard(bookingToMarkPaid, {
          status: 'completed',
          paymentStatus: 'paid',
          depositPaid: true,
          finalPaymentReceived: true,
          finalPaymentAmount: finalAmount,
          finalPaymentMethod: paymentMethod,
          finalPaymentReceivedAt: new Date(),
          finalPaymentReceivedBy: user.id,
          finalPaymentReceivedByName: closedByName,
          completedBy: user.id,
          completedByName: closedByName,
          completedByRole: user.role,
          completedAt: new Date(),
          paymentNotes: notes || undefined,
        });
        setBookings((prev) => prev.map((b) => 
          b.id === bookingToMarkPaid.id 
            ? { 
                ...b, 
                status: 'completed',
                paymentStatus: 'paid',
                depositPaid: true,
                finalPaymentReceived: true,
                finalPaymentAmount: finalAmount, 
                finalPaymentMethod: paymentMethod,
                completedByName: closedByName,
                paymentNotes: notes || undefined,
              } 
            : b
        ));
      } else {
        await updateBookingWithGuard(bookingToMarkPaid, {
          status: 'completed',
          paymentStatus: 'paid',
          depositPaid: true,
          finalPaymentMethod: paymentMethod,
          finalPaymentReceivedAt: new Date(),
          finalPaymentReceivedBy: user.id,
          finalPaymentReceivedByName: closedByName,
          completedBy: user.id,
          completedByName: closedByName,
          completedByRole: user.role,
          completedAt: new Date(),
          paymentNotes: notes || undefined,
        });
        setBookings((prev) => prev.map((b) => 
          b.id === bookingToMarkPaid.id 
            ? { 
                ...b, 
                status: 'completed',
                paymentStatus: 'paid', 
                depositPaid: true, 
                finalPaymentMethod: paymentMethod,
                completedByName: closedByName,
                paymentNotes: notes || undefined 
              } 
            : b
        ));
      }
      
      setShowClosingSaleModal(false);
      setBookingToMarkPaid(null);
    } catch (error) {
      console.error('Error closing sale:', error);
      alert('No se pudo cerrar la venta');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleConfirmPayment = async (paymentMethod: PaymentMethod, adjustedAmount?: number, notes?: string) => {
    if (!bookingToMarkPaid || !user) return;

    setBookingModal((prev) => (prev ? { ...prev, saving: true } : prev));
    try {
      setProcessingPayment(true);
      
      // Calculate total price
      const selectedService = services.find(s => s.id === bookingToMarkPaid.serviceId);
      const basePrice = selectedService?.price || 0;
      const additionalTotal = (bookingToMarkPaid.additionalServices || []).reduce((sum, item) => sum + item.price, 0);
      const calculatedTotal = basePrice + additionalTotal;
      
      // Use adjusted amount if provided, otherwise use calculated total
      const finalAmount = adjustedAmount !== undefined ? adjustedAmount : calculatedTotal;
      
      // Check employee type
      const isFullPayment = employee?.employmentType === 'employee';
      const noPaymentCollected = adjustedAmount === 0;
      
      if (isFullPayment) {
        await updateBookingWithGuard(bookingToMarkPaid, {
          paymentStatus: noPaymentCollected ? 'pending' : 'paid',
          depositPaid: !noPaymentCollected,
          finalPaymentReceived: !noPaymentCollected,
          finalPaymentAmount: finalAmount,
          finalPaymentMethod: noPaymentCollected ? undefined : paymentMethod,
          finalPaymentReceivedAt: noPaymentCollected ? undefined : new Date(),
          finalPaymentReceivedBy: noPaymentCollected ? undefined : user.id,
          paymentNotes: notes || undefined,
        });
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingToMarkPaid.id 
              ? { 
                  ...b, 
                  paymentStatus: noPaymentCollected ? 'pending' : 'paid', 
                  depositPaid: !noPaymentCollected, 
                  finalPaymentReceived: !noPaymentCollected, 
                  finalPaymentAmount: finalAmount, 
                  finalPaymentMethod: noPaymentCollected ? undefined : paymentMethod,
                  paymentNotes: notes || undefined,
                } 
              : b
          )
        );
        setBookingModal((prev) =>
          prev
            ? {
                ...prev,
                saving: false,
                booking: { 
                  ...prev.booking, 
                  paymentStatus: noPaymentCollected ? 'pending' : 'paid', 
                  depositPaid: !noPaymentCollected, 
                  finalPaymentReceived: !noPaymentCollected, 
                  finalPaymentAmount: finalAmount, 
                  finalPaymentMethod: noPaymentCollected ? undefined : paymentMethod,
                  paymentNotes: notes || undefined,
                },
              }
            : prev
        );
      } else {
        await updateBookingWithGuard(bookingToMarkPaid, {
          paymentStatus: noPaymentCollected ? 'pending' : 'paid',
          depositPaid: !noPaymentCollected,
          finalPaymentMethod: noPaymentCollected ? undefined : paymentMethod,
          paymentNotes: notes || undefined,
        });
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingToMarkPaid.id ? { ...b, paymentStatus: noPaymentCollected ? 'pending' : 'paid', depositPaid: !noPaymentCollected, finalPaymentMethod: noPaymentCollected ? undefined : paymentMethod, paymentNotes: notes || undefined } : b
          )
        );
        setBookingModal((prev) =>
          prev
            ? {
                ...prev,
                saving: false,
                booking: { ...prev.booking, paymentStatus: noPaymentCollected ? 'pending' : 'paid', depositPaid: !noPaymentCollected, finalPaymentMethod: noPaymentCollected ? undefined : paymentMethod, paymentNotes: notes || undefined },
              }
            : prev
        );
      }
      
      setShowPaymentMethodModal(false);
      setBookingToMarkPaid(null);
    } catch (error: any) {
      console.error('Error marking paid:', error);
      alert(error?.message || 'No se pudo marcar como pagado.');
      setBookingModal((prev) => (prev ? { ...prev, saving: false } : prev));
    } finally {
      setProcessingPayment(false);
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
    setBookingModal((prev) => {
      if (!prev) return prev;
      return { ...prev, loadingSlots: true, slotsError: null, slots: [] };
    });
    try {
      const params = new URLSearchParams({
        employeeId: booking.employeeId,
        serviceId: booking.serviceId,
        date,
        isStaffBooking: 'true',
      });
      const res = await fetch(`/api/slots/available?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'No se pudieron cargar los horarios');
      }
      const slots: TimeSlot[] = json.data?.slots || [];
      setBookingModal((prev) => {
        if (!prev) return prev;
        return { ...prev, slots, loadingSlots: false, slotsError: null };
      });
    } catch (e: any) {
      setBookingModal((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          loadingSlots: false,
          slotsError: e?.message || 'No se pudieron cargar los horarios',
          slots: [],
        };
      });
    }
  };

  const updateBookingWithGuard = async (booking: Booking, updates: Partial<Booking>) => {
    if (!user || !employee) {
      throw new Error('Debes iniciar sesión para actualizar la reserva.');
    }
    if (booking.employeeId !== employee.id) {
      throw new Error('Solo el terapeuta asignado puede actualizar esta reserva.');
    }
    await updateBooking(booking.id, updates);
  };

  const startReschedule = async () => {
    if (!bookingModal) return;
    const { booking } = bookingModal;
    // If booking is completed, don't allow changes
    if (booking.status === 'completed') return;
    setBookingModal((prev) => {
      if (!prev) return prev;
      return { ...prev, mode: 'reschedule', newDate: booking.bookingDate, newTime: booking.bookingTime };
    });
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
        body: JSON.stringify({ role: 'employee' }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'No se pudo cancelar la reserva');
      }
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: 'cancelled' } : b)));
      
      // Send cancellation notification (async, don't wait)
      fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'cancellation',
          bookingId: booking.id,
          clientName: booking.clientName,
          clientEmail: booking.clientEmail,
          serviceId: booking.serviceId,
          employeeId: booking.employeeId,
          bookingDate: booking.bookingDate,
          bookingTime: booking.bookingTime,
        }),
      }).catch((err) => console.error('Failed to send notification:', err));
      
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

    // Prevent setting to past
    if (isBookingInFuture(newDate, newTime) === false && (newDate < new Date().toISOString().split('T')[0] || isSlotInPast(newDate, newTime))) {
      alert('No puedes reprogramar a un horario pasado.');
      return;
    }

    setBookingModal((prev) => (prev ? { ...prev, saving: true } : prev));
    try {
      const oldDate = booking.bookingDate;
      const oldTime = booking.bookingTime;
      
      await updateBookingWithGuard(booking, {
        bookingDate: newDate,
        bookingTime: newTime,
        status: 'confirmed',
      });
      setBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id ? { ...b, bookingDate: newDate, bookingTime: newTime, status: 'confirmed' } : b
        )
      );
      
      // Send reschedule notification (async, don't wait)
      fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reschedule',
          bookingId: booking.id,
          clientName: booking.clientName,
          clientEmail: booking.clientEmail,
          serviceId: booking.serviceId,
          employeeId: booking.employeeId,
          oldBookingDate: oldDate,
          oldBookingTime: oldTime,
          newBookingDate: newDate,
          newBookingTime: newTime,
        }),
      }).catch((err) => console.error('Failed to send notification:', err));
      
      setBookingModal(null);
    } catch (e) {
      console.error(e);
      alert('No se pudo reprogramar la reserva');
      setBookingModal((prev) => (prev ? { ...prev, saving: false } : prev));
    }
  };

  // Stats for the week
  const weekStats = useMemo(() => {
    const weekStartDate = new Date(`${calendarStartDate}T00:00:00`);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    weekEndDate.setHours(23, 59, 59, 999);
    const weekStartStr = toInputDate(weekStartDate);
    const weekEndStr = toInputDate(weekEndDate);

    const bookingsInWeek = bookings.filter((b) => {
      const dateTime = new Date(`${b.bookingDate}T${b.bookingTime}`);
      return dateTime >= weekStartDate && dateTime <= weekEndDate;
    });

    const confirmedBookings = bookingsInWeek.filter(
      (b) => b.status === 'confirmed' || b.status === 'completed'
    ).length;

    const pastCount = bookingsInWeek.filter((b) => {
      const dateTime = new Date(`${b.bookingDate}T${b.bookingTime}`);
      return dateTime < currentTime && b.status !== 'cancelled';
    }).length;

    const blockedCount = blockedSlots.filter(
      (blocked) => blocked.date >= weekStartStr && blocked.date <= weekEndStr
    ).length;
    
    let availableCount = 0;
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
          generateTimeSlots(avail.startTime, avail.endTime, slotDuration).forEach((slot) =>
            slotSet.add(slot)
          );
        });
        
        slotSet.forEach((slot) => {
          const booking = findBookingForSlot(dateStr, slot);
          const blocked = findBlockedSlot(dateStr, slot);
          const isPast = isSlotInPast(dateStr, slot);
          
          if (!isPast && !booking && !blocked) {
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

  if (!employee) {
    return <div>Perfil de empleado no encontrado</div>;
  }

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
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
        <div>
          <h1 className="text-5xl font-black text-neutral-900 tracking-tighter uppercase leading-none">Mi Calendario</h1>
          <p className="text-neutral-400 text-[10px] font-black uppercase tracking-[0.3em] mt-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-600 animate-pulse" />
            {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()} •{' '}
            {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={selectedServiceId || ''}
            onChange={(e) => setSelectedServiceId(e.target.value || undefined)}
            className="px-6 py-4 bg-white border border-neutral-200 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] focus:border-accent-600 outline-none cursor-pointer shadow-sm transition-all"
          >
            {services.length === 0 && <option value="">SIN SERVICIOS</option>}
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.serviceName.toUpperCase()} • {service.duration}MIN
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-neutral-100 border-t-4 border-info-500 rounded-[32px] p-8 shadow-[0_1px_3px_rgba(0,0,0,0.1)] group hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all">
          <p className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2">Reservas</p>
          <p className="text-4xl font-black text-neutral-900 tabular-nums">{weekStats.confirmedBookings}</p>
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

      {/* Calendar Container */}
      <div className="bg-white border border-neutral-100 rounded-[48px] shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-neutral-100 bg-neutral-50/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-6">
              <button
                onClick={() => changeWeek(-1)}
                disabled={loadingCalendar}
                className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 text-neutral-400 hover:bg-neutral-900 hover:text-white hover:border-neutral-900 transition-all flex items-center justify-center disabled:opacity-30"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-lg font-black text-neutral-900 uppercase tracking-[0.2em]">{weekRangeLabel}</h2>
              <button
                onClick={() => changeWeek(1)}
                disabled={loadingCalendar}
                className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 text-neutral-400 hover:bg-neutral-900 hover:text-white hover:border-neutral-900 transition-all flex items-center justify-center disabled:opacity-30"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <button
              onClick={goToToday}
              className="px-8 py-3 text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] border-2 border-neutral-100 rounded-xl hover:border-neutral-900 hover:text-neutral-900 transition-all"
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
                    day.isToday ? 'text-accent-600' : day.isPast ? 'text-neutral-200' : 'text-neutral-900'
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
                            const isConsultation = booking.isConsultation === true;
                            return (
                              <button
                                key={slot}
                                type="button"
                                className={cn(
                                  "w-full text-left px-4 py-4 rounded-2xl text-white shadow-lg transition-all cursor-pointer group",
                                  "hover:-translate-y-0.5 hover:shadow-xl",
                                  isConsultation 
                                    ? "bg-emerald-500 shadow-emerald-500/25" 
                                    : "bg-info-500 shadow-info-500/25",
                                  pastClass
                                )}
                                onClick={() => openBookingModal(booking)}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-black tabular-nums tracking-tight">{slot}</span>
                                  <div className="flex items-center gap-1">
                                    {isConsultation && (
                                      <span className="text-[8px] font-black uppercase bg-white/20 px-1.5 py-0.5 rounded">
                                        Consulta
                                      </span>
                                    )}
                                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                  </div>
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
                          
                          if (isPast) {
                            return (
                              <div
                                key={slot}
                                className="relative w-full p-3 rounded-2xl bg-neutral-50 border border-neutral-200 text-neutral-400"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black tabular-nums tracking-tight">{slot}</span>
                                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 opacity-60" />
                                </div>
                                <p className="text-[9px] font-black uppercase tracking-[0.15em] mt-2">Horario pasado</p>
                              </div>
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
                                    openNewBooking({
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

      {/* Block Modal */}
      {blockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white shadow-2xl rounded-[40px] overflow-hidden">
            <div className="px-10 py-8 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-neutral-900 uppercase tracking-tighter">
                    {blockModal.isEdit ? 'Editar Bloqueo' : 'Bloquear Horario'}
                  </h2>
                  <p className="text-[10px] font-black text-accent-600 uppercase tracking-[0.3em] mt-1">
                    {new Date(blockModal.date + 'T12:00:00').toLocaleDateString('es-ES', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long' 
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setBlockModal(null)}
                  className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-400 hover:bg-neutral-900 hover:text-white transition-all flex items-center justify-center"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Inicio</label>
                  <input
                    type="time"
                    value={blockModal.startTime}
                    onChange={(e) => setBlockModal({ ...blockModal, startTime: e.target.value })}
                    className="w-full px-6 py-4 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-bold focus:border-accent-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Fin</label>
                  <input
                    type="time"
                    value={blockModal.endTime}
                    onChange={(e) => setBlockModal({ ...blockModal, endTime: e.target.value })}
                    className="w-full px-6 py-4 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-bold focus:border-accent-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Motivo (opcional)</label>
                <input
                  type="text"
                  value={blockModal.reason || ''}
                  onChange={(e) => setBlockModal({ ...blockModal, reason: e.target.value })}
                  placeholder="EJ: CITA MÉDICA, DESCANSO..."
                  className="w-full px-6 py-4 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-bold focus:border-accent-500 outline-none transition-all uppercase"
                />
              </div>
            </div>

            <div className="px-10 py-8 bg-neutral-50 border-t border-neutral-100 flex gap-4">
              {blockModal.isEdit && (
                <button
                  onClick={handleDeleteBlock}
                  disabled={savingBlock}
                  className="px-6 py-4 text-[10px] font-black text-amber-600 bg-amber-50 hover:bg-amber-600 hover:text-white rounded-2xl transition disabled:opacity-50 uppercase tracking-widest"
                >
                  Eliminar
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setBlockModal(null)}
                disabled={savingBlock}
                className="px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:text-neutral-900 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveBlock}
                disabled={savingBlock}
                className="px-10 py-4 text-[10px] font-black text-white bg-neutral-900 rounded-2xl hover:bg-accent-600 transition disabled:opacity-50 flex items-center gap-3 uppercase tracking-widest"
              >
                {savingBlock && <div className="w-2 h-2 rounded-full bg-white animate-ping" />}
                {blockModal.isEdit ? 'Guardar' : 'Bloquear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal (View/Reschedule) */}
      {bookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white shadow-2xl rounded-[40px] overflow-hidden">
            <div className="px-10 py-8 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-neutral-900 uppercase tracking-tighter">Reserva</h2>
                  <p className="text-[10px] font-black text-accent-600 uppercase tracking-[0.3em] mt-1">
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
                  className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-400 hover:bg-neutral-900 hover:text-white transition-all flex items-center justify-center"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-neutral-50 rounded-[32px]">
                  <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">Cliente</p>
                  <p className="text-lg font-black text-neutral-900 uppercase tracking-tighter truncate">{bookingModal.booking.clientName}</p>
                </div>
                <div className="p-6 bg-neutral-50 rounded-[32px]">
                  <p className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.15em] mb-2">Estado</p>
                  <span
                    className={cn(
                      "inline-flex px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em]",
                      bookingModal.booking.status === 'confirmed'
                        ? 'bg-success-500 text-white'
                        : bookingModal.booking.status === 'cancelled'
                        ? 'bg-accent-500 text-white'
                        : bookingModal.booking.status === 'pending'
                        ? 'bg-warning-500 text-primary-900'
                        : 'bg-primary-200 text-primary-900'
                    )}
                  >
                    {getBookingStatusLabel(bookingModal.booking.status)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-neutral-50 rounded-[32px]">
                  <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">Creada por</p>
                  <p className="text-lg font-black text-neutral-900 uppercase tracking-tighter truncate">
                    {getCreatedByLabel(bookingModal.booking)}
                  </p>
                </div>
                <div className="p-6 bg-neutral-50 rounded-[32px]">
                  <p className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.15em] mb-2">Pago</p>
                  <span
                    className={cn(
                      "inline-flex px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em]",
                      bookingModal.booking.paymentStatus === 'paid' || bookingModal.booking.depositPaid
                        ? 'bg-success-500 text-white'
                        : bookingModal.booking.paymentStatus === 'failed'
                        ? 'bg-accent-500 text-white'
                        : bookingModal.booking.paymentStatus === 'refunded'
                        ? 'bg-primary-200 text-primary-900'
                        : 'bg-warning-500 text-primary-900'
                    )}
                  >
                    {getPaymentLabel(bookingModal.booking)}
                  </span>
                </div>
              </div>

              {bookingModal.mode === 'view' ? (
                (() => {
                  const ownsBooking = bookingModal.booking.employeeId === employee?.id;
                  const isCompleted = bookingModal.booking.status === 'completed';
                  const isSettled =
                    bookingModal.booking.paymentStatus === 'paid' ||
                    bookingModal.booking.depositPaid ||
                    bookingModal.booking.paymentStatus === 'refunded';
                  const canMarkPaid = ownsBooking && !isSettled && bookingModal.booking.status !== 'cancelled';
                  const actionsDisabled = isCompleted || bookingModal.saving || !ownsBooking;
                  return (
                    <div className="flex flex-wrap gap-4">
                      {canMarkPaid && (
                        <button
                          onClick={() => handleMarkPaid(bookingModal.booking)}
                          disabled={bookingModal.saving}
                          className="flex-1 py-5 bg-success-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:brightness-95 transition disabled:opacity-50"
                        >
                          Marcar pagado
                        </button>
                      )}
                      <button
                        onClick={startReschedule}
                        disabled={actionsDisabled}
                        className="flex-1 py-5 bg-neutral-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-accent-600 transition disabled:opacity-50"
                      >
                        Cambiar reserva
                      </button>
                      <button
                        onClick={cancelBookingFromModal}
                        disabled={actionsDisabled}
                        className="flex-1 py-5 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-amber-600 hover:text-white transition disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      {isCompleted && (
                        <p className="w-full text-center text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                          Esta reserva está completada y no se puede modificar.
                        </p>
                      )}
                      {!ownsBooking && !isCompleted && (
                        <p className="w-full text-center text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                          Solo el terapeuta asignado puede modificar esta reserva.
                        </p>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Nueva fecha</label>
                      <input
                        type="date"
                        value={bookingModal.newDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={async (e) => {
                          const newDate = e.target.value;
                          setBookingModal((prev) => (prev ? { ...prev, newDate, newTime: '' } : prev));
                          await loadAvailableSlotsForReschedule(bookingModal.booking, newDate);
                        }}
                        className="w-full px-6 py-4 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-bold focus:border-accent-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Nueva hora</label>
                      <select
                        value={bookingModal.newTime}
                        onChange={(e) => setBookingModal((prev) => (prev ? { ...prev, newTime: e.target.value } : prev))}
                        className="w-full px-6 py-4 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-black focus:border-accent-500 outline-none appearance-none transition-all"
                      >
                        <option value="">SELECCIONA</option>
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
                    <div className="flex items-center justify-center py-4">
                      <div className="w-2 h-2 rounded-full bg-accent-600 animate-ping" />
                    </div>
                  ) : bookingModal.slotsError ? (
                    <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl text-[9px] font-black uppercase tracking-widest text-center">
                      {bookingModal.slotsError}
                    </div>
                  ) : bookingModal.slots.filter((s) => s.available).length === 0 ? (
                    <div className="p-4 bg-neutral-50 text-neutral-400 rounded-2xl text-[9px] font-black uppercase tracking-widest text-center">
                      No hay horarios disponibles para esta fecha.
                    </div>
                  ) : null}

                  <div className="flex gap-4">
                    <button
                      onClick={() => setBookingModal((prev) => (prev ? { ...prev, mode: 'view' } : prev))}
                      disabled={bookingModal.saving}
                      className="flex-1 py-5 bg-neutral-100 text-neutral-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:text-neutral-900 transition"
                    >
                      Volver
                    </button>
                    <button
                      onClick={saveRescheduleFromModal}
                      disabled={bookingModal.saving || !bookingModal.newDate || !bookingModal.newTime}
                      className="flex-1 py-5 bg-neutral-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-accent-600 transition shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
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

      {/* NEW Booking Modal (Agenda manual) */}
      {newBookingOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-900/90 backdrop-blur-xl p-4">
          <div className="w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden border-2 border-white/20">
            <div className="px-12 py-10 flex items-center justify-between border-b border-neutral-100">
              <div>
                <h2 className="text-3xl font-black text-neutral-900 tracking-tighter uppercase">Crear Reserva</h2>
                <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs mt-1">Agenda manual</p>
              </div>
              <button
                onClick={() => setNewBookingOpen(false)}
                className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 hover:bg-neutral-900 hover:text-white transition-all flex items-center justify-center"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-12 space-y-8 max-h-[70vh] overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Nombre</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={bookingForm.clientName}
                      onChange={(e) => {
                        setBookingForm((prev) => ({ ...prev, clientName: e.target.value }));
                        setClientSearchOpen(true);
                      }}
                      onFocus={() => setClientSearchOpen(true)}
                      onBlur={() => setTimeout(() => setClientSearchOpen(false), 150)}
                      className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-bold focus:border-accent-500 transition-all outline-none uppercase"
                      placeholder="CLIENTE"
                    />
                    {clientSearchOpen && (
                      <div className="absolute left-0 right-0 mt-2 rounded-2xl border-2 border-blue-200 bg-white shadow-2xl z-20 overflow-hidden">
                        {loadingClients ? (
                          <div className="px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-widest">
                            Cargando clientes...
                          </div>
                        ) : clientMatches.length === 0 ? (
                          <div className="px-4 py-4 text-center">
                            <p className="text-sm font-bold text-neutral-600">No se encontraron clientes</p>
                            <p className="text-xs text-neutral-400 mt-1">Escribe el nombre completo para crear uno nuevo</p>
                          </div>
                        ) : (
                          <>
                            {bookingForm.clientName.trim().length === 0 && (
                              <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                                  ✨ Clientes Recientes
                                </p>
                              </div>
                            )}
                            {clientMatches.map((client) => {
                            return (
                              <button
                                key={client.key}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectClient(client);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors"
                              >
                                <div className="text-sm font-black text-neutral-900 uppercase tracking-tight">
                                  {client.name || client.email || 'CLIENTE'}
                                </div>
                                <div className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mt-1">
                                  {client.email || '—'}{client.phone ? ` • ${client.phone}` : ''}
                                </div>
                              </button>
                            );
                          })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Email (Opcional)</label>
                  <input
                    type="email"
                    value={bookingForm.clientEmail}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, clientEmail: e.target.value }))}
                    className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-bold focus:border-accent-500 transition-all outline-none uppercase"
                    placeholder="EMAIL"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Teléfono (Opcional)</label>
                  <input
                    type="tel"
                    value={bookingForm.clientPhone}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, clientPhone: e.target.value }))}
                    className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-bold focus:border-accent-500 transition-all outline-none uppercase"
                    placeholder="TELÉFONO"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Servicio</label>
                  <select
                    value={bookingForm.serviceId}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, serviceId: e.target.value, bookingTime: '' }))}
                    className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-black focus:border-accent-500 transition-all outline-none appearance-none"
                  >
                    <option value="">SELECCIONA</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.serviceName.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Fecha</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={bookingForm.bookingDate}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, bookingDate: e.target.value, bookingTime: '' }))}
                    className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-bold focus:border-accent-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Horario</label>
                  <select
                    value={bookingForm.bookingTime}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, bookingTime: e.target.value }))}
                    className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-black focus:border-accent-500 transition-all outline-none appearance-none"
                    disabled={!bookingForm.bookingDate || !bookingForm.serviceId}
                  >
                    <option value="">SELECCIONA</option>
                    {bookingSlots
                      .filter((slot) => slot.available)
                      .map((slot) => (
                        <option key={slot.time} value={slot.time}>
                          {slot.time}
                        </option>
                      ))}
                  </select>
                  {loadingBookingSlots && <p className="text-[10px] font-black text-accent-600 animate-pulse mt-2">CARGANDO HUECOS...</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Notas Especiales</label>
                <textarea
                  value={bookingForm.notes}
                  onChange={(e) => setBookingForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-bold focus:border-accent-500 transition-all outline-none h-32 uppercase"
                  placeholder="OBSERVACIONES..."
                />
              </div>
            </div>

            <div className="px-12 py-8 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-4">
              <button
                onClick={() => setNewBookingOpen(false)}
                className="px-8 py-4 text-sm font-bold text-neutral-400 uppercase tracking-widest hover:text-neutral-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateBooking}
                disabled={bookingSaving || !bookingForm.clientName || !bookingForm.serviceId || !bookingForm.bookingDate || !bookingForm.bookingTime}
                className="px-12 py-4 text-sm font-black text-white bg-neutral-900 rounded-2xl hover:bg-accent-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_10px_24px_rgba(230,57,70,0.2)] uppercase tracking-[0.2em] disabled:opacity-30 disabled:grayscale"
              >
                {bookingSaving ? 'GUARDANDO...' : 'CONFIRMAR RESERVA'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PaymentMethodModal
        isOpen={showPaymentMethodModal}
        onClose={() => {
          setShowPaymentMethodModal(false);
          setBookingToMarkPaid(null);
          setNewBookingNeedsPayment(false);
        }}
        onConfirm={newBookingNeedsPayment ? handleConfirmNewBookingPayment : handleConfirmPayment}
        amount={newBookingNeedsPayment ? (() => {
          const service = services.find(s => s.id === bookingForm.serviceId);
          return (service?.price || 0) * 0.5;
        })() : 0}
        mode={newBookingNeedsPayment ? 'deposit' : 'final'}
        isProcessing={processingPayment || bookingSaving}
        isSelfEmployed={employee?.employmentType === 'self-employed'}
      />

      <ClosingSaleModal
        isOpen={showClosingSaleModal}
        onClose={() => {
          setShowClosingSaleModal(false);
          setBookingToMarkPaid(null);
        }}
        booking={bookingToMarkPaid}
        services={services}
        onConfirm={handleConfirmFinalPayment}
        isProcessing={processingPayment}
      />
    </div>
  );
}
