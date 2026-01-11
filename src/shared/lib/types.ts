// User Types
export type UserRole = 'owner' | 'employee' | 'client';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  phone?: string;
  mustChangePassword?: boolean;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

// Client Types
export interface Client {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  profileImage?: string;
  hairColorNotes?: string;
  hairColorHistory?: {
    note: string;
    date: string; // ISO string
    bookingId?: string;
  }[];
  birthday?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  totalSpent: number;
  totalBookings: number;
  favoriteServices: string[]; // Service IDs
  favoriteEmployees: string[]; // Employee IDs
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    promotions: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Expense Management
export type ExpenseCategory = 
  | 'rent' 
  | 'utilities' 
  | 'products' 
  | 'supplies' 
  | 'staff' 
  | 'marketing' 
  | 'equipment' 
  | 'insurance' 
  | 'taxes' 
  | 'maintenance' 
  | 'other';

export type ExpenseFrequency = 'one-time' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Expense {
  id: string;
  salonId: string;
  category: ExpenseCategory;
  name: string;
  description?: string;
  amount: number; // in euros
  frequency: ExpenseFrequency;
  date: string; // YYYY-MM-DD
  isRecurring: boolean;
  isPaid: boolean;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'other';
  vendor?: string;
  receiptUrl?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Employee Types
export type EmployeeStatus = 'active' | 'inactive';
export type EmploymentType = 'employee' | 'self-employed'; // employee = regular employee, self-employed = autónomo

export interface Employee {
  id: string;
  userId: string;
  salonId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  profileImage?: string;
  bio?: string;
  nationalId?: string;
  position?: string;
  addressLine1?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  status: EmployeeStatus;
  employmentType: EmploymentType; // Distinguishes regular employees from self-employed (autónomos)
  createdAt: Date;
  updatedAt: Date;
}

// Service Types
export type ServiceCategory = 
  | 'nails' 
  | 'hair' 
  | 'balayage' 
  | 'air-touch' 
  | 'babylight' 
  | 'filler-therapy' 
  | 'brows-lashes' 
  | 'makeup'
  | 'haircut' 
  | 'styling' 
  | 'coloring' 
  | 'skincare' 
  | 'massage' 
  | 'facial' 
  | 'other';

export interface Service {
  id: string;
  salonId: string;
  serviceName: string;
  name?: string;
  description: string;
  duration: number; // minutes
  price: number;
  category: ServiceCategory;
  isActive: boolean;
  offersConsultation?: boolean; // If true, clients can book free consultations for this service
  consultationDuration?: number; // Default consultation duration in minutes (15-30)
  employees?: { id: string; firstName: string; lastName: string }[];
  createdAt: Date;
  updatedAt: Date;
}

// Employee Service Junction
export interface EmployeeService {
  id: string;
  employeeId: string;
  serviceId: string;
  isOffered: boolean;
  createdAt: Date;
}

// Availability Types
export type DayOfWeek = 
  | 'monday' 
  | 'tuesday' 
  | 'wednesday' 
  | 'thursday' 
  | 'friday' 
  | 'saturday' 
  | 'sunday';

export interface Availability {
  id: string;
  employeeId: string;
  serviceId?: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  isAvailable: boolean;
  startDate?: string; // YYYY-MM-DD (optional range start)
  endDate?: string;   // YYYY-MM-DD (optional range end)
  createdAt: Date;
  updatedAt: Date;
}

// Booking Types
export type BookingStatus = 
  | 'confirmed' 
  | 'completed' 
  | 'cancelled' 
  | 'no-show'
  | 'pending';

// Additional service item for bookings
export interface AdditionalServiceItem {
  id: string;
  serviceId?: string; // Optional - null for custom items
  serviceName: string;
  price: number; // Price in euros
  addedAt: Date;
  addedBy?: string; // User ID who added it
}

// Booking modification history for audit trail
export interface BookingModification {
  id: string;
  timestamp: Date;
  userId: string; // Who made the change
  userName: string; // Name of person who made the change
  userRole: UserRole; // Role of person who made the change
  action: 'created' | 'updated' | 'status_changed' | 'payment_received' | 'cancelled' | 'completed' | 'rescheduled';
  field?: string; // What field was changed (e.g., 'bookingDate', 'bookingTime', 'status')
  oldValue?: string; // Previous value
  newValue?: string; // New value
  description: string; // Human-readable description of the change
}

// Payment method types
export type PaymentMethod = 'cash' | 'pos' | 'online' | 'stripe';

export interface Booking {
  id: string;
  salonId: string;
  employeeId: string;
  serviceId: string;
  serviceName?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  bookingDate: string; // YYYY-MM-DD
  bookingTime: string; // HH:MM
  status: BookingStatus;
  createdByRole?: UserRole;
  createdByName?: string;
  createdByUserId?: string;
  notes?: string;
  // Consultation booking (free, shorter duration)
  isConsultation?: boolean; // If true, this is a free consultation booking
  consultationDuration?: number; // Duration in minutes for consultation (15-30)
  // Additional services added during appointment
  additionalServices?: AdditionalServiceItem[];
  // Payment fields
  requiresDeposit?: boolean;
  depositAmount?: number; // Amount in cents
  depositPaid?: boolean;
  paymentIntentId?: string; // Stripe Payment Intent ID
  paymentStatus?: 'pending' | 'paid' | 'refunded' | 'failed';
  paymentNotes?: string; // Notes about payment adjustments
  // Final payment tracking (for regular employees only)
  finalPaymentAmount?: number; // Remaining amount after deposit (in euros)
  finalPaymentReceived?: boolean; // Whether the final payment has been collected
  finalPaymentMethod?: PaymentMethod; // How the final payment was received (cash/pos)
  finalPaymentReceivedAt?: Date; // When the final payment was collected
  finalPaymentReceivedBy?: string; // User ID who marked it as received
  finalPaymentReceivedByName?: string; // Name of user who collected final payment
  // Completion tracking (who closed the sale)
  completedBy?: string; // User ID who completed/closed the booking
  completedByName?: string; // Name of user who completed/closed the booking
  completedByRole?: UserRole; // Role of user who completed the booking
  // No-show tracking
  noShowAt?: Date; // When booking was marked as no-show
  noShowBy?: string; // User ID who marked as no-show
  noShowByName?: string; // Name of user who marked as no-show
  // Audit trail - modification history
  modifications?: BookingModification[]; // History of all changes made to this booking
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
  completedAt?: Date;
}

// Blocked Slots (employee time off/blocked availability)
export interface BlockedSlot {
  id: string;
  employeeId: string;
  serviceId?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime?: string; // HH:MM (optional when blocking multiple slots)
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Salon Types
export interface Salon {
  id: string;
  ownerId: string;
  salonName: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  website?: string;
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Form Types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface EmployeeFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationalId: string;
  position: string;
  employmentType: EmploymentType;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  bio?: string;
  profileImage?: string;
}

export interface ServiceFormData {
  serviceName: string;
  description: string;
  duration: number;
  price: number;
  category: ServiceCategory;
  offersConsultation?: boolean;
  consultationDuration?: number;
  employeeIds: string[];
}

export interface BookingFormData {
  serviceId: string;
  employeeId: string;
  bookingDate: string;
  bookingTime: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  createdByRole?: UserRole;
  createdByName?: string;
  createdByUserId?: string;
  notes?: string;
  paymentIntentId?: string;
  allowUnpaid?: boolean;
  isConsultation?: boolean;
  consultationDuration?: number;
}

export interface AvailabilityFormData {
  employeeId: string;
  serviceId?: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  startDate?: string;
  endDate?: string;
}

// Time Slot Types
export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface AvailableSlotsResponse {
  date: string;
  slots: TimeSlot[];
}
