import { rejectOrder, resolveLock } from "./actions";
import { acceptanceTimeoutMinutes, reminderMinutes, staleLockMs } from "./config";
import { setState, updateOrderIf, type OrderRow } from "./db";
import type { Deps, Env } from "./env";
import { log } from "./log";
import { deliverDue, enqueueNotification } from "./notifications";
import { syncOrderPayment } from "./sync";

/** Reason shown to the customer when nobody accepted in time. */
export const TIMEOUT_REASON = "El restaurante no ha podido confirmar el pedido a tiempo";

const BATCH = 20;

async function rows(env: Env, sql: string, ...params: (string | number)[]): Promise<OrderRow[]> {
  return (await env.DB.prepare(sql).bind(...params).all<OrderRow>()).results;
}

/**
 * Runs every minute (Cron Trigger). Each step is bounded and independent, so one failure
 * never blocks the others, and running it twice at once is harmless (every write is a
 * conditional update or an idempotent Stripe call).
 */
export async function runScheduled(env: Env, deps: Deps): Promise<Record<string, number>> {
  const now = deps.now();
  const at = (msAgo: number) => new Date(now.getTime() - msAgo).toISOString();
  const report: Record<string, number> = { reminders: 0, timeouts: 0, locks: 0, payments: 0, refunds: 0, sent: 0, failed: 0 };
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (error) {
      log("cron.step-failed", { step: name, message: error instanceof Error ? error.message : "unknown" });
    }
  };

  // 1. Locks left by requests that died half-way (accepting / rejecting).
  await step("locks", async () => {
    for (const order of await rows(env, `SELECT * FROM orders WHERE status IN ('accepting', 'rejecting') AND updated_at <= ? LIMIT ?`, at(staleLockMs(env)), BATCH)) {
      await resolveLock(env, deps, order, { label: "sistema", source: "system" });
      report.locks += 1;
    }
  });

  // 2. Nobody decided in time: decline and release the hold so the customer is not left waiting.
  //    The clock only starts once the restaurant is known to have been told about the order
  //    (a new-order alert was delivered, or a signed-in device showed it). An order nobody was
  //    able to see — Telegram down, blocked or not configured, panel closed — is never declined
  //    automatically: it stays pending (and visible) until a person decides.
  const timeout = acceptanceTimeoutMinutes(env);
  if (timeout > 0) {
    await step("timeouts", async () => {
      for (const order of await rows(
        env,
        `SELECT o.* FROM orders o
          WHERE o.status = 'awaiting_acceptance'
            AND MIN(
              COALESCE(o.staff_seen_at, '9999'),
              COALESCE((SELECT MIN(n.sent_at) FROM notifications n
                         WHERE n.order_id = o.id AND n.kind = 'new_order' AND n.status = 'sent'), '9999')
            ) <= ?
          LIMIT ?`,
        at(timeout * 60_000),
        BATCH,
      )) {
        const result = await rejectOrder(env, deps, order.id, TIMEOUT_REASON, { label: "sistema (sin respuesta a tiempo)", source: "system" });
        if (result.ok) {
          await enqueueNotification(env, order.id, "auto_cancelled", now.toISOString());
          report.timeouts += 1;
        }
      }
    });
  }

  // 3. Reminders for orders still waiting.
  const reminder = reminderMinutes(env);
  if (reminder > 0) {
    await step("reminders", async () => {
      for (const order of await rows(
        env,
        `SELECT * FROM orders WHERE status = 'awaiting_acceptance' AND COALESCE(authorized_at, created_at) <= ? LIMIT ?`,
        at(reminder * 60_000),
        BATCH,
      )) {
        report.reminders += await enqueueNotification(env, order.id, "reminder", now.toISOString());
      }
    });
  }

  // 4. Payments whose webhook never arrived (or failed): ask Stripe directly.
  await step("payments", async () => {
    for (const order of await rows(
      env,
      `SELECT * FROM orders WHERE status IN ('pending', 'failed') AND stripe_session_id IS NOT NULL
         AND created_at <= ? AND created_at >= ? ORDER BY created_at LIMIT ?`,
      at(2 * 60_000),
      at(26 * 3_600_000),
      BATCH,
    )) {
      const synced = await syncOrderPayment(env, deps, order.id, { source: "system" });
      if (synced.ok && synced.changed) report.payments += 1;
      // Sessions last 60 minutes; after that, an unpaid order is closed without charge.
      if (synced.ok && synced.order.status === order.status && Date.parse(order.created_at) <= now.getTime() - 75 * 60_000) {
        await updateOrderIf(env.DB, order.id, order.status, "cancelled", {}, {
          source: "system",
          note: "La sesión de pago caducó sin completarse; no se ha cobrado nada",
          now: now.toISOString(),
        });
      }
    }
  });

  // 5. Refunds Stripe has not confirmed yet.
  await step("refunds", async () => {
    for (const order of await rows(
      env,
      `SELECT * FROM orders WHERE payment_status = 'refund_pending' AND updated_at <= ? ORDER BY updated_at LIMIT ?`,
      at(5 * 60_000),
      BATCH,
    )) {
      const synced = await syncOrderPayment(env, deps, order.id, { source: "system" });
      if (synced.ok && synced.changed) report.refunds += 1;
    }
  });

  // 6. Deliver due notifications (new, retries and the reminders/timeouts above).
  await step("notifications", async () => {
    const res = await deliverDue(env, deps, { limit: 40, reminderMinutes: reminder, timeoutMinutes: timeout });
    report.sent = res.sent;
    report.failed = res.failed;
  });

  await setState(env.DB, "cron.last_run", JSON.stringify(report), now.toISOString());
  return report;
}
