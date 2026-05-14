-- Drive attachments on parts (specs, datasheets, photos). Same shape as
-- quote_attachments but a separate table because the lifecycle is
-- different — part attachments outlive any individual quote.

create table public.part_attachments (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id) on delete cascade,
  drive_file_id text not null,
  name text not null,
  mime_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index part_attachments_part_id_idx on public.part_attachments (part_id);

create trigger part_attachments_set_updated_at
  before update on public.part_attachments
  for each row execute function public.set_updated_at();

alter table public.part_attachments enable row level security;
create policy part_attachments_authenticated_all on public.part_attachments
  for all to authenticated using (true) with check (true);
