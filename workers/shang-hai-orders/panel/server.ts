/**
 * Staff panel delivery (placeholder until the mobile panel lands in this folder).
 * Contract used by src/index.ts:
 *   panelHtml(nonce)   -> the HTML shell (no order data inside; data comes from /api/admin/*)
 *   panelAsset(path)   -> static assets under /admin/ (manifest, service worker, icons) or null
 */
export function panelHtml(nonce: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>SHANG HAI — PEDIDOS</title><style nonce="${nonce}">body{font:16px system-ui;margin:2rem}</style></head><body><h1>SHANG HAI — PEDIDOS</h1></body></html>`;
}

export function panelAsset(path: string): { body: string | Uint8Array; contentType: string; cacheControl: string } | null {
  void path;
  return null;
}
