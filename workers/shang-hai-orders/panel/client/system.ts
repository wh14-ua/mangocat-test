/**
 * "Ajustes y estado": alerts on this phone (sound, browser notifications, keep the screen
 * on), the health of the system (payments mode, Stripe, automatic checks, Telegram) and the
 * session (device name, sign out here or on every phone).
 */
import {
  chime,
  notificationPermission,
  notificationsSupported,
  requestNotifications,
  soundRunning,
  syncWakeLock,
  unlockSound,
  wakeLockSupported,
} from "./alerts";
import { api } from "./api";
import { h, icon } from "./dom";
import { agoSeconds, MODE_TEXT, stamp } from "./format";
import { prefs, savePrefs } from "./prefs";
import { confirmSheet, openSheet, type Sheet } from "./sheet";
import { emit, on, serverNow, state } from "./state";
import { toast } from "./toast";

type SignedOut = (notice: string) => void;

function switchRow(label: string, hint: string, checked: boolean, onToggle: (next: boolean, button: HTMLButtonElement) => void | Promise<void>): HTMLElement {
  const id = `sw-${label.replace(/\W+/g, "-").toLowerCase()}`;
  const button = h(
    "button",
    { class: "switch", attrs: { type: "button", role: "switch", "aria-checked": String(checked), "aria-labelledby": `${id}-label`, "aria-describedby": `${id}-hint` } },
    h("span", "switch__track", h("span", "switch__thumb")),
  );
  button.addEventListener("click", () => void onToggle(button.getAttribute("aria-checked") !== "true", button));
  return h(
    "div",
    "setting",
    h("div", "setting__text", h("p", { class: "setting__label", attrs: { id: `${id}-label` }, text: label }), h("p", { class: "setting__hint", attrs: { id: `${id}-hint` }, text: hint })),
    button,
  );
}

function when(iso: string | null, now: number): string {
  if (!iso) return "Sin datos todavía";
  const ms = Date.parse(iso);
  return `${agoSeconds(ms, now)} (${stamp(iso, now)})`;
}

function healthList(): HTMLElement {
  const board = state.board;
  const now = serverNow();
  if (!board) return h("p", { class: "muted", text: "Cargando el estado…" });
  const health = board.health;
  const cronLate = !health.lastCronAt || now - Date.parse(health.lastCronAt) > 3 * 60_000;
  const tg = health.telegram;
  const rows: [string, Node | string, string?][] = [
    ["Pagos", h("span", { class: `badge ${board.paymentsMode === "stripe-live" ? "badge--ok" : board.paymentsMode === "disabled" ? "badge--danger" : "badge--test"}`, text: MODE_TEXT[board.paymentsMode] })],
    ["Último aviso de Stripe", when(health.lastWebhookAt, now)],
    ["Última revisión automática", when(health.lastCronAt, now), cronLate ? "is-bad" : undefined],
    ...(health.lastCronErrorAt && now - Date.parse(health.lastCronErrorAt) < 86_400_000
      ? [["Último fallo de la revisión automática", `${stamp(health.lastCronErrorAt, now)}${health.lastCronError ? `: ${health.lastCronError}` : ""}`, "is-bad"] as [string, string, string]]
      : []),
    ["Telegram", tg.configured ? "Configurado" : "No configurado: los avisos solo llegan a este panel", tg.configured ? undefined : "is-bad"],
  ];
  if (tg.configured) {
    rows.push(["Último envío correcto", when(tg.lastSuccessAt, now)]);
    if (tg.lastErrorAt) rows.push(["Último error", `${stamp(tg.lastErrorAt, now)}${tg.lastError ? `: ${tg.lastError}` : ""}`, "is-bad"]);
    rows.push(["Avisos fallidos (24 h)", String(tg.failedLast24h), tg.failedLast24h > 0 ? "is-bad" : undefined]);
  }
  return h(
    "dl",
    "facts facts--wide health",
    ...rows.map(([label, value, cls]) => h("div", `facts__row ${cls ?? ""}`.trim(), h("dt", { text: label }), h("dd", null, value))),
  );
}

