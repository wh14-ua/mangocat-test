import { formatCents } from "../../../src/lib/commerce/money";
import { panelUrl, telegramApiBase, telegramConfig, whatsappConfig } from "./config";
import { getOrder, setState, type OrderRow } from "./db";
import type { Deps, Env } from "./env";
import { log } from "./log";
import { escapeHtml, sendTelegramMessage } from "./telegram";
import { PAIR_INTERVAL_MS, sendWhatsAppTemplate, whatsappMessageFor, whatsappRetryDelay } from "./whatsapp";

/**
 * Staff notifications through an outbox in D1.
 *
 * - The order is always stored first; a notification is only a pointer to it. The panel
 *   lists pending orders whether or not any alert got through.
 * - One row per (order, channel, recipient, kind): duplicates are impossible. An order that
 *   enters EN REVISIÓN again re-arms its row (a new incident is a new alert), and the cron
 *   recreates rows that were lost and reminds every hour while an incident is unattended.
 * - Delivery is attempted right after the order changes (waitUntil) and retried by the
 *   cron with backoff; every failure is recorded and shown in the panel.
 * - Messages contain the order number, the dishes, the total and the payment state only —
 *   never the customer's name, phone, email, notes or address.
 * - Channels: WhatsApp (Cloud API, primary; delivery confirmed by its status webhook) and
 *   Telegram (alternative). Each authorised recipient of each configured channel gets a row.
 */

export type NotificationKind = "new_order" | "reminder" | "auto_cancelled" | "needs_review";

export type NotificationChannel = "whatsapp" | "telegram" | "webpush";

export type NotificationRow = {
  id: number;
  order_id: string;
  channel: NotificationChannel;
  recipient: string;
  kind: NotificationKind;
  status: "pending" | "sending" | "sent" | "failed" | "skipped";
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  provider_message_id: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  /** WhatsApp receipts (status webhook): reached the phone / opened. */
  delivered_at: string | null;
  read_at: string | null;
};

/** Who gets alerts: every authorised recipient of every configured channel (WhatsApp first). */
export function alertRecipients(env: Env): { channel: "whatsapp" | "telegram"; recipient: string }[] {
  const whatsapp = whatsappConfig(env);
  const telegram = telegramConfig(env);
  return [
    ...(whatsapp?.recipients.map((recipient) => ({ channel: "whatsapp" as const, recipient })) ?? []),
    ...(telegram?.chatIds.map((recipient) => ({ channel: "telegram" as const, recipient })) ?? []),
  ];
}

/** The restaurant's name in alerts (the commercial product serves other restaurants too). */
export function restaurantName(env: Env): string {
  return env.RESTAURANT_NAME?.trim().slice(0, 40) || "SHANG HAI";
}

/** Seconds to wait after each failed attempt; after the last one the row stays failed. */
export const RETRY_DELAYS_SECONDS = [15, 60, 120, 300, 600, 1800];

/** A "sending" row older than this is considered abandoned (the Worker was interrupted). */
const SENDING_STALE_MS = 2 * 60_000;

/**
 * Queues an alert for every authorised chat. `rearm`: a row already delivered (or given up on)
 * is queued again — used for a NEW incident of the same kind (an order back in EN REVISIÓN) and
 * for reminders; a row still pending or being sent is left alone (no duplicates).
 */
export async function enqueueNotification(
  env: Env,
  orderId: string,
  kind: NotificationKind,
  now: string,
  options: { rearm?: boolean } = {},
): Promise<number> {
  const recipients = alertRecipients(env);
  if (!recipients.length) return 0;
  const sql = options.rearm
    ? `INSERT INTO notifications (order_id, channel, recipient, kind, status, attempts, next_attempt_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?)
       ON CONFLICT (order_id, channel, recipient, kind) DO UPDATE SET
         status = 'pending', attempts = 0, next_attempt_at = excluded.next_attempt_at, last_error = NULL, error_code = NULL,
         provider_message_id = NULL, sent_at = NULL, delivered_at = NULL, read_at = NULL, updated_at = excluded.updated_at
       WHERE notifications.status IN ('sent', 'failed', 'skipped')`
    : `INSERT OR IGNORE INTO notifications (order_id, channel, recipient, kind, status, attempts, next_attempt_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?)`;
  const statements = recipients.map(({ channel, recipient }) => env.DB.prepare(sql).bind(orderId, channel, recipient, kind, now, now, now));
  const results = await env.DB.batch(statements);
  return results.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
}

