/**
 * Sign-in with a one-time code sent by WhatsApp and/or Telegram (only to the restaurant's authorised numbers),
 * or instructions for Cloudflare Access. The session is an HttpOnly cookie set by the
 * server; nothing secret is kept by the page.
 */
import { APP_NAME } from "../shared/brand";
import { api } from "./api";
import { focusQuietly, h, icon, seal } from "./dom";
import { prefs, savePrefs } from "./prefs";
import type { LoginMethod } from "./types";

const RESEND_SECONDS = 30;

function frame(root: HTMLElement, ...content: HTMLElement[]): HTMLElement {
  const card = h("main", { class: "signin__card", attrs: { id: "main" } }, seal("seal signin__seal"), h("h1", { class: "signin__brand", text: APP_NAME }), ...content);
  root.replaceChildren(h("div", "signin", card));
  return card;
}

/** "WhatsApp", "Telegram" or "WhatsApp y Telegram": where the sign-in code arrives. */
export function codeChannelText(login: LoginMethod[]): string {
  const names = [login.includes("whatsapp") ? "WhatsApp" : null, login.includes("telegram") ? "Telegram" : null].filter(Boolean);
  return names.join(" y ");
}

export function showSignIn(root: HTMLElement, options: { login: LoginMethod[]; notice?: string; onSignedIn: () => void }): void {
  const channel = codeChannelText(options.login);
  const codes = Boolean(channel);
  const access = options.login.includes("access");
  const parts: HTMLElement[] = [];
  if (options.notice) parts.push(h("p", { class: "signin__notice", attrs: { role: "status" } }, icon("info"), h("span", { text: options.notice })));

  if (!codes) {
    parts.push(
      h("h2", { class: "signin__title", text: "Entrar con Cloudflare Access" }),
      h("p", {
        class: "signin__text",
        text: "Este panel se abre con el enlace de acceso del restaurante (Cloudflare Access). Ábrelo e inicia sesión con tu correo autorizado; después vuelve a esta página.",
      }),
    );
    const retry = h("button", { class: "btn btn--ink", attrs: { type: "button" }, text: "Volver a comprobar" });
    retry.addEventListener("click", () => window.location.reload());
    parts.push(retry);
    frame(root, ...parts);
    return;
  }

  const error = h("p", { class: "field__error", attrs: { role: "alert", hidden: true } });
  const showError = (text: string | null) => {
    error.hidden = !text;
    error.textContent = text ?? "";
  };

  // Step 1: ask for a code
  const send = h("button", { class: "btn btn--ink btn--xl", attrs: { type: "button" } }, icon("send"), h("span", { text: "Enviar código" }));
  const step1 = h(
    "div",
    "signin__step",
    h("p", { class: "signin__text", text: `Te enviaremos un código de 6 cifras por ${channel} a los números autorizados del restaurante. Así este móvil queda conectado 30 días.` }),
    send,
  );

  // Step 2: type it
  const codeInput = h("input", {
    class: "input input--code",
    attrs: {
      id: "code",
      name: "code",
      type: "text",
      inputmode: "numeric",
      autocomplete: "one-time-code",
      pattern: "[0-9]*",
      maxlength: 6,
      required: true,
      "aria-describedby": "code-hint",
    },
  });
  const labelInput = h("input", {
    class: "input",
    attrs: { id: "device", name: "device", type: "text", maxlength: 40, autocomplete: "off", placeholder: "Ej.: Móvil de Pedro", value: prefs.deviceLabel || null },
  });
  const enter = h("button", { class: "btn btn--go btn--xl", attrs: { type: "submit" } }, h("span", { text: "Entrar" }));
  const resend = h("button", { class: "btn btn--quiet", attrs: { type: "button" } });
  const sentInfo = h("p", { class: "signin__sent", attrs: { role: "status" } });
  const step2 = h(
    "form",
    { class: "signin__step", attrs: { novalidate: true, hidden: true } },
    sentInfo,
    h("div", "field", h("label", { class: "field__label", attrs: { for: "code" }, text: "Código de 6 cifras" }), codeInput, h("p", { class: "field__hint", attrs: { id: "code-hint" }, text: `Lo encontrarás en ${channel}, en el mensaje con el código de acceso.` })),
    h("div", "field", h("label", { class: "field__label", attrs: { for: "device" }, text: "Nombre de este móvil (opcional)" }), labelInput),
    enter,
    resend,
  );

  let cooldownTimer = 0;
  const startCooldown = () => {
    let left = RESEND_SECONDS;
    window.clearInterval(cooldownTimer);
    const paint = () => {
      resend.disabled = left > 0;
      resend.textContent = left > 0 ? `Enviar otro código (en ${left} s)` : "Enviar otro código";
    };
    paint();
    cooldownTimer = window.setInterval(() => {
      left -= 1;
      paint();
      if (left <= 0) window.clearInterval(cooldownTimer);
    }, 1000);
  };

  const requestCode = async (button: HTMLButtonElement) => {
    showError(null);
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    const res = await api.sendCode();
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (res.ok) {
      const minutes = Math.round((res.data.expiresInSeconds || 600) / 60);
      sentInfo.replaceChildren(icon("check"), h("span", { text: `Código enviado por ${channel}. Caduca en ${minutes} minutos.` }));
      step1.hidden = true;
      step2.hidden = false;
      startCooldown();
      focusQuietly(codeInput);
      return;
    }
    if (res.status === 429) {
      // A code was sent moments ago: let them type it.
      step1.hidden = true;
      step2.hidden = false;
      sentInfo.replaceChildren(icon("info"), h("span", { text: `Ya hay un código reciente en ${channel}.` }));
      startCooldown();
    }
    showError(
      res.data?.message ??
        (res.network ? "Sin conexión. Comprueba la conexión y vuelve a intentarlo." : res.status === 503 ? "El acceso con código no está disponible ahora mismo." : "No se ha podido enviar el código."),
    );
  };
  send.addEventListener("click", () => void requestCode(send));
  resend.addEventListener("click", () => void requestCode(resend));

  codeInput.addEventListener("input", () => {
    const digits = codeInput.value.replace(/\D+/g, "").slice(0, 6);
    if (digits !== codeInput.value) codeInput.value = digits;
    codeInput.removeAttribute("aria-invalid");
  });

  step2.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = codeInput.value.replace(/\D+/g, "");
    if (code.length !== 6) {
      codeInput.setAttribute("aria-invalid", "true");
      showError("El código tiene 6 cifras.");
      focusQuietly(codeInput);
      return;
    }
    showError(null);
    enter.disabled = true;
    enter.replaceChildren(icon("spinner", "ico spin"), h("span", { text: "Entrando…" }));
    const label = labelInput.value.trim().slice(0, 40);
    const res = await api.verify(code, label);
    enter.disabled = false;
    enter.replaceChildren(h("span", { text: "Entrar" }));
    if (res.ok) {
      window.clearInterval(cooldownTimer);
      savePrefs({ deviceLabel: label });
      options.onSignedIn();
      return;
    }
    codeInput.setAttribute("aria-invalid", "true");
    showError(res.data?.message ?? (res.network ? "Sin conexión. Comprueba la conexión y vuelve a intentarlo." : "No se ha podido entrar. Pide un código nuevo."));
    focusQuietly(codeInput);
  });

  parts.push(h("h2", { class: "signin__title", text: `Entrar con un código de ${channel}` }), step1, step2, error);
  if (access) {
    parts.push(h("p", { class: "signin__alt", text: "También puedes entrar con el enlace de Cloudflare Access que te dio el restaurante." }));
  }
  frame(root, ...parts);
}

