-- Capture WHY a quote was won / lost / expired, plus when the outcome was
-- recorded. Lets Jim ask "why are we losing quotes?" after a few months of
-- data, and tunes the AI pricing suggester against actual win rates later.

alter table public.quotes
  add column outcome_reason text,
  add column outcome_at timestamptz;

-- Indexed for "find all lost quotes due to price" type queries.
create index quotes_outcome_reason_idx on public.quotes (outcome_reason)
  where outcome_reason is not null;
