#!/usr/bin/env node
/**
 * Serves the static export in ./out exactly like GitHub Pages does: under the
 * /mangocat-test base path, directory URLs resolved to index.html, 404.html otherwise.
 * Used by the Playwright tests and screenshot scripts (no external server needed).
 *
 *   node scripts/serve-static.mjs            # http://127.0.0.1:4173/mangocat-test/
 *   PORT=5000 node scripts/serve-static.mjs
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)), "out");
const BASE = "/mangocat-test";
const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

async function fileFor(pathname) {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidate = join(ROOT, rel);
  if (!candidate.startsWith(ROOT)) return null;
  try {
    const s = await stat(candidate);
    if (s.isDirectory()) {
      const index = join(candidate, "index.html");
      await stat(index);
      return index;
    }
    return candidate;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  if (url.pathname === "/" || url.pathname === BASE) {
    res.writeHead(302, { Location: `${BASE}/` }).end();
    return;
  }
  if (!url.pathname.startsWith(`${BASE}/`)) {
    res.writeHead(404).end("Not found");
    return;
  }
  const inner = url.pathname.slice(BASE.length) || "/";
  // GitHub Pages redirects /dir to /dir/ when dir/index.html exists.
  if (!inner.endsWith("/") && !extname(inner)) {
    const dir = await fileFor(inner);
    if (dir?.endsWith("index.html")) {
      res.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end();
      return;
    }
  }
  const file = await fileFor(inner);
  if (!file) {
    const notFound = await readFile(join(ROOT, "404.html")).catch(() => "Not found");
    res.writeHead(404, { "Content-Type": TYPES[".html"] }).end(notFound);
    return;
  }
  const body = await readFile(file);
  res
    .writeHead(200, {
      "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    })
    .end(body);
}).listen(PORT, HOST, () => {
  console.log(`Serving ./out at http://${HOST}:${PORT}${BASE}/`);
});
