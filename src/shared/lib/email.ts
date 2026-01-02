import { Resend } from 'resend';

// Lazy initialization of Resend (only when needed)
let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// Email sender configuration
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const SALON_NAME = 'Amoramar Spa';

export interface BookingConfirmationData {
  clientName: string;
  clientEmail: string;
  serviceName: string;
  employeeName: string;
  bookingDate: string;
  bookingTime: string;
  duration: number;
  price: string;
}

export interface BookingReminderData {
  clientName: string;
  clientEmail: string;
  serviceName: string;
  employeeName: string;
  bookingDate: string;
  bookingTime: string;
  hoursUntil: number;
}

export interface EmployeeNotificationData {
  employeeName: string;
  employeeEmail: string;
  clientName: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  action: 'new' | 'cancelled' | 'rescheduled';
}

export interface BookingCancellationData {
  clientName: string;
  clientEmail: string;
  serviceName: string;
  employeeName: string;
  bookingDate: string;
  bookingTime: string;
}

export interface BookingRescheduleData {
  clientName: string;
  clientEmail: string;
  serviceName: string;
  employeeName: string;
  oldBookingDate: string;
  oldBookingTime: string;
  newBookingDate: string;
  newBookingTime: string;
}

/**
 * Send booking confirmation email to client
 */
