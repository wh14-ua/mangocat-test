// Process management for the local ordering stack: the order Worker (wrangler dev = workerd +
// local D1), the fake cloud (Stripe + Telegram) and the static storefronts, each startable,
// stoppable and restartable on its own, with its own ports and state directory. Used by
// `npm run demo:local` (run.mjs), the Playwright ordering suite and the restart/persistence
// integration tests.
//
// What keeps state, and where (all under `stateDir`, nothing outside it):
//   v3/d1/…              the local D1 database (orders, events, sessions…)        persists
//   fake-stripe.json     sessions, PaymentIntents, charges, refunds, idempotency  persists
//                        keys and undelivered webhooks (Stripe never forgets)
//   fake-telegram.json   the staff chat history                                   persists
//   backups/…            copies taken before any automatic schema repair
// The Worker itself, the static site, injected failures and cron timers are stateless.
// A fresh start deletes exactly that directory (refused for anything that is not a local
// test state directory).
import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const WORKER_DIR = join(ROOT, "workers/shang-hai-orders");
const WRANGLER = join(WORKER_DIR, "node_modules/wrangler/bin/wrangler.js");

export const LOCAL_SECRETS = {
  webhookSecret: "whsec_local_demo_secret",
  // Test-mode key FORMAT only: the Worker talks to the local fake Stripe, never to Stripe.
  stripeKey: "sk_test_local_fake_stripe_not_a_real_key",
  telegramToken: "1234567890:LOCAL_fake_telegram_token_for_demo_only",
  staffChats: "100000001,100000002",
};

/** Deletes a local test state directory — and refuses anything else. */
export function wipeStateDir(dir) {
  const abs = resolve(dir);
  const rel = relative(ROOT, abs);
  const insideProject = rel && !rel.startsWith("..") && !isAbsolute(rel) && rel.split(sep).some((part) => part.startsWith(".local-stack"));
  const insideTmp = abs.startsWith(resolve(tmpdir()) + sep);
  if (!insideProject && !insideTmp) throw new Error(`Refusing to delete ${abs}: it is not a local test state directory (.local-stack*)`);
  rmSync(abs, { recursive: true, force: true });
}

/** Fails fast when a port is taken (e.g. another demo still running) instead of talking to it. */
export function assertPortFree(port, what) {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", () => reject(new Error(`Port ${port} (${what}) is already in use — is another demo or test run still running?`)));
    probe.once("listening", () => probe.close(() => resolvePort()));
    probe.listen(port, "localhost");
  });
}

