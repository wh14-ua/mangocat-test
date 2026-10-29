/** Accent- and case-insensitive text helpers for menu search (Spanish-friendly). */

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function tokenize(query: string): string[] {
  return normalizeText(query).split(" ").filter(Boolean);
}
