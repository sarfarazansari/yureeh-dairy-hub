-- Monthly milk margin after feed: milk sales less feed actually consumed.
-- Feed purchases are inventory inflows, not the same period's consumption cost.
-- Cost comes from the unit_cost snapshot on each FEED_CONSUMPTION ledger movement.

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
  owner_id uuid := auth.uid();
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

revoke all on function public.get_milk_margin_after_feed(date, date) from public, anon;
grant execute on function public.get_milk_margin_after_feed(date, date) to authenticated;
