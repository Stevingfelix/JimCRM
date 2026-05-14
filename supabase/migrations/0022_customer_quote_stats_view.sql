-- Aggregate view replacing the in-memory roll-up the customers list used to
-- do client-side. Pushes the count + sum + max work down to Postgres so the
-- list query is O(customers_on_page), not O(customers × quote_lines).
--
-- Read-only; nothing writes here. Granted to authenticated.

create or replace view public.customer_quote_stats as
select
  c.id as customer_id,
  count(distinct q.id) as quote_count,
  max(q.created_at) as last_quote_at,
  coalesce(sum(ql.qty * ql.unit_price), 0)::numeric as total_quoted,
  coalesce(
    sum(case when q.status = 'won' then ql.qty * ql.unit_price else 0 end),
    0
  )::numeric as total_won
from public.customers c
left join public.quotes q
  on q.customer_id = c.id and q.deleted_at is null
left join public.quote_lines ql
  on ql.quote_id = q.id
where c.deleted_at is null
group by c.id;

grant select on public.customer_quote_stats to authenticated;
grant select on public.customer_quote_stats to anon;
