import type { CheckoutRequest, OrderingConfig } from "../types";
import type { CatalogIndex } from "../catalog";
import { quoteLines, type Quote } from "../pricing";
import { parseCheckoutRequest } from "../validation";
import { isOpenAt } from "../hours";
import type { CheckoutFailure } from "./gateway";

export type PrepareContext = {
  index: CatalogIndex;
  ordering: OrderingConfig;
  allowedStorefronts: readonly string[];
  now?: Date;
};

export type PreparedOrder = { request: CheckoutRequest; quote: Quote };

/**
 * Server-side checkout validation, shared by the order Worker and the demo simulator so
 * both behave identically. Every amount comes from the catalog; the browser only sends
 * ids and quantities (and, optionally, the total it displayed, to detect changes).
 */
export function prepareOrder(
  body: unknown,
  ctx: PrepareContext,
): { ok: true; value: PreparedOrder } | CheckoutFailure {
  const parsed = parseCheckoutRequest(body, ctx.ordering.limits, ctx.allowedStorefronts);
  if (!parsed.ok) return { ok: false, error: "invalid", fieldErrors: parsed.errors };
  const request = parsed.value;

  if (request.catalogId !== ctx.index.catalog.catalogId) {
    return { ok: false, error: "invalid", fieldErrors: { catalogId: "Catálogo no válido." } };
  }
  if (request.fulfillment === "pickup" && !ctx.ordering.pickup.enabled) {
    return { ok: false, error: "payments-disabled" };
  }
  if (
    request.fulfillment === "pickup" &&
    ctx.ordering.pickup.enforceOpeningHours &&
    !isOpenAt(ctx.ordering.hours, ctx.now ?? new Date(), ctx.ordering.timeZone)
  ) {
    return { ok: false, error: "not-payable", issues: [] };
  }

  const quote = quoteLines(ctx.index, request.lines, {
    fulfillment: request.fulfillment,
    delivery: ctx.ordering.delivery,
    limits: ctx.ordering.limits,
  });
  if (!quote.payable) return { ok: false, error: "not-payable", issues: quote.issues };
  if (quote.containsAgeRestricted && !request.ageConfirmed) {
    return { ok: false, error: "age-confirmation-required" };
  }
  if (
    request.expectedTotalCents !== undefined &&
    request.expectedTotalCents !== quote.totalCents
  ) {
    return { ok: false, error: "price-changed", totalCents: quote.totalCents };
  }
  return { ok: true, value: { request, quote } };
}
