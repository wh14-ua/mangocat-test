"use client";

import { useState } from "react";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { defineMessages } from "@/lib/i18n/locale";
import type { DemoRestaurantAction } from "@/lib/commerce/checkout/gateway";
import type { OrderSummary } from "@/lib/commerce/types";

/** Same choices as the staff panel (the staff picks; nothing here is a promise). */
export const DEMO_PREP_OPTIONS = [15, 20, 30, 45] as const;

const TEXT = defineMessages({
  es: {
    title: "Simulador del restaurante",
    badge: "Solo demostración",
    intro: "En el servicio real, estas decisiones las toma el restaurante desde su panel en el móvil.",
    acceptWith: "Aceptar · tiempo de preparación",
    minutes: (m: number) => `${m} min`,
    reject: "Rechazar pedido",
    confirmReject: "Confirmar rechazo",
    reasonLabel: "Motivo para el cliente (opcional)",
    reasonPlaceholder: "Por ejemplo: cocina cerrada",
    ready: "Marcar como listo",
    complete: "Marcar como entregado",
    nothing: "No hay más acciones para este pedido.",
    working: "Aplicando…",
  },
  en: {
    title: "Restaurant simulator",
    badge: "Demo only",
    intro: "In the real service, the restaurant makes these decisions from its panel on a phone.",
    acceptWith: "Accept · preparation time",
    minutes: (m: number) => `${m} min`,
    reject: "Decline order",
    confirmReject: "Confirm decline",
    reasonLabel: "Reason for the customer (optional)",
    reasonPlaceholder: "For example: kitchen closed",
    ready: "Mark as ready",
    complete: "Mark as collected",
    nothing: "No more actions for this order.",
    working: "Applying…",
  },
});

const BUTTON =
  "min-h-11 rounded-lg px-3 text-[14px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8] disabled:opacity-60";

/**
 * DEMO MODE only: lets whoever is presenting play the restaurant's part on the status
 * page. Deliberately styled outside the three identities (system font, neutral greys), like
 * the MangoCat presentation bar. Never rendered against the real order API.
 */
export function DemoRestaurantSimulator({
  order,
  onAction,
}: {
  order: OrderSummary;
  onAction: (action: DemoRestaurantAction) => Promise<void>;
}) {
  const { locale } = useLocale();
  const t = TEXT[locale];
  const [working, setWorking] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function run(action: DemoRestaurantAction) {
    setWorking(true);
    try {
      await onAction(action);
    } finally {
      setWorking(false);
      setRejecting(false);
    }
  }

  const canDecide = order.status === "awaiting_acceptance";
  const canReject = canDecide || order.status === "preparing" || order.status === "ready";

  return (
    <section
      aria-labelledby="demo-restaurant-title"
      data-testid="demo-restaurant"
      className="my-6 rounded-xl border-2 border-dashed border-[#98a2b3] bg-[#f8f9fb] p-4 text-[#1d2939] sm:p-5"
      style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", lineHeight: 1.45 }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="demo-restaurant-title" className="text-[16px] font-bold" style={{ fontFamily: "inherit", color: "inherit" }}>
          {t.title}
        </h2>
        <span className="rounded-full bg-[#fff6d6] px-2 py-0.5 text-[12px] font-semibold text-[#5c4300]">{t.badge}</span>
      </div>
      <p className="mt-1 text-[13px] text-[#475467]">{t.intro}</p>

      {canDecide && (
        <div className="mt-3">
          <p className="text-[13px] font-semibold">{t.acceptWith}</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {DEMO_PREP_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={working}
                data-testid={`demo-accept-${m}`}
                onClick={() => run({ type: "accept", prepMinutes: m })}
                className={`${BUTTON} bg-[#1a7f37] text-white hover:bg-[#166b2f]`}
              >
                {t.minutes(m)}
              </button>
            ))}
          </div>
        </div>
      )}

      {order.status === "preparing" && (
        <button
          type="button"
          disabled={working}
          data-testid="demo-ready"
          onClick={() => run({ type: "ready" })}
          className={`${BUTTON} mt-3 w-full bg-[#1d4ed8] text-white hover:bg-[#1e40af]`}
        >
          {t.ready}
        </button>
      )}

      {order.status === "ready" && (
        <button
          type="button"
          disabled={working}
          data-testid="demo-complete"
          onClick={() => run({ type: "complete" })}
          className={`${BUTTON} mt-3 w-full bg-[#1d2939] text-white hover:bg-black`}
        >
          {t.complete}
        </button>
      )}

      {canReject && !rejecting && (
        <button
          type="button"
          disabled={working}
          data-testid="demo-reject"
          onClick={() => setRejecting(true)}
          className={`${BUTTON} mt-2 w-full border border-[#d0d5dd] bg-white text-[#b42318] hover:bg-[#fef3f2]`}
        >
          {t.reject}
        </button>
      )}

      {canReject && rejecting && (
        <div className="mt-3 grid gap-2">
          <label className="text-[13px] font-semibold" htmlFor="demo-reject-reason">
            {t.reasonLabel}
          </label>
          <input
            id="demo-reject-reason"
            value={reason}
            maxLength={200}
            placeholder={t.reasonPlaceholder}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-11 rounded-lg border border-[#d0d5dd] bg-white px-3 text-[15px]"
          />
          <button
            type="button"
            disabled={working}
            data-testid="demo-reject-confirm"
            onClick={() => run({ type: "reject", reason })}
            className={`${BUTTON} bg-[#b42318] text-white hover:bg-[#912018]`}
          >
            {working ? t.working : t.confirmReject}
          </button>
        </div>
      )}

      {!canDecide && !canReject && order.status !== "preparing" && order.status !== "ready" && (
        <p className="mt-3 text-[13px] text-[#475467]">{t.nothing}</p>
      )}
    </section>
  );
}
