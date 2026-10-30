import { defineConfig } from "@playwright/test";

/**
 * E2E tests for the Shang Hai storefronts, run against the real static export
 * (`npm run build` first) served under the GitHub Pages base path.
 * Uses the locally installed Google Chrome (channel "chrome"): no browser download.
 */
const PORT = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: "tests/shang-hai/e2e",
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: `http://127.0.0.1:${PORT}/mangocat-test/`,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
  },
  projects: [
    {
      name: "mobile-390",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    { name: "tablet-768", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `PORT=${PORT} node scripts/serve-static.mjs`,
    url: `http://127.0.0.1:${PORT}/mangocat-test/`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});
