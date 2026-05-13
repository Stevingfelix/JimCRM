-- Encrypted Gmail OAuth credentials.
-- Singleton at most one active row (single workspace MVP).
-- Tokens are encrypted at rest via AES-GCM in app code; the DB never sees
-- plaintext. RLS denies authenticated direct access — only service-role
-- server code reads/writes this table.

create table public.gmail_credentials (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  encrypted_refresh_token text not null,
  encrypted_access_token text,
  access_token_expires_at timestamptz,
  watched_label text not null default 'CAP-Quotes',
  last_polled_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create unique index gmail_credentials_active_singleton
  on public.gmail_credentials (is_active)
  where is_active;

create trigger gmail_credentials_set_updated_at
  before update on public.gmail_credentials
  for each row execute function public.set_updated_at();

alter table public.gmail_credentials enable row level security;
-- No `authenticated` policy on purpose. Service-role server code is the only
-- caller; client JS must never touch this table.
