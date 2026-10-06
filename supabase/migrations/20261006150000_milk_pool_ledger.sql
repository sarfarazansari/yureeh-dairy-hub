-- Milk pool ledger: bridge physical milk production and customer delivery.
-- This migration keeps buffalo production and customer sales as separate
-- domain records while adding an auditable farm-level milk movement ledger.

create type public.milk_pool_movement_type as enum (
  'PRODUCTION_RECEIPT',
  'CUSTOMER_DELIVERY',
  'HOUSEHOLD_USE',
  'WASTAGE',
  'OTHER_USE',
  'ADJUSTMENT'
);

create table public.milk_pool_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_date date not null,
  shift public.milk_shift,
  movement_type public.milk_pool_movement_type not null,
  quantity numeric(12,3) not null check (quantity > 0 and scale(quantity) <= 3),
  source_type text,
  source_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (movement_type = 'CUSTOMER_DELIVERY' and source_type = 'MILK_ENTRY' and source_id is not null)
    or
    (movement_type <> 'CUSTOMER_DELIVERY')
  )
);

create index milk_pool_movements_date_idx
  on public.milk_pool_movements(user_id, business_date desc, movement_type);
create index milk_pool_movements_source_idx
  on public.milk_pool_movements(user_id, source_type, source_id);

create unique index milk_pool_movements_customer_delivery_uidx
  on public.milk_pool_movements(user_id, source_type, source_id)
  where movement_type = 'CUSTOMER_DELIVERY'
    and source_type = 'MILK_ENTRY'
    and source_id is not null;

create trigger milk_pool_movements_updated_at
  before update on public.milk_pool_movements
  for each row execute function public.set_updated_at();

alter table public.milk_pool_movements enable row level security;

create policy milk_pool_movements_select_own on public.milk_pool_movements
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy milk_pool_movements_insert_own on public.milk_pool_movements
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy milk_pool_movements_update_own on public.milk_pool_movements
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy milk_pool_movements_delete_own on public.milk_pool_movements
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Existing buffalo production becomes an explicit pool receipt.
insert into public.milk_pool_movements (
  user_id, business_date, shift, movement_type, quantity,
  source_type, source_id, notes
)
select
  p.user_id,
  p.business_date,
  p.shift,
  'PRODUCTION_RECEIPT'::public.milk_pool_movement_type,
  p.milk_quantity,
  'BUFFALO_MILK_PRODUCTION',
  p.id,
  'Backfilled from buffalo milk production.'
from public.buffalo_milk_production p
where p.milk_quantity > 0
  and not exists (
    select 1
    from public.milk_pool_movements m
    where m.user_id = p.user_id
      and m.source_type = 'BUFFALO_MILK_PRODUCTION'
      and m.source_id = p.id
  );

-- Existing customer deliveries become pool outflows. This preserves history
-- without pretending that historical production and sales were previously
-- reconciled operationally.
insert into public.milk_pool_movements (
  user_id, business_date, shift, movement_type, quantity,
  source_type, source_id, notes
)
select
  e.user_id,
  e.business_date,
  e.shift,
  'CUSTOMER_DELIVERY'::public.milk_pool_movement_type,
  e.milk_quantity,
  'MILK_ENTRY',
  e.id,
  'Backfilled from existing milk entry.'
from public.milk_entries e
where e.deleted_at is null
  and e.milk_quantity > 0
  and not exists (
    select 1
    from public.milk_pool_movements m
    where m.user_id = e.user_id
      and m.source_type = 'MILK_ENTRY'
      and m.source_id = e.id
  );

-- One RPC keeps a customer delivery and its physical pool movement together.
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
    select 1 from public.customers
    where id = p_customer_id and user_id = owner_id
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
    user_id, business_date, shift, movement_type, quantity,
    source_type, source_id, notes
  )
  values (
    owner_id, p_business_date, p_shift, 'CUSTOMER_DELIVERY',
    p_milk_quantity, 'MILK_ENTRY', entry_id, 'Customer milk delivery.'
  );

  return entry_id;
