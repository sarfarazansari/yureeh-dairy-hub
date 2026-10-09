-- Phase 3: inventory-safe feed purchase corrections.

alter table public.feed_purchases
  add column if not exists status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'CORRECTED')),
  add column if not exists correction_of_purchase_id uuid
    references public.feed_purchases(id) on delete restrict,
  add column if not exists corrected_by_purchase_id uuid
    references public.feed_purchases(id) on delete restrict;

create index if not exists feed_purchases_status_idx
  on public.feed_purchases(user_id, status, business_date desc);

create index if not exists feed_purchases_correction_idx
  on public.feed_purchases(correction_of_purchase_id);

create or replace function public.correct_feed_purchase(
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
  v_original public.feed_purchases;
  v_original_expense public.expenses;
  v_original_movement public.feed_inventory_movements;
  v_new_purchase public.feed_purchases;
  v_current_quantity numeric(14,3);
  v_outbound_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_original
  from public.feed_purchases
  where id = p_purchase_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Feed purchase not found.';
  end if;

  if v_original.status <> 'ACTIVE' then
    raise exception 'This feed purchase has already been corrected.';
  end if;

  if p_purchase_id = v_original.correction_of_purchase_id then
    raise exception 'A purchase cannot correct itself.';
  end if;

  select * into v_original_expense
  from public.expenses
  where id = v_original.expense_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Original expense record was not found.';
  end if;

  select * into v_original_movement
  from public.feed_inventory_movements
  where user_id = v_user_id
    and source_type = 'FEED_PURCHASE'
    and source_id = v_original.id
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Original inventory movement was not found.';
  end if;

  if v_original_movement.movement_type <> 'PURCHASE' then
    raise exception 'Original inventory movement is not a purchase movement.';
  end if;

  -- Inventory is an aggregate ledger, so we conservatively block a correction
  -- once any outbound movement occurred after this purchase. This prevents
  -- reversing stock that may already have been consumed or adjusted out.
  select count(*) into v_outbound_count
  from public.feed_inventory_movements
  where user_id = v_user_id
    and feed_item_id = v_original.feed_item_id
    and movement_type in ('CONSUMPTION', 'ADJUSTMENT_OUT')
    and created_at > v_original_movement.created_at;

  if v_outbound_count > 0 then
    raise exception 'This purchase cannot be corrected because stock movement has already been consumed or adjusted out after the purchase.';
  end if;

  select coalesce(sum(
    case
      when movement_type in ('PURCHASE', 'ADJUSTMENT_IN') then quantity
      else -quantity
    end
  ), 0)
  into v_current_quantity
  from public.feed_inventory_movements
  where user_id = v_user_id
    and feed_item_id = v_original.feed_item_id;

  if v_current_quantity < v_original.base_quantity then
    raise exception 'This purchase cannot be corrected because its stock is no longer fully available. Available: %, original: %.',
      v_current_quantity, v_original.base_quantity;
  end if;

  -- Mark the original transaction as corrected and hide its expense from
  -- normal accounting views. The original rows remain in the database.
  update public.feed_purchases
  set status = 'CORRECTED',
      updated_at = now()
  where id = v_original.id
    and user_id = v_user_id;

  update public.expenses
  set deleted_at = now(),
      updated_at = now()
  where id = v_original.expense_id
    and user_id = v_user_id
    and deleted_at is null;

  -- Compensating movement reverses the original stock-in without mutating
  -- the append-only inventory ledger.
  insert into public.feed_inventory_movements (
    user_id, feed_item_id, movement_type, quantity, unit_cost,
    source_type, source_id, occurred_at, notes, reversal_of_movement_id
  ) values (
    v_user_id,
    v_original_movement.feed_item_id,
    'ADJUSTMENT_OUT',
    v_original_movement.quantity,
    v_original_movement.unit_cost,
    'FEED_PURCHASE_CORRECTION',
    v_original.id,
    v_original_movement.occurred_at,
    'Reversal of corrected feed purchase ' || v_original.id,
    v_original_movement.id
  );

  -- Reuse the authoritative purchase creation workflow for the corrected
  -- purchase. If anything fails, the whole correction transaction rolls back.
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

  update public.feed_purchases
  set correction_of_purchase_id = v_original.id,
      updated_at = now()
  where id = v_new_purchase.id
    and user_id = v_user_id
  returning * into v_new_purchase;

  update public.feed_purchases
  set corrected_by_purchase_id = v_new_purchase.id,
      updated_at = now()
  where id = v_original.id
    and user_id = v_user_id;

  return v_new_purchase;
end;
$$;

revoke execute on function public.correct_feed_purchase(
  uuid,uuid,uuid,date,numeric,numeric,text,numeric,text,date,text
) from public, anon;

grant execute on function public.correct_feed_purchase(
  uuid,uuid,uuid,date,numeric,numeric,text,numeric,text,date,text
) to authenticated;
