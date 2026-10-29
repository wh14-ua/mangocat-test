#!/usr/bin/env node
/**
 * Screenshots of the purchase journey on each Shang Hai proposal (demo mode), for sales
 * decks and visual QA: home, menu with a dish added, cart, filled checkout, order status.
 *
 *   npm run build && node scripts/capture-shang-hai-journey.mjs
 *   -> screenshots/shang-hai/journey/<proposal>-<step>-<width>.png  (gitignored)
 *
 * Drives the pages through the same data-testid contract as the E2E tests.
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 4298);
const ORIGIN = `http://127.0.0.1:${PORT}/mangocat-test/showcase/shang-hai`;
const OUT = join(ROOT, "screenshots/shang-hai/journey");
const STOREFRONTS = ["ink-house", "wok-after-dark", "bento-club"];
const WIDTHS = [
  [390, 844],
  [1440, 900],
];

const server = spawn(process.execPath, [join(ROOT, "scripts/serve-static.mjs")], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: "ignore",
});

const visible = (locator) => locator.filter({ visible: true }).first();

try {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${ORIGIN}/`)).ok) break;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });

  for (const id of STOREFRONTS) {
    for (const [w, h] of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        deviceScaleFactor: 1,
        isMobile: w < 500,
        hasTouch: w < 500,
        reducedMotion: "reduce",
        locale: "es-ES",
      });
      const page = await ctx.newPage();
      const shot = (step) => page.screenshot({ path: join(OUT, `${id}-${step}-${w}.png`) });

      await page.goto(`${ORIGIN}/${id}/?presentacion=0`);
      await page.evaluate(() => document.fonts.ready);
      await shot("1-home");

      await visible(page.getByTestId("go-to-menu")).click();
      await visible(page.getByTestId("menu-search")).fill("pato");
      await visible(page.getByTestId("add-pato-a-la-pekinesa")).click();
      await page.waitForTimeout(300);
      await shot("2-menu");

      await visible(page.getByTestId("menu-search")).fill("combo b");
      await visible(page.getByTestId("add-combo-b")).click();
      const panel = page.getByTestId("cart-panel");
      if (!(await panel.isVisible())) await visible(page.getByTestId("cart-open")).click();
      await page.waitForTimeout(300);
      await shot("3-cart");

      await visible(panel.getByTestId("checkout-start")).click();
      await page.waitForURL(/\/pedido\/$/);
      await page.locator('[name="name"]').fill("Lucía Martínez");
      await page.locator('[name="phone"]').fill("612 345 678");
      await page.locator('[name="email"]').fill("lucia@example.es");
      await page.locator('[name="notes"]').fill("Sin cebolla, por favor.");
      await shot("4-checkout");

      await visible(page.getByTestId("checkout-pay")).click();
      await page.waitForURL(/pago-demo/);
      await shot("5-demo-payment");
      await page.getByTestId("demo-pay-approve").click();
      await page.waitForURL(/pedido\/estado/);
      await visible(page.getByTestId("demo-advance")).click();
      await page.waitForTimeout(400);
      await shot("6-status");

      await ctx.close();
      console.log(`journey: ${id} @ ${w}`);
    }
  }
  await browser.close();
} finally {
  server.kill();
}
