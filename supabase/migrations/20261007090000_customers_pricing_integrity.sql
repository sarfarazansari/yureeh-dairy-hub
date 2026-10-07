-- Customers & pricing integrity.
-- Effective pricing is resolved by business date; active status is enforced for new deliveries.

create index if not exists customer_rate_history_effective_lookup_idx
  on public.customer_rate_history(customer_id, effective_from desc, effective_to);

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
    and c.user_id = (select auth.uid())
    and h.effective_from <= p_business_date
    and (h.effective_to is null or h.effective_to >= p_business_date)
  order by h.effective_from desc, h.created_at desc
  limit 1;
$$;

revoke all on function public.get_customer_pricing_for_date(uuid, date) from public, anon;
grant execute on function public.get_customer_pricing_for_date(uuid, date) to authenticated;

-- New customer deliveries must use an active customer.
-- Historical entries remain editable/correctable through the existing transaction workflow.
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

  if not exists (
    select 1
    from public.customers
    where id = p_customer_id
      and user_id = owner_id
      and is_active = true
  ) then
    raise exception using errcode = '23503',
      message = 'This customer is inactive. Activate the customer before recording a new delivery.';
  end if;

  authoritative_amount := round(
    case
      when p_pricing_type = 'FAT_BASED' then p_milk_quantity * p_fat * p_applied_rate
      else p_milk_quantity * p_applied_rate
    end,
    2
  );

  insert into public.milk_entries (
    user_id, business_date, shift, customer_id, milk_quantity, fat,
    pricing_type, applied_rate, calculated_amount, notes
  )
  values (
    owner_id, p_business_date, p_shift, p_customer_id, p_milk_quantity, p_fat,
    p_pricing_type, p_applied_rate, authoritative_amount, nullif(btrim(p_notes), '')
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
exception
  when unique_violation then
    raise exception using errcode = '23505',
      message = 'A milk entry already exists for this customer, date, and shift.';
end;
$$;

revoke all on function public.create_milk_entry_with_pool(
  date, public.milk_shift, uuid, numeric, numeric, public.pricing_type, numeric, numeric, text
) from public, anon;
grant execute on function public.create_milk_entry_with_pool(
  date, public.milk_shift, uuid, numeric, numeric, public.pricing_type, numeric, numeric, text
) to authenticated;

-- Do not allow direct mutation of pricing history. History is generated by customer pricing changes.
drop policy if exists "customer_rates_insert_own" on public.customer_rate_history;
drop policy if exists "customer_rates_update_own" on public.customer_rate_history;
drop policy if exists "customer_rates_delete_own" on public.customer_rate_history;
