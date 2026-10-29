# Shang Hai × MangoCat Studios — three storefront proposals

Three complete, navigable ordering websites for **Restaurante Asiático Shang Hai**
(Avenida Doctor Gómez Pardo Ródenas, 5, 03300 Orihuela), built on one shared order engine,
plus a comparison page to present them to the owner. They live inside the existing
MangoCat site under `/showcase/shang-hai/` and do not change ATELIER or the MERIDIA
showcase.

| Route | What it is |
|---|---|
| `/showcase/shang-hai/` | Comparison page for the owner (real desktop + mobile captures, selector, links) |
| `/showcase/shang-hai/ink-house/` | Proposal 01 — INK HOUSE: editorial, ivory and ink, the 上海 seal |
| `/showcase/shang-hai/wok-after-dark/` | Proposal 02 — WOK AFTER DARK: nocturnal poster, giant type, ticket cart |
| `/showcase/shang-hai/bento-club/` | Proposal 03 — BENTO CLUB: modular, colourful, mobile-first ordering |
| `…/<proposal>/pedido/` | Checkout (customer details, summary, pay) |
| `…/<proposal>/pedido/estado/?pedido=…&t=…` | Order confirmation and live status |
| `/showcase/shang-hai/pago-demo/` | Demo payment simulator (only used in demo mode) |
| `/showcase/shang-hai/creditos/` | Photo credits (required by the CC BY / CC BY-SA images) |

Live (GitHub Pages): `https://wh14-ua.github.io/mangocat-test/showcase/shang-hai/` (demo
mode). Every Shang Hai page is `noindex, nofollow`; ATELIER and the MERIDIA showcase keep
their original indexing.

Design rationale: [`SHANG_HAI_DESIGN_SYSTEMS.md`](./SHANG_HAI_DESIGN_SYSTEMS.md).
Menu data audit: [`SHANG_HAI_MENU_AUDIT.md`](./SHANG_HAI_MENU_AUDIT.md).
Order backend: [`workers/shang-hai-orders/README.md`](./workers/shang-hai-orders/README.md).

## 1. What was built

- **Real menu** — 24 categories and 209 entries: 208 shown (one exact duplicate hidden) and
  204 orderable (the 4 entries published with conflicting prices wait for the owner)
  imported from the restaurant's public Just Eat listing on 2026-10-29, with integer-cent
  prices, piece counts, the real "postre o café" option of the 6-person menus, spicy and
  alcohol flags, and data-quality findings for the owner. Nothing invented: no fake dishes,
  descriptions, allergens, photos, reviews or ratings.
- **One engine, three faces** — the catalog, cart, pricing, validation, persistence and
  checkout are shared; each proposal has its own components, typography, navigation,
  menu presentation, cart, motion and photography.
- **Ordering** — search, categories, add with options, quantities with limits, a cart that
  survives reloads (re-validated against the current catalog), pickup checkout with
  validation, payment and an order status page fed by the backend.
- **Payments** — a demo simulator that charges nothing, and a Cloudflare Worker + D1 backend
  that creates Stripe Checkout sessions in **test mode**, verifies signed webhooks
  idempotently and stores orders. Live payments are disabled by design.
- **Staff panel** — `/admin` on the Worker, behind Cloudflare Access (no fake login).

## 2. Running it

Requirements: Node 22 (CI uses 22; `@types/node` matches). Google Chrome for the E2E tests.

```bash
npm ci
npm run dev                      # http://localhost:3000/mangocat-test/showcase/shang-hai/
npm run build                    # static export to ./out (all routes)
node scripts/serve-static.mjs    # serve ./out like GitHub Pages: http://127.0.0.1:4173/mangocat-test/
```

## 3. Opening each proposal

Start at the comparison page; each proposal has a slim MangoCat bar at the very top to jump
between the three (hide it with `?presentacion=0`, e.g. for screenshots). Suggested demo:
open a proposal → search "pato" → add → add a menu for 6 (choose postre o café) → open the
cart → change quantities → "Pagar" → fill the form → *Simular pago correcto* → watch the
status page → *Avanzar estado (demo)*.

