-- Add vendor-specific metadata to vendor_quotes so extracted details
-- (stock status, availability, packaging, weight) aren't lost on commit.
ALTER TABLE public.vendor_quotes
  ADD COLUMN stock_status text,
  ADD COLUMN availability_date text,
  ADD COLUMN packaging_note text,
  ADD COLUMN weight text;
