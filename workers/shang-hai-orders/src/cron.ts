import { recoverLock, rejectOrder, type Actor } from "./actions";
import { acceptanceDeadlineMinutes, acceptanceTimeoutMinutes, reminderMinutes, staleLockMs } from "./config";
import { setState, updateOrderIf, type OrderRow } from "./db";
import type { Deps, Env } from "./env";
import { log } from "./log";
import { alertRecipients, CRON_PACE_MS, deliverDue, enqueueNotification } from "./notifications";
import { fetchPaymentFacts, stripeClient, syncOrderPayment } from "./sync";

/** Reason shown to the customer when nobody accepted in time. */
export const TIMEOUT_REASON = "El restaurante no ha podido confirmar el pedido a tiempo";

const BATCH = 20;

/** An incident still unattended after this long is alerted again (until a person acts). */
export const REVIEW_REMINDER_MS = 60 * 60_000;

/** After a staff decision attempt, the automatic decline waits at least this long. */
export const DECISION_GRACE_MS = 10 * 60_000;

/** Moves a row to the back of the cron's queues (they are ordered by updated_at). */
async function bump(env: Env, id: string, now: string) {
  await env.DB.prepare(`UPDATE orders SET updated_at = ? WHERE id = ?`).bind(now, id).run();
}

async function rows(env: Env, sql: string, ...params: (string | number)[]): Promise<OrderRow[]> {
  return (await env.DB.prepare(sql).bind(...params).all<OrderRow>()).results;
}

/** A staff decision (ACEPTAR / RECHAZAR) on order `o` after the bound time. */
const STAFF_DECIDED_SINCE = `EXISTS (SELECT 1 FROM order_events e
                    WHERE e.order_id = o.id AND e.source = 'staff'
                      AND e.to_status IN ('accepting', 'rejecting') AND e.created_at > ?)`;

/**
 * Declines an order nobody decided and releases the customer's money (both clocks of step 2).
 * Stripe is read FIRST, before anything changes: a payment Stripe cannot show right now leaves
 * the order exactly as it is — still acceptable from the panel — until the next run. It acts
 * only on the status the order was selected in, and not once a staff decision has begun
 * meanwhile: a phone that accepted it a second ago wins (it used to be declined and refunded).
 * From EN REVISIÓN only a hold is released; money Stripe shows as charged is left to a person.
 */
async function declineUndecided(env: Env, deps: Deps, selected: OrderRow, actor: Actor, graceFrom: string, now: string): Promise<boolean> {
  if (selected.payment_status === "authorized" || selected.payment_status === "captured") {
    const client = stripeClient(env, deps);
    if (!client) return false; // payments switched off: nothing can be released now (the panel says so)
    const read = await fetchPaymentFacts(client, selected);
    if (!read.ok) {
      await bump(env, selected.id, now); // Stripe did not answer: next run, the others first
      return false;
    }
    const held = read.facts?.piStatus;
    if (selected.status === "needs_review" && held !== "requires_capture" && held !== "canceled") {
      // Charged after all (or unknown to Stripe): for a person. D1 learns what Stripe says.
      if (read.facts) await syncOrderPayment(env, deps, selected.id, { source: "system" });
      else await bump(env, selected.id, now);
      return false;
    }
  }
  const still = await env.DB.prepare(`SELECT 1 AS ok FROM orders o WHERE o.id = ? AND o.status = ? AND NOT ${STAFF_DECIDED_SINCE}`)
    .bind(selected.id, selected.status, graceFrom)
    .first();
  if (!still) return false;
  const result = await rejectOrder(env, deps, selected.id, TIMEOUT_REASON, actor, selected.status);
  // Alert once the decline is done (its wording comes from the final payment status). If
  // Stripe could not confirm, the lock's recovery finishes it or puts it in review — alerted then.
  if (!result.ok || result.pending) return false;
  await enqueueNotification(env, selected.id, "auto_cancelled", now);
  return true;
}

/**
 * Runs every minute (Cron Trigger). Each step is bounded and independent, so one failure
 * never blocks the others, and running it twice at once is harmless (every write is a
 * conditional update or an idempotent Stripe call).
 */
