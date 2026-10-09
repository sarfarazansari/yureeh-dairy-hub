-- Aggregate analytics in PostgreSQL so PostgREST row limits cannot silently truncate KPIs.
-- Keep customer-filtered sales separate from farm-wide operating totals.
create or replace function public.get_sales_analytics_summary(
  p_from date,
  p_to date,
  p_customer_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $sales_analytics$
declare
  owner_id uuid := auth.uid();
  result jsonb;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception using errcode = '23514', message = 'Choose a valid report date range.';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.user_id = owner_id
  ) then
    raise exception using errcode = '42501', message = 'Customer was not found for this farm.';
  end if;

  with sales_filtered as (
    select m.business_date, m.shift, m.customer_id, m.milk_quantity,
      m.fat, m.pricing_type, m.calculated_amount
    from public.milk_entries m
    where m.user_id = owner_id
      and m.deleted_at is null
      and m.business_date between p_from and p_to
      and (p_customer_id is null or m.customer_id = p_customer_id)
  ),
  farm_sales as (
    select m.milk_quantity, m.calculated_amount
    from public.milk_entries m
    where m.user_id = owner_id
      and m.deleted_at is null
      and m.business_date between p_from and p_to
  ),
  daily as (
    select s.business_date,
      sum(s.milk_quantity) as milk,
      sum(s.calculated_amount) as revenue,
      sum(s.milk_quantity * s.fat) filter (where s.fat is not null)
        / nullif(sum(s.milk_quantity) filter (where s.fat is not null), 0) as weighted_fat
    from sales_filtered s
    group by s.business_date
  ),
  shifts as (
    select v.shift,
      coalesce(sum(s.milk_quantity), 0) as milk,
      coalesce(sum(s.calculated_amount), 0) as revenue,
      sum(s.milk_quantity * s.fat) filter (where s.fat is not null)
        / nullif(sum(s.milk_quantity) filter (where s.fat is not null), 0) as weighted_fat
    from (values ('MORNING'::text), ('EVENING'::text)) v(shift)
    left join sales_filtered s on s.shift::text = v.shift
    group by v.shift
  ),
  customers as (
    select c.id, c.name,
      sum(s.milk_quantity) as milk,
      sum(s.calculated_amount) as revenue
    from sales_filtered s
    join public.customers c on c.id = s.customer_id and c.user_id = owner_id
    group by c.id, c.name
  ),
  pricing as (
    select v.pricing_type,
      coalesce(sum(s.milk_quantity), 0) as milk,
      coalesce(sum(s.calculated_amount), 0) as revenue,
      count(s.business_date) as entry_count
    from (values ('FIXED_PER_LITRE'::text), ('FAT_BASED'::text)) v(pricing_type)
    left join sales_filtered s on s.pricing_type::text = v.pricing_type
    group by v.pricing_type
  ),
  sale_totals as (
    select coalesce(sum(milk_quantity), 0) as milk,
      coalesce(sum(calculated_amount), 0) as revenue,
      sum(milk_quantity * fat) filter (where fat is not null)
        / nullif(sum(milk_quantity) filter (where fat is not null), 0) as weighted_fat,
      count(*) as entry_count
    from sales_filtered
  ),
  farm_totals as (
    select coalesce(sum(milk_quantity), 0) as milk_sold,
      coalesce(sum(calculated_amount), 0) as revenue
    from farm_sales
  ),
  expense_totals as (
    select coalesce(sum(greatest(e.total_amount - coalesce(capitalized.amount, 0), 0)), 0) as total
    from public.expenses e
    left join lateral (
      select sum(ac.amount) as amount
      from public.buffalo_acquisition_costs ac
      where ac.user_id = owner_id and ac.expense_id = e.id
    ) capitalized on true
    where e.user_id = owner_id
      and e.deleted_at is null
      and e.business_date between p_from and p_to
  ),
  production_totals as (
    select coalesce(sum(p.milk_quantity), 0) as milk_produced
    from public.buffalo_milk_production p
    where p.user_id = owner_id
      and p.business_date between p_from and p_to
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'milkSold', st.milk,
      'revenue', st.revenue,
      'weightedFat', st.weighted_fat,
      'entryCount', st.entry_count,
      'expenseTotal', et.total,
      'farmRevenue', ft.revenue,
      'farmMilkSold', ft.milk_sold,
      'farmMilkProduced', pt.milk_produced
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'businessDate', d.business_date,
        'milk', d.milk,
        'revenue', d.revenue,
        'fat', d.weighted_fat
      ) order by d.business_date)
      from daily d
    ), '[]'::jsonb),
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'shift', s.shift,
        'milk', s.milk,
        'revenue', s.revenue,
        'fat', s.weighted_fat
      ) order by case s.shift when 'MORNING' then 1 else 2 end)
      from shifts s
    ), '[]'::jsonb),
    'customers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'milk', c.milk,
        'revenue', c.revenue
      ) order by c.revenue desc, c.name)
      from customers c
    ), '[]'::jsonb),
    'pricing', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', p.pricing_type,
        'milk', p.milk,
        'revenue', p.revenue,
        'count', p.entry_count
      ) order by case p.pricing_type when 'FIXED_PER_LITRE' then 1 else 2 end)
      from pricing p
    ), '[]'::jsonb)
  )
  into result
  from sale_totals st
  cross join farm_totals ft
  cross join expense_totals et
  cross join production_totals pt;

  return result;
end;
$sales_analytics$;

revoke all on function public.get_sales_analytics_summary(date, date, uuid) from public, anon;
grant execute on function public.get_sales_analytics_summary(date, date, uuid) to authenticated;
