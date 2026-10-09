-- Existing consumption rows were written without a unit-cost snapshot.
-- Backfill in ledger creation order so historical consumption and reversal values
-- are reflected in the current stock valuation. Same-transaction reversals are
-- applied before replacement consumption rows.
do $$
declare
  v_feed record;
  v_movement record;
  v_quantity numeric := 0;
  v_value numeric := 0;
  v_cost numeric(14,2);
  v_original_cost numeric(14,2);
begin
  for v_feed in
    select distinct user_id, feed_item_id
    from public.feed_inventory_movements
    order by user_id, feed_item_id
  loop
    v_quantity := 0;
    v_value := 0;

    for v_movement in
      select *
      from public.feed_inventory_movements
      where user_id = v_feed.user_id
        and feed_item_id = v_feed.feed_item_id
      order by created_at,
        case movement_type
          when 'PURCHASE' then 1
          when 'ADJUSTMENT_IN' then 2
          when 'CONSUMPTION' then 3
          when 'ADJUSTMENT_OUT' then 4
          else 5
        end,
        occurred_at,
        id
    loop
      if v_movement.movement_type = 'PURCHASE' then
        v_cost := coalesce(v_movement.unit_cost, 0);
        v_quantity := v_quantity + v_movement.quantity;
        v_value := v_value + (v_movement.quantity * v_cost);

      elsif v_movement.movement_type = 'CONSUMPTION' then
        v_cost := v_movement.unit_cost;

        if v_cost is null then
          if v_quantity > 0 and v_value >= 0 then
            v_cost := round(round(v_value, 2) / v_quantity, 2);
            update public.feed_inventory_movements
            set unit_cost = v_cost
            where id = v_movement.id and user_id = v_feed.user_id;
          else
            raise warning
              'Could not derive historical feed consumption cost for movement % (feed item %): stock quantity %, stock value %.',
              v_movement.id, v_feed.feed_item_id, v_quantity, v_value;
          end if;
        end if;

        if v_cost is not null then
          v_value := v_value - (v_movement.quantity * v_cost);
        end if;
        v_quantity := v_quantity - v_movement.quantity;

      elsif v_movement.movement_type = 'ADJUSTMENT_IN' then
        v_cost := v_movement.unit_cost;

        if v_movement.reversal_of_movement_id is not null then
          select unit_cost into v_original_cost
          from public.feed_inventory_movements
          where id = v_movement.reversal_of_movement_id
            and user_id = v_feed.user_id;

          if v_original_cost is not null then
            v_cost := v_original_cost;
          end if;
        end if;

        if v_cost is distinct from v_movement.unit_cost then
          update public.feed_inventory_movements
          set unit_cost = v_cost
          where id = v_movement.id and user_id = v_feed.user_id;
        end if;

        v_quantity := v_quantity + v_movement.quantity;
        if v_cost is not null then
          v_value := v_value + (v_movement.quantity * v_cost);
        end if;

      elsif v_movement.movement_type = 'ADJUSTMENT_OUT' then
        v_cost := coalesce(v_movement.unit_cost, 0);
        v_quantity := v_quantity - v_movement.quantity;
        v_value := v_value - (v_movement.quantity * v_cost);
      end if;
    end loop;
  end loop;
end;
$$;

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
  v_feed public.feed_items;
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

  select * into v_feed
  from public.feed_items
  where id = v_movement.feed_item_id and user_id = v_user_id
  for update;

  if not found then raise exception 'Feed item not found.'; end if;

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
$;

revoke all on function public.create_feed_consumption(uuid,date,numeric,text) from public, anon;
revoke all on function public.edit_feed_consumption(uuid,date,numeric,text) from public, anon;
revoke all on function public.delete_feed_consumption(uuid) from public, anon;

grant execute on function public.create_feed_consumption(uuid,date,numeric,text) to authenticated;
grant execute on function public.edit_feed_consumption(uuid,date,numeric,text) to authenticated;
grant execute on function public.delete_feed_consumption(uuid) to authenticated;
