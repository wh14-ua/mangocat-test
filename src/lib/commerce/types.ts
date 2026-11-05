/**
 * MangoCat order engine — shared types.
 *
 * Framework-agnostic: imported by the Next.js storefronts AND by the Cloudflare Worker
 * (workers/shang-hai-orders). Nothing in src/lib/commerce may import React, Next.js or
 * browser-only APIs at module level.
 *
 * Money is always an integer number of cents (EUR). Never use floats for amounts.
 */

export type Currency = "EUR";

export type VerificationStatus = "verified" | "pending" | "conflicting";

export type DietaryTag = "spicy" | "vegetarian" | "vegan" | "gluten-free";

export type OptionChoice = {
  id: string;
  name: string;
  nameEn?: string;
  /** Extra cost added to the unit price when chosen (0 for free choices). */
  priceDeltaCents: number;
};

export type ProductOption = {
  id: string;
  name: string;
  minChoices: number;
  maxChoices: number;
  choices: OptionChoice[];
};

export type Pieces = { count: number; unit: "piezas" | "unidades" };

export type MenuItem = {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  categoryId: string;
  /** null = price not confirmed: the item is shown but cannot be ordered. */
  priceCents: number | null;
  pieces?: Pieces;
  image?: string;
  allergens?: string[];
  dietaryTags?: DietaryTag[];
  /** Alcoholic drinks: the buyer must confirm they are 18 or older. */
  ageRestricted?: boolean;
  options?: ProductOption[];
  available: boolean;
  source: string;
  sourceId?: string;
  sourceName?: string;
  verifiedAt?: string;
  verificationStatus: VerificationStatus;
  /** Exact duplicate of another entry: hidden from menus, never orderable. */
  duplicateOf?: string;
  /** Notes for the owner (data-quality findings). Never shown to customers. */
  issues?: string[];
  platformImageOnSource?: boolean;
};

export type MenuCategory = {
  id: string;
  name: string;
  nameEn?: string;
  sourceId?: string;
  itemIds: string[];
};

export type CatalogSource = {
  id: string;
  name: string;
  url: string;
  retrievedAt: string;
  platformRestaurantId?: string;
  platformMenuVersion?: string;
};

export type MenuCatalog = {
  schemaVersion: 1;
  catalogId: string;
  currency: Currency;
  /** Changes whenever the menu is re-imported. */
  version: string;
  generatedAt: string;
  sources: CatalogSource[];
  categories: MenuCategory[];
  items: MenuItem[];
};

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

/** Selected choice ids per option id, e.g. { elige: ["con-postre"] }. */
export type OptionSelections = Record<string, string[]>;

export type CartLine = {
  /** itemId + normalized selections; identical configurations share one line. */
  key: string;
  itemId: string;
  quantity: number;
  selections: OptionSelections;
};

export type CartState = { lines: CartLine[] };

export type OrderLimits = {
  maxQuantityPerLine: number;
  maxLines: number;
  maxItemsPerOrder: number;
  maxOrderTotalCents: number;
  maxNotesLength: number;
};

// ---------------------------------------------------------------------------
// Fulfilment
// ---------------------------------------------------------------------------

export type FulfillmentType = "pickup" | "delivery";

export type PickupConfig = {
  enabled: boolean;
  /** null until the restaurant confirms its preparation time. */
  prepTimeMinutes: number | null;
  /** Customers may request a time only once the restaurant has a confirmed policy. */
  allowRequestedTime: boolean;
  enforceOpeningHours: boolean;
};

export type DeliveryConfig = {
  enabled: boolean;
  feeCents: number | null;
  minimumOrderCents: number | null;
  freeDeliveryFromCents: number | null;
  /** Postal codes served by the restaurant's own delivery. */
  postalCodes: string[];
  municipalities: string[];
  prepTimeMinutes: number | null;
};

export type WeeklyHours = {
  /** 0 = Sunday ... 6 = Saturday (Date#getDay convention). */
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** "HH:MM" ranges in the restaurant's local time; empty = closed. */
  ranges: { from: string; to: string }[];
};

