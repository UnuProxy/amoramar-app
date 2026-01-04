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
  birthday?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  loyaltyPoints: number;
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

// Loyalty & Rewards
export interface LoyaltyTransaction {
  id: string;
  clientId: string;
  type: 'earned' | 'redeemed' | 'expired';
  points: number;
  bookingId?: string;
  description: string;
  createdAt: Date;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  discount: number; // Percentage or fixed amount
  isActive: boolean;
  expiryDate?: Date;
}

// Employee Types
export type EmployeeStatus = 'active' | 'inactive';

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
  commission?: number; // percentage (0-100)
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
  // Payment fields
  requiresDeposit?: boolean;
  depositAmount?: number; // Amount in cents
  depositPaid?: boolean;
  paymentIntentId?: string; // Stripe Payment Intent ID
  paymentStatus?: 'pending' | 'paid' | 'refunded' | 'failed';
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
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  bio?: string;
  profileImage?: string;
  commission?: number;
}

export interface ServiceFormData {
  serviceName: string;
  description: string;
  duration: number;
  price: number;
  category: ServiceCategory;
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