export async function runScheduled(env: Env, deps: Deps): Promise<Record<string, number>> {
  const now = deps.now();
  const at = (msAgo: number) => new Date(now.getTime() - msAgo).toISOString();
  const report: Record<string, number> = { reminders: 0, timeouts: 0, deadlines: 0, locks: 0, payments: 0, refunds: 0, alerts: 0, sent: 0, failed: 0 };
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      log("cron.step-failed", { step: name, message });
      // Shown in the panel's «Estado del sistema»: a step failing every minute must not be silent.
      await setState(env.DB, "cron.step_failed", `${name}: ${message}`.slice(0, 300), now.toISOString()).catch(() => undefined);
    }
  };

  // 1. Locks whose owner's time is up (the request died half-way). A lock still within its
  //    expiry belongs to a request that may be talking to Stripe right now: never touched.
  await step("locks", async () => {
    for (const order of await rows(
      env,
      `SELECT * FROM orders WHERE status IN ('accepting', 'rejecting')
          AND ((lock_expires_at IS NULL AND updated_at <= ?) OR lock_expires_at <= ?)
        ORDER BY COALESCE(lock_expires_at, updated_at) LIMIT ?`,
      at(staleLockMs(env)),
      now.toISOString(),
      BATCH,
    )) {
      await recoverLock(env, deps, order, { label: "sistema", source: "system" });
      report.locks += 1;
    }
  });

  // 2. Nobody decided in time: decline and release the hold so the customer is not left waiting.
  //    Two clocks; whichever ends first declines (declineUndecided: Stripe is read first):
  //    a) ACCEPTANCE_TIMEOUT_MINUTES from the moment the restaurant is known to have been told
  //       about the order: a WhatsApp alert the phone confirmed as delivered (accepted by the API
  //       is not enough), a Telegram alert sent, or a signed-in device that showed it;
  //    b) the hard limit, ACCEPTANCE_DEADLINE_MINUTES from the payment, whatever the alerts did.
  //       If WhatsApp fails for good (expired token, template not approved, number not allowed,
  //       webhook never subscribed) and nobody opens the panel, clock (a) never starts — and the
  //       customer's money must not stay held for days. It also releases a hold left EN REVISIÓN
  //       that long after the incident began (a person has had that long to act on it).
  //    A staff decision (ACEPTAR / RECHAZAR) in the last DECISION_GRACE_MS stops both clocks:
  //    an acceptance that could not be charged a moment ago must not be declined behind the
  //    back of the person who is retrying it.
  const timeout = acceptanceTimeoutMinutes(env);
  const graceFrom = at(DECISION_GRACE_MS);
  if (timeout > 0) {
    await step("timeouts", async () => {
      for (const order of await rows(
        env,
        `SELECT o.* FROM orders o
          WHERE o.status = 'awaiting_acceptance'
            AND MIN(
              COALESCE(o.staff_seen_at, '9999'),
              COALESCE((SELECT MIN(CASE WHEN n.channel = 'whatsapp' THEN COALESCE(n.delivered_at, n.read_at) ELSE n.sent_at END)
                          FROM notifications n
                         WHERE n.order_id = o.id AND n.kind = 'new_order'
                           AND ((n.channel = 'whatsapp' AND COALESCE(n.delivered_at, n.read_at) IS NOT NULL)
                                OR (n.channel <> 'whatsapp' AND n.status = 'sent'))), '9999')
            ) <= ?
            AND NOT ${STAFF_DECIDED_SINCE}
          ORDER BY o.updated_at LIMIT ?`,
        at(timeout * 60_000),
        graceFrom,
        BATCH,
      )) {
        if (await declineUndecided(env, deps, order, { label: "sistema (sin respuesta a tiempo)", source: "system" }, graceFrom, now.toISOString())) {
          report.timeouts += 1;
        }
      }
    });
  }
  const deadline = acceptanceDeadlineMinutes(env);
  await step("deadlines", async () => {
    for (const order of await rows(
      env,
      `SELECT o.* FROM orders o
        WHERE ((o.status = 'awaiting_acceptance' AND COALESCE(o.authorized_at, o.created_at) <= ?)
            OR (o.status = 'needs_review' AND o.payment_status = 'authorized'
                AND MAX(COALESCE(o.authorized_at, o.created_at),
                        COALESCE((SELECT MAX(r.created_at) FROM order_events r
                                   WHERE r.order_id = o.id AND r.to_status = 'needs_review'
                                     AND r.from_status IS NOT 'needs_review'), '')) <= ?))
          AND NOT ${STAFF_DECIDED_SINCE}
        ORDER BY o.updated_at LIMIT ?`,
      at(deadline * 60_000),
      at(deadline * 60_000),
      graceFrom,
      BATCH,
    )) {
      if (await declineUndecided(env, deps, order, { label: `sistema (límite de espera: ${deadline} min)`, source: "system" }, graceFrom, now.toISOString())) {
        report.deadlines += 1;
      }
    }
  });

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

  // 4. Payments whose webhook never arrived (or failed): ask Stripe directly. Rows rotate
  //    (ORDER BY updated_at, bumped on every attempt) so a few that never sync cannot starve
  //    the rest.
  await step("payments", async () => {
    const expired = Date.parse(at(75 * 60_000));
    for (const order of await rows(
      env,
      `SELECT * FROM orders WHERE status IN ('pending', 'failed')
         AND ((stripe_session_id IS NOT NULL AND created_at >= ?) OR stripe_session_id IS NULL)
         AND created_at <= ? ORDER BY updated_at LIMIT ?`,
      at(26 * 3_600_000),
      at(2 * 60_000),
      BATCH,
    )) {
      if (!order.stripe_session_id) {
        // Checkout never got a payment session attached: nobody can have paid it.
        if (Date.parse(order.created_at) <= expired) {
          await updateOrderIf(env.DB, order.id, order.status, "cancelled", {}, {
            source: "system",
            note: "No se llegó a crear el pago; no se ha cobrado nada",
            now: now.toISOString(),
          });
        }
        continue;
      }
      const synced = await syncOrderPayment(env, deps, order.id, { source: "system" });
      if (!synced.ok) {
        await bump(env, order.id, now.toISOString());
        continue;
      }
      if (synced.changed) report.payments += 1;
      // Sessions last 60 minutes; after that, an unpaid order is closed without charge — unless
      // a payment is still on its way (processing, or the customer completing 3-D Secure).
      const settling = synced.facts && !["requires_payment_method", "canceled"].includes(synced.facts.piStatus);
      if (synced.order.status === order.status && Date.parse(order.created_at) <= expired && !settling) {
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
      if (!synced.ok) await bump(env, order.id, now.toISOString()); // next pass, others first
      if (synced.ok && synced.changed) report.refunds += 1;
    }
  });

  // 6. Alerts that must exist: a new order waiting for the restaurant whose alert rows were lost
  //    (an enqueue that failed after the order changed), and incidents in review that were never
  //    alerted for their latest entry, or have waited unattended for REVIEW_REMINDER_MS since.
  const recipients = alertRecipients(env).length;
  if (recipients) {
    await step("alerts", async () => {
      for (const order of await rows(
        env,
        `SELECT o.* FROM orders o WHERE o.status = 'awaiting_acceptance'
            AND (SELECT COUNT(*) FROM notifications n WHERE n.order_id = o.id AND n.kind = 'new_order') < ?
          ORDER BY o.created_at LIMIT ?`,
        recipients,
        BATCH,
      )) {
        report.alerts += await enqueueNotification(env, order.id, "new_order", now.toISOString());
      }
      for (const order of await rows(
        env,
        `SELECT o.* FROM orders o WHERE o.status = 'needs_review'
            AND NOT EXISTS (SELECT 1 FROM notifications n
                             WHERE n.order_id = o.id AND n.kind = 'needs_review'
                               AND n.updated_at >= COALESCE((SELECT MAX(e.created_at) FROM order_events e
                                                              WHERE e.order_id = o.id AND e.to_status = 'needs_review'), '')
                               AND (n.status <> 'sent' OR n.sent_at > ?))
          ORDER BY o.updated_at LIMIT ?`,
        at(REVIEW_REMINDER_MS),
        BATCH,
      )) {
        report.alerts += await enqueueNotification(env, order.id, "needs_review", now.toISOString(), { rearm: true });
      }
    });
  }

  // 7. Deliver due notifications (new, retries and the reminders/timeouts above).
  await step("notifications", async () => {
    const res = await deliverDue(env, deps, { limit: 40, reminderMinutes: reminder, timeoutMinutes: timeout, paceBudgetMs: CRON_PACE_MS });
    report.sent = res.sent;
    report.failed = res.failed;
  });

  await setState(env.DB, "cron.last_run", JSON.stringify(report), now.toISOString());
  return report;
}
