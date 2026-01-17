'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/hooks/useAuth';
import { getClients, getBookings, getServices, getEmployees, updateClient } from '@/shared/lib/firestore';
import { Loading } from '@/shared/components/Loading';
import { formatDate, formatTime, cn } from '@/shared/lib/utils';
import type { Client, Booking, Service, Employee } from '@/shared/lib/types';

export default function EmployeeClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [newHairNote, setNewHairNote] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        const [clientsData, bookingsData, servicesData, employeesData] = await Promise.all([
          getClients(),
          getBookings({}),
          getServices(),
          getEmployees(),
        ]);

        setClients(clientsData);
        setBookings(bookingsData);
        setServices(servicesData);
        setEmployees(employeesData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const filteredClients = clients.filter((client) => {
    const term = searchTerm.toLowerCase();
    const fullName = `${client.firstName || ''} ${client.lastName || ''}`.toLowerCase();
    return (
      fullName.includes(term) ||
      client.email.toLowerCase().includes(term) ||
      (client.phone || '').includes(term)
    );
  });

  const getClientBookings = (clientEmail: string) => {
    return bookings
      .filter((b) => b.clientEmail.toLowerCase() === clientEmail.toLowerCase())
      .sort((a, b) => {
        const dateA = new Date(`${a.bookingDate}T${a.bookingTime}`);
        const dateB = new Date(`${b.bookingDate}T${b.bookingTime}`);
        return dateB.getTime() - dateA.getTime();
      });
  };

  const getServiceName = (serviceId: string) => {
    return services.find((s) => s.id === serviceId)?.name || 'Unknown Service';
  };

  const getEmployeeName = (employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'N/A';
  };

  const handleSaveHairNote = async () => {
    if (!selectedClient || !newHairNote.trim()) return;

    try {
      setSavingNotes(true);
      const history = selectedClient.hairColorHistory || [];
      const newEntry = {
        note: newHairNote.trim(),
        date: new Date().toISOString(),
        bookingId: '',
      };

      await updateClient(selectedClient.id, {
        hairColorNotes: newHairNote.trim(),
        hairColorHistory: [...history, newEntry],
      });

      setSelectedClient({
        ...selectedClient,
        hairColorNotes: newHairNote.trim(),
        hairColorHistory: [...history, newEntry],
      });

      setClients((prev) =>
        prev.map((c) =>
          c.id === selectedClient.id
            ? { ...c, hairColorNotes: newHairNote.trim(), hairColorHistory: [...history, newEntry] }
            : c
        )
      );

      setNewHairNote('');
      alert('Note saved successfully');
    } catch (error) {
      console.error('Error saving hair note:', error);
      alert('Error saving note');
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p className="text-neutral-600">You must log in to access this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-neutral-800 tracking-tighter uppercase leading-none">
            Clients
          </h1>
          <p className="text-neutral-500 text-sm font-black uppercase tracking-[0.3em] mt-3">
            Search client history and notes
          </p>
        </div>
        <Link
          href="/employee"
          className="px-6 py-3 bg-neutral-100 text-neutral-800 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 w-fit"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, email or phone..."
          className="w-full px-6 py-4 pl-14 bg-white border-2 border-neutral-200 rounded-2xl text-neutral-900 font-medium focus:border-accent-500 transition-all outline-none"
        />
        <svg
          className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Client List */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-neutral-800 uppercase tracking-tight">
            {searchTerm ? `Results (${filteredClients.length})` : `All Clients (${clients.length})`}
          </h2>
          <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2">
            {filteredClients.length === 0 ? (
              <div className="py-16 text-center bg-neutral-50 rounded-2xl border border-neutral-100">
                <p className="text-neutral-400 text-sm font-black uppercase tracking-widest">
                  {searchTerm ? 'No clients found' : 'No registered clients'}
                </p>
              </div>
            ) : (
              filteredClients.map((client) => {
                const clientBookings = getClientBookings(client.email);
                const lastBooking = clientBookings[0];
                const isSelected = selectedClient?.id === client.id;

                return (
                  <button
                    key={client.id}
                    onClick={() => {
                      setSelectedClient(client);
                      setNewHairNote(client.hairColorNotes || '');
                    }}
                    className={cn(
                      'w-full text-left p-5 rounded-2xl border-2 transition-all',
                      isSelected
                        ? 'bg-accent-50 border-accent-500'
                        : 'bg-white border-neutral-200 hover:border-neutral-300'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-black text-neutral-800 uppercase tracking-tight truncate">
                          {client.firstName} {client.lastName}
                        </h3>
                        <p className="text-xs text-neutral-500 font-medium mt-1">{client.email}</p>
                        {client.phone && (
                          <p className="text-xs text-neutral-500 font-medium">{client.phone}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="px-3 py-1 bg-neutral-100 rounded-full">
                          <p className="text-xs font-black text-neutral-800">{clientBookings.length} Bookings</p>
                        </div>
                        {lastBooking && (
                          <p className="text-[10px] text-neutral-400 font-bold uppercase mt-2">
                            Last: {formatDate(lastBooking.bookingDate)}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Client Details */}
        <div className="sticky top-8 h-fit">
          {!selectedClient ? (
            <div className="py-32 text-center bg-neutral-50 rounded-2xl border border-neutral-100">
              <svg
                className="w-16 h-16 mx-auto text-neutral-300 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <p className="text-neutral-400 text-sm font-black uppercase tracking-widest">
                Select a client
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border-2 border-neutral-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-accent-600 to-accent-700 p-6">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                  {selectedClient.firstName} {selectedClient.lastName}
                </h2>
                <p className="text-accent-100 text-sm font-medium mt-1">{selectedClient.email}</p>
                {selectedClient.phone && (
                  <p className="text-accent-100 text-sm font-medium">{selectedClient.phone}</p>
                )}
              </div>

              <div className="p-6 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-neutral-50 rounded-xl text-center">
                    <p className="text-2xl font-black text-neutral-800">
                      {getClientBookings(selectedClient.email).length}
                    </p>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">
                      Total Visits
                    </p>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-xl text-center">
                    <p className="text-2xl font-black text-neutral-800">
                      {
                        getClientBookings(selectedClient.email).filter((b) => b.status === 'completed')
                          .length
                      }
                    </p>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">
                      Completed
                    </p>
                  </div>
                </div>

                {/* Hair Notes */}
                <div className="space-y-3">
                  <label className="block text-xs font-black text-neutral-600 uppercase tracking-widest">
                    Hair Color / Dye Notes
                  </label>
                  <textarea
                    value={newHairNote}
                    onChange={(e) => setNewHairNote(e.target.value)}
                    placeholder="E.g.: Ash blonde balayage, L'Oréal Majirel 9.1..."
                    className="w-full px-4 py-3 bg-neutral-50 border-2 border-neutral-200 rounded-xl text-neutral-900 font-medium focus:border-accent-500 transition-all outline-none resize-none"
                    rows={3}
                  />
                  <button
                    onClick={handleSaveHairNote}
                    disabled={savingNotes || !newHairNote.trim()}
                    className="w-full px-4 py-3 bg-accent-600 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-accent-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingNotes ? 'Saving...' : 'Save Note'}
                  </button>
                </div>

                {/* Hair History */}
                {selectedClient.hairColorHistory && selectedClient.hairColorHistory.length > 0 && (
                  <div className="space-y-3">
                    <label className="block text-xs font-black text-neutral-600 uppercase tracking-widest">
                      Color History
                    </label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {[...selectedClient.hairColorHistory]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((entry, idx) => (
                          <div
                            key={`${entry.date}-${idx}`}
                            className="p-3 bg-neutral-50 rounded-xl border border-neutral-200"
                          >
                            <p className="text-sm text-neutral-800 font-medium">{entry.note}</p>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase mt-1">
                              {formatDate(entry.date.split('T')[0])}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Recent Bookings */}
                <div className="space-y-3">
                  <label className="block text-xs font-black text-neutral-600 uppercase tracking-widest">
                    Recent Bookings
                  </label>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {getClientBookings(selectedClient.email).slice(0, 10).length === 0 ? (
                      <p className="text-sm text-neutral-400 text-center py-8">No bookings registered</p>
                    ) : (
                      getClientBookings(selectedClient.email)
                        .slice(0, 10)
                        .map((booking) => (
                          <div
                            key={booking.id}
                            className="p-3 bg-neutral-50 rounded-xl border border-neutral-200"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-neutral-800 truncate">
                                  {getServiceName(booking.serviceId)}
                                </p>
                                <p className="text-xs text-neutral-500 font-medium mt-1">
                                  {getEmployeeName(booking.employeeId)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-bold text-neutral-800">
                                  {formatDate(booking.bookingDate)}
                                </p>
                                <p className="text-xs text-neutral-500 font-medium">
                                  {formatTime(booking.bookingTime)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-2">
                              <span
                                className={cn(
                                  'inline-block px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider',
                                  booking.status === 'completed'
                                    ? 'bg-green-100 text-green-700'
                                    : booking.status === 'confirmed'
                                    ? 'bg-blue-100 text-blue-700'
                                    : booking.status === 'cancelled'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                )}
                              >
                                {booking.status === 'completed'
                                  ? 'Completed'
                                  : booking.status === 'confirmed'
                                  ? 'Confirmed'
                                  : booking.status === 'cancelled'
                                  ? 'Cancelled'
                                  : 'Pending'}
                              </span>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

