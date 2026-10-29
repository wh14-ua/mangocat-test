/**
 * The three Shang Hai storefront proposals. Shared by the Next.js app (routes, switcher,
 * comparison page) and by the order Worker (allowed storefronts and return URLs).
 * Pure data: no React or Next imports.
 */

export const SHANG_HAI_BASE_PATH = "/showcase/shang-hai";

export const STOREFRONTS = [
  {
    id: "ink-house",
    number: "01",
    name: "Ink House",
    summary: "Editorial y sofisticado.",
    personality:
      "La carta como un libro bien impreso: papel de arroz, tinta y un sello rojo que firma cada pedido.",
  },
  {
    id: "wok-after-dark",
    number: "02",
    name: "Wok After Dark",
    summary: "Urbano y expresivo.",
    personality:
      "Un cartel nocturno con el calor del wok: tipografía gigante, ritmo de cocina y pedidos a toda velocidad.",
  },
  {
    id: "bento-club",
    number: "03",
    name: "Bento Club",
    summary: "Dinámico y orientado al pedido.",
    personality:
      "Una caja de bento hecha web: módulos de color, búsqueda inmediata y pedidos en pocos toques.",
  },
] as const;

export type StorefrontId = (typeof STOREFRONTS)[number]["id"];
export type Storefront = (typeof STOREFRONTS)[number];

export const STOREFRONT_IDS: readonly StorefrontId[] = STOREFRONTS.map((s) => s.id);

export function isStorefrontId(value: unknown): value is StorefrontId {
  return typeof value === "string" && (STOREFRONT_IDS as readonly string[]).includes(value);
}

export function getStorefront(id: StorefrontId): Storefront {
  return STOREFRONTS.find((s) => s.id === id)!;
}

/** App-relative routes (Next's basePath is added by next/link and the router). */
export function storefrontRoutes(id: StorefrontId) {
  const root = `${SHANG_HAI_BASE_PATH}/${id}`;
  return {
    home: `${root}/`,
    menu: `${root}/#carta`,
    checkout: `${root}/pedido/`,
    status: `${root}/pedido/estado/`,
  };
}

export function demoPaymentPath(orderId: string, token: string, storefront: string): string {
  const params = new URLSearchParams({ pedido: orderId, t: token, tienda: storefront });
  return `${SHANG_HAI_BASE_PATH}/pago-demo/?${params.toString()}`;
}

export function orderStatusPath(id: StorefrontId, orderId: string, token: string): string {
  const params = new URLSearchParams({ pedido: orderId, t: token });
  return `${storefrontRoutes(id).status}?${params.toString()}`;
}
