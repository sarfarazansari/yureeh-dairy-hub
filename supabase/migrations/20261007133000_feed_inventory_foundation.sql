-- Feed inventory foundation: append-only stock movement ledger.
-- Quantities are always stored in the feed item's base unit.
-- Unit cost is always per base unit.

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
-- The trigger below also makes direct inserts obey the same stock rules.

create or replace function public.prepare_feed_inventory_movement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_quantity numeric(14,3);
  current_value numeric(16,2);
  effective_unit_cost numeric(14,2);
  signed_quantity numeric(14,3);
begin
  if new.user_id <> (select auth.uid()) then
    raise exception 'You can only create inventory movements for your own farm.';
  end if;

  -- Serialize movements for the same feed item so two concurrent deductions
  -- cannot both pass the stock check against the same starting balance.
  perform 1
  from public.feed_items
  where id = new.feed_item_id
    and user_id = new.user_id
  for update;

  if not found then
    raise exception 'Feed item not found or does not belong to the current user.';
  end if;

  select
    coalesce(sum(
      case
        when movement_type in ('PURCHASE', 'ADJUSTMENT_IN') then quantity
        else -quantity
      end
    ), 0),
    coalesce(sum(
      case
        when movement_type in ('PURCHASE', 'ADJUSTMENT_IN')
          then quantity * coalesce(unit_cost, 0)
        else -(quantity * coalesce(unit_cost, 0))
      end
    ), 0)
  into current_quantity, current_value
  from public.feed_inventory_movements
  where user_id = new.user_id
    and feed_item_id = new.feed_item_id;

  if new.movement_type in ('PURCHASE', 'ADJUSTMENT_IN') then
    if new.unit_cost is null then
      raise exception 'Unit cost is required for purchase and stock-in movements.';
    end if;
    effective_unit_cost := new.unit_cost;
  else
    if new.unit_cost is null then
      if current_quantity <= 0 then
        raise exception 'Cannot remove stock because there is no available inventory.';
      end if;
      effective_unit_cost := round(current_value / current_quantity, 2);
    else
      effective_unit_cost := new.unit_cost;
    end if;
  end if;

  signed_quantity := case
    when new.movement_type in ('PURCHASE', 'ADJUSTMENT_IN') then new.quantity
    else -new.quantity
  end;

  if current_quantity + signed_quantity < 0 then
    raise exception 'Insufficient stock. Available: %, requested: %.', current_quantity, new.quantity;
  end if;

  new.unit_cost := effective_unit_cost;

  return new;
end;
$$;

create trigger feed_inventory_movements_prepare
before insert on public.feed_inventory_movements
for each row
execute function public.prepare_feed_inventory_movement();

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
