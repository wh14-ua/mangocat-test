-- 0003: accept/reject locks get an owner and an expiry (QA audit 2026-11-06, PAY-F1).
--
-- Before this, any request (the cron, or REINTENTAR from another phone) could undo an
-- "accepting" lock while the request that took it was still capturing the payment at Stripe:
-- the card was charged while the order went back to pending. Now only the owner (lock_token)
-- may finish or undo a lock, and recovery may only take over a lock whose lock_expires_at has
-- passed. Additive only: existing rows keep working (NULL = a lock taken before this
-- migration, treated as expired once it is older than the stale threshold).
ALTER TABLE orders ADD COLUMN lock_token TEXT;
ALTER TABLE orders ADD COLUMN lock_expires_at TEXT;
