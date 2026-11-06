#!/usr/bin/env node
// Full local demo of the ordering system, with NO external accounts and NO real money:
//
//   storefronts (static build pointed at the local Worker)  http://localhost:4174/mangocat-test/showcase/shang-hai/
//   order Worker (wrangler dev: workerd + local D1)          http://localhost:8787   (panel: /admin)
//   fake Stripe (API + payment page + signed webhooks)      http://localhost:8790/pay/...
//   fake WhatsApp ("owner's phone")                         http://localhost:8790/whatsapp
//   fake Telegram ("staff phone", alternative channel)      http://localhost:8790/telegram
//
// Usage:  npm run demo:local                 keeps the previous local state (orders, payments, chats)
//         npm run demo:local -- --fresh      starts from an empty local state (deletes .local-stack/ only)
//         npm run demo:local -- --build      forces a rebuild of the site
//         npm run demo:local -- --no-site    only Worker + fake cloud (e.g. with `next dev`)
//
// Before anything starts it checks that (1) the local database has exactly the schema the
// migrations define — repairing a drifted local database additively, with a backup — and
// (2) every order in it points at payments the local Stripe knows. See harness.mjs for what
// keeps state. Ctrl+C stops everything.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { checkLocalDatabase, queryD1, WORKER_DIR } from "../db/schema.mjs";
import { createStack, ROOT } from "./harness.mjs";

const args = new Set(process.argv.slice(2));

export function stackFromEnv(overrides = {}) {
  return createStack({
    stateDir: process.env.LOCAL_STACK_STATE ?? ".local-stack",
    ports: {
      worker: Number(process.env.WORKER_PORT ?? 8787),
      cloud: Number(process.env.CLOUD_PORT ?? 8790),
      site: Number(process.env.SITE_PORT ?? 4174),
    },
    workerVars: {
      ...(process.env.STRIPE_TIMEOUT_MS ? { STRIPE_TIMEOUT_MS: process.env.STRIPE_TIMEOUT_MS } : {}),
      ...(process.env.LOCK_STALE_SECONDS ? { LOCK_STALE_SECONDS: process.env.LOCK_STALE_SECONDS } : {}),
      ...(process.env.LOCK_REVIEW_MINUTES ? { LOCK_REVIEW_MINUTES: process.env.LOCK_REVIEW_MINUTES } : {}),
    },
    ...overrides,
  });
}

export function buildSite(workerUrl = "http://localhost:8787") {
  console.log("Building the storefronts against the local Worker (out-local/)…");
  const res = spawnSync("npx", ["next", "build"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_ORDER_API_BASE_URL: workerUrl },
  });
  if (res.status !== 0) throw new Error("next build failed");
  rmSync(join(ROOT, "out-local"), { recursive: true, force: true });
  cpSync(join(ROOT, "out"), join(ROOT, "out-local"), { recursive: true });
}

