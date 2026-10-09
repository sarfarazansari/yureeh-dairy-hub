-- Acquisition costs are linked to existing expense records so capitalizing an eligible
-- cost does not create a second cash/expense transaction.
create table public.buffalo_acquisition_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  buffalo_id uuid not null,
  expense_id uuid not null,
  cost_date date not null,
  description text not null check (length(trim(description)) > 0),
  amount numeric(14,2) not null check (amount > 0),
  notes text,
  created_at timestamptz not null default now(),
  foreign key (user_id, buffalo_id) references public.buffaloes(user_id, id) on delete restrict,
  foreign key (user_id, expense_id) references public.expenses(user_id, id) on delete restrict,
  unique (user_id, expense_id)
);

create index buffalo_acquisition_costs_asset_date_idx
  on public.buffalo_acquisition_costs(user_id, buffalo_id, cost_date);

alter table public.buffalo_acquisition_costs enable row level security;
create policy buffalo_acquisition_costs_select_own on public.buffalo_acquisition_costs
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.buffalo_acquisition_costs to authenticated;
revoke insert, update, delete on public.buffalo_acquisition_costs from anon, authenticated;

alter table public.buffalo_sales
  add column if not exists carrying_value_at_sale numeric(14,2),
  add column if not exists gain_loss_amount numeric(14,2);

alter table public.buffalo_disposals
  add column if not exists carrying_value_at_disposal numeric(14,2),
  add column if not exists disposal_loss_amount numeric(14,2);

create or replace function public.apply_buffalo_terminal_carrying_value()
returns trigger
language plpgsql
security definer
set search_path = ''
as $buffalo_carrying_value$
declare
  v_user_id uuid := new.user_id;
  v_buffalo_id uuid := new.buffalo_id;
  v_effective_date date;
  v_purchase_price numeric(14,2);
  v_carrying_value numeric(14,2);
begin
  if tg_table_name = 'buffalo_sales' then
    v_effective_date := new.sale_date;
  else
    v_effective_date := new.effective_date;
  end if;

  select bp.purchase_price into v_purchase_price
  from public.buffalo_purchases bp
  where bp.user_id = v_user_id and bp.buffalo_id = v_buffalo_id
  order by bp.purchase_date
  limit 1;

  if v_purchase_price is null then
    raise exception using errcode = '23514',
      message = 'Cannot calculate buffalo carrying value because the acquisition purchase record is missing.';
  end if;

  select round(v_purchase_price + coalesce(sum(c.amount), 0), 2)
  into v_carrying_value
  from public.buffalo_acquisition_costs c
  where c.user_id = v_user_id
    and c.buffalo_id = v_buffalo_id
    and c.cost_date <= v_effective_date;

  if tg_table_name = 'buffalo_sales' then
    new.carrying_value_at_sale := v_carrying_value;
    new.gain_loss_amount := round(new.sale_price - v_carrying_value, 2);
  else
    new.carrying_value_at_disposal := v_carrying_value;
    new.disposal_loss_amount := v_carrying_value;
  end if;

  return new;
end;
$buffalo_carrying_value$;

drop trigger if exists buffalo_sales_carrying_value on public.buffalo_sales;
create trigger buffalo_sales_carrying_value
before insert or update of buffalo_id, sale_date, sale_price
on public.buffalo_sales
for each row execute function public.apply_buffalo_terminal_carrying_value();

drop trigger if exists buffalo_disposals_carrying_value on public.buffalo_disposals;
create trigger buffalo_disposals_carrying_value
before insert or update of buffalo_id, effective_date
on public.buffalo_disposals
for each row execute function public.apply_buffalo_terminal_carrying_value();

-- Backfill existing terminal events from acquisition purchase price and any costs already linked.
update public.buffalo_sales s
set carrying_value_at_sale = round(
      (select bp.purchase_price from public.buffalo_purchases bp
       where bp.user_id = s.user_id and bp.buffalo_id = s.buffalo_id
       order by bp.purchase_date limit 1)
      + coalesce((select sum(c.amount) from public.buffalo_acquisition_costs c
        where c.user_id = s.user_id and c.buffalo_id = s.buffalo_id
          and c.cost_date <= s.sale_date), 0), 2),
    gain_loss_amount = round(s.sale_price - (
      (select bp.purchase_price from public.buffalo_purchases bp
       where bp.user_id = s.user_id and bp.buffalo_id = s.buffalo_id
       order by bp.purchase_date limit 1)
      + coalesce((select sum(c.amount) from public.buffalo_acquisition_costs c
        where c.user_id = s.user_id and c.buffalo_id = s.buffalo_id
          and c.cost_date <= s.sale_date), 0)), 2)
where exists (select 1 from public.buffalo_purchases bp
  where bp.user_id = s.user_id and bp.buffalo_id = s.buffalo_id)
  and (s.carrying_value_at_sale is null or s.gain_loss_amount is null);

