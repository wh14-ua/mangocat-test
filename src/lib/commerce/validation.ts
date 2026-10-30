import type {
  CheckoutRequest,
  CustomerDetails,
  DeliveryAddress,
  FulfillmentType,
  OptionSelections,
  OrderLimits,
} from "./types";

export type FieldErrors = Partial<Record<string, string>>;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Trims, collapses whitespace runs and strips control characters. */
export function cleanText(value: unknown, maxLength: number, multiline = false): string {
  if (typeof value !== "string") return "";
  let text = value.replace(CONTROL_CHARS, "");
  text = multiline
    ? text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n")
    : text.replace(/\s+/g, " ");
  return text.trim().slice(0, maxLength);
}

/**
 * Spanish numbers (9 digits, starting 6/7/8/9, optional +34/0034) or international
 * E.164 numbers. Returns the normalized E.164 string or null.
 */
export function normalizePhone(value: string): string | null {
  const compact = value.replace(/[\s().-]/g, "");
  if (/^(\+34|0034)?[6789]\d{8}$/.test(compact)) {
    return `+34${compact.slice(-9)}`;
  }
  if (/^(\+|00)[1-9]\d{7,14}$/.test(compact)) {
    return `+${compact.replace(/^(\+|00)/, "")}`;
  }
  return null;
}

const EMAIL = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

export function validateCustomer(
  input: Partial<CustomerDetails> | undefined,
  limits: Pick<OrderLimits, "maxNotesLength">,
): ParseResult<CustomerDetails> {
  const errors: FieldErrors = {};
  const name = cleanText(input?.name, 80);
  const phoneRaw = cleanText(input?.phone, 32);
  const email = cleanText(input?.email, 120).toLowerCase();
  const notes = cleanText(input?.notes, limits.maxNotesLength + 1, true);

  if (name.length < 2) errors.name = "Escribe tu nombre para que podamos identificar el pedido.";
  const phone = normalizePhone(phoneRaw);
  if (!phoneRaw) errors.phone = "Necesitamos un teléfono por si hay que confirmar algo del pedido.";
  else if (!phone) errors.phone = "Revisa el teléfono: por ejemplo 612 345 678.";
  if (!email) errors.email = "Escribe un correo para enviarte la confirmación.";
  else if (!EMAIL.test(email)) errors.email = "Revisa el correo: falta algo como nombre@dominio.es.";
  if (notes.length > limits.maxNotesLength) {
    errors.notes = `Los comentarios admiten hasta ${limits.maxNotesLength} caracteres.`;
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { name, phone: phone as string, email, ...(notes ? { notes } : {}) },
  };
}

export function validateDeliveryAddress(
  input: Partial<DeliveryAddress> | undefined,
): ParseResult<DeliveryAddress> {
  const errors: FieldErrors = {};
  const street = cleanText(input?.street, 160);
  const postalCode = cleanText(input?.postalCode, 5);
  const city = cleanText(input?.city, 80);
  const notes = cleanText(input?.notes, 200, true);
  if (street.length < 5) errors.street = "Escribe la dirección completa (calle y número).";
  if (!/^\d{5}$/.test(postalCode)) errors.postalCode = "El código postal tiene 5 cifras.";
  if (city.length < 2) errors.city = "Escribe el municipio.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { street, postalCode, city, ...(notes ? { notes } : {}) } };
}

const ID = /^[a-z0-9][a-z0-9-]{0,80}$/;

function parseSelections(value: unknown): OptionSelections | null {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: OptionSelections = {};
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 10) return null;
  for (const [k, v] of entries) {
    if (!ID.test(k) || !Array.isArray(v) || v.length > 10) return null;
    if (!v.every((c) => typeof c === "string" && ID.test(c))) return null;
    out[k] = v as string[];
  }
  return out;
}

/**
 * Structural validation of an untrusted checkout payload (shape, types, sizes and
 * customer fields). Business validation (existence, availability, prices) happens in
 * quoteLines() against the catalog.
 */
export function parseCheckoutRequest(
  input: unknown,
  limits: OrderLimits,
  allowedStorefronts: readonly string[],
): ParseResult<CheckoutRequest> {
  const errors: FieldErrors = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { body: "Petición no válida." } };
  }
  const body = input as Record<string, unknown>;

  const catalogId = typeof body.catalogId === "string" ? body.catalogId : "";
  if (!ID.test(catalogId)) errors.catalogId = "Catálogo no válido.";

  const storefront = typeof body.storefront === "string" ? body.storefront : "";
  if (!allowedStorefronts.includes(storefront)) errors.storefront = "Tienda no válida.";

  const fulfillment = body.fulfillment as FulfillmentType;
  if (fulfillment !== "pickup" && fulfillment !== "delivery") {
    errors.fulfillment = "Elige recogida o reparto.";
  }

  const linesRaw = body.lines;
  const lines: CheckoutRequest["lines"] = [];
  if (!Array.isArray(linesRaw) || linesRaw.length === 0) {
    errors.lines = "El pedido está vacío.";
  } else if (linesRaw.length > limits.maxLines) {
    errors.lines = "El pedido tiene demasiados productos distintos.";
  } else {
    for (const raw of linesRaw) {
      const line = raw as Record<string, unknown>;
      const itemId = typeof line?.itemId === "string" ? line.itemId : "";
      const quantity = line?.quantity;
      const selections = parseSelections(line?.selections);
      if (
        !ID.test(itemId) ||
        typeof quantity !== "number" ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > limits.maxQuantityPerLine ||
        selections === null
      ) {
        errors.lines = "Revisa las cantidades del pedido.";
        break;
      }
      lines.push({ itemId, quantity, selections });
    }
  }

  const customer = validateCustomer(body.customer as Partial<CustomerDetails>, limits);
  if (!customer.ok) {
    for (const [k, v] of Object.entries(customer.errors)) errors[`customer.${k}`] = v;
  }

  let delivery: DeliveryAddress | undefined;
  if (fulfillment === "delivery") {
    const address = validateDeliveryAddress(body.delivery as Partial<DeliveryAddress>);
    if (!address.ok) {
      for (const [k, v] of Object.entries(address.errors)) errors[`delivery.${k}`] = v;
    } else delivery = address.value;
  }

  const expected = body.expectedTotalCents;
  if (
    expected !== undefined &&
    (typeof expected !== "number" || !Number.isSafeInteger(expected) || expected < 0)
  ) {
    errors.expectedTotalCents = "Importe no válido.";
  }

  const catalogVersion =
    typeof body.catalogVersion === "string" ? body.catalogVersion.slice(0, 64) : undefined;

  if (Object.keys(errors).length || !customer.ok) return { ok: false, errors };
  return {
    ok: true,
    value: {
      catalogId,
      ...(catalogVersion ? { catalogVersion } : {}),
      storefront,
      fulfillment,
      lines,
      customer: customer.value,
      ...(delivery ? { delivery } : {}),
      ageConfirmed: body.ageConfirmed === true,
      ...(typeof expected === "number" ? { expectedTotalCents: expected } : {}),
    },
  };
}
