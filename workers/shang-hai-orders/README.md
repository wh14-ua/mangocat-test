# Shang Hai order Worker

The single order backend shared by the three Shang Hai storefronts (Ink House, Wok After
Dark, Bento Club): Cloudflare Workers + D1 + Stripe Checkout, **test mode only** until the
restaurant owner explicitly approves live payments. Operator guide (Spanish):
[`../../SHANG_HAI_PEDIDOS.md`](../../SHANG_HAI_PEDIDOS.md).

```
Storefront ─POST /api/checkout─► prepareOrder() re-prices ─► pending order (#1042) ─► Checkout Session
                                 (shared engine + menu.json)                         capture_method=manual
Stripe ─webhooks─► /api/stripe/webhook ─► re-read the PaymentIntent ─► awaiting_acceptance + authorized
                                                                    └► Telegram alert (outbox, retries)
Staff phone ─/admin (PWA)─► ACEPTAR {prepMinutes} ─► capture ─► preparing ─► ready ─► completed
                          └► RECHAZAR {reason}     ─► cancel PI (hold released) / refund ─► rejected
Customer ─GET /api/orders/:id (Bearer token)─► status + paymentStatus + readyBy (polling)
Cron (every minute) ─► stale locks · reminders · acceptance timeout · missed webhooks · pending refunds · alert retries
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health`, `/api/config` | `{ paymentsMode: "stripe-test" \| "stripe-live" \| "disabled" }` |
| POST | `/api/checkout` | `CheckoutRequest` (ids, quantities, options, customer, `locale`) → 201 `{ orderId, orderNumber, orderToken, checkoutUrl, mode }` |
| GET | `/api/orders/:id` | `Authorization: Bearer <orderToken>` → `{ order }` (status, paymentStatus, prepMinutes, readyBy, rejectionReason; never phone/email/notes/Stripe ids) |
| POST | `/api/stripe/webhook` | Stripe events (signature verified, see list below) |
| GET | `/admin`, `/admin/*` | Staff panel shell and assets (no data inside) |
| POST | `/api/admin/auth/code` | Sends a 6-digit sign-in code to the authorised Telegram chats |
| POST | `/api/admin/auth/verify` | `{ code, label }` → HttpOnly session cookie (30 days) |
| POST | `/api/admin/auth/logout` | `{}` or `{ "everywhere": true }` |
| GET | `/api/admin/session` | Who is signed in |
| GET | `/api/admin/board` | Columns new / preparing / ready / completed / rejected, prep options, health |
| GET | `/api/admin/orders/:id` | Detail with contact, history and alert log |
| POST | `/api/admin/orders/:id/accept` | `{ prepMinutes: 5..180 }` → capture → preparing |
| POST | `/api/admin/orders/:id/reject` | `{ reason? }` → release the hold or refund → rejected (failure → needs_review) |
| POST | `/api/admin/orders/:id/ready` · `/complete` · `/retry` | Kitchen steps; retry re-syncs with Stripe and finishes half-done work |

Staff responses always carry a Spanish `message` ready to show, and the order card with the
`actions` the server allows. 409 = another phone already handled it (or not allowed now),
202 = Stripe did not answer (the cron resolves it), 502 = Stripe refused (order may be in review).

## Order model

`status` (commercial) and `payment_status` (Stripe facts) are separate columns:

- status: `pending`, `awaiting_acceptance`, `accepting`*, `rejecting`*, `preparing`, `ready`,
  `completed`, `rejected`, `failed`, `cancelled`, `needs_review` (*short locks while Stripe is called)
- payment_status: `unpaid`, `processing`, `authorized`, `captured`, `canceled`, `failed`,
  `refund_pending`, `refunded`, `refund_failed`

Transitions live in `src/lib/commerce/orders.ts`; Stripe → order rules in `src/payments.ts`
(pure, unit-tested). Migration `0002_acceptance_flow.sql` rebuilds the tables preserving every
existing order, line and event (`paid` → `awaiting_acceptance` + `captured`).

## Security model

- **Prices**: the browser sends ids and quantities; every amount is recomputed server-side.
- **Payments**: only verified webhooks and the Worker's own Stripe calls change payment state;
  every event triggers a fresh `GET /v1/payment_intents/:id`, so duplicates and out-of-order
  events converge on Stripe's real state. Amount, currency, mode and order id are reconciled
  (mismatch → `needs_review`). Each event id is processed once (`stripe_events`).
