"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { OrderSummary } from "@/lib/commerce/types";
import type { DemoRestaurantAction } from "@/lib/commerce/checkout/gateway";
import { describeOrder } from "@/lib/commerce/order-view";
import { getOrderGateway } from "@/lib/shang-hai/checkout";
import { useCart } from "./useCart";

type State =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "error"; error: "not-found" | "network" | "server" }
  | { phase: "ready"; order: OrderSummary };

/** Statuses meaning the order reached the restaurant: the cart has done its job. */
const PLACED = new Set(["awaiting_acceptance", "accepting", "preparing", "ready", "completed", "rejecting", "rejected", "needs_review"]);

/**
 * Reads ?pedido=&t= from the URL and keeps the order fresh from the backend (or the demo
 * simulator). What the page shows is always what the backend reports: returning from the
 * payment page never marks anything as paid by itself.
 *
 * Polling follows the order (fast while waiting for the payment or the restaurant, slower
 * in the kitchen, stopped once settled), refreshes as soon as the tab is visible again,
 * and keeps the last known state on screen if the connection drops.
 *
 * Must be rendered inside a <Suspense> boundary (it uses useSearchParams).
 */
export function useOrderStatus() {
  const params = useSearchParams();
  const orderId = params.get("pedido") ?? "";
  const token = params.get("t") ?? "";
  const cart = useCart();
  const [state, setState] = useState<State>(() =>
    orderId && token ? { phase: "loading" } : { phase: "missing" },
  );
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const clearedRef = useRef(false);
  const kickRef = useRef<() => void>(() => {});
  const gateway = getOrderGateway();

  const apply = useCallback((res: Awaited<ReturnType<typeof gateway.getOrder>>) => {
    if (res.ok) {
      setState({ phase: "ready", order: res.order });
      setLastUpdated(new Date());
      setConnectionLost(false);
      return;
    }
    // Keep showing the last known order when only the connection failed.
    setState((prev) => (prev.phase === "ready" && res.error !== "not-found" ? prev : { phase: "error", error: res.error }));
    setConnectionLost(res.error !== "not-found");
  }, []);

  useEffect(() => {
    if (!orderId || !token) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let failures = 0;

    const tick = async () => {
      if (timer) clearTimeout(timer);
      const res = await gateway.getOrder(orderId, token);
      if (cancelled) return;
      apply(res);
      if (!res.ok && res.error === "not-found") return;
      failures = res.ok ? 0 : failures + 1;
      const refresh = res.ok ? describeOrder(res.order, "es").refreshMs : Math.min(30_000, 3_000 * 2 ** failures);
      if (refresh > 0) timer = setTimeout(tick, refresh);
    };
    kickRef.current = () => void tick();
    tick();

    // Back to the tab (or the phone screen unlocked): show the latest state right away.
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [gateway, orderId, token, apply]);

  const refresh = useCallback(async () => {
    if (!orderId || !token) return;
    kickRef.current();
  }, [orderId, token]);

  // The order reached the restaurant (payment authorised): empty the cart once.
  const order = state.phase === "ready" ? state.order : null;
  useEffect(() => {
    if (!order || clearedRef.current) return;
    if (PLACED.has(order.status)) {
      clearedRef.current = true;
      if (cart.lines.length) cart.clear();
    }
  }, [order, cart]);

  const simulateRestaurant = gateway.simulateRestaurant
    ? async (action: DemoRestaurantAction) => {
        const res = await gateway.simulateRestaurant!(orderId, token, action);
        if (res.ok) {
          setState({ phase: "ready", order: res.order });
          setLastUpdated(new Date());
        }
      }
    : null;

  return {
    state,
    orderId,
    token,
    refresh,
    isDemo: gateway.kind === "demo",
    simulateRestaurant,
    lastUpdated,
    connectionLost,
  };
}
