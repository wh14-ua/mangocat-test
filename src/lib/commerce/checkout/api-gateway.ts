import type { CheckoutRequest, OrderSummary } from "../types";
import type {
  CheckoutFailure,
  CheckoutResult,
  OrderGateway,
  OrderLookup,
  PaymentsMode,
} from "./gateway";

type Fetch = typeof fetch;

/**
 * Client for the order Worker (workers/shang-hai-orders). The Worker re-validates and
 * re-prices everything and returns a Stripe Checkout URL; this client never sends or
 * trusts prices.
 */
export function createApiGateway(baseUrl: string, fetchImpl: Fetch = fetch): OrderGateway {
  const base = baseUrl.replace(/\/+$/, "");

  async function request(path: string, init?: RequestInit): Promise<Response | null> {
    try {
      return await fetchImpl(`${base}${path}`, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers ?? {}) },
      });
    } catch {
      return null;
    }
  }

  return {
    kind: "api",
    async getPaymentsMode(): Promise<PaymentsMode> {
      const res = await request("/api/config");
      if (!res?.ok) return "disabled";
      const body = (await res.json().catch(() => null)) as { paymentsMode?: PaymentsMode } | null;
      return body?.paymentsMode ?? "disabled";
    },

    async createCheckout(payload: CheckoutRequest): Promise<CheckoutResult> {
      const res = await request("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res) return { ok: false, error: "network" };
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (res.ok && body && typeof body.checkoutUrl === "string") {
        return {
          ok: true,
          orderId: String(body.orderId),
          orderToken: String(body.orderToken),
          next: { kind: "external", url: body.checkoutUrl },
          mode: (body.mode as PaymentsMode) ?? "stripe-test",
        };
      }
      if (res.status === 429) return { ok: false, error: "rate-limited" };
      const error = body?.error as CheckoutFailure["error"] | undefined;
      switch (error) {
        case "invalid":
          return { ok: false, error, fieldErrors: (body?.fieldErrors as Record<string, string>) ?? {} };
        case "not-payable":
          return { ok: false, error, issues: (body?.issues as never[]) ?? [] };
        case "price-changed":
          return { ok: false, error, totalCents: Number(body?.totalCents) };
        case "age-confirmation-required":
        case "payments-disabled":
          return { ok: false, error };
        default:
          return { ok: false, error: "server" };
      }
    },

    async getOrder(orderId: string, orderToken: string): Promise<OrderLookup> {
      const res = await request(`/api/orders/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${orderToken}` },
      });
      if (!res) return { ok: false, error: "network" };
      if (res.status === 404 || res.status === 401) return { ok: false, error: "not-found" };
      if (!res.ok) return { ok: false, error: "server" };
      const body = (await res.json().catch(() => null)) as { order?: OrderSummary } | null;
      return body?.order ? { ok: true, order: body.order } : { ok: false, error: "server" };
    },
  };
}
