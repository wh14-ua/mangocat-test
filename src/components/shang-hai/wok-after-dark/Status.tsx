"use client";

import Link from "next/link";
import type { OrderSummary } from "@/lib/commerce/types";
import type { DemoRestaurantAction } from "@/lib/commerce/checkout/gateway";
import { describeOrder, ORDER_VIEW_TEXT, type OrderTone, type OrderView } from "@/lib/commerce/order-view";
import { formatClock, formatMoney } from "@/lib/i18n/format";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { useOrderStatus } from "@/hooks/shang-hai/useOrderStatus";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { COMMON_TEXT } from "@/lib/shang-hai/i18n/common";
import { lineName, lineOptionsLabel } from "@/lib/shang-hai/menu-i18n";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { DemoRestaurantSimulator } from "@/components/shang-hai/shared/DemoRestaurantSimulator";
import { DemoStrip, SubpageBar } from "./Checkout";
import { useWokDocumentTitle, useWokText } from "./WokLanguage";

const ROUTES = storefrontRoutes("wok-after-dark");

/** Left rule of the payment line: metal while waiting, orange when settled well. */
const TONE_RULE: Record<OrderTone, string> = {
  waiting: "border-[var(--wok-metal)]",
  progress: "border-[var(--wok-metal)]",
  success: "border-[var(--wok-orange)]",
  negative: "border-[var(--wok-error)]",
  attention: "border-[var(--wok-heat)]",
};

/** Statuses still waiting for the restaurant to set a time. */
const AWAITING_TIME = new Set(["pending", "awaiting_acceptance", "accepting"]);

/**
 * The happy path as five heat segments; short Wok labels on screen, full labels for screen
 * readers. Done steps burn full; the step in progress burns half (waiting for acceptance
 * must not look accepted), except "ready", which is reached the moment it is current.
 */
