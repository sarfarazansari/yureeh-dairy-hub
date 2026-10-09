-- Return milk availability for one business date and shift.
-- The UI must use the same movement-ledger balance that the database guard protects.
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
  owner_id uuid := auth.uid();
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

revoke all on function public.get_milk_pool_shift_context(date, public.milk_shift)
  from public, anon;
grant execute on function public.get_milk_pool_shift_context(date, public.milk_shift)
  to authenticated;
