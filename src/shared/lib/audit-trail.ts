import type { Booking, BookingModification, UserRole } from './types';

interface AuditContext {
  userId: string;
  userName: string;
  userRole: UserRole;
}

/**
 * Creates a new modification entry for the audit trail
 */
export function createModification(
  context: AuditContext,
  action: BookingModification['action'],
  description: string,
  field?: string,
  oldValue?: string,
  newValue?: string
): BookingModification {
  return {
    id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    userId: context.userId,
    userName: context.userName,
    userRole: context.userRole,
    action,
    field,
    oldValue,
    newValue,
    description,
  };
}

/**
 * Tracks booking creation
 */
export function trackBookingCreation(
  context: AuditContext,
  booking: Partial<Booking>
): BookingModification {
  return createModification(
    context,
    'created',
    `Reserva creada por ${context.userName} (${context.userRole === 'owner' ? 'Admin' : 'Empleado'})`
  );
}

/**
 * Tracks status changes
 */
export function trackStatusChange(
  context: AuditContext,
  oldStatus: string,
  newStatus: string
): BookingModification {
  const statusLabels: Record<string, string> = {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    completed: 'Completada',
    cancelled: 'Cancelada',
    'no-show': 'No Presentado',
  };

  return createModification(
    context,
    'status_changed',
    `Estado cambiado de "${statusLabels[oldStatus] || oldStatus}" a "${statusLabels[newStatus] || newStatus}" por ${context.userName}`,
    'status',
    oldStatus,
    newStatus
  );
}

/**
 * Tracks payment received
 */
export function trackPaymentReceived(
  context: AuditContext,
  amount: number,
  method: string
): BookingModification {
  return createModification(
    context,
    'payment_received',
    `Pago de €${amount.toFixed(2)} recibido (${method === 'cash' ? 'Efectivo' : 'Datáfono'}) por ${context.userName}`
  );
}

/**
 * Tracks booking reschedule
 */
export function trackReschedule(
  context: AuditContext,
  oldDate: string,
  oldTime: string,
  newDate: string,
  newTime: string
): BookingModification {
  return createModification(
    context,
    'rescheduled',
    `Reagendada de ${oldDate} ${oldTime} a ${newDate} ${newTime} por ${context.userName}`,
    'schedule',
    `${oldDate} ${oldTime}`,
    `${newDate} ${newTime}`
  );
}

/**
 * Tracks date change
 */
export function trackDateChange(
  context: AuditContext,
  oldDate: string,
  newDate: string
): BookingModification {
  return createModification(
    context,
    'updated',
    `Fecha cambiada de ${oldDate} a ${newDate} por ${context.userName}`,
    'bookingDate',
    oldDate,
    newDate
  );
}

/**
 * Tracks time change
 */
export function trackTimeChange(
  context: AuditContext,
  oldTime: string,
  newTime: string
): BookingModification {
  return createModification(
    context,
    'updated',
    `Hora cambiada de ${oldTime} a ${newTime} por ${context.userName}`,
    'bookingTime',
    oldTime,
    newTime
  );
}

/**
 * Tracks additional service added
 */
export function trackAdditionalService(
  context: AuditContext,
  serviceName: string,
  price: number
): BookingModification {
  return createModification(
    context,
    'updated',
    `Servicio adicional agregado: ${serviceName} (€${price.toFixed(2)}) por ${context.userName}`
  );
}

/**
 * Tracks booking cancellation
 */
export function trackCancellation(
  context: AuditContext,
  reason?: string
): BookingModification {
  const desc = reason
    ? `Reserva cancelada por ${context.userName}: ${reason}`
    : `Reserva cancelada por ${context.userName}`;
  
  return createModification(context, 'cancelled', desc);
}

/**
 * Tracks booking completion
 */
export function trackCompletion(context: AuditContext): BookingModification {
  return createModification(
    context,
    'completed',
    `Reserva completada y cerrada por ${context.userName}`
  );
}

/**
 * Tracks no-show
 */
export function trackNoShow(context: AuditContext): BookingModification {
  return createModification(
    context,
    'status_changed',
    `Marcada como "No Presentado" por ${context.userName}`,
    'status',
    undefined,
    'no-show'
  );
}

/**
 * Adds a modification to a booking's history
 */
export function addModificationToBooking(
  booking: Partial<Booking>,
  modification: BookingModification
): Partial<Booking> {
  const currentModifications = booking.modifications || [];
  
  return {
    ...booking,
    modifications: [...currentModifications, modification],
    updatedAt: new Date(),
  };
}

/**
 * Gets a summary of recent modifications (last 10)
 */
export function getRecentModifications(booking: Booking): BookingModification[] {
  if (!booking.modifications) return [];
  return [...booking.modifications]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}
