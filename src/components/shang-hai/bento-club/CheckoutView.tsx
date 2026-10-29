"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, MapPin } from "@phosphor-icons/react/dist/ssr";
import { DEMO_NOTICE } from "@/components/shang-hai/shared/StorefrontShell";
import { useCart } from "@/hooks/shang-hai/useCart";
import { useCheckoutForm, type CheckoutValues } from "@/hooks/shang-hai/useCheckoutForm";
import { formatCents } from "@/lib/commerce/money";
import { QUOTE_ISSUE_COPY } from "@/lib/commerce/pricing";
import { validateCustomer } from "@/lib/commerce/validation";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { CHECKOUT_KIND } from "@/lib/shang-hai/checkout";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { EmptyTrayArt } from "./Graphics";

const routes = storefrontRoutes("bento-club");

export function SubHeader({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <header className="bc-subhead">
      <Link className="bc-back" href={backHref}>
        <ArrowLeft size={18} weight="bold" aria-hidden />
        {backLabel}
      </Link>
      <Link className="bc-subhead__brand" href={routes.home}>
        SHANG HAI
        <small>Restaurante Asiático · Orihuela</small>
      </Link>
    </header>
  );
}

type FieldProps = {
  name: keyof Omit<CheckoutValues, "ageConfirmed">;
  label: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  hint?: string;
  optional?: boolean;
  textarea?: boolean;
  maxLength?: number;
};

function Field(p: FieldProps) {
  const id = `bc-f-${p.name}`;
  const errId = `bc-err-${p.name}`;
  const hintId = p.hint ? `bc-hint-${p.name}` : undefined;
  const describedBy = [p.error ? errId : null, hintId].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name: p.name,
    value: p.value,
    className: "bc-input",
    "aria-invalid": p.error ? ("true" as const) : undefined,
    "aria-describedby": describedBy,
  };
  return (
    <div className="bc-field">
      <label className="bc-label" htmlFor={id}>
        {p.label}
        {p.optional && <small> (opcional)</small>}
      </label>
      {p.textarea ? (
        <textarea {...common} rows={3} maxLength={p.maxLength} onChange={(e) => p.onChange(e.target.value)} />
      ) : (
        <input
          {...common}
          type={p.type ?? "text"}
          autoComplete={p.autoComplete}
          inputMode={p.inputMode}
          onChange={(e) => p.onChange(e.target.value)}
        />
      )}
      {p.hint && (
        <p id={hintId} className="bc-help">
          {p.hint}
        </p>
      )}
      {p.error && (
        <p id={errId} className="bc-error">
          {p.error}
        </p>
      )}
    </div>
  );
}

