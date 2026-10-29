import type { CartState, OptionSelections, OrderLimits } from "./types";
import type { CatalogIndex } from "./catalog";
import {
  addToCart,
  decrementLine,
  EMPTY_CART,
  incrementLine,
  removeLine,
  setLineQuantity,
  type CartMutation,
} from "./cart";
import { restoreCart, serializeCart } from "./persistence";

export type CartEvent =
  | { type: "added"; itemId: string; key: string; quantity: number; at: number }
  | { type: "rejected"; itemId: string; error: Extract<CartMutation, { ok: false }>["error"]; at: number }
  | { type: "removed"; key: string; at: number }
  | { type: "cleared"; at: number };

export type CartSnapshot = {
  state: CartState;
  /** Items dropped while restoring a saved cart (no longer available, etc.). */
  restoredDropped: string[];
  lastEvent: CartEvent | null;
  hydrated: boolean;
};

export type CartStore = {
  getSnapshot: () => CartSnapshot;
  getServerSnapshot: () => CartSnapshot;
  subscribe: (listener: () => void) => () => void;
  add: (itemId: string, selections?: OptionSelections, quantity?: number) => CartMutation;
  increment: (key: string) => void;
  decrement: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  dismissRestoredNotice: () => void;
};

const SERVER_SNAPSHOT: CartSnapshot = {
  state: EMPTY_CART,
  restoredDropped: [],
  lastEvent: null,
  hydrated: false,
};

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = "__mc_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null; // private mode, blocked storage...
  }
}

/**
 * Browser cart store (useSyncExternalStore-compatible). Persists ids + quantities to
 * localStorage under a versioned key, re-validates everything against the current
 * catalog on load, and syncs between tabs.
 */
export function createCartStore(options: {
  storageKey: string;
  index: CatalogIndex;
  limits: OrderLimits;
}): CartStore {
  const { storageKey, index, limits } = options;
  let snapshot: CartSnapshot = SERVER_SNAPSHOT;
  let loaded = false;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());

  function load() {
    if (loaded) return;
    loaded = true;
    const storage = safeStorage();
    const raw = storage?.getItem(storageKey) ?? null;
    const restored = restoreCart(raw, index, limits);
    snapshot = {
      state: restored.state,
      restoredDropped: restored.dropped,
      lastEvent: null,
      hydrated: true,
    };
    if (raw && restored.dropped.length) persist(restored.state);
  }

  function persist(state: CartState) {
    const storage = safeStorage();
    if (!storage) return;
    try {
      if (state.lines.length === 0) storage.removeItem(storageKey);
      else storage.setItem(storageKey, serializeCart(state, index.catalog.catalogId));
    } catch {
      /* quota or privacy errors: the in-memory cart keeps working */
    }
  }

  function commit(state: CartState, event: CartEvent | null) {
    snapshot = { ...snapshot, state, lastEvent: event ?? snapshot.lastEvent, hydrated: true };
    persist(state);
    emit();
  }

  function onStorage(e: StorageEvent) {
    if (e.key !== storageKey) return;
    const restored = restoreCart(e.newValue, index, limits);
    snapshot = { ...snapshot, state: restored.state };
    emit();
  }

  return {
    getSnapshot: () => {
      load();
      return snapshot;
    },
    getServerSnapshot: () => SERVER_SNAPSHOT,
    subscribe(listener) {
      load();
      listeners.add(listener);
      if (listeners.size === 1 && typeof window !== "undefined") {
        window.addEventListener("storage", onStorage);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && typeof window !== "undefined") {
          window.removeEventListener("storage", onStorage);
        }
      };
    },
    add(itemId, selections, quantity = 1) {
      load();
      const result = addToCart(snapshot.state, index, limits, itemId, selections, quantity);
      const at = Date.now();
      if (result.ok) {
        commit(result.state, { type: "added", itemId, key: result.line.key, quantity, at });
      } else {
        snapshot = { ...snapshot, lastEvent: { type: "rejected", itemId, error: result.error, at } };
        emit();
      }
      return result;
    },
    increment: (key) => commit(incrementLine(snapshot.state, limits, key), null),
    decrement: (key) => commit(decrementLine(snapshot.state, limits, key), null),
    setQuantity: (key, q) => commit(setLineQuantity(snapshot.state, limits, key, q), null),
    remove: (key) => commit(removeLine(snapshot.state, key), { type: "removed", key, at: Date.now() }),
    clear: () => commit(EMPTY_CART, { type: "cleared", at: Date.now() }),
    dismissRestoredNotice() {
      snapshot = { ...snapshot, restoredDropped: [] };
      emit();
    },
  };
}
