import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

/**
 * The real ordering system end to end, on a phone-sized screen:
 * storefront (local build) -> Worker (wrangler dev, local D1) -> fake Stripe Checkout
 * (authorise / decline / cancel, signed webhooks) -> Telegram alert (fake) -> restaurant
 * actions -> the customer's status page updates by itself.
 * Run with `npm run test:e2e:ordering` (see playwright.ordering.config.ts).
 */

const SITE = "http://localhost:4174/mangocat-test/showcase/shang-hai";
const WORKER = "http://localhost:8787";
const CLOUD = "http://localhost:8790";

const visible = (l: Locator) => l.filter({ visible: true }).first();

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function cloudState() {
  const res = await fetch(`${CLOUD}/__control/state`);
  return (await res.json()) as {
    telegram: { chat_id: string; text: string; button: { text: string; url: string } | null }[];
    intents: { id: string; status: string; order: string }[];
  };
}

async function control(path: string, body: unknown) {
  await fetch(`${CLOUD}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

let cachedStaff: Promise<{ api: APIRequestContext; cookie: string }> | null = null;

/**
 * Staff signed in through the real sign-in flow (code delivered by the fake Telegram), once
 * per run like a real phone: code requests are rate limited (one every 30 s, 8 per hour).
 */
function staffSession(): Promise<{ api: APIRequestContext; cookie: string }> {
  cachedStaff ??= signIn();
  return cachedStaff;
}

/** Asks for a sign-in code; codes are rate limited (one per 30 s), so wait and retry once. */
async function requestCode(api: APIRequestContext) {
  let res = await api.post("/api/admin/auth/code", { data: {} });
  if (res.status() === 429) {
    await new Promise((r) => setTimeout(r, 31_000));
    res = await api.post("/api/admin/auth/code", { data: {} });
  }
  expect(res.status()).toBe(202);
  const message = (await cloudState()).telegram.filter((m) => m.text.includes("Código")).at(-1);
  return /\b(\d{6})\b/.exec(message?.text ?? "")?.[1] ?? "";
}

async function signIn(): Promise<{ api: APIRequestContext; cookie: string }> {
  const api = await playwrightRequest.newContext({ baseURL: WORKER, extraHTTPHeaders: { Origin: WORKER } });
  const code = await requestCode(api);
  const verified = await api.post("/api/admin/auth/verify", { data: { code, label: "Móvil E2E" } });
  expect(verified.status()).toBe(200);
  const cookie = (verified.headers()["set-cookie"] ?? "").split(";")[0];
  return { api, cookie };
}

async function staffPost(staff: { api: APIRequestContext; cookie: string }, path: string, data: unknown = {}) {
  const res = await staff.api.post(path, { data, headers: { Cookie: staff.cookie } });
  return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
}

async function board(staff: { api: APIRequestContext; cookie: string }) {
  const res = await staff.api.get("/api/admin/board", { headers: { Cookie: staff.cookie } });
  return (await res.json()) as { columns: Record<string, { id: string; number: number; alert: string; status: string; paymentStatus: string }[]> };
}

/** Adds a dish through the storefront's own UI (search + add) and opens the checkout. */
async function orderOneDish(page: Page, storefront: string, query = "gyozas", itemId = "gyozas-de-pollo-a-la-plancha") {
  await page.goto(`${SITE}/${storefront}/`);
  await visible(page.getByTestId("go-to-menu")).click();
  await visible(page.getByTestId("menu-search")).fill(query);
  await visible(page.getByTestId(`add-${itemId}`)).click();
  const panel = page.getByTestId("cart-panel");
  if (!(await panel.isVisible())) await visible(page.getByTestId("cart-open")).click();
  await visible(panel.getByTestId("checkout-start")).click();
  await expect(page).toHaveURL(/\/pedido\/(\?.*)?$/);
}

async function fillCheckout(page: Page, name = "Pedro Ruiz") {
  await page.locator('[name="name"]').fill(name);
  await page.locator('[name="phone"]').fill("612 345 678");
  await page.locator('[name="email"]').fill("pedro@example.es");
  await page.locator('[name="notes"]').fill("Sin cebolla");
  await visible(page.getByTestId("checkout-pay")).click();
  await expect(page).toHaveURL(/localhost:8790\/pay\/cs_test_/);
}

/** Authorises on the fake Stripe page and lands on the status page. Returns the order id. */
async function authorise(page: Page): Promise<string> {
  await page.getByTestId("fake-stripe-pay").click();
  await expect(page).toHaveURL(/\/pedido\/estado\/\?pedido=SH-/);
  const status = visible(page.getByTestId("order-status"));
  await expect(status).toHaveAttribute("data-status", "awaiting_acceptance");
  await expect(status).toHaveAttribute("data-payment-status", "authorized");
  return new URL(page.url()).searchParams.get("pedido") ?? "";
}

// ---------------------------------------------------------------------------
// The restaurant's phone: the SHANG HAI — PEDIDOS panel
// ---------------------------------------------------------------------------

/** The restaurant's phone: one browser context kept for the whole run, signed in through the UI. */
let staffContext: BrowserContext | null = null;

async function staffPhone(browser: Browser): Promise<Page> {
  if (!staffContext) {
    staffContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const phone = await staffContext.newPage();
    await phone.goto(`${WORKER}/admin`);
    await phone.getByRole("button", { name: /Enviar código/i }).click();
    const codeShown = await phone
      .locator("#code")
      .waitFor({ state: "visible", timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (!codeShown) {
      await phone.waitForTimeout(31_000); // a code was sent less than 30 s ago
      await phone.getByRole("button", { name: /Enviar código/i }).click();
    }
    await expect(phone.locator("#code")).toBeVisible();
    const message = (await cloudState()).telegram.filter((m) => m.text.includes("Código")).at(-1);
    await phone.locator("#code").fill(/\b(\d{6})\b/.exec(message?.text ?? "")?.[1] ?? "");
    await phone.locator("#device").fill("Móvil de cocina");
    await phone.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(phone.getByRole("tab", { name: /Nuevos/ })).toBeVisible();
    // The API helpers reuse this phone's session instead of asking for another code.
    const cookie = (await staffContext.cookies(WORKER)).find((c) => c.name === "__Host-shp_session");
    expect(cookie?.httpOnly).toBe(true);
    const api = await playwrightRequest.newContext({ baseURL: WORKER, extraHTTPHeaders: { Origin: WORKER } });
    cachedStaff = Promise.resolve({ api, cookie: `${cookie!.name}=${cookie!.value}` });
    return phone;
  }
  const phone = await staffContext.newPage();
  await phone.goto(`${WORKER}/admin`);
  return phone;
}

test("panel: the staff phone signs in with the code sent by Telegram", async ({ browser }) => {
  const phone = await staffPhone(browser);
  await expect(phone.getByRole("tab", { name: /Nuevos/ })).toBeVisible();
  await phone.close();
});

test("panel: a new order arrives, ACEPTAR 20 min, LISTO, ENTREGADO — the customer's phone follows", async ({ page, browser }) => {
  await orderOneDish(page, "bento-club");
  await fillCheckout(page);
  const orderId = await authorise(page);

  const phone = await staffPhone(browser);
  const ticket = phone.locator(`article[data-id="${orderId}"]`).first();
  await expect(ticket).toBeVisible({ timeout: 15_000 });
  await expect(ticket).toContainText("Sin cebolla");
  await ticket.getByRole("button", { name: /Aceptar pedido/i }).click();
  await phone.locator("label.prep__opt", { hasText: "20 min" }).click();
  await phone.getByRole("button", { name: /Aceptar · listo en 20 min/ }).click();

  const status = visible(page.getByTestId("order-status"));
  await expect(status).toHaveAttribute("data-status", "preparing", { timeout: 20_000 });
  await expect(status).toHaveAttribute("data-payment-status", "captured");

  await phone.locator("#tab-preparing").click();
  await phone.locator(`article[data-id="${orderId}"]`).first().getByRole("button", { name: /Marcar como listo/i }).click();
  await expect(status).toHaveAttribute("data-status", "ready", { timeout: 30_000 });

  await phone.locator("#tab-ready").click();
  await phone.locator(`article[data-id="${orderId}"]`).first().getByRole("button", { name: /Marcar como entregado/i }).click();
  await expect(status).toHaveAttribute("data-status", "completed", { timeout: 40_000 });
  await phone.close();
});

test("panel: RECHAZAR with a reason — the customer is told nothing was charged", async ({ page, browser }) => {
  await orderOneDish(page, "ink-house");
  await fillCheckout(page);
  const orderId = await authorise(page);

  const phone = await staffPhone(browser);
  const ticket = phone.locator(`article[data-id="${orderId}"]`).first();
  await expect(ticket).toBeVisible({ timeout: 15_000 });
  await ticket.getByRole("button", { name: /Rechazar pedido/i }).click();
  await phone.locator(`#reason-${orderId}`).fill("Nos hemos quedado sin gyozas");
  await phone.getByRole("button", { name: /Confirmar rechazo/i }).click();

  const status = visible(page.getByTestId("order-status"));
  await expect(status).toHaveAttribute("data-status", "rejected", { timeout: 20_000 });
  await expect(status).toHaveAttribute("data-payment-status", "canceled");
  await expect(page.getByText("Nos hemos quedado sin gyozas").first()).toBeVisible();
  await expect(page.getByText(/no se te ha cobrado nada/i).first()).toBeVisible();
  await phone.close();
});

