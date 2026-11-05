"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { QUOTE_ISSUE_TEXT } from "@/lib/commerce/messages";
import { formatMoney } from "@/lib/i18n/format";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { useCart } from "@/hooks/shang-hai/useCart";
import { useCheckoutForm } from "@/hooks/shang-hai/useCheckoutForm";
import { useLocale } from "@/hooks/shang-hai/useLocale";
import { CHECKOUT_KIND } from "@/lib/shang-hai/checkout";
import { COMMON_TEXT } from "@/lib/shang-hai/i18n/common";
import { lineName, lineOptionsLabel } from "@/lib/shang-hai/menu-i18n";
import { storefrontRoutes } from "@/lib/shang-hai/storefronts";
import { DEMO_NOTICE_TEXT } from "@/components/shang-hai/shared/StorefrontShell";
import { Monogram } from "./Navigation";
import { useWokDocumentTitle, useWokText, WokLanguageSwitch } from "./WokLanguage";

const ROUTES = storefrontRoutes("wok-after-dark");

export function SubpageBar() {
  const t = useWokText();
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-[var(--wok-line)] bg-[var(--wok-petrol)] px-3 sm:px-6 lg:h-16 lg:px-12">
      {/* The wordmark folds into the SH block when the bar is too narrow for it and ES | EN. */}
      <div className="wok-bar-brand min-w-0 flex-1">
        <Link href={ROUTES.home} className="flex w-fit max-w-full items-center gap-2.5">
          <Monogram className="size-9 text-[1.15rem]" />
          <span className="wok-bar-word wok-display truncate text-[1.6rem] leading-none">Shang Hai</span>
          <span className="wok-sr">{t.nav.menuHome}</span>
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <WokLanguageSwitch />
        <Link
          href={ROUTES.home}
          className="wok-cond flex h-11 items-center px-2 text-[0.8125rem] text-[var(--wok-white)] underline decoration-[var(--wok-orange)] decoration-2 underline-offset-[6px] hover:text-[var(--wok-orange)]"
        >
          {t.nav.backToMenu}
        </Link>
      </div>
    </header>
  );
}

