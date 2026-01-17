import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint,
  Firestore,
} from 'firebase/firestore';
import { db } from './firebase';

// Helper to check if Firestore is initialized
const checkDb = (): Firestore => {
  if (!db) {
    throw new Error('Firebase Firestore is not configured. Please add Firebase config to .env.local');
  }
  return db;
};
// Remove undefined values to keep Firestore writes clean
export const filterUndefined = <T extends Record<string, any>>(obj: T): T => {
  const entries = Object.entries(obj).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as T;
};
import type {
  User,
  Employee,
  Client,
  Service,
  Booking,
  Availability,
  EmployeeService,
  Salon,
  BlockedSlot,
  Expense,
} from './types';

// Helper to convert Firestore timestamp to Date
const timestampToDate = (timestamp: any): Date => {
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(timestamp);
};

// Helper to convert Date to Firestore timestamp
const dateToTimestamp = (date: Date | string): Timestamp => {
  if (typeof date === 'string') {
    return Timestamp.fromDate(new Date(date));
  }
  return Timestamp.fromDate(date);
};

// Users Collection
export const usersCollection = () => {
  const database = checkDb();
  if (!database) return null as any;
  return collection(database, 'users');
};

export const getUser = async (userId: string): Promise<User | null> => {
  const database = checkDb();
  if (!database) return null;
  const docRef = doc(database, 'users', userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
    } as User;
  }
  return null;
};

export const createUser = async (
  userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>,
  userId?: string
): Promise<string> => {
  const coll = usersCollection();
  if (!coll) throw new Error('Firebase not configured');
  const docRef = userId ? doc(coll, userId) : doc(coll);
  await setDoc(docRef, {
    ...filterUndefined(userData as any),
    mustChangePassword: userData.mustChangePassword ?? false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateUser = async (userId: string, updates: Partial<User>): Promise<void> => {
  const database = checkDb();
  if (!database) throw new Error('Firebase not configured');
  const docRef = doc(database, 'users', userId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

// Employees Collection
export const employeesCollection = () => {
  const database = checkDb();
  if (!database) return null as any;
  return collection(database, 'employees');
};

export const getEmployee = async (employeeId: string): Promise<Employee | null> => {
  const database = checkDb();
  if (!database) return null;
  const docRef = doc(database, 'employees', employeeId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
    } as Employee;
  }
  return null;
};

export const getEmployees = async (salonId?: string): Promise<Employee[]> => {
  const database = checkDb();
  if (!database) return [];
  const coll = employeesCollection();
  if (!coll) return [];

  const constraints: QueryConstraint[] = [];
  if (salonId) {
    constraints.push(where('salonId', '==', salonId));
  }
  
  try {
    const q = query(coll, ...constraints);
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        ...data,
        createdAt: timestampToDate(data.createdAt || 0),
        updatedAt: timestampToDate(data.updatedAt || 0),
      } as Employee;
    });

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error('Error fetching employees:', error);
    // Fallback: fetch all and filter in code
    const querySnapshot = await getDocs(coll);
    let results = querySnapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        ...data,
        createdAt: timestampToDate(data.createdAt || 0),
        updatedAt: timestampToDate(data.updatedAt || 0),
      } as Employee;
    });

    if (salonId) {
      results = results.filter(r => r.salonId === salonId);
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
};