export type OrderingConfig = {
  currency: Currency;
  timeZone: string;
  pickup: PickupConfig;
  delivery: DeliveryConfig;
  limits: OrderLimits;
  hours: WeeklyHours[];
};

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/**
 * Commercial status of an order: where it is in the restaurant's workflow. What happened
 * with the money is a separate axis (PaymentStatus), so "accepted" never implies "charged"
 * and "rejected" never implies "refunded".
 *
 *   pending              checkout open, waiting for the customer's payment
 *   awaiting_acceptance  payment authorised (or captured): the restaurant must accept or reject
 *   accepting            a staff member accepted; the payment is being captured (short lock)
 *   rejecting            a staff member rejected; the authorisation is being released or refunded
 *   preparing            accepted with payment captured: in the kitchen
 *   ready                ready for pickup
 *   completed            handed over to the customer
 *   rejected             declined by the restaurant (see PaymentStatus for the money)
 *   failed               the payment did not go through
 *   cancelled            no payment completed (session expired, authorisation expired…)
 *   needs_review         something does not add up (amounts, a failed refund…): staff must check
 */
export const ORDER_STATUSES = [
  "pending",
  "awaiting_acceptance",
  "accepting",
  "rejecting",
  "preparing",
  "ready",
  "completed",
  "rejected",
  "failed",
  "cancelled",
  "needs_review",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * What Stripe says about the money, as last confirmed by Stripe itself (webhook + API).
 *
 *   unpaid          nothing paid yet
 *   processing      submitted, Stripe still processing (delayed payment methods)
 *   authorized      funds held on the card, NOT charged; charged only if the restaurant accepts
 *   captured        charged
 *   canceled        authorisation released: nothing was charged
 *   failed          the payment attempt failed
 *   refund_pending  refund requested, Stripe has not confirmed it yet
 *   refunded        refund confirmed by Stripe
 *   refund_failed   the refund failed: staff must act
 */
export const PAYMENT_STATUSES = [
  "unpaid",
  "processing",
  "authorized",
  "captured",
  "canceled",
  "failed",
  "refund_pending",
  "refunded",
  "refund_failed",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type CustomerDetails = {
  name: string;
  phone: string;
  email: string;
  notes?: string;
};

export type DeliveryAddress = {
  street: string;
  postalCode: string;
  city: string;
  notes?: string;
};

/** What the browser sends. Contains ids and quantities only — never prices. */
export type CheckoutRequest = {
  catalogId: string;
  catalogVersion?: string;
  /** Storefront that started the checkout (used to build return URLs). */
  storefront: string;
  fulfillment: FulfillmentType;
  lines: { itemId: string; quantity: number; selections?: OptionSelections }[];
  customer: CustomerDetails;
  delivery?: DeliveryAddress;
  ageConfirmed?: boolean;
  /** The total the customer saw. Used only to detect price changes, never to charge. */
  expectedTotalCents?: number;
  /** Customer's language ("es" | "en"): Stripe Checkout, messages and return URLs. */
  locale?: "es" | "en";
};

export type PricedLine = {
  key: string;
  itemId: string;
  name: string;
  /** Human-readable option summary, e.g. "Con postre". */
  optionsLabel?: string;
  selections: OptionSelections;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  ageRestricted: boolean;
};

export type OrderSummary = {
  id: string;
  /** Short number for the counter and the kitchen (#1042). Absent on demo/legacy orders. */
  number?: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  /** Set by the restaurant when it accepts: minutes it expects to need, and the resulting time. */
  acceptedAt?: string;
  prepMinutes?: number;
  readyBy?: string;
  readyAt?: string;
  completedAt?: string;
  rejectedAt?: string;
  /** Optional reason the restaurant chose to share with the customer. */
  rejectionReason?: string;
  fulfillment: FulfillmentType;
  lines: PricedLine[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  currency: Currency;
  customerName: string;
  /** "demo" orders never reach the restaurant. */
  mode: "demo" | "stripe-test" | "stripe-live";
  /** Legacy free text (pre-2026-11 orders). New UIs derive their copy from the fields above. */
  pickupNote?: string;
};
