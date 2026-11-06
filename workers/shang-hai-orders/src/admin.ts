import { ORDER_STATUS_COPY } from "../../../src/lib/commerce/orders";
import type { OrderStatus } from "../../../src/lib/commerce/types";
import {
  acceptOrder,
  markCompleted,
  markReady,
  rejectOrder,
  retryOrder,
  STALE_LOCK_MS,
  type ActionResult,
  type Actor,
} from "./actions";
import { prepTimeOptions, resolvePayments, staleLockMs, telegramConfig } from "./config";
import { ORDER_ID_PATTERN } from "./crypto";
import {
  getItemsForOrders,
  getOrder,
  getOrderEvents,
  getStates,
  listBoardOrders,
  markSeenByStaff,
  type OrderItemRow,
  type OrderRow,
} from "./db";
import type { Deps, Env } from "./env";
import { errorJson, json, readBodyLimited } from "./http";
import { alertSummary, notificationsForOrders, type NotificationRow } from "./notifications";
import { loginMethods, sameOriginJson, type StaffIdentity } from "./staff-auth";

/** "+34612345678" -> "612 345 678"; other countries keep their E.164 form. */
export function displayPhone(e164: string): string {
  const es = /^\+34(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return es ? `${es[1]} ${es[2]} ${es[3]}` : e164;
}

export type BoardColumn = "new" | "preparing" | "ready" | "completed" | "rejected";

export function columnOf(order: Pick<OrderRow, "status">): BoardColumn | null {
  switch (order.status) {
    case "awaiting_acceptance":
    case "accepting":
    case "rejecting":
    case "needs_review":
      return "new";
    case "preparing":
      return "preparing";
    case "ready":
      return "ready";
    case "completed":
      return "completed";
    case "rejected":
    case "cancelled":
      return "rejected";
    default:
      return null;
  }
}

export type StaffAction = "accept" | "reject" | "ready" | "complete" | "retry";

/** The single source of truth for which buttons a card shows. */
export function allowedActions(order: OrderRow, now: Date, staleMs = STALE_LOCK_MS): StaffAction[] {
  const placed = order.payment_status === "authorized" || order.payment_status === "captured";
  switch (order.status) {
    case "awaiting_acceptance":
      return placed ? ["accept", "reject"] : ["reject"];
    case "needs_review":
      return [...(placed ? (["accept"] as const) : []), "reject", "retry"];
    case "accepting":
    case "rejecting": {
      // REINTENTAR only once the lock's owner can no longer be working (the server checks too).
      const expired = order.lock_expires_at ? Date.parse(order.lock_expires_at) <= now.getTime() : now.getTime() - Date.parse(order.updated_at) > staleMs;
      return expired ? ["retry"] : [];
    }
    case "preparing":
      return ["ready", "reject"];
    case "ready":
      return ["complete", "reject"];
    case "rejected":
      return order.payment_status === "refund_pending" ? ["retry"] : [];
    default:
      return [];
  }
}

export function orderCard(order: OrderRow, items: OrderItemRow[], notifications: NotificationRow[] | undefined, now: Date, staleMs = STALE_LOCK_MS) {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    statusLabel: ORDER_STATUS_COPY[order.status].label,
    paymentStatus: order.payment_status,
    column: columnOf(order),
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    authorizedAt: order.authorized_at,
    acceptedAt: order.accepted_at,
    prepMinutes: order.prep_minutes,
    readyBy: order.ready_by,
    readyAt: order.ready_at,
    completedAt: order.completed_at,
    rejectedAt: order.rejected_at,
    rejectionReason: order.rejection_reason,
    reviewReason: order.status === "needs_review" ? order.review_reason : null,
    customer: {
      name: order.customer_name,
      phone: order.customer_phone,
      phoneDisplay: displayPhone(order.customer_phone),
    },
    notes: order.customer_notes,
    fulfillment: order.fulfillment,
    lines: items.map((i) => ({ quantity: i.quantity, name: i.name, options: i.options_label, lineTotalCents: i.line_total_cents })),
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    totalCents: order.total_cents,
    ageRestricted: order.age_confirmed === 1,
    storefront: order.storefront,
    locale: order.locale,
    mode: order.payments_mode,
    captureBefore: order.stripe_capture_before,
    alert: alertSummary(notifications),
    actions: allowedActions(order, now, staleMs),
  };
}

export type OrderCard = ReturnType<typeof orderCard>;

/** Start of "today" in Madrid, as an ISO instant, for the finished columns. */
function startOfMadridDay(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const elapsed = ((get("hour") * 60 + get("minute")) * 60 + get("second")) * 1000;
  return new Date(now.getTime() - elapsed - now.getMilliseconds()).toISOString();
}

