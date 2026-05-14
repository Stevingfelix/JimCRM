-- Telemetry log of every Anthropic API call.
-- Lets you see token usage per call type, spot cost spikes early, and audit
-- which extractions came from which model.
--
-- Service-role only — this contains no customer data but is internal metrics.

create table public.llm_calls (
  id uuid primary key default gen_random_uuid(),
  call_type text not null, -- 'email_body' | 'pdf_attachment' | 'excel_attachment' | 'price_suggest'
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  cache_read_input_tokens integer not null default 0,
  estimated_cost_usd numeric(10, 6) not null default 0,
  related_id uuid, -- email_event_id, quote_line_id, etc. (caller's choice)
  succeeded boolean not null default true,
  error_message text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index llm_calls_call_type_created_at_idx
  on public.llm_calls (call_type, created_at desc);
create index llm_calls_created_at_idx on public.llm_calls (created_at desc);

alter table public.llm_calls enable row level security;
-- No authenticated policy — service-role only.
-- Read access for admin dashboard goes through a server action using
-- the admin client.