/**
 * Enqueues and tries to deliver right away, without delaying the response. If this fails (the
 * Worker is interrupted, D1 errors), nothing is lost: the cron recreates missing alerts for
 * every order waiting for the restaurant or in review (see runScheduled, step "alerts").
 */
export function notifySoon(env: Env, deps: Deps, orderId: string, kind: NotificationKind) {
  const now = deps.now().toISOString();
  deps.waitUntil(
    (async () => {
      const added = await enqueueNotification(env, orderId, kind, now, { rearm: kind === "needs_review" });
      if (added) await deliverDue(env, deps, { orderId });
    })().catch((error) => log("notify.error", { orderId, message: error instanceof Error ? error.message : "unknown" })),
  );
}

function itemCountLabel(count: number): string {
  return count === 1 ? "1 producto" : `${count} productos`;
}

/** Order link for the panel; the id travels in the fragment, so it never reaches server logs. */
export function orderPanelLink(env: Env, orderId: string): string | null {
  const base = panelUrl(env);
  return base ? `${base}#pedido=${encodeURIComponent(orderId)}` : null;
}

export function composeMessage(
  kind: NotificationKind,
  order: Pick<OrderRow, "number" | "id" | "total_cents" | "fulfillment" | "payment_status" | "payments_mode" | "review_reason">,
  itemCount: number,
  options: { reminderMinutes?: number; timeoutMinutes?: number } = {},
): string {
  const number = `#${order.number ?? order.id}`;
  const test = order.payments_mode === "stripe-test" ? "🧪 <b>PRUEBA</b> · no preparar\n" : "";
  switch (kind) {
    case "new_order":
      return [
        `${test}🔔 <b>NUEVO PEDIDO — SHANG HAI</b>`,
        "",
        `Pedido <b>${escapeHtml(number)}</b>`,
        itemCountLabel(itemCount),
        `Total: <b>${escapeHtml(formatCents(order.total_cents))}</b>`,
        order.fulfillment === "pickup" ? "Recogida en el local." : "Reparto a domicilio.",
        "",
        order.payment_status === "captured"
          ? "Pago cobrado. Si lo rechazáis, se devolverá automáticamente."
          : "Pago autorizado, aún sin cobrar: se cobra al aceptar.",
        "Acéptalo o recházalo en el panel.",
      ].join("\n");
    case "reminder":
      return [
        `${test}⏰ <b>Pedido ${escapeHtml(number)} sin aceptar</b>`,
        `Lleva ${options.reminderMinutes ?? "unos"} min esperando. El cliente todavía no sabe si lo vais a preparar.`,
      ].join("\n");
    case "auto_cancelled":
      return [
        `${test}⚠️ <b>Pedido ${escapeHtml(number)} cancelado automáticamente</b>`,
        `Nadie lo aceptó en ${options.timeoutMinutes ?? "el tiempo previsto"} min. ${autoCancelPaymentText(order.payment_status)}`,
      ].join("\n");
    case "needs_review":
      return [
        `${test}⚠️ <b>Pedido ${escapeHtml(number)} necesita revisión</b>`,
        escapeHtml((order.review_reason ?? "Revisa el pedido en el panel.").slice(0, 300)),
      ].join("\n");
  }
}

/** What happened to the money, from the order's payment status when the alert goes out. */
export function autoCancelPaymentText(payment: OrderRow["payment_status"]): string {
  switch (payment) {
    case "canceled":
    case "unpaid":
    case "failed":
      return "Se ha anulado el pago: no se ha cobrado nada.";
    case "refunded":
      return "Se ha devuelto el importe cobrado.";
    case "refund_pending":
      return "Se ha pedido la devolución del importe cobrado; Stripe aún no la ha confirmado.";
    default:
      return "Revisa el estado del pago en el panel.";
  }
}

