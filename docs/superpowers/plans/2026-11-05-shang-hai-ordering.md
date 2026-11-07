# Shang Hai — real online ordering (accept/reject, Stripe manual capture, ES/EN, dish photos)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (storefront tasks)
> or superpowers:executing-plans (backend tasks, done inline). Steps use checkbox syntax.

**Goal:** turn the three approved Shang Hai storefronts (Ink House, Wok After Dark, Bento Club)
into one real ordering system: ES/EN storefronts, Stripe Checkout with *authorise first,
capture on acceptance*, a mobile staff panel with ACEPTAR / RECHAZAR, Telegram alerts,
a customer status page that reflects the real state, and optional AI dish photos.

**Architecture:** the shared engine (`src/lib/commerce`) gains a two-axis order model
(commercial `status` + `paymentStatus`), localized messages and a customer view model.
The Worker (`workers/shang-hai-orders`) keeps D1 + Stripe Checkout, switches to
`capture_method=manual`, reconciles every Stripe event against a fresh PaymentIntent,
adds accept/reject/ready/complete endpoints with conditional-update locks, an outbox for
Telegram notifications with retries (cron), and a rebuilt mobile panel (PWA). Storefronts
only render: language store + dictionaries, menu translation overlay, photo registry.

**Tech stack:** Next.js 16 static export (GitHub Pages), React 19, Cloudflare Workers + D1,
Stripe REST (form-encoded, pinned `Stripe-Version`), Telegram Bot API, Vitest (node:sqlite
D1 adapter), Playwright (system Chrome).

**Spec:** the two briefs in the conversation (orders mission + AI photos), summarised in
"Global constraints".

## Global constraints

- Do not redesign the three storefronts; no fourth proposal; reuse the engine.
- No live payments: `STRIPE_TEST_MODE=true`, `PAYMENTS_LIVE_ENABLED=false` stay the defaults.
- Secrets only through `wrangler secret put` / `.dev.vars` (git-ignored). Never in the repo.
- Frontend stays a static export for GitHub Pages; backend stays on Workers.
- Languages: `es` (default) and `en`; selector "ES | EN" in each identity; the language
  survives navigation and never clears the cart; Stripe Checkout `locale` follows it.
- Brand names are not translated; translations never add ingredients or claims.
- Never present an authorisation as a charge, nor a requested refund as completed.
- Staff panel private (Cloudflare Access JWT verified server-side); no passwords in the
  frontend, no credentials in localStorage; double transitions impossible.
- Notifications are never the source of truth; orders live in D1; failures are logged and
  retried; duplicates avoided.
- Photos: off by default (approved designs unchanged), `?fotos=1` / config to enable, WebP,
  lazy, labelled "Imagen ilustrativa", 20 dishes first, replaceable by real photos.

## Order model

`status` (commercial): `pending` → `awaiting_acceptance` → (`accepting` →) `preparing` →
`ready` → `completed`; `awaiting_acceptance` → (`rejecting` →) `rejected`; `pending` →
`failed` | `cancelled`; any → `needs_review` on reconciliation problems. Legacy `paid`
rows/demo orders map to `awaiting_acceptance` + `captured`.

`paymentStatus` (Stripe facts): `unpaid`, `processing`, `authorized`, `captured`,
`canceled`, `failed`, `refund_pending`, `refunded`, `refund_failed`.

Accept: lock (`awaiting_acceptance`→`accepting`, conditional UPDATE), capture (idempotent
key `capture-<id>`) if `authorized`, then `preparing` with `prepMinutes`/`readyBy`.
Reject: lock (`→rejecting`), cancel PI if `authorized`, refund if `captured`, then
`rejected`; any Stripe failure → `needs_review` (visible) with retry action.
Cron (every minute): stuck locks, notification retries, reminders, expired authorisations.

## File ownership (parallel work must not overlap)

| Area | Files | Owner |
|---|---|---|
| Engine + i18n core | `src/lib/commerce/**`, `src/lib/i18n/**`, `src/lib/shang-hai/**`, `src/hooks/shang-hai/**`, `src/data/shang-hai/menu-translations.ts`, `src/data/shang-hai/dish-photos.ts`, `src/components/shang-hai/shared/**` | lead |
| Worker | `workers/shang-hai-orders/**` except `panel/` | lead |
| Staff panel UI | `workers/shang-hai-orders/panel/**` | panel agent |
| Ink House | `src/components/shang-hai/ink-house/**`, `src/lib/shang-hai/i18n/ink-house.ts` | ink agent |
| Wok After Dark | `src/components/shang-hai/wok-after-dark/**`, `src/lib/shang-hai/i18n/wok-after-dark.ts` | wok agent |
| Bento Club | `src/components/shang-hai/bento-club/**`, `src/lib/shang-hai/i18n/bento-club.ts` | bento agent |
| Compare page, docs, E2E, local stack | `src/components/shang-hai/compare/**`, `*.md`, `tests/**`, `scripts/**` | lead |

## Tasks

1. Engine: types (statuses, payment statuses, OrderSummary fields, `locale` in
   CheckoutRequest), transitions, localized messages, `describeOrder()` view model,
   demo gateway restaurant simulator. Tests in `tests/shang-hai/unit/`.
2. i18n core: locale store (`?lang=`, localStorage, cross-tab), `useLocale`,
   `useMessages`, `LanguageSwitch`, pre-hydration script, money/time formatting.
3. Menu translations overlay + helpers (`itemName`, `categoryName`, …) + coverage test.
4. Photo registry + toggle (`?fotos=`, build default) + `DishPhoto` component + test.
5. Worker: migration 0002 (rebuild with new statuses, payment columns, notifications,
   order numbers), Stripe manual capture + locale, webhook reconciliation via PI fetch,
   accept/reject/ready/complete/retry endpoints, refunds, cron, Telegram outbox.
   Tests: migration preserves data; full lifecycle; concurrency; failures.
6. Panel: mobile PWA "SHANG HAI — PEDIDOS" (tabs, cards, accept sheet with minutes,
   reject sheet with confirmation + reason, ready/delivered, review banner, polling,
   last update, sound/vibration, notification status), manifest + service worker.
7. Storefronts (×3, parallel): ES/EN selector in identity, all copy through dictionaries,
   menu names via helpers, new status rendering via `describeOrder`, dish photos.
8. Compare page: per-proposal "con fotos / sin fotos" links.
9. Local end-to-end stack (fake Stripe + Telegram + Access) and Playwright journeys:
   order → authorise → panel accept 20 min → customer sees accepted → ready; reject;
   failed/cancelled payment; failed notification; duplicate accept; failed refund.
10. AI photos: research 20 dishes, generate, review, WebP 400/800, register.
11. Docs (README, Worker README, setup/credentials, audit of translations), PR.

## Review focus

- Two staff phones tap ACEPTAR at the same time → exactly one capture, the other sees "ya gestionado".
- Stripe events arrive out of order or twice → state converges to the PaymentIntent's real state.
- Capture fails because the authorisation expired → order must not go to the kitchen.
- Refund/cancel fails on rejection → `needs_review` visible with retry, customer told "en revisión".
- Switching language mid-checkout keeps cart and form values; Stripe opens in that language.
