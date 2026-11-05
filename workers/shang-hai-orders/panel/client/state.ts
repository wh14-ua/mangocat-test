/** App state shared by the views, plus a minimal change notifier. */
import type { Board, Card, Column, Session, StaffAction } from "./types";
import { COLUMNS } from "./types";

export type Connection = "ok" | "retrying" | "offline";

export const state = {
  session: null as Session | null,
  board: null as Board | null,
  /** Client time (ms) of the last board that arrived. */
  boardAt: 0,
  /** Server clock minus phone clock, so countdowns are right even on a phone with a wrong clock. */
  offset: 0,
  tab: "new" as Column,
  detailId: null as string | null,
  /** Actions in flight per order: their buttons stay disabled until the server answers. */
  pending: new Map<string, StaffAction>(),
  connection: "ok" as Connection,
  failures: 0,
  /** Bumped whenever an action finishes: board replies requested before it are discarded. */
  mutations: 0,
};

export const serverNow = (): number => Date.now() + state.offset;

export type Topic = "board" | "connection" | "pending" | "tab" | "route" | "prefs" | "sound";
const listeners = new Map<Topic, Set<() => void>>();

/** Subscribes to a topic; returns the unsubscribe function. */
export function on(topic: Topic, fn: () => void): () => void {
  let set = listeners.get(topic);
  if (!set) listeners.set(topic, (set = new Set()));
  set.add(fn);
  return () => set.delete(fn);
}

export function emit(topic: Topic): void {
  for (const fn of listeners.get(topic) ?? []) fn();
}

export function findCard(id: string): Card | null {
  const board = state.board;
  if (!board) return null;
  for (const column of COLUMNS) {
    const card = board.columns[column].find((c) => c.id === id);
    if (card) return card;
  }
  return null;
}

const ASCENDING: readonly Column[] = ["new", "preparing", "ready"];

/** Puts a card returned by an action where the server says it now belongs. */
export function upsertCard(card: Card): void {
  const board = state.board;
  if (!board) return;
  for (const column of COLUMNS) board.columns[column] = board.columns[column].filter((c) => c.id !== card.id);
  if (!card.column) return;
  const list = [...board.columns[card.column], card];
  const sign = ASCENDING.includes(card.column) ? 1 : -1;
  list.sort((a, b) => sign * (Date.parse(a.createdAt) - Date.parse(b.createdAt)));
  board.columns[card.column] = list;
}
