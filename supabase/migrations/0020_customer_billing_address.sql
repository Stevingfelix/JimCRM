-- Add billing_address to customers. Used on quote PDFs and in the new
-- customer dialog (extracted from voice / AI-paste alongside contact info).
-- Kept as a free-text block; structured address fields add no value when the
-- PDF just renders it verbatim.

alter table public.customers
  add column billing_address text;
