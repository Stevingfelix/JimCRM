-- Structured hardware spec fields on parts. Enables the extractor to parse
-- specs like thread size, length, material, finish, and grade into dedicated
-- columns instead of losing them in free-text descriptions.

ALTER TABLE public.parts
  ADD COLUMN product_family text,
  ADD COLUMN thread_size text,
  ADD COLUMN length text,
  ADD COLUMN material text,
  ADD COLUMN finish text,
  ADD COLUMN grade text,
  ADD COLUMN head_type text;

-- Partial indexes for filtered search (most parts won't have all specs)
CREATE INDEX parts_product_family_idx ON public.parts (product_family) WHERE product_family IS NOT NULL;
CREATE INDEX parts_thread_size_idx ON public.parts (thread_size) WHERE thread_size IS NOT NULL;
CREATE INDEX parts_material_idx ON public.parts (material) WHERE material IS NOT NULL;
