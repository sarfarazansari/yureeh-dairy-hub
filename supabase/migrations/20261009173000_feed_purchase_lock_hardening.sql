-- Phase 7: serialize purchase edits/deletes with feed stock movements.
-- The purchase row remains the transaction lock; feed item rows now serialize
-- stock checks against concurrent purchase/consumption RPCs.

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

  select count(*) into v_outbound_count
  from public.feed_inventory_movements
  where user_id = v_user_id
    and feed_item_id = v_purchase.feed_item_id
    and movement_type in ('CONSUMPTION', 'ADJUSTMENT_OUT')
    and created_at > v_movement.created_at;

  if v_outbound_count > 0 then
    raise exception 'This feed purchase cannot be deleted because stock from this purchase has already been consumed or adjusted out.';
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

revoke execute on function public.delete_feed_purchase(uuid) from public, anon;
grant execute on function public.delete_feed_purchase(uuid) to authenticated;

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

  select count(*) into v_outbound_count
  from public.feed_inventory_movements
  where user_id = v_user_id
    and feed_item_id = v_purchase.feed_item_id
    and movement_type in ('CONSUMPTION', 'ADJUSTMENT_OUT')
    and created_at > v_movement.created_at;

  if v_outbound_count > 0 then
    raise exception 'This feed purchase cannot be edited because stock from this purchase has already been consumed or adjusted out.';
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

revoke execute on function public.edit_feed_purchase(uuid,uuid,uuid,date,numeric,numeric,text,numeric,text,date,text) from public, anon;
grant execute on function public.edit_feed_purchase(uuid,uuid,uuid,date,numeric,numeric,text,numeric,text,date,text) to authenticated;
