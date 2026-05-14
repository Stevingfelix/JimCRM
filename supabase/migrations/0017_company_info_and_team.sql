-- Two related additions that fill in the "we forgot settings" gap:
--
-- 1) company_info — singleton row holding business identity that flows into
--    PDFs (header/footer), the sidebar (name + logo), and the dashboard.
--    Jim wants to swap the hardcoded "CAP Hardware Supply" without editing
--    React-PDF templates.
--
-- 2) team_invites — pending email-based invitations. The actual user accounts
--    live in auth.users; this table just tracks who-was-invited so admins
--    can see "we sent Mike an invite 2 days ago, still hasn't accepted."
--    Acceptance flows through Supabase magic links; the trigger marks the
--    invite as 'accepted' when the matching email signs in for the first
--    time, and stamps the role into auth.users.app_metadata.role.

-- --------------------------------------------------------------------
-- company_info (singleton)

create table public.company_info (
  id uuid primary key default gen_random_uuid(),
  is_active boolean not null default true,
  company_name text not null default 'My Company',
  tagline text,
  contact_email text,
  phone text,
  website text,
  -- Address kept as a single free-text block on purpose; structured fields
  -- add no value for PDFs that just render it verbatim.
  address text,
  tax_id text,
  -- Path inside the "branding" storage bucket, e.g. "logo-1715000000.png".
  -- Resolved to a public URL at read time.
  logo_path text,
  pdf_footer_text text,
  -- Hex like "#10b981" — used for accent strokes in PDFs and the sidebar
  -- monogram tile. Kept optional so a stripped-down install can ignore it.
  brand_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- Only one active row at a time. The app reads the active row everywhere.
create unique index company_info_active_singleton
  on public.company_info (is_active)
  where is_active;

create trigger company_info_set_updated_at
  before update on public.company_info
  for each row execute function public.set_updated_at();

alter table public.company_info enable row level security;
-- Everyone reads (for sidebar/PDFs), only authenticated writes.
create policy company_info_read on public.company_info
  for select using (true);
create policy company_info_write on public.company_info
  for insert to authenticated with check (true);
create policy company_info_update on public.company_info
  for update to authenticated using (true) with check (true);

-- Seed the singleton.
insert into public.company_info (company_name, contact_email, brand_color)
values ('CAP Hardware Supply', 'info@caphardware.com', '#10b981');

-- --------------------------------------------------------------------
-- team_invites

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null default 'user', -- 'admin' | 'user'
  status text not null default 'pending', -- 'pending' | 'accepted' | 'revoked'
  invited_by uuid references auth.users(id),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index team_invites_email_pending_idx
  on public.team_invites (lower(email))
  where status = 'pending';

create index team_invites_status_idx on public.team_invites (status);

create trigger team_invites_set_updated_at
  before update on public.team_invites
  for each row execute function public.set_updated_at();

alter table public.team_invites enable row level security;
create policy team_invites_authenticated_all on public.team_invites
  for all to authenticated using (true) with check (true);

-- When a user signs in for the first time and they have a pending invite,
-- mark it accepted and stamp the role into auth.users.app_metadata.role.
-- Runs as a trigger on auth.users insert (Supabase fires this when the
-- magic-link signup completes).
create or replace function public.handle_team_invite_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_role text;
  invite_id uuid;
begin
  select id, role into invite_id, invite_role
  from public.team_invites
  where lower(email) = lower(new.email)
    and status = 'pending'
  limit 1;

  if invite_id is not null then
    update public.team_invites
      set status = 'accepted',
          accepted_at = now(),
          accepted_user_id = new.id
      where id = invite_id;

    update auth.users
      set raw_app_meta_data =
        coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', invite_role)
      where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_apply_invite on auth.users;
create trigger on_auth_user_created_apply_invite
  after insert on auth.users
  for each row execute function public.handle_team_invite_acceptance();
