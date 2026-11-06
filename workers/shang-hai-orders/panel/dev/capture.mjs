#!/usr/bin/env node
/**
 * Visual + accessibility check of the staff panel against the mock API (serve-mock.mjs):
 * screenshots at phone/tablet/desktop sizes, axe-core on the board and sheets, and every
 * console error / CSP violation reported by Chrome.
 *
 *   node panel/dev/capture.mjs <output-dir> [--only board,signin,...]
 *
 * Needs @playwright/test and @axe-core/playwright (repo root devDependencies) and Google
 * Chrome installed (channel "chrome").
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startMockServer } from "./serve-mock.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const require = createRequire(join(ROOT, "package.json"));
const { chromium } = require("@playwright/test");
const { default: AxeBuilder } = require("@axe-core/playwright");

const outDir = resolve(process.argv[2] ?? "panel-screens");
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg > -1 ? new Set(process.argv[onlyArg + 1].split(",")) : null;
mkdirSync(outDir, { recursive: true });

const PHONE = { width: 390, height: 844 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1280, height: 800 };

const problems = [];
const axeReport = [];

async function reset(base, scenario) {
  await fetch(`${base}/__mock/reset?scenario=${scenario}`, { method: "POST" });
}

async function newPage(browser, viewport, { colorScheme = "light", reducedMotion = "reduce" } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme, reducedMotion, locale: "es-ES", timezoneId: "Europe/Madrid", hasTouch: viewport.width < 1024, isMobile: false });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") problems.push(`[console.${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => problems.push(`[pageerror] ${err.message}`));
  return { context, page };
}

async function axe(page, label) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  axeReport.push({ label, violations: results.violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`) });
  return serious.length;
}

async function shot(page, name, { fullPage = false } = {}) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage });
  console.log(`  ${name}.png`);
}

const scenarios = {
  async board(browser, base) {
    await reset(base, "board");
    const { context, page } = await newPage(browser, PHONE);
    await page.goto(`${base}/admin`);
    await page.locator(".tk").first().waitFor();
    await shot(page, "01-board-new-390");
    await axe(page, "board (new)");
    await shot(page, "01b-board-new-390-full", { fullPage: true });
    await context.close();
  },

  async sheets(browser, base) {
    await reset(base, "board");
    const { context, page } = await newPage(browser, PHONE);
    await page.goto(`${base}/admin`);
    await page.locator(".tk--new").first().waitFor();
    await page.locator('.tk--new button[data-action="accept"]').first().click();
    await page.locator("dialog[open]").waitFor();
    await page.locator('dialog[open] input[value="20"]').check({ force: true });
    await shot(page, "02-accept-sheet-390");
    await axe(page, "accept sheet");
    await page.keyboard.press("Escape");
    await page.locator('.tk--new button[data-action="reject"]').first().click();
    await page.locator("dialog[open]").waitFor();
    await page.locator("dialog[open] .reason-chip").first().click();
    await shot(page, "03-reject-sheet-390");
    await axe(page, "reject sheet");
    await page.keyboard.press("Escape");
    // Accept for real: toast + the card moves to EN PREPARACIÓN
    await page.locator('.tk--new button[data-action="accept"]').first().click();
    await page.locator('dialog[open] input[value="30"]').check({ force: true });
    await page.locator('dialog[open] button[type="submit"]').click();
    await page.locator(".toast").first().waitFor();
    await shot(page, "04-accepted-toast-390");
    // 409 from "another phone"
    const emily = page.locator(".tk--new", { hasText: "Emily" }).locator('button[data-action="accept"]');
    if (await emily.count()) {
      await emily.click();
      await page.locator('dialog[open] input[value="15"]').check({ force: true });
      await page.locator('dialog[open] button[type="submit"]').click();
      await page.locator(".toast--warn").first().waitFor();
      await shot(page, "05-conflict-409-390");
    }
    await context.close();
  },

  async columns(browser, base) {
    await reset(base, "board");
    const { context, page } = await newPage(browser, PHONE);
    await page.goto(`${base}/admin`);
    await page.locator(".tk").first().waitFor();
    await page.locator("#tab-preparing").click();
    await page.locator(".tk--prep").first().waitFor();
    await shot(page, "06-preparing-390");
    await axe(page, "preparing");
    await shot(page, "06b-preparing-390-full", { fullPage: true });
    await page.locator("#tab-ready").click();
    await page.locator(".tk--ready").first().waitFor();
    await shot(page, "07-ready-390");
    await axe(page, "ready");
    await shot(page, "07b-ready-390-full", { fullPage: true });
    await page.locator("#tab-completed").click();
    await shot(page, "08-completed-390");
    await page.locator("#tab-rejected").click();
    await shot(page, "09-rejected-390");
    await context.close();
  },

  async review(browser, base) {
    await reset(base, "board");
    const { context, page } = await newPage(browser, PHONE);
    await page.goto(`${base}/admin`);
    await page.locator(".tk--review").first().waitFor();
    await page.locator(".tk--review").first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo({ top: document.querySelector(".tk--review").getBoundingClientRect().top + window.scrollY - 90 }));
    await shot(page, "10-needs-review-390");
    await context.close();
  },

  async detail(browser, base) {
    await reset(base, "board");
    const { context, page } = await newPage(browser, PHONE);
    await page.goto(`${base}/admin#pedido=SH-261105-1046AB`);
    await page.locator(".panel").first().waitFor();
    await shot(page, "11-detail-390");
    await axe(page, "detail");
    await shot(page, "11b-detail-390-full", { fullPage: true });
    await context.close();
  },

  async system(browser, base) {
    await reset(base, "board");
    const { context, page } = await newPage(browser, PHONE);
    await page.goto(`${base}/admin`);
    await page.locator(".tk").first().waitFor();
    await page.locator("#menu").click();
    await page.locator("dialog[open]").waitFor();
    await shot(page, "12-system-sheet-390");
    await axe(page, "system sheet");
    await context.close();
  },

  async signin(browser, base) {
    await reset(base, "signin");
    const { context, page } = await newPage(browser, PHONE);
    await page.goto(`${base}/admin`);
    await page.locator(".signin__card").waitFor();
    await shot(page, "13-signin-390");
    await axe(page, "sign-in");
    await page.getByRole("button", { name: /enviar código/i }).click();
    await page.locator("#code").waitFor();
    await page.locator("#code").fill("123456");
    await page.locator("#device").fill("Móvil de Pedro");
    await shot(page, "14-signin-code-390");
    await reset(base, "access");
    await page.goto(`${base}/admin`);
    await page.locator(".signin__card").waitFor();
    await shot(page, "15-signin-access-390");
    await context.close();
  },

  async offline(browser, base) {
    await reset(base, "board");
    const { context, page } = await newPage(browser, PHONE);
    await page.goto(`${base}/admin`);
    await page.locator(".tk").first().waitFor();
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await page.locator(".banner--offline").waitFor({ timeout: 15_000 });
    await shot(page, "16-offline-390");
    await context.setOffline(false);
    await context.close();
  },

  async tablet(browser, base) {
    await reset(base, "board");
    const { context, page } = await newPage(browser, TABLET);
    await page.goto(`${base}/admin`);
    await page.locator(".tk").first().waitFor();
    await shot(page, "17-board-768");
    await page.locator("#tab-preparing").click();
    await shot(page, "18-preparing-768");
    await context.close();
  },

  async desktop(browser, base) {
    await reset(base, "board");
    const { context, page } = await newPage(browser, DESKTOP);
    await page.goto(`${base}/admin`);
    await page.locator(".tk").first().waitFor();
    await shot(page, "19-board-1280");
    await axe(page, "board desktop");
    await context.close();
  },

  async dark(browser, base) {
    await reset(base, "board");
    const { context, page } = await newPage(browser, PHONE, { colorScheme: "dark" });
    await page.goto(`${base}/admin`);
    await page.locator(".tk").first().waitFor();
    await shot(page, "20-board-dark-390");
    await axe(page, "board dark");
    await context.close();
  },

  async alert(browser, base) {
    await reset(base, "board");
    const { context, page } = await newPage(browser, PHONE);
    await page.goto(`${base}/admin`);
    await page.locator(".tk").first().waitFor();
    await page.locator("#tab-preparing").click();
    await fetch(`${base}/__mock/new-order`, { method: "POST" });
    await page.locator(".newbar").waitFor({ timeout: 15_000 });
    const title = await page.title();
    console.log(`  title after new order: ${title}`);
    await shot(page, "21-new-order-bar-390");
    await context.close();
  },
};

const { server, url } = await startMockServer({ port: 0 });
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const [name, run] of Object.entries(scenarios)) {
    if (only && !only.has(name)) continue;
    console.log(`${name}:`);
    await run(browser, url);
  }
} finally {
  await browser.close();
  server.close();
}

console.log("\nConsole errors/warnings:", problems.length ? `\n${[...new Set(problems)].join("\n")}` : "none");
console.log("\nAxe:");
for (const entry of axeReport) console.log(`- ${entry.label}: ${entry.violations.length ? `\n    ${entry.violations.join("\n    ")}` : "no violations"}`);
