#!/usr/bin/env node
// Full local demo of the ordering system, with NO external accounts and NO real money:
//
//   storefronts (static build pointed at the local Worker)  http://localhost:4174/mangocat-test/showcase/shang-hai/
//   order Worker (wrangler dev: workerd + local D1)          http://localhost:8787   (panel: /admin)
//   fake Stripe (API + payment page + signed webhooks)      http://localhost:8790/pay/...
//   fake Telegram ("staff phone")                           http://localhost:8790/telegram
//
// Usage:  npm run demo:local            (builds the site once into ./out-local, then starts everything)
//         npm run demo:local -- --build (forces a rebuild of the site)
//         npm run demo:local -- --no-site (only Worker + fake cloud, e.g. with `next dev`)
// Ctrl+C stops everything. Data lives in .local-stack/ (delete it to start from scratch).
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WORKER_DIR = join(ROOT, "workers/shang-hai-orders");
const STATE_DIR = join(ROOT, process.env.LOCAL_STACK_STATE ?? ".local-stack");
const args = new Set(process.argv.slice(2));

export const LOCAL = {
  workerPort: Number(process.env.WORKER_PORT ?? 8787),
  cloudPort: Number(process.env.CLOUD_PORT ?? 8790),
  sitePort: Number(process.env.SITE_PORT ?? 4174),
  webhookSecret: "whsec_local_demo_secret",
  // Test-mode key FORMAT only: the Worker talks to the local fake Stripe, never to Stripe.
  stripeKey: "sk_test_local_fake_stripe_not_a_real_key",
  telegramToken: "1234567890:LOCAL_fake_telegram_token_for_demo_only",
  staffChats: "100000001,100000002",
};

const worker = `http://localhost:${LOCAL.workerPort}`;
const cloud = `http://localhost:${LOCAL.cloudPort}`;
const site = `http://localhost:${LOCAL.sitePort}`;

export function workerVars() {
  return {
    STRIPE_SECRET_KEY: LOCAL.stripeKey,
    STRIPE_WEBHOOK_SECRET: LOCAL.webhookSecret,
    STRIPE_TEST_MODE: "true",
    PAYMENTS_LIVE_ENABLED: "false",
    STRIPE_API_BASE: `${cloud}/v1`,
    TELEGRAM_API_BASE: cloud,
    TELEGRAM_BOT_TOKEN: LOCAL.telegramToken,
    TELEGRAM_CHAT_IDS: LOCAL.staffChats,
    PANEL_URL: `${worker}/admin`,
    CORS_ALLOWED_ORIGIN: `${site},http://localhost:3000`,
    STRIPE_SUCCESS_URL: `${site}/mangocat-test/showcase/shang-hai/{storefront}/pedido/estado/?pedido={orderId}&t={token}&lang={lang}`,
    STRIPE_CANCEL_URL: `${site}/mangocat-test/showcase/shang-hai/{storefront}/pedido/?cancelado=1&pedido={orderId}&lang={lang}`,
    ACCEPTANCE_REMINDER_MINUTES: process.env.ACCEPTANCE_REMINDER_MINUTES ?? "4",
    ACCEPTANCE_TIMEOUT_MINUTES: process.env.ACCEPTANCE_TIMEOUT_MINUTES ?? "30",
    WORKER_ROLE: "all",
    ACCESS_TEAM_DOMAIN: "",
    ACCESS_AUD: "",
  };
}

const children = [];
function start(name, command, argv, options = {}) {
  const child = spawn(command, argv, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], ...options });
  const tag = `[${name}]`;
  child.stdout.on("data", (d) => process.stdout.write(String(d).replace(/^/gm, `${tag} `)));
  child.stderr.on("data", (d) => process.stderr.write(String(d).replace(/^/gm, `${tag} `)));
  child.on("exit", (code) => console.log(`${tag} exited (${code})`));
  children.push(child);
  return child;
}

function stopAll() {
  for (const c of children) c.kill("SIGTERM");
  process.exit(0);
}