/** Checkout as four stacked compartments, with a tape-style progress strip. */
export function CheckoutView() {
  const params = useSearchParams();
  const cancelled = params.get("cancelado") === "1";
  const cart = useCart();
  const {
    values,
    errors,
    setField,
    submit,
    submitting,
    failureMessage,
    requiresAge,
    formRef,
    quote,
  } = useCheckoutForm();
  const a = shangHaiRestaurant.address.value;
  const empty = cart.hydrated && cart.lines.length === 0;

  const detailsDone = validateCustomer(values, cart.limits).ok;
  const steps = [
    { label: "Datos", done: detailsDone },
    { label: "Recogida", done: true },
    { label: "Pedido", done: quote.payable },
    { label: "Pago", done: false },
  ];
  const blocking = quote.issues.filter((i) => i.code !== "empty");

  return (
    <>
      <SubHeader backHref={`${routes.home}#carta`} backLabel="Seguir pidiendo" />
      <main id="bc-main" className="bc-co">
        <h1 className="bc-co__title">Tu pedido para recoger</h1>

        <ol className="bc-tape" aria-label="Pasos del pedido">
          {steps.map((s, i) => (
            <li key={s.label} className="bc-tape__step" data-done={s.done || undefined}>
              <span className="bc-tape__mark" aria-hidden>
                {s.done ? <Check size={14} weight="bold" /> : i + 1}
              </span>
              {s.label}
              {s.done && <span className="bc-sr"> (completado)</span>}
            </li>
          ))}
        </ol>

        <div className="bc-notices">
          {CHECKOUT_KIND === "demo" && (
            <p className="bc-warn" role="note">
              {DEMO_NOTICE}
            </p>
          )}
          {cancelled && (
            <p className="bc-warn bc-warn--cancel" role="status">
              Pago cancelado. Tu pedido sigue aquí: revísalo y vuelve a intentarlo cuando quieras.
            </p>
          )}
          {failureMessage && (
            <p className="bc-warn bc-warn--error" role="alert">
              {failureMessage}
            </p>
          )}
        </div>

        {!cart.hydrated ? (
          <p className="bc-module" aria-busy="true">
            Cargando tu pedido…
          </p>
        ) : empty ? (
          <div className="bc-empty">
            <EmptyTrayArt className="bc-empty__art" />
            <p className="bc-info__big">Tu pedido está vacío.</p>
            <p className="bc-help">Elige platos en la carta y vuelve aquí para pagar.</p>
            <Link className="bc-primary" href={`${routes.home}#carta`} style={{ width: "auto" }}>
              Ir a la carta
            </Link>
          </div>
        ) : (
          <form ref={formRef} onSubmit={submit} noValidate className="bc-co__grid">
            <div className="bc-co__col">
              <section className="bc-module" aria-labelledby="bc-m1">
                <div className="bc-module__head">
                  <span className="bc-module__num" aria-hidden>
                    1
                  </span>
                  <h2 id="bc-m1" className="bc-module__title">
                    Tus datos
                  </h2>
                </div>
                <Field
                  name="name"
                  label="Nombre"
                  value={values.name}
                  error={errors.name}
                  onChange={(v) => setField("name", v)}
                  autoComplete="name"
                />
                <Field
                  name="phone"
                  label="Teléfono"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={values.phone}
                  error={errors.phone}
                  onChange={(v) => setField("phone", v)}
                  hint="Solo para avisarte si hay algo que confirmar del pedido."
                />
                <Field
                  name="email"
                  label="Correo electrónico"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={values.email}
                  error={errors.email}
                  onChange={(v) => setField("email", v)}
                  hint="Te enviaremos la confirmación del pedido."
                />
                <Field
                  name="notes"
                  label="Comentarios para la cocina"
                  optional
                  textarea
                  maxLength={cart.limits.maxNotesLength}
                  value={values.notes}
                  error={errors.notes}
                  onChange={(v) => setField("notes", v)}
                  hint="Por ejemplo: sin cebolla. Si tienes alergias, llama al restaurante antes de pedir."
                />
              </section>

              <section className="bc-module" data-tone="lime" aria-labelledby="bc-m2">
                <div className="bc-module__head">
                  <span className="bc-module__num" aria-hidden>
                    2
                  </span>
                  <h2 id="bc-m2" className="bc-module__title">
                    Recogida
                  </h2>
                </div>
                <div className="bc-pickup">
                  <span style={{ fontWeight: 800, fontSize: 13.5 }}>Recoges en el local</span>
                  <strong>
                    {a.street}, {a.postalCode} {a.city}
                  </strong>
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>
                    El restaurante te confirmará la hora de recogida.
                  </span>
                </div>
                <a
                  className="bc-linkbtn"
                  href={shangHaiRestaurant.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin size={18} weight="bold" aria-hidden />
                  Cómo llegar
                  <span className="bc-sr"> (se abre Google Maps)</span>
                </a>
                <p style={{ fontWeight: 600, fontSize: 13.5 }}>
                  Reparto a domicilio: todavía no disponible en esta web.
                </p>
              </section>
            </div>

            <div className="bc-co__col bc-co__aside">
              <section className="bc-module" aria-labelledby="bc-m3">
                <div className="bc-module__head">
                  <span className="bc-module__num" aria-hidden>
                    3
                  </span>
                  <h2 id="bc-m3" className="bc-module__title">
                    Tu pedido
                  </h2>
                </div>
                <ul className="bc-sumlines">
                  {quote.lines.map((l) => (
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
                <Link className="bc-linkbtn" href={`${routes.home}#carta`}>
                  Editar el pedido
                </Link>
              </section>

              <section className="bc-module" data-tone="butter" aria-labelledby="bc-m4">
                <div className="bc-module__head">
                  <span className="bc-module__num" aria-hidden>
                    4
                  </span>
                  <h2 id="bc-m4" className="bc-module__title">
                    Pago
                  </h2>
                </div>
                <div className="bc-sums">
                  <div className="bc-sums__row">
                    <span>Subtotal</span>
                    <span className="bc-nums">{formatCents(quote.subtotalCents)}</span>
                  </div>
                  <div className="bc-sums__row">
                    <span>Recogida en el local</span>
                    <span>Sin coste</span>
                  </div>
                  <div className="bc-sums__total">
                    <span>Total</span>
                    <strong>{formatCents(quote.totalCents)}</strong>
                  </div>
                </div>

                {requiresAge && (
                  <div className="bc-field">
                    <label className="bc-check" data-invalid={errors.ageConfirmed ? "" : undefined}>
                      <input
                        type="checkbox"
                        name="ageConfirmed"
                        checked={values.ageConfirmed}
                        onChange={(e) => setField("ageConfirmed", e.target.checked)}
                        aria-invalid={errors.ageConfirmed ? "true" : undefined}
                        aria-describedby={errors.ageConfirmed ? "bc-err-age" : undefined}
                      />
                      <span>
                        Confirmo que tengo 18 años o más. Tu pedido incluye bebidas alcohólicas; el
                        restaurante puede pedirte el DNI al recogerlo.
                      </span>
                    </label>
                    {errors.ageConfirmed && (
                      <p id="bc-err-age" className="bc-error">
                        {errors.ageConfirmed}
                      </p>
                    )}
                  </div>
                )}

                {blocking.length > 0 && (
                  <p className="bc-error" role="status">
                    {QUOTE_ISSUE_COPY[blocking[0].code]}
                  </p>
                )}

                <p style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.4 }}>
                  {CHECKOUT_KIND === "demo"
                    ? "En esta demostración el pago es simulado: no se pide ninguna tarjeta."
                    : "Pagarás en la página segura de Stripe. No guardamos los datos de tu tarjeta."}
                </p>

                <div className="bc-paybar">
                  <p className="bc-paybar__sum">
                    <span>Total</span>
                    <strong>{formatCents(quote.totalCents)}</strong>
                  </p>
                  <button
                    type="submit"
                    className="bc-primary"
                    data-testid="checkout-pay"
                    disabled={submitting}
                    aria-busy={submitting || undefined}
                  >
                    {submitting ? "Preparando el pago…" : `Pagar ${formatCents(quote.totalCents)}`}
                  </button>
                </div>
              </section>
            </div>
          </form>
        )}
      </main>
    </>
  );
}
