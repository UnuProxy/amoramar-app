'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { loadStripe, type Stripe, type StripeCardElement, type StripeElements } from '@stripe/stripe-js';
import { BrandLogo } from '@/shared/components/BrandLogo';
import { Loading } from '@/shared/components/Loading';
import { buildBookingSuccessUrl } from '@/shared/lib/bookingSuccess';
import { formatCurrency } from '@/shared/lib/utils';

type PaymentLinkDetails = {
  bookingId: string;
  paymentUrl: string;
  clientSecret: string | null;
  paymentIntentId: string | null;
  amount: number;
  paid: boolean;
  booking: {
    clientName: string;
    serviceName: string;
    employeeName: string;
    bookingDate: string;
    bookingTime: string;
    totalAmount: number;
    depositAmount: number;
    remainingAmount: number;
    status: string;
    paymentStatus?: string;
  };
};

const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

const getPublicPaymentOrigin = () => {
  const normalize = (value?: string) => (value || '').replace(/\/+$/, '');
  const isBackofficeUrl = (value: string) => /backoffice|admin\./i.test(value);
  const envBaseUrl = [
    process.env.NEXT_PUBLIC_PAYMENT_BASE_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]
    .map(normalize)
    .find((value) => value && !isBackofficeUrl(value));

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const derivedBaseUrl = normalize(currentOrigin)
    .replace(/-backoffice(\.|-)/i, '-web$1')
    .replace(/backoffice/gi, 'web')
    .replace(/:\/\/admin\./i, '://');

  return envBaseUrl || derivedBaseUrl;
};

function formatDisplayDate(dateStr: string) {
  if (!dateStr) return '';
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}

