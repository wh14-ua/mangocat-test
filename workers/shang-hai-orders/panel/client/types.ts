/**
 * Shapes of the staff API as the panel reads them (src/admin.ts, src/staff-auth.ts,
 * src/actions.ts). Pure types: panel/contract.ts checks on the Worker side that the
 * server's OrderCard still fits them.
 */

export type OrderStatus =
  | "pending"
  | "awaiting_acceptance"
  | "accepting"
  | "rejecting"
  | "preparing"
  | "ready"
  | "completed"
  | "rejected"
  | "failed"
  | "cancelled"
  | "needs_review";

export type PaymentStatus =
  | "unpaid"
  | "processing"
  | "authorized"
  | "captured"
  | "canceled"
  | "failed"
  | "refund_pending"
  | "refunded"
  | "refund_failed";

export type Column = "new" | "preparing" | "ready" | "completed" | "rejected";
export type StaffAction = "accept" | "reject" | "ready" | "complete" | "retry";
export type AlertState = "delivered" | "sent" | "pending" | "failed" | "none";
export type PaymentsMode = "stripe-test" | "stripe-live" | "disabled";
export type LoginMethod = "access" | "whatsapp" | "telegram";

export type CardLine = { quantity: number; name: string; options: string | null; lineTotalCents: number };

export type Card = {
  id: string;
  number: number | null;
  status: OrderStatus;
  statusLabel: string;
  paymentStatus: PaymentStatus;
  column: Column | null;
  createdAt: string;
  updatedAt: string;
  authorizedAt: string | null;
  acceptedAt: string | null;
  prepMinutes: number | null;
  readyBy: string | null;
  readyAt: string | null;
  completedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  reviewReason: string | null;
  customer: { name: string; phone: string; phoneDisplay: string };
  notes: string | null;
  fulfillment: "pickup" | "delivery";
  lines: CardLine[];
  itemCount: number;
  totalCents: number;
  ageRestricted: boolean;
  storefront: string;
  locale: "es" | "en";
  mode: "stripe-test" | "stripe-live";
  captureBefore: string | null;
  alert: AlertState;
  actions: StaffAction[];
};

export type OrderEvent = { at: string; from: string | null; to: string; source: string; actor: string | null; note: string | null };

export type OrderNotification = {
  kind: string;
  channel: string;
  status: string;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  nextAttemptAt: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
};

export type OrderDetail = Card & {
  email: string;
  payment: {
    mode: string;
    status: PaymentStatus;
    stripePaymentIntentId: string | null;
    stripeStatus: string | null;
    refundStatus: string | null;
  };
  events: OrderEvent[];
  notifications: OrderNotification[];
};

export type Health = {
  lastWebhookAt: string | null;
  lastCronAt: string | null;
  lastCronErrorAt?: string | null;
  lastCronError?: string | null;
  telegram: {
    configured: boolean;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    failedLast24h: number;
  };
  whatsapp?: {
    configured: boolean;
    lastDeliveredAt: string | null;
    lastAcceptedAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    /** A problem a person must fix (expired token, missing template, recipient not allowed…). */
    problem: { kind: string; code: number | null; error: string; at: string } | null;
    failedLast24h: number;
  };
};

export type Board = {
  now: string;
  paymentsMode: PaymentsMode;
  prepOptions: number[];
  columns: Record<Column, Card[]>;
  health: Health;
};

export type Session = {
  authenticated: true;
  method: "code" | "access";
  label: string;
  loginMethods: LoginMethod[];
};

export type ActionReply = {
  ok: boolean;
  pending?: boolean;
  error?: string;
  message?: string;
  order: Card | null;
};

export const COLUMNS: readonly Column[] = ["new", "preparing", "ready", "completed", "rejected"];