## 4. How the catalog works

```
Just Eat page (normal browser) --copy __NEXT_DATA__--> scripts/import-shang-hai-menu.mjs
  -> src/data/shang-hai/source/just-eat-<date>.json  (trimmed snapshot, kept for re-imports)
  -> src/data/shang-hai/menu.json                    (THE catalog: storefronts + Worker)
  -> SHANG_HAI_MENU_AUDIT.md                         (counts, fixes, owner questions)
```

- Types: `src/lib/commerce/types.ts` (`MenuItem`, `MenuCatalog`, …). Prices are
  `priceCents: number | null`; `null` = shown as "Precio pendiente de confirmar", never
  orderable. `verificationStatus: "conflicting"` items (two published prices) are also not
  orderable until confirmed.
- Ids are stable: re-importing keeps every existing id (matched by the platform item id);
  new items get a slug of their name.
- Corrections to published text are explicit maps at the top of the importer (formatting
  typos only), and the original name is kept in `sourceName`.
- Restaurant facts (address, phone, hours, pickup/delivery rules, limits) live in
  `src/data/shang-hai/restaurant.ts`, each with its source and a `verified`/`pending`
  status. Own delivery is modelled (fee, minimum, postcodes, municipalities) but disabled.

Automated requests to Just Eat get a Cloudflare 403; that block is respected. Captures are
taken from a normal browser session (DevTools console:
`copy(document.getElementById("__NEXT_DATA__").textContent)`).

## 5. Updating prices or dishes

Preferred: capture the Just Eat page again and run

```bash
node scripts/import-shang-hai-menu.mjs --next-data ~/shang-hai-next-data.json
npm test                         # catalog integrity + pricing tests
```

The importer prints a summary and the audit gains a "Changes since the previous import"
section (added, removed, price changes). For a price the owner gives you directly (or a
dish that is not on Just Eat), edit `menu.json` (`priceCents` in cents,
`verificationStatus: "verified"`, `source` describing who confirmed it), then run
`npm test`. Rebuild and redeploy **both** the static site and the Worker so client and
server price from the same file; a mismatch is detected and shown as "los precios han
cambiado" rather than charged.

## 6. Adding photos

