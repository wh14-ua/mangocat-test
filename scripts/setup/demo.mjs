#!/usr/bin/env node
// The public TEST environment ("demo") of the Shang Hai ordering system on Cloudflare: its own
// Worker and D1 database (wrangler.jsonc → env.demo), the three storefronts on a static Worker,
// Stripe in TEST mode only and Meta's free WhatsApp test number. Nothing here can take a real
// payment: the Worker refuses live keys (STRIPE_TEST_MODE="true", PAYMENTS_LIVE_ENABLED="false")
// and this script refuses them too.
//
//   node scripts/setup/demo.mjs deploy    publish the Worker, its D1 migrations and the storefronts
//   node scripts/setup/demo.mjs secrets   run it in YOUR OWN terminal: asks for the Stripe test key and
//                                         the Meta data (secrets with hidden input) and stores them as
//                                         Cloudflare secrets — never on disk, never shown —, creates the
//                                         Stripe webhook and the WhatsApp templates
//   node scripts/setup/demo.mjs token     renew only the WhatsApp access token (a temporary one lasts 24 h)
//   node scripts/setup/demo.mjs templates review status of the WhatsApp templates (asks for the token)
//   node scripts/setup/demo.mjs status    what is published and which secrets are set (reads no secret)
import { spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const WORKER_DIR = join(ROOT, "workers/shang-hai-orders");
const ENV = "demo";
const GRAPH = "https://graph.facebook.com";

/** wrangler.jsonc without comments (string-aware: URLs keep their "//"). */
function readWranglerConfig() {
  const text = readFileSync(join(WORKER_DIR, "wrangler.jsonc"), "utf8");
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

const config = readWranglerConfig();
const demo = config.env?.[ENV];
if (!demo) fail(`wrangler.jsonc has no env.${ENV}.`);
const WORKER_ORIGIN = new URL(demo.vars.PANEL_URL).origin;
const SITE_ORIGIN = demo.vars.CORS_ALLOWED_ORIGIN.split(",")[0].trim();
const PANEL_URL = demo.vars.PANEL_URL;
const SITE_WORKER = new URL(SITE_ORIGIN).hostname.split(".")[0];
const SHOWCASE = `${SITE_ORIGIN}/mangocat-test/showcase/shang-hai/`;

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function wrangler(args, options = {}) {
  return spawnSync("npx", ["--no-install", "wrangler", ...args], {
    cwd: WORKER_DIR,
    encoding: "utf8",
    env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" },
    ...options,
  });
}

function step(title) {
  console.log(`\n▶ ${title}`);
}

// ---------------------------------------------------------------------------
// deploy
// ---------------------------------------------------------------------------

async function deploy() {
  if (!demo.d1_databases?.[0]?.database_id || /^0{8}-/.test(demo.d1_databases[0].database_id)) {
    fail(`Create the database first: (cd workers/shang-hai-orders && npx wrangler d1 create ${demo.d1_databases?.[0]?.database_name}) and put its id in env.demo.`);
  }
  step(`Worker ${demo.name} (test mode only)`);
  let res = wrangler(["deploy", "--env", ENV], { stdio: "inherit" });
  if (res.status !== 0) fail("wrangler deploy failed.");

  step("D1 migrations (additive, already-applied ones are skipped)");
  res = wrangler(["d1", "migrations", "apply", demo.d1_databases[0].database_name, "--remote", "--env", ENV], { stdio: "inherit" });
  if (res.status !== 0) fail("migrations failed.");

  step(`Storefronts against ${WORKER_ORIGIN}`);
  res = spawnSync("npx", ["next", "build"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_ORDER_API_BASE_URL: WORKER_ORIGIN } });
  if (res.status !== 0) fail("next build failed.");
  // The export is built for the /mangocat-test base path: serve it under that path, the root
  // redirecting to the three storefronts, and keep the test environment out of search engines.
  // Cloudflare Pages is now part of Workers: the storefronts are a static-assets-only Worker.
  const staged = join(ROOT, "out-demo");
  rmSync(staged, { recursive: true, force: true });
  mkdirSync(join(staged, "public"), { recursive: true });
  cpSync(join(ROOT, "out"), join(staged, "public/mangocat-test"), { recursive: true });
  writeFileSync(join(staged, "public/_redirects"), "/ /mangocat-test/showcase/shang-hai/ 302\n");
  writeFileSync(join(staged, "public/_headers"), "/*\n  X-Robots-Tag: noindex, nofollow\n");
  writeFileSync(
    join(staged, "wrangler.jsonc"),
    JSON.stringify(
      {
        name: SITE_WORKER,
        compatibility_date: config.compatibility_date,
        assets: { directory: "./public", not_found_handling: "404-page", html_handling: "auto-trailing-slash" },
        workers_dev: true,
      },
      null,
      2,
    ),
  );

  step(`Storefronts: static Worker ${SITE_WORKER}`);
  res = wrangler(["deploy", "--config", join(staged, "wrangler.jsonc")], { stdio: "inherit" });
  if (res.status !== 0) fail("deploying the storefronts failed.");

  await status();
}

// ---------------------------------------------------------------------------
// status (no secret is read: names only)
// ---------------------------------------------------------------------------

async function status() {
  step("Status");
  const health = await fetch(`${WORKER_ORIGIN}/api/health`).then(
    async (r) => ({ code: r.status, body: await r.json().catch(() => ({})) }),
    (e) => ({ code: 0, body: { error: String(e) } }),
  );
  console.log(`  Worker  ${WORKER_ORIGIN}/api/health → ${health.code} ${JSON.stringify(health.body)}`);
  const site = await fetch(SHOWCASE).then((r) => r.status, () => 0);
  console.log(`  Tiendas ${SHOWCASE} → ${site}`);
  console.log(`  Panel   ${PANEL_URL}`);
  const secrets = wrangler(["secret", "list", "--env", ENV, "--format", "json"]);
  const names = secrets.status === 0 ? JSON.parse(secrets.stdout || "[]").map((s) => s.name) : [];
  const wanted = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_RECIPIENTS",
    "STAFF_CODE_SECRET",
  ];
  for (const name of wanted) console.log(`  ${names.includes(name) ? "✔" : "·"} ${name}`);
  if (health.body.paymentsMode === "stripe-live") fail("LIVE payments reported by the demo Worker: this must never happen.");
}

