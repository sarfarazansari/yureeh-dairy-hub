-- Phase 6: expose inventory for every feed master and configure low-stock thresholds.
-- The movement ledger remains the source of truth for quantity and stock value.

alter table public.feed_items
  add column low_stock_threshold numeric(14,3) not null default 0
  check (low_stock_threshold >= 0);

create index feed_inventory_movements_user_date_idx
  on public.feed_inventory_movements(user_id, occurred_at desc, created_at desc);

create index feed_inventory_movements_user_type_date_idx
  on public.feed_inventory_movements(user_id, movement_type, occurred_at desc, created_at desc);

create or replace view public.feed_inventory_stock
with (security_invoker = true)
as
select
  f.user_id,
  f.id as feed_item_id,
  f.name as feed_item_name,
  f.base_unit,
  coalesce(
    sum(
      case
        when m.movement_type in ('PURCHASE', 'ADJUSTMENT_IN') then m.quantity
        else -m.quantity
      end
    ), 0
  )::numeric(14,3) as quantity_on_hand,
  coalesce(
    sum(
      case
        when m.movement_type in ('PURCHASE', 'ADJUSTMENT_IN')
          then m.quantity * coalesce(m.unit_cost, 0)
        else -(m.quantity * coalesce(m.unit_cost, 0))
      end
    ), 0
  )::numeric(16,2) as stock_value,
  case
    when coalesce(sum(
      case
        when m.movement_type in ('PURCHASE', 'ADJUSTMENT_IN') then m.quantity
        else -m.quantity
      end
    ), 0) > 0
    then (
      sum(
        case
          when m.movement_type in ('PURCHASE', 'ADJUSTMENT_IN')
            then m.quantity * coalesce(m.unit_cost, 0)
          else -(m.quantity * coalesce(m.unit_cost, 0))
        end
      )
      /
      sum(
        case
          when m.movement_type in ('PURCHASE', 'ADJUSTMENT_IN') then m.quantity
          else -m.quantity
        end
      )
    )::numeric(14,2)
    else null
  end as weighted_average_cost,
  f.low_stock_threshold,
  f.category,
  f.is_active
from public.feed_items f
left join public.feed_inventory_movements m
  on m.feed_item_id = f.id
  and m.user_id = f.user_id
group by f.user_id, f.id, f.name, f.base_unit, f.low_stock_threshold;

grant select on public.feed_inventory_stock to authenticated;
