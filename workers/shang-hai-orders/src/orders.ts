import type { OrderSummary, PricedLine } from "../../../src/lib/commerce/types";
import { shangHaiOrdering } from "../../../src/lib/shang-hai/catalog";
import { ORDER_ID_PATTERN, sha256Hex, timingSafeEqual } from "./crypto";
import { getOrder, getOrderItems, type OrderItemRow, type OrderRow } from "./db";
import type { Env } from "./env";
import { clientIp, errorJson, json } from "./http";
import { allow } from "./rate-limit";

export function toPricedLines(items: OrderItemRow[]): PricedLine[] {
  return items.map((i) => ({
    key: i.selections_json && i.selections_json !== "{}" ? `${i.item_id}|${i.position}` : i.item_id,
    itemId: i.item_id,
    name: i.name,
    ...(i.options_label ? { optionsLabel: i.options_label } : {}),
    selections: safeSelections(i.selections_json),
    quantity: i.quantity,
    unitPriceCents: i.unit_price_cents,
    lineTotalCents: i.line_total_cents,
    ageRestricted: i.age_restricted === 1,
  }));
}

function safeSelections(raw: string): Record<string, string[]> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, string[]>)
      : {};
  } catch {
    return {};
  }
}

/** Customer-facing view of an order: no phone, email, notes, tokens or Stripe ids. */
export function toOrderSummary(order: OrderRow, items: OrderItemRow[]): OrderSummary {
  const prep = shangHaiOrdering.pickup.prepTimeMinutes;
  return {
    id: order.id,
    status: order.status,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    fulfillment: order.fulfillment,
    lines: toPricedLines(items),
    subtotalCents: order.subtotal_cents,
    deliveryFeeCents: order.delivery_fee_cents,
    totalCents: order.total_cents,
    currency: "EUR",
    customerName: order.customer_name,
    mode: order.payments_mode,
    pickupNote:
      prep === null
        ? "El restaurante confirmará la hora de recogida."
        : `Tiempo de preparación aproximado: ${prep} minutos.`,
  };
}

/** GET /api/orders/:id  —  Authorization: Bearer <order token> */
export async function handleOrderLookup(request: Request, env: Env, id: string): Promise<Response> {
  if (!(await allow(env.LOOKUP_LIMITER, `lookup:${clientIp(request)}`))) {
    return json({ error: "rate-limited" }, 429, { "Retry-After": "60" });
  }
  const auth = request.headers.get("Authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{20,128})$/.exec(auth);
  if (!match) return errorJson("unauthorized", 401);
  if (!ORDER_ID_PATTERN.test(id)) return errorJson("not-found", 404);

  const order = await getOrder(env.DB, id);
  const presented = await sha256Hex(match[1]);
  // Same response for "no such order" and "wrong token": ids cannot be probed.
  if (!order || !timingSafeEqual(presented, order.token_hash)) return errorJson("not-found", 404);
  const items = await getOrderItems(env.DB, id);
  return json({ order: toOrderSummary(order, items) });
}