// ---------------------------------------------------------------------------
// secrets (interactive; only in a real terminal)
// ---------------------------------------------------------------------------

/** Reads one line from the terminal; hidden input echoes nothing (only how many characters arrived). */
function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    let value = "";
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    const finish = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write(hidden ? `  [oculto: ${[...value].length} caracteres]\n` : "\n");
      resolve(value.trim());
    };
    const onData = (chunk) => {
      for (const ch of chunk.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")) {
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\r" || ch === "\n") return finish();
        if (ch === "\u007f" || ch === "\b") {
          if (value) {
            value = [...value].slice(0, -1).join("");
            if (!hidden) stdout.write("\b \b");
          }
          continue;
        }
        if (ch < " ") continue;
        value += ch;
        if (!hidden) stdout.write(ch);
      }
    };
    stdin.on("data", onData);
  });
}

async function askUntil(question, check, options) {
  for (;;) {
    const value = await ask(question, options);
    const problem = await check(value);
    if (!problem) return value;
    console.log(`  ✗ ${problem}`);
  }
}

function putSecret(name, value) {
  const res = wrangler(["secret", "put", name, "--env", ENV], { input: `${value}\n` });
  if (res.status !== 0) fail(`could not store ${name}: ${`${res.stderr}\n${res.stdout}`.split("\n").filter(Boolean).slice(-3).join(" ")}`);
  console.log(`  ✔ ${name} guardado en Cloudflare (secreto del Worker ${demo.name})`);
}

