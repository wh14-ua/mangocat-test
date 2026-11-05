#!/usr/bin/env node
// Creates the Stripe webhook endpoint the order Worker needs, in TEST mode only, with the
// exact event list and the API version the Worker pins. Prints the signing secret once:
// store it with `wrangler secret put STRIPE_WEBHOOK_SECRET` (never in a file in the repo).
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/setup/stripe-webhook.mjs https://<worker-host> --save
// With --save the secret goes straight into `wrangler secret put` (stdin) and is never printed.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
const host = (process.argv[2] ?? "").replace(/\/+$/, "");
if (!/^(sk|rk)_test_/.test(key)) {
  console.error("Use a TEST key (sk_test_… or rk_test_…) in STRIPE_SECRET_KEY. Live keys are refused on purpose.");
  process.exit(1);
}
if (!/^https:\/\/[^/]+$/.test(host)) {
  console.error("Pass the Worker's public origin, e.g. https://shang-hai-orders.<subdomain>.workers.dev");
  process.exit(1);
}

// Single sources of truth: the Worker's pinned API version and its handled events.
const config = readFileSync(new URL("../../workers/shang-hai-orders/src/config.ts", import.meta.url), "utf8");
const apiVersion = /STRIPE_API_VERSION = "([^"]+)"/.exec(config)?.[1];
const webhook = readFileSync(new URL("../../workers/shang-hai-orders/src/webhook.ts", import.meta.url), "utf8");
const events = [...(/HANDLED_EVENTS = \[([\s\S]*?)\]/.exec(webhook)?.[1] ?? "").matchAll(/"([a-z_.]+)"/g)].map((m) => m[1]);
if (!apiVersion || events.length === 0) {
  console.error("Could not read the API version or the event list from the Worker sources.");
  process.exit(1);
}

const form = new URLSearchParams();
form.set("url", `${host}/api/stripe/webhook`);
form.set("api_version", apiVersion);
form.set("description", "Shang Hai orders (test mode)");
for (const e of events) form.append("enabled_events[]", e);

const res = await fetch("https://api.stripe.com/v1/webhook_endpoints", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": apiVersion },
  body: form,
});
const body = await res.json();
if (!res.ok) {
  console.error(`Stripe answered ${res.status}: ${body.error?.message ?? "error"}`);
  process.exit(1);
}
console.log(`Webhook endpoint created: ${body.id} -> ${body.url}`);
console.log(`API version ${apiVersion}; ${events.length} events: ${events.join(", ")}`);
if (process.argv.includes("--save")) {
  const saved = spawnSync("npx", ["--no-install", "wrangler", "secret", "put", "STRIPE_WEBHOOK_SECRET"], {
    cwd: new URL("../../workers/shang-hai-orders/", import.meta.url),
    input: `${body.secret}\n`,
    stdio: ["pipe", "inherit", "inherit"],
  });
  process.exit(saved.status ?? 1);
}
console.log("\nNow run, and paste this signing secret when asked (it is shown only now):\n");
console.log("  cd workers/shang-hai-orders && npx wrangler secret put STRIPE_WEBHOOK_SECRET\n");
console.log(`  ${body.secret}\n`);
