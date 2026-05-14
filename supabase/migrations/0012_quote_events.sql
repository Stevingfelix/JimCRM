-- Audit trail for quotes. Triggers automatically capture status changes
-- (with from/to and outcome reason) plus line edits. Read-only from the
-- UI; nothing should INSERT directly except the triggers.

create table public.quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  event_type text not null, -- "status_change" | "line_created" | "line_updated" | "line_deleted" | "quote_updated"
  event_data jsonb,
  performed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index quote_events_quote_id_idx
  on public.quote_events (quote_id, created_at desc);

alter table public.quote_events enable row level security;
create policy quote_events_authenticated_read on public.quote_events
  for select to authenticated using (true);
-- No insert/update/delete policies — only triggers write here.

-- --------------------------------------------------------------------

create or replace function public.log_quote_status_change()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and NEW.status is distinct from OLD.status then
    insert into public.quote_events (quote_id, event_type, event_data, performed_by)
    values (
      NEW.id,
      'status_change',
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status,
        'outcome_reason', NEW.outcome_reason
      ),
      NEW.updated_by
    );
  end if;
  return NEW;
end;
$$;

create trigger quotes_log_status_change
after update on public.quotes
for each row execute function public.log_quote_status_change();

-- --------------------------------------------------------------------

create or replace function public.log_quote_line_change()
returns trigger
language plpgsql
as $$
declare
  qid uuid;
begin
  if TG_OP = 'INSERT' then
    insert into public.quote_events (quote_id, event_type, event_data, performed_by)
    values (
      NEW.quote_id,
      'line_created',
      jsonb_build_object(
        'line_id', NEW.id,
        'part_id', NEW.part_id,
        'qty', NEW.qty,
        'unit_price', NEW.unit_price,
        'position', NEW.position
      ),
      NEW.created_by
    );
    return NEW;

  elsif TG_OP = 'UPDATE' then
    -- Only log when something meaningful changed (skip pure timestamp updates).
    if NEW.part_id is distinct from OLD.part_id
       or NEW.qty is distinct from OLD.qty
       or NEW.unit_price is distinct from OLD.unit_price
       or NEW.override_reason is distinct from OLD.override_reason then
      insert into public.quote_events (quote_id, event_type, event_data, performed_by)
      values (
        NEW.quote_id,
        'line_updated',
        jsonb_build_object(
          'line_id', NEW.id,
          'changes', jsonb_strip_nulls(jsonb_build_object(
            'part_id', case when NEW.part_id is distinct from OLD.part_id then jsonb_build_array(OLD.part_id, NEW.part_id) end,
            'qty', case when NEW.qty is distinct from OLD.qty then jsonb_build_array(OLD.qty, NEW.qty) end,
            'unit_price', case when NEW.unit_price is distinct from OLD.unit_price then jsonb_build_array(OLD.unit_price, NEW.unit_price) end,
            'override_reason', case when NEW.override_reason is distinct from OLD.override_reason then jsonb_build_array(OLD.override_reason, NEW.override_reason) end
          ))
        ),
        NEW.updated_by
      );
    end if;
    return NEW;

  elsif TG_OP = 'DELETE' then
    qid := OLD.quote_id;
    insert into public.quote_events (quote_id, event_type, event_data, performed_by)
    values (
      qid,
      'line_deleted',
      jsonb_build_object(
        'line_id', OLD.id,
        'part_id', OLD.part_id,
        'qty', OLD.qty,
        'unit_price', OLD.unit_price
      ),
      OLD.updated_by
    );
    return OLD;
  end if;
  return null;
end;
$$;

create trigger quote_lines_log_changes
after insert or update or delete on public.quote_lines
for each row execute function public.log_quote_line_change();
