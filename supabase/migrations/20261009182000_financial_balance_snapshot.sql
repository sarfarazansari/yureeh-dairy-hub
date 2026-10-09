-- Snapshot balances by event date. Legacy undated payments are reported separately rather
-- than being assigned an invented date in historical balances.
create or replace function public.get_financial_balance_snapshot(p_as_of date)
returns table (
  snapshot_date date,
  customer_receivables_current numeric,
  customer_credits_current numeric,
  customer_receivables_as_of numeric,
  customer_credits_as_of numeric,
  supplier_outstanding_current numeric,
  supplier_outstanding_as_of_before_legacy numeric,
  supplier_legacy_undated_paid_amount numeric,
  buffalo_purchase_outstanding_current numeric,
  buffalo_purchase_outstanding_as_of_before_legacy numeric,
  buffalo_purchase_legacy_undated_paid_amount numeric,
  buffalo_sale_outstanding_current numeric,
  buffalo_sale_outstanding_as_of numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $financial_snapshot$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_as_of is null then
    raise exception using errcode = '23514', message = 'Choose a historical date for the balance snapshot.';
  end if;

  return query
  with customer_lifetime as (
    select c.id,
      coalesce((select sum(m.calculated_amount) from public.milk_entries m
        where m.user_id = owner_id and m.customer_id = c.id and m.deleted_at is null), 0) as sales,
      coalesce((select sum(cp.amount) from public.customer_payments cp
        where cp.user_id = owner_id and cp.customer_id = c.id), 0) as payments
    from public.customers c
    where c.user_id = owner_id
  ),
  customer_historical as (
    select c.id,
      coalesce((select sum(m.calculated_amount) from public.milk_entries m
        where m.user_id = owner_id and m.customer_id = c.id
          and m.deleted_at is null and m.business_date <= p_as_of), 0) as sales,
      coalesce((select sum(cp.amount) from public.customer_payments cp
        where cp.user_id = owner_id and cp.customer_id = c.id
          and cp.payment_date <= p_as_of), 0) as payments
    from public.customers c
    where c.user_id = owner_id
  ),
  expense_ledger as (
    select e.id, e.total_amount, e.paid_amount,
      coalesce((select sum(ep.amount) from public.expense_payments ep
        where ep.user_id = owner_id and ep.expense_id = e.id), 0) as all_dated_payments,
      coalesce((select sum(ep.amount) from public.expense_payments ep
        where ep.user_id = owner_id and ep.expense_id = e.id
          and ep.payment_date <= p_as_of), 0) as dated_payments_as_of
    from public.expenses e
    where e.user_id = owner_id and e.deleted_at is null
  ),
  purchase_ledger as (
    select bp.id, bp.purchase_price, bp.amount_paid,
      coalesce((select sum(p.amount) from public.buffalo_purchase_payments p
        where p.user_id = owner_id and p.buffalo_id = bp.buffalo_id), 0) as all_dated_payments,
      coalesce((select sum(p.amount) from public.buffalo_purchase_payments p
        where p.user_id = owner_id and p.buffalo_id = bp.buffalo_id
          and p.payment_date <= p_as_of), 0) as dated_payments_as_of,
      bp.purchase_date
    from public.buffalo_purchases bp
    where bp.user_id = owner_id
  ),
  sale_ledger as (
    select s.id, s.sale_price, s.amount_pending, s.sale_date,
      coalesce((select sum(p.amount) from public.buffalo_sale_payments p
        where p.user_id = owner_id and p.buffalo_sale_id = s.id), 0) as all_payments,
      coalesce((select sum(p.amount) from public.buffalo_sale_payments p
        where p.user_id = owner_id and p.buffalo_sale_id = s.id
          and p.payment_date <= p_as_of), 0) as payments_as_of
    from public.buffalo_sales s
    where s.user_id = owner_id
  )
  select
    p_as_of,
    coalesce((select sum(greatest(sales - payments, 0)) from customer_lifetime), 0),
    coalesce((select sum(greatest(payments - sales, 0)) from customer_lifetime), 0),
    coalesce((select sum(greatest(sales - payments, 0)) from customer_historical), 0),
    coalesce((select sum(greatest(payments - sales, 0)) from customer_historical), 0),
    coalesce((select sum(greatest(total_amount - paid_amount, 0)) from expense_ledger), 0),
    coalesce((select sum(greatest(e.total_amount - e.dated_payments_as_of, 0))
      from expense_ledger e
      join public.expenses source on source.id = e.id
      where source.business_date <= p_as_of), 0),
    coalesce((select sum(greatest(paid_amount - all_dated_payments, 0)) from expense_ledger), 0),
    coalesce((select sum(bp.amount_pending) from public.buffalo_purchases bp
      where bp.user_id = owner_id), 0),
    coalesce((select sum(greatest(purchase_price - dated_payments_as_of, 0))
      from purchase_ledger where purchase_date <= p_as_of), 0),
    coalesce((select sum(greatest(amount_paid - all_dated_payments, 0))
      from purchase_ledger), 0),
    coalesce((select sum(amount_pending) from sale_ledger), 0),
    coalesce((select sum(greatest(sale_price - payments_as_of, 0))
      from sale_ledger where sale_date <= p_as_of), 0);
end;
$financial_snapshot$;

revoke all on function public.get_financial_balance_snapshot(date) from public, anon;
grant execute on function public.get_financial_balance_snapshot(date) to authenticated;
