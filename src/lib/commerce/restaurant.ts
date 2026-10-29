import type { OrderingConfig, VerificationStatus } from "./types";

/** A business fact with its provenance. Pending facts are shown as "por confirmar". */
export type Sourced<T> = {
  value: T;
  status: VerificationStatus;
  source: string;
  checkedAt?: string;
  note?: string;
};

export type RestaurantProfile = {
  id: string;
  brand: {
    /** Display brand used by every storefront. */
    name: string;
    descriptor: string;
    /** Name the owner uses for the business. */
    ownerName: string;
    /** Name on third-party platforms, for reference. */
    platformName?: string;
  };
  cuisine: string[];
  address: Sourced<{
    street: string;
    postalCode: string;
    city: string;
    province: string;
    country: string;
  }>;
  geo: Sourced<{ lat: number; lng: number }>;
  phone: Sourced<{ e164: string; display: string } | null>;
  email: Sourced<string | null>;
  hours: Sourced<OrderingConfig["hours"]>;
  /** External link that opens directions in the visitor's maps app. No embeds. */
  directionsUrl: string;
  ordering: OrderingConfig;
  allergens: { status: VerificationStatus; note: string };
  seo: {
    /** Future official site URL; unknown while the demos are proposals. */
    canonicalUrl: string | null;
    indexable: boolean;
  };
};

export function fullAddress(profile: RestaurantProfile): string {
  const a = profile.address.value;
  return `${a.street}, ${a.postalCode} ${a.city} (${a.province})`;
}