export const createEmployee = async (employeeData: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const docRef = doc(employeesCollection());
  await setDoc(docRef, {
    ...filterUndefined(employeeData as any),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateEmployee = async (employeeId: string, updates: Partial<Employee>): Promise<void> => {
  const docRef = doc(checkDb(), 'employees', employeeId);
  
  const cleanUpdates = {
    ...filterUndefined(updates as any),
    updatedAt: Timestamp.now(),
  };
  
  await updateDoc(docRef, cleanUpdates);
};

export const deleteEmployee = async (employeeId: string): Promise<void> => {
  try {
    // Get employee data first to get the userId
    const employee = await getEmployee(employeeId);
    
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Delete the employee document from Firestore
    const docRef = doc(checkDb(), 'employees', employeeId);
    await deleteDoc(docRef);

    // Delete the associated user document if it exists
    if (employee.userId) {
      try {
        const userDocRef = doc(checkDb(), 'users', employee.userId);
        await deleteDoc(userDocRef);
      } catch (userError) {
        console.error('Error deleting user document:', userError);
        // Continue even if user deletion fails
      }
    }

    // Note: Firebase Auth user deletion requires Admin SDK on the backend
    // The Auth user will need to be deleted separately via Firebase Admin
    
  } catch (error: any) {
    console.error('Error in deleteEmployee:', error);
    throw new Error(error.message || 'Failed to delete employee');
  }
};

export async function getEmployeeByUserId(userId: string): Promise<Employee | null> {
  const database = checkDb();
  if (!database) return null;
  const coll = employeesCollection();
  if (!coll) return null;
  
  try {
    const q = query(coll, where('userId', '==', userId), limit(1));
    const snap = await getDocs(q);
    const docSnap = snap.docs[0];
    if (!docSnap || !docSnap.exists()) return null;
    const data = docSnap.data() as any;
    if (!data) return null;
    return {
      id: docSnap.id,
      ...data,
      createdAt: timestampToDate(data.createdAt || 0),
      updatedAt: timestampToDate(data.updatedAt || 0),
    } as Employee;
  } catch (error) {
    console.error('Error fetching employee by userId:', error);
    // Fallback: fetch all and find in code
    const querySnapshot = await getDocs(coll);
    const foundDoc = querySnapshot.docs.find(doc => (doc.data() as any).userId === userId);
    if (!foundDoc) return null;
    const data = foundDoc.id ? foundDoc.data() as any : null;
    if (!data) return null;
    return {
      id: foundDoc.id,
      ...data,
      createdAt: timestampToDate(data.createdAt || 0),
      updatedAt: timestampToDate(data.updatedAt || 0),
    } as Employee;
  }
}

// Services Collection
export const servicesCollection = () => {
  const database = checkDb();
  if (!database) return null as any;
  return collection(database, 'services');
};

export const getService = async (serviceId: string): Promise<Service | null> => {
  const docRef = doc(checkDb(), 'services', serviceId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
    } as Service;
  }
  return null;
};

export const getServices = async (salonId?: string): Promise<Service[]> => {
  const database = checkDb();
  if (!database) return [];
  const coll = servicesCollection();
  if (!coll) return [];

  const constraints: QueryConstraint[] = [];
  if (salonId) {
    constraints.push(where('salonId', '==', salonId));
  }
  
  try {
    const q = query(coll, ...constraints);
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        ...data,
        createdAt: timestampToDate(data.createdAt || 0),
        updatedAt: timestampToDate(data.updatedAt || 0),
      } as Service;
    });

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error('Error fetching services:', error);
    // Fallback: fetch all and filter in code
    const querySnapshot = await getDocs(coll);
    let results = querySnapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        ...data,
        createdAt: timestampToDate(data.createdAt || 0),
        updatedAt: timestampToDate(data.updatedAt || 0),
      } as Service;
    });

    if (salonId) {
      results = results.filter(r => r.salonId === salonId);
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
};

