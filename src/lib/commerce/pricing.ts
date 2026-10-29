import type {
  CartLine,
  DeliveryConfig,
  FulfillmentType,
  OrderLimits,
  PricedLine,
} from "./types";
import { getOrderability, itemFullName, type CatalogIndex } from "./catalog";
import { lineKey, normalizeSelections } from "./cart";
import { multiplyCents, sumCents } from "./money";

export type QuoteIssue =
  | { code: "unknown-item"; itemId: string }
  | { code: "not-orderable"; itemId: string; reason: string }
  | { code: "invalid-options"; itemId: string }
  | { code: "invalid-quantity"; itemId: string }
  | { code: "too-many-lines" }
  | { code: "too-many-items" }
  | { code: "order-total-limit" }
  | { code: "empty" }
  | { code: "delivery-unavailable" }
  | { code: "delivery-minimum"; minimumCents: number };

export type Quote = {
  lines: PricedLine[];
  itemCount: number;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  /** Any issue makes the quote non-payable. */
  issues: QuoteIssue[];
  payable: boolean;
  containsAgeRestricted: boolean;
};

export type QuoteContext = {
  fulfillment: FulfillmentType;
  delivery: DeliveryConfig;
  limits: OrderLimits;
};

type LineInput = Pick<CartLine, "itemId" | "quantity"> & { selections?: CartLine["selections"] };

/**
 * Prices a list of lines from the catalog. This is THE pricing function: the storefront
 * uses it to display totals and the Worker uses it again, server-side, to decide what
 * to charge. Client-supplied prices never enter this function.
 */
export function quoteLines(index: CatalogIndex, input: LineInput[], ctx: QuoteContext): Quote {
  const issues: QuoteIssue[] = [];
  const merged = new Map<string, PricedLine>();

  for (const raw of input) {
    const item = index.byId.get(raw.itemId);
    if (!item) {
      issues.push({ code: "unknown-item", itemId: raw.itemId });
      continue;
    }
    if (
      !Number.isSafeInteger(raw.quantity) ||
      raw.quantity < 1 ||
      raw.quantity > ctx.limits.maxQuantityPerLine
    ) {
      issues.push({ code: "invalid-quantity", itemId: item.id });
      continue;
    }
    const orderability = getOrderability(item);
    if (!orderability.orderable) {
      issues.push({ code: "not-orderable", itemId: item.id, reason: orderability.reason });
      continue;
    }
    const normalized = normalizeSelections(item, raw.selections);
    if (!normalized.ok) {
      issues.push({ code: "invalid-options", itemId: item.id });
      continue;
    }

    const chosen = (item.options ?? []).flatMap((option) =>
      (normalized.selections[option.id] ?? []).map(
        (choiceId) => option.choices.find((c) => c.id === choiceId)!,
      ),
    );
    const unitPriceCents = sumCents([item.priceCents as number, ...chosen.map((c) => c.priceDeltaCents)]);
    const key = lineKey(item.id, normalized.selections);
    const previous = merged.get(key);
    const quantity = (previous?.quantity ?? 0) + raw.quantity;
    if (quantity > ctx.limits.maxQuantityPerLine) {
      issues.push({ code: "invalid-quantity", itemId: item.id });
      continue;
    }
    merged.set(key, {
      key,
      itemId: item.id,
      name: itemFullName(item),
      optionsLabel: chosen.length ? chosen.map((c) => c.name).join(", ") : undefined,
      selections: normalized.selections,
      quantity,
      unitPriceCents,
      lineTotalCents: multiplyCents(unitPriceCents, quantity),
      ageRestricted: Boolean(item.ageRestricted),
    });
  }

  const lines = [...merged.values()];
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotalCents = sumCents(lines.map((l) => l.lineTotalCents));

  if (input.length === 0) issues.push({ code: "empty" });
  if (lines.length > ctx.limits.maxLines) issues.push({ code: "too-many-lines" });
  if (itemCount > ctx.limits.maxItemsPerOrder) issues.push({ code: "too-many-items" });

  let deliveryFeeCents = 0;
  if (ctx.fulfillment === "delivery") {
    const d = ctx.delivery;
    // Own delivery is only quoted with confirmed conditions. Nothing is assumed.
    if (!d.enabled || d.feeCents === null) {
      issues.push({ code: "delivery-unavailable" });
    } else {
      if (d.minimumOrderCents !== null && subtotalCents < d.minimumOrderCents) {
        issues.push({ code: "delivery-minimum", minimumCents: d.minimumOrderCents });
      }
      const free = d.freeDeliveryFromCents !== null && subtotalCents >= d.freeDeliveryFromCents;
      deliveryFeeCents = free ? 0 : d.feeCents;
    }
  }

  const totalCents = sumCents([subtotalCents, deliveryFeeCents]);
  if (totalCents > ctx.limits.maxOrderTotalCents) issues.push({ code: "order-total-limit" });

  return {
    lines,
    itemCount,
    subtotalCents,
    deliveryFeeCents,
    totalCents,
    issues,
    payable: issues.length === 0 && lines.length > 0,
    containsAgeRestricted: lines.some((l) => l.ageRestricted),
  };
}

export const QUOTE_ISSUE_COPY: Record<QuoteIssue["code"], string> = {
  "unknown-item": "Un producto ya no está en la carta.",
  "not-orderable": "Un producto no se puede pedir ahora mismo.",
  "invalid-options": "Revisa las opciones elegidas de un producto.",
  "invalid-quantity": "Revisa las cantidades del pedido.",
  "too-many-lines": "El pedido tiene demasiados productos distintos.",
  "too-many-items": "El pedido supera el número máximo de unidades.",
  "order-total-limit": "El importe supera el máximo para pedidos online. Llama al restaurante.",
  empty: "El pedido está vacío.",
  "delivery-unavailable": "El reparto a domicilio propio no está disponible.",
  "delivery-minimum": "No se alcanza el pedido mínimo para reparto.",
};
