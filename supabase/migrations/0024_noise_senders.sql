-- Sender blocklist. When a human rejects an email in the review queue,
-- we record the sender so future polls can skip that sender entirely —
-- bypassing both the Haiku triage call and the Sonnet extractor.
--
-- Auto-populated by rejectReview / rejectReviewBulk server actions.
-- A future settings UI can let an admin remove entries (false positives).

create table public.known_noise_senders (
  sender_email text primary key,
  first_rejected_at timestamptz not null default now(),
  last_rejected_at timestamptz not null default now(),
  rejected_count int not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index known_noise_senders_last_rejected_at_idx
  on public.known_noise_senders(last_rejected_at desc);

-- updated_at trigger to match the rest of the schema.
create trigger known_noise_senders_set_updated_at
  before update on public.known_noise_senders
  for each row execute function public.set_updated_at();

-- RLS: same as other admin-managed tables. The poll cron uses the service
-- role and bypasses RLS; the future UI for admins can read/delete rows.
alter table public.known_noise_senders enable row level security;

create policy "known_noise_senders_select_authenticated"
  on public.known_noise_senders for select
  to authenticated using (true);

create policy "known_noise_senders_delete_authenticated"
  on public.known_noise_senders for delete
  to authenticated using (true);
