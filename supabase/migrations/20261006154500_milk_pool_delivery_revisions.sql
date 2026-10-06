-- Customer delivery corrections can create multiple delivery versions for one
-- milk entry, each neutralized by a reversal movement.
drop index if exists public.milk_pool_movements_customer_delivery_uidx;

create index if not exists milk_pool_movements_delivery_source_idx
  on public.milk_pool_movements(user_id, source_type, source_id, created_at desc);

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
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  previous_movement public.milk_pool_movements%rowtype;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_milk_quantity is null or p_milk_quantity <= 0 then
    raise exception using errcode = '23514', message = 'Milk quantity must be greater than zero.';
  end if;
  if not exists (
    select 1 from public.customers where id = p_customer_id and user_id = owner_id
  ) then
    raise exception using errcode = '23503', message = 'Customer was not found for this farm.';
  end if;

  select m.* into previous_movement
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
    raise exception using errcode = 'P0002', message = 'Active milk pool movement for this entry was not found.';
  end if;

  update public.milk_entries
  set business_date = p_business_date,
      shift = p_shift,
      customer_id = p_customer_id,
      milk_quantity = p_milk_quantity,
      fat = p_fat,
      pricing_type = p_pricing_type,
      applied_rate = p_applied_rate,
      calculated_amount = p_calculated_amount,
      notes = nullif(btrim(p_notes), '')
  where id = p_entry_id
    and user_id = owner_id
    and deleted_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'Milk entry was not found.';
  end if;

  insert into public.milk_pool_movements (
    user_id, business_date, shift, movement_type, movement_direction,
    quantity, reversal_of_id, source_type, source_id, notes
  )
  values (
    owner_id, previous_movement.business_date, previous_movement.shift,
    'ADJUSTMENT', 'IN', previous_movement.quantity, previous_movement.id,
    'MILK_ENTRY_EDIT', p_entry_id, 'Reversal of previous customer delivery.'
  );

  insert into public.milk_pool_movements (
    user_id, business_date, shift, movement_type, movement_direction,
    quantity, source_type, source_id, notes
  )
  values (
    owner_id, p_business_date, p_shift, 'CUSTOMER_DELIVERY', 'OUT',
    p_milk_quantity, 'MILK_ENTRY', p_entry_id, 'Replacement customer milk delivery.'
  );
end;
$$;

create or replace function public.delete_milk_entry_with_pool(p_entry_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  delivery public.milk_pool_movements%rowtype;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;

  select m.* into delivery
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

  if delivery.id is null then
    raise exception using errcode = 'P0002', message = 'Active milk pool movement for this entry was not found.';
  end if;

  update public.milk_entries
  set deleted_at = now()
  where id = p_entry_id
    and user_id = owner_id
    and deleted_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'Milk entry was not found.';
  end if;

  insert into public.milk_pool_movements (
    user_id, business_date, shift, movement_type, movement_direction,
    quantity, reversal_of_id, source_type, source_id, notes
  )
  values (
    owner_id, delivery.business_date, delivery.shift,
    'ADJUSTMENT', 'IN', delivery.quantity, delivery.id,
    'MILK_ENTRY_DELETE', p_entry_id, 'Reversal of deleted customer delivery.'
  );
end;
$$;
