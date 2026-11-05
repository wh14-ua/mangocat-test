import { formatCents } from "../../../src/lib/commerce/money";
import { panelUrl, telegramApiBase, telegramConfig } from "./config";
import { getOrder, setState, type OrderRow } from "./db";
import type { Deps, Env } from "./env";
import { log } from "./log";
import { escapeHtml, sendTelegramMessage } from "./telegram";

/**
 * Staff notifications through an outbox in D1.
 *
 * - The order is always stored first; a notification is only a pointer to it. The panel
 *   lists pending orders whether or not any alert got through.
 * - One row per (order, channel, recipient, kind): duplicates are impossible.
 * - Delivery is attempted right after the order changes (waitUntil) and retried by the
 *   cron with backoff; every failure is recorded and shown in the panel.
 * - Messages contain the order number, item count, total and payment state only — never
 *   the customer's name, phone, email or notes.
 */

export type NotificationKind = "new_order" | "reminder" | "auto_cancelled" | "needs_review";

export type NotificationRow = {
  id: number;
  order_id: string;
  channel: "telegram" | "webpush";
  recipient: string;
  kind: NotificationKind;
  status: "pending" | "sending" | "sent" | "failed" | "skipped";
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  provider_message_id: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
};

/** Seconds to wait after each failed attempt; after the last one the row stays failed. */
export const RETRY_DELAYS_SECONDS = [15, 60, 120, 300, 600, 1800];

/** A "sending" row older than this is considered abandoned (the Worker was interrupted). */
const SENDING_STALE_MS = 2 * 60_000;

export async function enqueueNotification(env: Env, orderId: string, kind: NotificationKind, now: string): Promise<number> {
  const telegram = telegramConfig(env);
  if (!telegram) return 0;
  const statements = telegram.chatIds.map((chatId) =>
    env.DB.prepare(
      `INSERT OR IGNORE INTO notifications (order_id, channel, recipient, kind, status, attempts, next_attempt_at, created_at, updated_at)
       VALUES (?, 'telegram', ?, ?, 'pending', 0, ?, ?, ?)`,
    ).bind(orderId, chatId, kind, now, now, now),
  );
  const results = await env.DB.batch(statements);
  return results.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
}

/** Enqueues and tries to deliver right away, without delaying the response. */
export function notifySoon(env: Env, deps: Deps, orderId: string, kind: NotificationKind) {
  const now = deps.now().toISOString();
  deps.waitUntil(
    (async () => {
      const added = await enqueueNotification(env, orderId, kind, now);
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
        `Nadie lo aceptó en ${options.timeoutMinutes ?? "el tiempo previsto"} min. Se ha anulado el pago: no se ha cobrado nada.`,
      ].join("\n");
    case "needs_review":
      return [
        `${test}⚠️ <b>Pedido ${escapeHtml(number)} necesita revisión</b>`,
        escapeHtml((order.review_reason ?? "Revisa el pedido en el panel.").slice(0, 300)),
      ].join("\n");
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
  if (!telegram) return { sent: 0, failed: 0 };
  const now = deps.now();
  const nowIso = now.toISOString();
  const staleSending = new Date(now.getTime() - SENDING_STALE_MS).toISOString();
  const filter = options.orderId ? "AND order_id = ?" : "";
  const params: (string | number)[] = [nowIso, staleSending];
  if (options.orderId) params.push(options.orderId);
  params.push(options.limit ?? 25);
  const due = await env.DB.prepare(
    `SELECT * FROM notifications
      WHERE channel = 'telegram'
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
    // Claim the row: whoever flips it to "sending" first delivers it; the others skip.
    const claim = await env.DB.prepare(
      `UPDATE notifications SET status = 'sending', updated_at = ?
        WHERE id = ? AND (status IN ('pending', 'failed') OR (status = 'sending' AND updated_at <= ?))`,
    )
      .bind(nowIso, row.id, staleSending)
      .run();
    if (!claim.meta.changes) continue;

    const order = await getOrder(env.DB, row.order_id);
    if (!order || !stillRelevant(row.kind, order)) {
      await env.DB.prepare(`UPDATE notifications SET status = 'skipped', next_attempt_at = NULL, updated_at = ? WHERE id = ?`)
        .bind(nowIso, row.id)
        .run();
      continue;
    }
    const count = await env.DB.prepare(`SELECT COALESCE(SUM(quantity), 0) AS n FROM order_items WHERE order_id = ?`)
      .bind(order.id)
      .first<{ n: number }>();
    const html = composeMessage(row.kind, order, Number(count?.n ?? 0), options);
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
      sent += 1;
      await env.DB.prepare(
        `UPDATE notifications SET status = 'sent', attempts = ?, provider_message_id = ?, sent_at = ?, next_attempt_at = NULL,
           last_error = NULL, updated_at = ? WHERE id = ?`,
      )
        .bind(attempts, String(result.messageId), nowIso, nowIso, row.id)
        .run();
      await setState(env.DB, "telegram.last_success", row.kind, nowIso);
      continue;
    }
    failed += 1;
    const delay = result.retryAfter ?? RETRY_DELAYS_SECONDS[attempts - 1];
    const retry = result.retryable && attempts < RETRY_DELAYS_SECONDS.length + 1 && delay !== undefined;
    const next = retry ? new Date(now.getTime() + delay * 1000).toISOString() : null;
    await env.DB.prepare(
      `UPDATE notifications SET status = 'failed', attempts = ?, next_attempt_at = ?, last_error = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(attempts, next, result.error, nowIso, row.id)
      .run();
    await setState(env.DB, "telegram.last_error", result.error, nowIso);
    log("notify.failed", { orderId: order.id, kind: row.kind, attempts, retry, error: result.error });
  }
  return { sent, failed };
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

/** "sent" if any recipient got the new-order alert, else the best known state. */
export function alertSummary(rows: NotificationRow[] | undefined): "sent" | "pending" | "failed" | "none" {
  const alerts = (rows ?? []).filter((r) => r.kind === "new_order");
  if (!alerts.length) return "none";
  if (alerts.some((r) => r.status === "sent")) return "sent";
  if (alerts.some((r) => r.status === "pending" || r.status === "sending" || (r.status === "failed" && r.next_attempt_at))) {
    return "pending";
  }
  return alerts.every((r) => r.status === "skipped") ? "none" : "failed";
}
