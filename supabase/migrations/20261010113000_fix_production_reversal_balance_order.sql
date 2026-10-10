-- Avoid a false intermediate negative balance when increasing/correcting production
-- in the same transaction. Post the replacement receipt before reversing the old one.
-- The final per-shift balance guard still rejects reductions/deletions that would
-- make already-consumed milk negative. All changes remain atomic in the caller RPC.
create or replace function public.sync_buffalo_milk_pool_receipt(
  p_production_id uuid,
  p_business_date date,
  p_shift public.milk_shift,
  p_quantity numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  current_receipt public.milk_pool_movements%rowtype;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;

  select m.* into current_receipt
  from public.milk_pool_movements m
  where m.user_id = owner_id
    and m.movement_type = 'PRODUCTION_RECEIPT'
    and m.source_type = 'BUFFALO_MILK_PRODUCTION'
    and m.source_id = p_production_id
    and not exists (
      select 1 from public.milk_pool_movements reversal
      where reversal.reversal_of_id = m.id
    )
  order by m.created_at desc
  limit 1
  for update;

  -- Add replacement production first. This permits an increase to compensate
  -- for milk already delivered without temporarily taking the pool below zero.
  if p_quantity is not null and p_quantity > 0
     and (
       current_receipt.id is null
       or current_receipt.quantity <> p_quantity
       or current_receipt.business_date <> p_business_date
       or current_receipt.shift <> p_shift
     ) then
    insert into public.milk_pool_movements (
      user_id, business_date, shift, movement_type, movement_direction,
      quantity, source_type, source_id, notes
    )
    values (
      owner_id, p_business_date, p_shift,
      'PRODUCTION_RECEIPT', 'IN', p_quantity,
      'BUFFALO_MILK_PRODUCTION', p_production_id,
      'Buffalo milk production receipt.'
    );
  end if;

  if current_receipt.id is not null
     and (
       p_quantity is null
       or p_quantity <= 0
       or current_receipt.quantity <> p_quantity
       or current_receipt.business_date <> p_business_date
       or current_receipt.shift <> p_shift
     ) then
    insert into public.milk_pool_movements (
      user_id, business_date, shift, movement_type, movement_direction,
      quantity, reversal_of_id, source_type, source_id, notes
    )
    values (
      owner_id, current_receipt.business_date, current_receipt.shift,
      'ADJUSTMENT', 'OUT', current_receipt.quantity, current_receipt.id,
      'BUFFALO_MILK_PRODUCTION_REVERSAL', p_production_id,
      'Reversal of previous production receipt.'
    );
  end if;
end;
$$;