end;
$$;

revoke all on function public.create_milk_entry_with_pool(
  date, public.milk_shift, uuid, numeric, numeric, public.pricing_type, numeric, numeric, text
) from public, anon;
grant execute on function public.create_milk_entry_with_pool(
  date, public.milk_shift, uuid, numeric, numeric, public.pricing_type, numeric, numeric, text
) to authenticated;

-- Edit both sides atomically. The pool movement follows the immutable business
-- meaning of the milk entry; it is not an independent editable stock number.
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
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_milk_quantity is null or p_milk_quantity <= 0 then
    raise exception using errcode = '23514', message = 'Milk quantity must be greater than zero.';
  end if;
  if not exists (
    select 1 from public.customers
    where id = p_customer_id and user_id = owner_id
  ) then
    raise exception using errcode = '23503', message = 'Customer was not found for this farm.';
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

  update public.milk_pool_movements
  set business_date = p_business_date,
      shift = p_shift,
      quantity = p_milk_quantity
  where user_id = owner_id
    and movement_type = 'CUSTOMER_DELIVERY'
    and source_type = 'MILK_ENTRY'
    and source_id = p_entry_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Milk pool movement for this entry was not found.';
  end if;
end;
$$;

revoke all on function public.update_milk_entry_with_pool(
  uuid, date, public.milk_shift, uuid, numeric, numeric, public.pricing_type, numeric, numeric, text
) from public, anon;
grant execute on function public.update_milk_entry_with_pool(
  uuid, date, public.milk_shift, uuid, numeric, numeric, public.pricing_type, numeric, numeric, text
) to authenticated;

create or replace function public.delete_milk_entry_with_pool(p_entry_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;

  update public.milk_entries
  set deleted_at = now()
  where id = p_entry_id
    and user_id = owner_id
    and deleted_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'Milk entry was not found.';
  end if;

  delete from public.milk_pool_movements
  where user_id = owner_id
    and movement_type = 'CUSTOMER_DELIVERY'
    and source_type = 'MILK_ENTRY'
    and source_id = p_entry_id;
end;
$$;

revoke all on function public.delete_milk_entry_with_pool(uuid) from public, anon;
grant execute on function public.delete_milk_entry_with_pool(uuid) to authenticated;

-- Reconciliation is deliberately a movement calculation. It does not compare
-- same-day production to same-day sales and therefore supports carry-forward
-- milk and other legitimate uses.
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
  adjustment_litres numeric,
  net_movement_litres numeric
)
language sql
security invoker
set search_path = ''
as $$
  select
    m.business_date,
    coalesce(sum(m.quantity) filter (where m.movement_type = 'PRODUCTION_RECEIPT'), 0),
    coalesce(sum(m.quantity) filter (where m.movement_type = 'CUSTOMER_DELIVERY'), 0),
    coalesce(sum(m.quantity) filter (where m.movement_type = 'HOUSEHOLD_USE'), 0),
    coalesce(sum(m.quantity) filter (where m.movement_type = 'WASTAGE'), 0),
    coalesce(sum(m.quantity) filter (where m.movement_type = 'OTHER_USE'), 0),
    coalesce(sum(m.quantity) filter (where m.movement_type = 'ADJUSTMENT'), 0),
    coalesce(sum(
      case
        when m.movement_type = 'PRODUCTION_RECEIPT' then m.quantity
        when m.movement_type = 'ADJUSTMENT' then m.quantity
        else -m.quantity
      end
    ), 0)
  from public.milk_pool_movements m
  where m.user_id = (select auth.uid())
    and m.business_date between p_start_date and p_end_date
  group by m.business_date
  order by m.business_date;
$$;

revoke all on function public.get_milk_pool_reconciliation(date, date) from public, anon;
grant execute on function public.get_milk_pool_reconciliation(date, date) to authenticated;
