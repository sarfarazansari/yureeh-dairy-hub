-- Enforce the real farm workflow: customer milk can only be recorded
-- after the herd entry exists for the same business date and shift.
--
-- Pool quantity remains a soft warning at the UI level. The database does
-- not reject a delivery merely because it exceeds the currently available
-- pool balance.

create or replace function public.create_milk_entry_with_pool(
  p_business_date date,
  p_shift public.milk_shift,
  p_customer_id uuid,
  p_milk_quantity numeric,
  p_fat numeric,
  p_pricing_type public.pricing_type,
  p_applied_rate numeric,
  p_calculated_amount numeric,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  entry_id uuid;
  authoritative_amount numeric;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;

  if p_business_date is null or p_shift is null or p_customer_id is null then
    raise exception using errcode = '22023', message = 'Date, shift, and customer are required.';
  end if;

  if not exists (
    select 1
    from public.buffalo_milk_production
    where user_id = owner_id
      and business_date = p_business_date
      and shift = p_shift
  ) then
    raise exception using errcode = '23514',
      message = 'Herd entry is required before recording customer milk for this date and shift.';
  end if;

  if p_milk_quantity is null or p_milk_quantity <= 0 or scale(p_milk_quantity) > 3 then
    raise exception using errcode = '23514',
      message = 'Milk quantity must be greater than zero and have at most 3 decimals.';
  end if;

  if p_applied_rate is null or p_applied_rate <= 0 or scale(p_applied_rate) > 2 then
    raise exception using errcode = '23514',
      message = 'Applied rate must be greater than zero and have at most 2 decimals.';
  end if;

  if p_pricing_type = 'FAT_BASED'
     and (p_fat is null or p_fat < 0 or p_fat > 20) then
    raise exception using errcode = '23514',
      message = 'Fat is required for fat-based pricing and must be between 0 and 20.';
  end if;

  if p_pricing_type = 'FIXED_PER_LITRE' then
    p_fat := null;
  end if;

  if not exists (
    select 1
    from public.customers
    where id = p_customer_id
      and user_id = owner_id
  ) then
    raise exception using errcode = '23503',
      message = 'Customer was not found for this farm.';
  end if;

  authoritative_amount := round(
    case
      when p_pricing_type = 'FAT_BASED' then p_milk_quantity * p_fat * p_applied_rate
      else p_milk_quantity * p_applied_rate
    end,
    2
  );

  insert into public.milk_entries (
    user_id,
    business_date,
    shift,
    customer_id,
    milk_quantity,
    fat,
    pricing_type,
    applied_rate,
    calculated_amount,
    notes
  )
  values (
    owner_id,
    p_business_date,
    p_shift,
    p_customer_id,
    p_milk_quantity,
    p_fat,
    p_pricing_type,
    p_applied_rate,
    authoritative_amount,
    nullif(btrim(p_notes), '')
  )
  returning id into entry_id;

  insert into public.milk_pool_movements (
    user_id,
    business_date,
    shift,
    movement_type,
    movement_direction,
    quantity,
    source_type,
    source_id,
    notes
  )
  values (
    owner_id,
    p_business_date,
    p_shift,
    'CUSTOMER_DELIVERY',
    'OUT',
    p_milk_quantity,
    'MILK_ENTRY',
    entry_id,
    'Customer milk delivery.'
  );

  return entry_id;
exception
  when unique_violation then
    raise exception using errcode = '23505',
      message = 'A milk entry already exists for this customer, date, and shift.';
end;
$$;

create or replace function public.update_milk_entry_with_pool(
  p_entry_id uuid,
  p_business_date date,
  p_shift public.milk_shift,
  p_customer_id uuid,
  p_milk_quantity numeric,
  p_fat numeric,
  p_pricing_type public.pricing_type,
  p_applied_rate numeric,
  p_calculated_amount numeric,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  previous_movement public.milk_pool_movements%rowtype;
  authoritative_amount numeric;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;

  if p_business_date is null or p_shift is null or p_customer_id is null then
    raise exception using errcode = '22023', message = 'Date, shift, and customer are required.';
  end if;

  if not exists (
    select 1
    from public.buffalo_milk_production
    where user_id = owner_id
      and business_date = p_business_date
      and shift = p_shift
  ) then
    raise exception using errcode = '23514',
      message = 'Herd entry is required before moving a customer delivery to this date and shift.';
  end if;

  if p_milk_quantity is null or p_milk_quantity <= 0 or scale(p_milk_quantity) > 3 then
    raise exception using errcode = '23514',
      message = 'Milk quantity must be greater than zero and have at most 3 decimals.';
  end if;

  if p_applied_rate is null or p_applied_rate <= 0 or scale(p_applied_rate) > 2 then
    raise exception using errcode = '23514',
      message = 'Applied rate must be greater than zero and have at most 2 decimals.';
  end if;

  if p_pricing_type = 'FAT_BASED'
     and (p_fat is null or p_fat < 0 or p_fat > 20) then
    raise exception using errcode = '23514',
      message = 'Fat is required for fat-based pricing and must be between 0 and 20.';
  end if;

  if p_pricing_type = 'FIXED_PER_LITRE' then
    p_fat := null;
  end if;

  if not exists (
    select 1
    from public.customers
    where id = p_customer_id
      and user_id = owner_id
  ) then
    raise exception using errcode = '23503',
      message = 'Customer was not found for this farm.';
  end if;

  select m.*
  into previous_movement
  from public.milk_pool_movements m
  where m.user_id = owner_id
    and m.movement_type = 'CUSTOMER_DELIVERY'
    and m.source_type = 'MILK_ENTRY'
    and m.source_id = p_entry_id
    and not exists (
      select 1
      from public.milk_pool_movements reversal
      where reversal.reversal_of_id = m.id
    )
  order by m.created_at desc
  limit 1
  for update;

  if previous_movement.id is null then
    raise exception using errcode = 'P0002',
      message = 'Active milk pool movement for this entry was not found.';
  end if;

  authoritative_amount := round(
    case
      when p_pricing_type = 'FAT_BASED' then p_milk_quantity * p_fat * p_applied_rate
      else p_milk_quantity * p_applied_rate
    end,
    2
  );

  update public.milk_entries
  set business_date = p_business_date,
      shift = p_shift,
      customer_id = p_customer_id,
      milk_quantity = p_milk_quantity,
      fat = p_fat,
      pricing_type = p_pricing_type,
      applied_rate = p_applied_rate,
      calculated_amount = authoritative_amount,
      notes = nullif(btrim(p_notes), '')
  where id = p_entry_id
    and user_id = owner_id
    and deleted_at is null;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'Milk entry was not found.';
  end if;

  insert into public.milk_pool_movements (
    user_id,
    business_date,
    shift,
    movement_type,
    movement_direction,
    quantity,
    reversal_of_id,
    source_type,
    source_id,
    notes
  )
  values (
    owner_id,
    previous_movement.business_date,
    previous_movement.shift,
    'ADJUSTMENT',
    'IN',
    previous_movement.quantity,
    previous_movement.id,
    'MILK_ENTRY_EDIT',
    p_entry_id,
    'Reversal of previous customer delivery.'
  );

  insert into public.milk_pool_movements (
    user_id,
    business_date,
    shift,
    movement_type,
    movement_direction,
    quantity,
    source_type,
    source_id,
    notes
  )
  values (
    owner_id,
    p_business_date,
    p_shift,
    'CUSTOMER_DELIVERY',
    'OUT',
    p_milk_quantity,
    'MILK_ENTRY',
    p_entry_id,
    'Replacement customer milk delivery.'
  );
exception
  when unique_violation then
    raise exception using errcode = '23505',
      message = 'Another milk entry already exists for this customer, date, and shift.';
end;
$$;

revoke all on function public.create_milk_entry_with_pool(
  date, public.milk_shift, uuid, numeric, numeric, public.pricing_type, numeric, numeric, text
) from public, anon;
grant execute on function public.create_milk_entry_with_pool(
  date, public.milk_shift, uuid, numeric, numeric, public.pricing_type, numeric, numeric, text
) to authenticated;

revoke all on function public.update_milk_entry_with_pool(
  uuid, date, public.milk_shift, uuid, numeric, numeric, public.pricing_type, numeric, numeric, text
) from public, anon;
grant execute on function public.update_milk_entry_with_pool(
  uuid, date, public.milk_shift, uuid, numeric, numeric, public.pricing_type, numeric, numeric, text
) to authenticated;