Photos are provisional, freely licensed and **illustrative** (none shows Shang Hai's food);
they are listed in `src/data/shang-hai/photos.ts` and `CREDITS.md`. To use the restaurant's
own shoot: export WebP at 1600 px and 800 px on the long side
(`<slot>-1600.webp`, `<slot>-800.webp`) into `public/images/shang-hai/<proposal>/`, update
the entry (size, alt text describing the photo, focal point, credit) and remove the
"Imagen ilustrativa" captions in that proposal once the photos are real. Product-level
photos can be attached later through `MenuItem.image`.

## 7. Configuring Stripe (test mode)

1. Create the D1 database and deploy the Worker (`workers/shang-hai-orders/README.md`).
2. `wrangler secret put STRIPE_SECRET_KEY` with a **test** key (`sk_test_…`) and
   `wrangler secret put STRIPE_WEBHOOK_SECRET` after creating the webhook endpoint
   `https://<worker>/api/stripe/webhook` in the Stripe dashboard (test mode) with the
   checkout.session events listed in the Worker README.
3. Set `CORS_ALLOWED_ORIGIN`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL` (see `.env.example`).
4. Build the site with `NEXT_PUBLIC_ORDER_API_BASE_URL=https://<worker>` and redeploy.
   The checkout then redirects to Stripe Checkout (test cards such as 4242 4242 4242 4242);
   orders are marked paid only by verified webhooks.

`NEXT_PUBLIC_ORDER_API_BASE_URL` empty ⇒ **demo mode** (the default and what GitHub Pages
serves today): the same validation and pricing run in the browser, the payment step is a
clearly labelled simulator ("Demostración — no se realizará ningún cargo") and nothing
reaches the restaurant. **Live payments** require `STRIPE_TEST_MODE=false` *and*
`PAYMENTS_LIVE_ENABLED=true` on the Worker plus the owner's Stripe account; do not enable
them without the owner's explicit approval.

## 8. Tests

```bash
npm run check            # typecheck + lint:shang-hai + unit tests + menu:check
npm test                 # vitest: 113 tests — engine, catalog integrity, SEO (71) + Worker (42:
                         #   D1 via node:sqlite, mocked Stripe API, real webhook signatures/JWTs)
npm run build && npm run test:e2e   # Playwright (system Chrome) at 390 / 768 / 1440 px: 54 tests
node scripts/capture-shang-hai-previews.mjs [--qa]  # comparison previews (+ QA captures)
node scripts/capture-shang-hai-journey.mjs          # journey screenshots for decks/QA
```

`npm run lint` (whole repo) reports 5 errors that pre-date this work, in ATELIER/MERIDIA
files that were deliberately left untouched; `npm run lint:shang-hai` covers all new code
and is clean.

The E2E suite runs the full purchase journey (menu → search → add → second dish → change
quantity → remove → cart → checkout → validation → simulated payment → confirmation →
status) on all three proposals, plus persistence, Escape-to-close, pending prices, cancelled
payments, console errors, horizontal overflow, the comparison page and the original
ATELIER/MERIDIA routes. `tests/shang-hai/e2e/a11y.spec.ts` audits every proposal and the
shared pages with axe-core (WCAG 2.1 A/AA) and fails on serious or critical violations.

## 9. Deploying

- **Static site** — unchanged pipeline: `.github/workflows/deploy.yml` builds and publishes
  `out/` to GitHub Pages on every push to `main` (base path `/mangocat-test`). The Shang Hai
  routes ship with it in demo mode.
- **Order Worker** — `workers/shang-hai-orders/` (Cloudflare Workers + D1 + Stripe):
  needs a Cloudflare account, a D1 database id in `wrangler.jsonc`, secrets and, for the
  staff panel, a Cloudflare Access application. Nothing is deployed from this repository
  automatically.
- **Chosen proposal on its own domain** — set `basePath` to `""` (see README), move the
  proposal's routes to the root of a dedicated app or keep the folder and add a redirect,
  switch `seo.indexable`/`canonicalUrl` in `restaurant.ts`, add the JSON-LD from
  `src/lib/shang-hai/seo.ts`, a sitemap entry and Open Graph image.

## Known issues

- Next.js and `eslint-config-next` are on 16.4.3, which fixes the advisories published for
  16.4.0 (GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r, GHSA-673q-mjm6-r5xr);
  `npm audit --omit=dev` reports 0 vulnerabilities.

- The demos share ATELIER's root layout, so ATELIER's two fonts load on every proposal
  (109 KB). A dedicated app for the chosen proposal removes them.
- Order tokens travel in the status URL (needed for a static status page); they only give
  read access to the order's status and lines, never to phone, email or notes.

## 10. What the restaurant must confirm

1. Orders phone (Just Eat only publishes 623 300 934 for allergen questions) and an email.
2. Opening hours for the restaurant's own channel and the pickup preparation time.
3. Whether they want their own delivery; if so: fee, minimum order, postcodes/area, times.
4. Allergen information per dish (legally required before purchase for online sales).
5. The conflicting entries: two "Cerveza China" prices (3,00 € / 2,25 €) and tuna sashimi
   at 10,45 € vs 12,45 €; the other notes in `SHANG_HAI_MENU_AUDIT.md`.
6. Whether to sell wine and beer online (age confirmation is already in the checkout).
7. Their own photography, logo/brand assets and preferred proposal.
8. Their Stripe account (only when they decide to accept real payments).
