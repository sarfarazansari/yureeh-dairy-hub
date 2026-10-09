-- Keep customer financial KPIs accurate without loading the full sales history.
-- The detail page may show a bounded recent-entry list, but balances use this aggregate.
create or replace function public.get_customer_financial_summary(p_customer_id uuid)
returns table (
  total_milk_quantity numeric,
  total_sales_amount numeric,
  entry_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(me.milk_quantity), 0) as total_milk_quantity,
    coalesce(sum(me.calculated_amount), 0) as total_sales_amount,
    count(*) as entry_count
  from public.milk_entries me
  where me.user_id = (select auth.uid())
    and me.customer_id = p_customer_id
    and me.deleted_at is null
    and exists (
      select 1
      from public.customers c
      where c.id = p_customer_id
        and c.user_id = (select auth.uid())
    );
$$;

revoke all on function public.get_customer_financial_summary(uuid) from public, anon;
grant execute on function public.get_customer_financial_summary(uuid) to authenticated;
