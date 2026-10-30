/**
 * Static files under /public are NOT prefixed with Next's basePath automatically when
 * used in plain <img>/<picture>/CSS, so every asset URL goes through this helper.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
