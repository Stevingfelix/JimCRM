-- Rename the single "description" column to "short_description" and add
-- "long_description" for extended part details. UI labels change from
-- "Internal PN" to "SKU" but the column name stays internal_pn to avoid
-- massive migration churn.

ALTER TABLE public.parts RENAME COLUMN description TO short_description;
ALTER TABLE public.parts ADD COLUMN long_description text;
