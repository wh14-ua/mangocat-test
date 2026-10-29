"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatCents } from "@/lib/commerce/money";
import type { OrderSummary } from "@/lib/commerce/types";
import { getOrderGateway } from "@/lib/shang-hai/checkout";
import {
  getStorefront,
  isStorefrontId,
  orderStatusPath,
  storefrontRoutes,
  SHANG_HAI_BASE_PATH,
} from "@/lib/shang-hai/storefronts";

/**
 * DEMO MODE payment step. Stands in for Stripe Checkout's hosted page while no Stripe
 * credentials are configured. It never asks for, receives or stores card data: the
 * outcome is chosen with explicit "simulate" buttons.
 */
export function DemoPaymentScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const orderId = params.get("pedido") ?? "";
  const token = params.get("t") ?? "";
  const storefrontParam = params.get("tienda");
  const storefront = isStorefrontId(storefrontParam) ? storefrontParam : null;
  const gateway = getOrderGateway();
  const valid = Boolean(orderId && token && storefront && gateway.kind === "demo");
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "working">(
    valid ? "loading" : "missing",
  );

  useEffect(() => {
    let alive = true;
    if (!valid) return;
    gateway.getOrder(orderId, token).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setOrder(res.order);
        setState("ready");
      } else setState("missing");
    });
    return () => {
      alive = false;
    };
  }, [gateway, orderId, token, valid]);

  async function simulate(outcome: "approve" | "decline" | "cancel") {
    if (!storefront || !gateway.simulatePayment) return;
    setState("working");
    const res = await gateway.simulatePayment(orderId, token, outcome);
    if (outcome === "cancel") {
      router.push(`${storefrontRoutes(storefront).checkout}?cancelado=1`);
      return;
    }
    if (res.ok) router.push(orderStatusPath(storefront, orderId, token));
    else setState("missing");
  }

  const shop = storefront ? getStorefront(storefront) : null;
  const payable = order?.status === "pending" || order?.status === "failed";

  return (
    <div
      lang="es"
      className="min-h-[100dvh] bg-[#eceef1] px-4 py-8 text-[#1a1d21] sm:py-14"
      style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", lineHeight: 1.5 }}
    >
      <main className="mx-auto w-full max-w-[460px]">
        <p
          role="status"
          className="mb-4 rounded-lg border border-[#d9a300] bg-[#fff6d6] px-4 py-3 text-[14px] font-semibold text-[#5c4300]"
        >
          Demostración — no se realizará ningún cargo
        </p>

        <section
          aria-labelledby="demo-pay-title"
          className="rounded-xl bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_8px_24px_-12px_rgba(16,24,40,0.18)] sm:p-7"
        >
          <p className="text-[13px] text-[#5b6470]">
            {shop ? `SHANG HAI · Propuesta ${shop.number} ${shop.name}` : "SHANG HAI"}
          </p>
          <h1 id="demo-pay-title" className="mt-1 text-[22px] font-semibold leading-tight" style={{ fontFamily: "inherit", color: "inherit" }}>
            Simulador de pago
          </h1>
          <p className="mt-2 text-[14px] text-[#5b6470]">
            En la versión real, este paso es la página segura de Stripe Checkout. Este
            simulador no pide ni guarda datos de tarjeta: elige qué resultado quieres ver.
          </p>

          {state === "loading" && (
            <p className="mt-6 text-[14px] text-[#5b6470]" aria-live="polite">
              Cargando el pedido…
            </p>
          )}

          {state === "missing" && (
            <div className="mt-6 rounded-lg bg-[#f6f7f9] p-4 text-[14px]">
              <p className="font-semibold">No encontramos este pedido de demostración.</p>
              <p className="mt-1 text-[#5b6470]">
                Los pedidos de demostración solo existen en este navegador. Vuelve a la
                carta y crea uno nuevo.
              </p>
              <Link
                href={storefront ? storefrontRoutes(storefront).home : `${SHANG_HAI_BASE_PATH}/`}
                className="mt-3 inline-block font-semibold text-[#0b57d0] underline underline-offset-2"
              >
                Volver a la carta
              </Link>
            </div>
          )}

          {order && state !== "missing" && (
            <>
              <dl className="mt-6 space-y-1 border-y border-[#e5e7eb] py-4 text-[14px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#5b6470]">Pedido</dt>
                  <dd className="font-medium tabular-nums">{order.id}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#5b6470]">Productos</dt>
                  <dd className="tabular-nums">
                    {order.lines.reduce((n, l) => n + l.quantity, 0)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 pt-2 text-[17px] font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatCents(order.totalCents)}</dd>
                </div>
              </dl>

              {payable ? (
                <div className="mt-6 grid gap-2.5">
                  <button
                    type="button"
                    data-testid="demo-pay-approve"
                    disabled={state === "working"}
                    onClick={() => simulate("approve")}
                    className="h-12 rounded-lg bg-[#1a7f37] px-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#166b2f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7f37] disabled:opacity-60"
                  >
                    {state === "working" ? "Procesando…" : "Simular pago correcto"}
                  </button>
                  <button
                    type="button"
                    data-testid="demo-pay-decline"
                    disabled={state === "working"}
                    onClick={() => simulate("decline")}
                    className="h-12 rounded-lg border border-[#d0d5dd] bg-white px-4 text-[15px] font-semibold text-[#b42318] hover:bg-[#fef3f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b42318] disabled:opacity-60"
                  >
                    Simular pago rechazado
                  </button>
                  <button
                    type="button"
                    data-testid="demo-pay-cancel"
                    disabled={state === "working"}
                    onClick={() => simulate("cancel")}
                    className="h-11 rounded-lg px-4 text-[14px] font-medium text-[#344054] underline underline-offset-2 hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#344054] disabled:opacity-60"
                  >
                    Cancelar y volver al pedido
                  </button>
                </div>
              ) : (
                <div className="mt-6 text-[14px]">
                  <p>Este pedido ya no está pendiente de pago.</p>
                  {storefront && (
                    <Link
                      href={orderStatusPath(storefront, orderId, token)}
                      className="mt-2 inline-block font-semibold text-[#0b57d0] underline underline-offset-2"
                    >
                      Ver el estado del pedido
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        <p className="mt-5 text-center text-[12px] text-[#667085]">
          Una propuesta de MangoCat Studios
        </p>
      </main>
    </div>
  );
}