async function graph(path, token, init = {}) {
  const res = await fetch(`${GRAPH}/${demo.vars.WHATSAPP_API_VERSION ?? "v26.0"}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
}

const metaError = (r) => `${r.status} ${r.body?.error?.code ?? ""} ${r.body?.error?.message ?? ""}`.trim();

function requireTerminal() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail("Run this in your own terminal (not through a chat or a pipe): secrets are typed with hidden input there and go straight to Cloudflare.");
  }
}

async function askToken(phoneNumberId) {
  let sender = null;
  const token = await askUntil(
    "Token de acceso de Meta (temporal de 24 h o de usuario del sistema): ",
    async (t) => {
      if (t.length < 20) return "Ese texto no parece un token de Meta.";
      const r = await graph(`${phoneNumberId}?fields=display_phone_number,verified_name`, t);
      if (!r.ok) return `Meta no acepta el token para ese número emisor (${metaError(r)}).`;
      sender = r.body;
      return null;
    },
    { hidden: true },
  );
  console.log(`  ✔ Token válido. Número emisor: +${sender.display_phone_number} «${sender.verified_name}»`);
  return { token, sender };
}

async function secrets() {
  requireTerminal();
  console.log(`Shang Hai — entorno de PRUEBA en Cloudflare (${demo.name}).`);
  console.log("Lo que escribas en los campos ocultos no se muestra, no se guarda en archivos y va directo a Cloudflare.\n");

  console.log("— Stripe (modo de prueba) —");
  const stripeKey = await askUntil(
    "Clave secreta de PRUEBA de Stripe (sk_test_… o rk_test_…): ",
    async (k) => {
      if (/^(sk|rk)_live_/.test(k)) return "Esa es una clave REAL (live). Este entorno solo admite claves de prueba.";
      if (!/^(sk|rk)_test_[A-Za-z0-9]{10,}$/.test(k)) return "Debe empezar por sk_test_ o rk_test_.";
      const r = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=1", { headers: { Authorization: `Bearer ${k}` } });
      return r.ok ? null : `Stripe no acepta la clave (${r.status}).`;
    },
    { hidden: true },
  );
  const hook = spawnSync("node", [join(ROOT, "scripts/setup/stripe-webhook.mjs"), WORKER_ORIGIN, "--replace", "--save", "--env", ENV], {
    cwd: ROOT,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, STRIPE_SECRET_KEY: stripeKey },
  });
  if (hook.status !== 0) fail("could not create the Stripe webhook endpoint.");
  putSecret("STRIPE_SECRET_KEY", stripeKey);

  console.log("\n— Meta / WhatsApp (número de prueba) —");
  const waba = await askUntil("WhatsApp Business Account ID (WABA): ", (v) => (/^\d{6,20}$/.test(v) ? null : "Solo dígitos."));
  const phoneNumberId = await askUntil("Phone number ID del número emisor: ", (v) => (/^\d{6,20}$/.test(v) ? null : "Solo dígitos."));
  const { token, sender } = await askToken(phoneNumberId);
  const appSecret = await askUntil(
    "App Secret de la app de Meta (Configuración de la app → Básica): ",
    async (secret) => {
      // Meta checks it for us: a call signed with the wrong app secret is refused.
      const proof = createHmac("sha256", secret).update(token).digest("hex");
      const r = await graph(`${phoneNumberId}?fields=id&appsecret_proof=${proof}`, token);
      return r.ok ? null : `Meta no reconoce ese App Secret para la app del token (${metaError(r)}).`;
    },
    { hidden: true },
  );
  const senderDigits = String(sender.display_phone_number ?? "").replace(/\D/g, "");
  const recipients = await askUntil("Tu WhatsApp, que recibirá avisos y códigos (+34…; varios separados por comas): ", (v) => {
    const numbers = v.split(",").map((n) => n.replace(/[\s().-]/g, "").replace(/^\+/, ""));
    if (!numbers.length || numbers.some((n) => !/^[1-9]\d{7,14}$/.test(n))) return "Formato internacional, por ejemplo +34612345678.";
    if (numbers.includes(senderDigits)) return "No puede ser el propio número emisor (Meta lo rechaza: error 131021).";
    return null;
  });

  putSecret("WHATSAPP_ACCESS_TOKEN", token);
  putSecret("WHATSAPP_APP_SECRET", appSecret);
  putSecret("WHATSAPP_PHONE_NUMBER_ID", phoneNumberId);
  putSecret("WHATSAPP_RECIPIENTS", recipients.split(",").map((n) => `+${n.replace(/[\s().-]/g, "").replace(/^\+/, "")}`).join(","));
  const verifyToken = randomBytes(18).toString("base64url");
  putSecret("WHATSAPP_WEBHOOK_VERIFY_TOKEN", verifyToken);
  putSecret("STAFF_CODE_SECRET", randomBytes(32).toString("base64url"));

  step("Plantillas de WhatsApp (Meta las revisa; suele tardar minutos)");
  const templates = spawnSync("node", [join(ROOT, "scripts/setup/whatsapp-templates.mjs"), "--create"], {
    cwd: ROOT,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, WHATSAPP_ACCESS_TOKEN: token, WHATSAPP_WABA_ID: waba, PANEL_URL },
  });
  if (templates.status !== 0) console.log("  ✗ No se pudieron crear todas las plantillas: repite «node scripts/setup/demo.mjs templates» más tarde.");

  const subscribed = await graph(`${waba}/subscribed_apps`, token, { method: "POST" });
  console.log(subscribed.ok ? "  ✔ App suscrita a los webhooks de la cuenta de WhatsApp" : `  ✗ No se pudo suscribir la app a la cuenta (${metaError(subscribed)})`);

  console.log(`
Último paso, en Meta (developers.facebook.com → tu app → WhatsApp → Configuración → Webhook → Editar):
  URL de devolución de llamada:  ${WORKER_ORIGIN}/api/whatsapp/webhook
  Token de verificación:         ${verifyToken}
Pulsa «Verificar y guardar» y después, en «Campos del webhook», suscribe «messages».
(Este token solo sirve para que Meta compruebe la URL; los avisos de Meta van firmados con el App Secret.)

Tiendas: ${SHOWCASE}
Panel:   ${PANEL_URL}`);
}

async function renewToken() {
  requireTerminal();
  const phoneNumberId = await askUntil("Phone number ID del número emisor: ", (v) => (/^\d{6,20}$/.test(v) ? null : "Solo dígitos."));
  const { token } = await askToken(phoneNumberId);
  putSecret("WHATSAPP_ACCESS_TOKEN", token);
}

async function templateStatus() {
  requireTerminal();
  const waba = await askUntil("WhatsApp Business Account ID (WABA): ", (v) => (/^\d{6,20}$/.test(v) ? null : "Solo dígitos."));
  const token = await ask("Token de acceso de Meta: ", { hidden: true });
  const res = spawnSync("node", [join(ROOT, "scripts/setup/whatsapp-templates.mjs"), "--check"], {
    cwd: ROOT,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, WHATSAPP_ACCESS_TOKEN: token, WHATSAPP_WABA_ID: waba },
  });
  process.exit(res.status ?? 1);
}

const commands = { deploy, secrets, token: renewToken, templates: templateStatus, status };
const command = commands[process.argv[2]];
if (!command) {
  console.error("usage: node scripts/setup/demo.mjs deploy | secrets | token | templates | status");
  process.exit(1);
}
if (!existsSync(join(WORKER_DIR, "node_modules/wrangler"))) fail("Run npm ci in workers/shang-hai-orders first.");
await command();
