-- Human-friendly quote number ("Q-0492") for display + ERP export.
-- Stored as an integer, formatted in the app layer (e.g. `Q-${n.padStart(4,'0')}`).

create sequence if not exists public.quote_number_seq start 1;

alter table public.quotes
  add column quote_number integer not null default nextval('public.quote_number_seq');

create unique index quotes_quote_number_idx on public.quotes (quote_number);