export function createStack(options = {}) {
  const stateDir = resolve(ROOT, options.stateDir ?? ".local-stack");
  const ports = { worker: 8787, cloud: 8790, site: 4174, ...options.ports };
  const urls = {
    worker: `http://localhost:${ports.worker}`,
    cloud: `http://localhost:${ports.cloud}`,
    site: `http://localhost:${ports.site}`,
  };
  const label = options.label ?? "";
  const quiet = options.quiet ?? false;
  const logs = { worker: [], cloud: [], site: [] };
  const procs = {};
  let cronTimer = null;

  const vars = {
    STRIPE_SECRET_KEY: LOCAL_SECRETS.stripeKey,
    STRIPE_WEBHOOK_SECRET: LOCAL_SECRETS.webhookSecret,
    STRIPE_TEST_MODE: "true",
    PAYMENTS_LIVE_ENABLED: "false",
    STRIPE_API_BASE: `${urls.cloud}/v1`,
    TELEGRAM_API_BASE: urls.cloud,
    TELEGRAM_BOT_TOKEN: LOCAL_SECRETS.telegramToken,
    TELEGRAM_CHAT_IDS: LOCAL_SECRETS.staffChats,
    PANEL_URL: `${urls.worker}/admin`,
    CORS_ALLOWED_ORIGIN: `${urls.site},http://localhost:3000`,
    STRIPE_SUCCESS_URL: `${urls.site}/mangocat-test/showcase/shang-hai/{storefront}/pedido/estado/?pedido={orderId}&t={token}&lang={lang}`,
    STRIPE_CANCEL_URL: `${urls.site}/mangocat-test/showcase/shang-hai/{storefront}/pedido/?cancelado=1&pedido={orderId}&lang={lang}`,
    ACCEPTANCE_REMINDER_MINUTES: process.env.ACCEPTANCE_REMINDER_MINUTES ?? "4",
    ACCEPTANCE_TIMEOUT_MINUTES: process.env.ACCEPTANCE_TIMEOUT_MINUTES ?? "30",
    WORKER_ROLE: "all",
    ACCESS_TEAM_DOMAIN: "",
    ACCESS_AUD: "",
    ...options.workerVars,
  };

  function spawnService(name, command, argv, spawnOptions = {}) {
    const child = spawn(command, argv, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true, // own process group: stopping kills wrangler AND workerd
      ...spawnOptions,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false", FORCE_COLOR: "0", ...spawnOptions.env },
    });
    const tag = `[${label}${name}]`;
    const sink = (stream) => (data) => {
      const text = String(data);
      logs[name].push(...text.split("\n").filter(Boolean));
      if (logs[name].length > 2000) logs[name].splice(0, logs[name].length - 2000);
      if (!quiet) stream.write(text.replace(/^/gm, `${tag} `));
    };
    child.stdout.on("data", sink(process.stdout));
    child.stderr.on("data", sink(process.stderr));
    child.exited = new Promise((r) => child.on("exit", (code, signal) => r({ code, signal })));
    child.on("exit", (code, signal) => {
      if (!quiet && !child.stopping) console.log(`${tag} exited (${code ?? signal})`);
    });
    procs[name] = child;
    return child;
  }

  async function stop(name, signal = "SIGTERM") {
    const child = procs[name];
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      delete procs[name];
      return;
    }
    child.stopping = true;
    const kill = (sig) => {
      try {
        process.kill(-child.pid, sig);
      } catch {
        /* already gone */
      }
    };
    kill(signal);
    const timer = setTimeout(() => kill("SIGKILL"), 8_000);
    await child.exited;
    clearTimeout(timer);
    delete procs[name];
  }

  async function waitUp(url, what, timeoutMs = 90_000) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      try {
        await fetch(url);
        return;
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`${what} did not start on ${url}`);
  }

  async function startCloud() {
    await assertPortFree(ports.cloud, "fake cloud");
    spawnService("cloud", process.execPath, [join(ROOT, "scripts/local-stack/cloud.mjs")], {
      env: {
        PORT: String(ports.cloud),
        WEBHOOK_URL: `${urls.worker}/api/stripe/webhook`,
        WEBHOOK_SECRET: LOCAL_SECRETS.webhookSecret,
        STATE_DIR: options.persistCloud === false ? "" : stateDir,
      },
    });
    await waitUp(`${urls.cloud}/`, "fake cloud", 20_000);
  }

  async function startWorker() {
    await assertPortFree(ports.worker, "Worker");
    const varArgs = Object.entries(vars).flatMap(([k, v]) => ["--var", `${k}:${v}`]);
    spawnService(
      "worker",
      process.execPath,
      [WRANGLER, "dev", "--local", "--port", String(ports.worker), "--ip", "localhost", "--persist-to", stateDir, "--test-scheduled", "--inspector-port", String(ports.worker + 1000), "--show-interactive-dev-session=false", ...varArgs],
      { cwd: WORKER_DIR },
    );
    await waitUp(`${urls.worker}/api/config`, "Worker");
  }

  async function startSite(staticRoot = "out-local") {
    await assertPortFree(ports.site, "site");
    spawnService("site", process.execPath, [join(ROOT, "scripts/serve-static.mjs")], {
      env: { PORT: String(ports.site), HOST: "localhost", STATIC_ROOT: staticRoot },
    });
    await waitUp(`${urls.site}/mangocat-test/`, "site", 20_000);
  }

  /** Runs the Worker's cron once, exactly as Cloudflare would (wrangler --test-scheduled). */
  async function runCron() {
    const res = await fetch(`${urls.worker}/__scheduled?cron=*+*+*+*+*`);
    return res.status;
  }

  function startCron(everyMs = 20_000) {
    stopCron();
    cronTimer = setInterval(() => runCron().catch(() => undefined), everyMs);
  }

  function stopCron() {
    if (cronTimer) clearInterval(cronTimer);
    cronTimer = null;
  }

  async function stopAll() {
    stopCron();
    await Promise.all(Object.keys(procs).map((name) => stop(name)));
  }

  /** Last resort on process exit (synchronous): signal every service's process group. */
  function killAllSync() {
    for (const child of Object.values(procs)) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* gone */
      }
    }
  }

  return {
    stateDir,
    ports,
    urls,
    vars,
    logs,
    hasState: () => existsSync(stateDir),
    wipe: () => wipeStateDir(stateDir),
    startCloud,
    startWorker,
    startSite,
    stopCloud: (signal) => stop("cloud", signal),
    stopWorker: (signal) => stop("worker", signal),
    stopSite: (signal) => stop("site", signal),
    async restartCloud() {
      await stop("cloud");
      await startCloud();
    },
    async restartWorker() {
      await stop("worker");
      await startWorker();
    },
    runCron,
    startCron,
    stopCron,
    stopAll,
    killAllSync,
    running: (name) => Boolean(procs[name]),
    name: basename(stateDir),
  };
}
