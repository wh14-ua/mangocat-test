"use client";

import Link from "next/link";
import { useOrderStatus } from "@/hooks/shang-hai/useOrderStatus";
import { formatCents } from "@/lib/commerce/money";
import { ORDER_STATUS_COPY, isFinalStatus, progressIndex } from "@/lib/commerce/orders";
import type { OrderStatus, OrderSummary } from "@/lib/commerce/types";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { Seal } from "./Seal";
import { DemoStamp } from "./InkCheckout";

const routes = storefrontRoutes("ink-house");
const address = shangHaiRestaurant.address.value;

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "paid", label: "Pago confirmado" },
  { status: "preparing", label: "En preparación" },
  { status: "ready", label: "Listo para recoger" },
  { status: "completed", label: "Recogido" },
];

const STAMPED: OrderStatus[] = ["paid", "preparing", "ready", "completed"];

const dateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

export function InkStatusSkeleton() {
  return (
    <div className="ink-receipt-wrap">
      <div className="ink-receipt" aria-busy="true">
        <p className="ink-kicker">Recibo</p>
        <p className="ink-receipt__loading">Consultando tu pedido…</p>
      </div>
    </div>
  );
}

export function InkStatus() {
  const { state, refresh, isDemo, advanceDemo } = useOrderStatus();

  if (state.phase === "loading") return <InkStatusSkeleton />;

  if (state.phase === "missing" || state.phase === "error") {
    const notFound = state.phase === "missing" || state.error === "not-found";
    return (
      <div className="ink-receipt-wrap">
        <div className="ink-receipt">
          <p className="ink-kicker">Recibo</p>
          <h1 className="ink-receipt__title">
            {notFound ? "No encontramos este pedido" : "No podemos consultar el pedido ahora"}
          </h1>
          <p className="ink-receipt__lead">
            {notFound
              ? "Abre el enlace completo que recibiste al pagar. Los pedidos de demostración solo se guardan en el navegador donde se hicieron."
              : "Comprueba tu conexión y vuelve a consultarlo. Tu pago no se ve afectado."}
          </p>
          <div className="ink-receipt__actions">
            {!notFound && (
              <button type="button" className="ink-button ink-button--ink" onClick={refresh}>
                Volver a consultar
              </button>
            )}
            <Link href={routes.home} className="ink-button ink-button--quiet">
              Volver a la carta
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <Receipt order={state.order} isDemo={isDemo} onAdvance={advanceDemo} />;
}

function Receipt({
  order,
  isDemo,
  onAdvance,
}: {
  order: OrderSummary;
  isDemo: boolean;
  onAdvance: (() => Promise<void>) | null;
}) {
  const copy = ORDER_STATUS_COPY[order.status];
  const current = progressIndex(order.status);
  const onPath = current >= 0;
  const stamped = STAMPED.includes(order.status);
  const itemCount = order.lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <div className="ink-receipt-wrap">
      <article className="ink-receipt" aria-labelledby="ink-receipt-title">
        <header className="ink-receipt__head">
          <div>
            <p className="ink-kicker">Recibo</p>
            <h1 id="ink-receipt-title" className="ink-receipt__title">
              {order.status === "pending" ? "Esperando el pago" : "Gracias por tu pedido"}
            </h1>
            <p className="ink-receipt__number">
              Pedido <span data-testid="order-number">{order.id}</span>
            </p>
            <p className="ink-receipt__date">{dateFormat.format(new Date(order.createdAt))}</p>
          </div>
          {stamped && <Seal className="ink-receipt__seal" label="Sellado: pago confirmado" />}
        </header>

        <div
          className="ink-receipt__status"
          data-testid="order-status"
          data-status={order.status}
          aria-live="polite"
        >
          <p className="ink-receipt__status-label">{copy.label}</p>
          <p className="ink-receipt__status-detail">{copy.detail}</p>
        </div>

        {onPath ? (
          <ol className="ink-timeline" aria-label="Progreso del pedido">
            {STEPS.map((step) => {
              const idx = progressIndex(step.status);
              const stateName = idx < current ? "done" : idx === current ? "current" : "upcoming";
              return (
                <li key={step.status} className="ink-timeline__step" data-state={stateName}>
                  <span className="ink-timeline__mark" aria-hidden="true" />
                  <span>{step.label}</span>
                  <span className="ink-sr-only">
                    {stateName === "done" ? " (hecho)" : stateName === "current" ? " (ahora)" : " (pendiente)"}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="ink-receipt__off-path">
            {order.status === "failed" && (
              <Link href={routes.checkout} className="ink-button ink-button--lacquer">
                Volver a intentar el pago
              </Link>
            )}
            {order.status === "cancelled" && (
              <Link href={routes.home} className="ink-button ink-button--ink">
                Hacer un pedido nuevo
              </Link>
            )}
          </div>
        )}

        {isDemo && (
          <DemoStamp>
            Este pedido no ha llegado al restaurante. Puedes simular cómo avanzaría el estado.
          </DemoStamp>
        )}
        {isDemo && onAdvance && !isFinalStatus(order.status) && onPath && order.status !== "pending" && (
          <button type="button" data-testid="demo-advance" className="ink-button ink-button--quiet" onClick={onAdvance}>
            Avanzar estado (demo)
          </button>
        )}

        <section className="ink-receipt__section" aria-labelledby="ink-receipt-lines">
          <h2 id="ink-receipt-lines" className="ink-receipt__h">
            {itemCount} {itemCount === 1 ? "producto" : "productos"}
          </h2>
          <ul className="ink-comanda__lines">
            {order.lines.map((line) => (
              <li key={line.key}>
                <span className="ink-comanda__qty">{line.quantity} ×</span>
                <span className="ink-comanda__name">
                  {line.name}
                  {line.optionsLabel && <span className="ink-comanda__opt">{line.optionsLabel}</span>}
                </span>
                <span className="ink-comanda__price">{formatCents(line.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="ink-total ink-total--comanda">
            <dt>Total</dt>
            <dd>{formatCents(order.totalCents)}</dd>
          </dl>
        </section>

        <section className="ink-receipt__section" aria-labelledby="ink-receipt-pickup">
          <h2 id="ink-receipt-pickup" className="ink-receipt__h">
            Recogida
          </h2>
          <p>
            {address.street}, {address.postalCode} {address.city}
          </p>
          <p className="ink-receipt__muted">El restaurante te confirmará la hora de recogida.</p>
        </section>

        <footer className="ink-receipt__actions">
          <Link href={routes.home} className="ink-button ink-button--quiet">
            Volver a la carta
          </Link>
        </footer>
      </article>
    </div>
  );
}
