import { ORDER_STATUSES, type OrderStatus } from "../../../src/lib/commerce/types";
import { ORDER_STATUS_COPY } from "../../../src/lib/commerce/orders";
import { verifyAccessJwt, type AccessIdentity } from "./access";
import { accessConfig } from "./config";
import { ORDER_ID_PATTERN } from "./crypto";
import { getOrder, getOrderEvents, getOrderItems, listOrders, transitionOrder, type OrderRow } from "./db";
import type { Deps, Env } from "./env";
import { errorJson, isJsonRequest, json, readBodyLimited } from "./http";
import { log } from "./log";
import { toPricedLines } from "./orders";

/** Transitions staff may trigger from the panel. Payment states come only from Stripe. */
const STAFF_TARGETS: readonly OrderStatus[] = ["preparing", "ready", "completed", "cancelled"];

export type AdminAuth = { ok: true; identity: AccessIdentity } | { ok: false; response: Response };

/**
 * Every staff route goes through Cloudflare Access. Without ACCESS_TEAM_DOMAIN and
 * ACCESS_AUD the panel is closed (503) instead of open.
 */
export async function authorizeStaff(request: Request, env: Env, deps: Deps): Promise<AdminAuth> {
  const config = accessConfig(env);
  if (!config) return { ok: false, response: errorJson("admin-not-configured", 503) };
  const check = await verifyAccessJwt(request.headers.get("Cf-Access-Jwt-Assertion"), config, deps);
  if (!check.ok) {
    log("admin.denied", { reason: check.reason });
    return { ok: false, response: errorJson(check.status === 401 ? "unauthorized" : "forbidden", check.status) };
  }
  return { ok: true, identity: check.identity };
}

function adminOrderListItem(o: OrderRow & { item_count: number }) {
  return {
    id: o.id,
    status: o.status,
    statusLabel: ORDER_STATUS_COPY[o.status].label,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    fulfillment: o.fulfillment,
    storefront: o.storefront,
    totalCents: o.total_cents,
    itemCount: o.item_count,
    customerName: o.customer_name,
    paymentsMode: o.payments_mode,
  };
}

export async function handleAdminList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status = (ORDER_STATUSES as readonly string[]).includes(statusParam ?? "")
    ? (statusParam as OrderStatus)
    : undefined;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
  const orders = await listOrders(env.DB, { status, limit });
  return json({ orders: orders.map(adminOrderListItem) });
}

export async function handleAdminDetail(env: Env, id: string): Promise<Response> {
  if (!ORDER_ID_PATTERN.test(id)) return errorJson("not-found", 404);
  const order = await getOrder(env.DB, id);
  if (!order) return errorJson("not-found", 404);
  const [items, events] = await Promise.all([getOrderItems(env.DB, id), getOrderEvents(env.DB, id)]);
  return json({
    order: {
      id: order.id,
      status: order.status,
      statusLabel: ORDER_STATUS_COPY[order.status].label,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      paidAt: order.paid_at,
      fulfillment: order.fulfillment,
      storefront: order.storefront,
      catalogVersion: order.catalog_version,
      lines: toPricedLines(items),
      subtotalCents: order.subtotal_cents,
      deliveryFeeCents: order.delivery_fee_cents,
      totalCents: order.total_cents,
      customer: {
        name: order.customer_name,
        phone: order.customer_phone,
        email: order.customer_email,
        notes: order.customer_notes,
      },
      delivery: order.delivery_street
        ? {
            street: order.delivery_street,
            postalCode: order.delivery_postal_code,
            city: order.delivery_city,
            notes: order.delivery_notes,
          }
        : null,
      ageConfirmed: order.age_confirmed === 1,
      payment: {
        mode: order.payments_mode,
        stripeSessionId: order.stripe_session_id,
        stripePaymentIntentId: order.stripe_payment_intent_id,
        stripePaymentStatus: order.stripe_payment_status,
        stripeAmountTotal: order.stripe_amount_total,
      },
      events: events.map((e) => ({
        at: e.created_at,
        from: e.from_status,
        to: e.to_status,
        source: e.source,
        actor: e.actor,
        note: e.note,
      })),
    },
  });
}

export async function handleAdminStatus(
  request: Request,
  env: Env,
  deps: Deps,
  id: string,
  identity: AccessIdentity,
): Promise<Response> {
  // Same-origin JSON only: a cross-site form cannot reach this endpoint (CSRF).
  const origin = request.headers.get("Origin");
  if (origin !== null && origin !== new URL(request.url).origin) return errorJson("forbidden-origin", 403);
  if (!isJsonRequest(request)) return errorJson("unsupported-media-type", 415);
  if (!ORDER_ID_PATTERN.test(id)) return errorJson("not-found", 404);
  const body = await readBodyLimited(request, 1024);
  if (!body.ok) return errorJson("payload-too-large", 413);
  let target: unknown;
  try {
    target = (JSON.parse(body.text) as { status?: unknown }).status;
  } catch {
    return errorJson("invalid", 400);
  }
  if (typeof target !== "string" || !(STAFF_TARGETS as readonly string[]).includes(target)) {
    return errorJson("invalid-status", 422);
  }
  const result = await transitionOrder(env.DB, id, target as OrderStatus, {
    source: "staff",
    actor: identity.email ?? identity.subject,
    note: "Cambio de estado desde el panel",
    now: deps.now().toISOString(),
  });
  if (!result.ok) {
    if (result.reason === "not-found") return errorJson("not-found", 404);
    return errorJson("transition-not-allowed", 409, { from: result.from ?? null, to: target });
  }
  log("admin.status", { orderId: id, from: result.from, to: result.to });
  return handleAdminDetail(env, id);
}
