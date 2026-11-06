#!/usr/bin/env node
// One reproducible quality gate for the Shang Hai ordering system.
//
//   npm run qa:full            everything: static checks, unit + property tests (300 runs each),
//                              integration on the real Worker + local D1 (restarts, migrations,
//                              concurrency), the 90 demo browser tests and the ordering E2E
//   npm run qa:quick           static checks + unit/property tests only (a minute or two)
//   npm run qa:full -- --no-e2e    everything but the browser suites
//
// Exits non-zero if ANY step fails (every step still runs, so one report shows everything).
// Test data is isolated: unit tests use in-memory SQLite; integration suites use fresh temp
// directories; the ordering E2E uses .local-stack-e2e (wiped first). The demo's .local-stack/
// is never touched. Ports 8787/8790/4173/4174 (and 88xx/89xx for integration) must be free:
// stop `npm run demo:local` first. Nothing external is called; no real money is involved.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const args = new Set(process.argv.slice(2));
const quick = args.has("--quick");
const e2e = !quick && !args.has("--no-e2e");
const integration = !quick;

const steps = [
  ["TypeScript (site, tests)", "npx", ["tsc", "--noEmit"]],
  ["TypeScript (Worker)", "npx", ["tsc", "-p", "workers/shang-hai-orders/tsconfig.json"]],
  ["TypeScript (panel client)", "npx", ["tsc", "-p", "workers/shang-hai-orders/panel/client/tsconfig.json"]],
  ["Lint", "npm", ["run", "--silent", "lint:shang-hai"]],
  ["Migrations locked, schema generated", "node", ["scripts/db/schema.mjs", "verify"]],
  ["Secrets scan", "node", ["scripts/qa/secrets-scan.mjs"]],
  ["Dependency audit (production, high+)", "npm", ["audit", "--omit=dev", "--audit-level=high"]],
  ["Menu data up to date", "npm", ["run", "--silent", "menu:check"]],
  ["Panel bundle up to date", "node", ["scripts/qa/panel-fresh.mjs"]],
  ["Unit, Worker and property tests", "npx", ["vitest", "run"], { PROPERTY_RUNS: quick ? "40" : "300" }],
  ...(integration
    ? [
        ["Worker bundles for Cloudflare (dry run)", "npm", ["--prefix", "workers/shang-hai-orders", "run", "--silent", "build:dry-run"]],
        ["Integration: restarts, migrations, concurrency (real Worker + D1)", "npx", ["vitest", "run", "--config", "vitest.integration.config.mts"]],
      ]
    : []),
  ...(e2e
    ? [
        ["Build: storefronts in demo mode", "npx", ["next", "build"], { NEXT_PUBLIC_ORDER_API_BASE_URL: "" }],
        ["E2E: storefronts, demo mode (390/768/1440, a11y)", "npx", ["playwright", "test"]],
        ["Build: storefronts against the local Worker", "node", ["scripts/local-stack/run.mjs", "--build-only"]],
        ["E2E: real ordering system (Worker + D1 + fake Stripe/Telegram)", "npx", ["playwright", "test", "--config", "playwright.ordering.config.ts"]],
      ]
    : []),
];

function portFree(port) {
  return new Promise((done) => {
    const probe = createServer();
    probe.once("error", () => done(false));
    probe.once("listening", () => probe.close(() => done(true)));
    probe.listen(port, "localhost");
  });
}

async function main() {
  if (e2e || integration) {
    const busy = [];
    for (const port of [8787, 8790, 4173, 4174]) if (!(await portFree(port))) busy.push(port);
    if (busy.length) {
      console.error(`✗ Ports in use: ${busy.join(", ")}. Stop the local demo (npm run demo:local) or other servers first.`);
      process.exit(2);
    }
  }
  const results = [];
  for (const [name, cmd, argv, env = {}] of steps) {
    console.log(`\n━━ ${name} ━━`);
    const started = Date.now();
    const res = spawnSync(cmd, argv, { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env, FORCE_COLOR: process.env.FORCE_COLOR ?? "1" } });
    results.push({ name, ok: res.status === 0, seconds: Math.round((Date.now() - started) / 1000) });
  }
  const failed = results.filter((r) => !r.ok);
  const table = results.map((r) => `| ${r.ok ? "✅" : "❌"} | ${r.name} | ${r.seconds} s |`).join("\n");
  const report = `# QA run ${new Date().toISOString()} (${quick ? "quick" : e2e ? "full" : "no e2e"})\n\n| | Step | Time |\n|---|---|---|\n${table}\n\n${failed.length ? `**${failed.length} step(s) failed.**` : "**All steps passed.**"}\n`;
  mkdirSync(join(ROOT, "test-results"), { recursive: true });
  writeFileSync(join(ROOT, "test-results", "qa-summary.md"), report);
  console.log(`\n${report}\n(also written to test-results/qa-summary.md)`);
  process.exit(failed.length ? 1 : 0);
}

main();
