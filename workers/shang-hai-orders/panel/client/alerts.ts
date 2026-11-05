/**
 * New-order alerts inside the open panel: a chime made with WebAudio (no files), a
 * vibration, the tab title, the app badge and, while the page is in the background, an
 * optional browser notification (Notification API, not web push).
 * Browsers only allow sound after a tap, so the AudioContext is created inside a tap.
 */
import { APP_NAME } from "../shared/brand";
import { prefs } from "./prefs";

type Activation = { userActivation?: { hasBeenActive: boolean } };
type Badging = { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
type LegacyWindow = { webkitAudioContext?: typeof AudioContext };

let audio: AudioContext | null = null;

export function soundRunning(): boolean {
  return audio !== null && audio.state === "running";
}

/** Must be called from a tap/click/keypress handler. */
export async function unlockSound(): Promise<boolean> {
  try {
    if (!audio) {
      const Ctor = window.AudioContext ?? (window as unknown as LegacyWindow).webkitAudioContext;
      if (!Ctor) return false;
      audio = new Ctor();
    }
    if (audio.state !== "running") await audio.resume();
    return audio.state === "running";
  } catch {
    return false;
  }
}

/** A bright rising three-note chime, played twice so it cuts through kitchen noise. */
export function chime(): boolean {
  const ctx = audio;
  if (!ctx || ctx.state !== "running") return false;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  const start = ctx.currentTime + 0.03;
  const notes = [880, 1174.66, 1567.98];
  for (let round = 0; round < 2; round++) {
    notes.forEach((frequency, i) => {
      const at = start + round * 0.75 + i * 0.16;
      for (const [type, ratio, level] of [
        ["triangle", 1, 0.5],
        ["sine", 2, 0.16],
      ] as const) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = frequency * ratio;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(level, at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
        osc.connect(gain).connect(master);
        osc.start(at);
        osc.stop(at + 0.45);
      }
    });
  }
  return true;
}

export function vibrate(): void {
  const activation = (navigator as Navigator & Activation).userActivation;
  // Chrome refuses (and logs) vibration before the first tap on the page.
  if (activation && !activation.hasBeenActive) return;
  try {
    navigator.vibrate?.([200, 100, 200, 100, 300]);
  } catch {
    /* not supported */
  }
}

export function setTitleCount(newCount: number): void {
  document.title = newCount > 0 ? `(${newCount}) Nuevos · ${APP_NAME}` : APP_NAME;
  const badging = navigator as Navigator & Badging;
  try {
    if (newCount > 0) badging.setAppBadge?.(newCount)?.catch(() => undefined);
    else badging.clearAppBadge?.()?.catch(() => undefined);
  } catch {
    /* badging unsupported */
  }
}

// ---------------------------------------------------------------------------
// Browser notifications (only while the panel is open in the background)
// ---------------------------------------------------------------------------

let notificationsBroken = false;

export function notificationsSupported(): boolean {
  return "Notification" in window && !notificationsBroken;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

/** Shows a page notification; false when this browser only allows them from a service worker. */
export function showNotification(title: string, body: string, tag: string, onClick?: () => void): boolean {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  try {
    const n = new Notification(title, { body, tag, lang: "es", icon: "/admin/icon-192.png" });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
    return true;
  } catch {
    // Android Chrome: "Illegal constructor" without a service worker.
    notificationsBroken = true;
    return false;
  }
}

export async function requestNotifications(): Promise<"granted" | "denied" | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  try {
    const result = await Notification.requestPermission();
    if (result !== "granted") return "denied";
    return showNotification("Avisos activados", "Así se verá un pedido nuevo con el panel en segundo plano.", "shp-test") ? "granted" : "unsupported";
  } catch {
    return "unsupported";
  }
}

export function notificationsOn(): boolean {
  return prefs.notify && notificationPermission() === "granted";
}

// ---------------------------------------------------------------------------
// Keep the screen on (Screen Wake Lock), optional
// ---------------------------------------------------------------------------

type WakeLockSentinelLike = { release: () => Promise<void>; addEventListener: (type: "release", fn: () => void) => void };
type WakeLockNavigator = { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } };

let wakeLock: WakeLockSentinelLike | null = null;

export function wakeLockSupported(): boolean {
  return Boolean((navigator as Navigator & WakeLockNavigator).wakeLock);
}

export async function syncWakeLock(): Promise<void> {
  const nav = navigator as Navigator & WakeLockNavigator;
  if (!nav.wakeLock) return;
  const want = prefs.keepAwake && document.visibilityState === "visible";
  try {
    if (want && !wakeLock) {
      wakeLock = await nav.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    } else if (!want && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}
