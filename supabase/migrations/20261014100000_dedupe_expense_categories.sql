-- Keep shared system categories canonical and remove farm-owned copies
-- created by the legacy ensureExpenseCategories() initializer.
-- Repoint every expense (including soft-deleted history) before deleting copies.
with duplicate_categories as (
  select
    farm.id as farm_category_id,
    shared.id as shared_category_id
  from public.expense_categories farm
  join public.expense_categories shared
    on shared.owner_id is null
   and lower(trim(shared.name)) = lower(trim(farm.name))
   and shared.category_group = farm.category_group
   and shared.default_unit is not distinct from farm.default_unit
   and shared.is_quantity_based = farm.is_quantity_based
  where farm.owner_id is not null
)
update public.expenses expense
set category_id = duplicate_categories.shared_category_id
from duplicate_categories
where expense.category_id = duplicate_categories.farm_category_id;

with duplicate_categories as (
  select farm.id as farm_category_id
  from public.expense_categories farm
  join public.expense_categories shared
    on shared.owner_id is null
   and lower(trim(shared.name)) = lower(trim(farm.name))
   and shared.category_group = farm.category_group
   and shared.default_unit is not distinct from farm.default_unit
   and shared.is_quantity_based = farm.is_quantity_based
  where farm.owner_id is not null
)
delete from public.expense_categories category
using duplicate_categories
where category.id = duplicate_categories.farm_category_id;

-- Prevent future copies of a shared default from being created for a farm.
-- Custom category names may still be reused by different farms.
create or replace function public.prevent_duplicate_expense_category_names()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.expense_categories existing
    where existing.id <> new.id
      and lower(trim(existing.name)) = lower(trim(new.name))
      and (
        (new.owner_id is null and existing.owner_id is null)
        or
        (new.owner_id is not null and (existing.owner_id is null or existing.owner_id = new.owner_id))
      )
  ) then
    raise exception 'An expense category with this name already exists.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

create trigger expense_categories_prevent_duplicate_names
before insert or update of name, owner_id
on public.expense_categories
for each row execute function public.prevent_duplicate_expense_category_names();