/** The server answered 503 admin-not-configured: the panel is closed, never open. */
export function showClosed(root: HTMLElement): void {
  const retry = h("button", { class: "btn btn--ink btn--xl", attrs: { type: "button" }, text: "Reintentar" });
  retry.addEventListener("click", () => window.location.reload());
  frame(
    root,
    h("h2", { class: "signin__title", text: "El panel aún no está configurado" }),
    h("p", {
      class: "signin__text",
      text: "Para entrar hace falta configurar en el servidor WhatsApp (o Telegram) del restaurante, o Cloudflare Access. Mientras tanto el panel permanece cerrado.",
    }),
    retry,
  );
}

/** First load failed (no connection or server error). Retries by itself. */
export function showUnreachable(root: HTMLElement, onRetry: () => void, offline: boolean): void {
  const retry = h("button", { class: "btn btn--ink btn--xl", attrs: { type: "button" }, text: "Reintentar ahora" });
  retry.addEventListener("click", onRetry);
  frame(
    root,
    h("p", { class: "signin__notice signin__notice--bad", attrs: { role: "alert" } }, icon("offline"), h("span", { text: offline ? "Sin conexión — reintentando" : "El servidor no responde — reintentando" })),
    h("p", { class: "signin__text", text: "Comprueba la conexión a internet del móvil. Volveremos a intentarlo cada pocos segundos." }),
    retry,
  );
}
