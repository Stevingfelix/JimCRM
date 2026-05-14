-- Per-customer pricing levers consumed by the AI suggester.
-- markup_multiplier: multiplied into the AI's suggested price
--   (1.000 = no adjustment, 1.100 = quote 10% higher than baseline,
--    0.950 = quote 5% lower).
-- discount_pct: applied as a flat discount on top of any markup
--   (0.00 = no discount, 10.00 = 10% off).
-- The suggester sees both as context and is told how to apply them.

alter table public.customers
  add column markup_multiplier numeric(5, 3) not null default 1.000,
  add column discount_pct numeric(5, 2) not null default 0.00,
  add column pricing_notes text;

-- Sanity: keep multiplier between 0.500 and 5.000 (no negative pricing,
-- no 500% markups by accident).
alter table public.customers
  add constraint customers_markup_multiplier_range
  check (markup_multiplier >= 0.5 and markup_multiplier <= 5.0);

alter table public.customers
  add constraint customers_discount_pct_range
  check (discount_pct >= 0 and discount_pct <= 50);
