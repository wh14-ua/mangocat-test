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

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "failed",
  "cancelled",
  "preparing",
  "ready",
  "completed",
  "needs_review",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

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
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  fulfillment: FulfillmentType;
  lines: PricedLine[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  currency: Currency;
  customerName: string;
  /** "demo" orders never reach the restaurant. */
  mode: "demo" | "stripe-test" | "stripe-live";
  pickupNote?: string;
};
