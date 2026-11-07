"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { validateCustomer, type FieldErrors } from "@/lib/commerce/validation";
import type { CheckoutFailure } from "@/lib/commerce/checkout/gateway";
import { CHECKOUT_ERROR_TEXT, VALIDATION_TEXT } from "@/lib/commerce/messages";
import { formatMoney } from "@/lib/i18n/format";
import { getOrderGateway } from "@/lib/shang-hai/checkout";
import { shangHaiCatalog, shangHaiOrdering } from "@/lib/shang-hai/catalog";
import { cartSignature, writeLastOrder } from "@/lib/shang-hai/last-order";
import { itemName } from "@/lib/shang-hai/menu-i18n";
import { useCart } from "./useCart";
import { useLocale } from "./useLocale";

export type CheckoutValues = {
  name: string;
  phone: string;
  email: string;
  notes: string;
  ageConfirmed: boolean;
};

const EMPTY: CheckoutValues = { name: "", phone: "", email: "", notes: "", ageConfirmed: false };

export const CHECKOUT_FIELDS = ["name", "phone", "email", "notes"] as const;

/**
 * Headless checkout form: values, client-side validation (same rules as the server),
 * submission to the order gateway and error states. Each storefront renders its own UI.
 * Inputs should use name="name" | "phone" | "email" | "notes" | "ageConfirmed".
 */
export function useCheckoutForm() {
  const router = useRouter();
  const cart = useCart();
  const { locale } = useLocale();
  const [values, setValues] = useState<CheckoutValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<CheckoutFailure | null>(null);
  // The total the server quoted after a "price-changed" answer: shown to the customer, and
  // the one the next press of "pay" confirms (the menu in this page may be older than the
  // server's). Stripe then shows that same amount before anything is authorised.
  const [confirmedTotal, setConfirmedTotal] = useState<{ cart: string; totalCents: number } | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Back from the payment page (bfcache restores this page as it was): the form must be usable.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setSubmitting(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const setField = useCallback(<K extends keyof CheckoutValues>(key: K, value: CheckoutValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }, []);

  const requiresAge = cart.quote.containsAgeRestricted;

  function validate(): FieldErrors {
    const result = validateCustomer(values, shangHaiOrdering.limits, locale);
    const next: FieldErrors = result.ok ? {} : { ...result.errors };
    if (requiresAge && !values.ageConfirmed) {
      next.ageConfirmed = VALIDATION_TEXT[locale].ageConfirmation;
    }
    return next;
  }

  // Switching language re-words the messages already on screen (same fields, new language).
  const previousLocale = useRef(locale);
  useEffect(() => {
    if (previousLocale.current === locale) return;
    previousLocale.current = locale;
    setErrors((current) => {
      const shown = Object.keys(current).filter((k) => current[k]);
      if (!shown.length) return current;
      const fresh = validate();
      return Object.fromEntries(shown.map((k) => [k, fresh[k] ?? current[k]]));
    });
    // validate() reads the latest values; re-running only on a language change is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  function focusFirstError(errs: FieldErrors) {
    const first = ["name", "phone", "email", "notes", "ageConfirmed"].find((k) => errs[k]);
    if (!first) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
    el?.focus();
  }

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (submitting) return;
    setFailure(null);
    const errs = validate();
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) {
      focusFirstError(errs);
      return;
    }
    if (!cart.quote.payable) {
      setFailure({ ok: false, error: "not-payable", issues: cart.quote.issues });
      return;
    }
    setSubmitting(true);
    const signature = cartSignature(cart.lines);
    const expectedTotalCents = confirmedTotal?.cart === signature ? confirmedTotal.totalCents : cart.quote.totalCents;
    const result = await getOrderGateway().createCheckout({
      catalogId: shangHaiCatalog.catalog.catalogId,
      catalogVersion: shangHaiCatalog.catalog.version,
      storefront: cart.storefront,
      fulfillment: "pickup",
      lines: cart.lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        ...(Object.keys(l.selections).length ? { selections: l.selections } : {}),
      })),
      customer: {
        name: values.name,
        phone: values.phone,
        email: values.email,
        ...(values.notes.trim() ? { notes: values.notes } : {}),
      },
      ageConfirmed: requiresAge ? values.ageConfirmed : undefined,
      expectedTotalCents,
      // Stripe Checkout, server messages and the return page follow the visitor's language.
      locale,
    });
    if (!result.ok) {
      setSubmitting(false);
      setFailure(result);
      if (result.error === "price-changed" && Number.isFinite(result.totalCents)) {
        setConfirmedTotal({ cart: signature, totalCents: result.totalCents });
      }
      if (result.error === "invalid") {
        const mapped: FieldErrors = {};
        for (const [k, v] of Object.entries(result.fieldErrors)) {
          mapped[k.replace(/^customer\./, "")] = v;
        }
        setErrors(mapped);
        focusFirstError(mapped);
      }
      return;
    }
    writeLastOrder(cart.storefront, { orderId: result.orderId, token: result.orderToken, at: Date.now(), cart: signature });
    if (result.next.kind === "external") window.location.assign(result.next.url);
    else router.push(result.next.path);
  }

  return {
    values,
    errors,
    setField,
    submit,
    submitting,
    failure,
    failureMessage: failure ? checkoutFailureMessage(failure, locale, cart.quote.totalCents) : null,
    requiresAge,
    formRef,
    quote: cart.quote,
  };
}

/**
 * What went wrong, in words the customer can act on: the new total when prices changed (and
 * that pressing pay again accepts it), which dishes cannot be ordered, or a reload when the
 * request itself is out of date (fields that are not on the form).
 */
function checkoutFailureMessage(failure: CheckoutFailure, locale: "es" | "en", shownTotalCents: number): string {
  const base = CHECKOUT_ERROR_TEXT[locale][failure.error];
  const en = locale === "en";
  if (failure.error === "price-changed" && Number.isFinite(failure.totalCents)) {
    const total = formatMoney(failure.totalCents, locale);
    const shown = formatMoney(shownTotalCents, locale);
    return en
      ? `Prices have changed: the current total is ${total} (this page showed ${shown}). Press pay again to continue with ${total}; you will see it on the payment page before anything is authorised.`
      : `Los precios han cambiado: el total actual es ${total} (en esta página aparecía ${shown}). Pulsa de nuevo para continuar con ${total}; lo verás en la página de pago antes de autorizar nada.`;
  }
  if (failure.error === "not-payable" && failure.issues.length) {
    const names = [
      ...new Set(
        failure.issues
          .map((i) => {
            if (!("itemId" in i) || !i.itemId) return null;
            const item = shangHaiCatalog.byId.get(i.itemId);
            return item ? itemName(item, locale) : i.itemId;
          })
          .filter(Boolean),
      ),
    ];
    if (names.length) {
      return en
        ? `These dishes cannot be ordered online right now: ${names.join(", ")}. Remove them from your order to continue.`
        : `Estos platos no se pueden pedir online ahora mismo: ${names.join(", ")}. Quítalos del pedido para continuar.`;
    }
  }
  if (failure.error === "invalid" && !Object.keys(failure.fieldErrors).some((k) => /^customer\.|^(name|phone|email|notes|ageConfirmed)$/.test(k))) {
    return en
      ? "Your order could not be sent because this page is out of date (the menu may have been updated). Reload the page and try again."
      : "No se ha podido enviar el pedido porque esta página está desactualizada (puede que la carta haya cambiado). Recarga la página y vuelve a intentarlo.";
  }
  return base;
}
