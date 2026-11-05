/**
 * Minimal Telegram Bot API client (core.telegram.org/bots/api#sendmessage).
 * Outbound only: the bot never accepts commands, so nobody can act on orders through
 * Telegram. Messages carry no personal data; the panel (authenticated) shows the details.
 */

export type TelegramSendResult =
  | { ok: true; messageId: number }
  | {
      ok: false;
      /** Worth retrying later (rate limit, Telegram or network down). */
      retryable: boolean;
      /** Seconds Telegram asked us to wait (429), when given. */
      retryAfter: number | null;
      error: string;
    };

/** HTML parse mode: only &, < and > must be escaped outside tags. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendTelegramMessage(
  fetchImpl: typeof fetch,
  options: { apiBase: string; token: string; chatId: string; html: string; buttonText?: string; buttonUrl?: string | null },
): Promise<TelegramSendResult> {
  const body: Record<string, unknown> = {
    chat_id: options.chatId,
    text: options.html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  };
  if (options.buttonUrl && options.buttonText) {
    body.reply_markup = { inline_keyboard: [[{ text: options.buttonText, url: options.buttonUrl }]] };
  }
  let res: Response;
  try {
    res = await fetchImpl(`${options.apiBase}/bot${options.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, retryable: true, retryAfter: null, error: "network" };
  }
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    result?: { message_id?: number };
    error_code?: number;
    description?: string;
    parameters?: { retry_after?: number };
  } | null;
  if (res.ok && data?.ok && typeof data.result?.message_id === "number") {
    return { ok: true, messageId: data.result.message_id };
  }
  const code = data?.error_code ?? res.status;
  // Never log or store the token: descriptions are Telegram's own text.
  const description = (data?.description ?? `HTTP ${res.status}`).slice(0, 200);
  if (code === 429) {
    return { ok: false, retryable: true, retryAfter: data?.parameters?.retry_after ?? null, error: description };
  }
  // 403: the chat blocked the bot or never started it; 400: chat not found / bad request.
  // Retrying cannot fix those: they need a person (and show up in the panel's health box).
  const retryable = code >= 500 || code === 0;
  return { ok: false, retryable, retryAfter: null, error: description };
}
