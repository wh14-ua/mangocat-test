# Shang Hai order Worker

The single order backend shared by the three Shang Hai storefront proposals
(Ink House, Wok After Dark, Bento Club). Cloudflare Workers + D1 + Stripe Checkout,
**test mode only** until the restaurant owner explicitly approves live payments.

```
Storefront (static, GitHub Pages)          Order Worker (this folder)                 Stripe
---------------------------------          --------------------------                 ------
cart: item ids + quantities  --POST /api/checkout-->  prepareOrder() re-prices from
                                                       the shared catalog (menu.json)
                                                       -> pending order in D1
                                                       -> Checkout Session  ------------> hosted payment page
<------------------ 201 { checkoutUrl } -------------                                         |
redirect to Stripe ---------------------------------------------------------------------------+
                                                       POST /api/stripe/webhook <--------- signed events
                                                       verify signature, idempotent,
                                                       reconcile amount -> paid/failed/...
status page --GET /api/orders/:id (Bearer token)-->    status from D1 (never from the URL)
staff (Cloudflare Access) --/admin-->                   list, detail, preparing/ready/completed
```

The Worker imports the storefronts' own engine by relative path
(`src/lib/commerce`, `src/lib/shang-hai/catalog.ts`, `src/data/shang-hai/menu.json`),
so the server always prices with exactly the same catalog and rules as the UI. Rebuild
and redeploy the Worker whenever the menu is re-imported.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | `{ ok, paymentsMode }` |
| GET | `/api/config` | `{ paymentsMode: "stripe-test" \| "stripe-live" \| "disabled" }` |
| POST | `/api/checkout` | Body: `CheckoutRequest` (ids, quantities, options, customer). 201 `{ orderId, orderToken, checkoutUrl, mode }` |
| GET | `/api/orders/:id` | `Authorization: Bearer <orderToken>` → `{ order }` (no phone/email/notes) |
| POST | `/api/stripe/webhook` | Stripe events (signature verified) |
| GET | `/admin` | Staff panel (HTML), behind Cloudflare Access |
| GET | `/api/admin/orders?status=` | Staff: list |
| GET | `/api/admin/orders/:id` | Staff: detail incl. contact, notes, Stripe ids, history |
| POST | `/api/admin/orders/:id/status` | Staff: `{ "status": "preparing" \| "ready" \| "completed" \| "cancelled" }` |

Checkout errors (shapes parsed by `src/lib/commerce/checkout/api-gateway.ts`):
`400/422 { error: "invalid", fieldErrors }`, `422 { error: "not-payable", issues }`,
`422 { error: "age-confirmation-required" }`, `409 { error: "price-changed", totalCents }`,
`503 { error: "payments-disabled" }`, `429` (with `Retry-After`), `413`, `415`,
`403 { error: "forbidden-origin" }`, `502 { error: "server" }` when Stripe fails (the
order is cancelled and no URL is returned).

### Security model

- **Prices**: the browser sends ids and quantities; every amount is recomputed from the
  catalog. `expectedTotalCents` is only compared (409 if it differs), never charged.
- **Payment status** changes only through verified Stripe webhooks: HMAC-SHA256 over
  `${t}.${body}`, constant-time comparison against every `v1` signature, 5-minute
  tolerance. Each event id is processed once (`stripe_events`). Amount, currency, test/live
  mode and session id are reconciled with the stored order; any mismatch → `needs_review`.
  Returning to the success URL changes nothing.
- **Order tokens**: 32 random bytes, returned once, stored as SHA-256. Wrong token and
  unknown order both answer 404.
- **Payments modes**: no key or no webhook secret → `disabled`. `STRIPE_TEST_MODE`
  defaults to `"true"` and then only `sk_test_`/`rk_test_` keys work. Live keys need
  `STRIPE_TEST_MODE="false"` **and** `PAYMENTS_LIVE_ENABLED="true"`.
- **CORS**: exact-origin allowlist (`CORS_ALLOWED_ORIGIN`); requests from other browser
  origins get 403; no CORS on the webhook or the staff API.
- **Staff**: Cloudflare Access JWT (`Cf-Access-Jwt-Assertion`) verified in the Worker
  (RS256 via the team JWKS, `aud`, `iss`, `exp`, `nbf`). Without `ACCESS_TEAM_DOMAIN` and
  `ACCESS_AUD` every staff route answers 503. Staff can only move orders through
  `paid → preparing → ready → completed` (or cancel paid/preparing ones); payment states
  are Stripe's. Status changes are same-origin JSON only (CSRF).
