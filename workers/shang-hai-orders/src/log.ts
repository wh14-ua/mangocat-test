/**
 * Structured logs without personal data: only ids, amounts, counts and reasons.
 * Never pass names, phones, emails, notes, tokens or raw request bodies here.
 */
export function log(event: string, data: Record<string, string | number | boolean | null | undefined> = {}) {
  console.log(JSON.stringify({ event, ...data }));
}
