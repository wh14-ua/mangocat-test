"use client";

import Link from "next/link";
import { formatCents } from "@/lib/commerce/money";
import { ORDER_PROGRESS, ORDER_STATUS_COPY, progressIndex } from "@/lib/commerce/orders";
import type { OrderSummary } from "@/lib/commerce/types";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { useOrderStatus } from "@/hooks/shang-hai/useOrderStatus";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { DemoStrip, SubpageBar } from "./Checkout";

const ROUTES = storefrontRoutes("wok-after-dark");

const SHORT_LABEL: Record<string, string> = {
  pending: "Pedido",
  paid: "Pagado",
  preparing: "En cocina",
  ready: "Listo",
  completed: "Recogido",
};

/** Demo orders never reach the kitchen, so their status copy says it is simulated. */
function statusDetail(order: OrderSummary): string {
  const detail = ORDER_STATUS_COPY[order.status].detail;
  if (order.mode !== "demo") return detail;
  if (order.status === "paid") {
    return "Pago simulado. En la versión real, el restaurante recibiría ahora tu pedido.";
  }
  return `Simulación: ${detail.charAt(0).toLowerCase()}${detail.slice(1)}`;
}

function HeatBar({ order }: { order: OrderSummary }) {
  const current = progressIndex(order.status);
  return (
    <ol className="mt-8 grid grid-cols-5 gap-1.5" aria-label="Progreso del pedido">
      {ORDER_PROGRESS.map((s, i) => {
        const done = current >= i;
        return (
          <li key={s} aria-current={current === i ? "step" : undefined}>
            <span className="wok-heat-seg block" style={{ ["--fill" as string]: done ? 1 : 0 } as React.CSSProperties} />
            <span
              className={
                "wok-cond mt-2 block text-[0.6875rem] sm:text-[0.75rem] " +
                (done ? "text-[var(--wok-white)]" : "text-[var(--wok-metal-light)]")
              }
            >
              {SHORT_LABEL[s]}
              <span className="wok-sr">{done ? " (hecho)" : " (pendiente)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderBody({
  order,
  advanceDemo,
}: {
  order: OrderSummary;
  advanceDemo: (() => Promise<void>) | null;
}) {
  const copy = ORDER_STATUS_COPY[order.status];
  const off = order.status === "failed" || order.status === "cancelled" || order.status === "needs_review";
  const addr = shangHaiRestaurant.address.value;
  return (
    <>
      <section
        data-testid="order-status"
        data-status={order.status}
        aria-labelledby="wok-status-word"
        className="border-b-4 border-[var(--wok-orange)] pb-10"
      >
        <p className="wok-cond text-[0.8125rem] text-[var(--wok-metal-light)]">Pedido</p>
        <p data-testid="order-number" className="wok-display mt-2 break-all text-[clamp(2.75rem,11vw,6.5rem)] wok-nums">
          {order.id}
        </p>
        <h1
          id="wok-status-word"
          aria-live="polite"
          className={
            "wok-display mt-6 text-[clamp(4rem,19vw,12rem)] " +
            (off ? "text-[var(--wok-white)]" : "text-[var(--wok-orange)]")
          }
        >
          {copy.label}
        </h1>
        <p className="mt-4 max-w-[44ch] text-[1.125rem] leading-snug">{statusDetail(order)}</p>
        {!off && <HeatBar order={order} />}
        {off && order.status === "failed" && (
          <Link href={ROUTES.checkout} className="wok-btn wok-btn--hot mt-8 h-14 px-8">
            Volver a intentarlo
          </Link>
        )}
        {advanceDemo && !off && order.status !== "completed" && (
          <button
            type="button"
            data-testid="demo-advance"
            onClick={() => void advanceDemo()}
            className="wok-btn wok-btn--line mt-8"
          >
            Avanzar estado (demo)
          </button>
        )}
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
        <section aria-labelledby="wok-status-lines" className="min-w-0">
          <h2 id="wok-status-lines" className="wok-display text-[2.75rem]">
            Tu ticket
          </h2>
          <ul className="mt-4 border-t-2 border-dashed border-[var(--wok-metal)]">
            {order.lines.map((l) => (
              <li key={l.key} className="flex items-start justify-between gap-4 border-b-2 border-dashed border-[var(--wok-metal)] py-3">
                <span className="min-w-0">
                  <span className="wok-cond-tight block text-[1rem] leading-tight">
                    {l.quantity} × {l.name}
                  </span>
                  {l.optionsLabel && <span className="wok-muted mt-0.5 block text-[0.875rem]">{l.optionsLabel}</span>}
                </span>
                <span className="wok-nums shrink-0 font-semibold">{formatCents(l.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-end justify-between">
            <span className="wok-cond text-[0.8125rem]">Total</span>
            <span className="wok-display text-[3rem] text-[var(--wok-orange)] wok-nums">{formatCents(order.totalCents)}</span>
          </div>
        </section>
        <aside aria-label="Recogida" className="bg-[var(--wok-petrol-2)] p-5 lg:p-6">
          <p className="wok-cond text-[0.75rem] text-[var(--wok-orange)]">Recogida en el local</p>
          <p className="wok-cond-tight mt-2 text-[1.375rem] leading-tight">
            {addr.street}
            <br />
            {addr.postalCode} {addr.city}
          </p>
          <p className="wok-muted mt-3 text-[0.9375rem]">El restaurante te confirmará la hora de recogida.</p>
          <p className="wok-muted mt-3 text-[0.9375rem]">A nombre de {order.customerName}.</p>
          <a
            href={shangHaiRestaurant.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="wok-btn wok-btn--line mt-5 w-full"
          >
            Cómo llegar <span className="wok-sr">(se abre en una pestaña nueva)</span>
          </a>
        </aside>
      </div>
    </>
  );
}

export function StatusView() {
  const { state, advanceDemo, isDemo, refresh } = useOrderStatus();
  return (
    <>
      <SubpageBar />
      <main id="contenido" className="px-4 pb-24 pt-8 sm:px-6 lg:px-12 lg:pt-12">
        {isDemo && (
          <div className="mb-8 max-w-[64rem]">
            <DemoStrip>Este pedido solo existe en este navegador.</DemoStrip>
          </div>
        )}
        {state.phase === "loading" && (
          <p className="wok-display text-[clamp(3rem,12vw,7rem)] text-[var(--wok-metal-light)]" aria-live="polite">
            Cargando…
          </p>
        )}
        {(state.phase === "missing" || state.phase === "error") && (
          <div className="max-w-[42rem]">
            <h1 className="wok-display text-[clamp(3.5rem,14vw,8rem)]">
              {state.phase === "error" && state.error !== "not-found" ? "Sin conexión" : "Pedido no encontrado"}
            </h1>
            <p className="wok-muted mt-4 text-[1.0625rem]">
              {state.phase === "error" && state.error !== "not-found"
                ? "No hemos podido consultar el estado del pedido. Comprueba tu conexión y vuelve a intentarlo."
                : "El enlace no es válido o el pedido ya no está disponible en este navegador."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {state.phase === "error" && state.error !== "not-found" && (
                <button type="button" className="wok-btn wok-btn--hot" onClick={() => void refresh()}>
                  Reintentar
                </button>
              )}
              <Link href={ROUTES.home} className="wok-btn wok-btn--line">
                Volver a la carta
              </Link>
            </div>
          </div>
        )}
        {state.phase === "ready" && <OrderBody order={state.order} advanceDemo={advanceDemo} />}
      </main>
    </>
  );
}
