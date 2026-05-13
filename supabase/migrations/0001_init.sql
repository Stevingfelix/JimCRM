-- CAP Hardware Quoting System — initial schema
-- Single-workspace MVP: every authenticated user can read/write all rows.
-- Tighten RLS in a later migration when multi-tenant becomes a real requirement.

create extension if not exists "pgcrypto";

-- =========================================================================
-- Audit trigger: stamp updated_at on every UPDATE.
-- updated_by is set by the application (server actions / route handlers).
-- =========================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================================
-- parts + aliases
-- =========================================================================
create table public.parts (
  id uuid primary key default gen_random_uuid(),
  internal_pn text not null unique,
  description text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz
);

create index parts_internal_pn_trgm on public.parts using gin (internal_pn gin_trgm_ops);
create extension if not exists pg_trgm;

create table public.part_aliases (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id) on delete cascade,
  alias_pn text not null,
  source_type text, -- 'customer' | 'manufacturer' | 'vendor' | 'other'
  source_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index part_aliases_alias_pn_idx on public.part_aliases (alias_pn);
create index part_aliases_part_id_idx on public.part_aliases (part_id);

-- =========================================================================
-- customers + contacts
-- =========================================================================
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contacts jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text,
  email text,
  phone text,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index customer_contacts_customer_id_idx on public.customer_contacts (customer_id);
create index customer_contacts_email_idx on public.customer_contacts (lower(email));

-- =========================================================================
-- vendors + contacts
-- =========================================================================
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  categories text[] not null default '{}',
  contacts jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.vendor_contacts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text,
  email text,
  phone text,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index vendor_contacts_vendor_id_idx on public.vendor_contacts (vendor_id);
create index vendor_contacts_email_idx on public.vendor_contacts (lower(email));

-- =========================================================================
-- pdf_templates
-- =========================================================================
create table public.pdf_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  react_component_key text not null unique,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create unique index pdf_templates_one_default on public.pdf_templates (is_default) where is_default;

-- =========================================================================
-- quotes + lines
-- =========================================================================
create type quote_status as enum ('draft', 'sent', 'won', 'lost', 'expired');

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  status quote_status not null default 'draft',
  validity_date date,
  customer_notes text,
  internal_notes text,
  template_id uuid references public.pdf_templates(id),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz
);

create index quotes_customer_id_idx on public.quotes (customer_id);
create index quotes_status_idx on public.quotes (status);
create index quotes_created_at_idx on public.quotes (created_at desc);

create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  part_id uuid references public.parts(id),
  qty numeric(14, 4) not null,
  unit_price numeric(14, 4),
  line_notes_internal text,
  line_notes_customer text,
  ai_suggested_price numeric(14, 4),
  ai_reasoning text,
  override_reason text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index quote_lines_quote_id_idx on public.quote_lines (quote_id);
create index quote_lines_part_id_idx on public.quote_lines (part_id);
-- Composite supports "last 5 quotes for part X" history popover.
create index quote_lines_part_history_idx on public.quote_lines (part_id, created_at desc);

-- =========================================================================
-- vendor_quotes
-- =========================================================================
create table public.vendor_quotes (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id),
  part_id uuid references public.parts(id),
  qty numeric(14, 4),
  unit_price numeric(14, 4) not null,
  lead_time_days integer,
  quoted_at timestamptz not null default now(),
  source_message_id text, -- gmail_msg_id when ingested from email
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index vendor_quotes_vendor_part_idx on public.vendor_quotes (vendor_id, part_id);
create index vendor_quotes_part_recent_idx on public.vendor_quotes (part_id, quoted_at desc);

-- =========================================================================
-- email_events (gmail polling state)
-- =========================================================================
create type parse_status as enum ('pending', 'parsed', 'failed', 'skipped');

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  gmail_msg_id text not null unique,
  label text,
  received_at timestamptz,
  parse_status parse_status not null default 'pending',
  parsed_payload jsonb,
  needs_review boolean not null default false,
  linked_quote_id uuid references public.quotes(id),
  linked_vendor_quote_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index email_events_needs_review_idx on public.email_events (needs_review) where needs_review;
create index email_events_received_at_idx on public.email_events (received_at desc);

-- =========================================================================
-- quote_attachments (Drive links)
-- =========================================================================
create table public.quote_attachments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  drive_file_id text not null,
  name text not null,
  mime_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index quote_attachments_quote_id_idx on public.quote_attachments (quote_id);

-- =========================================================================
-- updated_at triggers (one per table)
-- =========================================================================
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'parts','part_aliases','customers','customer_contacts',
      'vendors','vendor_contacts','pdf_templates','quotes','quote_lines',
      'vendor_quotes','email_events','quote_attachments'
    ])
  loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
       for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end;
$$;

-- =========================================================================
-- RLS — single-workspace MVP. Any authenticated user can do anything.
-- =========================================================================
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'parts','part_aliases','customers','customer_contacts',
      'vendors','vendor_contacts','pdf_templates','quotes','quote_lines',
      'vendor_quotes','email_events','quote_attachments'
    ])
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t || '_authenticated_all', t
    );
  end loop;
end;
$$;

-- =========================================================================
-- Seed default PDF template row (component lives in src/pdf/templates/)
-- =========================================================================
insert into public.pdf_templates (name, react_component_key, is_default)
values ('CAP Branded', 'cap-branded', true);
