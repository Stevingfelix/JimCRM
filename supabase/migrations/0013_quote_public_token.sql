-- Long-random tokens for sharing a quote with the customer via a public URL.
-- They can view the PDF + click Accept / Reject without an account.
-- Token is regenerated each time the quote is "shared" so revoking an old
-- link is just clicking Share again.

create extension if not exists pgcrypto;

alter table public.quotes
  add column public_token text,
  add column public_shared_at timestamptz;

create unique index quotes_public_token_idx
  on public.quotes (public_token)
  where public_token is not null;

-- Generate a fresh 32-byte URL-safe token. Used by the share action.
create or replace function public.gen_quote_public_token()
returns text
language plpgsql
security definer
as $$
declare
  t text;
begin
  -- 32 random bytes encoded as base64url-ish (replace +/= so it's URL-safe).
  t := translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_.');
  return t;
end;
$$;
