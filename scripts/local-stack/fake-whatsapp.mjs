// Stand-in for the WhatsApp Cloud API (POST /{version}/{phone-number-id}/messages) for unit tests
// and the local stack. It models what matters for the order alerts, from Meta's documentation:
// - the access token (expired → 401 code 190) and the sender's phone number id;
// - approved templates only (workers/shang-hai-orders/whatsapp/templates.json): unknown or not
//   approved → 132001, wrong parameter count → 132000, parameter with a newline / tab / 4+ spaces
//   → 132018, missing URL-button parameter → 131008;
// - the test number's allowed recipients (others → 131030) and "sender = recipient" (131021);
// - the pair rate limit: ~1 message every 6 s to the same recipient (→ 429 code 131056);
// - status webhooks (sent → delivered → read, or failed with a code), signed like Meta
//   (X-Hub-Signature-256: sha256=HMAC-SHA256(app secret, body)), echoing biz_opaque_callback_data;
// - injected failures: HTTP/Graph errors, no answer, answer lost after acceptance, delivery failures.
// It is NOT WhatsApp. With `persistPath` (local demo) the received messages survive restarts.
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATES_FILE = fileURLToPath(new URL("../../workers/shang-hai-orders/whatsapp/templates.json", import.meta.url));

export function signMeta(body, secret) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function graphError(status, code, message, details) {
  return { status, body: { error: { message, type: status === 401 ? "OAuthException" : "GraphMethodException", code, ...(details ? { error_data: { details } } : {}), fbtrace_id: "Afake" } } };
}

/**
 * @param {{ token?: string, phoneNumberId?: string, displayNumber?: string, allowedRecipients?: string[] | null,
 *           pairIntervalMs?: number, panelUrl?: string, persistPath?: string, now?: () => number }} [options]
 */
/**
 * @typedef {{ id: string, to: string, template: string, category: string, params: string[], text: string,
 *   button: { text: string, url: string | null, copy: string | null } | null, callback: string | null, at: string,
 *   readQueued?: boolean }} FakeWhatsAppMessage
 * @typedef {{ id: string, status: string, timestamp: string, recipient_id: string, biz_opaque_callback_data?: string,
 *   errors?: { code: number, title: string, message: string, error_data: { details: string } }[] }} FakeWhatsAppStatus
 */
