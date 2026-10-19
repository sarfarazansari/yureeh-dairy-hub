-- FIFO-based purchase lock check. Returns true only when a genuine outbound
-- movement has consumed any part of this active purchase lot.
create or replace function public.feed_purchase_lot_has_outbound_usage(p_purchase_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_purchase public.feed_purchases;
  v_movement record;
  v_lot_ids uuid[] := array[]::uuid[];
  v_lot_remaining numeric[] := array[]::numeric[];
  v_outflow numeric;
  v_used numeric;
  v_i integer;
  v_used_target boolean := false;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;

  select * into v_purchase
  from public.feed_purchases
  where id = p_purchase_id and user_id = v_user_id and status = 'ACTIVE';

  if not found then raise exception 'Active feed purchase not found.'; end if;

  for v_movement in
    select m.*
    from public.feed_inventory_movements m
    where m.user_id = v_user_id
      and m.feed_item_id = v_purchase.feed_item_id
      and (
        (m.movement_type = 'PURCHASE'
          and m.source_type = 'FEED_PURCHASE'
          and exists (
            select 1 from public.feed_purchases p
            where p.id = m.source_id and p.user_id = v_user_id and p.status = 'ACTIVE'
          ))
        or m.movement_type in ('CONSUMPTION', 'ADJUSTMENT_OUT', 'ADJUSTMENT_IN')
      )
      and coalesce(m.source_type, '') not in (
        'FEED_CONSUMPTION_REVERSAL',
        'FEED_CONSUMPTION_EDIT_REVERSAL',
        'FEED_PURCHASE_EDIT',
        'FEED_PURCHASE_DELETE',
        'FEED_PURCHASE_CORRECTION'
      )
      and not (
        m.movement_type = 'CONSUMPTION'
        and m.source_type = 'FEED_CONSUMPTION'
        and exists (
          select 1
          from public.feed_inventory_movements rev
          where rev.user_id = v_user_id
            and rev.reversal_of_movement_id = m.id
            and rev.source_type in ('FEED_CONSUMPTION_REVERSAL', 'FEED_CONSUMPTION_EDIT_REVERSAL')
        )
      )
    order by m.occurred_at asc,
      case when m.movement_type in ('PURCHASE', 'ADJUSTMENT_IN') then 0 else 1 end,
      m.created_at asc,
      m.id asc
  loop
    if v_movement.movement_type = 'PURCHASE' and m.source_type = 'FEED_PURCHASE' then
      v_lot_ids := array_append(v_lot_ids, m.source_id);
      v_lot_remaining := array_append(v_lot_remaining, m.quantity);
    elsif v_movement.movement_type = 'ADJUSTMENT_IN' then
      v_lot_ids := array_append(v_lot_ids, null::uuid);
      v_lot_remaining := array_append(v_lot_remaining, m.quantity);
    elsif v_movement.movement_type in ('CONSUMPTION', 'ADJUSTMENT_OUT') then
      v_outflow := v_movement.quantity;
      for v_i in 1..coalesce(array_length(v_lot_remaining, 1), 0) loop
        exit when v_outflow <= 0;
        if v_lot_remaining[v_i] <= 0 then continue; end if;
        v_used := least(v_lot_remaining[v_i], v_outflow);
        v_lot_remaining[v_i] := v_lot_remaining[v_i] - v_used;
        v_outflow := v_outflow - v_used;
        if v_used > 0 and v_lot_ids[v_i] = p_purchase_id then
          v_used_target := true;
        end if;
      end loop;
      if v_used_target then return true; end if;
    end if;
  end loop;

  return false;
end;
$$;

revoke all on function public.feed_purchase_lot_has_outbound_usage(uuid) from public, anon;
grant execute on function public.feed_purchase_lot_has_outbound_usage(uuid) to authenticated;

-- Correct false inventory locks caused by compensating movements from purchase edits/deletes.
-- These are audit-ledger reversals, not evidence that stock was consumed.
-- Keep all other outbound movements protected by the existing edit/delete guards.

create or replace function public.delete_feed_purchase(
  p_purchase_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_purchase public.feed_purchases;
  v_feed public.feed_items;
  v_movement public.feed_inventory_movements;
  v_outbound_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_purchase
  from public.feed_purchases
  where id = p_purchase_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Feed purchase not found.';
  end if;

  select * into v_feed
  from public.feed_items
  where id = v_purchase.feed_item_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Feed item not found.';
  end if;

  if v_purchase.status <> 'ACTIVE' then
    raise exception 'This feed purchase has already been deleted.';
  end if;

  select * into v_movement
  from public.feed_inventory_movements
  where user_id = v_user_id
    and source_type = 'FEED_PURCHASE'
    and source_id = v_purchase.id
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Original inventory movement was not found.';
  end if;

  if public.feed_purchase_lot_has_outbound_usage(v_purchase.id) then
    raise exception 'This feed purchase cannot be deleted because FIFO allocation shows that stock from this purchase has already been used.';
  end if;

  update public.feed_purchases
  set status = 'DELETED',
      updated_at = now()
  where id = v_purchase.id
    and user_id = v_user_id;

  update public.expenses
  set deleted_at = now(),
      updated_at = now()
  where id = v_purchase.expense_id
    and user_id = v_user_id
    and deleted_at is null;

  insert into public.feed_inventory_movements (
    user_id,
    feed_item_id,
    movement_type,
    quantity,
    unit_cost,
    source_type,
    source_id,
    occurred_at,
    notes,
    reversal_of_movement_id
  ) values (
    v_user_id,
    v_movement.feed_item_id,
    'ADJUSTMENT_OUT',
    v_movement.quantity,
    v_movement.unit_cost,
    'FEED_PURCHASE_DELETE',
    v_purchase.id,
    v_movement.occurred_at,
    'Reversal of deleted feed purchase ' || v_purchase.id,
    v_movement.id
  );
end;
$$;

create or replace function public.edit_feed_purchase(
  p_purchase_id uuid,
  p_feed_item_id uuid,
  p_vendor_id uuid,
  p_business_date date,
  p_purchase_quantity numeric,
  p_rate_per_purchase_unit numeric,
  p_payment_status text,
  p_paid_amount numeric,
  p_payment_method text,
  p_due_date date,
  p_notes text
)
returns public.feed_purchases
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_purchase public.feed_purchases;
  v_movement public.feed_inventory_movements;
  v_outbound_count integer;
  v_new_purchase public.feed_purchases;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_purchase
  from public.feed_purchases
  where id = p_purchase_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Feed purchase not found.';
  end if;

  -- Lock the old and replacement feed items in deterministic ID order.
  -- This serializes purchase corrections with concurrent stock consumption.
  perform f.id
  from public.feed_items f
  where f.user_id = v_user_id
    and f.id in (v_purchase.feed_item_id, p_feed_item_id)
  order by f.id
  for update;

  if v_purchase.status <> 'ACTIVE' then
    raise exception 'This feed purchase has already been deleted.';
  end if;

  select * into v_movement
  from public.feed_inventory_movements
  where user_id = v_user_id
    and source_type = 'FEED_PURCHASE'
    and source_id = v_purchase.id
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Original inventory movement was not found.';
  end if;

  if public.feed_purchase_lot_has_outbound_usage(v_purchase.id) then
    raise exception 'This feed purchase cannot be edited because FIFO allocation shows that stock from this purchase has already been used.';
  end if;

  -- Replace the old stock-in with a compensating outbound movement. The
  -- inventory ledger remains append-only; the old purchase row is retained
  -- as DELETED and the replacement purchase is created atomically below.
  update public.feed_purchases
  set status = 'DELETED',
      updated_at = now()
  where id = v_purchase.id
    and user_id = v_user_id;

  update public.expenses
  set deleted_at = now(),
      updated_at = now()
  where id = v_purchase.expense_id
    and user_id = v_user_id
    and deleted_at is null;

  insert into public.feed_inventory_movements (
    user_id,
    feed_item_id,
    movement_type,
    quantity,
    unit_cost,
    source_type,
    source_id,
    occurred_at,
    notes,
    reversal_of_movement_id
  ) values (
    v_user_id,
    v_movement.feed_item_id,
    'ADJUSTMENT_OUT',
    v_movement.quantity,
    v_movement.unit_cost,
    'FEED_PURCHASE_EDIT',
    v_purchase.id,
    v_movement.occurred_at,
    'Reversal of edited feed purchase ' || v_purchase.id,
    v_movement.id
  );

  select * into v_new_purchase
  from public.create_feed_purchase(
    p_feed_item_id,
    p_vendor_id,
    p_business_date,
    p_purchase_quantity,
    p_rate_per_purchase_unit,
    p_payment_status,
    p_paid_amount,
    p_payment_method,
    p_due_date,
    p_notes
  );

  return v_new_purchase;
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
      and not (
        movement_type = 'ADJUSTMENT_OUT'
        and source_type in ('FEED_PURCHASE_EDIT', 'FEED_PURCHASE_DELETE', 'FEED_PURCHASE_CORRECTION')
      )
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
      and not (
        movement_type = 'ADJUSTMENT_OUT'
        and source_type in ('FEED_PURCHASE_EDIT', 'FEED_PURCHASE_DELETE', 'FEED_PURCHASE_CORRECTION')
      )
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

revoke all on function public.edit_feed_purchase(uuid,uuid,uuid,date,numeric,numeric,text,numeric,text,date,text) from public, anon;
grant execute on function public.edit_feed_purchase(uuid,uuid,uuid,date,numeric,numeric,text,numeric,text,date,text) to authenticated;
revoke all on function public.delete_feed_purchase(uuid) from public, anon;
grant execute on function public.delete_feed_purchase(uuid) to authenticated;
revoke all on function public.edit_feed_consumption(uuid,date,numeric,text) from public, anon;
grant execute on function public.edit_feed_consumption(uuid,date,numeric,text) to authenticated;
revoke all on function public.delete_feed_consumption(uuid) from public, anon;
grant execute on function public.delete_feed_consumption(uuid) to authenticated;
