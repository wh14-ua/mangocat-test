"use client";

import Link from "next/link";
import { useOrderStatus } from "@/hooks/shang-hai/useOrderStatus";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import type { DemoRestaurantAction } from "@/lib/commerce/checkout/gateway";
import { describeOrder, ORDER_VIEW_TEXT, type OrderView } from "@/lib/commerce/order-view";
import type { OrderStatus, OrderSummary } from "@/lib/commerce/types";
import { formatClock, formatDayAndTime, formatMoney } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locale";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { COMMON_TEXT } from "@/lib/shang-hai/i18n/common";
import { INK_TEXT } from "@/lib/shang-hai/i18n/ink-house";
import { lineName, lineOptionsLabel } from "@/lib/shang-hai/menu-i18n";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { DemoRestaurantSimulator } from "@/components/shang-hai/shared/DemoRestaurantSimulator";
import { Seal } from "./Seal";
import { DemoStamp } from "./InkCheckout";

const routes = storefrontRoutes("ink-house");
const address = shangHaiRestaurant.address.value;

/** The existing timeline styles name the last state "upcoming". */
const STEP_STATE = { done: "done", current: "current", todo: "upcoming" } as const;

/** Statuses on which the receipt is headed with a thank-you. */
const THANKED: OrderStatus[] = ["awaiting_acceptance", "accepting", "preparing", "ready", "completed", "needs_review"];

/** Statuses before the restaurant has decided (the pickup time comes with its acceptance). */
const BEFORE_DECISION: OrderStatus[] = ["pending", "awaiting_acceptance", "accepting"];

/** The seal is pressed once the money is really taken for an order the restaurant keeps. */
function isSealed(order: OrderSummary): boolean {
  return (
    order.paymentStatus === "captured" &&
    ["awaiting_acceptance", "accepting", "preparing", "ready", "completed"].includes(order.status)
  );
}

export function InkStatusSkeleton() {
  const { locale } = useLocale();
  return (
    <div className="ink-receipt-wrap">
      <div className="ink-receipt" aria-busy="true">
        <p className="ink-kicker">{INK_TEXT[locale].status.kicker}</p>
        <p className="ink-receipt__loading">{COMMON_TEXT[locale].status.loading}</p>
      </div>
    </div>
  );
}

