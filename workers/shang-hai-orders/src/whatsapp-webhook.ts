import type { Deps, Env } from "./env";
import { setState } from "./db";
import { timingSafeEqual } from "./crypto";
import { errorJson, json, readBodyLimited, securityHeaders } from "./http";
import { log } from "./log";
import type { NotificationRow } from "./notifications";
import { classifyWhatsAppError, verifyMetaSignature, whatsappRetryDelay } from "./whatsapp";

/**
 * GET  /api/whatsapp/webhook  — Meta's subscription check (hub.mode / hub.verify_token / hub.challenge)
 * POST /api/whatsapp/webhook  — message status updates, signed with the app secret
 *                               (X-Hub-Signature-256: sha256=HMAC-SHA256(app secret, raw body))
 *
 * Status updates are the only proof of delivery: "sent" (left Meta), "delivered" (on the phone),
 * "read", or "failed" with an error code. Meta retries webhooks for up to 7 days and may repeat
 * or reorder them, so every update is idempotent and monotonic: a receipt is never undone, and a
 * failure reported after a delivery (or for an older attempt) is ignored. Each message carries
 * biz_opaque_callback_data = "n:<row id>", which reconciles a send whose API answer was lost:
 * the row is marked sent instead of being sent again.
 */

type StatusUpdate = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  biz_opaque_callback_data?: string;
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
};

type WebhookPayload = {
  object?: string;
  entry?: { changes?: { field?: string; value?: { statuses?: StatusUpdate[]; messages?: unknown[] } }[] }[];
};

const MAX_BODY = 512 * 1024;

export async function handleWhatsAppWebhook(request: Request, env: Env, deps: Deps): Promise<Response> {
  if (request.method === "GET") return verifySubscription(request, env);
  if (request.method !== "POST") return errorJson("method-not-allowed", 405);
  const secret = env.WHATSAPP_APP_SECRET?.trim() ?? "";
  // Without the app secret nothing can be trusted: 503 makes Meta retry once it is configured.
  if (!secret) return errorJson("whatsapp-not-configured", 503);
  const body = await readBodyLimited(request, MAX_BODY);
  if (!body.ok) return errorJson("payload-too-large", 413);
  if (!(await verifyMetaSignature(body.text, request.headers.get("X-Hub-Signature-256"), secret))) {
    log("whatsapp.webhook-rejected", { reason: "signature" });
    return errorJson("invalid-signature", 401);
  }
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(body.text) as WebhookPayload;
  } catch {
    return json({ ok: true, ignored: "not-json" }); // signed by Meta but unreadable: retrying will not help
  }
  let applied = 0;
  for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value;
      for (const status of Array.isArray(value?.statuses) ? value.statuses : []) {
        if (await applyStatus(env, deps, status)) applied += 1;
      }
      if (Array.isArray(value?.messages) && value.messages.length) {
        // A reply from an authorised phone. Nothing acts on WhatsApp messages: orders are handled in the panel.
        await setState(env.DB, "whatsapp.last_inbound", String(value.messages.length), deps.now().toISOString());
      }
    }
  }
  return json({ ok: true, applied });
}

function verifySubscription(request: Request, env: Env): Response {
  const params = new URL(request.url).searchParams;
  const expected = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() ?? "";
  const token = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge") ?? "";
  if (params.get("hub.mode") !== "subscribe" || !expected || !timingSafeEqual(token, expected) || !/^[A-Za-z0-9_-]{1,200}$/.test(challenge)) {
    return errorJson("forbidden", 403);
  }
  const headers = securityHeaders();
  headers.set("Content-Type", "text/plain; charset=utf-8");
  return new Response(challenge, { status: 200, headers });
}

async function findRow(env: Env, status: StatusUpdate): Promise<NotificationRow | null> {
  if (typeof status.id === "string" && status.id) {
    const byId = await env.DB.prepare(`SELECT * FROM notifications WHERE channel = 'whatsapp' AND provider_message_id = ?`)
      .bind(status.id)
      .first<NotificationRow>();
    if (byId) return byId;
  }
  const rowId = /^n:(\d{1,12})$/.exec(status.biz_opaque_callback_data ?? "")?.[1];
  if (!rowId) return null;
  return env.DB.prepare(`SELECT * FROM notifications WHERE channel = 'whatsapp' AND id = ?`).bind(Number(rowId)).first<NotificationRow>();
}

async function applyStatus(env: Env, deps: Deps, status: StatusUpdate): Promise<boolean> {
  const row = await findRow(env, status);
  const nowIso = deps.now().toISOString();
  if (!row) {
    log("whatsapp.status-unknown", { status: status.status ?? "?" });
    return false;
  }
  const seconds = Number(status.timestamp);
  const at = Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : nowIso;
  const messageId = typeof status.id === "string" ? status.id : null;
  // Anything but a failure proves the message left Meta: the row is sent (no retry, no duplicate).
  const markSent = `status = CASE WHEN status = 'skipped' THEN status ELSE 'sent' END, next_attempt_at = NULL,
                    provider_message_id = COALESCE(provider_message_id, ?), sent_at = COALESCE(sent_at, ?),
                    last_error = NULL, error_code = NULL, updated_at = ?`;
  switch (status.status) {
    case "sent":
      await env.DB.prepare(`UPDATE notifications SET ${markSent} WHERE id = ? AND delivered_at IS NULL`).bind(messageId, at, nowIso, row.id).run();
      return true;
    case "delivered":
    case "read": {
      const read = status.status === "read";
      await env.DB.prepare(
        `UPDATE notifications SET ${markSent}, delivered_at = COALESCE(delivered_at, ?)${read ? ", read_at = COALESCE(read_at, ?)" : ""} WHERE id = ?`,
      )
        .bind(messageId, at, nowIso, at, ...(read ? [at] : []), row.id)
        .run();
      await setState(env.DB, "whatsapp.last_delivered", row.kind, at > nowIso ? nowIso : at);
      return true;
    }
    case "failed": {
      // A failure for an older attempt, or after the phone already confirmed it, changes nothing.
      if (row.delivered_at || row.read_at || (row.provider_message_id && messageId && row.provider_message_id !== messageId)) return false;
      const error = Array.isArray(status.errors) ? status.errors[0] : undefined;
      const code = typeof error?.code === "number" ? error.code : null;
      const kind = classifyWhatsAppError(400, code);
      const delay = whatsappRetryDelay(kind, Math.max(row.attempts, 1), null);
      const text = `${code ?? "?"}: ${error?.title ?? error?.message ?? "entrega fallida"}${error?.error_data?.details ? ` — ${error.error_data.details}` : ""}`.slice(0, 300);
      await env.DB.prepare(
        `UPDATE notifications SET status = 'failed', next_attempt_at = ?, last_error = ?, error_code = ?, updated_at = ?
          WHERE id = ? AND status <> 'skipped'`,
      )
        .bind(delay === null ? null : new Date(deps.now().getTime() + delay * 1000).toISOString(), text, code === null ? kind : String(code), nowIso, row.id)
        .run();
      await setState(env.DB, "whatsapp.last_error", text, nowIso);
      if (kind === "credentials" || kind === "configuration" || kind === "template") {
        await setState(env.DB, "whatsapp.problem", JSON.stringify({ kind, code, error: text }), nowIso);
      }
      log("whatsapp.delivery-failed", { orderId: row.order_id, kind, code, retry: delay !== null });
      return true;
    }
    default:
      return false;
  }
}
