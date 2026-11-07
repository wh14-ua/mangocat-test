import { defineConfig } from "@playwright/test";

/**
 * End-to-end journeys of the REAL ordering system (not the demo simulator):
 * storefront build pointed at the local Worker (wrangler dev + local D1), a fake Stripe with
 * its hosted payment page and signed webhooks, and a fake Telegram. No real money, no
 * external accounts. Build the storefronts first: `node scripts/local-stack/run.mjs --build-only`
 * (or simply `npm run test:e2e:ordering`).
 */
export default defineConfig({
  testDir: "tests/shang-hai/e2e-ordering",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results/ordering",
  use: {
    // System Chrome locally; CI installs Playwright's Chromium (PW_CHANNEL unset there).
    ...(process.env.CI && !process.env.PW_CHANNEL ? {} : { channel: process.env.PW_CHANNEL ?? "chrome" }),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
  },
  projects: [
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
  ],
  webServer: [
    {
      // Its own state dir (.local-stack-e2e, wiped at start): never the demo's data.
      command: "LOCAL_STACK_STATE=.local-stack-e2e CRON_EVERY_MS=3000 node scripts/local-stack/run.mjs --backend-only --fresh",
      url: "http://localhost:8787/api/health",
      reuseExistingServer: false,
      timeout: 120_000,
      // run.mjs stops wrangler/workerd and the fake cloud (their own process groups) on SIGTERM.
      gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
    },
    {
      command: "PORT=4174 HOST=localhost STATIC_ROOT=out-local node scripts/serve-static.mjs",
      url: "http://localhost:4174/mangocat-test/",
      reuseExistingServer: false,
      timeout: 20_000,
    },
  ],
});
