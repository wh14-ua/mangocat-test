"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { validateCustomer, type FieldErrors } from "@/lib/commerce/validation";
import type { CheckoutFailure } from "@/lib/commerce/checkout/gateway";
import { CHECKOUT_ERROR_TEXT, VALIDATION_TEXT } from "@/lib/commerce/messages";
import { getOrderGateway, lastOrderStorageKey } from "@/lib/shang-hai/checkout";
import { shangHaiCatalog, shangHaiOrdering } from "@/lib/shang-hai/catalog";
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
  const formRef = useRef<HTMLFormElement | null>(null);

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
      expectedTotalCents: cart.quote.totalCents,
      // Stripe Checkout, server messages and the return page follow the visitor's language.
      locale,
    });
    if (!result.ok) {
      setSubmitting(false);
      setFailure(result);
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
    try {
      window.localStorage.setItem(
        lastOrderStorageKey(cart.storefront),
        JSON.stringify({ orderId: result.orderId, token: result.orderToken, at: Date.now() }),
      );
    } catch {
      /* optional */
    }
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
    failureMessage: failure ? CHECKOUT_ERROR_TEXT[locale][failure.error] : null,
    requiresAge,
    formRef,
    quote: cart.quote,
  };
}
