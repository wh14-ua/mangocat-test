"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { defineMessages } from "@/lib/i18n/locale";
import { formatMoney } from "@/lib/i18n/format";
import type { OrderSummary } from "@/lib/commerce/types";
import { getOrderGateway } from "@/lib/shang-hai/checkout";
import {
  getStorefront,
  isStorefrontId,
  orderStatusPath,
  storefrontRoutes,
  SHANG_HAI_BASE_PATH,
} from "@/lib/shang-hai/storefronts";

const TEXT = defineMessages({
  es: {
    notice: "Demostración — no se realizará ningún cargo",
    proposal: (number: string, name: string) => `SHANG HAI · Propuesta ${number} ${name}`,
    title: "Simulador de pago",
    intro:
      "En la versión real, este paso es la página segura de Stripe Checkout: el importe solo se reserva en la tarjeta y se cobra cuando el restaurante acepta el pedido. Este simulador no pide ni guarda datos de tarjeta: elige qué resultado quieres ver.",
    loading: "Cargando el pedido…",
    missingTitle: "No encontramos este pedido de demostración.",
    missingText: "Los pedidos de demostración solo existen en este navegador. Vuelve a la carta y crea uno nuevo.",
    backToMenu: "Volver a la carta",
    order: "Pedido",
    items: "Productos",
    total: "Total",
    working: "Procesando…",
    approve: "Simular pago autorizado",
    decline: "Simular pago rechazado",
    cancel: "Cancelar y volver al pedido",
    notPending: "Este pedido ya no está pendiente de pago.",
    seeStatus: "Ver el estado del pedido",
    footer: "Una propuesta de MangoCat Studios",
  },
  en: {
    notice: "Demo — you will not be charged",
    proposal: (number: string, name: string) => `SHANG HAI · Proposal ${number} ${name}`,
    title: "Payment simulator",
    intro:
      "In the real service this step is Stripe Checkout's secure page: the amount is only put on hold on the card and charged when the restaurant accepts the order. This simulator never asks for or stores card details: choose the outcome you want to see.",
    loading: "Loading the order…",
    missingTitle: "We cannot find this demo order.",
    missingText: "Demo orders only exist in this browser. Go back to the menu and place a new one.",
    backToMenu: "Back to the menu",
    order: "Order",
    items: "Items",
    total: "Total",
    working: "Processing…",
    approve: "Simulate authorised payment",
    decline: "Simulate declined payment",
    cancel: "Cancel and go back to the order",
    notPending: "This order is no longer waiting for payment.",
    seeStatus: "See the order status",
    footer: "A proposal by MangoCat Studios",
  },
});

/**
 * DEMO MODE payment step. Stands in for Stripe Checkout's hosted page while no Stripe
 * credentials are configured. It never asks for, receives or stores card data: the
 * outcome is chosen with explicit "simulate" buttons.
 */
export function DemoPaymentScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { locale } = useLocale();
  const t = TEXT[locale];
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
      lang={locale}
      className="min-h-[100dvh] bg-[#eceef1] px-4 py-8 text-[#1a1d21] sm:py-14"
      style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", lineHeight: 1.5 }}
    >
      <main className="mx-auto w-full max-w-[460px]">
        <p
          role="status"
          className="mb-4 rounded-lg border border-[#d9a300] bg-[#fff6d6] px-4 py-3 text-[14px] font-semibold text-[#5c4300]"
        >
          {t.notice}
        </p>

        <section
          aria-labelledby="demo-pay-title"
          className="rounded-xl bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_8px_24px_-12px_rgba(16,24,40,0.18)] sm:p-7"
        >
          <p className="text-[13px] text-[#5b6470]">
            {shop ? t.proposal(shop.number, shop.name) : "SHANG HAI"}
          </p>
          <h1 id="demo-pay-title" className="mt-1 text-[22px] font-semibold leading-tight" style={{ fontFamily: "inherit", color: "inherit" }}>
            {t.title}
          </h1>
          <p className="mt-2 text-[14px] text-[#5b6470]">{t.intro}</p>

          {state === "loading" && (
            <p className="mt-6 text-[14px] text-[#5b6470]" aria-live="polite">
              {t.loading}
            </p>
          )}

          {state === "missing" && (
            <div className="mt-6 rounded-lg bg-[#f6f7f9] p-4 text-[14px]">
              <p className="font-semibold">{t.missingTitle}</p>
              <p className="mt-1 text-[#5b6470]">{t.missingText}</p>
              <Link
                href={storefront ? storefrontRoutes(storefront).home : `${SHANG_HAI_BASE_PATH}/`}
                className="mt-3 inline-block font-semibold text-[#0b57d0] underline underline-offset-2"
              >
                {t.backToMenu}
              </Link>
            </div>
          )}

          {order && state !== "missing" && (
            <>
              <dl className="mt-6 space-y-1 border-y border-[#e5e7eb] py-4 text-[14px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#5b6470]">{t.order}</dt>
                  <dd className="font-medium tabular-nums">{order.id}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#5b6470]">{t.items}</dt>
                  <dd className="tabular-nums">
                    {order.lines.reduce((n, l) => n + l.quantity, 0)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 pt-2 text-[17px] font-semibold">
                  <dt>{t.total}</dt>
                  <dd className="tabular-nums">{formatMoney(order.totalCents, locale)}</dd>
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
                    {state === "working" ? t.working : t.approve}
                  </button>
                  <button
                    type="button"
                    data-testid="demo-pay-decline"
                    disabled={state === "working"}
                    onClick={() => simulate("decline")}
                    className="h-12 rounded-lg border border-[#d0d5dd] bg-white px-4 text-[15px] font-semibold text-[#b42318] hover:bg-[#fef3f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b42318] disabled:opacity-60"
                  >
                    {t.decline}
                  </button>
                  <button
                    type="button"
                    data-testid="demo-pay-cancel"
                    disabled={state === "working"}
                    onClick={() => simulate("cancel")}
                    className="h-11 rounded-lg px-4 text-[14px] font-medium text-[#344054] underline underline-offset-2 hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#344054] disabled:opacity-60"
                  >
                    {t.cancel}
                  </button>
                </div>
              ) : (
                <div className="mt-6 text-[14px]">
                  <p>{t.notPending}</p>
                  {storefront && (
                    <Link
                      href={orderStatusPath(storefront, orderId, token)}
                      className="mt-2 inline-block font-semibold text-[#0b57d0] underline underline-offset-2"
                    >
                      {t.seeStatus}
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        <p className="mt-5 text-center text-[12px] text-[#475467]">
          {t.footer}
        </p>
      </main>
    </div>
  );
}
