-- Milk pool movements are an append-only ledger. Client roles can read them,
-- while controlled RPCs own every write.
drop policy if exists milk_pool_movements_insert_own on public.milk_pool_movements;
drop policy if exists milk_pool_movements_update_own on public.milk_pool_movements;
drop policy if exists milk_pool_movements_delete_own on public.milk_pool_movements;

revoke all on public.milk_pool_movements from authenticated;
grant select on public.milk_pool_movements to authenticated;

alter function public.create_milk_entry_with_pool(
  date, public.milk_shift, uuid, numeric, numeric, public.pricing_type, numeric, numeric, text
) security definer;

alter function public.update_milk_entry_with_pool(
  uuid, date, public.milk_shift, uuid, numeric, numeric, public.pricing_type, numeric, numeric, text
) security definer;

alter function public.delete_milk_entry_with_pool(uuid) security definer;

alter function public.record_milk_pool_movement(
  date, public.milk_shift, public.milk_pool_movement_type, numeric, text, text
) security definer;

alter function public.sync_buffalo_milk_pool_receipt(
  uuid, date, public.milk_shift, numeric
) security definer;

alter function public.save_buffalo_milk_production(
  date, public.milk_shift, uuid[], jsonb
) security definer;

-- SECURITY DEFINER functions must not inherit a caller-controlled search path.
alter function public.create_milk_entry_with_pool(
  date, public.milk_shift, uuid, numeric, numeric, public.pricing_type, numeric, numeric, text
) set search_path = '';

alter function public.update_milk_entry_with_pool(
  uuid, date, public.milk_shift, uuid, numeric, numeric, public.pricing_type, numeric, numeric, text
) set search_path = '';

alter function public.delete_milk_entry_with_pool(uuid) set search_path = '';
alter function public.record_milk_pool_movement(
  date, public.milk_shift, public.milk_pool_movement_type, numeric, text, text
) set search_path = '';
alter function public.sync_buffalo_milk_pool_receipt(
  uuid, date, public.milk_shift, numeric
) set search_path = '';
alter function public.save_buffalo_milk_production(
  date, public.milk_shift, uuid[], jsonb
) set search_path = '';
