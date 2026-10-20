-- Make existing read-only report/pricing RPCs resolve the current farm owner for Viewers.
-- Mutating RPCs intentionally retain auth.uid(); the database write guard rejects Viewer writes.
begin;

-- Read-only RPC scoped through the trusted farm membership rather than the caller's auth UID.
create or replace function public.get_customer_pricing_for_date(
  p_customer_id uuid,
  p_business_date date
)
returns table (
  pricing_type public.pricing_type,
  rate numeric(12,2),
  effective_from date,
  effective_to date
)
language sql
security invoker
set search_path = ''
as $$
  select
    h.pricing_type,
    h.rate,
    h.effective_from,
    h.effective_to
  from public.customer_rate_history h
  join public.customers c on c.id = h.customer_id
  where h.customer_id = p_customer_id
    and c.user_id = (select public.current_farm_owner_id())
    and h.effective_from <= p_business_date
    and (h.effective_to is null or h.effective_to >= p_business_date)
  order by h.effective_from desc, h.created_at desc
  limit 1;
$$;

-- Read-only RPC scoped through the trusted farm membership rather than the caller's auth UID.
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
    where me.user_id = (select public.current_farm_owner_id())
      and me.customer_id = p_customer_id
      and me.deleted_at is null
  ) sales
  cross join (
    select
      sum(cp.amount) as total_payments_amount,
      count(*) as payment_count
    from public.customer_payments cp
    where cp.user_id = (select public.current_farm_owner_id())
      and cp.customer_id = p_customer_id
  ) payments
  where exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.user_id = (select public.current_farm_owner_id())
  );
$$;

-- Read-only RPC scoped through the trusted farm membership rather than the caller's auth UID.
create or replace function public.get_farm_financial_summary(p_from date, p_to date)
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
  legacy_undated_paid_amount numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := public.current_farm_owner_id();
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
    coalesce((select sum(e.total_amount) from public.expenses e
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
      where e.user_id = owner_id and e.deleted_at is null), 0);
end;
$$;

-- Read-only RPC scoped through the trusted farm membership rather than the caller's auth UID.
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
  owner_id uuid := public.current_farm_owner_id();
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

-- Read-only RPC scoped through the trusted farm membership rather than the caller's auth UID.
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
  owner_id uuid := public.current_farm_owner_id();
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

