-- Harden milk pool into an auditable movement ledger.
-- Corrections are represented by reversal movements instead of mutating history.

alter table public.milk_pool_movements
  add column movement_direction text not null default 'OUT'
    check (movement_direction in ('IN', 'OUT')),
  add column reversal_of_id uuid references public.milk_pool_movements(id);

update public.milk_pool_movements
set movement_direction = case
  when movement_type = 'PRODUCTION_RECEIPT' then 'IN'
  when movement_type = 'ADJUSTMENT' then 'IN'
  else 'OUT'
end;

create index milk_pool_movements_reversal_idx
  on public.milk_pool_movements(user_id, reversal_of_id);

create unique index milk_pool_movements_reversal_uidx
  on public.milk_pool_movements(user_id, reversal_of_id)
  where reversal_of_id is not null;

alter table public.milk_pool_movements
  add constraint milk_pool_movement_reversal_check
  check (
    (reversal_of_id is null)
    or (
      movement_type = 'ADJUSTMENT'
      and movement_direction = 'IN'
    )
  );

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
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  entry_id uuid;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_business_date is null or p_shift is null or p_customer_id is null then
    raise exception using errcode = '22023', message = 'Date, shift, and customer are required.';
  end if;
  if p_milk_quantity is null or p_milk_quantity <= 0 then
    raise exception using errcode = '23514', message = 'Milk quantity must be greater than zero.';
  end if;
  if not exists (
    select 1 from public.customers where id = p_customer_id and user_id = owner_id
  ) then
    raise exception using errcode = '23503', message = 'Customer was not found for this farm.';
  end if;
  if exists (
    select 1 from public.milk_entries
    where user_id = owner_id
      and customer_id = p_customer_id
      and business_date = p_business_date
      and shift = p_shift
      and deleted_at is null
  ) then
    raise exception using errcode = '23505', message = 'A milk entry already exists for this customer, date, and shift.';
  end if;

  insert into public.milk_entries (
    user_id, business_date, shift, customer_id, milk_quantity, fat,
    pricing_type, applied_rate, calculated_amount, notes
  )
  values (
    owner_id, p_business_date, p_shift, p_customer_id, p_milk_quantity, p_fat,
    p_pricing_type, p_applied_rate, p_calculated_amount, nullif(btrim(p_notes), '')
  )
  returning id into entry_id;

  insert into public.milk_pool_movements (
    user_id, business_date, shift, movement_type, movement_direction, quantity,
    source_type, source_id, notes
  )
  values (
    owner_id, p_business_date, p_shift, 'CUSTOMER_DELIVERY', 'OUT',
    p_milk_quantity, 'MILK_ENTRY', entry_id, 'Customer milk delivery.'
  );

  return entry_id;
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

  select * into previous_movement
  from public.milk_pool_movements
  where user_id = owner_id
    and movement_type = 'CUSTOMER_DELIVERY'
    and source_type = 'MILK_ENTRY'
    and source_id = p_entry_id
  for update;

  if previous_movement.id is null then
    raise exception using errcode = 'P0002', message = 'Milk pool movement for this entry was not found.';
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

  if not exists (
    select 1 from public.milk_pool_movements
    where user_id = owner_id
      and reversal_of_id = previous_movement.id
  ) then
    insert into public.milk_pool_movements (
      user_id, business_date, shift, movement_type, movement_direction,
      quantity, reversal_of_id, source_type, source_id, notes
    )
    values (
      owner_id, previous_movement.business_date, previous_movement.shift,
      'ADJUSTMENT', 'IN', previous_movement.quantity, previous_movement.id,
      'MILK_ENTRY_EDIT', p_entry_id, 'Reversal of previous customer delivery.'
    );
  end if;

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

  select * into delivery
  from public.milk_pool_movements
  where user_id = owner_id
    and movement_type = 'CUSTOMER_DELIVERY'
    and source_type = 'MILK_ENTRY'
    and source_id = p_entry_id
  for update;

  if delivery.id is null then
    raise exception using errcode = 'P0002', message = 'Milk pool movement for this entry was not found.';
  end if;

  update public.milk_entries
  set deleted_at = now()
  where id = p_entry_id
    and user_id = owner_id
    and deleted_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'Milk entry was not found.';
  end if;

  if not exists (
    select 1 from public.milk_pool_movements
    where user_id = owner_id and reversal_of_id = delivery.id
  ) then
    insert into public.milk_pool_movements (
      user_id, business_date, shift, movement_type, movement_direction,
      quantity, reversal_of_id, source_type, source_id, notes
    )
    values (
      owner_id, delivery.business_date, delivery.shift,
      'ADJUSTMENT', 'IN', delivery.quantity, delivery.id,
      'MILK_ENTRY_DELETE', p_entry_id, 'Reversal of deleted customer delivery.'
    );
  end if;