for (const storefront of ["bento-club", "ink-house", "wok-after-dark"] as const) {
  test(`${storefront}: customer orders on the phone, the restaurant accepts (20 min) and marks it ready`, async ({ page }) => {
    const errors = trackErrors(page);
    await orderOneDish(page, storefront);
    await fillCheckout(page);
    const orderId = await authorise(page);

    // Telegram alert: number and total, never the customer's details.
    const alert = (await cloudState()).telegram.filter((m) => m.text.includes("NUEVO PEDIDO")).at(-1);
    expect(alert?.button?.url).toBe(`${WORKER}/admin#pedido=${orderId}`);
    for (const secret of ["Pedro", "612", "pedro@example.es", "Sin cebolla"]) expect(alert?.text).not.toContain(secret);

    const staff = await staffSession();
    const newOrders = (await board(staff)).columns.new.map((o) => o.id);
    expect(newOrders).toContain(orderId);
    const accepted = await staffPost(staff, `/api/admin/orders/${orderId}/accept`, { prepMinutes: 20 });
    expect(accepted.status).toBe(200);

    // The customer's phone updates by itself: accepted, in preparation, with the time the restaurant set.
    const status = visible(page.getByTestId("order-status"));
    await expect(status).toHaveAttribute("data-status", "preparing", { timeout: 20_000 });
    await expect(status).toHaveAttribute("data-payment-status", "captured");
    await expect(page.getByText(/listo hacia las \d{2}:\d{2}/i).first()).toBeVisible();
    const pi = (await cloudState()).intents.find((i) => i.order === orderId);
    expect(pi?.status).toBe("succeeded");
    expect((await cloudState()).intents.filter((i) => i.order === orderId)).toHaveLength(1);

    expect((await staffPost(staff, `/api/admin/orders/${orderId}/ready`)).status).toBe(200);
    await expect(status).toHaveAttribute("data-status", "ready", { timeout: 30_000 });
    expect((await staffPost(staff, `/api/admin/orders/${orderId}/complete`)).status).toBe(200);
    await expect(status).toHaveAttribute("data-status", "completed", { timeout: 40_000 });
    expect(errors).toEqual([]);
  });
}

