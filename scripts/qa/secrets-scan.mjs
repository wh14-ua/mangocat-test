#!/usr/bin/env node
// Fails if a tracked file contains something that looks like a real credential: Stripe live
// or test secret keys, webhook signing secrets, Telegram bot tokens, private keys, Cloudflare
// tokens. Only the documented local/test fakes are allowed (they cannot reach anything real).
// Secrets belong in `wrangler secret put …` / GitHub secrets, never in the repository.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const PATTERNS = [
  ["Stripe secret key", /\b[sr]k_(live|test)_[A-Za-z0-9]{20,}\b/g],
  ["Stripe webhook secret", /\bwhsec_[A-Za-z0-9]{24,}\b/g],
  ["Telegram bot token", /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g],
  ["Private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ["Cloudflare API token", /\bCLOUDFLARE_API_TOKEN\s*[=:]\s*["']?[A-Za-z0-9_-]{30,}/g],
];
// Fakes used by the tests and the local demo (documented, harmless).
const ALLOWED = new Set([
  "sk_test_51FakeKeyForUnitTestsOnly",
  "sk_test_local_fake_stripe_not_a_real_key",
  "123456789:AAFakeTokenForUnitTestsOnly_abcdef",
  "1234567890:LOCAL_fake_telegram_token_for_demo_only",
]);

const files = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
  .split("\0")
  .filter((f) => f && !/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|pdf|lock)$/i.test(f) && !f.endsWith("package-lock.json"));
const findings = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(resolve(ROOT, file), "utf8");
  } catch {
    continue;
  }
  for (const [label, pattern] of PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (!ALLOWED.has(match[0])) findings.push(`${file}: ${label} (${match[0].slice(0, 12)}…)`);
    }
  }
}
if (findings.length) {
  console.error(`✗ Possible credentials in tracked files:\n  - ${findings.join("\n  - ")}`);
  process.exit(1);
}
console.log(`Secrets scan OK (${files.length} tracked files).`);