-- Read-only RPC scoped through the trusted farm membership rather than the caller's auth UID.
create or replace function public.get_milk_margin_after_feed(
  p_from date,
  p_to date
)
returns table (
  milk_litres_sold numeric,
  milk_sales_revenue numeric,
  feed_consumption_cost numeric,
  feed_consumption_entries bigint,
  uncosted_feed_consumption_entries bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := public.current_farm_owner_id();
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception using errcode = '23514', message = 'Choose a valid date range.';
  end if;

  return query
  select
    coalesce((
      select sum(m.milk_quantity)
      from public.milk_entries m
      where m.user_id = owner_id
        and m.deleted_at is null
        and m.business_date between p_from and p_to
    ), 0)::numeric,
    coalesce((
      select sum(m.calculated_amount)
      from public.milk_entries m
      where m.user_id = owner_id
        and m.deleted_at is null
        and m.business_date between p_from and p_to
    ), 0)::numeric,
    coalesce((
      select sum(m.quantity * m.unit_cost)
      from public.feed_inventory_movements m
      where m.user_id = owner_id
        and m.movement_type = 'CONSUMPTION'
        and m.source_type = 'FEED_CONSUMPTION'
        and (m.occurred_at at time zone 'UTC')::date between p_from and p_to
        and m.unit_cost is not null
    ), 0)::numeric,
    (
      select count(*)
      from public.feed_inventory_movements m
      where m.user_id = owner_id
        and m.movement_type = 'CONSUMPTION'
        and m.source_type = 'FEED_CONSUMPTION'
        and (m.occurred_at at time zone 'UTC')::date between p_from and p_to
    ),
    (
      select count(*)
      from public.feed_inventory_movements m
      where m.user_id = owner_id
        and m.movement_type = 'CONSUMPTION'
        and m.source_type = 'FEED_CONSUMPTION'
        and (m.occurred_at at time zone 'UTC')::date between p_from and p_to
        and m.unit_cost is null
    );
end;
$$;


-- Viewer-safe read path: resolve farm ownership from trusted membership.
create function public.get_milk_pool_reconciliation(
  p_start_date date,
  p_end_date date
)
returns table (
  business_date date,
  opening_balance_litres numeric,
  production_litres numeric,
  customer_delivery_litres numeric,
  household_use_litres numeric,
  wastage_litres numeric,
  other_use_litres numeric,
  adjustment_in_litres numeric,
  adjustment_out_litres numeric,
  net_movement_litres numeric,
  closing_balance_litres numeric
)
language sql
security invoker
set search_path = ''
as $$
  with opening as (
    select coalesce(sum(
      case
        when m.movement_direction = 'IN' then m.quantity
        else -m.quantity
      end
    ), 0) as litres
    from public.milk_pool_movements m
    where m.user_id = (select public.current_farm_owner_id())
      and m.business_date < p_start_date
  ),
  daily as (
    select
      m.business_date,
      coalesce(sum(m.quantity) filter (where m.movement_type = 'PRODUCTION_RECEIPT'), 0) as production_litres,
      coalesce(sum(m.quantity) filter (where m.movement_type = 'CUSTOMER_DELIVERY'), 0) as customer_delivery_litres,
      coalesce(sum(m.quantity) filter (where m.movement_type = 'HOUSEHOLD_USE'), 0) as household_use_litres,
      coalesce(sum(m.quantity) filter (where m.movement_type = 'WASTAGE'), 0) as wastage_litres,
      coalesce(sum(m.quantity) filter (where m.movement_type = 'OTHER_USE'), 0) as other_use_litres,
      coalesce(sum(m.quantity) filter (where m.movement_type = 'ADJUSTMENT' and m.movement_direction = 'IN'), 0) as adjustment_in_litres,
      coalesce(sum(m.quantity) filter (where m.movement_type = 'ADJUSTMENT' and m.movement_direction = 'OUT'), 0) as adjustment_out_litres
    from public.milk_pool_movements m
    where m.user_id = (select public.current_farm_owner_id())
      and m.business_date between p_start_date and p_end_date
    group by m.business_date
  ),
  calculated as (
    select
      d.*,
      d.production_litres
        + d.adjustment_in_litres
        - d.customer_delivery_litres
        - d.household_use_litres
        - d.wastage_litres
        - d.other_use_litres
        - d.adjustment_out_litres as net_movement_litres
    from daily d
  )
  select
    c.business_date,
    o.litres
      + coalesce(sum(c.net_movement_litres) over (
          order by c.business_date rows between unbounded preceding and 1 preceding
        ), 0) as opening_balance_litres,
    c.production_litres,
    c.customer_delivery_litres,
    c.household_use_litres,
    c.wastage_litres,
    c.other_use_litres,
    c.adjustment_in_litres,
    c.adjustment_out_litres,
    c.net_movement_litres,
    o.litres
      + sum(c.net_movement_litres) over (
          order by c.business_date rows between unbounded preceding and current row
        ) as closing_balance_litres
  from calculated c
  cross join opening o
  order by c.business_date;
$$;

-- Viewer-safe read path: resolve farm ownership from trusted membership.
create or replace function public.get_milk_pool_shift_context(
  p_business_date date,
  p_shift public.milk_shift
)
returns table (
  production_litres numeric,
  customer_delivery_litres numeric,
  available_pool_litres numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $shift_context$
declare
  owner_id uuid := public.current_farm_owner_id();
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;

  if p_business_date is null or p_shift is null then
    raise exception using errcode = '23514', message = 'Choose a business date and shift.';
  end if;

  return query
  select
    coalesce((
      select sum(p.milk_quantity)
      from public.buffalo_milk_production p
      where p.user_id = owner_id
        and p.business_date = p_business_date
        and p.shift = p_shift
    ), 0),
    coalesce((
      select sum(me.milk_quantity)
      from public.milk_entries me
      where me.user_id = owner_id
        and me.business_date = p_business_date
        and me.shift = p_shift
        and me.deleted_at is null
    ), 0),
    coalesce((
      select sum(
        case
          when m.movement_direction = 'IN' then m.quantity
          when m.movement_direction = 'OUT' then -m.quantity
          when m.movement_type = 'PRODUCTION_RECEIPT' then m.quantity
          when m.movement_type = 'CUSTOMER_DELIVERY' then -m.quantity
          when m.movement_type = 'ADJUSTMENT' then m.quantity
          else -m.quantity
        end
      )
      from public.milk_pool_movements m
      where m.user_id = owner_id
        and m.business_date = p_business_date
        and m.shift = p_shift
    ), 0);
end;
$shift_context$;

commit;
