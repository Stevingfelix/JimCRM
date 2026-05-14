-- Fields for Gmail Push (Pub/Sub) — v1.1 alternative to polling.
-- - last_history_id: the historyId we've already processed up to. Pub/Sub
--   pushes only include "something changed, here's the latest historyId" —
--   we then call history.list(startHistoryId=this) to get the delta.
-- - watch_expiration: Gmail's watch() expires after 7 days, so a weekly
--   cron renews it.

alter table public.gmail_credentials
  add column last_history_id text,
  add column watch_expiration timestamptz;
