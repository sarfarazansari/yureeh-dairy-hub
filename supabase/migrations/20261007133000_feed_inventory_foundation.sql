-- Feed inventory foundation: append-only stock movement ledger.
-- Quantities are always stored in the feed item's base unit.
-- A movement's type determines whether its quantity adds to or removes stock.

create table public.feed_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feed_item_id uuid not null references public.feed_items(id) on delete restrict,
  movement_type text not null check (
    movement_type in ('PURCHASE', 'CONSUMPTION', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT')
  ),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,2) check (unit_cost is null or unit_cost >= 0),
  source_type text,
  source_id uuid,
  occurred_at timestamptz not null default now(),
  notes text,
  reversal_of_movement_id uuid references public.feed_inventory_movements(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index feed_inventory_movements_item_date_idx
  on public.feed_inventory_movements(user_id, feed_item_id, occurred_at desc);

create index feed_inventory_movements_source_idx
  on public.feed_inventory_movements(user_id, source_type, source_id);

create index feed_inventory_movements_reversal_idx
  on public.feed_inventory_movements(reversal_of_movement_id);

alter table public.feed_inventory_movements enable row level security;

create policy "feed_inventory_movements_select_own"
  on public.feed_inventory_movements
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "feed_inventory_movements_insert_own"
  on public.feed_inventory_movements
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Posted movements are intentionally not update/delete editable.
-- Corrections must be represented by a compensating/reversal movement.

create view public.feed_inventory_stock
with (security_invoker = true)
as
select
  m.user_id,
  m.feed_item_id,
  f.name as feed_item_name,
  f.base_unit,
  coalesce(
    sum(
      case
        when m.movement_type in ('PURCHASE', 'ADJUSTMENT_IN') then m.quantity
        else -m.quantity
      end
    ),
    0
  )::numeric(14,3) as quantity_on_hand,
  coalesce(
    sum(
      case
        when m.movement_type in ('PURCHASE', 'ADJUSTMENT_IN')
          then m.quantity * coalesce(m.unit_cost, 0)
        else -(m.quantity * coalesce(m.unit_cost, 0))
      end
    ),
    0
  )::numeric(16,2) as stock_value,
  case
    when sum(
      case
        when m.movement_type in ('PURCHASE', 'ADJUSTMENT_IN') then m.quantity
        else -m.quantity
      end
    ) > 0
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
  end as weighted_average_cost
from public.feed_inventory_movements m
join public.feed_items f on f.id = m.feed_item_id and f.user_id = m.user_id
group by m.user_id, m.feed_item_id, f.name, f.base_unit;

grant select on public.feed_inventory_stock to authenticated;