export const createService = async (serviceData: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const docRef = doc(servicesCollection());
  await setDoc(docRef, {
    ...filterUndefined(serviceData as any),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateService = async (serviceId: string, updates: Partial<Service>): Promise<void> => {
  const docRef = doc(checkDb(), 'services', serviceId);
  await updateDoc(docRef, {
    ...filterUndefined(updates as any),
    updatedAt: Timestamp.now(),
  });
};

export const deleteService = async (serviceId: string): Promise<void> => {
  const docRef = doc(checkDb(), 'services', serviceId);
  await deleteDoc(docRef);
};

// Bookings Collection
export const bookingsCollection = () => {
  const database = checkDb();
  if (!database) return null as any;
  return collection(database, 'bookings');
};

export const getBooking = async (bookingId: string): Promise<Booking | null> => {
  const docRef = doc(checkDb(), 'bookings', bookingId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      bookingDate: data.bookingDate,
      bookingTime: data.bookingTime,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
      cancelledAt: data.cancelledAt ? timestampToDate(data.cancelledAt) : undefined,
      completedAt: data.completedAt ? timestampToDate(data.completedAt) : undefined,
    } as Booking;
  }
  return null;
};

export const getBookings = async (filters?: {
  salonId?: string;
  employeeId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Booking[]> => {
  const database = checkDb();
  if (!database) return [];
  const coll = bookingsCollection();
  if (!coll) return [];
  
  // Use simpler query to avoid complex index requirements
  // Only filter by the most selective field in Firestore
  const constraints: QueryConstraint[] = [];
  
  if (filters?.employeeId) {
    constraints.push(where('employeeId', '==', filters.employeeId));
  } else if (filters?.salonId) {
    constraints.push(where('salonId', '==', filters.salonId));
  }
  
  const q = query(coll, ...constraints);
  const querySnapshot = await getDocs(q);
  
  let results = querySnapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, any>;
    return {
      id: doc.id,
      ...data,
      bookingDate: data.bookingDate,
      bookingTime: data.bookingTime,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
      cancelledAt: data.cancelledAt ? timestampToDate(data.cancelledAt) : undefined,
      completedAt: data.completedAt ? timestampToDate(data.completedAt) : undefined,
    } as Booking;
  });

  // Apply additional filters in code
  if (filters?.salonId && filters?.employeeId) {
    // Already filtered by employeeId in query, no need to filter salonId again
  } else if (filters?.salonId && !filters?.employeeId) {
    // Already filtered by salonId in query
  }
  
  if (filters?.status) {
    results = results.filter(b => b.status === filters.status);
  }
  if (filters?.startDate) {
    results = results.filter(b => b.bookingDate >= filters.startDate!);
  }
  if (filters?.endDate) {
    results = results.filter(b => b.bookingDate <= filters.endDate!);
  }

  // Sort by date and time descending
  return results.sort((a, b) => {
    if (a.bookingDate !== b.bookingDate) return b.bookingDate.localeCompare(a.bookingDate);
    return b.bookingTime.localeCompare(a.bookingTime);
  });
};

export const createBooking = async (bookingData: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const docRef = doc(bookingsCollection());
  
  const cleanData = filterUndefined(bookingData as any);
  
  await setDoc(docRef, {
    ...cleanData,
    notes: cleanData.notes || null, // Ensure notes is null if empty
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateBooking = async (bookingId: string, updates: Partial<Booking>): Promise<void> => {
  const docRef = doc(checkDb(), 'bookings', bookingId);
  
  const cleanUpdates: Record<string, any> = {
    ...filterUndefined(updates as any),
    updatedAt: Timestamp.now(),
  };
  
  if (updates.cancelledAt) {
    cleanUpdates.cancelledAt = dateToTimestamp(updates.cancelledAt);
  }
  if (updates.completedAt) {
    cleanUpdates.completedAt = dateToTimestamp(updates.completedAt);
  }
  
  await updateDoc(docRef, cleanUpdates);
};

export const deleteBooking = async (bookingId: string): Promise<void> => {
  const docRef = doc(checkDb(), 'bookings', bookingId);
  await deleteDoc(docRef);
};

// Blocked Slots Collection (employee blocks/time off)
export const blockedSlotsCollection = () => {
  const database = checkDb();
  if (!database) return null as any;
  return collection(database, 'blockedSlots');
};

export const getBlockedSlots = async (filters?: {
  employeeId?: string;
  serviceId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<BlockedSlot[]> => {
  const coll = blockedSlotsCollection();
  if (!coll) return [];

  // Simple query with just employeeId to avoid index requirements
  // Then filter the rest in code
  const constraints: QueryConstraint[] = [];
  if (filters?.employeeId) {
    constraints.push(where('employeeId', '==', filters.employeeId));
  }

  const q = query(coll, ...constraints);
  const querySnapshot = await getDocs(q);
  
  let results = querySnapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, any>;
    return {
      id: doc.id,
      ...data,
      endTime: data.endTime || undefined,
      serviceId: data.serviceId || undefined,
      reason: data.reason || undefined,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
    } as BlockedSlot;
  });

  // Filter in code to avoid complex index requirements
  if (filters?.serviceId) {
    // Include blocks for this service OR blocks that apply to all services (null serviceId)
    results = results.filter(b => !b.serviceId || b.serviceId === filters.serviceId);
  }
  if (filters?.startDate) {
    results = results.filter(b => b.date >= filters.startDate!);
  }
  if (filters?.endDate) {
    results = results.filter(b => b.date <= filters.endDate!);
  }

  // Sort by date and time
  return results.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });
};

export const createBlockedSlot = async (
  blockedSlotData: Omit<BlockedSlot, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const docRef = doc(blockedSlotsCollection());
  await setDoc(docRef, {
    ...blockedSlotData,
    serviceId: blockedSlotData.serviceId || null,
    endTime: blockedSlotData.endTime || null,
    reason: blockedSlotData.reason || null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateBlockedSlot = async (
  blockedSlotId: string,
  updates: Partial<BlockedSlot>
): Promise<void> => {
  const docRef = doc(checkDb(), 'blockedSlots', blockedSlotId);
  
  const cleanUpdates = {
    ...filterUndefined(updates as any),
    updatedAt: Timestamp.now(),
  };
  
  await updateDoc(docRef, cleanUpdates);
};

export const deleteBlockedSlot = async (blockedSlotId: string): Promise<void> => {
  const docRef = doc(checkDb(), 'blockedSlots', blockedSlotId);
  await deleteDoc(docRef);
};

// Availability Collection
export const availabilityCollection = () => {
  const database = checkDb();
  if (!database) return null as any;
  return collection(database, 'availability');
};

export const getAvailability = async (employeeId: string, serviceId?: string): Promise<Availability[]> => {
  const database = checkDb();
  if (!database) return [];
  const coll = availabilityCollection();
  if (!coll) return [];
  
  // Simple query with just employeeId to avoid index requirements
  const constraints: QueryConstraint[] = [where('employeeId', '==', employeeId)];
  const q = query(coll, ...constraints);
  const querySnapshot = await getDocs(q);
  
  let results = querySnapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, any>;
    return {
      id: doc.id,
      ...data,
      startDate: data.startDate,
      endDate: data.endDate,
      serviceId: data.serviceId,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
    } as Availability;
  });

  // Filter by serviceId in code if provided, but always keep generic availability (serviceId null/undefined)
  if (serviceId) {
    results = results.filter((a) => !a.serviceId || a.serviceId === serviceId);
  }

  // Sort by dayOfWeek
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return results.sort((a, b) => dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek));
};

export const createAvailability = async (availabilityData: Omit<Availability, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const docRef = doc(availabilityCollection());
  await setDoc(docRef, {
    ...availabilityData,
    serviceId: availabilityData.serviceId || null,
    startDate: availabilityData.startDate || null,
    endDate: availabilityData.endDate || null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateAvailability = async (availabilityId: string, updates: Partial<Availability>): Promise<void> => {
  const docRef = doc(checkDb(), 'availability', availabilityId);
  
  const cleanUpdates = {
    ...filterUndefined(updates as any),
    updatedAt: Timestamp.now(),
  };
  
  await updateDoc(docRef, cleanUpdates);
};

export const deleteAvailability = async (availabilityId: string): Promise<void> => {
  const docRef = doc(checkDb(), 'availability', availabilityId);
  await deleteDoc(docRef);
};

// Employee Services Junction
export const employeeServicesCollection = () => {
  const database = checkDb();
  if (!database) return null as any;
  return collection(database, 'employeeServices');
};

export const getEmployeeServices = async (employeeId?: string, serviceId?: string): Promise<EmployeeService[]> => {
  const database = checkDb();
  if (!database) return [];
  const coll = employeeServicesCollection();
  if (!coll) return [];

  const constraints: QueryConstraint[] = [];
  if (employeeId) {
    constraints.push(where('employeeId', '==', employeeId));
  }
  if (serviceId) {
    constraints.push(where('serviceId', '==', serviceId));
  }
  
  try {
    const q = query(coll, ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        ...data,
        createdAt: timestampToDate(data.createdAt || 0),
      } as EmployeeService;
    });
  } catch (error) {
    console.error('Error fetching employee services:', error);
    // Fallback: fetch all and filter in code if query fails
    const querySnapshot = await getDocs(coll);
    let results = querySnapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        ...data,
        createdAt: timestampToDate(data.createdAt || 0),
      } as EmployeeService;
    });

    if (employeeId) {
      results = results.filter(r => r.employeeId === employeeId);
    }
    if (serviceId) {
      results = results.filter(r => r.serviceId === serviceId);
    }
    return results;
  }
};

export const createEmployeeService = async (data: Omit<EmployeeService, 'id' | 'createdAt'>): Promise<string> => {
  const docRef = doc(employeeServicesCollection());
  await setDoc(docRef, {
    ...filterUndefined(data as any),
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const deleteEmployeeService = async (id: string): Promise<void> => {
  const docRef = doc(checkDb(), 'employeeServices', id);
  await deleteDoc(docRef);
};

// Salon Collection
export const salonsCollection = () => {
  const database = checkDb();
  if (!database) return null as any;
  return collection(database, 'salons');
};

export const getSalon = async (salonId: string): Promise<Salon | null> => {
  const docRef = doc(checkDb(), 'salons', salonId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
    } as Salon;
  }
  return null;
};

export const getSalonByOwner = async (ownerId: string): Promise<Salon | null> => {
  const q = query(salonsCollection(), where('ownerId', '==', ownerId));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    return null;
  }
  const doc = querySnapshot.docs[0];
  const data = doc.data() as Record<string, any>;
  return {
    id: doc.id,
    ...data,
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  } as Salon;
};

// ===============================
// Client Functions
// ===============================

const clientsCollection = () => {
  const database = checkDb();
  if (!database) throw new Error('Database not initialized');
  return collection(database, 'clients');
};

export const createClient = async (id: string | null, data: Omit<Client, 'id'>): Promise<string> => {
  const docRef = id ? doc(clientsCollection(), id) : doc(clientsCollection());
  // Filter out undefined values
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  );
  await setDoc(docRef, {
    ...cleanData,
    createdAt: cleanData.createdAt ? dateToTimestamp(cleanData.createdAt as any) : Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const getClient = async (id: string): Promise<Client | null> => {
  const docRef = doc(clientsCollection(), id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
    } as Client;
  }
  return null;
};

export const getClientByEmail = async (email: string): Promise<Client | null> => {
  const q = query(clientsCollection(), where('email', '==', email));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    return null;
  }
  const doc = querySnapshot.docs[0];
  const data = doc.data() as Record<string, any>;
  return {
    id: doc.id,
    ...data,
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  } as Client;
};

export const updateClient = async (id: string, data: Partial<Client>): Promise<void> => {
  const docRef = doc(clientsCollection(), id);
  // Filter out undefined values
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  );
  await updateDoc(docRef, {
    ...cleanData,
    updatedAt: Timestamp.now(),
  });
};

export const getClients = async (): Promise<Client[]> => {
  const querySnapshot = await getDocs(clientsCollection());
  return querySnapshot.docs.map(doc => {
    const data = doc.data() as Record<string, any>;
    return {
      id: doc.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
    } as Client;
  });
};

export const deleteClient = async (id: string): Promise<void> => {
  const docRef = doc(clientsCollection(), id);
  await deleteDoc(docRef);
};

// ============================================
// EXPENSE COLLECTION
// ============================================

const expensesCollection = () => {
  const dbInstance = checkDb();
  if (!dbInstance) throw new Error('Firestore not initialized');
  return collection(dbInstance, 'expenses');
};

export const createExpense = async (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expense> => {
  const expensesRef = expensesCollection();
  const docRef = doc(expensesRef);
  
  const newExpense: Expense = {
    id: docRef.id,
    ...expense,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const expenseToStore = {
    ...newExpense,
    createdAt: Timestamp.fromDate(newExpense.createdAt),
    updatedAt: Timestamp.fromDate(newExpense.updatedAt),
  };

  await setDoc(docRef, filterUndefined(expenseToStore));
  return newExpense;
};

export const getExpense = async (id: string): Promise<Expense | null> => {
  const docRef = doc(expensesCollection(), id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
    } as Expense;
  }
  
  return null;
};

export const getExpenses = async (salonId?: string, startDate?: string, endDate?: string): Promise<Expense[]> => {
  const database = checkDb();
  if (!database) return [];

  const constraints: QueryConstraint[] = [];
  
  if (salonId) {
    constraints.push(where('salonId', '==', salonId));
  }
  
  if (startDate) {
    constraints.push(where('date', '>=', startDate));
  }
  
  if (endDate) {
    constraints.push(where('date', '<=', endDate));
  }
  
  constraints.push(orderBy('date', 'desc'));

  const q = query(expensesCollection(), ...constraints);
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, any>;
    return {
      id: doc.id,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
    } as Expense;
  });
};

export const updateExpense = async (id: string, data: Partial<Expense>): Promise<void> => {
  const docRef = doc(expensesCollection(), id);
  const cleanData = filterUndefined(data);
  
  await updateDoc(docRef, {
    ...cleanData,
    updatedAt: Timestamp.now(),
  });
};

export const deleteExpense = async (id: string): Promise<void> => {
  const docRef = doc(expensesCollection(), id);
  await deleteDoc(docRef);
};