- **Concurrency**: accept/reject take a lock with a conditional UPDATE; Stripe calls use
  idempotency keys (`capture-<id>`, `cancel-<id>`, `refund-<id>-<n>`); an unknown outcome is
  resolved from Stripe by the cron (`STALE_LOCK_MS`), never guessed.
- **Staff**: Telegram one-time codes (10 min, single use, 5 tries, rate limited, only hashes
  stored) → `__Host-` HttpOnly Secure SameSite=Strict session; or a Cloudflare Access JWT
  (RS256, aud, iss, exp, nbf) from the header or the `CF_Authorization` cookie. Without either
  configured, staff routes answer 503. Mutations are same-origin JSON only (CSRF).
- **Notifications**: outbox rows unique per order/recipient/kind; no personal data in
  messages; failures recorded and retried; never the source of truth.
- **Acceptance timeout** (`ACCEPTANCE_TIMEOUT_MINUTES`, default 30, `0` = off — policy to be
  confirmed by the owner): counts only from when the restaurant was demonstrably informed (alert
  delivered or order shown on the panel). Orders nobody could see are never declined automatically.
- **Payments modes**: no key or no webhook secret → disabled; `STRIPE_TEST_MODE` defaults to
  `"true"` (only test keys); live keys need `STRIPE_TEST_MODE="false"` and
  `PAYMENTS_LIVE_ENABLED="true"`. `STRIPE_API_BASE`, `TELEGRAM_API_BASE` and `ACCESS_CERTS_URL`
  overrides are honoured only in test mode and only for localhost (local mock stack).

## Stripe webhook events

`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`,
`payment_intent.amount_capturable_updated`, `payment_intent.succeeded`,
`payment_intent.payment_failed`, `payment_intent.canceled`, `payment_intent.processing`,
`charge.refunded`, `charge.expired`, `refund.created`, `refund.updated`, `refund.failed`.
`node ../../scripts/setup/stripe-webhook.mjs https://<worker> --save` creates the endpoint
with exactly this list and the pinned API version (`2026-09-30.endive`).

## Configuration

Secrets (`wrangler secret put`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TELEGRAM_BOT_TOKEN`.
Vars (`wrangler.jsonc`): `STRIPE_TEST_MODE`, `PAYMENTS_LIVE_ENABLED`, `STRIPE_CAPTURE_MODE`
(`manual` | `per-method`), `CORS_ALLOWED_ORIGIN`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`
(placeholders `{storefront} {orderId} {token} {lang}`), `PANEL_URL`, `TELEGRAM_CHAT_IDS`,
`PREP_TIME_OPTIONS`, `ACCEPTANCE_REMINDER_MINUTES`, `ACCEPTANCE_TIMEOUT_MINUTES`,
`WORKER_ROLE` (`all` | `api` | `panel`: split the public API and an Access-protected panel
into two Workers sharing the D1 database), `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`.

## Development and tests

```bash
npm test                        # repo root: engine + Worker (D1 via node:sqlite, fake Stripe/Telegram)
npm run demo:local              # repo root: full local demo (wrangler dev + fake cloud + storefronts)
npm run test:e2e:ordering       # repo root: end-to-end journeys on the local stack
cd workers/shang-hai-orders && npx tsc -p tsconfig.json && npm run build:dry-run
```

## Deploying (test mode)

See `SHANG_HAI_PEDIDOS.md` §4 (D1 create, migrations, secrets, Stripe webhook, Telegram bot,
`npm run deploy`, storefront build with `NEXT_PUBLIC_ORDER_API_BASE_URL`). Nothing is deployed
automatically from this repository, and live payments stay disabled until the go-live
checklist below is complete.

## Go-live checklist (requires the owner's explicit approval)

- [ ] Written approval from the restaurant owner to take online payments.
- [ ] The owner's own Stripe account, verified; Link/wallets reviewed in Payment methods.
- [ ] Confirmed prices, allergens, pickup hours, prep-time options and the acceptance timeout policy.
- [ ] Legal texts (terms, privacy, refunds, company details, alcohol policy).
- [ ] Staff sign-in tested on the restaurant's phones; Telegram chats confirmed.
- [ ] Live webhook endpoint with the live signing secret.
- [ ] End-to-end test in test mode on the production domain.
- [ ] Then: live key, `STRIPE_TEST_MODE="false"`, `PAYMENTS_LIVE_ENABLED="true"`, redeploy, one small real order.
