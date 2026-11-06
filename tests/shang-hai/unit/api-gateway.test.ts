import { describe, expect, it } from "vitest";
import { createApiGateway } from "@/lib/commerce/checkout/api-gateway";

/** A fetch that never answers, unless the request is aborted (like a dead or captive network). */
function hangingFetch(calls: { signal?: AbortSignal | null }[]): typeof fetch {
  return (_input, init) => {
    calls.push({ signal: init?.signal });
    return new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });
  };
}

/** Answers the headers at once and then never finishes the body. */
function stalledBodyFetch(): typeof fetch {
  return async (_input, init) =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"order":'));
          init?.signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
}

const PAYLOAD = {
  catalogId: "shang-hai-orihuela",
  catalogVersion: "v1",
  storefront: "ink-house",
  fulfillment: "pickup" as const,
  lines: [{ itemId: "combo-a", quantity: 1 }],
  customer: { name: "Ana", phone: "612345678", email: "a@example.es" },
  expectedTotalCents: 1945,
  locale: "es" as const,
};

describe("storefront → Worker requests never hang", () => {
  it("a checkout that gets no answer becomes a 'network' failure (the pay button is usable again)", async () => {
    const calls: { signal?: AbortSignal | null }[] = [];
    const gateway = createApiGateway("http://worker", hangingFetch(calls), { checkout: 50, lookup: 50 });
    const started = Date.now();
    expect(await gateway.createCheckout(PAYLOAD)).toEqual({ ok: false, error: "network" });
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(calls[0].signal).toBeTruthy();
  });

  it("a status lookup that gets no answer becomes 'network' (the page shows 'connection lost' and keeps polling)", async () => {
    const gateway = createApiGateway("http://worker", hangingFetch([]), { checkout: 50, lookup: 50 });
    expect(await gateway.getOrder("SH-261106-AAAAAA", "t".repeat(43))).toEqual({ ok: false, error: "network" });
  });

  it("a body that stalls half-way is also a 'network' failure, not a frozen page", async () => {
    const gateway = createApiGateway("http://worker", stalledBodyFetch(), { checkout: 50, lookup: 50 });
    expect(await gateway.getOrder("SH-261106-AAAAAA", "t".repeat(43))).toEqual({ ok: false, error: "network" });
  });

  it("answers within the deadline are read normally", async () => {
    const ok: typeof fetch = async () => Response.json({ order: { id: "SH-1", status: "preparing", paymentStatus: "captured", createdAt: "x", lines: [], totalCents: 1 } });
    const gateway = createApiGateway("http://worker", ok, { checkout: 1_000, lookup: 1_000 });
    expect(await gateway.getOrder("SH-261106-AAAAAA", "t".repeat(43))).toMatchObject({ ok: true, order: { status: "preparing" } });
  });
});
