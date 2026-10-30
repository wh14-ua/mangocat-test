import type { CheckoutRequest, OrderStatus, OrderSummary } from "../types";
import { canTransition } from "../orders";
import { prepareOrder, type PrepareContext } from "./prepare-order";
import type { CheckoutResult, DemoControls, OrderGateway, OrderLookup } from "./gateway";

/**
 * DEMO MODE. A local stand-in for the order Worker: it runs exactly the same
 * validation and pricing (prepareOrder), keeps orders in this browser only, and never
 * charges anything or notifies the restaurant. Orders are labelled mode "demo".
 */

type StoredDemoOrder = { token: string; order: OrderSummary };

const DEMO_SEQUENCE: OrderStatus[] = ["paid", "preparing", "ready", "completed"];

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

export function createDemoGateway(options: {
  storageKey: string;
  prepare: PrepareContext;
  /** Path of the local payment simulator for an order. */
  paymentPath: (orderId: string, token: string, storefront: string) => string;
  storage?: Storage | null;
  latencyMs?: number;
}): OrderGateway & DemoControls {
  const { storageKey, prepare, paymentPath, latencyMs = 450 } = options;
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
      const parsed = raw ? (JSON.parse(raw) as Record<string, StoredDemoOrder>) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
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

  const wait = () => new Promise((r) => setTimeout(r, latencyMs));

  function lookup(orderId: string, token: string): StoredDemoOrder | null {
    const found = readAll()[orderId] ?? memory.get(orderId);
    return found && found.token === token ? found : null;
  }

  function setStatus(orderId: string, token: string, status: OrderStatus): OrderLookup {
    const all = readAll();
    const found = all[orderId];
    if (!found || found.token !== token) return { ok: false, error: "not-found" };
    if (found.order.status !== status && canTransition(found.order.status, status)) {
      found.order = { ...found.order, status, updatedAt: new Date().toISOString() };
      writeAll(all);
    }
    return { ok: true, order: found.order };
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
      const now = new Date().toISOString();
      const order: OrderSummary = {
        id: demoOrderId(),
        status: "pending",
        createdAt: now,
        updatedAt: now,
        fulfillment: req.fulfillment,
        lines: quote.lines,
        subtotalCents: quote.subtotalCents,
        deliveryFeeCents: quote.deliveryFeeCents,
        totalCents: quote.totalCents,
        currency: "EUR",
        customerName: req.customer.name,
        mode: "demo",
        pickupNote: "Demostración: este pedido no se envía al restaurante.",
      };
      const token = randomToken();
      const all = readAll();
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
      const status: OrderStatus =
        outcome === "approve" ? "paid" : outcome === "decline" ? "failed" : "cancelled";
      return setStatus(orderId, token, status);
    },

    async advanceDemoOrder(orderId, token) {
      const found = lookup(orderId, token);
      if (!found) return { ok: false, error: "not-found" };
      const next = DEMO_SEQUENCE[DEMO_SEQUENCE.indexOf(found.order.status) + 1];
      return next ? setStatus(orderId, token, next) : { ok: true, order: found.order };
    },
  };
}