export function DemoStrip({ children }: { children?: React.ReactNode }) {
  const { locale } = useLocale();
  if (CHECKOUT_KIND !== "demo") return null;
  return (
    <div role="note" className="border-2 border-[var(--wok-orange)] px-4 py-3 sm:flex sm:items-baseline sm:gap-4">
      <p className="wok-cond-tight text-[1rem] text-[var(--wok-orange)]">{DEMO_NOTICE_TEXT[locale]}</p>
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
  const { locale } = useLocale();
  const t = useWokText();
  const { quote } = cart;
  return (
    <div className="wok-paper wok-perf-top px-5 pb-5 pt-6">
      <p className="wok-display text-[2.25rem]">{t.checkout.summaryTitle}</p>
      <ul className="mt-3 border-t-2 border-dashed border-[rgba(16,30,36,0.32)]">
        {quote.lines.map((l) => {
          const options = lineOptionsLabel(l, locale);
          return (
            <li key={l.key} className="flex items-start justify-between gap-3 border-b-2 border-dashed border-[rgba(16,30,36,0.32)] py-3">
              <span className="min-w-0">
                <span className="wok-cond-tight block text-[0.9375rem] leading-tight">
                  {l.quantity} × {lineName(l, locale)}
                </span>
                {options && <span className="mt-0.5 block text-[0.8125rem] text-[rgba(16,30,36,0.75)]">{options}</span>}
              </span>
              <span className="wok-nums shrink-0 text-[0.9375rem] font-semibold">
                {formatMoney(l.lineTotalCents, locale)}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex items-end justify-between">
        <span className="wok-cond text-[0.8125rem]">{t.checkout.total}</span>
        <span className="wok-total text-[2.75rem]">{formatMoney(quote.totalCents, locale)}</span>
      </div>
      <Link
        href={ROUTES.home + "#carta"}
        className="wok-cond mt-3 inline-flex h-11 items-center text-[0.75rem] text-[var(--wok-orange-deep)] underline decoration-2 underline-offset-4"
      >
        {t.checkout.editTicket}
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
  const { locale } = useLocale();
  const t = useWokText();
  const common = COMMON_TEXT[locale];
  useWokDocumentTitle(t.meta.checkout);
  const { quote } = cart;
  const addr = shangHaiRestaurant.address.value;
  const empty = cart.hydrated && quote.lines.length === 0;
  const describedBy = (name: string, hint = false) =>
    errors[name] ? `wok-${name}-error` : hint ? `wok-${name}-hint` : undefined;

  return (
    <>
      <SubpageBar />
      <main id="contenido" className="px-4 pb-24 pt-8 sm:px-6 lg:px-12 lg:pt-12">
        <p className="wok-cond text-[0.8125rem] text-[var(--wok-orange)]">{t.checkout.kicker}</p>
        <h1 className="wok-display mt-3 text-[clamp(3.5rem,14vw,8.5rem)]">{t.checkout.title}</h1>

        <div className="mt-6 grid max-w-[64rem] gap-3">
          <DemoStrip>{t.checkout.demoNote}</DemoStrip>
          {cancelled && (
            <div role="status" className="bg-[var(--wok-petrol-2)] px-4 py-3">
              <p className="wok-cond-tight text-[1.0625rem]">{t.checkout.cancelledTitle}</p>
              <p className="wok-muted mt-1 text-[0.9375rem]">{t.checkout.cancelledText}</p>
            </div>
          )}
        </div>

        {!cart.hydrated ? (
          <p className="wok-muted mt-12" aria-live="polite">
            {t.checkout.loading}
          </p>
        ) : empty ? (
          <div className="mt-12 max-w-[40rem]">
            <p className="wok-display text-[3rem]">{t.checkout.emptyTitle}</p>
            <p className="wok-muted mt-3 text-[1.0625rem]">{t.checkout.emptyText}</p>
            <Link href={ROUTES.home + "#carta"} className="wok-btn wok-btn--hot mt-6 h-14 px-8">
              {t.checkout.goToMenu}
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
                  <span>{t.checkout.summaryToggle(quote.itemCount)}</span>
                  <span className="wok-display text-[1.6rem] normal-case tracking-normal text-[var(--wok-orange)]">
                    {formatMoney(quote.totalCents, locale)}
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
                  {t.checkout.stepDetails}
                </StepTitle>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field name="name" label={t.checkout.name} error={errors.name}>
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
                  <Field name="phone" label={t.checkout.phone} error={errors.phone} hint={t.checkout.phoneHint}>
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
                  <Field name="email" label={t.checkout.email} error={errors.email} hint={t.checkout.emailHint}>
                    <input
                      id="wok-email"
                      name="email"
                      type="email"
                      inputMode="email"
                      className="wok-input"
                      autoComplete="email"
                      placeholder={t.checkout.emailPlaceholder}
                      value={values.email}
                      onChange={(e) => setField("email", e.target.value)}
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={describedBy("email", true)}
                      aria-required="true"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field name="notes" label={t.checkout.notes} error={errors.notes} hint={t.checkout.notesHint}>
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
                  {t.checkout.stepPickup}
                </StepTitle>
                <div className="mt-6 grid gap-px bg-[var(--wok-line)] sm:grid-cols-2">
                  <div className="bg-[var(--wok-petrol-2)] p-5">
                    <p className="wok-cond text-[0.75rem] text-[var(--wok-orange)]">{common.pickup.title}</p>
                    <p className="wok-cond-tight mt-2 text-[1.25rem] leading-tight">
                      {addr.street}
                      <br />
                      {addr.postalCode} {addr.city}
                    </p>
                    <p className="wok-muted mt-3 text-[0.9375rem]">{common.pickup.timeAfterAcceptance}</p>
                  </div>
                  <div className="bg-[var(--wok-petrol-2)] p-5">
                    <p className="wok-cond text-[0.75rem] text-[var(--wok-metal-light)]">{t.checkout.deliveryTitle}</p>
                    <p className="wok-muted mt-2 text-[0.9375rem]">{t.checkout.deliveryText}</p>
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
                      <span className="text-[0.9375rem] leading-snug">{t.checkout.age}</span>
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
                  {t.checkout.stepPayment}
                </StepTitle>
                <p className="wok-muted mt-5 max-w-[46ch] text-[0.9375rem]">
                  {CHECKOUT_KIND === "demo" ? t.checkout.payDemo : t.checkout.payReal}
                </p>
                {/* Authorise now, charge on acceptance: said right before the money is committed. */}
                <div className="mt-5 max-w-[28rem] border-l-4 border-[var(--wok-orange)] bg-[var(--wok-petrol-2)] px-4 py-3">
                  <p className="wok-cond text-[0.75rem] text-[var(--wok-orange)]">{t.checkout.holdTitle}</p>
                  <p id="wok-pay-hold" className="mt-1.5 text-[0.9375rem] leading-snug">
                    {common.payment.holdExplainer}
                  </p>
                </div>
                {quote.issues.some((i) => i.code !== "empty") && (
                  <ul role="alert" className="wok-error-text mt-4 space-y-1">
                    {[
                      ...new Set(
                        quote.issues.filter((i) => i.code !== "empty").map((i) => QUOTE_ISSUE_TEXT[locale][i.code]),
                      ),
                    ].map((m) => (
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
                  aria-describedby="wok-pay-hold"
                  className="wok-btn wok-btn--hot mt-6 h-16 w-full justify-between px-6 text-[1.25rem] sm:max-w-[28rem]"
                >
                  <span>{submitting ? t.checkout.processing : t.checkout.pay}</span>
                  <span className="wok-display text-[2rem] normal-case tracking-normal wok-nums">
                    {formatMoney(quote.totalCents, locale)}
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