export function createFakeWhatsApp(options = {}) {
  const definitions = JSON.parse(readFileSync(TEMPLATES_FILE, "utf8"));
  /** @type {{ token: string, tokenExpired: boolean, phoneNumberId: string, displayNumber: string, allowedRecipients: string[] | null,
   *   pairIntervalMs: number, templateStatus: Record<string, string>, messages: FakeWhatsAppMessage[],
   *   lastToRecipient: Record<string, number>, statuses: FakeWhatsAppStatus[], failures: any[], calls: number }} */
  const state = {
    token: options.token ?? "EAAfake-whatsapp-token-for-tests-only-0000000000",
    tokenExpired: false,
    phoneNumberId: options.phoneNumberId ?? "100000000000001",
    displayNumber: options.displayNumber ?? "15550001111",
    /** null = any recipient (a production number); a list = the test number's allowed recipients. */
    allowedRecipients: options.allowedRecipients ?? null,
    pairIntervalMs: options.pairIntervalMs ?? 6_000,
    templateStatus: Object.fromEntries(definitions.templates.map((t) => [t.name, "APPROVED"])),
    messages: [],
    lastToRecipient: {},
    statuses: [],
    failures: [],
    calls: 0,
  };
  const now = () => options.now?.() ?? Date.now();
  const persistPath = options.persistPath ?? null;
  if (persistPath && existsSync(persistPath)) {
    const saved = JSON.parse(readFileSync(persistPath, "utf8"));
    state.messages = saved.messages ?? [];
    state.statuses = saved.statuses ?? [];
  }
  function save() {
    if (!persistPath) return;
    mkdirSync(dirname(persistPath), { recursive: true });
    const tmp = `${persistPath}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify({ version: 1, messages: state.messages, statuses: state.statuses }));
    renameSync(tmp, persistPath);
  }

  const template = (name) => definitions.templates.find((t) => t.name === name);
  const bodyVars = (def) => {
    const text = def.components.find((c) => c.type === "BODY")?.text;
    if (!text) return def.category === "AUTHENTICATION" ? 1 : 0;
    return new Set([...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])).size;
  };
  const buttonVar = (def) => (def.components.find((c) => c.type === "BUTTONS")?.buttons ?? []).some((b) => (b.type === "URL" && /\{\{1\}\}$/.test(b.url ?? "")) || b.type === "OTP");

  function render(def, params) {
    if (def.category === "AUTHENTICATION") {
      return `*${params[0]}* es tu código de verificación. Por tu seguridad, no lo compartas.\nEste código caduca en 10 minutos.`;
    }
    const text = def.components.find((c) => c.type === "BODY")?.text ?? "";
    return text.replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? "");
  }

  function buttonFor(def, suffix) {
    const button = (def.components.find((c) => c.type === "BUTTONS")?.buttons ?? [])[0];
    if (!button) return null;
    if (button.type === "OTP") return { text: button.text, url: null, copy: suffix };
    const base = (options.panelUrl ?? "https://panel.example/admin").replace(/\/+$/, "");
    return { text: button.text, url: button.url.replace("{{PANEL_URL}}", base).replace("{{1}}", encodeURIComponent(suffix ?? "")), copy: null };
  }

  function queueStatus(message, status, errors) {
    state.statuses.push({
      id: message.id,
      status,
      timestamp: String(Math.floor(now() / 1000)),
      recipient_id: message.to,
      ...(message.callback ? { biz_opaque_callback_data: message.callback } : {}),
      ...(errors ? { errors } : {}),
    });
  }

  function injected() {
    const failure = state.failures[0];
    if (!failure) return null;
    if (--failure.times <= 0) state.failures.shift();
    return failure;
  }

  /** POST /{version}/{phone-number-id}/messages → { status, body } | { network: true } */
  function handle(method, path, headers, raw) {
    state.calls += 1;
    const m = /^\/v\d+\.\d\/(\d+)\/messages$/.exec(path);
    if (method !== "POST" || !m) return graphError(400, 100, "Unsupported request");
    const failure = injected();
    if (failure?.network && !failure.afterExecute) return { network: true };
    if (failure && !failure.afterExecute && !failure.deliveryFailure) {
      return graphError(failure.status ?? 500, failure.code ?? 131000, failure.message ?? "Injected failure", failure.details);
    }
    const auth = /^Bearer (.+)$/.exec(headers.authorization ?? "")?.[1];
    if (!auth) return graphError(401, 200, "No access token provided");
    if (state.tokenExpired) return graphError(401, 190, "Error validating access token: Session has expired.", "token expired");
    if (auth !== state.token) return graphError(401, 190, "Invalid OAuth access token.", "invalid token");
    if (m[1] !== state.phoneNumberId) return graphError(400, 100, "Unsupported post request. Object does not exist.", "phone number id");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return graphError(400, 100, "Invalid JSON");
    }
    if (body.messaging_product !== "whatsapp" || body.type !== "template" || !body.template) return graphError(400, 131051, "Unsupported message type");
    const to = String(body.to ?? "");
    if (!/^\d{8,15}$/.test(to)) return graphError(400, 131009, "Parameter value is not valid", "recipient");
    if (to === state.displayNumber) return graphError(400, 131021, "Recipient cannot be sender", "sender = recipient");
    if (state.allowedRecipients && !state.allowedRecipients.includes(to)) {
      return graphError(400, 131030, "Recipient phone number not in allowed list", "Add the number to the test number's recipient list");
    }
    const def = template(body.template.name);
    if (!def || state.templateStatus[def.name] !== "APPROVED" || body.template.language?.code !== definitions.language) {
      return graphError(400, 132001, "Template name does not exist in the translation", `${body.template.name} (${body.template.language?.code})`);
    }
    const components = body.template.components ?? [];
    const params = (components.find((c) => c.type === "body")?.parameters ?? []).map((p) => String(p.text ?? ""));
    if (params.length !== bodyVars(def)) return graphError(400, 132000, "Number of parameters does not match the expected number of params");
    if (params.some((p) => /[\n\t]/.test(p) || / {5,}/.test(p) || p.length === 0)) {
      return graphError(400, 132018, "Param text cannot have new-line/tab characters or more than 4 consecutive spaces");
    }
    const button = components.find((c) => c.type === "button");
    const suffix = button?.parameters?.[0]?.text;
    if (buttonVar(def) && !suffix) return graphError(400, 131008, "Required parameter is missing", "button parameter");
    const last = state.lastToRecipient[to] ?? 0;
    if (state.pairIntervalMs > 0 && now() - last < state.pairIntervalMs) {
      return graphError(429, 131056, "(Business Account, Consumer Account) pair rate limit hit");
    }
    state.lastToRecipient[to] = now();
    const message = {
      id: `wamid.HBgL${randomBytes(12).toString("hex")}`,
      to,
      template: def.name,
      category: def.category,
      params,
      text: render(def, params),
      button: buttonFor(def, suffix),
      callback: typeof body.biz_opaque_callback_data === "string" ? body.biz_opaque_callback_data : null,
      at: new Date(now()).toISOString(),
    };
    state.messages.push(message);
    if (failure?.deliveryFailure) {
      // Accepted by the API, then not delivered (e.g. 131026: not a WhatsApp user).
      queueStatus(message, "failed", [{ code: failure.deliveryFailure, title: failure.title ?? "Message undeliverable", message: failure.title ?? "Message undeliverable", error_data: { details: "injected" } }]);
    } else {
      queueStatus(message, "sent");
      queueStatus(message, "delivered");
    }
    save();
    if (failure?.afterExecute) return { network: true }; // accepted, but the answer never arrived
    return { status: 200, body: { messaging_product: "whatsapp", contacts: [{ input: to, wa_id: to }], messages: [{ id: message.id, message_status: "accepted" }] } };
  }

  /** The webhook payload Meta would send for the queued statuses (one entry, one change). */
  function takeStatusPayloads() {
    const statuses = state.statuses.splice(0, state.statuses.length);
    save();
    return statuses.map((status) => ({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: state.displayNumber, phone_number_id: state.phoneNumberId },
                statuses: [status],
              },
            },
          ],
        },
      ],
    }));
  }

  return {
    state,
    handle,
    takeStatusPayloads,
    requeueStatusPayloads(payloads) {
      for (const p of payloads) state.statuses.unshift(...p.entry[0].changes[0].value.statuses);
      save();
    },
    /** Marks a message read (as when the owner opens the chat). */
    read(messageId) {
      const message = state.messages.find((m) => m.id === messageId);
      if (message) queueStatus(message, "read");
      save();
    },
    /** Next sends fail: { status?, code?, network?, afterExecute?, deliveryFailure?, times? } */
    failNext(failure) {
      state.failures.push({ times: 1, ...failure });
    },
    clearFailures() {
      state.failures.length = 0;
    },
    expireToken(expired = true) {
      state.tokenExpired = expired;
    },
    setTemplateStatus(name, status) {
      state.templateStatus[name] = status;
    },
    messages: () => state.messages,
    lastText: () => state.messages.at(-1)?.text ?? null,
    fetchFor() {
      return async (input, init = {}) => {
        const url = new URL(typeof input === "string" ? input : input.url);
        const headers = Object.fromEntries(new Headers(init.headers).entries());
        const res = handle(init.method ?? "GET", url.pathname, headers, String(init.body ?? ""));
        if (res.network) throw new TypeError("fetch failed (injected network error)");
        return new Response(JSON.stringify(res.body), { status: res.status, headers: { "Content-Type": "application/json" } });
      };
    },
  };
}