export function InkStatus() {
  const { state, refresh, isDemo, simulateRestaurant, lastUpdated, connectionLost } = useOrderStatus();
  const { locale } = useLocale();
  const t = INK_TEXT[locale].status;
  const common = COMMON_TEXT[locale].status;

  if (state.phase === "loading") return <InkStatusSkeleton />;

  if (state.phase === "missing" || state.phase === "error") {
    const missing = state.phase === "missing";
    const notFound = !missing && state.error === "not-found";
    const title = missing ? common.missingTitle : notFound ? common.notFoundTitle : common.errorTitle;
    const lead = missing
      ? common.missingText
      : notFound
        ? isDemo
          ? common.notFoundDemo
          : common.notFoundReal
        : common.errorText;
    return (
      <div className="ink-receipt-wrap">
        <div className="ink-receipt">
          <p className="ink-kicker">{t.kicker}</p>
          <h1 className="ink-receipt__title">{title}</h1>
          <p className="ink-receipt__lead">{lead}</p>
          <div className="ink-receipt__actions">
            {!missing && !notFound && (
              <button type="button" className="ink-button ink-button--ink" onClick={refresh}>
                {common.retry}
              </button>
            )}
            <Link href={routes.home} className="ink-button ink-button--quiet">
              {common.backToMenu}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Receipt
      order={state.order}
      locale={locale}
      isDemo={isDemo}
      onSimulate={simulateRestaurant}
      lastUpdated={lastUpdated}
      connectionLost={connectionLost}
      onRefresh={refresh}
    />
  );
}

function Receipt({
  order,
  locale,
  isDemo,
  onSimulate,
  lastUpdated,
  connectionLost,
  onRefresh,
}: {
  order: OrderSummary;
  locale: Locale;
  isDemo: boolean;
  onSimulate: ((action: DemoRestaurantAction) => Promise<void>) | null;
  lastUpdated: Date | null;
  connectionLost: boolean;
  onRefresh: () => void;
}) {
  const ink = INK_TEXT[locale];
  const t = ink.status;
  const common = COMMON_TEXT[locale];
  const viewText = ORDER_VIEW_TEXT[locale];
  const view = describeOrder(order, locale);
  const itemCount = order.lines.reduce((n, l) => n + l.quantity, 0);
  const title =
    order.status === "pending" ? t.waitingPayment : THANKED.includes(order.status) ? t.thanks : common.status.pageTitle;
  const readyAt = order.status === "ready" && order.readyAt ? formatClock(order.readyAt, locale) : null;

  return (
    <div className="ink-receipt-wrap">
      <article className="ink-receipt" aria-labelledby="ink-receipt-title">
        <header className="ink-receipt__head">
          <div>
            <p className="ink-kicker">{t.kicker}</p>
            <h1 id="ink-receipt-title" className="ink-receipt__title">
              {title}
            </h1>
            <p className="ink-receipt__number">
              {t.order}{" "}
              <span data-testid="order-number">
                {order.number ? (
                  <>
                    <span className="ink-receipt__short">#{order.number}</span>
                    <span className="ink-receipt__id"> · {order.id}</span>
                  </>
                ) : (
                  order.id
                )}
              </span>
            </p>
            <p className="ink-receipt__date">{formatDayAndTime(order.createdAt, locale)}</p>
          </div>
          {isSealed(order) && <Seal className="ink-receipt__seal" label={t.sealLabel} />}
        </header>

        <div
          className="ink-receipt__status"
          data-testid="order-status"
          data-status={order.status}
          data-payment-status={order.paymentStatus}
          data-tone={view.tone}
          aria-live="polite"
        >
          <p className="ink-receipt__status-label">{view.headline}</p>
          <p className="ink-receipt__status-detail">{view.detail}</p>
          {view.rejectionReason && (
            <p className="ink-receipt__reason">
              <span className="ink-receipt__h">{viewText.reasonLabel}</span>
              {/* The restaurant's own words, quoted as written. */}
              {locale === "es" ? `«${view.rejectionReason}»` : `“${view.rejectionReason}”`}
            </p>
          )}
          {readyAt ? (
            <p className="ink-receipt__eta">
              <span className="ink-receipt__h">{viewText.readyAt(readyAt)}</span>
            </p>
          ) : (
            view.eta && (
              <p className="ink-receipt__eta">
                <span className="ink-receipt__h">{viewText.etaLabel}</span>
                <span className="ink-receipt__eta-clock">{view.eta.clock}</span>
                <span className="ink-receipt__muted">{viewText.etaSource(view.eta.minutes)}</span>
              </p>
            )
          )}
        </div>

        <PaymentLine view={view} label={viewText.paymentLabel} />

        <Freshness
          locale={locale}
          view={view}
          lastUpdated={lastUpdated}
          connectionLost={connectionLost}
          onRefresh={onRefresh}
        />

        {view.steps ? (
          <ol className="ink-timeline" aria-label={viewText.progressLabel}>
            {view.steps.map((step) => (
              <li key={step.id} className="ink-timeline__step" data-state={STEP_STATE[step.state]}>
                <span className="ink-timeline__mark" aria-hidden="true" />
                <span>{step.label}</span>
                <span className="ink-sr-only">{t.stepState[step.state]}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="ink-receipt__off-path">
            {view.canRetryCheckout ? (
              <Link href={routes.checkout} className="ink-button ink-button--lacquer">
                {common.status.backToOrder}
              </Link>
            ) : (
              (order.status === "rejected" || order.status === "cancelled") && (
                <Link href={routes.home} className="ink-button ink-button--ink">
                  {t.newOrder}
                </Link>
              )
            )}
          </div>
        )}

        {isDemo && <DemoStamp>{t.demoNote}</DemoStamp>}
        {isDemo && onSimulate && <DemoRestaurantSimulator order={order} onAction={onSimulate} />}

        <section className="ink-receipt__section" aria-labelledby="ink-receipt-lines">
          <h2 id="ink-receipt-lines" className="ink-receipt__h">
            {t.items(itemCount)}
          </h2>
          <ul className="ink-comanda__lines">
            {order.lines.map((line) => {
              const optionsLabel = lineOptionsLabel(line, locale);
              return (
                <li key={line.key}>
                  <span className="ink-comanda__qty">{line.quantity} ×</span>
                  <span className="ink-comanda__name">
                    {lineName(line, locale)}
                    {optionsLabel && <span className="ink-comanda__opt">{optionsLabel}</span>}
                  </span>
                  <span className="ink-comanda__price">{formatMoney(line.lineTotalCents, locale)}</span>
                </li>
              );
            })}
          </ul>
          <dl className="ink-total ink-total--comanda">
            <dt>{ink.total}</dt>
            <dd>{formatMoney(order.totalCents, locale)}</dd>
          </dl>
        </section>

        <section className="ink-receipt__section" aria-labelledby="ink-receipt-pickup">
          <h2 id="ink-receipt-pickup" className="ink-receipt__h">
            {t.pickup}
          </h2>
          <p>
            {address.street}, {address.postalCode} {address.city}
          </p>
          {view.eta && order.status === "preparing" ? (
            <p className="ink-receipt__muted">{view.eta.text}</p>
          ) : (
            BEFORE_DECISION.includes(order.status) && (
              <p className="ink-receipt__muted">{common.pickup.howItWorks}</p>
            )
          )}
        </section>

        <footer className="ink-receipt__actions">
          <Link href={routes.home} className="ink-button ink-button--quiet">
            {common.status.backToMenu}
          </Link>
        </footer>
      </article>
    </div>
  );
}

/** Money is its own line: an authorisation is never shown as a charge. */
function PaymentLine({ view, label }: { view: OrderView; label: string }) {
  return (
    <div className="ink-receipt__payment" data-tone={view.payment.tone} aria-live="polite">
      <p className="ink-receipt__h">{label}</p>
      <p className="ink-receipt__payment-label">{view.payment.label}</p>
      <p className="ink-receipt__muted">{view.payment.detail}</p>
    </div>
  );
}

function Freshness({
  locale,
  view,
  lastUpdated,
  connectionLost,
  onRefresh,
}: {
  locale: Locale;
  view: OrderView;
  lastUpdated: Date | null;
  connectionLost: boolean;
  onRefresh: () => void;
}) {
  const common = COMMON_TEXT[locale].status;
  if (connectionLost) {
    return (
      <div className="ink-note ink-note--lacquer ink-receipt__offline" role="status">
        <p>
          {common.connectionLost}
          {lastUpdated && <> {common.lastUpdate(formatClock(lastUpdated, locale))}.</>}
        </p>
        <button type="button" className="ink-text-button" onClick={onRefresh}>
          {common.refresh}
        </button>
      </div>
    );
  }
  if (!lastUpdated) return null;
  return (
    <p className="ink-receipt__fresh">
      {common.lastUpdate(formatClock(lastUpdated, locale))}
      {!view.settled && <> · {common.keepPageOpen}</>}
    </p>
  );
}
