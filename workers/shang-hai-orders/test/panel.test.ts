import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { expectedModule, GENERATED_PATH, typecheckClient } from "../panel/build.mjs";
import { PANEL_CSS, PANEL_JS } from "../panel/generated/assets";
import { PANEL_MANIFEST, panelAsset, panelHtml } from "../panel/server";
import { call, world } from "./helpers";

const PANEL_DIR = fileURLToPath(new URL("../panel/", import.meta.url));
const CLIENT_DIR = join(PANEL_DIR, "client");
const NONCE = "dGVzdC1ub25jZS0xMjM0NQ";

/** The shell's own markup, without the inlined bundle. */
function shellMarkup(html: string): string {
  return html.replace(PANEL_JS, "").replace(PANEL_CSS, "");
}

function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe("staff panel build", () => {
  it("generated/assets.ts is up to date with panel/client and panel/icons (run `npm run build:panel`)", async () => {
    const current = readFileSync(GENERATED_PATH, "utf8");
    const expected = await expectedModule();
    expect(current === expected, "panel/generated/assets.ts is stale: run `npm run build:panel` in workers/shang-hai-orders").toBe(true);
  }, 30_000);

  it("panel/client type-checks with DOM types (its own tsconfig)", () => {
    expect(() => typecheckClient({ quiet: true })).not.toThrow();
  }, 120_000);

  it("never turns strings into HTML or code, in the bundle or in the sources", () => {
    const forbidden = [/\binnerHTML\b/, /\bouterHTML\b/, /\binsertAdjacentHTML\b/, /\bdocument\.write(ln)?\b/, /\beval\(/, /\bnew Function\(/];
    for (const pattern of forbidden) expect(PANEL_JS).not.toMatch(pattern);
    const sources = readdirSync(CLIENT_DIR).filter((f) => f.endsWith(".ts"));
    expect(sources.length).toBeGreaterThan(5);
    for (const file of sources) {
      const code = readFileSync(join(CLIENT_DIR, file), "utf8");
      for (const pattern of forbidden) expect(code, `${file} uses ${pattern}`).not.toMatch(pattern);
      // No inline styles either: the CSP only allows the nonce'd stylesheet.
      expect(code, `${file} sets inline styles`).not.toMatch(/\.style\.|\.cssText|setAttribute\(\s*["']style/);
    }
  });

  it("cannot close its own inline <script> or <style>", () => {
    expect(PANEL_JS).not.toMatch(/<\/script/i);
    expect(PANEL_JS).not.toMatch(/<!--/);
    expect(PANEL_CSS).not.toMatch(/<\/style/i);
    expect(PANEL_JS.length).toBeGreaterThan(10_000);
    expect(PANEL_CSS.length).toBeGreaterThan(5_000);
  });
});

describe("staff panel shell (panelHtml)", () => {
  const html = panelHtml(NONCE);
  const markup = shellMarkup(html);

  it("inlines exactly one script and one stylesheet, both under the CSP nonce", () => {
    expect(markup.match(/<script\b/g)).toHaveLength(1);
    expect(markup.match(/<style\b/g)).toHaveLength(1);
    expect(markup).toContain(`<script nonce="${NONCE}">`);
    expect(markup).toContain(`<style nonce="${NONCE}">`);
    expect(html).toContain(PANEL_JS);
    expect(html).toContain(PANEL_CSS);
  });

  it("has no inline handlers, inline styles, external resources or order data", () => {
    expect(markup).not.toMatch(/\son[a-z]+\s*=/i);
    expect(markup).not.toMatch(/\sstyle\s*=/i);
    expect(markup).not.toMatch(/(src|href)="(https?:)?\/\//i);
    expect(markup).not.toMatch(/SH-\d{6}-|€|@/);
  });

  it("is a Spanish, installable, non-indexed page", () => {
    expect(markup).toMatch(/^<!doctype html>/);
    expect(markup).toContain('<html lang="es"');
    expect(markup).toContain("<title>SHANG HAI — PEDIDOS</title>");
    expect(markup).toContain('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
    expect(markup).toContain('<link rel="manifest" href="/admin/manifest.webmanifest">');
    expect(markup).toContain('<link rel="apple-touch-icon" sizes="180x180" href="/admin/apple-touch-icon.png">');
    expect(markup).toContain('<meta name="apple-mobile-web-app-capable" content="yes">');
    expect(markup).toContain('<meta name="mobile-web-app-capable" content="yes">');
    expect(markup).toMatch(/<meta name="theme-color" content="#[0-9A-Fa-f]{6}"/);
    expect(markup).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(markup).toContain('<div id="app">');
  });

  it("refuses a nonce that could escape its attribute", () => {
    expect(() => panelHtml('x" onload="alert(1)')).toThrow();
    expect(() => panelHtml("")).toThrow();
  });
});

describe("staff panel manifest and icons (panelAsset)", () => {
  it("serves a valid web app manifest", () => {
    const asset = panelAsset("/admin/manifest.webmanifest");
    expect(asset?.contentType).toBe("application/manifest+json; charset=utf-8");
    expect(asset?.cacheControl).toMatch(/^public, max-age=\d+$/);
    const manifest = JSON.parse(String(asset?.body)) as typeof PANEL_MANIFEST;
    expect(manifest).toMatchObject({
      name: "SHANG HAI — PEDIDOS",
      short_name: "Pedidos",
      start_url: "/admin",
      display: "standalone",
    });
    expect(manifest.background_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(manifest.theme_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    // The scope must contain start_url or browsers ignore it (and the app would span the
    // whole origin); "/admin" covers the page, its assets and /admin#pedido=… links.
    expect(manifest.scope).toBe("/admin");
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true);
    expect("/admin/icon-192.png".startsWith(manifest.scope)).toBe(true);
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    for (const icon of manifest.icons) {
      expect(icon.type).toBe("image/png");
      expect(panelAsset(icon.src), icon.src).not.toBeNull();
    }
  });

  it("serves the PNG icons with the right type, size and bytes", () => {
    const expected: [string, string, number][] = [
      ["/admin/icon-192.png", "icon-192.png", 192],
      ["/admin/icon-512.png", "icon-512.png", 512],
      ["/admin/apple-touch-icon.png", "apple-touch-icon.png", 180],
    ];
    for (const [path, file, size] of expected) {
      const asset = panelAsset(path);
      expect(asset?.contentType, path).toBe("image/png");
      expect(asset?.cacheControl, path).toMatch(/^public, max-age=\d+$/);
      const bytes = asset?.body as Uint8Array;
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(pngSize(bytes)).toEqual({ width: size, height: size });
      expect(Buffer.from(bytes).equals(readFileSync(join(PANEL_DIR, "icons", file))), file).toBe(true);
    }
  });

  it("serves nothing else (no service worker, no traversal)", () => {
    for (const path of ["/admin/sw.js", "/admin/", "/admin/../src/index.ts", "/admin/icon-192.PNG", "/admin/manifest.json", "/icon-192.png"]) {
      expect(panelAsset(path), path).toBeNull();
    }
  });
});

describe("staff panel through the Worker", () => {
  it("serves the shell with a fresh nonce that matches the CSP", async () => {
    const w = world();
    const first = await call(w.env, w.deps, "/admin");
    const second = await call(w.env, w.deps, "/admin/");
    for (const res of [first, second]) {
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
      expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    }
    const csp = first.headers.get("Content-Security-Policy") ?? "";
    const nonce = /script-src 'nonce-([^']+)'/.exec(csp)?.[1] ?? "";
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{16,}$/);
    expect(csp).toContain(`style-src 'nonce-${nonce}'`);
    expect(csp).toContain("default-src 'none'");
    const html = await first.text();
    expect(html).toContain(`<script nonce="${nonce}">`);
    expect(html).toContain(`<style nonce="${nonce}">`);
    expect(second.headers.get("Content-Security-Policy")).not.toBe(csp);
  });

  it("serves the manifest and icons, and 404s anything else under /admin/", async () => {
    const w = world();
    const manifest = await call(w.env, w.deps, "/admin/manifest.webmanifest");
    expect(manifest.status).toBe(200);
    expect(manifest.headers.get("Content-Type")).toBe("application/manifest+json; charset=utf-8");
    expect((await manifest.json()) as { start_url: string }).toMatchObject({ start_url: "/admin" });
    const icon = await call(w.env, w.deps, "/admin/icon-512.png");
    expect(icon.status).toBe(200);
    expect(icon.headers.get("Content-Type")).toBe("image/png");
    expect(icon.headers.get("Cache-Control")).toMatch(/^public/);
    expect((await icon.arrayBuffer()).byteLength).toBeGreaterThan(500);
    expect((await call(w.env, w.deps, "/admin/sw.js")).status).toBe(404);
    expect((await call(w.env, w.deps, "/admin/manifest.webmanifest", { method: "POST" })).status).toBe(405);
  });
});
