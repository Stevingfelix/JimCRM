-- Alias suggestions — captured when a human commits a reviewed line where
-- the original raw_text didn't match the picked part's internal_pn or any
-- existing alias. Suggestions surface on the part detail page with Accept
-- (promote to part_aliases) and Dismiss (delete) actions.
--
-- Aliases compound — a wrong one poisons all future matches. So we never
-- auto-promote: every alias write is a human decision.

create table public.part_alias_suggestions (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id) on delete cascade,
  alias_pn text not null,
  source_type text, -- 'customer' | 'vendor' | 'manufacturer' | 'other'
  source_name text,
  raw_text text,
  reasoning text,
  source_event_id uuid references public.email_events(id) on delete set null,
  status text not null default 'pending', -- pending | accepted | dismissed
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- One pending suggestion per (part_id, alias_pn). Re-suggesting the same
-- pairing is a no-op while it's still pending; after accept/dismiss the
-- partial index releases so the same suggestion can re-fire if the AI
-- sees the alias again.
create unique index part_alias_suggestions_pending_unique_idx
  on public.part_alias_suggestions(part_id, lower(alias_pn))
  where status = 'pending';

create index part_alias_suggestions_status_idx
  on public.part_alias_suggestions(status, created_at desc);

create index part_alias_suggestions_part_id_idx
  on public.part_alias_suggestions(part_id);

create trigger part_alias_suggestions_set_updated_at
  before update on public.part_alias_suggestions
  for each row execute function public.set_updated_at();

alter table public.part_alias_suggestions enable row level security;

create policy "part_alias_suggestions_select_authenticated"
  on public.part_alias_suggestions for select
  to authenticated using (true);

create policy "part_alias_suggestions_update_authenticated"
  on public.part_alias_suggestions for update
  to authenticated using (true) with check (true);

create policy "part_alias_suggestions_delete_authenticated"
  on public.part_alias_suggestions for delete
  to authenticated using (true);
