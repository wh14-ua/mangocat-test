/**
 * Harmless UI preferences kept on this phone (sound, browser alerts, last preparation time,
 * device name). Never credentials: the session lives in an HttpOnly cookie.
 * Storage can be missing or blocked (private mode): every access is guarded.
 */

export type Prefs = {
  sound: boolean;
  notify: boolean;
  keepAwake: boolean;
  lastPrep: number | null;
  deviceLabel: string;
};

const KEY = "shp-panel-prefs-v1";
const DEFAULTS: Prefs = { sound: false, notify: false, keepAwake: false, lastPrep: null, deviceLabel: "" };

function read(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Record<keyof Prefs, unknown>>;
    return {
      sound: parsed.sound === true,
      notify: parsed.notify === true,
      keepAwake: parsed.keepAwake === true,
      lastPrep: typeof parsed.lastPrep === "number" && Number.isInteger(parsed.lastPrep) ? parsed.lastPrep : null,
      deviceLabel: typeof parsed.deviceLabel === "string" ? parsed.deviceLabel.slice(0, 40) : "",
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export const prefs: Prefs = read();

export function savePrefs(patch: Partial<Prefs>): void {
  Object.assign(prefs, patch);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable: the preference lasts until the page is closed */
  }
}
