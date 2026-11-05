import type { CheckoutRequest, OrderStatus, OrderSummary, PaymentStatus } from "../types";
import { canTransition, LOCK_STATUSES, normalizeLegacyStatus } from "../orders";
import { prepareOrder, type PrepareContext } from "./prepare-order";
import type {
  CheckoutResult,
  DemoControls,
  DemoRestaurantAction,
  OrderGateway,
  OrderLookup,
} from "./gateway";

/**
 * DEMO MODE. A local stand-in for the order Worker: it runs exactly the same
 * validation and pricing (prepareOrder), keeps orders in this browser only, and never
 * charges anything or notifies the restaurant. Orders are labelled mode "demo".
 *
 * The flow mirrors the real one: the simulated payment only AUTHORISES the amount, then a
 * simulated restaurant accepts (capture) or rejects (authorisation released).
 */

type StoredDemoOrder = { token: string; order: OrderSummary };

/** Accepted preparation times (minutes), same bounds as the staff panel. */
export const PREP_MINUTES_MIN = 5;
export const PREP_MINUTES_MAX = 180;

function randomToken(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function demoOrderId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint8Array(6);
  globalThis.crypto.getRandomValues(buf);
  return `DEMO-${Array.from(buf, (b) => alphabet[b % alphabet.length]).join("")}`;
}

/** Orders saved before the acceptance flow have no paymentStatus: normalise them on read. */
function normalize(order: OrderSummary): OrderSummary {
  if (order.paymentStatus) return order;
  const { status, paymentStatus } = normalizeLegacyStatus(order.status);
  return { ...order, status, paymentStatus };
}

