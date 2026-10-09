-- Operations and financial integrity hardening.
-- All milk availability checks are serialized per farm/date/shift.
-- Financial snapshots separate current balances from balances as of a historical date.
-- Buffalo carrying value includes the original acquisition price and explicitly linked acquisition costs;
-- depreciation is intentionally not assumed until the farm adopts a depreciation policy.

create or replace function public.guard_milk_pool_nonnegative_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $milk_balance_guard$
declare
  v_balance numeric(14,3);
  v_delta numeric(14,3);
  v_shift_key text;
begin
  if new.user_id is null or new.business_date is null then
    raise exception using errcode = '23514', message = 'Milk pool movements require a farm and business date.';
  end if;

  if new.shift is null and new.movement_direction::text = 'OUT' then
    raise exception using errcode = '23514', message = 'Milk outflow must belong to a morning or evening shift.';
  end if;

  if new.shift is null then
    return new;
  end if;

  v_shift_key := new.user_id::text || ':' || new.business_date::text || ':' || new.shift::text;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_shift_key, 0));

  select coalesce(sum(
    case
      when m.movement_direction = 'IN' then m.quantity
      when m.movement_direction = 'OUT' then -m.quantity
      when m.movement_type = 'PRODUCTION_RECEIPT' then m.quantity
      when m.movement_type = 'CUSTOMER_DELIVERY' then -m.quantity
      when m.movement_type = 'ADJUSTMENT' then m.quantity
      else -m.quantity
    end
  ), 0)
  into v_balance
  from public.milk_pool_movements m
  where m.user_id = new.user_id
    and m.business_date = new.business_date
    and m.shift = new.shift
    and (tg_op = 'INSERT' or m.id <> old.id);

  v_delta := case
    when new.movement_direction = 'IN' then new.quantity
    when new.movement_direction = 'OUT' then -new.quantity
    when new.movement_type = 'PRODUCTION_RECEIPT' then new.quantity
    when new.movement_type = 'CUSTOMER_DELIVERY' then -new.quantity
    when new.movement_type = 'ADJUSTMENT' then new.quantity
    else -new.quantity
  end;

  if v_balance + v_delta < 0 then
    raise exception using
      errcode = '23514',
      message = format(
        'Insufficient milk in the %s shift on %s. Available: %s litres; requested outflow: %s litres.',
        new.shift, new.business_date, greatest(v_balance, 0), new.quantity
      );
  end if;

  return new;
end;
$milk_balance_guard$;

drop trigger if exists milk_pool_nonnegative_balance_guard on public.milk_pool_movements;
create trigger milk_pool_nonnegative_balance_guard
before insert or update of user_id, business_date, shift, movement_type, movement_direction, quantity
on public.milk_pool_movements
for each row execute function public.guard_milk_pool_nonnegative_balance();

revoke all on function public.guard_milk_pool_nonnegative_balance() from public, anon, authenticated;
