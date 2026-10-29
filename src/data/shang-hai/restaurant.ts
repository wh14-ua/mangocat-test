import type { RestaurantProfile } from "../../lib/commerce/restaurant";

/**
 * Shang Hai — single source of truth for business data shared by the three storefronts
 * and the order Worker. Anything not confirmed by the owner is marked `pending`; the UI
 * shows it as "por confirmar" and the engine never relies on it to charge money.
 *
 * Checked 2026-10-29 against the brief and the restaurant's public Just Eat listing.
 */

const JUST_EAT = "Ficha pública de Just Eat (consultada el 2026-10-29)";

const LUNCH = { from: "12:00", to: "16:00" };
const DINNER = { from: "19:30", to: "23:30" };

/** Pickup hours published on Just Eat (Tuesday closed). Pending owner confirmation. */
const PUBLISHED_HOURS: RestaurantProfile["ordering"]["hours"] = [
  { day: 0, ranges: [LUNCH, DINNER] },
  { day: 1, ranges: [LUNCH, DINNER] },
  { day: 2, ranges: [] },
  { day: 3, ranges: [LUNCH, DINNER] },
  { day: 4, ranges: [LUNCH, DINNER] },
  { day: 5, ranges: [LUNCH, DINNER] },
  { day: 6, ranges: [LUNCH, DINNER] },
];

export const shangHaiRestaurant: RestaurantProfile = {
  id: "shang-hai-orihuela",
  brand: {
    name: "SHANG HAI",
    descriptor: "Restaurante Asiático · Orihuela",
    ownerName: "Restaurante Asiático Shang Hai Orihuela",
    platformName: "Restaurante Chino Shang Hai",
  },
  cuisine: ["Cocina china", "Sushi"],
  address: {
    value: {
      street: "Avenida Doctor Gómez Pardo Ródenas, 5",
      postalCode: "03300",
      city: "Orihuela",
      province: "Alicante",
      country: "ES",
    },
    status: "verified",
    source: `Dirección facilitada para el encargo y coincidente con la ${JUST_EAT}`,
    checkedAt: "2026-10-29",
  },
  geo: {
    value: { lat: 38.089268, lng: -0.937705 },
    status: "pending",
    source: JUST_EAT,
    note: "Coordenadas de la plataforma; confirmar la ubicación exacta del local.",
  },
  phone: {
    value: { e164: "+34623300934", display: "623 300 934" },
    status: "pending",
    source: `${JUST_EAT}: teléfono publicado para consultas sobre alérgenos`,
    note: "Confirmar si es también el teléfono para pedidos y consultas.",
  },
  email: { value: null, status: "pending", source: "No publicado" },
  hours: {
    value: PUBLISHED_HOURS,
    status: "pending",
    source: `Horario de recogida de la ${JUST_EAT}`,
    note: "El horario del canal propio debe confirmarlo el restaurante.",
  },
  directionsUrl:
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent("Avenida Doctor Gómez Pardo Ródenas 5, 03300 Orihuela, Alicante"),
  ordering: {
    currency: "EUR",
    timeZone: "Europe/Madrid",
    pickup: {
      enabled: true,
      prepTimeMinutes: null,
      allowRequestedTime: false,
      enforceOpeningHours: false,
    },
    // Own delivery is NOT confirmed: disabled, no fee, no minimum, no area.
    // Just Eat's conditions (minimum order, delivery fee) do not apply to this channel.
    delivery: {
      enabled: false,
      feeCents: null,
      minimumOrderCents: null,
      freeDeliveryFromCents: null,
      postalCodes: [],
      municipalities: [],
      prepTimeMinutes: null,
    },
    limits: {
      maxQuantityPerLine: 20,
      maxLines: 30,
      maxItemsPerOrder: 60,
      maxOrderTotalCents: 60_000,
      maxNotesLength: 300,
    },
    hours: PUBLISHED_HOURS,
  },
  allergens: {
    status: "pending",
    note: "La carta publicada no detalla alérgenos por plato. Consulta al restaurante antes de pedir si tienes alergias o intolerancias.",
  },
  seo: { canonicalUrl: null, indexable: false },
};
