-- Enable Supabase Realtime for email_events so the notification bell
-- subscribes to INSERT/UPDATE events directly.
alter publication supabase_realtime add table public.email_events;
