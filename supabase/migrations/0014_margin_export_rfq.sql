-- Three additions in one migration:
--
-- 1) parts.target_margin_pct — drives the margin badge on quote lines.
--    The AI suggester also reads it to nudge prices toward target.
-- 2) csv_export_profiles — Jim configures column names to match his ERP's
--    expected CSV import format. /api/export/csv?profile=<name> uses it.
-- 3) vendor_rfqs — tracks outbound RFQs Jim sends to vendors so we can show
--    "you RFQ'd Fastenal 3 days ago, still waiting" on a part.

alter table public.parts
  add column target_margin_pct numeric(5, 2) not null default 30.00,
  add constraint parts_target_margin_range
    check (target_margin_pct >= 0 and target_margin_pct <= 95);

-- --------------------------------------------------------------------

create table public.csv_export_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  -- column_map is { ourColumnKey: erpColumnName }
  -- e.g. { "internal_pn": "Item_Code", "qty": "Quantity_Ordered" }
  column_map jsonb not null default '{}'::jsonb,
  -- columns_order is an ordered array of our keys that should be exported,
  -- in the order the ERP expects.
  -- e.g. ["quote_number", "internal_pn", "qty", "unit_price"]
  columns_order text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create unique index csv_export_profiles_name_idx
  on public.csv_export_profiles (name);

-- Only one default profile at a time.
create unique index csv_export_profiles_default_singleton
  on public.csv_export_profiles (is_default)
  where is_default;

create trigger csv_export_profiles_set_updated_at
  before update on public.csv_export_profiles
  for each row execute function public.set_updated_at();

alter table public.csv_export_profiles enable row level security;
create policy csv_export_profiles_authenticated_all on public.csv_export_profiles
  for all to authenticated using (true) with check (true);

-- --------------------------------------------------------------------

create table public.vendor_rfqs (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references public.quotes(id) on delete set null,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  part_ids uuid[] not null default '{}',
  subject text not null,
  body text not null,
  status text not null default 'drafted', -- drafted | sent | reply_received | closed
  sent_at timestamptz,
  reply_at timestamptz,
  reply_vendor_quote_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index vendor_rfqs_vendor_id_idx
  on public.vendor_rfqs (vendor_id, created_at desc);
create index vendor_rfqs_quote_id_idx
  on public.vendor_rfqs (quote_id)
  where quote_id is not null;
create index vendor_rfqs_status_idx
  on public.vendor_rfqs (status);

create trigger vendor_rfqs_set_updated_at
  before update on public.vendor_rfqs
  for each row execute function public.set_updated_at();

alter table public.vendor_rfqs enable row level security;
create policy vendor_rfqs_authenticated_all on public.vendor_rfqs
  for all to authenticated using (true) with check (true);
