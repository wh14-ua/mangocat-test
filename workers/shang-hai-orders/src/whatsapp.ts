import { formatCents } from "../../../src/lib/commerce/money";
import templates from "../whatsapp/templates.json";
import type { WhatsAppConfig } from "./config";
import { hmacSha256Hex, timingSafeEqual } from "./crypto";

/**
 * WhatsApp Cloud API (Meta) — the primary alert channel.
 *
 * - Business-initiated messages must be approved templates (whatsapp/templates.json): UTILITY
 *   for order alerts, AUTHENTICATION for sign-in codes. Parameters carry the order number,
 *   total, dishes, fulfillment and payment state — never the customer's name, phone, email,
 *   notes or address — and the button only OPENS the panel (no action from WhatsApp).
 * - An accepted API call is not a delivery: delivery is confirmed by the status webhook
 *   ("delivered" / "read"), see whatsapp-webhook.ts.
 * - There is no idempotency key: a send whose answer was lost is retried only after a pause,
 *   and the status webhook (which echoes biz_opaque_callback_data = our row id) reconciles it
 *   first when the message did go out.
 * Official references: developers.facebook.com/documentation/business-messaging/whatsapp
 * (messages, templates, error codes, throughput, webhooks).
 */

export type TemplateKind = "new_order" | "reminder" | "needs_review" | "auto_cancelled" | "login_code";

type TemplateDef = {
  name: string;
  kind: string;
  category: string;
  components: { type: string; text?: string; buttons?: { type: string; url?: string }[] }[];
};

export const TEMPLATES = templates.templates as TemplateDef[];

export function templateFor(kind: TemplateKind): TemplateDef {
  const def = TEMPLATES.find((t) => t.kind === kind);
  if (!def) throw new Error(`no WhatsApp template for ${kind}`);
  return def;
}

/** Number of {{n}} variables in a template's body. */
export function bodyParamCount(def: TemplateDef): number {
  const body = def.components.find((c) => c.type === "BODY");
  if (!body?.text) return def.category === "AUTHENTICATION" ? 1 : 0;
  return new Set([...body.text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])).size;
}

/** Whether the template has a button whose URL takes a variable suffix (or an OTP button). */
export function buttonTakesParam(def: TemplateDef): boolean {
  const buttons = def.components.find((c) => c.type === "BUTTONS")?.buttons ?? [];
  return buttons.some((b) => (b.type === "URL" && /\{\{1\}\}$/.test(b.url ?? "")) || b.type === "OTP");
}

/**
 * A template parameter value as Meta accepts it: one line, no tabs, no runs of spaces (newlines,
 * tabs and 4+ spaces are rejected, error 132018), bounded, never empty.
 */
