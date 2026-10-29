"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { OrderSummary } from "@/lib/commerce/types";
import { isFinalStatus } from "@/lib/commerce/orders";
import { getOrderGateway } from "@/lib/shang-hai/checkout";
import { useCart } from "./useCart";

type State =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "error"; error: "not-found" | "network" | "server" }
  | { phase: "ready"; order: OrderSummary };

/**
 * Reads ?pedido=&t= from the URL and keeps the order status fresh from the backend (or
 * the demo simulator). The status shown is always what the backend reports: returning
 * from the payment page never marks an order as paid by itself.
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
  const clearedRef = useRef(false);
  const gateway = getOrderGateway();

  const refresh = useCallback(async () => {
    if (!orderId || !token) return;
    const res = await gateway.getOrder(orderId, token);
    setState(res.ok ? { phase: "ready", order: res.order } : { phase: "error", error: res.error });
  }, [gateway, orderId, token]);

  useEffect(() => {
    if (!orderId || !token) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      const res = await gateway.getOrder(orderId, token);
      if (cancelled) return;
      attempts += 1;
      setState(res.ok ? { phase: "ready", order: res.order } : { phase: "error", error: res.error });
      const status = res.ok ? res.order.status : null;
      if (status && isFinalStatus(status)) return;
      if (!res.ok && res.error === "not-found") return;
      // Fast while waiting for the payment confirmation, slower afterwards.
      const delay = status === "pending" ? (attempts < 30 ? 3000 : 10000) : 15000;
      timer = setTimeout(tick, delay);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [gateway, orderId, token]);

  // Empty the cart once the backend confirms the payment.
  const order = state.phase === "ready" ? state.order : null;
  useEffect(() => {
    if (!order || clearedRef.current) return;
    if (["paid", "preparing", "ready", "completed"].includes(order.status)) {
      clearedRef.current = true;
      if (cart.lines.length) cart.clear();
    }
  }, [order, cart]);

  const advanceDemo = gateway.advanceDemoOrder
    ? async () => {
        const res = await gateway.advanceDemoOrder!(orderId, token);
        if (res.ok) setState({ phase: "ready", order: res.order });
      }
    : null;

  return { state, orderId, token, refresh, isDemo: gateway.kind === "demo", advanceDemo };
}
