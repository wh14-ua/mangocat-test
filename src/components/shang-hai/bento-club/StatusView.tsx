"use client";

import Link from "next/link";
import { ArrowClockwise, CreditCard, MapPin } from "@phosphor-icons/react/dist/ssr";
import { DemoRestaurantSimulator } from "@/components/shang-hai/shared/DemoRestaurantSimulator";
import { DEMO_NOTICE_TEXT } from "@/components/shang-hai/shared/StorefrontShell";
import { useOrderStatus } from "@/hooks/shang-hai/useOrderStatus";
import { describeOrder, ORDER_VIEW_TEXT } from "@/lib/commerce/order-view";
import type { OrderSummary } from "@/lib/commerce/types";
import { formatClock, formatDayAndTime, formatMoney } from "@/lib/i18n/format";
import { lineName, lineOptionsLabel } from "@/lib/shang-hai/menu-i18n";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { CHECKOUT_KIND } from "@/lib/shang-hai/checkout";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { SubHeader } from "./CheckoutView";
import { PickupSticker } from "./Graphics";
import { useBento, useDocumentTitle } from "./hooks";

const routes = storefrontRoutes("bento-club");

/** Before the restaurant decides, the pickup time is still to come. */
const AWAITING_TIME = new Set<OrderSummary["status"]>(["pending", "awaiting_acceptance", "accepting"]);

