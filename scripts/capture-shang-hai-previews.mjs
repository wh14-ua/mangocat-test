#!/usr/bin/env node
/**
 * Captures REAL screenshots of the three Shang Hai storefronts from the static build.
 *
 *   npm run build
 *   node scripts/capture-shang-hai-previews.mjs           # comparison-page previews
 *   node scripts/capture-shang-hai-previews.mjs --qa      # + QA set at 390/768/1440
 *
 * Previews (committed, used by /showcase/shang-hai/):
 *   public/images/shang-hai/previews/<id>-desktop.webp  (1440x900 viewport)
 *   public/images/shang-hai/previews/<id>-mobile.webp   (390x844 viewport)
 * QA captures (local only, gitignored): screenshots/shang-hai/<id>/...
 *
 * Uses the system Google Chrome through Playwright (no browser download) and the local
 * static server (scripts/serve-static.mjs). Captures use ?presentacion=0 to hide the
 * MangoCat presentation bar and prefers-reduced-motion so every frame is final.
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 4299);
const ORIGIN = `http://127.0.0.1:${PORT}/mangocat-test`;
const QA = process.argv.includes("--qa");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const STOREFRONTS = ["ink-house", "wok-after-dark", "bento-club"].filter((s) => !ONLY || s === ONLY);

const previewsDir = join(ROOT, "public/images/shang-hai/previews");
const qaDir = join(ROOT, "screenshots/shang-hai");

async function waitForServer(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server not reachable at ${url}`);
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  // Let visible images decode (lazy or hidden images may never load: cap the wait).
  await page.evaluate(async () => {
    const inView = (i) => {
      const r = i.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top < innerHeight * 1.2 && r.bottom > 0;
    };
    const imgs = [...document.images].filter((i) => !i.complete && inView(i));
    const timeout = new Promise((r) => setTimeout(r, 4000));
    await Promise.race([Promise.all(imgs.map((i) => i.decode().catch(() => null))), timeout]);
  });
  await page.waitForTimeout(400);
}

async function toWebp(png, out, width) {
  await sharp(png).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
}

const server = spawn(process.execPath, [join(ROOT, "scripts/serve-static.mjs")], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: "ignore",
});

try {
  await waitForServer(`${ORIGIN}/`);
  await mkdir(previewsDir, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });

  for (const id of STOREFRONTS) {
    const url = `${ORIGIN}/showcase/shang-hai/${id}/?presentacion=0`;

    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
      locale: "es-ES",
    });
    const dp = await desktop.newPage();
    await dp.goto(url);
    await settle(dp);
    await toWebp(await dp.screenshot(), join(previewsDir, `${id}-desktop.webp`), 1600);

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
      locale: "es-ES",
    });
    const mp = await mobile.newPage();
    await mp.goto(url);
    await settle(mp);
    await toWebp(await mp.screenshot(), join(previewsDir, `${id}-mobile.webp`), 640);
    console.log(`previews: ${id}`);

    if (QA) {
      const dir = join(qaDir, id);
      await mkdir(dir, { recursive: true });
      for (const [w, h] of [
        [390, 844],
        [768, 1024],
        [1440, 900],
      ]) {
        const ctx = await browser.newContext({
          viewport: { width: w, height: h },
          deviceScaleFactor: 1,
          isMobile: w < 500,
          hasTouch: w < 500,
          reducedMotion: "reduce",
          locale: "es-ES",
        });
        const p = await ctx.newPage();
        await p.goto(url);
        await settle(p);
        await p.screenshot({ path: join(dir, `home-${w}.png`) });
        await p.screenshot({ path: join(dir, `home-${w}-full.png`), fullPage: true });
        await p.goto(`${ORIGIN}/showcase/shang-hai/${id}/pedido/?presentacion=0`);
        await settle(p);
        await p.screenshot({ path: join(dir, `checkout-${w}.png`), fullPage: true });
        await ctx.close();
      }
      console.log(`qa: ${id}`);
    }
    await desktop.close();
    await mobile.close();
  }
  await browser.close();
} finally {
  server.kill();
}