- **Abuse**: 16 KB body limit, JSON only, Workers Rate Limiting (10 checkouts and 120
  lookups per IP per minute), strict security headers, CSP with per-request nonce on the
  panel. Logs contain ids, amounts and reasons only — never names, phones, emails, notes or
  tokens. No card data is ever stored; payment details stay with Stripe.

## Data model (D1, `migrations/0001_init.sql`)

- `orders`: status, storefront, fulfillment, catalog version, subtotal/fees/total (cents),
  customer contact and notes, age confirmation, payments mode, Stripe session /
  payment intent / payment status / amount / livemode, timestamps.
- `order_items`: one row per line with the **unit price confirmed at purchase time**.
- `order_events`: every status change (checkout, Stripe, staff, system) with actor/note.
- `stripe_events`: one row per Stripe event id (idempotency).

Statuses: `pending, paid, failed, cancelled, preparing, ready, completed, needs_review`
(transitions in `src/lib/commerce/orders.ts`).

## Local development

```bash
cd workers/shang-hai-orders
npm install
cp .dev.vars.example .dev.vars          # Stripe TEST keys only
npm run db:migrate:local                # local D1 (SQLite under .wrangler/)
npm run dev                             # http://localhost:8787
```

With the [Stripe CLI](https://docs.stripe.com/stripe-cli) (if installed), forward test
webhooks and copy the printed `whsec_...` into `.dev.vars`:

```bash
stripe listen --forward-to localhost:8787/api/stripe/webhook \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired
```

Point a local storefront build at it:

```bash
NEXT_PUBLIC_ORDER_API_BASE_URL=http://localhost:8787 npm run dev   # repo root
```

Test card: `4242 4242 4242 4242`, any future date, any CVC (test mode only).

Tests run from the repo root with the rest of the suite (`npm test`): the Worker is
exercised end to end against an in-memory SQLite D1 that applies the real migration,
a fake Stripe API, real webhook signatures and a locally generated Access key pair.
Type-check: `npm run typecheck` here (Workers types) and at the root.

## Deploying (test mode)

Requires a Cloudflare account (`npx --no-install wrangler login`, done by a person).

```bash
cd workers/shang-hai-orders
npx --no-install wrangler d1 create shang-hai-orders   # put the id in wrangler.jsonc
npm run db:migrate:remote
npx --no-install wrangler secret put STRIPE_SECRET_KEY      # sk_test_...
npx --no-install wrangler secret put STRIPE_WEBHOOK_SECRET  # whsec_... (see below)
npm run deploy
```

Stripe (Dashboard in **test mode** → Developers → Webhooks → Add endpoint):
URL `https://<worker-host>/api/stripe/webhook`, events
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`. Copy its signing
secret into `STRIPE_WEBHOOK_SECRET`. Requests pin `Stripe-Version: 2026-09-30.endive`
(`src/config.ts`); create the endpoint with the same API version.

Frontend: build the static site with
`NEXT_PUBLIC_ORDER_API_BASE_URL=https://<worker-host>` (for GitHub Pages, add it to the
build step of `.github/workflows/deploy.yml` as an env var) and make sure that origin is
in `CORS_ALLOWED_ORIGIN`. Leaving it empty keeps the storefronts in demo mode.

## Staff panel (Cloudflare Access)

1. Zero Trust → Access → Applications → Add a **self-hosted** application for the
   Worker host with paths `/admin` and `/api/admin/*` (for `*.workers.dev` enable
   Access on the Worker's domain settings, or use a custom domain).
2. Policy: allow the restaurant staff's emails (one-time PIN or an identity provider).
3. Copy the application's **AUD tag** to `ACCESS_AUD` and the team domain
   (`<team>.cloudflareaccess.com`) to `ACCESS_TEAM_DOMAIN` in `wrangler.jsonc`, deploy.
4. Open `https://<worker-host>/admin`.

Until both values are set, `/admin` and `/api/admin/*` answer 503.

## Go-live checklist (requires the owner's explicit approval)

Live payments must not be enabled without all of the following:

- [ ] Written approval from the restaurant owner to take online payments.
- [ ] The owner's own Stripe account, verified (business details, bank account, terms).
- [ ] Confirmed menu prices (no `pending`/`conflicting` items the owner wants sold),
      allergen information, pickup hours and preparation time.
- [ ] Legal texts: terms of sale, privacy policy, refund/cancellation policy, company
      details; alcohol sale policy (ID check at pickup).
- [ ] Staff panel protected by Cloudflare Access and tested by the restaurant.
- [ ] Live webhook endpoint created with the live signing secret.
- [ ] End-to-end test in test mode on the production domain.
- [ ] Then, and only then: live key as `STRIPE_SECRET_KEY`, `STRIPE_TEST_MODE="false"`,
      `PAYMENTS_LIVE_ENABLED="true"`, redeploy, and place one small real order.