/** Whether an alert still makes sense when it is about to go out. */
function stillRelevant(kind: NotificationKind, order: OrderRow): boolean {
  switch (kind) {
    case "new_order":
      return ["awaiting_acceptance", "accepting", "needs_review"].includes(order.status);
    case "reminder":
      return order.status === "awaiting_acceptance";
    case "needs_review":
      return order.status === "needs_review";
    case "auto_cancelled":
      return true;
  }
}

export type DeliveryOptions = { orderId?: string; limit?: number; reminderMinutes?: number; timeoutMinutes?: number };

/** Sends every due notification (optionally of one order). Safe to run concurrently. */
export async function deliverDue(env: Env, deps: Deps, options: DeliveryOptions = {}): Promise<{ sent: number; failed: number }> {
  const telegram = telegramConfig(env);
  const whatsapp = whatsappConfig(env);
  if (!telegram && !whatsapp) return { sent: 0, failed: 0 };
  const now = deps.now();
  const nowIso = now.toISOString();
  const staleSending = new Date(now.getTime() - SENDING_STALE_MS).toISOString();
  const filter = options.orderId ? "AND order_id = ?" : "";
  const params: (string | number)[] = [nowIso, staleSending];
  if (options.orderId) params.push(options.orderId);
  params.push(options.limit ?? 25);
  const due = await env.DB.prepare(
    `SELECT * FROM notifications
      WHERE channel IN ('whatsapp', 'telegram')
        AND ((status IN ('pending', 'failed') AND next_attempt_at IS NOT NULL AND next_attempt_at <= ?)
             OR (status = 'sending' AND updated_at <= ?))
        ${filter}
      ORDER BY id LIMIT ?`,
  )
    .bind(...params)
    .all<NotificationRow>();

  let sent = 0;
  let failed = 0;
  for (const row of due.results) {
    // Claim the row: whoever flips it to "sending" first delivers it; the others skip. A row that
    // another run has meanwhile rescheduled or given up on (failed without next attempt) is not due.
    const claim = await env.DB.prepare(
      `UPDATE notifications SET status = 'sending', updated_at = ?
        WHERE id = ? AND ((status IN ('pending', 'failed') AND next_attempt_at IS NOT NULL AND next_attempt_at <= ?)
                          OR (status = 'sending' AND updated_at <= ?))`,
    )
      .bind(nowIso, row.id, nowIso, staleSending)
      .run();
    if (!claim.meta.changes) continue;

    // A recipient removed from the configuration gets nothing more, not even queued retries.
    const authorised = row.channel === "whatsapp" ? whatsapp?.recipients.includes(row.recipient) : telegram?.chatIds.includes(row.recipient);
    if (!authorised) {
      await env.DB.prepare(
        `UPDATE notifications SET status = 'skipped', next_attempt_at = NULL, last_error = 'recipient no longer authorised', updated_at = ? WHERE id = ?`,
      )
        .bind(nowIso, row.id)
        .run();
      continue;
    }

    const order = await getOrder(env.DB, row.order_id);
    if (!order || !stillRelevant(row.kind, order)) {
      await env.DB.prepare(`UPDATE notifications SET status = 'skipped', next_attempt_at = NULL, updated_at = ? WHERE id = ?`)
        .bind(nowIso, row.id)
        .run();
      continue;
    }
    const outcome = row.channel === "whatsapp" && whatsapp ? await sendWhatsAppRow(env, deps, whatsapp, row, order, options) : telegram ? await sendTelegramRow(env, deps, telegram, row, order, options) : null;
    if (outcome === "sent") sent += 1;
    if (outcome === "failed") failed += 1;
  }
  return { sent, failed };
}

type Outcome = "sent" | "failed" | "deferred";

/**
 * When this number last got a WhatsApp message from us — an alert or a sign-in code — for the
 * pair rate limit (Meta: about one message every 6 s to the same recipient).
 */