export async function sendBookingConfirmation(data: BookingConfirmationData): Promise<{ success: boolean; error?: string }> {
  try {
    const resendClient = getResendClient();
    if (!resendClient) {
      console.warn('RESEND_API_KEY not configured. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    const { data: emailData, error } = await resendClient.emails.send({
      from: FROM_EMAIL,
      to: data.clientEmail,
      subject: `✓ Reserva Confirmada - ${SALON_NAME}`,
      html: getBookingConfirmationTemplate(data),
    });

    if (error) {
      console.error('Error sending confirmation email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending confirmation email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send booking reminder email to client
 */
export async function sendBookingReminder(data: BookingReminderData): Promise<{ success: boolean; error?: string }> {
  try {
    const resendClient = getResendClient();
    if (!resendClient) {
      console.warn('RESEND_API_KEY not configured. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    const { data: emailData, error } = await resendClient.emails.send({
      from: FROM_EMAIL,
      to: data.clientEmail,
      subject: `🔔 Recordatorio: Tu cita en ${data.hoursUntil}h - ${SALON_NAME}`,
      html: getBookingReminderTemplate(data),
    });

    if (error) {
      console.error('Error sending reminder email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending reminder email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send notification to employee about booking
 */
export async function sendEmployeeNotification(data: EmployeeNotificationData): Promise<{ success: boolean; error?: string }> {
  try {
    const resendClient = getResendClient();
    if (!resendClient) {
      console.warn('RESEND_API_KEY not configured. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    const subjectMap = {
      new: '📅 Nueva Reserva',
      cancelled: '❌ Reserva Cancelada',
      rescheduled: '🔄 Reserva Modificada',
    };

    const { data: emailData, error } = await resendClient.emails.send({
      from: FROM_EMAIL,
      to: data.employeeEmail,
      subject: `${subjectMap[data.action]} - ${SALON_NAME}`,
      html: getEmployeeNotificationTemplate(data),
    });

    if (error) {
      console.error('Error sending employee notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending employee notification:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send booking cancellation notification to client
 */
export async function sendBookingCancellation(data: BookingCancellationData): Promise<{ success: boolean; error?: string }> {
  try {
    const resendClient = getResendClient();
    if (!resendClient) {
      console.warn('RESEND_API_KEY not configured. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    const { data: emailData, error } = await resendClient.emails.send({
      from: FROM_EMAIL,
      to: data.clientEmail,
      subject: `Reserva Cancelada - ${SALON_NAME}`,
      html: getCancellationTemplate(data),
    });

    if (error) {
      console.error('Error sending cancellation email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending cancellation email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Send booking reschedule notification to client
 */
export async function sendBookingReschedule(data: BookingRescheduleData): Promise<{ success: boolean; error?: string }> {
  try {
    const resendClient = getResendClient();
    if (!resendClient) {
      console.warn('RESEND_API_KEY not configured. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    const { data: emailData, error } = await resendClient.emails.send({
      from: FROM_EMAIL,
      to: data.clientEmail,
      subject: `Reserva Modificada - ${SALON_NAME}`,
      html: getRescheduleTemplate(data),
    });

    if (error) {
      console.error('Error sending reschedule email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending reschedule email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// ============================================
// EMAIL TEMPLATES
// ============================================

function getBookingConfirmationTemplate(data: BookingConfirmationData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reserva Confirmada</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 90%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px; background: linear-gradient(135deg, #059669 0%, #047857 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300; text-align: center;">
                ${SALON_NAME}
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-block; width: 60px; height: 60px; background-color: #10b981; border-radius: 50%; line-height: 60px; font-size: 30px;">
                  ✓
                </div>
              </div>
              
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px; font-weight: 400; text-align: center;">
                ¡Reserva Confirmada!
              </h2>
              
              <p style="margin: 0 0 30px 0; color: #6b7280; font-size: 16px; line-height: 1.6; text-align: center;">
                Hola ${data.clientName}, tu cita ha sido confirmada con éxito.
              </p>
              
              <!-- Booking Details -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0; background-color: #f9fafb; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Servicio:</td>
                        <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${data.serviceName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Terapeuta:</td>
                        <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${data.employeeName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Fecha:</td>
                        <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${data.bookingDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Hora:</td>
                        <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${data.bookingTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Duración:</td>
                        <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${data.duration} min</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-top: 2px solid #e5e7eb; color: #6b7280; font-size: 14px;">Precio:</td>
                        <td style="padding: 10px 0; border-top: 2px solid #e5e7eb; color: #059669; font-size: 18px; font-weight: 700; text-align: right;">${data.price}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0; color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">
                Te enviaremos un recordatorio antes de tu cita. Si necesitas modificar o cancelar tu reserva, por favor contáctanos con al menos 24 horas de antelación.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" style="display: inline-block; padding: 14px 30px; background-color: #059669; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                  Ver Mi Reserva
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} ${SALON_NAME}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getBookingReminderTemplate(data: BookingReminderData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recordatorio de Cita</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 90%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px; background: linear-gradient(135deg, #059669 0%, #047857 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300; text-align: center;">
                ${SALON_NAME}
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-block; width: 60px; height: 60px; background-color: #f59e0b; border-radius: 50%; line-height: 60px; font-size: 30px;">
                  🔔
                </div>
              </div>
              
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px; font-weight: 400; text-align: center;">
                Recordatorio de tu Cita
              </h2>
              
              <p style="margin: 0 0 30px 0; color: #6b7280; font-size: 16px; line-height: 1.6; text-align: center;">
                Hola ${data.clientName}, tu cita es en <strong style="color: #f59e0b;">${data.hoursUntil} ${data.hoursUntil === 1 ? 'hora' : 'horas'}</strong>.
              </p>
              
              <!-- Booking Details -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0; background-color: #fef3c7; border-radius: 8px; border: 2px solid #f59e0b;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 10px 0; color: #92400e; font-size: 14px;">Servicio:</td>
                        <td style="padding: 10px 0; color: #78350f; font-size: 14px; font-weight: 600; text-align: right;">${data.serviceName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #92400e; font-size: 14px;">Terapeuta:</td>
                        <td style="padding: 10px 0; color: #78350f; font-size: 14px; font-weight: 600; text-align: right;">${data.employeeName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #92400e; font-size: 14px;">Fecha:</td>
                        <td style="padding: 10px 0; color: #78350f; font-size: 14px; font-weight: 600; text-align: right;">${data.bookingDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #92400e; font-size: 14px;">Hora:</td>
                        <td style="padding: 10px 0; color: #78350f; font-size: 18px; font-weight: 700; text-align: right;">${data.bookingTime}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0; color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">
                ¡Nos vemos pronto! Si necesitas cancelar o modificar tu cita, por favor contáctanos lo antes posible.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} ${SALON_NAME}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getEmployeeNotificationTemplate(data: EmployeeNotificationData): string {
  const actionText = {
    new: 'Nueva Reserva',
    cancelled: 'Reserva Cancelada',
    rescheduled: 'Reserva Modificada',
  };

  const actionColor = {
    new: '#10b981',
    cancelled: '#ef4444',
    rescheduled: '#3b82f6',
  };

  const actionIcon = {
    new: '📅',
    cancelled: '❌',
    rescheduled: '🔄',
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${actionText[data.action]}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 90%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px; background-color: #1f2937;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 400; text-align: center;">
                ${actionIcon[data.action]} ${actionText[data.action]}
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; color: #1f2937; font-size: 16px;">
                Hola ${data.employeeName},
              </p>
              
              <p style="margin: 0 0 30px 0; color: #6b7280; font-size: 16px; line-height: 1.6;">
                ${data.action === 'new' ? 'Tienes una nueva reserva' : data.action === 'cancelled' ? 'Se ha cancelado una reserva' : 'Se ha modificado una reserva'}:
              </p>
              
              <!-- Booking Details -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0; background-color: #f9fafb; border-left: 4px solid ${actionColor[data.action]}; border-radius: 4px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Cliente:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${data.clientName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Servicio:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${data.serviceName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Fecha:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${data.bookingDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Hora:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-size: 16px; font-weight: 700; text-align: right;">${data.bookingTime}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/employee/calendar" style="display: inline-block; padding: 14px 30px; background-color: #1f2937; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                  Ver Mi Calendario
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} ${SALON_NAME} - Panel de Empleados
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getCancellationTemplate(data: BookingCancellationData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reserva Cancelada</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 90%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300; text-align: center;">${SALON_NAME}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-block; width: 60px; height: 60px; background-color: #dc2626; border-radius: 50%; line-height: 60px; font-size: 30px;">✕</div>
              </div>
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px; font-weight: 400; text-align: center;">Reserva Cancelada</h2>
              <p style="margin: 0 0 30px 0; color: #6b7280; font-size: 16px; line-height: 1.6; text-align: center;">
                Hola ${data.clientName}, lamentamos informarte que tu reserva ha sido cancelada.
              </p>
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0; background-color: #fef2f2; border-radius: 8px; border: 2px solid #dc2626;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 10px 0; color: #7f1d1d; font-size: 14px;">Servicio:</td>
                        <td style="padding: 10px 0; color: #991b1b; font-size: 14px; font-weight: 600; text-align: right;">${data.serviceName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #7f1d1d; font-size: 14px;">Terapeuta:</td>
                        <td style="padding: 10px 0; color: #991b1b; font-size: 14px; font-weight: 600; text-align: right;">${data.employeeName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #7f1d1d; font-size: 14px;">Fecha:</td>
                        <td style="padding: 10px 0; color: #991b1b; font-size: 14px; font-weight: 600; text-align: right;">${data.bookingDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #7f1d1d; font-size: 14px;">Hora:</td>
                        <td style="padding: 10px 0; color: #991b1b; font-size: 16px; font-weight: 700; text-align: right;">${data.bookingTime}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin: 30px 0; color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">
                Si tienes alguna pregunta o deseas agendar una nueva cita, no dudes en contactarnos.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" style="display: inline-block; padding: 14px 30px; background-color: #059669; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">Hacer Nueva Reserva</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">© ${new Date().getFullYear()} ${SALON_NAME}. Todos los derechos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getRescheduleTemplate(data: BookingRescheduleData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reserva Modificada</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 90%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300; text-align: center;">${SALON_NAME}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-block; width: 60px; height: 60px; background-color: #3b82f6; border-radius: 50%; line-height: 60px; font-size: 30px;">🔄</div>
              </div>
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px; font-weight: 400; text-align: center;">Tu Reserva Ha Sido Modificada</h2>
              <p style="margin: 0 0 30px 0; color: #6b7280; font-size: 16px; line-height: 1.6; text-align: center;">
                Hola ${data.clientName}, tu cita ha sido reprogramada.
              </p>
              <div style="margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #6b7280; font-size: 14px; font-weight: 600; text-align: center; text-transform: uppercase;">Cita Anterior</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6; border-radius: 8px;">
                  <tr>
                    <td style="padding: 15px;">
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Fecha:</td>
                          <td style="padding: 8px 0; color: #4b5563; font-size: 14px; font-weight: 600; text-align: right; text-decoration: line-through;">${data.oldBookingDate}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Hora:</td>
                          <td style="padding: 8px 0; color: #4b5563; font-size: 14px; font-weight: 600; text-align: right; text-decoration: line-through;">${data.oldBookingTime}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </div>
              <div style="text-align: center; margin: 20px 0;">
                <div style="display: inline-block; width: 30px; height: 30px; line-height: 30px; font-size: 20px;">↓</div>
              </div>
              <div style="margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #3b82f6; font-size: 14px; font-weight: 600; text-align: center; text-transform: uppercase;">Nueva Cita</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #dbeafe; border-radius: 8px; border: 2px solid #3b82f6;">
                  <tr>
                    <td style="padding: 20px;">
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 10px 0; color: #1e3a8a; font-size: 14px;">Servicio:</td>
                          <td style="padding: 10px 0; color: #1e40af; font-size: 14px; font-weight: 600; text-align: right;">${data.serviceName}</td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 0; color: #1e3a8a; font-size: 14px;">Terapeuta:</td>
                          <td style="padding: 10px 0; color: #1e40af; font-size: 14px; font-weight: 600; text-align: right;">${data.employeeName}</td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 0; color: #1e3a8a; font-size: 14px;">Nueva Fecha:</td>
                          <td style="padding: 10px 0; color: #1e40af; font-size: 16px; font-weight: 700; text-align: right;">${data.newBookingDate}</td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 0; color: #1e3a8a; font-size: 14px;">Nueva Hora:</td>
                          <td style="padding: 10px 0; color: #1e40af; font-size: 18px; font-weight: 700; text-align: right;">${data.newBookingTime}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </div>
              <p style="margin: 30px 0; color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">
                Te esperamos en tu nueva cita. Si necesitas hacer cambios adicionales, por favor contáctanos.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">© ${new Date().getFullYear()} ${SALON_NAME}. Todos los derechos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

