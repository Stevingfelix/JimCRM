-- TEMPORARY: open RLS to the anon role so the UI works while Supabase auth
-- is still pending. Without this, the page queries (which use the anon-key
-- client) see zero rows because the existing policies are scoped to the
-- `authenticated` role only.
--
-- REMOVE THIS MIGRATION once Day-7 auth lands — replace with a proper
-- auth.uid() check on the existing authenticated policies.

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
      'create policy %I on public.%I for all to anon using (true) with check (true);',
      t || '_anon_temp', t
    );
  end loop;
end;
$$;
