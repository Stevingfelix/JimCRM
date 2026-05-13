-- Drop the temporary anon RLS policies added by migration 0004.
-- Supabase auth is now wired; the existing `authenticated` policies from
-- 0001_init.sql take over.

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'parts','part_aliases','customers','customer_contacts',
      'vendors','vendor_contacts','pdf_templates','quotes','quote_lines',
      'vendor_quotes','email_events','quote_attachments'
    ])
  loop
    execute format(
      'drop policy if exists %I on public.%I;',
      t || '_anon_temp', t
    );
  end loop;
end;
$$;
