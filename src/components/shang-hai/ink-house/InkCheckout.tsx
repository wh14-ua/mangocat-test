"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/hooks/shang-hai/useCart";
import { useCheckoutForm, type CheckoutValues } from "@/hooks/shang-hai/useCheckoutForm";
import { formatCents } from "@/lib/commerce/money";
import { QUOTE_ISSUE_COPY } from "@/lib/commerce/pricing";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { CHECKOUT_KIND } from "@/lib/shang-hai/checkout";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { DEMO_NOTICE } from "@/components/shang-hai/shared/StorefrontShell";
import { Seal } from "./Seal";
import { useInkUI } from "./InkUI";

const routes = storefrontRoutes("ink-house");
const address = shangHaiRestaurant.address.value;

function CancelledNotice() {
  const params = useSearchParams();
  if (params.get("cancelado") !== "1") return null;
  return (
    <div className="ink-note ink-note--lacquer" role="status">
      <p>
        <strong>Pago cancelado.</strong> No se ha cobrado nada y tu pedido sigue aquí: revisa los datos y
        vuelve a intentarlo cuando quieras.
      </p>
    </div>
  );
}

export function DemoStamp({ children }: { children?: React.ReactNode }) {
  if (CHECKOUT_KIND !== "demo") return null;
  return (
    <div className="ink-demo-stamp" role="note">
      <Seal className="ink-demo-stamp__seal" />
      <div>
        <p className="ink-demo-stamp__title">{DEMO_NOTICE}</p>
        {children && <p className="ink-demo-stamp__text">{children}</p>}
      </div>
    </div>
  );
}

type FieldProps = {
  name: keyof Omit<CheckoutValues, "ageConfirmed">;
  label: string;
  value: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  multiline?: boolean;
  onChange: (value: string) => void;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
};

function Field({ name, label, value, error, hint, optional, multiline, onChange, inputProps }: FieldProps) {
  const id = `ink-f-${name}`;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="ink-field" data-invalid={error ? "" : undefined}>
      <label htmlFor={id} className="ink-field__label">
        {label}
        {optional && <span className="ink-field__optional"> (opcional)</span>}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name={name}
          className="ink-field__input ink-field__input--area"
          rows={3}
          maxLength={300}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          name={name}
          className="ink-field__input"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          {...inputProps}
        />
      )}
      {hint && (
        <p id={`${id}-hint`} className="ink-field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="ink-field__error">
          {error}
        </p>
      )}
    </div>
  );
}

