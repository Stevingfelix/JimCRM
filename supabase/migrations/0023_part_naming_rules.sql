-- Reference data for CAP's internal part-number schema. The LLM extractors
-- read these tables to compose suggested PNs from inbound RFQs / vendor
-- replies, and the /settings/part-rules editor lets the team extend the
-- rules without a code change.
--
-- Seed reflects what's documented in CAP's part-numbering guidelines
-- (families HCS / SCS / MSS / …, imperial size codes, thread codes,
-- the G8Y attribute example). Anything else gets added through the UI.

-- ───────────────────────────────────────────────────────────────────────
-- Families  e.g. HCS = Hex Cap Screw

create table public.part_naming_families (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  -- Whether a part of this family requires a thread code (C/F/XF) and/or
  -- a length code in the PN. Drives "missing fields" detection in the
  -- extractor and which inputs appear in the future Build-a-part composer.
  requires_thread boolean not null default true,
  requires_length boolean not null default true,
  notes text,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);
create unique index part_naming_families_code_idx on public.part_naming_families (code);

create trigger part_naming_families_set_updated_at
  before update on public.part_naming_families
  for each row execute function public.set_updated_at();

alter table public.part_naming_families enable row level security;
create policy part_naming_families_authenticated_all on public.part_naming_families
  for all to authenticated using (true) with check (true);
create policy part_naming_families_read_anon on public.part_naming_families
  for select to anon using (true);

-- ───────────────────────────────────────────────────────────────────────
-- Sizes  e.g. 04 → 1/4", 000 → #2, M6 → M6

create table public.part_naming_sizes (
  id uuid primary key default gen_random_uuid(),
  system text not null check (system in ('imperial', 'metric')),
  code text not null,        -- "04", "M6", "000"
  label text not null,       -- "1/4\"", "M6", "#2"
  -- Optional numeric diameter in inches for sort ordering / fuzzy
  -- matching ("quarter inch" → 0.25).
  diameter_inches numeric,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);
create unique index part_naming_sizes_system_code_idx
  on public.part_naming_sizes (system, code);

create trigger part_naming_sizes_set_updated_at
  before update on public.part_naming_sizes
  for each row execute function public.set_updated_at();

alter table public.part_naming_sizes enable row level security;
create policy part_naming_sizes_authenticated_all on public.part_naming_sizes
  for all to authenticated using (true) with check (true);
create policy part_naming_sizes_read_anon on public.part_naming_sizes
  for select to anon using (true);

-- ───────────────────────────────────────────────────────────────────────
-- Threads  C / F / XF

create table public.part_naming_threads (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);
create unique index part_naming_threads_code_idx on public.part_naming_threads (code);

create trigger part_naming_threads_set_updated_at
  before update on public.part_naming_threads
  for each row execute function public.set_updated_at();

alter table public.part_naming_threads enable row level security;
create policy part_naming_threads_authenticated_all on public.part_naming_threads
  for all to authenticated using (true) with check (true);
create policy part_naming_threads_read_anon on public.part_naming_threads
  for select to anon using (true);

-- ───────────────────────────────────────────────────────────────────────
-- Attributes  e.g. G8Y → Grade 8 Yellow Zinc
-- "kind" tags the attribute family (grade / finish / material / combo).

create table public.part_naming_attributes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  kind text not null default 'combo'
    check (kind in ('grade', 'finish', 'material', 'combo')),
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);
create unique index part_naming_attributes_code_idx on public.part_naming_attributes (code);

create trigger part_naming_attributes_set_updated_at
  before update on public.part_naming_attributes
  for each row execute function public.set_updated_at();

alter table public.part_naming_attributes enable row level security;
create policy part_naming_attributes_authenticated_all on public.part_naming_attributes
  for all to authenticated using (true) with check (true);
create policy part_naming_attributes_read_anon on public.part_naming_attributes
  for select to anon using (true);

-- ───────────────────────────────────────────────────────────────────────
-- Seed: families documented in the guidelines.
-- requires_thread / requires_length set conservatively per family kind:
--   bolts/screws → thread + length required
--   nuts        → thread required, length not
--   washers     → neither
--   pins        → length required, thread not
--   fittings    → neither
-- Jim can adjust per family through the editor.

insert into public.part_naming_families (code, name, requires_thread, requires_length, display_order) values
  ('HCS', 'Hex Cap Screw',            true,  true,  10),
  ('SCS', 'Socket Cap Screw',         true,  true,  20),
  ('MSS', 'Machine Screw SEMS',       true,  true,  30),
  ('HFB', 'Hex Flange Bolt',          true,  true,  40),
  ('FBT', '12-Point Flange Bolt',     true,  true,  50),
  ('HNF', 'Finished Hex Nut',         true,  false, 60),
  ('HFN', 'Hex Flange Nut',           true,  false, 70),
  ('SLW', 'Split Lock Washer',        false, false, 80),
  ('FWH', 'Hardened Flat Washer',     false, false, 90),
  ('FWA', 'Flat Washer Type A',       false, false, 100),
  ('FWB', 'Flat Washer Type B',       false, false, 110),
  ('FWF', 'Fender Washer',            false, false, 120),
  ('CPZ', 'Cotter Pin Zinc',          false, true,  130),
  ('DPM', 'Metric Dowel Pin',         false, true,  140),
  ('NAB', 'Nylon Airbrake Brass Fitting', false, false, 150);

-- Imperial sizes documented in the guidelines.
insert into public.part_naming_sizes (system, code, label, diameter_inches, display_order) values
  ('imperial', '000', '#2',  0.086, 10),
  ('imperial', '00',  '#4',  0.112, 20),
  ('imperial', '01',  '#6',  0.138, 30),
  ('imperial', '02',  '#8',  0.164, 40),
  ('imperial', '03',  '#10', 0.190, 50),
  ('imperial', '04',  '1/4"', 0.25, 60),
  ('imperial', '06',  '3/8"', 0.375, 70),
  ('imperial', '08',  '1/2"', 0.5,   80),
  ('imperial', '10',  '5/8"', 0.625, 90),
  ('imperial', '16',  '1"',   1.0,  100);

-- Metric sizes mentioned as examples.
insert into public.part_naming_sizes (system, code, label, diameter_inches, display_order) values
  ('metric', 'M6',  'M6',  0.236, 10),
  ('metric', 'M8',  'M8',  0.315, 20),
  ('metric', 'M10', 'M10', 0.394, 30);

-- Threads.
insert into public.part_naming_threads (code, label, display_order) values
  ('C',  'Coarse',      10),
  ('F',  'Fine',        20),
  ('XF', 'Extra fine',  30);

-- Attributes. Only the documented example seeded; the editor handles the rest.
insert into public.part_naming_attributes (code, label, kind, display_order) values
  ('G8Y', 'Grade 8 Yellow Zinc', 'combo', 10);
