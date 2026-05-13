-- Dev seed data. Run after migrations on a local Supabase instance.
-- Real seed data (Jim's parts + historical quotes) loads via a separate script
-- once he delivers it (see specs/MVP_BRIEF.md §2.4).

insert into public.parts (internal_pn, description) values
  ('CAP-1001', 'Sample part — replace with real seed data')
on conflict (internal_pn) do nothing;
