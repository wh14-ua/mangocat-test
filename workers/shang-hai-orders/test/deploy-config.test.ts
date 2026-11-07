import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * What wrangler.jsonc deploys: every environment — the public test environment ("demo") included
 * — can only ever take TEST payments, keeps every secret out of the repository (secrets are set
 * with `wrangler secret put`), and the demo never shares production's Worker or database.
 */

type Target = { name?: string; vars: Record<string, string>; d1_databases: { database_name: string; database_id: string }[] };

/** wrangler.jsonc without comments (string-aware: URLs keep their "//") and trailing commas. */
function wranglerConfig(): Target & { env?: Record<string, Target> } {
  const text = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  let out = "";
  for (let i = 0, inString = false; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      out += c;
      if (c === "\\") out += text[++i];
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
      out += c;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

const config = wranglerConfig();
const targets: [string, Target][] = [["top level", config], ...Object.entries(config.env ?? {}).map(([name, env]): [string, Target] => [`env.${name}`, env])];

const SECRETS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  "TELEGRAM_BOT_TOKEN",
  "STAFF_CODE_SECRET",
];

describe("deployment configuration (wrangler.jsonc)", () => {
  it("has the public test environment", () => {
    expect(Object.keys(config.env ?? {})).toContain("demo");
  });

  it.each(targets)("%s can only take TEST payments", (_, target) => {
    expect(target.vars.STRIPE_TEST_MODE).toBe("true");
    expect(target.vars.PAYMENTS_LIVE_ENABLED).toBe("false");
  });

  it.each(targets)("%s keeps secrets and personal numbers out of the repository", (_, target) => {
    for (const name of SECRETS) expect(target.vars, name).not.toHaveProperty(name);
    expect(target.vars.WHATSAPP_RECIPIENTS ?? "").toBe("");
  });

  it("the demo has its own Worker and database, never production's", () => {
    const demo = config.env?.demo as Target;
    expect(demo.name).not.toBe(config.name);
    expect(demo.d1_databases[0].database_name).not.toBe(config.d1_databases[0].database_name);
    expect(demo.d1_databases[0].database_id).not.toBe(config.d1_databases[0].database_id);
  });
});
