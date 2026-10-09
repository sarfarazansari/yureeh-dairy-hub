-- Keep customer financial KPIs accurate without loading full sales or payment history.
-- The detail page may show bounded recent-history lists, but balances use this aggregate.
create or replace function public.get_customer_financial_summary(p_customer_id uuid)
returns table (
  total_milk_quantity numeric,
  total_sales_amount numeric,
  entry_count bigint,
  total_payments_amount numeric,
  payment_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sales.total_milk_quantity, 0) as total_milk_quantity,
    coalesce(sales.total_sales_amount, 0) as total_sales_amount,
    coalesce(sales.entry_count, 0) as entry_count,
    coalesce(payments.total_payments_amount, 0) as total_payments_amount,
    coalesce(payments.payment_count, 0) as payment_count
  from (
    select
      sum(me.milk_quantity) as total_milk_quantity,
      sum(me.calculated_amount) as total_sales_amount,
      count(*) as entry_count
    from public.milk_entries me
    where me.user_id = (select auth.uid())
      and me.customer_id = p_customer_id
      and me.deleted_at is null
  ) sales
  cross join (
    select
      sum(cp.amount) as total_payments_amount,
      count(*) as payment_count
    from public.customer_payments cp
    where cp.user_id = (select auth.uid())
      and cp.customer_id = p_customer_id
  ) payments
  where exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.user_id = (select auth.uid())
  );
$$;

revoke all on function public.get_customer_financial_summary(uuid) from public, anon;
grant execute on function public.get_customer_financial_summary(uuid) to authenticated;