export async function lastWhatsAppSend(env: Env, recipient: string, excludeRow?: number): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT MAX(at) AS at FROM (
        SELECT MAX(sent_at) AS at FROM notifications WHERE channel = 'whatsapp' AND recipient = ? AND sent_at IS NOT NULL AND id <> ?
        UNION ALL SELECT updated_at AS at FROM system_state WHERE key = ?)`,
  )
    .bind(recipient, excludeRow ?? -1, `whatsapp.last_send:${recipient}`)
    .first<{ at: string | null }>();
  return row?.at ?? null;
}

export async function recordWhatsAppSend(env: Env, recipient: string, at: string): Promise<void> {
  await setState(env.DB, `whatsapp.last_send:${recipient}`, "sent", at);
}

async function orderLines(env: Env, orderId: string): Promise<{ quantity: number; name: string }[]> {
  const { results } = await env.DB.prepare(`SELECT quantity, name FROM order_items WHERE order_id = ? ORDER BY position`)
    .bind(orderId)
    .all<{ quantity: number; name: string }>();
  return results;
}

async function sendTelegramRow(
  env: Env,
  deps: Deps,
  telegram: NonNullable<ReturnType<typeof telegramConfig>>,
  row: NotificationRow,
  order: OrderRow,
  options: DeliveryOptions,
): Promise<Outcome> {
  const now = deps.now();
  const nowIso = now.toISOString();
  const lines = await orderLines(env, order.id);
  const html = composeMessage(row.kind, order, lines.reduce((n, l) => n + l.quantity, 0), options);
  const result = await sendTelegramMessage(deps.fetch, {
    apiBase: telegramApiBase(env),
    token: telegram.token,
    chatId: row.recipient,
    html,
    buttonText: "VER PEDIDO",
    buttonUrl: orderPanelLink(env, order.id),
  });
  const attempts = row.attempts + 1;
  if (result.ok) {
    await env.DB.prepare(
      `UPDATE notifications SET status = 'sent', attempts = ?, provider_message_id = ?, sent_at = ?, next_attempt_at = NULL,
         last_error = NULL, error_code = NULL, updated_at = ? WHERE id = ?`,
    )
      .bind(attempts, String(result.messageId), nowIso, nowIso, row.id)
      .run();
    await setState(env.DB, "telegram.last_success", row.kind, nowIso);
    return "sent";
  }
  const delay = result.retryAfter ?? RETRY_DELAYS_SECONDS[attempts - 1];
  const retry = result.retryable && attempts < RETRY_DELAYS_SECONDS.length + 1 && delay !== undefined;
  const next = retry ? new Date(now.getTime() + delay * 1000).toISOString() : null;
  await env.DB.prepare(
    `UPDATE notifications SET status = 'failed', attempts = ?, next_attempt_at = ?, last_error = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(attempts, next, result.error, nowIso, row.id)
    .run();
  await setState(env.DB, "telegram.last_error", result.error, nowIso);
  log("notify.failed", { orderId: order.id, channel: "telegram", kind: row.kind, attempts, retry, error: result.error });
  return "failed";
}

/**
 * One WhatsApp template message. Paced per recipient (Meta's pair rate limit, ~1 message every
 * 6 s to the same number): a second alert due within that interval waits instead of failing.
 * Accepted = "sent" (not delivered: the status webhook confirms delivery). Each failure kind has
 * its own retry policy (whatsappRetryDelay); credential, configuration and template problems are
 * also recorded for the panel's «Estado del sistema».
 */
