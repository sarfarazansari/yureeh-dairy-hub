-- Phase 7: harden inventory-backed feed consumption.
-- Snapshot the weighted-average stock cost at the time of consumption and
-- prevent consuming more stock than is available. The ledger remains append-only.

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
  v_stock_quantity numeric(14,3);
  v_stock_value numeric(16,2);
  v_unit_cost numeric(14,2);
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  if p_business_date is null then raise exception 'Consumption date is required.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero.'; end if;
  if scale(p_quantity) > 3 then raise exception 'Quantity can have at most 3 decimal places.'; end if;

  -- Purchase and consumption RPCs lock the same feed master row so stock
  -- checks and cost snapshots are serialized per feed item.
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

  select coalesce(quantity_on_hand, 0), coalesce(stock_value, 0)
    into v_stock_quantity, v_stock_value
  from public.feed_inventory_stock
  where user_id = v_user_id and feed_item_id = p_feed_item_id;

  if coalesce(v_stock_quantity, 0) < p_quantity then
    raise exception 'Insufficient feed stock. Available: %, requested: %.',
      coalesce(v_stock_quantity, 0), p_quantity;
  end if;

  if v_stock_quantity <= 0 then
    raise exception 'No feed stock is available for consumption.';
  end if;

  if v_stock_value < 0 then
    raise exception 'Feed stock value is negative. Reconcile inventory before recording consumption.';
  end if;

  v_unit_cost := round(v_stock_value / v_stock_quantity, 2);

  insert into public.feed_inventory_movements (
    user_id, feed_item_id, movement_type, quantity, unit_cost,
    source_type, occurred_at, notes
  )
  values (
    v_user_id, v_feed.id, 'CONSUMPTION', p_quantity, v_unit_cost,
    'FEED_CONSUMPTION', p_business_date::timestamptz, nullif(trim(p_notes), '')
  )
  returning * into v_movement;

  return v_movement;
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
  v_feed public.feed_items;
  v_later_exists boolean;
  v_latest_date date;
  v_stock_quantity numeric(14,3);
  v_stock_value numeric(16,2);
  v_unit_cost numeric(14,2);
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

  select * into v_feed
  from public.feed_items
  where id = v_old.feed_item_id and user_id = v_user_id
  for update;

  if not found then raise exception 'Feed item not found.'; end if;
  if not v_feed.is_active then raise exception 'Inactive feed items cannot be consumed.'; end if;

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

  -- Reverse the old consumption first, restoring both quantity and its
  -- previously applied inventory cost before validating the replacement.
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

  select coalesce(quantity_on_hand, 0), coalesce(stock_value, 0)
    into v_stock_quantity, v_stock_value
  from public.feed_inventory_stock
  where user_id = v_user_id and feed_item_id = v_old.feed_item_id;

  if coalesce(v_stock_quantity, 0) < p_quantity then
    raise exception 'Insufficient feed stock. Available: %, requested: %.',
      coalesce(v_stock_quantity, 0), p_quantity;
  end if;

  if v_stock_quantity <= 0 then
    raise exception 'No feed stock is available for consumption.';
  end if;

  if v_stock_value < 0 then
    raise exception 'Feed stock value is negative. Reconcile inventory before recording consumption.';
  end if;

  v_unit_cost := round(v_stock_value / v_stock_quantity, 2);

  select max((occurred_at at time zone 'UTC')::date) into v_latest_date
  from public.feed_inventory_movements
  where user_id = v_user_id
    and feed_item_id = v_old.feed_item_id
    and id <> v_old.id;

  if v_latest_date is not null and p_business_date < v_latest_date then
    raise exception 'Consumption date cannot be earlier than existing inventory activity for this feed item.';
  end if;

  insert into public.feed_inventory_movements (
    user_id, feed_item_id, movement_type, quantity, unit_cost,
    source_type, occurred_at, notes
  )
  values (
    v_user_id, v_old.feed_item_id, 'CONSUMPTION', p_quantity, v_unit_cost,
    'FEED_CONSUMPTION', p_business_date::timestamptz, nullif(trim(p_notes), '')
  )
  returning * into v_new;

  return v_new;
end;
$$;

revoke all on function public.create_feed_consumption(uuid,date,numeric,text) from public, anon;
revoke all on function public.edit_feed_consumption(uuid,date,numeric,text) from public, anon;

grant execute on function public.create_feed_consumption(uuid,date,numeric,text) to authenticated;
grant execute on function public.edit_feed_consumption(uuid,date,numeric,text) to authenticated;