update public.buffalo_disposals d
set carrying_value_at_disposal = round(
      (select bp.purchase_price from public.buffalo_purchases bp
       where bp.user_id = d.user_id and bp.buffalo_id = d.buffalo_id
       order by bp.purchase_date limit 1)
      + coalesce((select sum(c.amount) from public.buffalo_acquisition_costs c
        where c.user_id = d.user_id and c.buffalo_id = d.buffalo_id
          and c.cost_date <= d.effective_date), 0), 2),
    disposal_loss_amount = round(
      (select bp.purchase_price from public.buffalo_purchases bp
       where bp.user_id = d.user_id and bp.buffalo_id = d.buffalo_id
       order by bp.purchase_date limit 1)
      + coalesce((select sum(c.amount) from public.buffalo_acquisition_costs c
        where c.user_id = d.user_id and c.buffalo_id = d.buffalo_id
          and c.cost_date <= d.effective_date), 0), 2)
where exists (select 1 from public.buffalo_purchases bp
  where bp.user_id = d.user_id and bp.buffalo_id = d.buffalo_id)
  and (d.carrying_value_at_disposal is null or d.disposal_loss_amount is null);

create or replace function public.record_buffalo_acquisition_cost(
  p_buffalo_id uuid,
  p_expense_id uuid,
  p_cost_date date,
  p_description text,
  p_amount numeric,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $record_acquisition_cost$
declare
  owner_id uuid := auth.uid();
  expense_row public.expenses%rowtype;
  buffalo_row public.buffaloes%rowtype;
  cost_id uuid;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_cost_date is null or nullif(btrim(p_description), '') is null then
    raise exception using errcode = '23514', message = 'Cost date and description are required.';
  end if;
  if p_amount is null or p_amount <= 0 or scale(p_amount) > 2 then
    raise exception using errcode = '23514', message = 'Acquisition cost must be greater than zero and use at most two decimal places.';
  end if;

  select * into buffalo_row
  from public.buffaloes
  where id = p_buffalo_id and user_id = owner_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Buffalo was not found.';
  end if;
  if exists (select 1 from public.buffalo_sales s where s.user_id = owner_id and s.buffalo_id = p_buffalo_id)
    or exists (select 1 from public.buffalo_disposals d where d.user_id = owner_id and d.buffalo_id = p_buffalo_id) then
    raise exception using errcode = '23514', message = 'Acquisition costs cannot be added after a buffalo is sold or disposed.';
  end if;

  select * into expense_row
  from public.expenses
  where id = p_expense_id and user_id = owner_id and deleted_at is null
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'Link the acquisition cost to an active farm expense.';
  end if;
  if expense_row.buffalo_id is distinct from p_buffalo_id then
    raise exception using errcode = '23514', message = 'The linked expense must already be assigned to this buffalo.';
  end if;
  if p_amount > expense_row.total_amount then
    raise exception using errcode = '23514', message = 'Capitalized acquisition cost cannot exceed the linked expense total.';
  end if;
  if buffalo_row.purchase_date is not null and p_cost_date < buffalo_row.purchase_date then
    raise exception using errcode = '23514', message = 'Acquisition cost date cannot be before the buffalo purchase date.';
  end if;

  insert into public.buffalo_acquisition_costs(
    user_id, buffalo_id, expense_id, cost_date, description, amount, notes
  ) values (
    owner_id, p_buffalo_id, p_expense_id, p_cost_date, btrim(p_description), p_amount, nullif(btrim(p_notes), '')
  ) returning id into cost_id;

  return cost_id;
exception
  when unique_violation then
    raise exception using errcode = '23505',
      message = 'This expense is already linked to an acquisition cost.';
end;
$record_acquisition_cost$;

revoke all on function public.record_buffalo_acquisition_cost(uuid,uuid,date,text,numeric,text) from public, anon;
grant execute on function public.record_buffalo_acquisition_cost(uuid,uuid,date,text,numeric,text) to authenticated;

-- Keep capitalized asset costs attached to the expense that substantiates them.
create or replace function public.guard_linked_buffalo_acquisition_expense()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $linked_acquisition_expense$
begin
  if exists (
    select 1
    from public.buffalo_acquisition_costs c
    where c.user_id = old.user_id and c.expense_id = old.id
  ) and (
    new.buffalo_id is distinct from old.buffalo_id
    or new.total_amount is distinct from old.total_amount
    or new.business_date is distinct from old.business_date
    or new.deleted_at is distinct from old.deleted_at
  ) then
    raise exception using errcode = '23514',
      message = 'This expense supports a buffalo acquisition cost. Remove or reconcile the asset-cost link before changing its buffalo, amount, date, or deletion status.';
  end if;
  return new;
end;
$linked_acquisition_expense$;

drop trigger if exists expenses_guard_buffalo_acquisition_cost on public.expenses;
create trigger expenses_guard_buffalo_acquisition_cost
before update of buffalo_id, total_amount, business_date, deleted_at
on public.expenses
for each row execute function public.guard_linked_buffalo_acquisition_expense();

revoke all on function public.guard_linked_buffalo_acquisition_expense() from public, anon, authenticated;
