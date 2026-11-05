"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/hooks/shang-hai/useCart";
import { useCheckoutForm, type CheckoutValues } from "@/hooks/shang-hai/useCheckoutForm";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { QUOTE_ISSUE_TEXT } from "@/lib/commerce/messages";
import { formatMoney } from "@/lib/i18n/format";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { CHECKOUT_KIND } from "@/lib/shang-hai/checkout";
import { COMMON_TEXT } from "@/lib/shang-hai/i18n/common";
import { INK_TEXT } from "@/lib/shang-hai/i18n/ink-house";
import { lineName, lineOptionsLabel } from "@/lib/shang-hai/menu-i18n";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { DEMO_NOTICE_TEXT } from "@/components/shang-hai/shared/StorefrontShell";
import { Seal } from "./Seal";
import { useInkUI } from "./InkUI";

const routes = storefrontRoutes("ink-house");
const address = shangHaiRestaurant.address.value;

function CancelledNotice() {
  const params = useSearchParams();
  const t = INK_TEXT[useLocale().locale].checkout;
  if (params.get("cancelado") !== "1") return null;
  return (
    <div className="ink-note ink-note--lacquer" role="status">
      <p>
        <strong>{t.cancelledTitle}</strong> {t.cancelledText}
      </p>
    </div>
  );
}

export function DemoStamp({ children }: { children?: React.ReactNode }) {
  const { locale } = useLocale();
  if (CHECKOUT_KIND !== "demo") return null;
  return (
    <div className="ink-demo-stamp" role="note">
      <Seal className="ink-demo-stamp__seal" />
      <div>
        <p className="ink-demo-stamp__title">{DEMO_NOTICE_TEXT[locale]}</p>
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
  /** The "(opcional)" mark, in the page's language. */
  optional?: string;
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
        {optional && <span className="ink-field__optional"> {optional}</span>}
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
  const { locale } = useLocale();
  const ink = INK_TEXT[locale];
  const t = ink.checkout;
  const common = COMMON_TEXT[locale];
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
        <p className="ink-kicker">{t.kicker}</p>
        <h1 className="ink-checkout__title">{t.title}</h1>
        <Suspense fallback={null}>
          <CancelledNotice />
        </Suspense>
      </header>

      {!cart.hydrated ? (
        <div className="ink-checkout__loading" aria-busy="true">
          <p>{t.loading}</p>
        </div>
      ) : cart.lines.length === 0 ? (
        <div className="ink-checkout__empty">
          <p className="ink-checkout__empty-title">{t.emptyTitle}</p>
          <p>{t.emptyText}</p>
          <Link href={`${routes.home}#carta`} className="ink-button ink-button--ink">
            {t.goToMenu}
          </Link>
        </div>
      ) : (
        <div className="ink-checkout__grid">
          <form ref={formRef} noValidate onSubmit={submit} className="ink-form">
            <DemoStamp>{t.demoNote}</DemoStamp>

            <fieldset className="ink-step">
              <legend className="ink-step__legend">
                <span className="ink-step__num" aria-hidden="true">
                  1
                </span>
                {t.stepDetails}
              </legend>
              <Field
                name="name"
                label={t.name}
                value={values.name}
                error={errors.name}
                onChange={(v) => setField("name", v)}
                inputProps={{ autoComplete: "name", autoCapitalize: "words", enterKeyHint: "next" }}
              />
              <Field
                name="phone"
                label={t.phone}
                value={values.phone}
                error={errors.phone}
                hint={t.phoneHint}
                onChange={(v) => setField("phone", v)}
                inputProps={{ type: "tel", inputMode: "tel", autoComplete: "tel", enterKeyHint: "next" }}
              />
              <Field
                name="email"
                label={t.email}
                value={values.email}
                error={errors.email}
                hint={t.emailHint}
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
                label={t.notes}
                optional={t.optional}
                multiline
                value={values.notes}
                error={errors.notes}
                hint={t.notesHint}
                onChange={(v) => setField("notes", v)}
              />
            </fieldset>

            <fieldset className="ink-step">
              <legend className="ink-step__legend">
                <span className="ink-step__num" aria-hidden="true">
                  2
                </span>
                {t.stepPickup}
              </legend>
              <p className="ink-step__place">
                {address.street}
                <br />
                {address.postalCode} {address.city}
              </p>
              <p className="ink-step__text">
                {common.pickup.timeAfterAcceptance} {t.noDelivery}
              </p>
            </fieldset>

            <fieldset className="ink-step">
              <legend className="ink-step__legend">
                <span className="ink-step__num" aria-hidden="true">
                  3
                </span>
                {t.stepPayment}
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
                  <label htmlFor="ink-f-age">{t.ageConfirm}</label>
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
                    <p>{QUOTE_ISSUE_TEXT[locale][failure.issues[0].code]}</p>
                  )}
                </div>
              )}

              {/* Authorise first, charge on acceptance: said before the button, not after. */}
              <p className="ink-hold" id="ink-hold-note">
                {common.payment.holdExplainer}
              </p>

              <button
                type="submit"
                data-testid="checkout-pay"
                className="ink-button ink-button--lacquer ink-button--pay"
                disabled={submitting}
                aria-busy={submitting || undefined}
                aria-describedby="ink-hold-note"
              >
                {submitting ? t.paying : t.pay(formatMoney(quote.totalCents, locale))}
              </button>
              <p className="ink-step__text">{CHECKOUT_KIND === "demo" ? t.demoPayNote : t.stripeNote}</p>
            </fieldset>
          </form>

          <aside className="ink-comanda" aria-labelledby="ink-comanda-title">
            <div className="ink-comanda__head">
              <h2 id="ink-comanda-title" className="ink-comanda__title">
                {t.summaryTitle}
              </h2>
              <button type="button" className="ink-text-button" onClick={ui.openCart}>
                {t.edit}
              </button>
            </div>
            <ul className="ink-comanda__lines">
              {quote.lines.map((line) => {
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
              <dd>{formatMoney(quote.totalCents, locale)}</dd>
            </dl>
          </aside>
        </div>
      )}
    </div>
  );
}
