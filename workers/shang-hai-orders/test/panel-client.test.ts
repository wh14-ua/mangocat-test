import { describe, expect, it } from "vitest";
import { kindOf } from "../panel/client/cards";
import {
  acceptMoneyText,
  ago,
  clock,
  euros,
  minutesText,
  orderRef,
  PAYMENT_TEXT,
  rejectMoneyText,
  stamp,
  telHref,
} from "../panel/client/format";
import { state, upsertCard } from "../panel/client/state";
import type { Board, Card, Column } from "../panel/client/types";

const plain = (text: string) => text.replace(/ | /g, " ");

function card(id: string, column: Column | null, createdAt: string, overrides: Partial<Card> = {}): Card {
  return {
    id,
    number: 1000,
    status: "awaiting_acceptance",
    statusLabel: "Pendiente de aceptación",
    paymentStatus: "authorized",
    column,
    createdAt,
    updatedAt: createdAt,
    authorizedAt: createdAt,
    acceptedAt: null,
    prepMinutes: null,
    readyBy: null,
    readyAt: null,
    completedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    reviewReason: null,
    customer: { name: "Pedro", phone: "+34612345678", phoneDisplay: "612 345 678" },
    notes: null,
    fulfillment: "pickup",
    lines: [{ quantity: 2, name: "Arroz Frito con Tres Delicias", options: null, lineTotalCents: 900 }],
    itemCount: 2,
    totalCents: 2540,
    ageRestricted: false,
    storefront: "ink-house",
    locale: "es",
    mode: "stripe-test",
    captureBefore: null,
    alert: "sent",
    actions: ["accept", "reject"],
    ...overrides,
  };
}

describe("panel wording and formatting (es-ES, Europe/Madrid)", () => {
  it("formats money and times the way the restaurant reads them", () => {
    expect(plain(euros(2540))).toBe("25,40 €");
    expect(plain(euros(5))).toBe("0,05 €");
    expect(clock("2026-11-05T12:42:00Z")).toBe("13:42"); // CET (UTC+1) in November
    expect(clock("2026-07-05T12:42:00Z")).toBe("14:42"); // CEST in summer
    expect(clock(null)).toBe("—");
    const now = Date.parse("2026-11-05T13:00:00Z");
    expect(stamp("2026-11-05T12:42:00Z", now)).toBe("13:42");
    expect(stamp("2026-11-04T12:42:00Z", now)).toBe("4 nov, 13:42");
    expect(ago("2026-11-05T12:59:30Z", now)).toBe("ahora mismo");
    expect(ago("2026-11-05T12:57:00Z", now)).toBe("hace 3 min");
    expect(ago("2026-11-05T11:48:00Z", now)).toBe("hace 1 h 12 min");
    expect(minutesText(45)).toBe("45 min");
    expect(minutesText(60)).toBe("1 h");
    expect(orderRef({ number: 1042, id: "SH-261105-ABC123" })).toBe("#1042");
    expect(orderRef({ number: null, id: "SH-261105-ABC123" })).toBe("#SH-261105-ABC123");
  });

  it("says what happens to the money before accepting or rejecting", () => {
    expect(PAYMENT_TEXT.authorized.label).toBe("Pago autorizado · se cobra al aceptar");
    expect(rejectMoneyText({ paymentStatus: "authorized", totalCents: 2540 })).toBe("Se anulará la reserva del importe: no se cobrará nada al cliente.");
    expect(plain(rejectMoneyText({ paymentStatus: "captured", totalCents: 2540 }))).toBe("Se devolverá el importe cobrado (25,40 €) al cliente.");
    expect(rejectMoneyText({ paymentStatus: "refund_failed", totalCents: 2540 })).toContain("Se volverá a intentar devolver");
    expect(rejectMoneyText({ paymentStatus: "unpaid", totalCents: 2540 })).toContain("no se ha cobrado nada");
    expect(plain(acceptMoneyText({ paymentStatus: "authorized", totalCents: 2540 }))).toBe("Al aceptar se cobrarán 25,40 € al cliente.");
    expect(acceptMoneyText({ paymentStatus: "captured", totalCents: 2540 })).toContain("ya está cobrado");
  });

  it("only turns E.164 numbers into tel: links", () => {
    expect(telHref("+34612345678")).toBe("tel:+34612345678");
    expect(telHref("612345678")).toBeNull();
    expect(telHref("javascript:alert(1)")).toBeNull();
  });
});

describe("panel board logic", () => {
  it("maps every status to the ticket the kitchen expects", () => {
    expect(kindOf({ status: "awaiting_acceptance", column: "new" })).toBe("new");
    expect(kindOf({ status: "needs_review", column: "new" })).toBe("review");
    expect(kindOf({ status: "accepting", column: "new" })).toBe("processing");
    expect(kindOf({ status: "rejecting", column: "new" })).toBe("processing");
    expect(kindOf({ status: "preparing", column: "preparing" })).toBe("prep");
    expect(kindOf({ status: "ready", column: "ready" })).toBe("ready");
    expect(kindOf({ status: "completed", column: "completed" })).toBe("done");
    expect(kindOf({ status: "cancelled", column: "rejected" })).toBe("rejected");
    expect(kindOf({ status: "pending", column: null })).toBe("other");
  });

  it("moves a card returned by an action to its new column, in queue order", () => {
    const a = card("SH-261105-AAAAAA", "new", "2026-11-05T12:00:00Z");
    const b = card("SH-261105-BBBBBB", "new", "2026-11-05T12:05:00Z");
    const p = card("SH-261105-PPPPPP", "preparing", "2026-11-05T11:00:00Z", { status: "preparing" });
    const done = card("SH-261105-DDDDDD", "completed", "2026-11-05T10:00:00Z", { status: "completed" });
    const board: Board = {
      now: "2026-11-05T12:10:00Z",
      paymentsMode: "stripe-test",
      prepOptions: [15, 20, 30, 45],
      columns: { new: [a, b], preparing: [p], ready: [], completed: [done], rejected: [] },
      health: { lastWebhookAt: null, lastCronAt: null, telegram: { configured: true, lastSuccessAt: null, lastErrorAt: null, lastError: null, failedLast24h: 0 } },
    };
    state.board = board;
    upsertCard({ ...b, status: "preparing", column: "preparing", actions: ["ready", "reject"] });
    expect(board.columns.new.map((c) => c.id)).toEqual([a.id]);
    expect(board.columns.preparing.map((c) => c.id)).toEqual([p.id, b.id]); // oldest first
    upsertCard({ ...a, status: "completed", column: "completed", actions: [] });
    expect(board.columns.new).toEqual([]);
    expect(board.columns.completed.map((c) => c.id)).toEqual([a.id, done.id]); // newest first
    upsertCard({ ...p, status: "failed", column: null, actions: [] });
    expect(board.columns.preparing.map((c) => c.id)).toEqual([b.id]);
    state.board = null;
  });
});
