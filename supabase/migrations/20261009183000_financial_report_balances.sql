-- Preserve the existing period KPI contract and add explicit as-of balances.
-- The function is recreated because PostgreSQL cannot change a RETURNS TABLE row type in place.
drop function public.get_farm_financial_summary(date, date);
create function public.get_farm_financial_summary(p_from date, p_to date)
returns table (
  milk_quantity_sold numeric,
  milk_sales_revenue numeric,
  customer_collections numeric,
  operating_expenses numeric,
  dated_expense_payments numeric,
  customer_receivables numeric,
  customer_credits numeric,
  supplier_outstanding numeric,
  buffalo_purchase_cost numeric,
  buffalo_purchase_payments numeric,
  buffalo_purchase_outstanding numeric,
  legacy_undated_paid_amount numeric,
  customer_receivables_as_of numeric,
  customer_credits_as_of numeric,
  supplier_outstanding_as_of_before_legacy numeric,
  supplier_legacy_undated_paid_amount numeric,
  buffalo_purchase_outstanding_as_of_before_legacy numeric,
  buffalo_purchase_legacy_undated_paid_amount numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $farm_summary$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception using errcode = '23514', message = 'Choose a valid report date range.';
  end if;

  return query
  select
    coalesce((select sum(m.milk_quantity) from public.milk_entries m
      where m.user_id = owner_id and m.deleted_at is null
        and m.business_date between p_from and p_to), 0),
    coalesce((select sum(m.calculated_amount) from public.milk_entries m
      where m.user_id = owner_id and m.deleted_at is null
        and m.business_date between p_from and p_to), 0),
    coalesce((select sum(cp.amount) from public.customer_payments cp
      where cp.user_id = owner_id and cp.payment_date between p_from and p_to), 0),
    coalesce((select sum(greatest(e.total_amount - coalesce(capitalized.amount, 0), 0))
      from public.expenses e
      left join lateral (
        select sum(c.amount) as amount
        from public.buffalo_acquisition_costs c
        where c.user_id = owner_id and c.expense_id = e.id
      ) capitalized on true
      where e.user_id = owner_id and e.deleted_at is null
        and e.business_date between p_from and p_to), 0),
    coalesce((select sum(ep.amount) from public.expense_payments ep
      where ep.user_id = owner_id and ep.payment_date between p_from and p_to), 0),
    coalesce((select sum(greatest(coalesce(sales.total, 0) - coalesce(payments.total, 0), 0))
      from public.customers c
      left join lateral (
        select sum(m.calculated_amount) as total from public.milk_entries m
        where m.user_id = owner_id and m.customer_id = c.id and m.deleted_at is null
      ) sales on true
      left join lateral (
        select sum(cp.amount) as total from public.customer_payments cp
        where cp.user_id = owner_id and cp.customer_id = c.id
      ) payments on true
      where c.user_id = owner_id), 0),
    coalesce((select sum(greatest(coalesce(payments.total, 0) - coalesce(sales.total, 0), 0))
      from public.customers c
      left join lateral (
        select sum(m.calculated_amount) as total from public.milk_entries m
        where m.user_id = owner_id and m.customer_id = c.id and m.deleted_at is null
      ) sales on true
      left join lateral (
        select sum(cp.amount) as total from public.customer_payments cp
        where cp.user_id = owner_id and cp.customer_id = c.id
      ) payments on true
      where c.user_id = owner_id), 0),
    coalesce((select sum(e.pending_amount) from public.expenses e
      where e.user_id = owner_id and e.deleted_at is null), 0),
    coalesce((select sum(bp.purchase_price) from public.buffalo_purchases bp
      where bp.user_id = owner_id and bp.purchase_date between p_from and p_to), 0),
    coalesce((select sum(bpp.amount) from public.buffalo_purchase_payments bpp
      where bpp.user_id = owner_id and bpp.payment_date between p_from and p_to), 0),
    coalesce((select sum(bp.amount_pending) from public.buffalo_purchases bp
      where bp.user_id = owner_id), 0),
    coalesce((select sum(greatest(e.paid_amount - coalesce(payments.ledger_paid, 0), 0))
      from public.expenses e
      left join lateral (
        select sum(ep.amount) as ledger_paid
        from public.expense_payments ep
        where ep.user_id = owner_id and ep.expense_id = e.id
      ) payments on true
      where e.user_id = owner_id and e.deleted_at is null), 0),
    coalesce((select sum(greatest(coalesce(sales.total, 0) - coalesce(payments.total, 0), 0))
      from public.customers c
      left join lateral (
        select sum(m.calculated_amount) as total from public.milk_entries m
        where m.user_id = owner_id and m.customer_id = c.id and m.deleted_at is null
          and m.business_date <= p_to
      ) sales on true
      left join lateral (
        select sum(cp.amount) as total from public.customer_payments cp
        where cp.user_id = owner_id and cp.customer_id = c.id
          and cp.payment_date <= p_to
      ) payments on true
      where c.user_id = owner_id), 0),
    coalesce((select sum(greatest(coalesce(payments.total, 0) - coalesce(sales.total, 0), 0))
      from public.customers c
      left join lateral (
        select sum(m.calculated_amount) as total from public.milk_entries m
        where m.user_id = owner_id and m.customer_id = c.id and m.deleted_at is null
          and m.business_date <= p_to
      ) sales on true
      left join lateral (
        select sum(cp.amount) as total from public.customer_payments cp
        where cp.user_id = owner_id and cp.customer_id = c.id
          and cp.payment_date <= p_to
      ) payments on true
      where c.user_id = owner_id), 0),
    coalesce((select sum(greatest(e.total_amount - coalesce(payments.paid, 0), 0))
      from public.expenses e
      left join lateral (
        select sum(ep.amount) as paid from public.expense_payments ep
        where ep.user_id = owner_id and ep.expense_id = e.id
          and ep.payment_date <= p_to
      ) payments on true
      where e.user_id = owner_id and e.deleted_at is null
        and e.business_date <= p_to), 0),
    coalesce((select sum(greatest(e.paid_amount - coalesce(payments.ledger_paid, 0), 0))
      from public.expenses e
      left join lateral (
        select sum(ep.amount) as ledger_paid from public.expense_payments ep
        where ep.user_id = owner_id and ep.expense_id = e.id
      ) payments on true
      where e.user_id = owner_id and e.deleted_at is null), 0),
    coalesce((select sum(greatest(bp.purchase_price - coalesce(payments.paid, 0), 0))
      from public.buffalo_purchases bp
      left join lateral (
        select sum(p.amount) as paid from public.buffalo_purchase_payments p
        where p.user_id = owner_id and p.buffalo_id = bp.buffalo_id
          and p.payment_date <= p_to
      ) payments on true
      where bp.user_id = owner_id and bp.purchase_date <= p_to), 0),
    coalesce((select sum(greatest(bp.amount_paid - coalesce(payments.ledger_paid, 0), 0))
      from public.buffalo_purchases bp
      left join lateral (
        select sum(p.amount) as ledger_paid from public.buffalo_purchase_payments p
        where p.user_id = owner_id and p.buffalo_id = bp.buffalo_id
      ) payments on true
      where bp.user_id = owner_id), 0);
end;
$farm_summary$;

revoke all on function public.get_farm_financial_summary(date, date) from public, anon;
grant execute on function public.get_farm_financial_summary(date, date) to authenticated;

-- Sale reports now return both the live outstanding balance and the balance at the
-- end of the selected report range. Existing output columns retain their order.
drop function public.get_buffalo_sale_financial_summary(date, date);
create function public.get_buffalo_sale_financial_summary(p_from date, p_to date)
returns table (
  buffalo_sale_revenue numeric,
  buffalo_sale_collections numeric,
  buffalo_sale_outstanding numeric,
  buffalo_sales_count bigint,
  buffalo_sale_outstanding_as_of numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $sale_summary$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception using errcode = '23514', message = 'Choose a valid report date range.';
  end if;

  return query
  select
    coalesce((select sum(s.sale_price) from public.buffalo_sales s
      where s.user_id = owner_id and s.sale_date between p_from and p_to), 0),
    coalesce((select sum(p.amount) from public.buffalo_sale_payments p
      where p.user_id = owner_id and p.payment_date between p_from and p_to), 0),
    coalesce((select sum(s.amount_pending) from public.buffalo_sales s
      where s.user_id = owner_id), 0),
    coalesce((select count(*) from public.buffalo_sales s
      where s.user_id = owner_id and s.sale_date between p_from and p_to), 0),
    coalesce((select sum(greatest(s.sale_price - coalesce(payments.paid, 0), 0))
      from public.buffalo_sales s
      left join lateral (
        select sum(p.amount) as paid
        from public.buffalo_sale_payments p
        where p.user_id = owner_id and p.buffalo_sale_id = s.id
          and p.payment_date <= p_to
      ) payments on true
      where s.user_id = owner_id and s.sale_date <= p_to), 0);
end;
$sale_summary$;

revoke all on function public.get_buffalo_sale_financial_summary(date, date) from public, anon;
grant execute on function public.get_buffalo_sale_financial_summary(date, date) to authenticated;