end;
$$;

create or replace function public.get_milk_pool_reconciliation(
  p_start_date date,
  p_end_date date
)
returns table (
  business_date date,
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
  with daily as (
    select
      m.business_date,
      coalesce(sum(m.quantity) filter (
        where m.movement_type = 'PRODUCTION_RECEIPT'
      ), 0) as production_litres,
      coalesce(sum(m.quantity) filter (
        where m.movement_type = 'CUSTOMER_DELIVERY'
      ), 0) as customer_delivery_litres,
      coalesce(sum(m.quantity) filter (
        where m.movement_type = 'HOUSEHOLD_USE'
      ), 0) as household_use_litres,
      coalesce(sum(m.quantity) filter (
        where m.movement_type = 'WASTAGE'
      ), 0) as wastage_litres,
      coalesce(sum(m.quantity) filter (
        where m.movement_type = 'OTHER_USE'
      ), 0) as other_use_litres,
      coalesce(sum(m.quantity) filter (
        where m.movement_type = 'ADJUSTMENT'
          and m.movement_direction = 'IN'
      ), 0) as adjustment_in_litres,
      coalesce(sum(m.quantity) filter (
        where m.movement_type = 'ADJUSTMENT'
          and m.movement_direction = 'OUT'
      ), 0) as adjustment_out_litres
    from public.milk_pool_movements m
    where m.user_id = (select auth.uid())
      and m.business_date between p_start_date and p_end_date
    group by m.business_date
  )
  select
    d.business_date,
    d.production_litres,
    d.customer_delivery_litres,
    d.household_use_litres,
    d.wastage_litres,
    d.other_use_litres,
    d.adjustment_in_litres,
    d.adjustment_out_litres,
    d.production_litres
      + d.adjustment_in_litres
      - d.customer_delivery_litres
      - d.household_use_litres
      - d.wastage_litres
      - d.other_use_litres
      - d.adjustment_out_litres as net_movement_litres,
    sum(
      d.production_litres
      + d.adjustment_in_litres
      - d.customer_delivery_litres
      - d.household_use_litres
      - d.wastage_litres
      - d.other_use_litres
      - d.adjustment_out_litres
    ) over (order by d.business_date rows between unbounded preceding and current row)
      as closing_balance_litres
  from daily d
  order by d.business_date;
$$;

create or replace function public.record_milk_pool_movement(
  p_business_date date,
  p_shift public.milk_shift,
  p_movement_type public.milk_pool_movement_type,
  p_quantity numeric,
  p_movement_direction text,
  p_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  movement_id uuid;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_business_date is null or p_movement_type is null then
    raise exception using errcode = '22023', message = 'Date and movement type are required.';
  end if;
  if p_quantity is null or p_quantity <= 0 or scale(p_quantity) > 3 then
    raise exception using errcode = '23514', message = 'Quantity must be greater than zero and have at most 3 decimals.';
  end if;
  if p_movement_type not in ('HOUSEHOLD_USE', 'WASTAGE', 'OTHER_USE', 'ADJUSTMENT') then
    raise exception using errcode = '22023', message = 'This movement type is system-generated.';
  end if;
  if p_movement_type = 'ADJUSTMENT' and p_movement_direction not in ('IN', 'OUT') then
    raise exception using errcode = '22023', message = 'Adjustment direction must be IN or OUT.';
  end if;
  if p_movement_type <> 'ADJUSTMENT' and p_movement_direction <> 'OUT' then
    raise exception using errcode = '22023', message = 'Consumption movements must be OUT.';
  end if;

  insert into public.milk_pool_movements (
    user_id, business_date, shift, movement_type, movement_direction,
    quantity, notes
  )
  values (
    owner_id, p_business_date, p_shift, p_movement_type, p_movement_direction,
    p_quantity, nullif(btrim(p_notes), '')
  )
  returning id into movement_id;

  return movement_id;
end;
$$;

revoke all on function public.record_milk_pool_movement(
  date, public.milk_shift, public.milk_pool_movement_type, numeric, text, text
) from public, anon;
grant execute on function public.record_milk_pool_movement(
  date, public.milk_shift, public.milk_pool_movement_type, numeric, text, text
) to authenticated;
