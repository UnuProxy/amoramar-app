# Stripe Setup Checklist

This project already includes Stripe card payment flow for booking deposits.

## 1) Add environment variables

In `.env.local`:

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Use test keys first. For production, replace with live keys.

## 2) Webhook endpoint

Webhook route is implemented at:

`/api/payments/webhook`

For local development with Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
```

Copy the generated `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

## 3) Subscribe webhook events

Add at least:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

## 4) What is validated in backend

- Payment must be `succeeded` before booking confirmation.
- Payment currency must be `eur`.
- Payment metadata `serviceId` must match booking `serviceId`.
- Deposit amount is verified against expected 50%.

## 5) What webhook updates

- `payment_intent.succeeded` -> marks booking as paid deposit.
- `payment_intent.payment_failed` -> marks payment failed.
- `charge.refunded` -> marks payment refunded / deposit unpaid.

## 6) Go-live switch

When ready for production:

1. Replace test keys with live keys.
2. Configure production webhook URL in Stripe Dashboard:
   - `https://your-domain.com/api/payments/webhook`
3. Set live `STRIPE_WEBHOOK_SECRET`.
4. Run a real card payment smoke test.