export function StatusView() {
  const { locale, t, c } = useBento();
  useDocumentTitle(t.meta.status);
  const { state, isDemo, simulateRestaurant, refresh, lastUpdated, connectionLost } = useOrderStatus();
  const s = c.status;
  const showDemo = CHECKOUT_KIND === "demo" || (state.phase === "ready" && state.order.mode === "demo");
  // Polling failed after the order was shown: keep it on screen, say so, offer a refresh.
  const showOffline = connectionLost && state.phase === "ready";

  return (
    <>
      <SubHeader backHref={`${routes.home}#carta`} backLabel={s.backToMenu} />
      <main id="bc-main" className="bc-st">
        <h1 className="bc-co__title">{s.pageTitle}</h1>

        {(showDemo || showOffline) && (
          <div className="bc-notices">
            {showDemo && (
              <p className="bc-warn" role="note">
                {DEMO_NOTICE_TEXT[locale]}
              </p>
            )}
            {showOffline && (
              <div className="bc-warn bc-warn--error bc-warn--action" role="status">
                <p>{s.connectionLost}</p>
                <button type="button" className="bc-linkbtn" onClick={refresh}>
                  <ArrowClockwise size={18} weight="bold" aria-hidden />
                  {s.refresh}
                </button>
              </div>
            )}
          </div>
        )}

        {state.phase === "loading" && (
          <p className="bc-module" aria-busy="true" role="status">
            {s.loading}
          </p>
        )}

        {state.phase === "missing" && (
          <div className="bc-empty">
            <p className="bc-info__big">{s.missingTitle}</p>
            <p className="bc-help">{s.missingText}</p>
            <Link className="bc-linkbtn" href={routes.home}>
              {t.status.goToMenu}
            </Link>
          </div>
        )}

        {state.phase === "error" && (
          <div className="bc-empty" role="alert">
            <p className="bc-info__big">{state.error === "not-found" ? s.notFoundTitle : s.errorTitle}</p>
            <p className="bc-help">
              {state.error === "not-found" ? (isDemo ? s.notFoundDemo : s.notFoundReal) : s.errorText}
            </p>
            {state.error !== "not-found" && (
              <button type="button" className="bc-linkbtn" onClick={refresh}>
                {s.retry}
              </button>
            )}
          </div>
        )}

        {state.phase === "ready" && (
          <>
            <OrderTicket key={state.order.id} order={state.order} lastUpdated={lastUpdated} onRefresh={refresh} />
            {isDemo && simulateRestaurant && (
              <div className="bc-neutral">
                <DemoRestaurantSimulator order={state.order} onAction={simulateRestaurant} />
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function OrderTicket({
  order,
  lastUpdated,
  onRefresh,
}: {
  order: OrderSummary;
  lastUpdated: Date | null;
  onRefresh: () => void;
}) {
  const { locale, t, c } = useBento();
  const s = c.status;
  const v = ORDER_VIEW_TEXT[locale];
  const view = describeOrder(order, locale);
  const address = shangHaiRestaurant.address.value;
  const hasNumber = typeof order.number === "number";
  const readyAt = order.status === "ready" && order.readyAt ? v.readyAt(formatClock(order.readyAt, locale)) : null;
  // Only times the restaurant set (never an estimate of ours); before it decides, say when it will appear.
  const pickupTime = readyAt ?? view.eta?.text ?? (AWAITING_TIME.has(order.status) ? c.pickup.timeAfterAcceptance : null);

  return (
    <div className="bc-st__grid">
      <section className="bc-module bc-st__numbox" data-tone="butter" aria-labelledby="bc-st-number-label">
        <span id="bc-st-number-label" className="bc-label">
          {s.orderNumber}
        </span>
        <p className="bc-st__number" data-testid="order-number" data-short={hasNumber || undefined}>
          {hasNumber && <span className="bc-st__short">#{order.number}</span>}
          <span className="bc-st__id">
            {hasNumber && <span className="bc-st__ref">{t.status.reference} </span>}
            {order.id}
          </span>
        </p>
        <p style={{ fontWeight: 700, fontSize: 14.5 }}>
          {s.orderFor(order.customerName)} · {formatDayAndTime(order.createdAt, locale)}
        </p>
        <PickupSticker className="bc-st__sticker" label={t.entry.sticker} />
      </section>

      <section
        className="bc-module"
        aria-labelledby="bc-st-label"
        data-testid="order-status"
        data-status={order.status}
        data-payment-status={order.paymentStatus}
      >
        <div className="bc-st__now" aria-live="polite" aria-atomic="true">
          <span className="bc-label">{t.status.label}</span>
          <h2 id="bc-st-label" className="bc-st__label">
            {view.headline}
          </h2>
          <p style={{ fontWeight: 600 }}>{view.detail}</p>
          {view.eta && (
            <div className="bc-st__eta">
              <span className="bc-st__eta-label">{v.etaLabel}</span>
              <strong className="bc-st__eta-clock">{view.eta.clock}</strong>
              <span className="bc-st__eta-text">{v.etaSource(view.eta.minutes)}</span>
            </div>
          )}
          {view.rejectionReason && (
            <div className="bc-st__reason">
              <span className="bc-st__reason-label">{v.reasonLabel}</span>
              <p>“{view.rejectionReason}”</p>
            </div>
          )}
        </div>

        {view.steps && (
          <ol className="bc-progress" aria-label={v.progressLabel}>
            {view.steps.map((step) => (
              <li key={step.id} data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>
                <span className="bc-progress__dot" aria-hidden />
                {step.label}
              </li>
            ))}
          </ol>
        )}

        <div className="bc-st__pay" data-tone={view.payment.tone}>
          <span className="bc-st__pay-icon" aria-hidden>
            <CreditCard size={18} weight="bold" />
          </span>
          <div>
            <p className="bc-st__pay-label">
              <span className="bc-sr">{v.paymentLabel}: </span>
              {view.payment.label}
            </p>
            <p className="bc-st__pay-detail">{view.payment.detail}</p>
          </div>
        </div>

        {view.canRetryCheckout && (
          <Link className="bc-primary" href={routes.checkout} style={{ width: "auto" }}>
            {s.backToOrder}
          </Link>
        )}

        <div className="bc-st__sync">
          {lastUpdated && <span>{s.lastUpdate(formatClock(lastUpdated, locale))}</span>}
          <button type="button" className="bc-linkbtn" onClick={onRefresh}>
            <ArrowClockwise size={16} weight="bold" aria-hidden />
            {s.refresh}
          </button>
        </div>
        {!view.settled && <p className="bc-fine">{s.keepPageOpen}</p>}
      </section>

      <section className="bc-module" aria-labelledby="bc-st-lines">
        <h2 id="bc-st-lines" className="bc-module__title">
          {s.whatYouOrdered}
        </h2>
        <ul className="bc-sumlines">
          {order.lines.map((l) => {
            const options = lineOptionsLabel(l, locale);
            return (
              <li key={l.key}>
                <span className="bc-sumlines__q">
                  {l.quantity}
                  <span className="bc-sr">{t.checkout.unitsOf}</span>
                </span>
                <span className="bc-sumlines__n">
                  {lineName(l, locale)}
                  {options && <small>{options}</small>}
                </span>
                <span className="bc-sumlines__p">{formatMoney(l.lineTotalCents, locale)}</span>
              </li>
            );
          })}
        </ul>
        <div className="bc-sums">
          <div className="bc-sums__total">
            <span>{t.cart.total}</span>
            <strong>{formatMoney(order.totalCents, locale)}</strong>
          </div>
        </div>
      </section>

      <section className="bc-module" data-tone="lime" aria-labelledby="bc-st-pickup">
        <h2 id="bc-st-pickup" className="bc-module__title">
          {t.status.pickup}
        </h2>
        <p className="bc-info__big">
          {address.street}, {address.postalCode} {address.city}
        </p>
        {pickupTime && <p style={{ fontWeight: 600 }}>{pickupTime}</p>}
        <a className="bc-linkbtn" href={shangHaiRestaurant.directionsUrl} target="_blank" rel="noopener noreferrer">
          <MapPin size={18} weight="bold" aria-hidden />
          {c.restaurant.directions}
          <span className="bc-sr"> {c.restaurant.directionsHint}</span>
        </a>
      </section>
    </div>
  );
}
