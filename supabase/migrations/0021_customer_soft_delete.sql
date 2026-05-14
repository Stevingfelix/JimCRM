-- Soft-delete column for customers. Matches the existing pattern on quotes
-- and parts. listCustomers() filters out rows where deleted_at is set;
-- nothing hard-deletes a customer.

alter table public.customers
  add column deleted_at timestamptz;

create index customers_active_idx on public.customers (name)
  where deleted_at is null;
