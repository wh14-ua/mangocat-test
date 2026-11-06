#!/usr/bin/env node
// Checks a real WhatsApp Cloud API setup before relying on it, and can send one test alert.
//
//   WHATSAPP_ACCESS_TOKEN=… WHATSAPP_PHONE_NUMBER_ID=… WHATSAPP_WABA_ID=… \
//     node scripts/setup/whatsapp-check.mjs
//     node scripts/setup/whatsapp-check.mjs --send-test-to +34612345678
//
// It reports: the sender number (display number, verified name, quality, platform), whether the
// app is subscribed to the account's webhooks, and the review status of every template. With
// --send-test-to it sends ONE `pedido_nuevo` alert with sample values (marked as a test) and
// prints the message id: WhatsApp accepting it is NOT a delivery — the delivery receipt reaches
// the Worker's /api/whatsapp/webhook (panel → «Estado del sistema» → «Último aviso entregado»).
// Credentials are read from the environment only. No order, payment or customer data is used.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const definitions = JSON.parse(readFileSync(fileURLToPath(new URL("../../workers/shang-hai-orders/whatsapp/templates.json", import.meta.url)), "utf8"));
const token = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
const phone = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
const waba = process.env.WHATSAPP_WABA_ID ?? "";
const version = process.env.WHATSAPP_API_VERSION ?? "v26.0";
const base = process.env.WHATSAPP_GRAPH_BASE ?? "https://graph.facebook.com";
const at = process.argv.indexOf("--send-test-to");
const testTo = at === -1 ? null : (process.argv[at + 1] ?? "").replace(/[\s().-]/g, "").replace(/^\+/, "");

if (!token || !/^\d{6,20}$/.test(phone)) {
  console.error("✗ Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID (and WHATSAPP_WABA_ID to check templates).");
  process.exit(1);
}

async function graph(path, init = {}) {
  const res = await fetch(`${base}/${version}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

let problems = 0;
const info = await graph(`${phone}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,throughput`);
if (!info.ok) {
  problems += 1;
  const code = info.body?.error?.code;
  console.error(`✗ Sender phone number: ${info.status} ${code ?? ""} ${info.body?.error?.message ?? ""}`);
  if (code === 190) console.error("  The access token is expired or invalid: create a System User token (Business settings → System users).");
} else {
  const b = info.body;
  console.log(`✔ Sender: +${b.display_phone_number} «${b.verified_name}» · quality ${b.quality_rating ?? "?"} · ${b.platform_type ?? "?"} · throughput ${b.throughput?.level ?? "?"}`);
}

if (/^\d{5,20}$/.test(waba)) {
  const apps = await graph(`${waba}/subscribed_apps`);
  if (apps.ok && (apps.body.data ?? []).length) console.log(`✔ Webhooks: ${apps.body.data.length} app(s) subscribed to the account`);
  else {
    problems += 1;
    console.error(`✗ Webhooks: no app subscribed to this WhatsApp account (POST /${waba}/subscribed_apps) — delivery receipts would never arrive.`);
  }
  const list = await graph(`${waba}/message_templates?fields=name,status,category,language&limit=200`);
  for (const def of definitions.templates) {
    const found = (list.body.data ?? []).find((t) => t.name === def.name && t.language === definitions.language);
    if (found?.status === "APPROVED") console.log(`✔ Template ${def.name} approved`);
    else {
      problems += 1;
      console.error(`✗ Template ${def.name}: ${found ? found.status : "missing"} (scripts/setup/whatsapp-templates.mjs --create)`);
    }
  }
}

if (testTo) {
  if (!/^[1-9]\d{7,14}$/.test(testTo)) {
    console.error("✗ --send-test-to needs a number in international format, e.g. +34612345678");
    process.exit(1);
  }
  const res = await graph(`${phone}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: testTo,
      type: "template",
      template: {
        name: "pedido_nuevo",
        language: { code: definitions.language },
        components: [
          { type: "body", parameters: ["#PRUEBA", "SHANG HAI (PRUEBA, no preparar)", "0,00 €", "1× Prueba de configuración", "Recogida en el local", "prueba, sin cobro"].map((text) => ({ type: "text", text })) },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "PRUEBA" }] },
        ],
      },
    }),
  });
  if (res.ok) {
    console.log(`✔ Test alert accepted by WhatsApp: ${res.body.messages?.[0]?.id}. Check the phone — and the panel's «Último aviso entregado» for the delivery receipt.`);
  } else {
    problems += 1;
    console.error(`✗ Test alert refused: ${res.status} ${res.body?.error?.code ?? ""} ${res.body?.error?.message ?? ""} ${res.body?.error?.error_data?.details ?? ""}`);
  }
}

process.exit(problems ? 1 : 0);
