-- Fix RLS violation when changing quote status or editing lines from a real
-- user session.
--
-- The audit triggers in 0012 inserted into quote_events as the *caller's*
-- role. RLS on quote_events grants SELECT to authenticated but no INSERT —
-- by design (the table comment says "only triggers write here"). The trigger
-- functions therefore got rejected by RLS, blocking every status change for
-- non-service-role users.
--
-- Right pattern for append-only audit triggers: SECURITY DEFINER. The
-- function runs with the owner's privileges and skips RLS, preserving the
-- "no client can insert directly" invariant.

create or replace function public.log_quote_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
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

create or replace function public.log_quote_line_change()
returns trigger
language plpgsql
security definer
set search_path = public
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