export async function handleBoard(env: Env, deps: Deps): Promise<Response> {
  const now = deps.now();
  const orders = await listBoardOrders(env.DB, startOfMadridDay(now));
  const ids = orders.map((o) => o.id);
  const [items, notifications, states] = await Promise.all([
    getItemsForOrders(env.DB, ids),
    notificationsForOrders(env, ids),
    getStates(env.DB),
  ]);
  // The restaurant has now seen the pending orders: from here the acceptance timeout may run.
  await markSeenByStaff(
    env.DB,
    orders.filter((o) => o.status === "awaiting_acceptance").map((o) => o.id),
    now.toISOString(),
  );
  const columns: Record<BoardColumn, OrderCard[]> = { new: [], preparing: [], ready: [], completed: [], rejected: [] };
  for (const order of orders) {
    const column = columnOf(order);
    if (column) columns[column].push(orderCard(order, items.get(order.id) ?? [], notifications.get(order.id), now, staleLockMs(env)));
  }
  // Oldest first where staff work through a queue; newest first in the history columns.
  for (const key of ["new", "preparing", "ready"] as const) columns[key].reverse();

  const failedAlerts = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM notifications WHERE status = 'failed' AND next_attempt_at IS NULL AND updated_at >= ?`,
  )
    .bind(new Date(now.getTime() - 86_400_000).toISOString())
    .first<{ n: number }>();
  return json({
    now: now.toISOString(),
    paymentsMode: resolvePayments(env).mode,
    prepOptions: prepTimeOptions(env),
    columns,
    health: {
      lastWebhookAt: states["stripe.last_webhook"]?.updatedAt ?? null,
      lastCronAt: states["cron.last_run"]?.updatedAt ?? null,
      lastCronErrorAt: states["cron.step_failed"]?.updatedAt ?? null,
      lastCronError: states["cron.step_failed"]?.value ?? null,
      telegram: {
        configured: Boolean(telegramConfig(env)),
        lastSuccessAt: states["telegram.last_success"]?.updatedAt ?? null,
        lastErrorAt: states["telegram.last_error"]?.updatedAt ?? null,
        lastError: states["telegram.last_error"]?.value ?? null,
        failedLast24h: Number(failedAlerts?.n ?? 0),
      },
    },
  });
}

export async function handleOrderDetail(env: Env, deps: Deps, id: string): Promise<Response> {
  if (!ORDER_ID_PATTERN.test(id)) return errorJson("not-found", 404);
  const order = await getOrder(env.DB, id);
  if (!order) return errorJson("not-found", 404);
  await markSeenByStaff(env.DB, [id], deps.now().toISOString());
  const [items, events, notifications] = await Promise.all([
    getItemsForOrders(env.DB, [id]),
    getOrderEvents(env.DB, id),
    notificationsForOrders(env, [id]),
  ]);
  const rows = notifications.get(id) ?? [];
  return json({
    order: {
      ...orderCard(order, items.get(id) ?? [], rows, deps.now(), staleLockMs(env)),
      email: order.customer_email,
      payment: {
        mode: order.payments_mode,
        status: order.payment_status,
        stripePaymentIntentId: order.stripe_payment_intent_id,
        stripeStatus: order.stripe_payment_status,
        refundStatus: order.stripe_refund_status,
      },
      events: events.map((e) => ({ at: e.created_at, from: e.from_status, to: e.to_status, source: e.source, actor: e.actor, note: e.note })),
      notifications: rows.map((n) => ({
        kind: n.kind,
        channel: n.channel,
        status: n.status,
        attempts: n.attempts,
        lastError: n.last_error,
        sentAt: n.sent_at,
        nextAttemptAt: n.next_attempt_at,
      })),
    },
  });
}

function actionResponse(result: ActionResult, env: Env, deps: Deps, items: OrderItemRow[] = []): Response {
  const card = result.order ? orderCard(result.order, items, undefined, deps.now(), staleLockMs(env)) : null;
  if (result.ok) return json({ ok: true, pending: Boolean(result.pending), message: result.message, order: card }, result.pending ? 202 : 200);
  return json({ ok: false, error: result.error, message: result.message, order: card }, result.status);
}

const ACTIONS: Record<string, StaffAction> = { accept: "accept", reject: "reject", ready: "ready", complete: "complete", retry: "retry" };

export function parseAction(name: string): StaffAction | null {
  return ACTIONS[name] ?? null;
}

export async function handleStaffAction(
  request: Request,
  env: Env,
  deps: Deps,
  id: string,
  action: StaffAction,
  identity: StaffIdentity,
): Promise<Response> {
  const bad = sameOriginJson(request);
  if (bad) return bad;
  if (!ORDER_ID_PATTERN.test(id)) return errorJson("not-found", 404);
  const body = await readBodyLimited(request, 2048);
  if (!body.ok) return errorJson("payload-too-large", 413);
  let payload: Record<string, unknown> = {};
  if (body.text.trim()) {
    try {
      const parsed = JSON.parse(body.text) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>;
    } catch {
      return errorJson("invalid", 400);
    }
  }
  const actor: Actor = { label: identity.label, source: "staff" };
  // What the phone showed when the button was pressed. If the order has moved on since (another
  // phone accepted it a moment earlier), the action is refused instead of being applied to a
  // different situation: RECHAZAR on a new order must never refund an order just accepted.
  const expected = typeof payload.expectedStatus === "string" ? (payload.expectedStatus as OrderStatus) : undefined;
  let result: ActionResult;
  switch (action) {
    case "accept":
      result = await acceptOrder(env, deps, id, payload.prepMinutes, actor, expected);
      break;
    case "reject":
      result = await rejectOrder(env, deps, id, payload.reason, actor, expected);
      break;
    case "ready":
      result = await markReady(env, deps, id, actor);
      break;
    case "complete":
      result = await markCompleted(env, deps, id, actor);
      break;
    case "retry":
      result = await retryOrder(env, deps, id, actor);
      break;
  }
  const items = result.order ? (await getItemsForOrders(env.DB, [id])).get(id) ?? [] : [];
  return actionResponse(result, env, deps, items);
}

export function handleSession(env: Env, identity: StaffIdentity): Response {
  return json({ authenticated: true, method: identity.method, label: identity.label, loginMethods: loginMethods(env) });
}

export type { OrderStatus };
