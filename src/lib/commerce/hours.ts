import type { WeeklyHours } from "./types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Day of week (0-6) and minutes since midnight of `date` in `timeZone`. */
export function localClock(date: Date, timeZone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: WEEKDAYS.indexOf(get("weekday")),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function isOpenAt(hours: WeeklyHours[], date: Date, timeZone: string): boolean {
  const { day, minutes } = localClock(date, timeZone);
  const today = hours.find((h) => h.day === day);
  return Boolean(
    today?.ranges.some((r) => minutes >= toMinutes(r.from) && minutes < toMinutes(r.to)),
  );
}

const DAY_NAMES_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Monday-first rows for display, e.g. { day: "Lunes", text: "12:00–16:00 · 19:30–23:30" }. */
export function formatWeek(hours: WeeklyHours[]): { day: string; text: string }[] {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const ranges = hours.find((h) => h.day === d)?.ranges ?? [];
    return {
      day: DAY_NAMES_ES[d],
      text: ranges.length ? ranges.map((r) => `${r.from}–${r.to}`).join(" y ") : "Cerrado",
    };
  });
}
