/**
 * Staff panel delivery (SHANG HAI — PEDIDOS). Contract used by src/index.ts:
 *   panelHtml(nonce)   -> the HTML shell: no order data inside (it comes from /api/admin/*);
 *                         the client JS and CSS are inlined under the per-request CSP nonce.
 *   panelAsset(path)   -> public static files under /admin/ (manifest, icons) or null.
 * The client lives in panel/client and is bundled into panel/generated/assets.ts by
 * `npm run build:panel`. No service worker: install works without one and the panel never
 * shows cached orders.
 */
import { APPLE_TOUCH_ICON_PNG, ICON_192_PNG, ICON_512_PNG, PANEL_CSS, PANEL_JS } from "./generated/assets";
import { APP_NAME, APP_SHORT_NAME, SEAL_GLYPH_TRANSFORMS, SEAL_GLYPHS, SEAL_RECT, SEAL_VIEWBOX, THEME } from "./shared/brand";

export type PanelAsset = { body: string | Uint8Array; contentType: string; cacheControl: string };

const NONCE_PATTERN = /^[A-Za-z0-9+/_=-]{8,128}$/;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

const SEAL_SVG =
  `<svg class="seal" viewBox="${SEAL_VIEWBOX}" aria-hidden="true" focusable="false">` +
  `<rect class="seal__bg" x="${SEAL_RECT.x}" y="${SEAL_RECT.y}" width="${SEAL_RECT.width}" height="${SEAL_RECT.height}" rx="${SEAL_RECT.rx}"/>` +
  `<g class="seal__glyphs"><path transform="${SEAL_GLYPH_TRANSFORMS.shang}" d="${SEAL_GLYPHS.shang}"/>` +
  `<path transform="${SEAL_GLYPH_TRANSFORMS.hai}" d="${SEAL_GLYPHS.hai}"/></g></svg>`;

export function panelHtml(nonce: string): string {
  if (!NONCE_PATTERN.test(nonce)) throw new Error("Invalid CSP nonce");
  const n = escapeHtml(nonce);
  const name = escapeHtml(APP_NAME);
  return [
    "<!doctype html>",
    '<html lang="es" dir="ltr">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<meta name="robots" content="noindex, nofollow">',
    '<meta name="referrer" content="no-referrer">',
    '<meta name="color-scheme" content="light dark">',
    `<meta name="theme-color" content="${THEME.light.bar}" media="(prefers-color-scheme: light)">`,
    `<meta name="theme-color" content="${THEME.dark.bar}" media="(prefers-color-scheme: dark)">`,
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    `<meta name="apple-mobile-web-app-title" content="${escapeHtml(APP_SHORT_NAME)}">`,
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
    '<meta name="format-detection" content="telephone=no">',
    `<title>${name}</title>`,
    '<link rel="manifest" href="/admin/manifest.webmanifest">',
    '<link rel="icon" type="image/png" sizes="192x192" href="/admin/icon-192.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/admin/apple-touch-icon.png">',
    `<style nonce="${n}">${PANEL_CSS}</style>`,
    "</head>",
    "<body>",
    `<div id="app"><div class="boot" role="status">${SEAL_SVG}<p class="boot__name">${name}</p><p class="boot__text">Cargando pedidos…</p></div></div>`,
    '<noscript><p class="boot__text">Activa JavaScript en este navegador para usar el panel de pedidos.</p></noscript>',
    `<script nonce="${n}">${PANEL_JS}</script>`,
    "</body>",
    "</html>",
  ].join("\n");
}

/**
 * Scope note: the brief asked for scope "/admin/", but a start_url ("/admin") outside its
 * scope makes browsers ignore the scope altogether (Web App Manifest spec; Chrome warns),
 * which would widen the app to the whole origin. "/admin" covers the panel page, its
 * assets and the Telegram links (/admin#pedido=…).
 */
export const PANEL_MANIFEST = {
  id: "/admin",
  name: APP_NAME,
  short_name: APP_SHORT_NAME,
  description: "Recibe, acepta y rechaza los pedidos online del restaurante Shang Hai.",
  lang: "es-ES",
  dir: "ltr",
  start_url: "/admin",
  scope: "/admin",
  display: "standalone",
  orientation: "any",
  background_color: THEME.light.page,
  theme_color: THEME.light.bar,
  categories: ["business", "food"],
  icons: [
    { src: "/admin/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/admin/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/admin/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/admin/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
} as const;

const MANIFEST_BODY = JSON.stringify(PANEL_MANIFEST);

const decoded = new Map<string, Uint8Array>();

function png(key: string, base64: string): PanelAsset {
  let bytes = decoded.get(key);
  if (!bytes) {
    const binary = atob(base64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    decoded.set(key, bytes);
  }
  return { body: bytes.slice(), contentType: "image/png", cacheControl: "public, max-age=86400" };
}

export function panelAsset(path: string): PanelAsset | null {
  switch (path) {
    case "/admin/manifest.webmanifest":
      return { body: MANIFEST_BODY, contentType: "application/manifest+json; charset=utf-8", cacheControl: "public, max-age=3600" };
    case "/admin/icon-192.png":
      return png(path, ICON_192_PNG);
    case "/admin/icon-512.png":
      return png(path, ICON_512_PNG);
    case "/admin/apple-touch-icon.png":
      return png(path, APPLE_TOUCH_ICON_PNG);
    default:
      return null;
  }
}
