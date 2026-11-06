#!/usr/bin/env node
// Creates (or checks) the WhatsApp message templates the order system needs, in the restaurant's
// WhatsApp Business Account, from workers/shang-hai-orders/whatsapp/templates.json.
//
//   WHATSAPP_ACCESS_TOKEN=… WHATSAPP_WABA_ID=… PANEL_URL=https://<worker>/admin \
//     node scripts/setup/whatsapp-templates.mjs --check     list what exists and its review status
//     node scripts/setup/whatsapp-templates.mjs --create    create the missing ones (Meta reviews them)
//
// Credentials come from the environment only (never written to disk). The token needs the
// whatsapp_business_management permission. Utility templates are usually reviewed in minutes;
// the order alerts cannot be sent until they are APPROVED (error 132001 until then, shown in the
// panel). Graph API version: WHATSAPP_API_VERSION (default v26.0).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const definitions = JSON.parse(readFileSync(fileURLToPath(new URL("../../workers/shang-hai-orders/whatsapp/templates.json", import.meta.url)), "utf8"));
const token = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
const waba = process.env.WHATSAPP_WABA_ID ?? "";
const panelUrl = (process.env.PANEL_URL ?? "").replace(/\/+$/, "");
const version = process.env.WHATSAPP_API_VERSION ?? "v26.0";
const base = process.env.WHATSAPP_GRAPH_BASE ?? "https://graph.facebook.com";
const mode = process.argv.includes("--create") ? "create" : "check";

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!token || !/^\d{5,20}$/.test(waba)) fail("Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_WABA_ID (WhatsApp Manager → Account tools / API setup).");
if (mode === "create" && !/^https:\/\/[^\s]+\/admin$/.test(panelUrl)) fail("Set PANEL_URL to the panel's public https URL ending in /admin (the template buttons point there).");

async function graph(path, init = {}) {
  const res = await fetch(`${base}/${version}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${body?.error?.code ?? ""} ${body?.error?.message ?? ""} ${body?.error?.error_data?.details ?? ""}`.trim());
  return body;
}

/** The template as Meta's API wants it, with the deployment's panel URL in the buttons. */
function payload(def) {
  const components = JSON.parse(JSON.stringify(def.components).replaceAll("{{PANEL_URL}}", panelUrl));
  return { name: def.name, language: definitions.language, category: def.category, ...(def.parameter_format ? { parameter_format: def.parameter_format } : {}), components };
}

const existing = (await graph(`${waba}/message_templates?fields=name,status,category,language,rejected_reason&limit=200`)).data ?? [];
let missing = 0;
for (const def of definitions.templates) {
  const found = existing.find((t) => t.name === def.name && t.language === definitions.language);
  if (found) {
    const note = found.category !== def.category ? ` (category ${found.category}, expected ${def.category})` : "";
    console.log(`${found.status === "APPROVED" ? "✔" : "…"} ${def.name} [${definitions.language}] ${found.status}${found.rejected_reason && found.rejected_reason !== "NONE" ? ` — ${found.rejected_reason}` : ""}${note}`);
    continue;
  }
  missing += 1;
  if (mode === "check") {
    console.log(`✗ ${def.name} [${definitions.language}] missing`);
    continue;
  }
  const created = await graph(`${waba}/message_templates`, { method: "POST", body: JSON.stringify(payload(def)) });
  console.log(`+ ${def.name} created: ${created.status ?? "PENDING"} (${created.category ?? def.category})`);
}
if (mode === "check" && missing) {
  console.log(`\n${missing} template(s) missing: run with --create (PANEL_URL set).`);
  process.exit(1);
}
