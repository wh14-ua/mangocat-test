"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, LockSimple, MapPin } from "@phosphor-icons/react/dist/ssr";
import { DEMO_NOTICE_TEXT } from "@/components/shang-hai/shared/StorefrontShell";
import { useCart } from "@/hooks/shang-hai/useCart";
import { useCheckoutForm, type CheckoutValues } from "@/hooks/shang-hai/useCheckoutForm";
import { QUOTE_ISSUE_TEXT } from "@/lib/commerce/messages";
import { validateCustomer } from "@/lib/commerce/validation";
import { formatMoney } from "@/lib/i18n/format";
import { lineName, lineOptionsLabel } from "@/lib/shang-hai/menu-i18n";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { CHECKOUT_KIND } from "@/lib/shang-hai/checkout";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { BentoLanguageSwitch } from "./Chrome";
import { EmptyTrayArt } from "./Graphics";
import { useBento, useDocumentTitle } from "./hooks";

const routes = storefrontRoutes("bento-club");

/** Checkout and status pages: back button, the language box and the brand. */
export function SubHeader({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  const { c } = useBento();
  return (
    <header className="bc-subhead">
      <Link className="bc-back" href={backHref}>
        <ArrowLeft size={18} weight="bold" aria-hidden />
        {backLabel}
      </Link>
      <div className="bc-subhead__end">
        <BentoLanguageSwitch />
        <Link className="bc-subhead__brand" href={routes.home}>
          SHANG HAI
          <small>{c.brand.descriptor}</small>
        </Link>
      </div>
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
  optional?: string;
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
        {p.optional && <small>{p.optional}</small>}
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
  const { locale, t, c } = useBento();
  useDocumentTitle(t.meta.checkout);
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
  const co = t.checkout;

  const detailsDone = validateCustomer(values, cart.limits, locale).ok;
  const steps = [
    { id: "details", label: co.steps.details, done: detailsDone },
    { id: "pickup", label: co.steps.pickup, done: true },
    { id: "order", label: co.steps.order, done: quote.payable },
    { id: "payment", label: co.steps.payment, done: false },
  ];
  const blocking = quote.issues.filter((i) => i.code !== "empty");

  return (
    <>
      <SubHeader backHref={`${routes.home}#carta`} backLabel={co.keepOrdering} />
      <main id="bc-main" className="bc-co">
        <h1 className="bc-co__title">{co.title}</h1>

        <ol className="bc-tape" aria-label={co.stepsLabel}>
          {steps.map((s, i) => (
            <li key={s.id} className="bc-tape__step" data-done={s.done || undefined}>
              <span className="bc-tape__mark" aria-hidden>
                {s.done ? <Check size={14} weight="bold" /> : i + 1}
              </span>
              {s.label}
              {s.done && <span className="bc-sr">{co.stepDone}</span>}
            </li>
          ))}
        </ol>

        <div className="bc-notices">
          {CHECKOUT_KIND === "demo" && (
            <p className="bc-warn" role="note">
              {DEMO_NOTICE_TEXT[locale]}
            </p>
          )}
          {cancelled && (
            <p className="bc-warn bc-warn--cancel" role="status">
              {c.payment.cancelledNotice}
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
            {co.loading}
          </p>
        ) : empty ? (
          <div className="bc-empty">
            <EmptyTrayArt className="bc-empty__art" />
            <p className="bc-info__big">{co.emptyTitle}</p>
            <p className="bc-help">{co.emptyText}</p>
            <Link className="bc-primary" href={`${routes.home}#carta`} style={{ width: "auto" }}>
              {co.goToMenu}
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
                    {co.details}
                  </h2>
                </div>
                <Field
                  name="name"
                  label={co.name}
                  value={values.name}
                  error={errors.name}
                  onChange={(v) => setField("name", v)}
                  autoComplete="name"
                />
                <Field
                  name="phone"
                  label={co.phone}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={values.phone}
                  error={errors.phone}
                  onChange={(v) => setField("phone", v)}
                  hint={co.phoneHint}
                />
                <Field
                  name="email"
                  label={co.email}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={values.email}
                  error={errors.email}
                  onChange={(v) => setField("email", v)}
                  hint={co.emailHint}
                />
                <Field
                  name="notes"
                  label={co.notes}
                  optional={co.optional}
                  textarea
                  maxLength={cart.limits.maxNotesLength}
                  value={values.notes}
                  error={errors.notes}
                  onChange={(v) => setField("notes", v)}
                  hint={co.notesHint}
                />
              </section>

              <section className="bc-module" data-tone="lime" aria-labelledby="bc-m2">
                <div className="bc-module__head">
                  <span className="bc-module__num" aria-hidden>
                    2
                  </span>
                  <h2 id="bc-m2" className="bc-module__title">
                    {co.pickup}
                  </h2>
                </div>
                <div className="bc-pickup">
                  <span style={{ fontWeight: 800, fontSize: 13.5 }}>{co.youCollect}</span>
                  <strong>
                    {a.street}, {a.postalCode} {a.city}
                  </strong>
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>{c.pickup.timeAfterAcceptance}</span>
                </div>
                <a
                  className="bc-linkbtn"
                  href={shangHaiRestaurant.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin size={18} weight="bold" aria-hidden />
                  {c.restaurant.directions}
                  <span className="bc-sr"> {c.restaurant.directionsHint}</span>
                </a>
                <p style={{ fontWeight: 600, fontSize: 13.5 }}>{co.noDelivery}</p>
              </section>
            </div>

            <div className="bc-co__col bc-co__aside">
              <section className="bc-module" aria-labelledby="bc-m3">
                <div className="bc-module__head">
                  <span className="bc-module__num" aria-hidden>
                    3
                  </span>
                  <h2 id="bc-m3" className="bc-module__title">
                    {co.yourOrder}
                  </h2>
                </div>
                <ul className="bc-sumlines">
                  {quote.lines.map((l) => {
                    const options = lineOptionsLabel(l, locale);
                    return (
                      <li key={l.key}>
                        <span className="bc-sumlines__q">
                          {l.quantity}
                          <span className="bc-sr">{co.unitsOf}</span>
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
                <Link className="bc-linkbtn" href={`${routes.home}#carta`}>
                  {co.edit}
                </Link>
              </section>

              <section className="bc-module" data-tone="butter" aria-labelledby="bc-m4">
                <div className="bc-module__head">
                  <span className="bc-module__num" aria-hidden>
                    4
                  </span>
                  <h2 id="bc-m4" className="bc-module__title">
                    {co.payment}
                  </h2>
                </div>
                <div className="bc-sums">
                  <div className="bc-sums__row">
                    <span>{t.cart.subtotal}</span>
                    <span className="bc-nums">{formatMoney(quote.subtotalCents, locale)}</span>
                  </div>
                  <div className="bc-sums__row">
                    <span>{c.pickup.title}</span>
                    <span>{t.cart.noCharge}</span>
                  </div>
                  <div className="bc-sums__total">
                    <span>{t.cart.total}</span>
                    <strong>{formatMoney(quote.totalCents, locale)}</strong>
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
                      <span>{co.ageConfirm}</span>
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
                    {QUOTE_ISSUE_TEXT[locale][blocking[0].code]}
                  </p>
                )}

                <p style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.4 }}>
                  {CHECKOUT_KIND === "demo" ? co.payDemo : co.payStripe}
                </p>

                {/* Authorise first, charge on acceptance: said right where the customer pays. */}
                <p className="bc-hold" id="bc-hold">
                  <span className="bc-hold__icon" aria-hidden>
                    <LockSimple size={18} weight="bold" />
                  </span>
                  <span>{c.payment.holdExplainer}</span>
                </p>

                <div className="bc-paybar">
                  <p className="bc-paybar__sum">
                    <span>{t.cart.total}</span>
                    <strong>{formatMoney(quote.totalCents, locale)}</strong>
                  </p>
                  <button
                    type="submit"
                    className="bc-primary"
                    data-testid="checkout-pay"
                    disabled={submitting}
                    aria-busy={submitting || undefined}
                    aria-describedby="bc-hold"
                  >
                    {submitting ? co.preparing : co.pay(formatMoney(quote.totalCents, locale))}
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