test("English customer: Stripe and the status page in English; the restaurant declines with a reason", async ({ page }) => {
  await page.goto(`${SITE}/bento-club/`);
  await visible(page.getByTestId("language-en")).click();
  await orderOneDish(page, "bento-club", "peking duck", "pato-a-la-pekinesa");
  await fillCheckout(page, "Jane Smith");
  await expect(page.getByText("Authorise payment (test card 4242)")).toBeVisible();
  await expect(page.getByText("Pato a la Pekinesa")).toHaveCount(0); // line names in English on Stripe
  const orderId = await authorise(page);
  expect(page.url()).toContain("lang=en");

  const staff = await staffSession();
  const rejected = await staffPost(staff, `/api/admin/orders/${orderId}/reject`, { reason: "Kitchen closed" });
  expect(rejected.status).toBe(200);
  const status = visible(page.getByTestId("order-status"));
  await expect(status).toHaveAttribute("data-status", "rejected", { timeout: 20_000 });
  await expect(status).toHaveAttribute("data-payment-status", "canceled");
  await expect(page.getByText("Kitchen closed").first()).toBeVisible();
  await expect(page.getByText(/not been charged|not charged/i).first()).toBeVisible();
  expect((await cloudState()).intents.find((i) => i.order === orderId)?.status).toBe("canceled");
});

