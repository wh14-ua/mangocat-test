// In-memory stand-in for the Telegram Bot API `sendMessage`, for unit tests and the local
// end-to-end stack. Records every message (chat, text, button) and can be told to fail
// like Telegram does: 429 with retry_after, 403 when a chat blocked the bot, or a network error.

/**
 * @typedef {{ message_id: number, chat_id: string, text: string, parse_mode: string | null,
 *   button: { text: string, url: string } | null, at: string }} FakeTelegramMessage
 * @typedef {{ status?: number, retryAfter?: number, network?: boolean }} FakeTelegramFailure
 */

export function createFakeTelegram() {
  /** @type {{ messages: FakeTelegramMessage[], failures: FakeTelegramFailure[], calls: number }} */
  const state = { messages: [], failures: [], calls: 0 };

  function handle(path, body) {
    state.calls += 1;
    const m = /^\/bot(\d{5,16}:[A-Za-z0-9_-]{20,})\/sendMessage$/.exec(path);
    if (!m) return { status: 404, body: { ok: false, error_code: 404, description: "Not Found" } };
    const failure = state.failures.shift();
    if (failure?.network) return { network: true };
    if (failure?.status === 429) {
      return { status: 429, body: { ok: false, error_code: 429, description: `Too Many Requests: retry after ${failure.retryAfter ?? 5}`, parameters: { retry_after: failure.retryAfter ?? 5 } } };
    }
    if (failure?.status === 403) return { status: 403, body: { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" } };
    if (failure) return { status: failure.status ?? 500, body: { ok: false, error_code: failure.status ?? 500, description: "Internal Server Error" } };
    const button = body?.reply_markup?.inline_keyboard?.[0]?.[0] ?? null;
    const message = {
      message_id: state.messages.length + 1,
      chat_id: String(body?.chat_id),
      text: String(body?.text ?? ""),
      parse_mode: body?.parse_mode ?? null,
      button: button ? { text: button.text, url: button.url } : null,
      at: new Date().toISOString(),
    };
    state.messages.push(message);
    return { status: 200, body: { ok: true, result: { message_id: message.message_id } } };
  }

  return {
    state,
    handle,
    fetchFor() {
      return async (input, init = {}) => {
        const url = new URL(typeof input === "string" ? input : input.url);
        const res = handle(url.pathname, JSON.parse(String(init.body ?? "{}")));
        if (res.network) throw new TypeError("fetch failed (injected network error)");
        return new Response(JSON.stringify(res.body), { status: res.status, headers: { "Content-Type": "application/json" } });
      };
    },
    /** Next sendMessage fails: { status: 429, retryAfter } | { status: 403 } | { status: 500 } | { network: true } */
    failNext(failure) {
      state.failures.push(failure);
    },
    messages: () => state.messages,
    /** Plain text without HTML tags (what the phone shows). */
    lastText: () => state.messages.at(-1)?.text.replace(/<[^>]+>/g, "") ?? null,
  };
}
