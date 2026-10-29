"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatCents } from "@/lib/commerce/money";
import { QUOTE_ISSUE_COPY } from "@/lib/commerce/pricing";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { useCart } from "@/hooks/shang-hai/useCart";
import { useCheckoutForm } from "@/hooks/shang-hai/useCheckoutForm";
import { CHECKOUT_KIND } from "@/lib/shang-hai/checkout";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { DEMO_NOTICE } from "@/components/shang-hai/shared/StorefrontShell";
import { Monogram } from "./Navigation";

const ROUTES = storefrontRoutes("wok-after-dark");

export function SubpageBar({ back = "Volver a la carta" }: { back?: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-[var(--wok-line)] bg-[var(--wok-petrol)] px-3 sm:px-6 lg:h-16 lg:px-12">
      <Link href={ROUTES.home} className="flex min-w-0 items-center gap-2.5">
        <Monogram className="size-9 text-[1.15rem]" />
        <span className="wok-display truncate text-[1.6rem] leading-none">Shang Hai</span>
        <span className="wok-sr">, inicio de la carta</span>
      </Link>
      <Link
        href={ROUTES.home}
        className="wok-cond flex h-11 items-center px-2 text-[0.8125rem] text-[var(--wok-white)] underline decoration-[var(--wok-orange)] decoration-2 underline-offset-[6px] hover:text-[var(--wok-orange)]"
      >
        {back}
      </Link>
    </header>
  );
}

export function DemoStrip({ children }: { children?: React.ReactNode }) {
  if (CHECKOUT_KIND !== "demo") return null;
  return (
    <div role="note" className="border-2 border-[var(--wok-orange)] px-4 py-3 sm:flex sm:items-baseline sm:gap-4">
      <p className="wok-cond-tight text-[1rem] text-[var(--wok-orange)]">{DEMO_NOTICE}</p>
      {children && <p className="wok-muted mt-1 text-[0.875rem] sm:mt-0">{children}</p>}
    </div>
  );
}

function Field({
  name,
  label,
  error,
  hint,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="wok-field">
      <label htmlFor={`wok-${name}`}>{label}</label>
      {children}
      {hint && !error && (
        <p id={`wok-${name}-hint`} className="wok-muted mt-1.5 text-[0.8125rem]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`wok-${name}-error`} className="wok-error-text">
          {error}
        </p>
      )}
    </div>
  );
}

function StepTitle({ n, children, id }: { n: string; children: React.ReactNode; id: string }) {
  return (
    <h2 id={id} className="flex items-baseline gap-3 border-b-2 border-[var(--wok-metal)] pb-3">
      <span className="wok-display text-[2.75rem] text-[var(--wok-orange)]" aria-hidden>
        {n}
      </span>
      <span className="wok-display text-[2.75rem]">{children}</span>
    </h2>
  );
}