export function createDemoGateway(options: {
  storageKey: string;
  prepare: PrepareContext;
  /** Path of the local payment simulator for an order. */
  paymentPath: (orderId: string, token: string, storefront: string) => string;
  storage?: Storage | null;
  latencyMs?: number;
  now?: () => Date;
}): OrderGateway & DemoControls {
  const { storageKey, prepare, paymentPath, latencyMs = 450 } = options;
  const now = options.now ?? (() => new Date());
  const memory = new Map<string, StoredDemoOrder>();

  const storage = (): Storage | null => {
    if (options.storage !== undefined) return options.storage;
    try {
      return typeof window !== "undefined" ? window.localStorage : null;
    } catch {
      return null;
    }
  };

  function readAll(): Record<string, StoredDemoOrder> {
    try {
      const raw = storage()?.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as Record<string, StoredDemoOrder>) : null;
      if (parsed && typeof parsed === "object") return parsed;
      return Object.fromEntries(memory);
    } catch {
      return Object.fromEntries(memory);
    }
  }

  function writeAll(all: Record<string, StoredDemoOrder>) {
    // Keep only the 20 most recent demo orders.
    const entries = Object.entries(all)
      .sort((a, b) => b[1].order.createdAt.localeCompare(a[1].order.createdAt))
      .slice(0, 20);
    memory.clear();
    entries.forEach(([k, v]) => memory.set(k, v));
    try {
      storage()?.setItem(storageKey, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      /* in-memory fallback */
    }
  }

  const wait = () => (latencyMs > 0 ? new Promise((r) => setTimeout(r, latencyMs)) : Promise.resolve());

  function lookup(orderId: string, token: string): StoredDemoOrder | null {
    const found = readAll()[orderId] ?? memory.get(orderId);
    return found && found.token === token ? { ...found, order: normalize(found.order) } : null;
  }

  /** Applies a change if the lifecycle allows it; otherwise returns the order unchanged. */
  function update(
    orderId: string,
    token: string,
    change: (order: OrderSummary) => Partial<OrderSummary> & { status: OrderStatus } | null,
  ): OrderLookup {
    const all = readAll();
    const found = all[orderId];
    if (!found || found.token !== token) return { ok: false, error: "not-found" };
    const order = normalize(found.order);
    const next = change(order);
    // The demo has no Stripe round trip, so it may pass straight through a lock status
    // (awaiting_acceptance -> accepting -> preparing) as the real server does in two steps.
    const allowed =
      next !== null &&
      next.status !== order.status &&
      (canTransition(order.status, next.status) ||
        LOCK_STATUSES.some((via) => canTransition(order.status, via) && canTransition(via, next.status)));
    if (next && allowed) {
      found.order = { ...order, ...next, updatedAt: now().toISOString() };
      writeAll(all);
      return { ok: true, order: found.order };
    }
    return { ok: true, order };
  }

  function restaurant(order: OrderSummary, action: DemoRestaurantAction) {
    const at = now();
    switch (action.type) {
      case "accept": {
        if (order.status !== "awaiting_acceptance") return null;
        const minutes = Math.trunc(action.prepMinutes);
        if (!Number.isFinite(minutes) || minutes < PREP_MINUTES_MIN || minutes > PREP_MINUTES_MAX) return null;
        return {
          status: "preparing" as const,
          paymentStatus: "captured" as const,
          acceptedAt: at.toISOString(),
          prepMinutes: minutes,
          readyBy: new Date(at.getTime() + minutes * 60_000).toISOString(),
        };
      }
      case "reject": {
        if (!["awaiting_acceptance", "preparing", "ready"].includes(order.status)) return null;
        // A held amount is released; an already captured one is refunded (instant in the demo).
        const paymentStatus: PaymentStatus = order.paymentStatus === "captured" ? "refunded" : "canceled";
        const reason = action.reason?.trim().slice(0, 200);
        return {
          status: "rejected" as const,
          paymentStatus,
          rejectedAt: at.toISOString(),
          ...(reason ? { rejectionReason: reason } : {}),
        };
      }
      case "ready":
        return order.status === "preparing" ? { status: "ready" as const, readyAt: at.toISOString() } : null;
      case "complete":
        return order.status === "ready" ? { status: "completed" as const, completedAt: at.toISOString() } : null;
    }
  }

  return {
    kind: "demo",
    async getPaymentsMode() {
      return "demo";
    },

    async createCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
      await wait();
      const prepared = prepareOrder(request, prepare);
      if (!prepared.ok) return prepared;
      const { quote, request: req } = prepared.value;
      const created = now().toISOString();
      const all = readAll();
      const numbers = Object.values(all)
        .map((o) => o.order.number ?? 0)
        .filter((n) => Number.isSafeInteger(n));
      const order: OrderSummary = {
        id: demoOrderId(),
        number: Math.max(1000, ...numbers) + 1,
        status: "pending",
        paymentStatus: "unpaid",
        createdAt: created,
        updatedAt: created,
        fulfillment: req.fulfillment,
        lines: quote.lines,
        subtotalCents: quote.subtotalCents,
        deliveryFeeCents: quote.deliveryFeeCents,
        totalCents: quote.totalCents,
        currency: "EUR",
        customerName: req.customer.name,
        mode: "demo",
      };
      const token = randomToken();
      all[order.id] = { token, order };
      writeAll(all);
      return {
        ok: true,
        orderId: order.id,
        orderToken: token,
        next: { kind: "internal", path: paymentPath(order.id, token, req.storefront) },
        mode: "demo",
      };
    },

    async getOrder(orderId, token) {
      const found = lookup(orderId, token);
      return found ? { ok: true, order: found.order } : { ok: false, error: "not-found" };
    },

    async simulatePayment(orderId, token, outcome) {
      await wait();
      return update(orderId, token, (order) => {
        if (order.status !== "pending" && order.status !== "failed") return null;
        if (outcome === "approve") return { status: "awaiting_acceptance", paymentStatus: "authorized" };
        if (outcome === "decline") return { status: "failed", paymentStatus: "failed" };
        return { status: "cancelled", paymentStatus: "unpaid" };
      });
    },

    async simulateRestaurant(orderId, token, action) {
      await wait();
      return update(orderId, token, (order) => restaurant(order, action));
    },
  };
}