export function migrate(stateDir) {
  mkdirSync(stateDir, { recursive: true });
  const res = spawnSync(
    "npx",
    ["--no-install", "wrangler", "d1", "migrations", "apply", "shang-hai-orders", "--local", "--persist-to", stateDir],
    { cwd: WORKER_DIR, stdio: "inherit", env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" } },
  );
  if (res.status !== 0) throw new Error("D1 migrations failed");
}

/** (1) Schema: the local database must match the migrations; drift is repaired additively. */
export function ensureSchema(stateDir) {
  const result = checkLocalDatabase({ persistTo: stateDir, repair: true });
  if (result.ok) {
    if (result.repaired) {
      console.log(`✔ Local database repaired (it had applied an older revision of a migration). Backup: ${relative(ROOT, result.backup ?? "")}`);
    } else {
      console.log("✔ Local database schema matches the migrations.");
    }
    return;
  }
  throw new Error(
    [
      "The local database schema does not match the migrations and cannot be repaired automatically:",
      ...(result.problems ?? []).map((p) => `  - ${p}`),
      ...(result.blocked ?? []).map((p) => `  ✗ ${p}`),
      result.error ? `  ${result.error}` : "",
      "Start a clean local state with:  npm run demo:local -- --fresh   (deletes .local-stack/ only)",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

const OPEN_STATUSES = ["pending", "awaiting_acceptance", "accepting", "rejecting", "preparing", "ready", "needs_review"];

/**
 * (2) D1 ↔ fake Stripe: orders still in play must point at payments the local Stripe knows.
 * A mismatch means the state comes from an older demo whose Stripe kept no data (or one of the
 * two was deleted): those orders cannot be charged or refunded and will be flagged EN REVISIÓN.
 */
/**
 * @param {{ stateDir: string, urls: { cloud: string } }} stack
 * @returns {Promise<{ orphans: { id: string, number: number | null, status: string, stripe_session_id: string | null, stripe_payment_intent_id: string | null }[] }>}
 */
export async function checkCoherence(stack) {
  const rows = queryD1(
    `SELECT id, number, status, payment_status, stripe_session_id, stripe_payment_intent_id FROM orders
      WHERE status IN (${OPEN_STATUSES.map((s) => `'${s}'`).join(", ")}) OR payment_status = 'refund_pending'`,
    { persistTo: stack.stateDir },
  );
  const state = await (await fetch(`${stack.urls.cloud}/__control/state`)).json();
  const intents = new Set(state.intents.map((i) => i.id));
  const sessions = new Set(state.sessionIds);
  const orphans = /** @type {any[]} */ (rows).filter((o) => (o.stripe_payment_intent_id ? !intents.has(o.stripe_payment_intent_id) : o.stripe_session_id && !sessions.has(o.stripe_session_id)));
  if (!orphans.length) {
    console.log(`✔ Local database and local Stripe are consistent (${rows.length} open orders).`);
    return { orphans };
  }
  console.warn(
    [
      `⚠ ${orphans.length} open order(s) point at payments the local Stripe does not know`,
      "  (state from an older demo whose fake Stripe kept no data, or a deleted state file):",
      ...orphans.map((o) => `    #${o.number ?? "?"} ${o.status} · ${o.stripe_payment_intent_id ?? o.stripe_session_id}`),
      "  They will be flagged EN REVISIÓN (nothing can be charged or refunded for them).",
      "  To start clean:  npm run demo:local -- --fresh",
    ].join("\n"),
  );
  return { orphans };
}

async function healthCheck(stack) {
  const res = await fetch(`${stack.urls.worker}/api/health`);
  const body = await res.json().catch(() => ({}));
  if (res.status === 503 && body.schema === "outdated") throw new Error("The Worker reports schema-outdated (see the [worker] log for what is missing).");
  if (!res.ok) throw new Error(`Worker health check failed: ${res.status}`);
}

/** Worker + fake cloud (used by the Playwright ordering suite and --backend-only). */
export async function startBackend(stack, { fresh = false, cronEveryMs = 20_000 } = {}) {
  if (fresh && stack.hasState()) stack.wipe();
  migrate(stack.stateDir);
  ensureSchema(stack.stateDir);
  await stack.startCloud();
  await checkCoherence(stack);
  await stack.startWorker();
  await healthCheck(stack);
  if (cronEveryMs > 0) stack.startCron(cronEveryMs);
}

let stack = null;

/** Stops every service (they run in their own process groups) before exiting. */
async function shutdown(code) {
  try {
    await stack?.stopAll();
  } finally {
    process.exit(code);
  }
}

async function main() {
  stack = stackFromEnv();
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => void shutdown(0));
  process.on("exit", () => stack?.killAllSync());

  if (args.has("--build-only")) {
    buildSite(stack.urls.worker);
    return;
  }
  const fresh = args.has("--fresh");
  if (args.has("--backend-only")) {
    await startBackend(stack, { fresh, cronEveryMs: Number(process.env.CRON_EVERY_MS ?? 20_000) });
    console.log("Backend ready");
    return;
  }
  if (!args.has("--no-site") && (args.has("--build") || !existsSync(join(ROOT, "out-local")))) buildSite(stack.urls.worker);
  await startBackend(stack, { fresh, cronEveryMs: Number(process.env.CRON_EVERY_MS ?? 20_000) });
  if (!args.has("--no-site")) await stack.startSite();
  console.log(`
  ┌──────────────────────────────────────────────────────────────────────────────┐
   Local demo ready (test data only, no real money)
   Storefronts:   ${stack.urls.site}/mangocat-test/showcase/shang-hai/
   Staff panel:   ${stack.urls.worker}/admin   (sign in: ENVIAR CÓDIGO, then read it on the phone page)
   Owner's phone: ${stack.urls.cloud}/whatsapp (WhatsApp alerts and sign-in codes — the product's channel)
   Staff phone:   ${stack.urls.cloud}/telegram (Telegram, kept as the alternative channel)
   Payment page:  opens automatically from the checkout (fake Stripe)
   State:         ${relative(ROOT, stack.stateDir)}/ — D1, fake Stripe and fake Telegram are kept together.
                  Start from scratch:  npm run demo:local -- --fresh
  └──────────────────────────────────────────────────────────────────────────────┘`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(async (error) => {
    console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
    await shutdown(1);
  });
}