export function InkCheckout() {
  const cart = useCart();
  const ui = useInkUI();
  const {
    values,
    errors,
    setField,
    submit,
    submitting,
    failure,
    failureMessage,
    requiresAge,
    formRef,
  } = useCheckoutForm();
  const { quote } = cart;

  return (
    <div className="ink-checkout">
      <header className="ink-checkout__head">
        <p className="ink-kicker">Pedido para recoger</p>
        <h1 className="ink-checkout__title">Completa tu pedido</h1>
        <Suspense fallback={null}>
          <CancelledNotice />
        </Suspense>
      </header>

      {!cart.hydrated ? (
        <div className="ink-checkout__loading" aria-busy="true">
          <p>Preparando tu pedido…</p>
        </div>
      ) : cart.lines.length === 0 ? (
        <div className="ink-checkout__empty">
          <p className="ink-checkout__empty-title">Tu pedido está vacío.</p>
          <p>Elige tus platos en la carta y vuelve aquí para pagar y recogerlos.</p>
          <Link href={`${routes.home}#carta`} className="ink-button ink-button--ink">
            Ir a la carta
          </Link>
        </div>
      ) : (
        <div className="ink-checkout__grid">
          <form ref={formRef} noValidate onSubmit={submit} className="ink-form">
            <DemoStamp>Al pagar verás un simulador: no se pide ni se guarda ninguna tarjeta.</DemoStamp>

            <fieldset className="ink-step">
              <legend className="ink-step__legend">
                <span className="ink-step__num" aria-hidden="true">
                  1
                </span>
                Tus datos
              </legend>
              <Field
                name="name"
                label="Nombre"
                value={values.name}
                error={errors.name}
                onChange={(v) => setField("name", v)}
                inputProps={{ autoComplete: "name", autoCapitalize: "words", enterKeyHint: "next" }}
              />
              <Field
                name="phone"
                label="Teléfono"
                value={values.phone}
                error={errors.phone}
                hint="Solo para avisarte si hay algo que confirmar del pedido."
                onChange={(v) => setField("phone", v)}
                inputProps={{ type: "tel", inputMode: "tel", autoComplete: "tel", enterKeyHint: "next" }}
              />
              <Field
                name="email"
                label="Correo electrónico"
                value={values.email}
                error={errors.email}
                hint="Te enviaremos la confirmación del pedido."
                onChange={(v) => setField("email", v)}
                inputProps={{
                  type: "email",
                  inputMode: "email",
                  autoComplete: "email",
                  autoCapitalize: "none",
                  spellCheck: false,
                  enterKeyHint: "next",
                }}
              />
              <Field
                name="notes"
                label="Comentarios para la cocina"
                optional
                multiline
                value={values.notes}
                error={errors.notes}
                hint="Por ejemplo: sin cebolla. Si tienes alergias, llama antes al restaurante."
                onChange={(v) => setField("notes", v)}
              />
            </fieldset>

            <fieldset className="ink-step">
              <legend className="ink-step__legend">
                <span className="ink-step__num" aria-hidden="true">
                  2
                </span>
                Recogida
              </legend>
              <p className="ink-step__place">
                {address.street}
                <br />
                {address.postalCode} {address.city}
              </p>
              <p className="ink-step__text">
                El restaurante te confirmará la hora de recogida. El reparto a domicilio todavía no está
                disponible en este canal.
              </p>
            </fieldset>

            <fieldset className="ink-step">
              <legend className="ink-step__legend">
                <span className="ink-step__num" aria-hidden="true">
                  3
                </span>
                Pago
              </legend>

              {requiresAge && (
                <div className="ink-check" data-invalid={errors.ageConfirmed ? "" : undefined}>
                  <input
                    id="ink-f-age"
                    type="checkbox"
                    name="ageConfirmed"
                    checked={values.ageConfirmed}
                    aria-invalid={errors.ageConfirmed ? true : undefined}
                    aria-describedby={errors.ageConfirmed ? "ink-f-age-err" : undefined}
                    onChange={(e) => setField("ageConfirmed", e.target.checked)}
                  />
                  <label htmlFor="ink-f-age">
                    Tengo 18 años o más. El pedido incluye bebidas alcohólicas y el restaurante puede
                    pedirme un documento al recoger.
                  </label>
                  {errors.ageConfirmed && (
                    <p id="ink-f-age-err" className="ink-field__error">
                      {errors.ageConfirmed}
                    </p>
                  )}
                </div>
              )}

              {failureMessage && (
                <div className="ink-alert" role="alert">
                  <p>{failureMessage}</p>
                  {failure?.error === "not-payable" && failure.issues[0] && (
                    <p>{QUOTE_ISSUE_COPY[failure.issues[0].code]}</p>
                  )}
                </div>
              )}

              <button
                type="submit"
                data-testid="checkout-pay"
                className="ink-button ink-button--lacquer ink-button--pay"
                disabled={submitting}
                aria-busy={submitting || undefined}
              >
                {submitting ? "Preparando el pago…" : `Pagar ${formatCents(quote.totalCents)}`}
              </button>
              <p className="ink-step__text">
                {CHECKOUT_KIND === "demo"
                  ? "Esto es una demostración: el pago es simulado y el pedido no llega al restaurante."
                  : "Te llevaremos a la página de pago segura de Stripe. No guardamos los datos de tu tarjeta."}
              </p>
            </fieldset>
          </form>

          <aside className="ink-comanda" aria-labelledby="ink-comanda-title">
            <div className="ink-comanda__head">
              <h2 id="ink-comanda-title" className="ink-comanda__title">
                Tu pedido
              </h2>
              <button type="button" className="ink-text-button" onClick={ui.openCart}>
                Editar
              </button>
            </div>
            <ul className="ink-comanda__lines">
              {quote.lines.map((line) => (
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
              <dd>{formatCents(quote.totalCents)}</dd>
            </dl>
          </aside>
        </div>
      )}
    </div>
  );
}
