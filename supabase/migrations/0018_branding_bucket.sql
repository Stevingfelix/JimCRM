-- Public storage bucket for company logos. Anyone can read (logos appear in
-- the sidebar and PDFs); only authenticated users can write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'branding',
  'branding',
  true,
  2 * 1024 * 1024, -- 2MB cap; logos shouldn't be bigger than that
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- RLS on storage.objects is enabled by default in Supabase.
drop policy if exists "branding_public_read" on storage.objects;
create policy "branding_public_read" on storage.objects
  for select using (bucket_id = 'branding');

drop policy if exists "branding_authenticated_write" on storage.objects;
create policy "branding_authenticated_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'branding');

drop policy if exists "branding_authenticated_update" on storage.objects;
create policy "branding_authenticated_update" on storage.objects
  for update to authenticated using (bucket_id = 'branding');

drop policy if exists "branding_authenticated_delete" on storage.objects;
create policy "branding_authenticated_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'branding');
