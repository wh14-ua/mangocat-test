import { createApiGateway } from "../commerce/checkout/api-gateway";
import { createDemoGateway } from "../commerce/checkout/demo-gateway";
import type { DemoControls, OrderGateway } from "../commerce/checkout/gateway";
import { shangHaiCatalog, shangHaiOrdering } from "./catalog";
import { demoPaymentPath, STOREFRONT_IDS } from "./storefronts";

/**
 * Checkout mode is decided at build time:
 * - NEXT_PUBLIC_ORDER_API_BASE_URL empty  -> DEMO MODE (local simulator, nothing is charged).
 * - NEXT_PUBLIC_ORDER_API_BASE_URL set    -> the order Worker, which runs Stripe Checkout in
 *   test mode (live payments stay disabled until the owner explicitly enables them).
 */
export const ORDER_API_BASE_URL = (process.env.NEXT_PUBLIC_ORDER_API_BASE_URL ?? "").trim();

export const CHECKOUT_KIND: "demo" | "api" = ORDER_API_BASE_URL ? "api" : "demo";

let gateway: (OrderGateway & Partial<DemoControls>) | null = null;

export function getOrderGateway(): OrderGateway & Partial<DemoControls> {
  if (!gateway) {
    gateway =
      CHECKOUT_KIND === "api"
        ? createApiGateway(ORDER_API_BASE_URL)
        : createDemoGateway({
            storageKey: "mangocat:shang-hai:demo-orders:v1",
            prepare: {
              index: shangHaiCatalog,
              ordering: shangHaiOrdering,
              allowedStorefronts: STOREFRONT_IDS,
            },
            paymentPath: demoPaymentPath,
          });
  }
  return gateway;
}

export function cartStorageKey(storefront: string): string {
  return `mangocat:shang-hai:${storefront}:cart:v1`;
}

/** Remembers the last order per storefront so the menu can point back to it. */
export function lastOrderStorageKey(storefront: string): string {
  return `mangocat:shang-hai:${storefront}:last-order:v1`;
}
