-- Phase 4: feed consumption.
-- Consumption is represented directly by the append-only inventory ledger.
-- Business dates may not be backdated behind later inventory activity.

create or replace function public.create_feed_consumption(
  p_feed_item_id uuid,
  p_business_date date,
  p_quantity numeric,
  p_notes text
)
returns public.feed_inventory_movements
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_feed public.feed_items;
  v_movement public.feed_inventory_movements;
  v_latest_date date;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  if p_business_date is null then raise exception 'Consumption date is required.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero.'; end if;
  if scale(p_quantity) > 3 then raise exception 'Quantity can have at most 3 decimal places.'; end if;

  select * into v_feed
  from public.feed_items
  where id = p_feed_item_id and user_id = v_user_id
  for update;

  if not found then raise exception 'Feed item not found.'; end if;
  if not v_feed.is_active then raise exception 'Inactive feed items cannot be consumed.'; end if;

  select max((occurred_at at time zone 'UTC')::date) into v_latest_date
  from public.feed_inventory_movements
  where user_id = v_user_id
    and feed_item_id = p_feed_item_id;

  if v_latest_date is not null and p_business_date < v_latest_date then
    raise exception 'Consumption date cannot be earlier than existing inventory activity for this feed item.';
  end if;

  insert into public.feed_inventory_movements (
    user_id, feed_item_id, movement_type, quantity, unit_cost,
    source_type, occurred_at, notes
  )
  values (
    v_user_id, v_feed.id, 'CONSUMPTION', p_quantity, null,
    'FEED_CONSUMPTION', p_business_date::timestamptz, nullif(trim(p_notes), '')
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

create or replace function public.delete_feed_consumption(
  p_movement_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_movement public.feed_inventory_movements;
  v_later_exists boolean;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;

  select * into v_movement
  from public.feed_inventory_movements
  where id = p_movement_id
    and user_id = v_user_id
    and movement_type = 'CONSUMPTION'
    and source_type = 'FEED_CONSUMPTION'
  for update;

  if not found then raise exception 'Feed consumption not found.'; end if;

  select exists (
    select 1
    from public.feed_inventory_movements
    where user_id = v_user_id
      and feed_item_id = v_movement.feed_item_id
      and created_at > v_movement.created_at
  ) into v_later_exists;

  if v_later_exists then
    raise exception 'This consumption is locked because later inventory activity exists.';
  end if;

  insert into public.feed_inventory_movements (
    user_id, feed_item_id, movement_type, quantity, unit_cost,
    source_type, source_id, occurred_at, notes, reversal_of_movement_id
  )
  values (
    v_user_id, v_movement.feed_item_id, 'ADJUSTMENT_IN',
    v_movement.quantity, v_movement.unit_cost,
    'FEED_CONSUMPTION_REVERSAL', v_movement.id,
    v_movement.occurred_at, 'Reversal of feed consumption.', v_movement.id
  );
end;
$$;

create or replace function public.edit_feed_consumption(
  p_movement_id uuid,
  p_business_date date,
  p_quantity numeric,
  p_notes text
)
returns public.feed_inventory_movements
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_old public.feed_inventory_movements;
  v_later_exists boolean;
  v_new public.feed_inventory_movements;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  if p_business_date is null then raise exception 'Consumption date is required.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero.'; end if;
  if scale(p_quantity) > 3 then raise exception 'Quantity can have at most 3 decimal places.'; end if;

  select * into v_old
  from public.feed_inventory_movements
  where id = p_movement_id
    and user_id = v_user_id
    and movement_type = 'CONSUMPTION'
    and source_type = 'FEED_CONSUMPTION'
  for update;

  if not found then raise exception 'Feed consumption not found.'; end if;

  select exists (
    select 1
    from public.feed_inventory_movements
    where user_id = v_user_id
      and feed_item_id = v_old.feed_item_id
      and created_at > v_old.created_at
  ) into v_later_exists;

  if v_later_exists then
    raise exception 'This consumption is locked because later inventory activity exists.';
  end if;

  if p_business_date < (v_old.occurred_at at time zone 'UTC')::date then
    raise exception 'Consumption date cannot be moved earlier than the original date.';
  end if;

  insert into public.feed_inventory_movements (
    user_id, feed_item_id, movement_type, quantity, unit_cost,
    source_type, source_id, occurred_at, notes, reversal_of_movement_id
  )
  values (
    v_user_id, v_old.feed_item_id, 'ADJUSTMENT_IN',
    v_old.quantity, v_old.unit_cost,
    'FEED_CONSUMPTION_EDIT_REVERSAL', v_old.id,
    v_old.occurred_at, 'Reversal of previous feed consumption.', v_old.id
  );

  insert into public.feed_inventory_movements (
    user_id, feed_item_id, movement_type, quantity, unit_cost,
    source_type, occurred_at, notes
  )
  values (
    v_user_id, v_old.feed_item_id, 'CONSUMPTION', p_quantity, null,
    'FEED_CONSUMPTION', p_business_date::timestamptz, nullif(trim(p_notes), '')
  )
  returning * into v_new;

  return v_new;
end;
$$;

revoke all on function public.create_feed_consumption(uuid,date,numeric,text) from public, anon;
revoke all on function public.delete_feed_consumption(uuid) from public, anon;
revoke all on function public.edit_feed_consumption(uuid,date,numeric,text) from public, anon;

grant execute on function public.create_feed_consumption(uuid,date,numeric,text) to authenticated;
grant execute on function public.delete_feed_consumption(uuid) to authenticated;
grant execute on function public.edit_feed_consumption(uuid,date,numeric,text) to authenticated;