test("a declined card can be retried; a cancelled payment returns to the order with a notice", async ({ page }) => {
  await orderOneDish(page, "ink-house");
  await fillCheckout(page);
  await page.getByTestId("fake-stripe-decline").click();
  await expect(page.getByText(/Tarjeta rechazada/)).toBeVisible();
  const orderId = await authorise(page);
  expect(orderId).toMatch(/^SH-/);

  await orderOneDish(page, "wok-after-dark");
  await fillCheckout(page);
  await page.getByTestId("fake-stripe-cancel").click();
  await expect(page).toHaveURL(/\/pedido\/\?cancelado=1/);
  await expect(page.getByText(/pago cancelado/i).first()).toBeVisible();
  await expect(page.getByTestId("checkout-pay").filter({ visible: true })).toBeVisible();
});

test("two ACEPTAR taps at the same time: only one capture", async ({ page }) => {
  await orderOneDish(page, "bento-club");
  await fillCheckout(page);
  const orderId = await authorise(page);
  // The guard is on the order, whatever the device (two distinct sessions: Worker unit tests).
  const staff = await staffSession();
  const results = await Promise.all([
    staffPost(staff, `/api/admin/orders/${orderId}/accept`, { prepMinutes: 15 }),
    staffPost(staff, `/api/admin/orders/${orderId}/accept`, { prepMinutes: 30 }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  await expect(visible(page.getByTestId("order-status"))).toHaveAttribute("data-status", "preparing", { timeout: 20_000 });
});

test("Telegram fails: the order is still on the panel and is never declined automatically", async ({ page }) => {
  await control("/__control/telegram/fail", { status: 403 });
  await control("/__control/telegram/fail", { status: 403 });
  await orderOneDish(page, "ink-house");
  await fillCheckout(page);
  const orderId = await authorise(page);
  const staff = await staffSession();
  const card = (await board(staff)).columns.new.find((o) => o.id === orderId);
  expect(card).toMatchObject({ status: "awaiting_acceptance", alert: "failed" });
});

test("a refund that fails leaves the order IN REVIEW and the customer sees it is being reviewed", async ({ page }) => {
  await orderOneDish(page, "wok-after-dark");
  await fillCheckout(page);
  const orderId = await authorise(page);
  const staff = await staffSession();
  expect((await staffPost(staff, `/api/admin/orders/${orderId}/accept`, { prepMinutes: 20 })).status).toBe(200);
  await control("/__control/stripe/refund-outcome", { outcome: "failed" });
  const cancelled = await staffPost(staff, `/api/admin/orders/${orderId}/reject`, { reason: "Avería en cocina" });
  await control("/__control/stripe/refund-outcome", { outcome: "succeeded" });
  expect(cancelled.status).toBe(502);
  expect(cancelled.body.order).toMatchObject({ status: "needs_review", paymentStatus: "refund_failed" });
  const status = visible(page.getByTestId("order-status"));
  await expect(status).toHaveAttribute("data-status", "needs_review", { timeout: 30_000 });
  await expect(status).toHaveAttribute("data-payment-status", "refund_failed");
  // Retrying the refund from the panel completes it.
  const retried = await staffPost(staff, `/api/admin/orders/${orderId}/reject`, { reason: "Avería en cocina" });
  expect(retried.body.order).toMatchObject({ status: "rejected", paymentStatus: "refunded" });
});

test("losing the connection keeps the last known status on screen and recovers", async ({ page }) => {
  await orderOneDish(page, "bento-club");
  await fillCheckout(page);
  await authorise(page);
  await page.route("**/api/orders/**", (route) => route.abort("internetdisconnected"));
  await expect(page.getByText(/Sin conexión/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(visible(page.getByTestId("order-status"))).toHaveAttribute("data-status", "awaiting_acceptance");
  await page.unroute("**/api/orders/**");
  await expect(page.getByText(/Sin conexión/i)).toHaveCount(0, { timeout: 30_000 });
});

// ---------------------------------------------------------------------------
// The complete journey, step by step, in the three designs and both languages,
// with the final state checked at Stripe (fake) and in D1 — not only on screen.
// ---------------------------------------------------------------------------

async function openCart(page: Page) {
  const panel = page.getByTestId("cart-panel");
  if (!(await panel.isVisible())) await visible(page.getByTestId("cart-open")).click();
  await expect(panel).toBeVisible();
  return panel;
}

async function staffDetail(id: string) {
  const staff = await staffSession();
  const res = await staff.api.get(`/api/admin/orders/${id}`, { headers: { Cookie: staff.cookie } });
  expect(res.status()).toBe(200);
  return (await res.json()) as {
    order: {
      status: string;
      totalCents: number;
      lines: { quantity: number; name: string; lineTotalCents: number }[];
      payment: { status: string; stripePaymentIntentId: string };
      events: { to: string; source: string }[];
    };
  };
}

const GYOZAS = "gyozas-de-pollo-a-la-plancha"; // 6,45 €
const COMBO_A = "combo-a"; // 19,45 €
const JOURNEY_TOTAL = 3 * 645 + 1945; // 38,80 €

for (const storefront of ["ink-house", "wok-after-dark", "bento-club"] as const) {
  for (const locale of ["es", "en"] as const) {
    test(`full journey · ${storefront} · ${locale}: cart edits, reload, pay, alert, accept, ready, delivered — verified at Stripe and in D1`, async ({ page, browser }) => {
      const errors = trackErrors(page);
      const money = (es: string, en: string) => (locale === "en" ? en : es);

      // 1. The customer opens the web (fresh browser storage), in their language.
      await page.goto(`${SITE}/${storefront}/`);
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      if (locale === "en") await visible(page.getByTestId("language-en")).click();
      // 2. Browses the menu.
      await visible(page.getByTestId("go-to-menu")).click();
      // 3-4. Adds one dish, then several.
      await visible(page.getByTestId("menu-search")).fill(locale === "en" ? "peking duck" : "pato pekin");
      await visible(page.getByTestId("add-pato-a-la-pekinesa")).click();
      await visible(page.getByTestId("menu-search")).fill("gyozas");
      await visible(page.getByTestId(`add-${GYOZAS}`)).click();
      await visible(page.getByTestId("menu-search")).fill("combo a");
      await visible(page.getByTestId(`add-${COMBO_A}`)).click();
      // 5. Changes a quantity.
      const panel = await openCart(page);
      const gyozas = panel.getByTestId(`cart-line-${GYOZAS}`);
      await gyozas.getByTestId("qty-inc").click();
      await gyozas.getByTestId("qty-inc").click();
      await expect(gyozas.getByTestId("line-qty")).toHaveText(/3/);
      // 6. Removes a dish.
      await panel.getByTestId("cart-line-pato-a-la-pekinesa").getByTestId("line-remove").click();
      await expect(panel.getByTestId("cart-line-pato-a-la-pekinesa")).toHaveCount(0);
      await expect(panel.getByTestId("cart-total")).toContainText(money("38,80", "€38.80"));
      // 7-8. Reloads the page: the cart is still there, same lines, same total.
      await page.reload();
      const restored = await openCart(page);
      await expect(restored.getByTestId(`cart-line-${GYOZAS}`).getByTestId("line-qty")).toHaveText(/3/);
      await expect(restored.getByTestId(`cart-line-${COMBO_A}`)).toBeVisible();
      await expect(restored.getByTestId("cart-total")).toContainText(money("38,80", "€38.80"));
      // 9-10. Fills in their details and starts the payment: Stripe shows the same total.
      await visible(restored.getByTestId("checkout-start")).click();
      await fillCheckout(page, locale === "en" ? "Jane Smith" : "Pedro Ruiz");
      await expect(page.getByText("38,80 €").first()).toBeVisible();
      // 11. Authorises the payment (held, not charged).
      const orderId = await authorise(page);
      if (locale === "en") expect(page.url()).toContain("lang=en");
      let detail = await staffDetail(orderId);
      expect(detail.order).toMatchObject({ status: "awaiting_acceptance", totalCents: JOURNEY_TOTAL, payment: { status: "authorized" } });
      expect(detail.order.lines.map((l) => [l.quantity, l.lineTotalCents]).sort()).toEqual([[1, 1945], [3, 1935]].sort());
      const piId = detail.order.payment.stripePaymentIntentId;
      expect((await cloudState()).intents.find((i) => i.id === piId)).toMatchObject({ status: "requires_capture", order: orderId });

      // 12. The restaurant is alerted on both authorised phones: number and total, no personal data.
      await expect
        .poll(async () => (await cloudState()).telegram.filter((m) => m.text.includes("NUEVO PEDIDO") && m.button?.url.endsWith(orderId)).length, { timeout: 15_000 })
        .toBe(2);
      const alert = (await cloudState()).telegram.filter((m) => m.button?.url.endsWith(orderId)).at(-1);
      expect(alert?.text).toContain("38,80");
      for (const secret of ["Pedro", "Jane", "612", "@example.es", "Sin cebolla"]) expect(alert?.text).not.toContain(secret);

      // 13. A worker opens the order from the alert's VER PEDIDO button.
      const phone = await staffPhone(browser);
      await phone.goto(alert!.button!.url);
      const detailView = phone.locator("#detail");
      await expect(detailView).toBeVisible({ timeout: 15_000 });
      await expect(detailView).toContainText("Sin cebolla");
      // 14. Accepts it with 20 minutes.
      await detailView.getByRole("button", { name: /Aceptar pedido/i }).click();
      await phone.locator("label.prep__opt", { hasText: "20 min" }).click();
      await phone.getByRole("button", { name: /Aceptar · listo en 20 min/ }).click();

      // 15-16. Stripe confirms the capture, and the customer's page shows it by itself.
      const status = visible(page.getByTestId("order-status"));
      await expect(status).toHaveAttribute("data-status", "preparing", { timeout: 20_000 });
      await expect(status).toHaveAttribute("data-payment-status", "captured");
      expect((await cloudState()).intents.find((i) => i.id === piId)).toMatchObject({ status: "succeeded" });
      detail = await staffDetail(orderId);
      expect(detail.order).toMatchObject({ status: "preparing", payment: { status: "captured" } });

      // 17-18. LISTO → the customer sees "ready".
      await phone.goto(`${WORKER}/admin`);
      await phone.locator("#tab-preparing").click();
      await phone.locator(`article[data-id="${orderId}"]`).first().getByRole("button", { name: /Marcar como listo/i }).click();
      await expect(status).toHaveAttribute("data-status", "ready", { timeout: 30_000 });
      // 19-20. ENTREGADO → the customer sees "collected".
      await phone.locator("#tab-ready").click();
      await phone.locator(`article[data-id="${orderId}"]`).first().getByRole("button", { name: /Marcar como entregado/i }).click();
      await expect(status).toHaveAttribute("data-status", "completed", { timeout: 40_000 });
      await phone.close();

      // Final truth: D1 and Stripe agree — charged once, the order total, nothing refunded.
      detail = await staffDetail(orderId);
      expect(detail.order).toMatchObject({ status: "completed", totalCents: JOURNEY_TOTAL, payment: { status: "captured" } });
      expect(detail.order.events.map((e) => e.to)).toEqual(expect.arrayContaining(["awaiting_acceptance", "accepting", "preparing", "ready", "completed"]));
      const stripe = await cloudState();
      expect(stripe.intents.filter((i) => i.order === orderId)).toHaveLength(1);
      // The status page emptied the cart that produced this order.
      await page.goto(`${SITE}/${storefront}/`);
      await expect(page.getByTestId(`cart-line-${GYOZAS}`)).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
}