async function sendWhatsAppRow(
  env: Env,
  deps: Deps,
  whatsapp: NonNullable<ReturnType<typeof whatsappConfig>>,
  row: NotificationRow,
  order: OrderRow,
  options: DeliveryOptions,
): Promise<Outcome> {
  const now = deps.now();
  const nowIso = now.toISOString();
  const lastAt = await lastWhatsAppSend(env, row.recipient, row.id);
  const wait = lastAt ? Date.parse(lastAt) + PAIR_INTERVAL_MS - now.getTime() : 0;
  if (wait > 0) {
    await env.DB.prepare(`UPDATE notifications SET status = 'pending', next_attempt_at = ?, updated_at = ? WHERE id = ?`)
      .bind(new Date(now.getTime() + wait).toISOString(), nowIso, row.id)
      .run();
    return "deferred";
  }

  const message = whatsappMessageFor(row.kind, order, await orderLines(env, order.id), {
    restaurant: restaurantName(env),
    reminderMinutes: options.reminderMinutes,
    timeoutMinutes: options.timeoutMinutes,
    autoCancelText: autoCancelPaymentText(order.payment_status),
  });
  const attempts = row.attempts + 1;
  // Echoed by every status webhook: reconciles a send whose answer was lost (no duplicate retry).
  const result = await sendWhatsAppTemplate(deps.fetch, whatsapp, row.recipient, message, `n:${row.id}`);
  if (result.ok) {
    await env.DB.prepare(
      `UPDATE notifications SET status = 'sent', attempts = ?, provider_message_id = ?, sent_at = ?, next_attempt_at = NULL,
         last_error = NULL, error_code = NULL, updated_at = ? WHERE id = ? AND status = 'sending'`,
    )
      .bind(attempts, result.messageId, nowIso, nowIso, row.id)
      .run();
    await setState(env.DB, "whatsapp.last_accepted", row.kind, nowIso);
    await recordWhatsAppSend(env, row.recipient, nowIso);
    return "sent";
  }
  const delay = whatsappRetryDelay(result.kind, attempts, result.retryAfterSeconds);
  const next = delay === null ? null : new Date(now.getTime() + delay * 1000).toISOString();
  await env.DB.prepare(
    `UPDATE notifications SET status = 'failed', attempts = ?, next_attempt_at = ?, last_error = ?, error_code = ?, updated_at = ?
      WHERE id = ? AND status = 'sending'`,
  )
    .bind(attempts, next, result.error, result.code === null ? result.kind : String(result.code), nowIso, row.id)
    .run();
  await setState(env.DB, "whatsapp.last_error", result.error, nowIso);
  if (result.kind === "credentials" || result.kind === "configuration" || result.kind === "template") {
    await setState(env.DB, "whatsapp.problem", JSON.stringify({ kind: result.kind, code: result.code, error: result.error }), nowIso);
  }
  log("notify.failed", { orderId: order.id, channel: "whatsapp", kind: row.kind, attempts, failure: result.kind, retry: next !== null, error: result.error });
  return "failed";
}

export async function notificationsForOrders(env: Env, ids: string[]): Promise<Map<string, NotificationRow[]>> {
  const out = new Map<string, NotificationRow[]>();
  if (!ids.length) return out;
  const res = await env.DB.prepare(
    `SELECT * FROM notifications WHERE order_id IN (${ids.map(() => "?").join(", ")}) ORDER BY id`,
  )
    .bind(...ids)
    .all<NotificationRow>();
  for (const row of res.results) {
    const list = out.get(row.order_id) ?? [];
    list.push(row);
    out.set(row.order_id, list);
  }
  return out;
}

/**
 * The new-order alert's best state across channels and recipients: "delivered" when a phone
 * confirmed it (WhatsApp receipt, or Telegram — which accepts into the chat at once), "sent"
 * when WhatsApp accepted it but no receipt has arrived yet, then pending / failed / none.
 */
export function alertSummary(rows: NotificationRow[] | undefined): "delivered" | "sent" | "pending" | "failed" | "none" {
  const alerts = (rows ?? []).filter((r) => r.kind === "new_order");
  if (!alerts.length) return "none";
  if (alerts.some((r) => (r.channel === "whatsapp" ? Boolean(r.delivered_at || r.read_at) : r.status === "sent"))) return "delivered";
  if (alerts.some((r) => r.status === "sent")) return "sent";
  if (alerts.some((r) => r.status === "pending" || r.status === "sending" || (r.status === "failed" && r.next_attempt_at))) {
    return "pending";
  }
  return alerts.every((r) => r.status === "skipped") ? "none" : "failed";
}
