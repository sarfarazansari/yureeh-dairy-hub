-- Reconciliation includes the true ledger opening balance before the selected range,
-- so the closing balance is a rolling farm pool balance rather than a range-only net.

create or replace function public.get_milk_pool_reconciliation(
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
    where m.user_id = (select auth.uid())
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
    where m.user_id = (select auth.uid())
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
