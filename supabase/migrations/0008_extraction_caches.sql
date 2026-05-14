-- Two caches that never introduce trade-offs:
--
-- 1. attachment_extractions: keyed by sha256(file_bytes) + prompt_version.
--    Same bytes + same prompt version → guaranteed identical extraction,
--    so we skip the LLM call. Bumping prompt_version (in code) automatically
--    invalidates all prior entries.
--
-- 2. price_suggestion_cache: keyed by (part_id, qty_bucket, customer_id).
--    Triggers automatically delete cached suggestions when the underlying
--    inputs change (vendor_quotes or quote_lines for the same part). No
--    stale data possible.

create table public.attachment_extractions (
  id uuid primary key default gen_random_uuid(),
  content_hash text not null,
  prompt_version text not null,
  extraction jsonb not null,
  hit_count integer not null default 1,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz not null default now()
);

create unique index attachment_extractions_hash_ver
  on public.attachment_extractions (content_hash, prompt_version);

alter table public.attachment_extractions enable row level security;
-- service-role only; never read from the client.

-- ----------------------------------------------------------------------

create table public.price_suggestion_cache (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id) on delete cascade,
  qty_bucket text not null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  suggested_price numeric(14, 4) not null,
  confidence numeric(3, 2) not null,
  reasoning text not null,
  created_at timestamptz not null default now()
);

create unique index price_suggestion_cache_key
  on public.price_suggestion_cache (part_id, qty_bucket, customer_id);

alter table public.price_suggestion_cache enable row level security;
-- service-role only.

-- Invalidate on any vendor_quote write that touches a cached part.
create or replace function public.invalidate_price_cache_vendor()
returns trigger
language plpgsql
as $$
begin
  if NEW.part_id is not null then
    delete from public.price_suggestion_cache where part_id = NEW.part_id;
  end if;
  return NEW;
end;
$$;

create trigger vendor_quotes_invalidate_price_cache
after insert or update on public.vendor_quotes
for each row execute function public.invalidate_price_cache_vendor();

-- Invalidate on any quote_line write that touches a cached part.
create or replace function public.invalidate_price_cache_quote_line()
returns trigger
language plpgsql
as $$
begin
  if NEW.part_id is not null then
    delete from public.price_suggestion_cache where part_id = NEW.part_id;
  end if;
  return NEW;
end;
$$;

create trigger quote_lines_invalidate_price_cache
after insert or update on public.quote_lines
for each row execute function public.invalidate_price_cache_quote_line();