async function waitFor(url, label, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} did not start (${url})`);
}

export function buildSite() {
  console.log("Building the storefronts against the local Worker (out-local/)…");
  const res = spawnSync("npx", ["next", "build"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_ORDER_API_BASE_URL: worker },
  });
  if (res.status !== 0) throw new Error("next build failed");
  rmSync(join(ROOT, "out-local"), { recursive: true, force: true });
  cpSync(join(ROOT, "out"), join(ROOT, "out-local"), { recursive: true });
}

export function migrate() {
  mkdirSync(STATE_DIR, { recursive: true });
  const res = spawnSync(
    "npx",
    ["--no-install", "wrangler", "d1", "migrations", "apply", "shang-hai-orders", "--local", "--persist-to", STATE_DIR],
    { cwd: WORKER_DIR, stdio: "inherit", env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" } },
  );
  if (res.status !== 0) throw new Error("D1 migrations failed");
}

export function startWorker() {
  const vars = Object.entries(workerVars()).flatMap(([k, v]) => ["--var", `${k}:${v}`]);
  return start(
    "worker",
    "npx",
    ["--no-install", "wrangler", "dev", "--local", "--port", String(LOCAL.workerPort), "--ip", "localhost", "--persist-to", STATE_DIR, "--test-scheduled", ...vars],
    { cwd: WORKER_DIR, env: { ...process.env, WRANGLER_SEND_METRICS: "false" } },
  );
}

export function startCloud() {
  return start("cloud", process.execPath, [join(ROOT, "scripts/local-stack/cloud.mjs")], {
    env: { ...process.env, PORT: String(LOCAL.cloudPort), WEBHOOK_URL: `${worker}/api/stripe/webhook`, WEBHOOK_SECRET: LOCAL.webhookSecret },
  });
}

export function startSite() {
  return start("site", process.execPath, [join(ROOT, "scripts/serve-static.mjs")], {
    env: { ...process.env, PORT: String(LOCAL.sitePort), HOST: "localhost", STATIC_ROOT: "out-local" },
  });
}

/** wrangler dev --test-scheduled exposes /__scheduled: run the cron like Cloudflare does. */
export function startCronLoop(everyMs = 20_000) {
  return setInterval(() => {
    fetch(`${worker}/__scheduled?cron=*+*+*+*+*`).catch(() => undefined);
  }, everyMs);
}

/** Worker + fake cloud only, with a fresh database (used by the E2E suite). */
export async function startBackend({ fresh = false, cronEveryMs = 20_000 } = {}) {
  if (fresh) rmSync(STATE_DIR, { recursive: true, force: true });
  migrate();
  startCloud();
  startWorker();
  await waitFor(`${cloud}/`, "fake cloud");
  await waitFor(`${worker}/api/health`, "Worker", 90_000);
  startCronLoop(cronEveryMs);
}

async function main() {
  process.on("SIGINT", stopAll);
  process.on("SIGTERM", stopAll);
  if (args.has("--build-only")) {
    buildSite();
    return;
  }
  if (args.has("--backend-only")) {
    await startBackend({ fresh: args.has("--fresh"), cronEveryMs: Number(process.env.CRON_EVERY_MS ?? 20_000) });
    console.log("Backend ready");
    return;
  }
  if (!args.has("--no-site") && (args.has("--build") || !existsSync(join(ROOT, "out-local")))) buildSite();
  migrate();
  startCloud();
  startWorker();
  if (!args.has("--no-site")) startSite();
  await waitFor(`${cloud}/`, "fake cloud");
  await waitFor(`${worker}/api/health`, "Worker", 90_000);
  if (!args.has("--no-site")) await waitFor(`${site}/mangocat-test/`, "site");
  startCronLoop();
  console.log(`
  ┌──────────────────────────────────────────────────────────────────────────────┐
   Local demo ready (test data only, no real money)
   Storefronts:   ${site}/mangocat-test/showcase/shang-hai/
   Staff panel:   ${worker}/admin   (sign in: ENVIAR CÓDIGO, then read it on the phone page)
   Staff phone:   ${cloud}/telegram (Telegram alerts and sign-in codes)
   Payment page:  opens automatically from the checkout (fake Stripe)
  └──────────────────────────────────────────────────────────────────────────────┘`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    stopAll();
  });
}