export default function BookingPaymentPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = params.bookingId;
  const paymentIntentIdFromUrl = searchParams.get('payment_intent');
  const [details, setDetails] = useState<PaymentLinkDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const cardElementRef = useRef<StripeCardElement | null>(null);
  const cardMountId = 'booking-payment-card-element';

  useEffect(() => {
    if (!bookingId || typeof window === 'undefined') return;
    if (!/backoffice|admin\./i.test(window.location.origin)) return;

    const publicOrigin = getPublicPaymentOrigin();
    if (!publicOrigin || publicOrigin === window.location.origin) return;

    const target = new URL(`${publicOrigin}/booking-payment/${bookingId}`);
    if (paymentIntentIdFromUrl) {
      target.searchParams.set('payment_intent', paymentIntentIdFromUrl);
    }
    window.location.replace(target.toString());
  }, [bookingId, paymentIntentIdFromUrl]);

  useEffect(() => {
    const loadDetails = async () => {
      try {
        const query = paymentIntentIdFromUrl
          ? `?payment_intent=${encodeURIComponent(paymentIntentIdFromUrl)}`
          : '';
        const response = await fetch(`/api/bookings/${bookingId}/payment-link${query}`, {
          method: 'POST',
        });
        const json = await response.json();
        if (!response.ok || !json?.success) {
          throw new Error(json?.error || 'No se pudo cargar el enlace de pago.');
        }
        setDetails(json.data);
      } catch (err: any) {
        setError(err?.message || 'No se pudo cargar el enlace de pago.');
      } finally {
        setLoading(false);
      }
    };

    if (bookingId) {
      loadDetails();
    }
  }, [bookingId, paymentIntentIdFromUrl]);

  useEffect(() => {
    if (!details?.clientSecret || details.paid || !stripePublicKey) return;
    let active = true;

    const setupStripe = async () => {
      if (!stripeRef.current) {
        stripeRef.current = await loadStripe(stripePublicKey);
      }
      if (!active || !stripeRef.current) return;

      if (!elementsRef.current) {
        elementsRef.current = stripeRef.current.elements();
      }
      if (cardElementRef.current) return;

      const card = elementsRef.current.create('card', {
        hidePostalCode: true,
        style: {
          base: {
            fontSize: '16px',
            color: '#0f172a',
            '::placeholder': { color: '#94a3b8' },
          },
        },
      });
      card.mount(`#${cardMountId}`);
      cardElementRef.current = card;
    };

    setupStripe();

    return () => {
      active = false;
      if (cardElementRef.current) {
        cardElementRef.current.destroy();
        cardElementRef.current = null;
      }
    };
  }, [details?.clientSecret, details?.paid, cardMountId]);

  const handlePay = async () => {
    if (!details?.clientSecret || !details.booking) return;
    if (!stripePublicKey) {
      setError('Los pagos no estan configurados.');
      return;
    }

    setPaying(true);
    setError(null);

    try {
      if (!stripeRef.current) {
        stripeRef.current = await loadStripe(stripePublicKey);
      }
      if (!stripeRef.current || !cardElementRef.current) {
        throw new Error('El formulario de pago no esta listo.');
      }

      const { error: stripeError, paymentIntent } = await stripeRef.current.confirmCardPayment(details.clientSecret, {
        payment_method: {
          card: cardElementRef.current,
          billing_details: {
            name: details.booking.clientName,
          },
        },
      });

      if (stripeError || !paymentIntent) {
        throw new Error(stripeError?.message || 'No se pudo completar el pago.');
      }
      if (paymentIntent.status !== 'succeeded') {
        throw new Error('El pago no se completo. Intentalo de nuevo.');
      }

      router.push(
        buildBookingSuccessUrl({
          bookingId: details.bookingId,
          serviceName: details.booking.serviceName,
          employeeName: details.booking.employeeName,
          bookingDate: details.booking.bookingDate,
          bookingTime: details.booking.bookingTime,
          depositAmount: details.booking.depositAmount,
          remainingBalance: details.booking.remainingAmount,
        })
      );
    } catch (err: any) {
      setError(err?.message || 'No se pudo completar el pago.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50">
        <Loading text="Cargando pago..." />
      </main>
    );
  }

  if (error && !details) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="max-w-lg rounded-3xl bg-white p-8 text-center shadow-xl">
          <BrandLogo className="mx-auto h-16 w-40" priority />
          <h1 className="mt-8 text-2xl font-black text-stone-900">Enlace no disponible</h1>
          <p className="mt-3 text-sm font-semibold text-stone-500">{error}</p>
          <Link href="/" className="mt-6 inline-flex rounded-2xl bg-stone-900 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white">
            Volver
          </Link>
        </div>
      </main>
    );
  }

  if (!details) return null;

  const rows = [
    { label: 'Servicio', value: details.booking.serviceName },
    { label: 'Profesional', value: details.booking.employeeName },
    { label: 'Fecha', value: formatDisplayDate(details.booking.bookingDate) },
    { label: 'Hora', value: details.booking.bookingTime },
    { label: 'Deposito', value: formatCurrency(details.booking.depositAmount) },
    { label: 'Restante en salon', value: formatCurrency(details.booking.remainingAmount) },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-100 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-xl shadow-stone-200/60 sm:p-10">
          <div className="flex justify-center">
            <Link href="/">
              <BrandLogo className="h-16 w-40 sm:h-20 sm:w-48" priority />
            </Link>
          </div>

          <div className="mt-8 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">
              Amor Amar Beauty
            </p>
            <h1 className="mt-3 text-3xl font-black uppercase tracking-tight text-stone-900 sm:text-4xl">
              Pago de reserva
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-relaxed text-stone-500">
              Completa el deposito del 50% para confirmar tu cita.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="rounded-2xl border border-stone-100 bg-stone-50 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">{row.label}</p>
                <p className="mt-2 text-sm font-bold text-stone-900">{row.value}</p>
              </div>
            ))}
          </div>

          {details.paid ? (
            <div className="mt-8 rounded-3xl bg-emerald-50 p-6 text-center">
              <h2 className="text-xl font-black text-emerald-900">Pago recibido</h2>
              <p className="mt-2 text-sm font-semibold text-emerald-700">
                Esta reserva ya tiene el deposito pagado.
              </p>
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-stone-200 bg-white p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-400">
                Tarjeta
              </p>
              <div id={cardMountId} className="mt-4 rounded-2xl border border-stone-200 px-4 py-4" />
              {error && (
                <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={handlePay}
                disabled={paying || !details.clientSecret}
                className="mt-5 w-full rounded-2xl bg-stone-900 px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {paying ? 'Procesando...' : `Pagar ${formatCurrency(details.amount / 100)}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