export function openSystemSheet(onSignedOut: SignedOut): void {
  let stop: () => void = () => undefined;
  openSheet({
    title: "Ajustes y estado",
    className: "sheet--tall",
    onClose: () => stop(),
    build(sheet: Sheet) {
      const healthBox = h("div", "health__box", healthList());
      stop = on("board", () => healthBox.replaceChildren(healthList()));

      const sound = switchRow(
        "Sonido de pedidos nuevos",
        soundRunning() || !prefs.sound ? "Suena una campanita al entrar un pedido." : "En pausa hasta que toques la pantalla.",
        prefs.sound,
        async (next, button) => {
          if (next) {
            const ok = await unlockSound();
            if (!ok) {
              toast("error", "No se ha podido activar el sonido", "Este navegador no permite reproducir sonido.");
              return;
            }
            chime();
          }
          savePrefs({ sound: next });
          button.setAttribute("aria-checked", String(next));
          emit("prefs");
        },
      );

      const permission = notificationPermission();
      const notifyHint =
        permission === "unsupported"
          ? "Este navegador no muestra avisos desde la página. Los avisos de Telegram siguen llegando."
          : permission === "denied"
            ? "Bloqueados en el navegador: actívalos en los ajustes del sitio."
            : "Un aviso del sistema cuando entra un pedido con el panel en segundo plano.";
      const notify = switchRow("Avisos del navegador", notifyHint, prefs.notify && permission === "granted", async (next, button) => {
        if (!next) {
          savePrefs({ notify: false });
          button.setAttribute("aria-checked", "false");
          return;
        }
        const result = await requestNotifications();
        if (result === "granted") {
          savePrefs({ notify: true });
          button.setAttribute("aria-checked", "true");
          toast("ok", "Avisos del navegador activados");
        } else {
          savePrefs({ notify: false });
          button.setAttribute("aria-checked", "false");
          toast(
            "warn",
            "No se han podido activar los avisos",
            result === "denied" ? "El navegador los tiene bloqueados para esta página." : "Este navegador solo permite avisos de apps instaladas con servicio en segundo plano. Usa los avisos de Telegram.",
          );
        }
      });
      if (!notificationsSupported()) notify.querySelector("button")?.setAttribute("disabled", "");

      const awake = wakeLockSupported()
        ? switchRow("Mantener la pantalla encendida", "Útil con el móvil en un soporte junto a la caja. Gasta más batería.", prefs.keepAwake, async (next, button) => {
            savePrefs({ keepAwake: next });
            button.setAttribute("aria-checked", String(next));
            await syncWakeLock();
          })
        : null;

      const session = state.session;
      const logout = h("button", { class: "btn btn--line", attrs: { type: "button" } }, icon("logout"), h("span", { text: "Cerrar sesión" }));
      const logoutAll = h("button", { class: "btn btn--stop-line", attrs: { type: "button" }, text: "Cerrar sesión en todos los móviles" });
      logout.addEventListener("click", async () => {
        if (session?.method === "access") {
          window.location.assign(new URL("/cdn-cgi/access/logout", window.location.origin).href);
          return;
        }
        logout.disabled = true;
        const res = await api.logout(false);
        logout.disabled = false;
        if (res.ok || res.status === 401) {
          sheet.close();
          onSignedOut("Has cerrado la sesión en este móvil.");
        } else {
          toast("error", "No se ha podido cerrar la sesión", res.data?.message ?? "Inténtalo de nuevo en un momento.");
        }
      });
      logoutAll.addEventListener("click", () => {
        confirmSheet({
          title: "¿Cerrar sesión en todos los móviles?",
          text: "Todos los móviles conectados, también este, tendrán que volver a entrar con un código de Telegram.",
          confirmLabel: "Cerrar sesión en todos",
          danger: true,
          async onConfirm(confirm) {
            confirm.setBusy(true);
            const res = await api.logout(true);
            confirm.setBusy(false);
            if (res.ok || res.status === 401) {
              confirm.close();
              sheet.close();
              onSignedOut("Se ha cerrado la sesión en todos los móviles.");
            } else {
              toast("error", "No se ha podido cerrar la sesión", res.data?.message ?? "Inténtalo de nuevo en un momento.");
            }
          },
        });
      });

      sheet.body.append(
        h("section", "group", h("h3", { class: "group__title", text: "Avisos en este móvil" }), sound, notify, awake),
        h("section", "group", h("h3", { class: "group__title", text: "Estado del sistema" }), healthBox),
        h(
          "section",
          "group",
          h("h3", { class: "group__title", text: "Este móvil" }),
          h(
            "p",
            "device",
            icon("user"),
            h(
              "span",
              null,
              h("span", { class: "device__name", text: session?.label ?? "—" }),
              h("span", { class: "device__how", text: session?.method === "access" ? "Conectado con Cloudflare Access" : "Conectado con código de Telegram" }),
            ),
          ),
          h("div", "group__actions", logout, logoutAll),
        ),
      );
    },
  });
}
