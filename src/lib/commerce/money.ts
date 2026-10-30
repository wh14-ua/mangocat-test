/** Integer-cent helpers. All amounts in the engine are safe integers. */

export function isCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Multiplies cents by a whole quantity, refusing anything that is not a safe integer. */
export function multiplyCents(unitCents: number, quantity: number): number {
  if (!isCents(unitCents) || !Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError("multiplyCents expects non-negative safe integers");
  }
  const result = unitCents * quantity;
  if (!Number.isSafeInteger(result)) throw new RangeError("Amount overflow");
  return result;
}

export function sumCents(values: number[]): number {
  let total = 0;
  for (const v of values) {
    if (!isCents(v)) throw new RangeError("sumCents expects non-negative safe integers");
    total += v;
    if (!Number.isSafeInteger(total)) throw new RangeError("Amount overflow");
  }
  return total;
}

const formatters = new Map<string, Intl.NumberFormat>();

/** 1945 -> "19,45 €" (es-ES). */
export function formatCents(cents: number, locale = "es-ES", currency = "EUR"): string {
  const key = `${locale}|${currency}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatters.set(key, fmt);
  }
  // Integer division keeps the formatter away from float artefacts.
  return fmt.format(Math.trunc(cents / 100) + (cents % 100) / 100);
}

/** 1945 -> { euros: "19", cents: "45" } for typographic price layouts. */
export function splitCents(cents: number): { euros: string; cents: string } {
  return {
    euros: Math.trunc(cents / 100).toLocaleString("es-ES"),
    cents: String(cents % 100).padStart(2, "0"),
  };
}
