"use client";

import Link from "next/link";
import { MapPin } from "@phosphor-icons/react/dist/ssr";
import { DEMO_NOTICE } from "@/components/shang-hai/shared/StorefrontShell";
import { useOrderStatus } from "@/hooks/shang-hai/useOrderStatus";
import { formatCents } from "@/lib/commerce/money";
import { ORDER_PROGRESS, ORDER_STATUS_COPY, isFinalStatus, progressIndex } from "@/lib/commerce/orders";
import type { OrderStatus } from "@/lib/commerce/types";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { CHECKOUT_KIND } from "@/lib/shang-hai/checkout";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { SubHeader } from "./CheckoutView";
import { PickupSticker } from "./Graphics";

const routes = storefrontRoutes("bento-club");

/** Short labels for the five compartments of the progress tray. */
const STEP_LABEL: Record<OrderStatus, string> = {
  pending: "Pedido creado",
  paid: "Pagado",
  preparing: "En preparación",
  ready: "Listo para recoger",
  completed: "Recogido",
  failed: "Pago no completado",
  cancelled: "Cancelado",
  needs_review: "En revisión",
};

const TIME = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export function StatusView() {
  const { state, isDemo, advanceDemo, refresh } = useOrderStatus();
  const a = shangHaiRestaurant.address.value;

  return (
    <>
      <SubHeader backHref={`${routes.home}#carta`} backLabel="Volver a la carta" />
      <main id="bc-main" className="bc-st">
        <h1 className="bc-co__title">Tu pedido</h1>

        {(CHECKOUT_KIND === "demo" || (state.phase === "ready" && state.order.mode === "demo")) && (
          <div className="bc-notices">
            <p className="bc-warn" role="note">
              {DEMO_NOTICE}
            </p>
          </div>
        )}

        {state.phase === "loading" && (
          <p className="bc-module" aria-busy="true" role="status">
            Consultando el estado de tu pedido…
          </p>
        )}

        {state.phase === "missing" && (
          <div className="bc-empty">
            <p className="bc-info__big">No encontramos ningún pedido en este enlace.</p>
            <p className="bc-help">Abre el enlace completo que recibiste al pagar o vuelve a la carta.</p>
            <Link className="bc-linkbtn" href={routes.home}>
              Ir a la carta
            </Link>
          </div>
        )}

        {state.phase === "error" && (
          <div className="bc-empty" role="alert">
            <p className="bc-info__big">
              {state.error === "not-found"
                ? "No encontramos este pedido."
                : "No hemos podido consultar el estado del pedido."}
            </p>
            <p className="bc-help">
              {state.error === "not-found"
                ? isDemo
                  ? "Los pedidos de demostración solo existen en el navegador donde se hicieron."
                  : "Revisa que el enlace esté completo."
                : "Comprueba tu conexión y vuelve a intentarlo."}
            </p>
            {state.error !== "not-found" && (
              <button type="button" className="bc-linkbtn" onClick={refresh}>
                Reintentar
              </button>
            )}
          </div>
        )}

        {state.phase === "ready" && <OrderTicket key={state.order.id} order={state.order} isDemo={isDemo} advanceDemo={advanceDemo} address={a} />}
      </main>
    </>
  );
}

function OrderTicket({
  order,
  isDemo,
  advanceDemo,
  address,
}: {
  order: Extract<ReturnType<typeof useOrderStatus>["state"], { phase: "ready" }>["order"];
  isDemo: boolean;
  advanceDemo: (() => Promise<void>) | null;
  address: typeof shangHaiRestaurant.address.value;
}) {
  const copy =
    order.mode === "demo" && order.status === "paid"
      ? {
          label: ORDER_STATUS_COPY.paid.label,
          detail: "Pago simulado. En el servicio real, aquí el restaurante ya tendría tu pedido.",
        }
      : ORDER_STATUS_COPY[order.status];
  const current = progressIndex(order.status);
  const offPath = current === -1;
  const canAdvance = isDemo && advanceDemo && !isFinalStatus(order.status) && !offPath;

  return (
    <div className="bc-st__grid">
      <section className="bc-module bc-st__numbox" data-tone="butter" aria-labelledby="bc-st-number">
        <span className="bc-label">Número de pedido</span>
        <p id="bc-st-number" className="bc-st__number" data-testid="order-number">
          {order.id}
        </p>
        <p style={{ fontWeight: 700, fontSize: 14.5 }}>
          A nombre de {order.customerName} · {TIME.format(new Date(order.createdAt))}
        </p>
        <PickupSticker className="bc-st__sticker" />
      </section>

      <section
        className="bc-module"
        aria-labelledby="bc-st-label"
        data-testid="order-status"
        data-status={order.status}
        aria-live="polite"
      >
        <span className="bc-label">Estado</span>
        <h2 id="bc-st-label" className="bc-st__label">
          {copy.label}
        </h2>
        <p style={{ fontWeight: 600 }}>{copy.detail}</p>
        {!offPath ? (
          <ol className="bc-progress" aria-label="Progreso del pedido">
            {ORDER_PROGRESS.map((s, i) => {
              const stepState = i < current ? "done" : i === current ? "current" : "todo";
              return (
                <li key={s} data-state={stepState} aria-current={i === current ? "step" : undefined}>
                  <span className="bc-progress__dot" aria-hidden />
                  {STEP_LABEL[s]}
                </li>
              );
            })}
          </ol>
        ) : (
          (order.status === "failed" || order.status === "cancelled") && (
            <Link className="bc-primary" href={routes.checkout} style={{ width: "auto" }}>
              Volver a tu pedido
            </Link>
          )
        )}
        {canAdvance && (
          <button
            type="button"
            className="bc-linkbtn bc-demo-advance"
            data-testid="demo-advance"
            onClick={() => advanceDemo?.()}
          >
            Simular el siguiente estado (demo)
          </button>
        )}
      </section>

      <section className="bc-module" aria-labelledby="bc-st-lines">
        <h2 id="bc-st-lines" className="bc-module__title">
          Lo que has pedido
        </h2>
        <ul className="bc-sumlines">
          {order.lines.map((l) => (
            <li key={l.key}>
              <span className="bc-sumlines__q">
                {l.quantity}
                <span className="bc-sr"> unidades de</span>
              </span>
              <span className="bc-sumlines__n">
                {l.name}
                {l.optionsLabel && <small>{l.optionsLabel}</small>}
              </span>
              <span className="bc-sumlines__p">{formatCents(l.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <div className="bc-sums">
          <div className="bc-sums__total">
            <span>Total</span>
            <strong>{formatCents(order.totalCents)}</strong>
          </div>
        </div>
      </section>

      <section className="bc-module" data-tone="lime" aria-labelledby="bc-st-pickup">
        <h2 id="bc-st-pickup" className="bc-module__title">
          Recogida
        </h2>
        <p className="bc-info__big">
          {address.street}, {address.postalCode} {address.city}
        </p>
        <p style={{ fontWeight: 600 }}>El restaurante te confirmará la hora de recogida.</p>
        <a className="bc-linkbtn" href={shangHaiRestaurant.directionsUrl} target="_blank" rel="noopener noreferrer">
          <MapPin size={18} weight="bold" aria-hidden />
          Cómo llegar
          <span className="bc-sr"> (se abre Google Maps)</span>
        </a>
        {order.pickupNote && <p style={{ fontWeight: 700, fontSize: 13.5 }}>{order.pickupNote}</p>}
      </section>
    </div>
  );
}