function TicketSummary() {
  const cart = useCart();
  const { quote } = cart;
  return (
    <div className="wok-paper wok-perf-top px-5 pb-5 pt-6">
      <p className="wok-display text-[2.25rem]">Tu ticket</p>
      <ul className="mt-3 border-t-2 border-dashed border-[rgba(16,30,36,0.32)]">
        {quote.lines.map((l) => (
          <li key={l.key} className="flex items-start justify-between gap-3 border-b-2 border-dashed border-[rgba(16,30,36,0.32)] py-3">
            <span className="min-w-0">
              <span className="wok-cond-tight block text-[0.9375rem] leading-tight">
                {l.quantity} × {l.name}
              </span>
              {l.optionsLabel && (
                <span className="mt-0.5 block text-[0.8125rem] text-[rgba(16,30,36,0.75)]">{l.optionsLabel}</span>
              )}
            </span>
            <span className="wok-nums shrink-0 text-[0.9375rem] font-semibold">{formatCents(l.lineTotalCents)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-end justify-between">
        <span className="wok-cond text-[0.8125rem]">Total</span>
        <span className="wok-total text-[2.75rem]">{formatCents(quote.totalCents)}</span>
      </div>
      <Link
        href={ROUTES.home + "#carta"}
        className="wok-cond mt-3 inline-flex h-11 items-center text-[0.75rem] text-[var(--wok-orange-deep)] underline decoration-2 underline-offset-4"
      >
        Editar el ticket en la carta
      </Link>
    </div>
  );
}

export function CheckoutView() {
  const params = useSearchParams();
  const cancelled = params.get("cancelado") === "1";
  const cart = useCart();
  const { values, errors, setField, submit, submitting, failureMessage, requiresAge, formRef } =
    useCheckoutForm();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const { quote } = cart;
  const addr = shangHaiRestaurant.address.value;
  const empty = cart.hydrated && quote.lines.length === 0;
  const describedBy = (name: string, hint = false) =>
    errors[name] ? `wok-${name}-error` : hint ? `wok-${name}-hint` : undefined;

  return (
    <>
      <SubpageBar />
      <main id="contenido" className="px-4 pb-24 pt-8 sm:px-6 lg:px-12 lg:pt-12">
        <p className="wok-cond text-[0.8125rem] text-[var(--wok-orange)]">Pedido para recoger</p>
        <h1 className="wok-display mt-3 text-[clamp(3.5rem,14vw,8.5rem)]">Pagar y recoger</h1>

        <div className="mt-6 grid max-w-[64rem] gap-3">
          <DemoStrip>El pago se simula y el pedido no se envía al restaurante.</DemoStrip>
          {cancelled && (
            <div role="status" className="bg-[var(--wok-petrol-2)] px-4 py-3">
              <p className="wok-cond-tight text-[1.0625rem]">Pago cancelado</p>
              <p className="wok-muted mt-1 text-[0.9375rem]">
                No se ha realizado ningún cargo. Tu ticket sigue aquí: puedes revisarlo y volver a intentarlo.
              </p>
            </div>
          )}
        </div>

        {!cart.hydrated ? (
          <p className="wok-muted mt-12" aria-live="polite">
            Cargando tu ticket…
          </p>
        ) : empty ? (
          <div className="mt-12 max-w-[40rem]">
            <p className="wok-display text-[3rem]">Tu ticket está vacío</p>
            <p className="wok-muted mt-3 text-[1.0625rem]">Añade algún plato desde la carta para hacer tu pedido.</p>
            <Link href={ROUTES.home + "#carta"} className="wok-btn wok-btn--hot mt-6 h-14 px-8">
              Ir a la carta
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
            <div className="lg:order-2">
              <div className="lg:sticky lg:top-24">
                <button
                  type="button"
                  className="wok-cond flex h-14 w-full items-center justify-between bg-[var(--wok-petrol-2)] px-4 text-[0.875rem] lg:hidden"
                  aria-expanded={summaryOpen}
                  aria-controls="wok-summary"
                  onClick={() => setSummaryOpen((v) => !v)}
                >
                  <span>
                    Tu ticket / {quote.itemCount} {quote.itemCount === 1 ? "producto" : "productos"}
                  </span>
                  <span className="wok-display text-[1.6rem] normal-case tracking-normal text-[var(--wok-orange)]">
                    {formatCents(quote.totalCents)}
                  </span>
                </button>
                <div id="wok-summary" className={summaryOpen ? "mt-3 block" : "hidden lg:block"}>
                  <TicketSummary />
                </div>
              </div>
            </div>

            <form
              ref={formRef}
              onSubmit={submit}
              noValidate
              aria-describedby={failureMessage ? "wok-form-failure" : undefined}
              className="min-w-0 lg:order-1"
            >
              <section aria-labelledby="wok-step-1">
                <StepTitle n="01" id="wok-step-1">
                  Tus datos
                </StepTitle>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field name="name" label="Nombre" error={errors.name}>
                      <input
                        id="wok-name"
                        name="name"
                        className="wok-input"
                        autoComplete="name"
                        value={values.name}
                        onChange={(e) => setField("name", e.target.value)}
                        aria-invalid={errors.name ? true : undefined}
                        aria-describedby={describedBy("name")}
                        aria-required="true"
                      />
                    </Field>
                  </div>
                  <Field name="phone" label="Teléfono" error={errors.phone} hint="Solo para avisarte si hay algún cambio.">
                    <input
                      id="wok-phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      className="wok-input wok-nums"
                      autoComplete="tel"
                      placeholder="612 345 678"
                      value={values.phone}
                      onChange={(e) => setField("phone", e.target.value)}
                      aria-invalid={errors.phone ? true : undefined}
                      aria-describedby={describedBy("phone", true)}
                      aria-required="true"
                    />
                  </Field>
                  <Field name="email" label="Correo electrónico" error={errors.email} hint="Te enviaremos la confirmación del pedido.">
                    <input
                      id="wok-email"
                      name="email"
                      type="email"
                      inputMode="email"
                      className="wok-input"
                      autoComplete="email"
                      placeholder="nombre@correo.es"
                      value={values.email}
                      onChange={(e) => setField("email", e.target.value)}
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={describedBy("email", true)}
                      aria-required="true"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field
                      name="notes"
                      label="Comentarios para la cocina (opcional)"
                      error={errors.notes}
                      hint="Por ejemplo: sin cebolla. Las alergias, consúltalas con el restaurante."
                    >
                      <textarea
                        id="wok-notes"
                        name="notes"
                        rows={3}
                        maxLength={300}
                        className="wok-input resize-y"
                        value={values.notes}
                        onChange={(e) => setField("notes", e.target.value)}
                        aria-invalid={errors.notes ? true : undefined}
                        aria-describedby={describedBy("notes", true)}
                      />
                    </Field>
                  </div>
                </div>
              </section>

              <section aria-labelledby="wok-step-2" className="mt-14">
                <StepTitle n="02" id="wok-step-2">
                  Recogida
                </StepTitle>
                <div className="mt-6 grid gap-px bg-[var(--wok-line)] sm:grid-cols-2">
                  <div className="bg-[var(--wok-petrol-2)] p-5">
                    <p className="wok-cond text-[0.75rem] text-[var(--wok-orange)]">Recogida en el local</p>
                    <p className="wok-cond-tight mt-2 text-[1.25rem] leading-tight">
                      {addr.street}
                      <br />
                      {addr.postalCode} {addr.city}
                    </p>
                    <p className="wok-muted mt-3 text-[0.9375rem]">El restaurante te confirmará la hora de recogida.</p>
                  </div>
                  <div className="bg-[var(--wok-petrol-2)] p-5">
                    <p className="wok-cond text-[0.75rem] text-[var(--wok-metal-light)]">Reparto a domicilio</p>
                    <p className="wok-muted mt-2 text-[0.9375rem]">
                      Todavía no disponible. De momento, solo pedidos para recoger.
                    </p>
                  </div>
                </div>
                {requiresAge && (
                  <div className="mt-6">
                    <label className="flex cursor-pointer items-start gap-4 bg-[var(--wok-petrol-2)] p-4">
                      <input
                        type="checkbox"
                        name="ageConfirmed"
                        className="wok-check mt-0.5"
                        checked={values.ageConfirmed}
                        onChange={(e) => setField("ageConfirmed", e.target.checked)}
                        aria-invalid={errors.ageConfirmed ? true : undefined}
                        aria-describedby={errors.ageConfirmed ? "wok-ageConfirmed-error" : undefined}
                      />
                      <span className="text-[0.9375rem] leading-snug">
                        Confirmo que soy mayor de 18 años. Tu pedido incluye bebidas alcohólicas y el restaurante
                        puede pedirte identificación al recoger.
                      </span>
                    </label>
                    {errors.ageConfirmed && (
                      <p id="wok-ageConfirmed-error" className="wok-error-text">
                        {errors.ageConfirmed}
                      </p>
                    )}
                  </div>
                )}
              </section>

              <section aria-labelledby="wok-step-3" className="mt-14">
                <StepTitle n="03" id="wok-step-3">
                  Pago
                </StepTitle>
                <p className="wok-muted mt-5 max-w-[46ch] text-[0.9375rem]">
                  {CHECKOUT_KIND === "demo"
                    ? "En esta demostración el pago se simula: no se pide ni se guarda ningún dato de tarjeta."
                    : "Pagarás en la página segura de Stripe. Shang Hai no recibe ni guarda los datos de tu tarjeta."}
                </p>
                {quote.issues.some((i) => i.code !== "empty") && (
                  <ul role="alert" className="wok-error-text mt-4 space-y-1">
                    {[...new Set(quote.issues.filter((i) => i.code !== "empty").map((i) => QUOTE_ISSUE_COPY[i.code]))].map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
                {failureMessage && (
                  <p id="wok-form-failure" role="alert" className="mt-5 border-l-4 border-[var(--wok-error)] bg-[var(--wok-petrol-2)] px-4 py-3 text-[0.9375rem]">
                    {failureMessage}
                  </p>
                )}
                <button
                  type="submit"
                  data-testid="checkout-pay"
                  disabled={submitting}
                  className="wok-btn wok-btn--hot mt-6 h-16 w-full justify-between px-6 text-[1.25rem] sm:max-w-[28rem]"
                >
                  <span>{submitting ? "Procesando…" : "Pagar"}</span>
                  <span className="wok-display text-[2rem] normal-case tracking-normal wok-nums">
                    {formatCents(quote.totalCents)}
                  </span>
                </button>
              </section>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
