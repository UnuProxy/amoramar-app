'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getBookings, getEmployees, getServices, updateBooking, getClients, deleteClient, getClientByEmail, deleteBooking } from '@/shared/lib/firestore';
import { updateClient } from '@/shared/lib/firestore';
import { Loading } from '@/shared/components/Loading';
import { cn, formatDate, formatTime } from '@/shared/lib/utils';
import type { Booking, Client, Employee, Service, TimeSlot, PaymentMethod } from '@/shared/lib/types';
import { AdminCalendar } from './AdminCalendar';
import { CurrentBookingPanel } from '@/shared/components/CurrentBookingPanel';
import { PaymentMethodModal } from '@/shared/components/PaymentMethodModal';
import { ClosingSaleModal } from '@/shared/components/ClosingSaleModal';
import { useDelayedRender } from '@/shared/hooks/useDelayedRender';
import { useAuth } from '@/shared/hooks/useAuth';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type TabType = 'overview' | 'clients' | 'bookings' | 'calendar';

interface ClientData {
  name: string;
  email: string;
  phone: string;
  totalBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSpent: number;
  lastBooking?: Booking;
  allBookings: Booking[];
  userId?: string;
  createdAt?: Date;
  isNew?: boolean;
  hairColorNotes?: string;
  hairColorHistory?: Array<{ note: string; date: string; bookingId?: string }>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const parseTab = (value: string | null): TabType => {
    if (value === 'clients' || value === 'bookings' || value === 'calendar') return value;
    return 'overview';
  };
  const [activeTab, setActiveTab] = useState<TabType>(() => parseTab(searchParams?.get('tab') || null));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientSuggestionsOpen, setClientSuggestionsOpen] = useState(false);
  const [clientDeleting, setClientDeleting] = useState(false);
  const [clientNotesSaving, setClientNotesSaving] = useState(false);
  
  // Filters
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [statusFilter, setStatusFilter] = useState<'all' | Booking['status']>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientEmail, setSelectedClientEmail] = useState<string | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const bookingModalShouldRender = useDelayedRender(bookingModalOpen, 220);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showClosingSaleModal, setShowClosingSaleModal] = useState(false);
  const [bookingToMarkPaid, setBookingToMarkPaid] = useState<Booking | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [newBookingNeedsPayment, setNewBookingNeedsPayment] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    serviceId: '',
    employeeId: '',
    bookingDate: '',
    bookingTime: '',
    notes: '',
  });
  const [bookingEmployees, setBookingEmployees] = useState<Employee[]>([]);
  const [bookingSlots, setBookingSlots] = useState<TimeSlot[]>([]);
  const [bookingSlotsLoading, setBookingSlotsLoading] = useState(false);
  const [bookingSlotsError, setBookingSlotsError] = useState<string | null>(null);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [bookingRefreshKey, setBookingRefreshKey] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [actionConfirm, setActionConfirm] = useState<{ booking: Booking; nextStatus: Booking['status'] } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const clientSectionRef = useRef<HTMLDivElement>(null);
  const syncTabToUrl = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams?.toString() || '');
      if (tab === 'overview') {
        params.delete('tab');
      } else {
        params.set('tab', tab);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const getServicePrice = useCallback(
    (serviceId: string) => {
      const service = services.find((s) => s.id === serviceId);
      if (!service) return 0;
      const rawPrice = typeof service.price === 'string' ? service.price : String(service.price ?? 0);
      const numericPrice = parseFloat(rawPrice.replace(/[^\d.-]/g, ''));
      return Number.isFinite(numericPrice) ? numericPrice : 0;
    },
    [services]
  );

  const getCreatedByLabel = useCallback((booking: Booking) => {
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
  }, []);

  const getPaymentLabel = useCallback((booking: Booking) => {
    if (booking.paymentStatus === 'paid' || booking.depositPaid) return 'Paid';
    if (booking.paymentStatus === 'refunded') return 'Refunded';
    if (booking.paymentStatus === 'failed') return 'Failed';
    return 'Pending';
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bookingsData, employeesData, servicesData, clientsData] = await Promise.all([
          getBookings(),
          getEmployees(),
          getServices(),
          getClients(),
        ]);

        setBookings(bookingsData);
        setEmployees(employeesData);
        setServices(servicesData);
        setClients(clientsData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setActiveTab(parseTab(searchParams?.get('tab') || null));
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === 'clients' && selectedClientEmail && clientSectionRef.current) {
      clientSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeTab, selectedClientEmail]);

  useEffect(() => {
    document.body.style.overflow = bookingModalOpen ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [bookingModalOpen]);

  const loadEmployeesForService = async (serviceId: string, preselectId?: string) => {
    try {
      const response = await fetch(`/api/services/${serviceId}/employees`);
      const data = await response.json();
      if (data.success) {
        setBookingEmployees(data.data);
        setBookingForm((prev) => {
          const candidate = preselectId && data.data.some((e: Employee) => e.id === preselectId)
            ? preselectId
            : data.data[0]?.id || '';
          return { ...prev, employeeId: candidate, bookingTime: '' };
        });
      } else {
        setBookingEmployees([]);
      }
    } catch (error) {
      console.error('Error fetching service employees:', error);
      setBookingEmployees([]);
    }
  };

  const loadSlotsForSelection = async (serviceId: string, employeeId: string, date: string) => {
    if (!serviceId || !employeeId || !date) return;
    setBookingSlotsLoading(true);
    setBookingSlotsError(null);
    try {
      const params = new URLSearchParams({ serviceId, employeeId, date, isStaffBooking: 'true' });
      const res = await fetch(`/api/slots/available?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Could not load schedules');
      }
      const slots: TimeSlot[] = json.data?.slots || [];
      setBookingSlots(slots);
      // Auto-select first available slot if none chosen
      const firstAvailable = slots.find((s) => s.available);
      setBookingForm((prev) => ({
        ...prev,
        bookingTime: prev.bookingTime && slots.some((s: TimeSlot) => s.time === prev.bookingTime && s.available)
          ? prev.bookingTime
          : firstAvailable?.time || '',
      }));
    } catch (error: any) {
      setBookingSlots([]);
      setBookingSlotsError(error?.message || 'Error al cargar horarios');
    } finally {
      setBookingSlotsLoading(false);
    }
  };

  useEffect(() => {
    if (!bookingForm.serviceId) {
      setBookingEmployees([]);
      return;
    }
    loadEmployeesForService(bookingForm.serviceId, bookingForm.employeeId || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingForm.serviceId]);

  useEffect(() => {
    if (bookingForm.serviceId && bookingForm.employeeId && bookingForm.bookingDate) {
      loadSlotsForSelection(bookingForm.serviceId, bookingForm.employeeId, bookingForm.bookingDate);
    } else {
      setBookingSlots([]);
      setBookingSlotsError(null);
      setBookingSlotsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingForm.serviceId, bookingForm.employeeId, bookingForm.bookingDate]);

  const openBookingModal = (
    client?: Partial<ClientData>,
    defaults?: { serviceId?: string; employeeId?: string; bookingDate?: string; bookingTime?: string }
  ) => {
    setBookingForm({
      clientName: client?.name || '',
      clientEmail: client?.email || '',
      clientPhone: client?.phone || '',
      serviceId: defaults?.serviceId || '',
      employeeId: defaults?.employeeId || '',
      bookingDate: defaults?.bookingDate || '',
      bookingTime: defaults?.bookingTime || '',
      notes: '',
    });
    setBookingSlots([]);
    setBookingSlotsError(null);
    setBookingModalOpen(true);
    if (defaults?.serviceId) {
      loadEmployeesForService(defaults.serviceId, defaults.employeeId);
    }
  };

  const closeBookingModal = () => {
    setBookingModalOpen(false);
    setBookingSlots([]);
    setBookingSlotsError(null);
    setBookingSlotsLoading(false);
    setBookingSaving(false);
  };

  const handleBookingPatched = (bookingId: string, updates: Partial<Booking>) => {
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, ...updates } : b)));
  };

  const handleBookingSubmit = async () => {
    if (
      !bookingForm.clientName ||
      !bookingForm.clientEmail ||
      !bookingForm.clientPhone ||
      !bookingForm.serviceId ||
      !bookingForm.employeeId ||
      !bookingForm.bookingDate ||
      !bookingForm.bookingTime
    ) {
      alert('Completa todos los datos de la reserva.');
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
      const createdByName = user?.firstName
        ? `${user.firstName} ${user.lastName || ''}`.trim()
        : user?.email || 'Admin';
        
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: bookingForm.serviceId,
          employeeId: bookingForm.employeeId,
          bookingDate: bookingForm.bookingDate,
          bookingTime: bookingForm.bookingTime,
          clientName: bookingForm.clientName,
          clientEmail: bookingForm.clientEmail,
          clientPhone: bookingForm.clientPhone,
          notes: bookingForm.notes || undefined,
          allowUnpaid: noPaymentCollected,
          depositPaid: !noPaymentCollected,
          finalPaymentMethod: noPaymentCollected ? undefined : paymentMethod,
          paymentNotes: notes || undefined,
          createdByRole: user?.role ?? 'owner',
          createdByName,
          createdByUserId: user?.id,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || 'Could not create booking');
      }
      const newBooking: Booking = {
        id: json.data.id,
        salonId: 'default-salon-id',
        employeeId: bookingForm.employeeId,
        serviceId: bookingForm.serviceId,
        clientName: bookingForm.clientName,
        clientEmail: bookingForm.clientEmail,
        clientPhone: bookingForm.clientPhone,
        bookingDate: bookingForm.bookingDate,
        bookingTime: bookingForm.bookingTime,
        status: 'pending',
        requiresDeposit: true,
        depositPaid: !noPaymentCollected,
        paymentStatus: noPaymentCollected ? 'pending' : 'paid',
        finalPaymentMethod: noPaymentCollected ? undefined : paymentMethod,
        createdByRole: user?.role ?? 'owner',
        createdByName,
        createdByUserId: user?.id,
        notes: bookingForm.notes || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setBookings((prev) => [newBooking, ...prev]);
      setBookingRefreshKey((prev) => prev + 1);
      setShowPaymentMethodModal(false);
      setNewBookingNeedsPayment(false);
      closeBookingModal();
    } catch (error: any) {
      console.error('Error creating booking:', error);
      alert(error?.message || 'Could not create booking');
    } finally {
      setBookingSaving(false);
      setProcessingPayment(false);
    }
  };

  // Build client database
  const clientDatabase = useMemo(() => {
    const clientMap = new Map<string, ClientData>();
    const newThreshold = new Date();
    newThreshold.setDate(newThreshold.getDate() - 7);

    clients.forEach((client) => {
      const fullName = `${client.firstName} ${client.lastName}`.trim() || client.email;
      clientMap.set(client.email.toLowerCase(), {
        name: fullName,
        email: client.email,
        phone: client.phone || '',
        userId: client.userId || client.id,
        hairColorNotes: client.hairColorNotes || '',
        totalBookings: 0,
        confirmedBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        totalSpent: 0,
        allBookings: [],
        createdAt: client.createdAt,
        isNew: client.createdAt ? client.createdAt >= newThreshold : false,
      });
    });

    bookings.forEach(booking => {
      const email = booking.clientEmail.toLowerCase();
      const price = getServicePrice(booking.serviceId);

      if (!clientMap.has(email)) {
        clientMap.set(email, {
          name: booking.clientName,
          email: booking.clientEmail,
          phone: booking.clientPhone || '',
          totalBookings: 0,
          confirmedBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
          totalSpent: 0,
          allBookings: [],
          createdAt: booking.createdAt,
        });
      }

      const client = clientMap.get(email)!;
      client.name = client.name || booking.clientName;
      client.phone = client.phone || booking.clientPhone || '';
      client.totalBookings++;
      client.allBookings.push(booking);
      client.createdAt = client.createdAt || booking.createdAt;

      if (booking.status === 'confirmed') {
        client.confirmedBookings++;
        client.totalSpent += price;
      } else if (booking.status === 'completed') {
        client.completedBookings++;
        client.totalSpent += price;
      } else if (booking.status === 'cancelled') {
        client.cancelledBookings++;
      }

      // Track last booking
      if (!client.lastBooking || booking.bookingDate > client.lastBooking.bookingDate) {
        client.lastBooking = booking;
      }
    });

    clientMap.forEach((client, key) => {
      const isRecent = client.createdAt ? client.createdAt >= newThreshold : false;
      const isNew = client.totalBookings === 0 || isRecent;
      clientMap.set(key, { ...client, isNew });
    });

    return Array.from(clientMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [bookings, clients, getServicePrice]);

  // Filter bookings based on selected criteria
  const filteredBookings = useMemo(() => {
    let filtered = [...bookings];
    const today = new Date().toISOString().split('T')[0];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b => 
        b.clientName.toLowerCase().includes(term) ||
        b.clientEmail.toLowerCase().includes(term) ||
        b.clientPhone.includes(term)
      );
    }

    // Employee filter
    if (selectedEmployeeId !== 'all') {
      filtered = filtered.filter(b => b.employeeId === selectedEmployeeId);
    }

    // Hide paid bookings if viewing 'today' or 'week' usually helps keep view tight
    // But for admin, we might want to see them in the history table.
    // However, for the "Active/Upcoming" panels, they should be gone.

    // Date range filter
    if (dateRange === 'today') {
      filtered = filtered.filter(b => b.bookingDate === today);
    } else if (dateRange === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(b => b.bookingDate >= weekAgo.toISOString().split('T')[0]);
    } else if (dateRange === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter(b => b.bookingDate >= monthAgo.toISOString().split('T')[0]);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === statusFilter);
    }

    return filtered.sort((a, b) => {
      if (a.bookingDate !== b.bookingDate) return b.bookingDate.localeCompare(a.bookingDate);
      return b.bookingTime.localeCompare(a.bookingTime);
    });
  }, [bookings, selectedEmployeeId, dateRange, statusFilter, searchTerm]);

  // Calculate analytics
  const analytics = useMemo(() => {
    const confirmedBookings = filteredBookings.filter(b => b.status === 'confirmed');
    const completedBookings = filteredBookings.filter(b => b.status === 'completed');
    const cancelledBookings = filteredBookings.filter(b => b.status === 'cancelled');
    
    // Calculate revenue
    const totalRevenue = [...confirmedBookings, ...completedBookings].reduce((sum, booking) => {
      return sum + getServicePrice(booking.serviceId);
    }, 0);

    // Today's bookings
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = bookings.filter(b => b.bookingDate === today && b.status !== 'cancelled');

    // Employee performance
    const employeeStats = employees.map(emp => {
      const empBookings = bookings.filter(b => b.employeeId === emp.id);
      const empConfirmed = empBookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
      const empCancelled = empBookings.filter(b => b.status === 'cancelled');
      const empRevenue = empConfirmed.reduce((sum, booking) => sum + getServicePrice(booking.serviceId), 0);

      return {
        employee: emp,
        totalBookings: empBookings.length,
        confirmed: empConfirmed.length,
        cancelled: empCancelled.length,
        revenue: empRevenue,
        cancellationRate: empBookings.length > 0 ? (empCancelled.length / empBookings.length * 100) : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    return {
      totalBookings: filteredBookings.length,
      confirmedBookings: confirmedBookings.length,
      completedBookings: completedBookings.length,
      cancelledBookings: cancelledBookings.length,
      totalRevenue,
      todayBookings: todayBookings.length,
      cancellationRate: filteredBookings.length > 0 
        ? (cancelledBookings.length / filteredBookings.length * 100).toFixed(1)
        : '0',
      employeeStats,
    };
  }, [filteredBookings, bookings, employees, getServicePrice]);


  const handleBookingStatusChange = async (bookingId: string, newStatus: Booking['status']) => {
    try {
      await updateBooking(bookingId, { status: newStatus });
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
      setBookingRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('Error al actualizar la reserva');
    }
  };

  const confirmStatusChange = async () => {
    if (!actionConfirm) return;
    try {
      setActionLoading(true);
      await handleBookingStatusChange(actionConfirm.booking.id, actionConfirm.nextStatus);
    } finally {
      setActionLoading(false);
      setActionConfirm(null);
    }
  };

  const handleMarkPaid = async (booking: Booking) => {
    // Show high-end closing sale modal
    setBookingToMarkPaid(booking);
    setShowClosingSaleModal(true);
  };

  const handleConfirmFinalPayment = async (paymentMethod: PaymentMethod, finalAmount: number, notes: string, currentUserId?: string) => {
    if (!bookingToMarkPaid || !user) return;

    try {
      setProcessingPayment(true);
      
      const bookingEmployee = employees.find(e => e.id === bookingToMarkPaid.employeeId);
      const isFullPayment = bookingEmployee?.employmentType === 'employee';
      
      // Automatically use the currently logged-in user
      const closedByUserId = user.id;
      const closingEmployee = employees.find(e => e.userId === user.id);
      const closedByName = closingEmployee 
        ? `${closingEmployee.firstName} ${closingEmployee.lastName}`.trim()
        : user.email?.split('@')[0] || 'Admin';
      const closedByRole = user.role;
      
      if (isFullPayment) {
        await updateBooking(bookingToMarkPaid.id, {
          status: 'completed',
          paymentStatus: 'paid',
          depositPaid: true,
          finalPaymentReceived: true,
          finalPaymentAmount: finalAmount,
          finalPaymentMethod: paymentMethod,
          finalPaymentReceivedAt: new Date(),
          finalPaymentReceivedBy: closedByUserId,
          finalPaymentReceivedByName: closedByName,
          completedBy: closedByUserId,
          completedByName: closedByName,
          completedByRole: closedByRole,
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
        await updateBooking(bookingToMarkPaid.id, {
          status: 'completed',
          paymentStatus: 'paid',
          depositPaid: true,
          finalPaymentMethod: paymentMethod,
          finalPaymentReceivedAt: new Date(),
          finalPaymentReceivedBy: closedByUserId,
          finalPaymentReceivedByName: closedByName,
          completedBy: closedByUserId,
          completedByName: closedByName,
          completedByRole: closedByRole,
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
      
      setBookingRefreshKey((prev) => prev + 1);
      setShowClosingSaleModal(false);
      setBookingToMarkPaid(null);
    } catch (error) {
      console.error('Error closing sale:', error);
      alert('Could not close sale');
    } finally {
      setProcessingPayment(false);
    }
  };

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
  const selectedEmployeeStats = analytics.employeeStats.find(s => s.employee.id === selectedEmployeeId);
  const selectedClient = selectedClientEmail ? clientDatabase.find(c => c.email === selectedClientEmail) : null;
  const selectedClientProfile = selectedClientEmail
    ? clients.find((c) => c.email?.toLowerCase() === selectedClientEmail.toLowerCase())
    : null;

  // Build complete client directory from both Client profiles AND booking records
  const allClientSuggestions = useMemo(() => {
    const clientMap = new Map<string, { name: string; email: string; phone: string; id?: string }>();
    
    // Add clients from Client profiles (registered users)
    clients.forEach((c) => {
      const name = `${c.firstName} ${c.lastName}`.trim();
      const email = c.email.toLowerCase();
      const phone = c.phone || '';
      const key = email || `${name}|${phone}`;
      
      if (key) {
        clientMap.set(key, { id: c.id, name, email, phone });
      }
    });
    
    // Add clients from booking records (walk-ins added by staff)
    bookings.forEach((b) => {
      const name = b.clientName?.trim() || '';
      const email = b.clientEmail?.trim().toLowerCase() || '';
      const phone = b.clientPhone?.trim() || '';
      const key = email || `${name}|${phone}`;
      
      if (key && name && !clientMap.has(key)) {
        clientMap.set(key, { name, email, phone });
      }
    });
    
    return Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, bookings]);

  const clientMatches = useMemo(() => {
    const term = bookingForm.clientName?.trim().toLowerCase();
    
    // If no search term, show recent 10 clients
    if (!term || term.length === 0) {
      return allClientSuggestions.slice(0, 10);
    }
    
    // Filter clients based on search term
    return allClientSuggestions
      .filter((c) => {
        const name = c.name.toLowerCase();
        const email = c.email.toLowerCase();
        const phone = c.phone || '';
        return name.includes(term) || email.includes(term) || phone.includes(term);
      })
      .slice(0, 10);
  }, [bookingForm.clientName, allClientSuggestions]);

  const lookupClientIdImpl = async (email?: string, phone?: string) => {
    if (selectedClient?.userId) return selectedClient.userId;
    if (selectedClientProfile?.id) return selectedClientProfile.id;
    const normalizePhone = (p?: string) => (p || '').replace(/\D/g, '');
      const normalizedPhone = normalizePhone(phone || selectedClientProfile?.phone || selectedClient?.phone);
      const trimmedEmail = (email || selectedClientEmail || selectedClient?.email || '').trim();
      const lowerEmail = trimmedEmail.toLowerCase();

      const findId = (list: Client[]) =>
        list.find(
          (c) =>
            (c.email?.trim().toLowerCase() === lowerEmail && lowerEmail) ||
            (normalizedPhone && normalizePhone(c.phone) === normalizedPhone)
        )?.id;

      let clientId = findId(clients);
      if (clientId) return clientId;

      if (trimmedEmail) {
        const foundExact = await getClientByEmail(trimmedEmail);
        if (foundExact?.id) return foundExact.id;
        if (lowerEmail !== trimmedEmail) {
          const foundLower = await getClientByEmail(lowerEmail);
          if (foundLower?.id) return foundLower.id;
        }
      }

      // As a final fallback refresh clients from Firestore and try again
      const refreshed = await getClients();
      setClients(refreshed);
      clientId = findId(refreshed);
      if (clientId) return clientId;

      // If still not found but we have a trimmed email, try filtering refreshed list by includes
      if (lowerEmail) {
        const looseMatch = refreshed.find((c) => c.email?.trim().toLowerCase() === lowerEmail);
        if (looseMatch?.id) return looseMatch.id;
      }
      return undefined;
  };

  const lookupClientId = lookupClientIdImpl;

  const deleteClientByEmailOrPhone = useCallback(
    async (email?: string, phone?: string) => {
      if (selectedClient?.userId) {
        await deleteClient(selectedClient.userId);
        setClients((prev) => prev.filter((c) => c.id !== selectedClient.userId));
        return true;
      }
      const normalizedEmail = (email || selectedClientEmail || selectedClient?.email || '').trim().toLowerCase();
      const normalizePhone = (p?: string) => (p || '').replace(/\D/g, '');
      const normalizedPhone = normalizePhone(phone || selectedClientProfile?.phone || selectedClient?.phone);
      const list = await getClients();
      const matches = list.filter((c) => {
        const e = c.email?.trim().toLowerCase();
        const p = normalizePhone(c.phone);
        return (normalizedEmail && e === normalizedEmail) || (normalizedPhone && p === normalizedPhone);
      });
      if (matches.length === 0) return false;
      for (const m of matches) {
        await deleteClient(m.id);
      }
      setClients(list.filter((c) => !matches.some((m) => m.id === c.id)));
      return true;
    },
    [selectedClientEmail, selectedClientProfile, selectedClient]
  );

  const cleanupBookingsForContactImpl = async (email?: string, phone?: string) => {
    const normalizePhone = (p?: string) => (p || '').replace(/\D/g, '');
      const targetEmail = (email || selectedClientEmail || selectedClient?.email || '').trim().toLowerCase();
      const targetPhone = normalizePhone(phone || selectedClientProfile?.phone || selectedClient?.phone);
      const bookingsToDelete = bookings.filter((b) => {
        const bookingPhone = normalizePhone(b.clientPhone);
        return (
          (targetEmail && b.clientEmail.toLowerCase() === targetEmail) ||
          (targetPhone && bookingPhone === targetPhone)
        );
      });
      if (bookingsToDelete.length === 0) return;
      for (const bk of bookingsToDelete) {
        try {
          await deleteBooking(bk.id);
        } catch (err) {
          console.error('Error deleting booking for client cleanup:', err);
        }
      }
      setBookings((prev) => prev.filter((b) => !bookingsToDelete.some((del) => del.id === b.id)));
  };

  const cleanupBookingsForContact = cleanupBookingsForContactImpl;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="sm" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 pb-12">
      {/* Header - Modern & Professional */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
        <div>
          <h1 className="text-4xl font-black text-primary-800 tracking-tighter uppercase">
            Control Panel
          </h1>
          <div className="flex items-center gap-3 mt-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-500 shadow-[0_0_10px_rgba(184,155,114,0.5)]" />
            <p className="text-primary-400 text-[10px] font-bold uppercase tracking-[0.4em]">
              Real-Time Activity
            </p>
          </div>
        </div>
        <button
          onClick={() => openBookingModal()}
          className="px-8 py-4 rounded-xl bg-primary-800 text-white text-[10px] font-black shadow-lg shadow-primary-900/10 hover:bg-primary-900 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Booking
        </button>
      </div>

      {/* Main Tabs - Premium Luxury Style */}
      <div className="border-b border-neutral-100">
        <nav className="flex gap-12 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'clients', label: 'Clients' },
            { id: 'bookings', label: 'Bookings' },
            { id: 'calendar', label: 'Calendar' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => syncTabToUrl(tab.id as TabType)}
              className={`pb-5 px-1 text-[10px] font-black tracking-[0.3em] transition-all relative uppercase ${
                activeTab === tab.id
                  ? 'text-accent-600'
                  : 'text-neutral-300 hover:text-neutral-900'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent-600 rounded-full shadow-[0_0_10px_rgba(225,29,72,0.2)]" />
              )}
            </button>
          ))}
        </nav>
      </div>

      <CurrentBookingPanel
        bookings={bookings}
        services={services}
        employees={employees}
        now={currentTime}
        context="admin"
        title="CURRENT APPOINTMENT"
        onMarkPaid={handleMarkPaid}
        onComplete={(booking) => handleBookingStatusChange(booking.id, 'completed')}
        onCancel={(booking) => handleBookingStatusChange(booking.id, 'cancelled')}
      />

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-12">
          {/* Stats Grid - Large Impact Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="relative bg-white border border-neutral-100 border-t-4 border-info-500 rounded-[40px] p-8 shadow-[0_1px_3px_rgba(0,0,0,0.1)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-all group flex flex-col items-center justify-center text-center min-h-[220px]">
              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-4 group-hover:text-info-600 transition-colors">Today</p>
              <div className="flex items-baseline justify-center gap-3 w-full px-4">
                <p className="text-6xl font-black text-neutral-800 tracking-tight leading-none whitespace-nowrap">{analytics.todayBookings}</p>
                <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Bookings</p>
              </div>
            </div>
            <div className="relative bg-white border border-neutral-100 border-t-4 border-success-500 rounded-[40px] p-8 shadow-[0_1px_3px_rgba(0,0,0,0.1)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-all group flex flex-col items-center justify-center text-center min-h-[220px]">
              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-4 group-hover:text-success-600 transition-colors">Confirmed</p>
              <div className="flex items-baseline justify-center gap-3 w-full px-4">
                <p className="text-6xl font-black text-success-600 tracking-tight leading-none whitespace-nowrap">{analytics.confirmedBookings}</p>
                <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Pending</p>
              </div>
            </div>
            <div className="relative bg-white border border-neutral-100 border-t-4 border-primary-200 rounded-[40px] p-8 shadow-[0_1px_3px_rgba(0,0,0,0.1)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-all group flex flex-col items-center justify-center text-center min-h-[220px]">
              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-4 group-hover:text-primary-700 transition-colors">Cancellation Rate</p>
              <div className="flex items-baseline justify-center gap-3 w-full px-4">
                <p className={cn(
                  "text-6xl font-black tracking-tight leading-none whitespace-nowrap",
                  Number(analytics.cancellationRate) > 15 ? 'text-warning-600' : 'text-neutral-800'
                )}>
                  {analytics.cancellationRate}<span className="text-3xl font-black">%</span>
                </p>
              </div>
            </div>
          </div>

          {/* Professional Filter Bar */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-primary-100">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1">
                <label className="block text-[10px] font-black text-primary-400 uppercase tracking-[0.2em] mb-2">Quick Search</label>
                <div className="relative">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="SEARCH CLIENT OR EMAIL..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-primary-50 border border-transparent rounded-xl text-primary-900 text-sm font-bold placeholder:text-primary-300 focus:bg-white focus:border-primary-200 transition-all outline-none uppercase tracking-widest"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 lg:w-[500px]">
                <div>
                  <label className="block text-[10px] font-black text-primary-400 uppercase tracking-[0.2em] mb-2">Employee</label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full px-4 py-3.5 bg-primary-50 border border-transparent rounded-xl text-primary-800 text-[10px] font-black focus:bg-white focus:border-primary-200 transition-all outline-none appearance-none uppercase tracking-[0.1em] cursor-pointer"
                  >
                    <option value="all">ALL</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.firstName.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-primary-400 uppercase tracking-[0.2em] mb-2">Time</label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as any)}
                    className="w-full px-4 py-3.5 bg-primary-50 border border-transparent rounded-xl text-primary-800 text-[10px] font-black focus:bg-white focus:border-primary-200 transition-all outline-none appearance-none uppercase tracking-[0.1em] cursor-pointer"
                  >
                    <option value="today">TODAY</option>
                    <option value="week">7 DAYS</option>
                    <option value="month">MONTH</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-primary-400 uppercase tracking-[0.2em] mb-2">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full px-4 py-3.5 bg-primary-50 border border-transparent rounded-xl text-primary-800 text-[10px] font-black focus:bg-white focus:border-primary-200 transition-all outline-none appearance-none uppercase tracking-[0.1em] cursor-pointer"
                  >
                    <option value="all">ALL</option>
                    <option value="confirmed">CONFIRMED</option>
                    <option value="completed">COMPLETED</option>
                    <option value="pending">PENDING</option>
                    <option value="no-show">NO-SHOW</option>
                    <option value="cancelled">CANCELLED</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Professional Performance Table */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-primary-100">
            <div className="px-8 py-6 border-b border-primary-50 bg-primary-50/30 flex items-center justify-between">
              <h2 className="text-sm font-black text-primary-800 tracking-[0.2em] uppercase">Team Performance</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-primary-50/20">
                    <th className="px-8 py-4 text-left text-[9px] font-black text-primary-400 uppercase tracking-[0.2em]">Therapist</th>
                    <th className="px-8 py-4 text-center text-[9px] font-black text-primary-400 uppercase tracking-[0.2em]">Bookings</th>
                    <th className="px-8 py-4 text-center text-[9px] font-black text-primary-400 uppercase tracking-[0.2em]">Completed</th>
                    <th className="px-8 py-4 text-center text-[9px] font-black text-primary-400 uppercase tracking-[0.2em]">Cancelled</th>
                    <th className="px-8 py-4 text-center text-[9px] font-black text-primary-400 uppercase tracking-[0.2em]">Ratio</th>
                    <th className="px-8 py-4 text-right text-[9px] font-black text-primary-400 uppercase tracking-[0.2em]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {analytics.employeeStats.map((stat) => (
                    <tr key={stat.employee.id} className="hover:bg-primary-50/30 transition-all group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-primary-800 flex items-center justify-center text-white font-black text-sm shadow-md group-hover:scale-105 transition-transform ring-1 ring-primary-100">
                            {stat.employee.profileImage ? (
                              <img src={stat.employee.profileImage} alt="" className="w-full h-full object-cover rounded-xl" />
                            ) : (
                              <span>{stat.employee.firstName[0]}</span>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-black text-primary-900 uppercase tracking-tight">
                              {stat.employee.firstName} {stat.employee.lastName}
                            </div>
                            <div className="text-[9px] font-bold text-primary-400 uppercase tracking-[0.2em] mt-0.5">
                              {stat.employee.position || 'Specialist'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-center text-xl font-black text-neutral-400">{stat.totalBookings}</td>
                      <td className="px-10 py-8 text-center">
                        <span className="text-xl font-black text-accent-600 tracking-tighter">{stat.confirmed}</span>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <span className={`text-xl font-black tracking-tighter ${stat.cancelled > 0 ? 'text-amber-500' : 'text-neutral-200'}`}>{stat.cancelled}</span>
                      </td>
                      <td className="px-10 py-8 text-center text-sm font-black text-neutral-400 tracking-widest">
                        {stat.cancellationRate.toFixed(0)}%
                      </td>
                      <td className="px-10 py-8 text-right">
                        <button
                          onClick={() => setSelectedEmployeeId(stat.employee.id)}
                          className="px-6 py-3 rounded-xl border-2 border-neutral-100 text-[10px] font-black text-neutral-400 hover:border-accent-600 hover:text-accent-600 hover:shadow-lg transition-all uppercase tracking-[0.2em]"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Clients Tab - High End List */}
      {activeTab === 'clients' && (
        <div ref={clientSectionRef} className="space-y-10">
          {selectedClient ? (
            <div className="bg-white border border-neutral-100 rounded-[40px] p-12 shadow-sm space-y-12">
                <div className="flex flex-wrap items-center justify-between gap-8">
                  <button
                    onClick={() => setSelectedClientEmail(null)}
                    className="px-8 py-4 rounded-2xl border-2 border-neutral-100 text-xs font-black text-neutral-400 hover:border-neutral-900 hover:text-neutral-900 transition-all uppercase tracking-[0.2em] flex items-center gap-3"
                  >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                  </svg>
                  Volver
                </button>
                <button
                  onClick={() => openBookingModal(selectedClient)}
                  className="px-10 py-5 text-sm font-black bg-neutral-900 text-white rounded-[20px] hover:bg-accent-600 transition-all shadow-2xl uppercase tracking-[0.2em]"
                >
                  RESERVAR PARA ESTE CLIENTE
                </button>
                <button
                  disabled={clientDeleting}
                  onClick={async () => {
                    const ok = window.confirm('Delete this client? This action cannot be undone.');
                    if (!ok) return;
                    try {
                      setClientDeleting(true);
                      const directId = selectedClientProfile?.id || selectedClient?.userId;
                      const phone: string | undefined = selectedClient?.phone ? selectedClient.phone : undefined;
                      let resolved = false;
                      if (directId) {
                        await deleteClient(directId);
                        setClients((prev) => prev.filter((c) => c.id !== directId));
                        // @ts-ignore - phone is correctly typed but TS has inference bug with null vs undefined
                        await cleanupBookingsForContact(selectedClientEmail, phone);
                        resolved = true;
                      }
                      if (!resolved) {
                        // @ts-ignore - phone is correctly typed but TS has inference bug with null vs undefined
                        const clientId = await lookupClientId(selectedClientEmail, phone);
                        if (clientId) {
                          await deleteClient(clientId);
                          setClients((prev) => prev.filter((c) => c.id !== clientId));
                          // @ts-ignore - phone is correctly typed but TS has inference bug with null vs undefined
                          await cleanupBookingsForContact(selectedClientEmail, phone);
                          resolved = true;
                        }
                      }
                      if (!resolved) {
                        // @ts-ignore - phone is correctly typed but TS has inference bug with null vs undefined
                        const deleted = await deleteClientByEmailOrPhone(selectedClientEmail, selectedClient?.phone || undefined);
                        if (!deleted) {
                          const normalizePhone = (p?: string) => (p || '').replace(/\D/g, '');
                          const targetEmail = (selectedClientEmail || selectedClient?.email || '').trim().toLowerCase();
                          // @ts-ignore - phone is correctly typed but TS has inference bug with null vs undefined
                          const targetPhone = normalizePhone(selectedClient?.phone || undefined);
                          await cleanupBookingsForContact(targetEmail, targetPhone);
                          resolved = true; // Even if none found, we attempted cleanup
                        }
                      }
                      setSelectedClientEmail(null);
                    } catch (error) {
                      console.error('Error deleting client:', error);
                      alert('Could not delete client.');
                    } finally {
                      setClientDeleting(false);
                    }
                  }}
                  className="px-10 py-5 text-sm font-black bg-accent-600 text-white rounded-[20px] hover:bg-accent-700 transition-all shadow-2xl uppercase tracking-[0.2em] disabled:opacity-50"
                >
                  {clientDeleting ? 'ELIMINANDO...' : 'ELIMINAR CLIENTE'}
                </button>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-10 pb-12 border-b border-neutral-100">
                <div className="w-40 h-40 rounded-[48px] bg-neutral-900 flex items-center justify-center text-white text-6xl font-black uppercase shadow-2xl ring-8 ring-neutral-50">
                  {selectedClient.name[0]}
                </div>
                <div className="text-center md:text-left space-y-3">
                  <h2 className="text-6xl font-black text-neutral-900 tracking-tighter uppercase leading-none">{selectedClient.name}</h2>
                  {selectedClient.isNew && (
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-50 text-accent-600 text-[10px] font-black uppercase tracking-[0.2em]">
                      <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
                      Nuevo cliente
                    </span>
                  )}
                  <div className="flex flex-wrap justify-center md:justify-start gap-6 pt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-600" />
                      <span className="text-sm font-black text-neutral-400 uppercase tracking-widest">{selectedClient.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                      <span className="text-sm font-black text-neutral-400 uppercase tracking-widest">{selectedClient.phone}</span>
                    </div>
                    {selectedClientProfile?.city && (
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                        <span className="text-sm font-black text-neutral-400 uppercase tracking-widest">
                          {selectedClientProfile.city}
                          {selectedClientProfile.address ? ` · ${selectedClientProfile.address}` : ''}
                        </span>
                      </div>
                    )}
                    {selectedClientProfile?.createdAt && (
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                        <span className="text-sm font-black text-neutral-400 uppercase tracking-widest">
                          Cliente desde: {new Date(selectedClientProfile.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {selectedClientProfile && (
                      <div className="space-y-3 pt-4">
                        <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Color / Tinete usado</label>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <textarea
                            value={selectedClientProfile.hairColorNotes || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setClients((prev) =>
                                prev.map((c) =>
                                  c.id === selectedClientProfile.id ? { ...c, hairColorNotes: value } : c
                                )
                              );
                            }}
                            className="flex-1 w-full px-4 py-3 bg-neutral-50 border-2 border-neutral-100 rounded-[16px] text-neutral-900 font-medium focus:border-accent-500 transition-all outline-none"
                            rows={3}
                            placeholder="E.g. Wella Koleston 6/7 + 6% · Last application 05/01/2026"
                          />
                          <button
                            type="button"
                            disabled={clientNotesSaving}
                            onClick={async () => {
                              if (!selectedClientProfile) return;
                              try {
                                setClientNotesSaving(true);
                                await updateClient(selectedClientProfile.id, {
                                  hairColorNotes: selectedClientProfile.hairColorNotes || '',
                                });
                              } catch (error) {
                                console.error('Error guardando notas de color:', error);
                                alert('Could not save color notes.');
                              } finally {
                                setClientNotesSaving(false);
                              }
                            }}
                            className="px-6 py-3 bg-neutral-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-[14px] hover:bg-accent-600 transition disabled:opacity-60"
                          >
                            {clientNotesSaving ? 'Saving...' : 'Save Color'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="bg-neutral-50 rounded-[32px] p-10 border border-neutral-100 group hover:bg-white hover:shadow-xl transition-all">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] mb-2">Total Visits</p>
                  <p className="text-5xl font-black text-neutral-900 tracking-tighter">{selectedClient.totalBookings}</p>
                </div>
                <div className="bg-neutral-50 rounded-[32px] p-10 border border-neutral-100 group hover:bg-white hover:shadow-xl transition-all">
                  <p className="text-[10px] font-black text-accent-400 uppercase tracking-[0.3em] mb-2">Exitosas</p>
                  <p className="text-5xl font-black text-accent-600 tracking-tighter">{selectedClient.confirmedBookings + selectedClient.completedBookings}</p>
                </div>
                <div className="bg-neutral-50 rounded-[32px] p-10 border border-neutral-100 group hover:bg-white hover:shadow-xl transition-all">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] mb-2">Cancelled</p>
                  <p className="text-5xl font-black text-neutral-900 tracking-tighter">{selectedClient.cancelledBookings}</p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-black text-neutral-900 tracking-tight uppercase">Booking History</h3>
                  <div className="h-px flex-1 bg-neutral-100" />
                </div>
                <div className="grid gap-6">
                  {selectedClient.allBookings.sort((a, b) => b.bookingDate.localeCompare(a.bookingDate)).map(booking => {
                    const employee = employees.find(e => e.id === booking.employeeId);
                    const service = services.find(s => s.id === booking.serviceId);
                    return (
                      <div key={booking.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-8 bg-neutral-50/50 border border-neutral-100 rounded-[32px] hover:bg-white hover:shadow-xl transition-all gap-6">
                        <div className="flex-1 space-y-2">
                          <div className="text-2xl font-black text-neutral-900 uppercase tracking-tight">{service?.serviceName}</div>
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">
                            <span className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-accent-600" />
                              {employee?.firstName}
                            </span>
                            <span className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                              {formatDate(booking.bookingDate)}
                            </span>
                            <span className="text-accent-600 font-black">{formatTime(booking.bookingTime)}</span>
                          </div>
                        </div>
                        <div
                          className={cn(
                            "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm",
                            booking.status === 'confirmed'
                              ? 'bg-success-500 text-white'
                              : booking.status === 'completed'
                              ? 'bg-success-600 text-white'
                              : booking.status === 'pending'
                              ? 'bg-warning-500 text-primary-900'
                              : 'bg-accent-500 text-white'
                          )}
                        >
                          {booking.status === 'confirmed' ? 'CONFIRMED' :
                           booking.status === 'completed' ? 'COMPLETED' :
                           booking.status === 'pending' ? 'PENDING' : 'CANCELLED'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="relative group">
                <svg className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-neutral-400 group-focus-within:text-accent-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="BUSCAR CLIENTE POR NOMBRE, EMAIL O TELÉFONO..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-20 pr-8 py-8 bg-white border border-neutral-100 rounded-[40px] text-2xl font-black uppercase tracking-tight text-neutral-900 focus:border-accent-600 focus:shadow-2xl transition-all outline-none shadow-sm placeholder:text-neutral-200"
                />
              </div>

              <div className="bg-white border border-neutral-100 rounded-[48px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-neutral-50/50">
                        <th className="px-10 py-8 text-left text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Cliente</th>
                        <th className="px-10 py-8 text-center text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Bookings</th>
                        <th className="px-10 py-8 text-center text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Última Visita</th>
                        <th className="px-10 py-8 text-right text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {clientDatabase
                        .filter(client => 
                          !searchTerm || 
                          client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          client.phone.includes(searchTerm)
                        )
                        .map(client => (
                          <tr key={client.email} className="hover:bg-neutral-50 transition-all group">
                            <td className="px-10 py-10">
                              <div className="flex items-center gap-6">
                              <div className="w-16 h-16 rounded-[24px] bg-neutral-900 flex items-center justify-center text-white text-2xl font-black uppercase group-hover:scale-110 transition-transform">
                                {client.name[0]}
                              </div>
                              <div>
                                <div className="flex items-center gap-3 flex-wrap">
                                  <div className="text-2xl font-black text-neutral-900 uppercase tracking-tighter">{client.name}</div>
                                  {client.isNew && (
                                    <span className="px-3 py-1 rounded-full bg-accent-50 text-accent-600 text-[10px] font-black uppercase tracking-[0.2em]">
                                      Nuevo
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mt-1">{client.phone || '—'}</div>
                              </div>
                            </div>
                          </td>
                            <td className="px-10 py-10 text-center">
                              <div className="text-3xl font-black text-neutral-900 tracking-tighter">{client.totalBookings}</div>
                              <div className="text-[10px] font-black text-accent-600 uppercase tracking-[0.3em] mt-1">HISTÓRICO</div>
                            </td>
                            <td className="px-10 py-10 text-center">
                              <div className="text-lg font-black text-neutral-400 uppercase tracking-tight">
                                {client.lastBooking ? formatDate(client.lastBooking.bookingDate) : '—'}
                              </div>
                            </td>
                            <td className="px-10 py-10 text-right">
                              <div className="flex justify-end gap-4">
                                <button
                                  onClick={() => setSelectedClientEmail(client.email)}
                                  className="px-8 py-4 rounded-2xl border-2 border-neutral-100 text-[10px] font-black text-neutral-400 hover:border-neutral-900 hover:text-neutral-900 transition-all uppercase tracking-[0.2em]"
                                >
                                  Profile
                                </button>
                                <button
                                  onClick={() => openBookingModal(client)}
                                  className="px-8 py-4 rounded-2xl bg-neutral-900 text-white text-[10px] font-black hover:bg-accent-600 transition-all uppercase tracking-[0.2em] shadow-xl"
                                >
                                  Reservar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Bookings Tab - High End List */}
      {activeTab === 'bookings' && (
        <div className="space-y-10">
          <div className="bg-neutral-900 rounded-[40px] p-8 shadow-2xl border border-white/5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="md:col-span-1">
                <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-3">Buscar</label>
                <input
                  type="text"
                  placeholder="CLIENTE..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-6 py-5 bg-white/5 border border-white/10 rounded-2xl text-white text-sm font-bold focus:border-accent-600 transition-all outline-none uppercase tracking-widest"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-3">Therapist</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full px-6 py-5 bg-white/5 border border-white/10 rounded-2xl text-white text-xs font-black focus:border-accent-600 transition-all outline-none appearance-none uppercase tracking-[0.2em]"
                >
                  <option value="all" className="bg-neutral-900">ALL</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id} className="bg-neutral-900">{emp.firstName.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-3">Tiempo</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as any)}
                  className="w-full px-6 py-5 bg-white/5 border border-white/10 rounded-2xl text-white text-xs font-black focus:border-accent-600 transition-all outline-none appearance-none uppercase tracking-[0.2em]"
                >
                  <option value="today" className="bg-neutral-900">TODAY</option>
                  <option value="week" className="bg-neutral-900">7 DAYS</option>
                  <option value="month" className="bg-neutral-900">MONTH</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-3">Estado</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-6 py-5 bg-white/5 border border-white/10 rounded-2xl text-white text-xs font-black focus:border-accent-600 transition-all outline-none appearance-none uppercase tracking-[0.2em]"
                >
                  <option value="all" className="bg-neutral-900">ALL</option>
                  <option value="confirmed" className="bg-neutral-900">CONFIRMED</option>
                  <option value="completed" className="bg-neutral-900">COMPLETED</option>
                  <option value="pending" className="bg-neutral-900">PENDING</option>
                  <option value="cancelled" className="bg-neutral-900">CANCELLED</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white border border-neutral-100 rounded-[48px] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50/50">
                    <th className="px-10 py-8 text-left text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Date / Time</th>
                    <th className="px-10 py-8 text-left text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Cliente</th>
                    <th className="px-10 py-8 text-left text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Service</th>
                    <th className="px-10 py-8 text-center text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Estado</th>
                    <th className="px-10 py-8 text-right text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredBookings.map((booking) => {
                    const employee = employees.find(e => e.id === booking.employeeId);
                    const service = services.find(s => s.id === booking.serviceId);
                    
                    return (
                      <tr key={booking.id} className="hover:bg-neutral-50 transition-all group">
                        <td className="px-10 py-10">
                          <div className="text-2xl font-black text-accent-600 tabular-nums leading-none mb-1">{formatTime(booking.bookingTime)}</div>
                          <div className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">{formatDate(booking.bookingDate)}</div>
                        </td>
                        <td className="px-10 py-10">
                          <div className="text-xl font-black text-neutral-900 uppercase tracking-tighter">{booking.clientName}</div>
                          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">{booking.clientPhone}</div>
                          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.15em] mt-1">
                            Creada por: {getCreatedByLabel(booking)}
                          </div>
                          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.15em] mt-2 flex items-center gap-2">
                            Pago:
                            <span
                              className={cn(
                                "px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.15em]",
                                booking.paymentStatus === 'paid' || booking.depositPaid
                                  ? 'bg-success-500 text-white'
                                  : booking.paymentStatus === 'failed'
                                  ? 'bg-accent-500 text-white'
                                  : booking.paymentStatus === 'refunded'
                                  ? 'bg-primary-200 text-primary-900'
                                  : 'bg-warning-500 text-primary-900'
                              )}
                            >
                              {getPaymentLabel(booking)}
                            </span>
                          </div>
                        </td>
                        <td className="px-10 py-10">
                          <div className="text-lg font-black text-neutral-700 uppercase tracking-tight leading-none mb-1">{service?.serviceName}</div>
                          <div className="text-[10px] font-black text-accent-400 uppercase tracking-[0.2em]">{employee?.firstName}</div>
                        </td>
                        <td className="px-10 py-10 text-center">
                          <span
                            className={cn(
                              "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm",
                              booking.status === 'confirmed'
                                ? 'bg-success-500 text-white'
                                : booking.status === 'completed'
                                ? 'bg-success-600 text-white'
                                : booking.status === 'pending'
                                ? 'bg-warning-500 text-primary-900'
                                : 'bg-accent-500 text-white'
                          )}
                          >
                            {booking.status === 'confirmed' ? 'CONFIRMADA' :
                             booking.status === 'completed' ? 'LISTA' :
                             booking.status === 'pending' ? 'PENDIENTE' : 'BAJA'}
                          </span>
                        </td>
                        <td className="px-10 py-10 text-right">
                          <div className="flex justify-end gap-3">
                            <Link href={`/dashboard/bookings/${booking.id}`}>
                              <button className="w-12 h-12 bg-neutral-50 text-neutral-400 rounded-[18px] hover:bg-neutral-900 hover:text-white hover:scale-110 transition-all flex items-center justify-center shadow-lg shadow-neutral-100">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            </Link>
                            <button
                              onClick={() => {
                                setSelectedClientEmail(booking.clientEmail);
                                syncTabToUrl('clients');
                              }}
                              className="px-4 h-12 bg-white border border-neutral-200 rounded-[14px] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-neutral-900 hover:text-white transition-all shadow-sm"
                            >
                              View client
                            </button>
                            {booking.status === 'confirmed' && (
                              <>
                                <button
                                  onClick={() => setActionConfirm({ booking, nextStatus: 'completed' })}
                                  className="w-12 h-12 bg-success-50 text-success-700 rounded-[18px] hover:bg-success-600 hover:text-white hover:scale-110 transition-all flex items-center justify-center shadow-lg"
                                >
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setActionConfirm({ booking, nextStatus: 'cancelled' })}
                                  className="w-12 h-12 bg-warning-50 text-warning-700 rounded-[18px] hover:bg-accent-500 hover:text-white hover:scale-110 transition-all flex items-center justify-center shadow-lg"
                                >
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Tab - Modern Admin View */}
      {activeTab === 'calendar' && (
        <div className="bg-white border-2 border-neutral-100 rounded-[40px] p-8 shadow-sm">
          <AdminCalendar
            employees={employees}
            services={services}
            refreshKey={bookingRefreshKey}
            onRequestBooking={(defaults) =>
              openBookingModal(undefined, {
                serviceId: defaults.serviceId,
                employeeId: defaults.employeeId,
                bookingDate: defaults.bookingDate,
                bookingTime: defaults.bookingTime,
              })
            }
            onBookingPatched={handleBookingPatched}
          />
        </div>
      )}

      {/* Booking Modal - Clean & Focused */}
      {bookingModalShouldRender && (
        <div
          className={cn(
            'fixed inset-0 z-[100] flex items-center justify-center bg-neutral-900/90 backdrop-blur-xl p-4 transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
            bookingModalOpen ? 'opacity-100' : 'opacity-0'
          )}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={cn(
              'w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden border-2 border-white/20 transform transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
              bookingModalOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-3 scale-[0.97]'
            )}
          >
            <div className="px-12 py-10 flex items-center justify-between border-b border-neutral-100">
              <div>
                <h2 className="text-3xl font-black text-neutral-900 tracking-tighter uppercase">Create Booking</h2>
                <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs mt-1">Manual Schedule</p>
              </div>
              <button
                onClick={closeBookingModal}
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
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={bookingForm.clientName}
                      onChange={(e) => {
                        const value = e.target.value;
                        setBookingForm((prev) => ({ ...prev, clientName: value }));
                        setClientSuggestionsOpen(true);
                      }}
                      onFocus={() => setClientSuggestionsOpen(true)}
                      onBlur={() => setTimeout(() => setClientSuggestionsOpen(false), 120)}
                      className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-bold focus:border-accent-500 transition-all outline-none"
                      placeholder="CLIENTE"
                    />
                    {clientSuggestionsOpen && (
                      <div className="absolute z-10 mt-2 w-full bg-white border-2 border-blue-200 rounded-2xl shadow-2xl overflow-hidden">
                        {clientMatches.length === 0 ? (
                          <div className="px-4 py-4 text-center">
                            <p className="text-sm font-bold text-neutral-600">No clients found</p>
                            <p className="text-xs text-neutral-400 mt-1">Escribe el nombre completo para crear uno nuevo</p>
                          </div>
                        ) : (
                          <>
                            {(!bookingForm.clientName || bookingForm.clientName.trim().length === 0) && (
                              <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                                  ✨ Recent Clients
                                </p>
                              </div>
                            )}
                            {clientMatches.map((c, idx) => {
                              const displayName = c.name || c.email;
                              return (
                                <button
                                  key={c.id || `${c.email}-${idx}`}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setBookingForm((prev) => ({
                                      ...prev,
                                      clientName: displayName,
                                      clientEmail: c.email,
                                      clientPhone: c.phone || '',
                                    }));
                                    setClientSuggestionsOpen(false);
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors"
                                >
                                  <div className="text-sm font-black text-neutral-900 uppercase tracking-tight">
                                    {displayName}
                                  </div>
                                  <div className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mt-1">
                                    {c.email}{c.phone ? ` • ${c.phone}` : ''}
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
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Email</label>
                  <input
                    type="email"
                    value={bookingForm.clientEmail}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, clientEmail: e.target.value }))}
                    className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-bold focus:border-accent-500 transition-all outline-none"
                    placeholder="EMAIL"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Phone</label>
                  <input
                    type="tel"
                    value={bookingForm.clientPhone}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, clientPhone: e.target.value }))}
                    className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-bold focus:border-accent-500 transition-all outline-none"
                    placeholder="PHONE"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Service</label>
                  <select
                    value={bookingForm.serviceId}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, serviceId: e.target.value, employeeId: '', bookingTime: '' }))}
                    className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-black focus:border-accent-500 transition-all outline-none appearance-none"
                  >
                    <option value="">SELECT</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.serviceName.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Therapist</label>
                  <select
                    value={bookingForm.employeeId}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, employeeId: e.target.value, bookingTime: '' }))}
                    className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-black focus:border-accent-500 transition-all outline-none appearance-none"
                    disabled={!bookingForm.serviceId}
                  >
                    <option value="">SELECT</option>
                    {bookingEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={bookingForm.bookingDate}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, bookingDate: e.target.value, bookingTime: '' }))}
                    className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-bold focus:border-accent-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Time</label>
                  <select
                    value={bookingForm.bookingTime}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, bookingTime: e.target.value }))}
                    className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-black focus:border-accent-500 transition-all outline-none appearance-none"
                    disabled={!bookingForm.employeeId || !bookingForm.bookingDate}
                  >
                    <option value="">SELECT</option>
                    {bookingSlots
                      .filter((slot) => slot.available)
                      .map((slot) => (
                        <option key={slot.time} value={slot.time}>
                          {slot.time}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest">Notes (Optional)</label>
                  <textarea
                    value={bookingForm.notes}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full px-6 py-5 bg-neutral-50 border-2 border-neutral-100 rounded-2xl text-neutral-900 font-medium focus:border-accent-500 transition-all outline-none no-scrollbar"
                    placeholder="PREFERENCES OR DETAILS..."
                  />
                </div>
              </div>
            </div>

            <div className="px-12 py-8 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-4">
              <button
                onClick={closeBookingModal}
                className="px-8 py-4 text-sm font-bold text-neutral-400 uppercase tracking-widest hover:text-neutral-900 transition-colors"
                disabled={bookingSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleBookingSubmit}
                className="px-12 py-4 text-sm font-black text-white bg-accent-600 rounded-2xl hover:bg-accent-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_10px_24px_rgba(230,57,70,0.2)] disabled:opacity-50 uppercase tracking-[0.2em]"
                disabled={bookingSaving}
              >
                {bookingSaving ? 'SAVING...' : 'CONFIRM BOOKING'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {actionConfirm && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden">
            <div className="px-8 py-6 border-b border-neutral-100">
              <h3 className="text-xl font-black text-primary-900 uppercase tracking-tight">Confirm Action</h3>
              <p className="text-sm text-neutral-500 mt-2">
                {actionConfirm.nextStatus === 'cancelled'
                  ? 'You are about to cancel this booking. Are you sure?'
                  : 'You are about to mark this booking as completed.'}
              </p>
            </div>
            <div className="px-8 py-6 space-y-3">
              <div className="flex items-center justify-between text-sm text-primary-700">
                <span className="font-bold uppercase tracking-[0.15em]">Cliente</span>
                <span className="font-black text-primary-900">{actionConfirm.booking.clientName}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-primary-700">
                <span className="font-bold uppercase tracking-[0.15em]">Date</span>
                <span className="font-black text-primary-900">{formatDate(actionConfirm.booking.bookingDate)} • {formatTime(actionConfirm.booking.bookingTime)}</span>
              </div>
            </div>
            <div className="px-8 py-6 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setActionConfirm(null)}
                className="px-6 py-3 rounded-xl border border-neutral-200 text-xs font-black uppercase tracking-[0.2em] text-neutral-500 hover:text-neutral-900 hover:border-neutral-900 transition-all"
                disabled={actionLoading}
              >
                Volver
              </button>
              <button
                onClick={confirmStatusChange}
                className={cn(
                  "px-8 py-3 rounded-xl text-xs font-black uppercase tracking-[0.2em] text-white transition-all",
                  actionConfirm.nextStatus === 'cancelled' ? 'bg-accent-600 hover:bg-accent-700' : 'bg-success-600 hover:bg-success-700',
                  actionLoading ? 'opacity-70 cursor-not-allowed' : ''
                )}
                disabled={actionLoading}
              >
                {actionLoading ? 'Applying...' : 'Confirm'}
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
        onConfirm={handleConfirmNewBookingPayment}
        amount={(() => {
          const service = services.find(s => s.id === bookingForm.serviceId);
          return (service?.price || 0) * 0.5;
        })()}
        mode="deposit"
        isProcessing={processingPayment || bookingSaving}
      />

      <ClosingSaleModal
        isOpen={showClosingSaleModal}
        onClose={() => {
          setShowClosingSaleModal(false);
          setBookingToMarkPaid(null);
        }}
        booking={bookingToMarkPaid}
        services={services}
        currentUserId={user?.id}
        onConfirm={handleConfirmFinalPayment}
        isProcessing={processingPayment}
      />
    </div>
  );
}
