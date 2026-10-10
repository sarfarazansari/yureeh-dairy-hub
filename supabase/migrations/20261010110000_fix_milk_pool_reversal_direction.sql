-- Production receipt reversals remove milk from the pool, while delivery reversals
-- restore milk. Both are ADJUSTMENT movements linked to the original ledger row.
-- Keep the reversal link mandatory for the reversal-specific rule and preserve the
-- unique reversal index that prevents reversing the same movement more than once.
alter table public.milk_pool_movements
  drop constraint milk_pool_movement_reversal_check;

alter table public.milk_pool_movements
  add constraint milk_pool_movement_reversal_check
  check (
    reversal_of_id is null
    or (
      movement_type = 'ADJUSTMENT'
      and movement_direction in ('IN', 'OUT')
    )
  );
