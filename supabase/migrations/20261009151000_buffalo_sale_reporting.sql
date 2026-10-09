-- Sale proceeds are reported separately from milk sales and operating expenses.
create or replace function public.get_buffalo_sale_financial_summary(p_from date, p_to date)
returns table (
  buffalo_sale_revenue numeric,
  buffalo_sale_collections numeric,
  buffalo_sale_outstanding numeric,
  buffalo_sales_count bigint
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
      where s.user_id = owner_id and s.sale_date between p_from and p_to), 0);
end;
$sale_summary$;

revoke all on function public.get_buffalo_sale_financial_summary(date, date) from public, anon;
grant execute on function public.get_buffalo_sale_financial_summary(date, date) to authenticated;