export function cleanParam(value: string, max = 200): string {
  const line = String(value).replace(/[\r\n\t\u2028\u2029]+/g, " ").replace(/ {2,}/g, " ").trim();
  if (!line) return "—";
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

// ---------------------------------------------------------------------------
// Composition (no personal data)
// ---------------------------------------------------------------------------

export type AlertOrder = {
  id: string;
  number: number | null;
  total_cents: number;
  fulfillment: string;
  payment_status: string;
  payments_mode: string;
  review_reason: string | null;
};

export type WhatsAppMessage = { template: string; body: string[]; buttonSuffix: string | null };

/** "3× Gyozas de pollo a la plancha, 1× Combo A" (dish names only), bounded with "y N más". */
export function itemsSummary(items: { quantity: number; name: string }[], max = 250): string {
  const parts = items.map((i) => `${i.quantity}× ${cleanParam(i.name, 80)}`);
  const shown: string[] = [];
  for (const [index, part] of parts.entries()) {
    const rest = parts.length - index - 1;
    const candidate = [...shown, part].join(", ") + (rest ? ` y ${rest} más` : "");
    if (candidate.length > max && shown.length) return `${shown.join(", ")} y ${parts.length - index} más`;
    shown.push(part);
  }
  return cleanParam(shown.join(", "), max);
}

export function moneyText(payment: string): string {
  switch (payment) {
    case "captured":
      return "cobrado; si se rechaza, se devuelve automáticamente";
    case "authorized":
      return "autorizado, se cobra al aceptar";
    case "refunded":
      return "devuelto";
    case "refund_pending":
      return "devolución pedida, pendiente de confirmar";
    case "canceled":
      return "anulado, no se ha cobrado nada";
    default:
      return "revisa el pago en el panel";
  }
}

export function whatsappMessageFor(
  kind: Exclude<TemplateKind, "login_code">,
  order: AlertOrder,
  items: { quantity: number; name: string }[],
  options: { restaurant: string; reminderMinutes?: number; timeoutMinutes?: number; autoCancelText: string },
): WhatsAppMessage {
  const def = templateFor(kind);
  const number = `#${order.number ?? order.id}`;
  // Test orders say so in the message itself (the template text is fixed).
  const restaurant = cleanParam(order.payments_mode === "stripe-test" ? `${options.restaurant} (PRUEBA, no preparar)` : options.restaurant, 60);
  let body: string[];
  switch (kind) {
    case "new_order":
      body = [
        number,
        restaurant,
        formatCents(order.total_cents),
        itemsSummary(items),
        order.fulfillment === "delivery" ? "Reparto a domicilio" : "Recogida en el local",
        moneyText(order.payment_status),
      ];
      break;
    case "reminder":
      body = [number, restaurant, String(options.reminderMinutes ?? 4)];
      break;
    case "needs_review":
      body = [number, restaurant, cleanParam(order.review_reason ?? "revisa el pedido en el panel", 300)];
      break;
    case "auto_cancelled":
      body = [number, restaurant, String(options.timeoutMinutes ?? 30), cleanParam(options.autoCancelText, 200)];
      break;
  }
  return { template: def.name, body: body.map((b) => cleanParam(b, 300)), buttonSuffix: buttonTakesParam(def) ? order.id : null };
}

export function loginCodeMessage(code: string): WhatsAppMessage {
  return { template: templateFor("login_code").name, body: [code], buttonSuffix: code };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/**
 * What a failure means for the next attempt:
 * - uncertain: no answer (timeout, dropped connection) — Meta may have accepted it;
 * - transient: Meta's side (5xx, 1, 2, 131000, 131016, 131057);
 * - rate: throughput / app limits (130429, 4, 80007, 131048);
 * - pair-rate: too many messages to the same recipient (131056: ~1 every 6 s);
 * - credentials: the access token is missing, invalid or expired (0, 190, 200);
 * - configuration: permissions, account, billing, registration, test-number recipient list (10,
 *   100, 131005, 131021, 131030, 131031, 131042, 131045, 133010, 368, other 4xx) — a person must fix it;
 * - template: missing, unapproved, paused, disabled or misused template (132xxx);
 * - undeliverable: this recipient cannot receive it (131026, 131009, 131047, 131050, 131051).
 */
export type WhatsAppFailure = "uncertain" | "transient" | "rate" | "pair-rate" | "credentials" | "configuration" | "template" | "undeliverable";

const BY_CODE: Record<number, WhatsAppFailure> = {
  0: "credentials",
  190: "credentials",
  200: "credentials",
  1: "transient",
  2: "transient",
  131000: "transient",
  131016: "transient",
  131057: "transient",
  4: "rate",
  80007: "rate",
  130429: "rate",
  131048: "rate",
  131049: "rate",
  131056: "pair-rate",
  3: "configuration",
  10: "configuration",
  100: "configuration",
  131005: "configuration",
  131008: "configuration",
  131021: "configuration",
  131030: "configuration",
  131031: "configuration",
  131042: "configuration",
  131045: "configuration",
  133010: "configuration",
  368: "configuration",
  131009: "undeliverable",
  131026: "undeliverable",
  131047: "undeliverable",
  131050: "undeliverable",
  131051: "undeliverable",
};

export function classifyWhatsAppError(status: number, code: number | null): WhatsAppFailure {
  if (code !== null && BY_CODE[code]) return BY_CODE[code];
  if (code !== null && code >= 132000 && code < 133000) return "template";
  if (status === 401) return "credentials";
  if (status === 429) return "rate";
  if (status >= 500 || status === 0) return "transient";
  return "configuration";
}

export type WhatsAppResult =
  | { ok: true; messageId: string; waId: string | null }
  | { ok: false; kind: WhatsAppFailure; code: number | null; status: number; error: string; retryAfterSeconds: number | null };

export const WHATSAPP_TIMEOUT_MS = 10_000;

export async function sendWhatsAppTemplate(
  fetchImpl: typeof fetch,
  cfg: Pick<WhatsAppConfig, "apiBase" | "version" | "phoneNumberId" | "token" | "language">,
  to: string,
  message: WhatsAppMessage,
  callbackData?: string,
): Promise<WhatsAppResult> {
  const components: Record<string, unknown>[] = [{ type: "body", parameters: message.body.map((text) => ({ type: "text", text })) }];
  if (message.buttonSuffix) {
    components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: message.buttonSuffix }] });
  }
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    ...(callbackData ? { biz_opaque_callback_data: callbackData } : {}),
    template: { name: message.template, language: { code: cfg.language }, components },
  };
  let res: Response;
  let body: { messages?: { id?: string }[]; contacts?: { wa_id?: string }[]; error?: { code?: number; message?: string; error_data?: { details?: string } } } | null;
  try {
    res = await fetchImpl(`${cfg.apiBase}/${cfg.version}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WHATSAPP_TIMEOUT_MS),
    });
    body = (await res.json().catch(() => null)) as typeof body;
  } catch {
    return { ok: false, kind: "uncertain", code: null, status: 0, error: "sin respuesta de WhatsApp (puede que se haya enviado)", retryAfterSeconds: null };
  }
  const id = body?.messages?.[0]?.id;
  if (res.ok && typeof id === "string" && id) return { ok: true, messageId: id, waId: body?.contacts?.[0]?.wa_id ?? null };
  const code = typeof body?.error?.code === "number" ? body.error.code : null;
  const errorText = body?.error?.message ?? `HTTP ${res.status}`;
  const details = body?.error?.error_data?.details;
  const detail = details && details !== errorText ? `${errorText} — ${details}` : errorText;
  const retryAfter = Number(res.headers.get("retry-after"));
  return {
    ok: false,
    kind: res.ok ? "transient" : classifyWhatsAppError(res.status, code),
    code,
    status: res.status,
    error: `${code ?? res.status}: ${String(detail)}`.slice(0, 300),
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  };
}

/**
 * Seconds until the next attempt after a failure, or null to give up. Pair-rate follows Meta's
 * advice (wait 6 s, then 4^n); configuration problems are retried every 30 minutes for a few
 * hours, in case a person fixes them meanwhile (the panel shows the problem).
 */
export function whatsappRetryDelay(kind: WhatsAppFailure, attempts: number, retryAfter: number | null): number | null {
  const n = Math.max(0, attempts - 1);
  switch (kind) {
    case "undeliverable":
      return null;
    case "uncertain":
      return attempts <= 4 ? 90 : null;
    case "pair-rate":
      return attempts <= 6 ? Math.min(6 * 4 ** n, 600) : null;
    case "rate":
      return attempts <= 8 ? Math.max(retryAfter ?? 0, Math.min(30 * 2 ** n, 900)) : null;
    case "transient":
      return attempts <= 6 ? [15, 60, 120, 300, 600, 1800][n] : null;
    case "credentials":
    case "configuration":
    case "template":
      return attempts <= 8 ? 1800 : null;
  }
}

/** Pair rate limit: at most one message to the same recipient every this many seconds. */
export const PAIR_INTERVAL_MS = 6_000;

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

/** X-Hub-Signature-256: "sha256=" + HMAC-SHA256(app secret, raw body), compared in constant time. */
export async function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): Promise<boolean> {
  const match = /^sha256=([0-9a-f]{64})$/i.exec(header?.trim() ?? "");
  if (!match || !appSecret) return false;
  return timingSafeEqual(await hmacSha256Hex(appSecret, rawBody), match[1].toLowerCase());
}