function HeatBar({ steps }: { steps: NonNullable<OrderView["steps"]> }) {
  const { locale } = useLocale();
  const t = useWokText();
  return (
    <ol className="mt-8 grid grid-cols-5 gap-1.5" aria-label={ORDER_VIEW_TEXT[locale].progressLabel}>
      {steps.map((step) => {
        const lit = step.state !== "todo";
        const fill = step.state === "done" || (step.state === "current" && step.id === "ready") ? 1 : lit ? 0.5 : 0;
        return (
          <li key={step.id} aria-current={step.state === "current" ? "step" : undefined}>
            <span className="wok-heat-seg block" style={{ ["--fill" as string]: fill } as React.CSSProperties} />
            <span
              className={
                "wok-cond mt-2 block text-[0.6875rem] sm:text-[0.75rem] " +
                (lit ? "text-[var(--wok-white)]" : "text-[var(--wok-metal-light)]")
              }
            >
              <span aria-hidden>{t.status.steps[step.id]}</span>
              <span className="wok-sr">{`${step.label} (${t.status.stepState[step.state]})`}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderBody({
  order,
  simulateRestaurant,
  refresh,
  lastUpdated,
  connectionLost,
}: {
  order: OrderSummary;
  simulateRestaurant: ((action: DemoRestaurantAction) => Promise<void>) | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
  connectionLost: boolean;
}) {
  const { locale } = useLocale();
  const t = useWokText();
  const common = COMMON_TEXT[locale];
  const viewText = ORDER_VIEW_TEXT[locale];
  const view = describeOrder(order, locale);
  const addr = shangHaiRestaurant.address.value;
  // Only times the restaurant set: the ready time once it is ready, else its estimate.
  const readyAt = order.status === "ready" && order.readyAt ? viewText.readyAt(formatClock(order.readyAt, locale)) : null;
  const awaitingTime = !view.eta && AWAITING_TIME.has(order.status);

  return (
    <>
      {connectionLost && (
        <div
          role="status"
          className="mb-8 flex max-w-[44rem] flex-wrap items-center justify-between gap-x-4 gap-y-3 border-l-4 border-[var(--wok-heat)] bg-[var(--wok-petrol-2)] px-4 py-3"
        >
          <p className="min-w-0 flex-1 basis-[16rem] text-[0.9375rem] leading-snug">{common.status.connectionLost}</p>
          <button type="button" className="wok-btn wok-btn--line" onClick={() => void refresh()}>
            {common.status.retry}
          </button>
        </div>
      )}

      <section
        data-testid="order-status"
        data-status={order.status}
        data-payment-status={order.paymentStatus}
        aria-labelledby="wok-status-word"
        className="border-b-4 border-[var(--wok-orange)] pb-10"
      >
        <p className="wok-cond text-[0.8125rem] text-[var(--wok-metal-light)]">{t.status.order}</p>
        <p data-testid="order-number" className="wok-display mt-2 break-all text-[clamp(2.75rem,11vw,6.5rem)] wok-nums">
          {order.number != null ? (
            <>
              #{order.number}
              <span className="wok-cond mt-3 block font-[family-name:var(--wok-text)] text-[0.8125rem] leading-tight text-[var(--wok-metal-light)]">
                {order.id}
              </span>
            </>
          ) : (
            order.id
          )}
        </p>
        <h1
          id="wok-status-word"
          aria-live="polite"
          className={
            "wok-display mt-6 text-[clamp(3.5rem,18vw,12rem)] " +
            (view.steps ? "text-[var(--wok-orange)]" : "text-[var(--wok-white)]")
          }
        >
          {view.headline}
        </h1>
        <p className="mt-4 max-w-[44ch] text-[1.125rem] leading-snug">{view.detail}</p>

        {view.rejectionReason && (
          <div className="mt-6 max-w-[44rem] border-l-4 border-[var(--wok-error)] bg-[var(--wok-petrol-2)] px-4 py-3">
            <p className="wok-cond text-[0.75rem] text-[var(--wok-error)]">{viewText.reasonLabel}</p>
            <p className="mt-1.5 text-[1rem] leading-snug">{view.rejectionReason}</p>
          </div>
        )}

        {readyAt ? (
          <p className="wok-cond-tight mt-8 border-l-4 border-[var(--wok-orange)] pl-4 text-[1.375rem] leading-tight">
            {readyAt}
          </p>
        ) : view.eta ? (
          <div className="mt-8 border-l-4 border-[var(--wok-orange)] pl-4">
            <p className="wok-cond text-[0.8125rem] text-[var(--wok-metal-light)]">{viewText.etaLabel}</p>
            <p aria-hidden className="wok-display mt-2 text-[clamp(3.5rem,14vw,7rem)] wok-nums">
              {view.eta.clock}
            </p>
            <p className="mt-3 text-[1.125rem] leading-snug">{view.eta.text}</p>
            <p className="wok-muted mt-1 text-[0.875rem]">{viewText.etaSource(view.eta.minutes)}</p>
          </div>
        ) : null}

        {view.steps && <HeatBar steps={view.steps} />}

        <div
          data-testid="payment-status"
          className={`mt-8 max-w-[44rem] border-l-4 ${TONE_RULE[view.payment.tone]} bg-[var(--wok-petrol-2)] px-4 py-3`}
        >
          <p className="wok-cond text-[0.75rem] text-[var(--wok-metal-light)]">{viewText.paymentLabel}</p>
          <p className="wok-cond-tight mt-1 text-[1.25rem] leading-tight">{view.payment.label}</p>
          <p className="wok-muted mt-1 text-[0.9375rem] leading-snug">{view.payment.detail}</p>
        </div>

        {view.canRetryCheckout && (
          <Link href={ROUTES.checkout} className="wok-btn wok-btn--hot mt-8 h-14 px-8">
            {common.status.backToOrder}
          </Link>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-x-4">
          {lastUpdated && (
            <p className="wok-cond wok-nums text-[0.75rem] text-[var(--wok-metal-light)]">
              {common.status.lastUpdate(formatClock(lastUpdated, locale))}
            </p>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            className="wok-cond flex h-11 items-center text-[0.8125rem] text-[var(--wok-white)] underline decoration-[var(--wok-orange)] decoration-2 underline-offset-[6px] hover:text-[var(--wok-orange)]"
          >
            {common.status.refresh}
          </button>
        </div>
        {!view.settled && <p className="wok-muted text-[0.875rem]">{common.status.keepPageOpen}</p>}
      </section>

      {simulateRestaurant && <DemoRestaurantSimulator order={order} onAction={simulateRestaurant} />}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
        <section aria-labelledby="wok-status-lines" className="min-w-0">
          <h2 id="wok-status-lines" className="wok-display text-[2.75rem]">
            {t.status.ticket}
          </h2>
          <ul className="mt-4 border-t-2 border-dashed border-[var(--wok-metal)]">
            {order.lines.map((l) => {
              const options = lineOptionsLabel(l, locale);
              return (
                <li key={l.key} className="flex items-start justify-between gap-4 border-b-2 border-dashed border-[var(--wok-metal)] py-3">
                  <span className="min-w-0">
                    <span className="wok-cond-tight block text-[1rem] leading-tight">
                      {l.quantity} × {lineName(l, locale)}
                    </span>
                    {options && <span className="wok-muted mt-0.5 block text-[0.875rem]">{options}</span>}
                  </span>
                  <span className="wok-nums shrink-0 font-semibold">{formatMoney(l.lineTotalCents, locale)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex items-end justify-between">
            <span className="wok-cond text-[0.8125rem]">{t.status.total}</span>
            <span className="wok-display text-[3rem] text-[var(--wok-orange)] wok-nums">
              {formatMoney(order.totalCents, locale)}
            </span>
          </div>
        </section>
        <aside aria-label={t.status.pickupAside} className="bg-[var(--wok-petrol-2)] p-5 lg:p-6">
          <p className="wok-cond text-[0.75rem] text-[var(--wok-orange)]">{common.pickup.title}</p>
          <p className="wok-cond-tight mt-2 text-[1.375rem] leading-tight">
            {addr.street}
            <br />
            {addr.postalCode} {addr.city}
          </p>
          {awaitingTime && <p className="wok-muted mt-3 text-[0.9375rem]">{common.pickup.timeAfterAcceptance}</p>}
          <p className="wok-muted mt-3 text-[0.9375rem]">{common.status.orderFor(order.customerName)}.</p>
          <a
            href={shangHaiRestaurant.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="wok-btn wok-btn--line mt-5 w-full"
          >
            {common.restaurant.directions} <span className="wok-sr">{common.restaurant.directionsHint}</span>
          </a>
        </aside>
      </div>
    </>
  );
}

/** No order to show: a poster word plus the shared explanation of what happened. */
function StatusMessage({
  word,
  text,
  onRetry,
}: {
  word: string;
  text: string;
  onRetry?: () => void;
}) {
  const { locale } = useLocale();
  const common = COMMON_TEXT[locale];
  return (
    <div className="max-w-[42rem]">
      <h1 className="wok-display text-[clamp(3.5rem,14vw,8rem)]">{word}</h1>
      <p className="wok-muted mt-4 text-[1.0625rem]">{text}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {onRetry && (
          <button type="button" className="wok-btn wok-btn--hot" onClick={onRetry}>
            {common.status.retry}
          </button>
        )}
        <Link href={ROUTES.home} className="wok-btn wok-btn--line">
          {common.status.backToMenu}
        </Link>
      </div>
    </div>
  );
}

export function StatusView() {
  const { state, refresh, isDemo, simulateRestaurant, lastUpdated, connectionLost } = useOrderStatus();
  const { locale } = useLocale();
  const t = useWokText();
  const common = COMMON_TEXT[locale];
  useWokDocumentTitle(t.meta.status);
  const offline = state.phase === "error" && state.error !== "not-found";

  return (
    <>
      <SubpageBar />
      <main id="contenido" className="px-4 pb-24 pt-8 sm:px-6 lg:px-12 lg:pt-12">
        {isDemo && (
          <div className="mb-8 max-w-[64rem]">
            <DemoStrip>{t.status.demoNote}</DemoStrip>
          </div>
        )}
        {state.phase === "loading" && (
          <div aria-live="polite">
            <p aria-hidden className="wok-display text-[clamp(3rem,12vw,7rem)] text-[var(--wok-metal-light)]">
              {t.status.loadingWord}
            </p>
            <p className="wok-muted mt-4 text-[1.0625rem]">{common.status.loading}</p>
          </div>
        )}
        {state.phase === "missing" && (
          <StatusMessage word={t.status.notFound} text={`${common.status.missingTitle} ${common.status.missingText}`} />
        )}
        {state.phase === "error" &&
          (offline ? (
            <StatusMessage
              word={t.status.offline}
              text={`${common.status.errorTitle} ${common.status.errorText}`}
              onRetry={() => void refresh()}
            />
          ) : (
            <StatusMessage
              word={t.status.notFound}
              text={`${common.status.notFoundTitle} ${isDemo ? common.status.notFoundDemo : common.status.notFoundReal}`}
            />
          ))}
        {state.phase === "ready" && (
          <OrderBody
            order={state.order}
            simulateRestaurant={isDemo ? simulateRestaurant : null}
            refresh={refresh}
            lastUpdated={lastUpdated}
            connectionLost={connectionLost}
          />
        )}
      </main>
    </>
  );
}
