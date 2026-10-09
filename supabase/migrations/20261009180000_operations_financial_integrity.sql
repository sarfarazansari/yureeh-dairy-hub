-- Operations and financial integrity hardening.
-- All milk availability checks are serialized per farm/date/shift.
-- Financial snapshots separate current balances from balances as of a historical date.
-- Buffalo carrying value includes the original acquisition price and explicitly linked acquisition costs;
-- depreciation is intentionally not assumed until the farm adopts a depreciation policy.

create or replace function public.guard_milk_pool_nonnegative_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $milk_balance_guard$
declare
  v_balance numeric(14,3);
  v_delta numeric(14,3);
  v_shift_key text;
begin
  if new.user_id is null or new.business_date is null then
    raise exception using errcode = '23514', message = 'Milk pool movements require a farm and business date.';
  end if;

  if new.shift is null and coalesce(new.movement_direction, '') = 'OUT' then
    raise exception using errcode = '23514', message = 'Milk outflow must belong to a morning or evening shift.';
  end if;

  if new.shift is null then
    return new;
  end if;

  v_shift_key := new.user_id::text || ':' || new.business_date::text || ':' || new.shift::text;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_shift_key, 0));

  select coalesce(sum(
    case
      when m.movement_direction = 'IN' then m.quantity
      when m.movement_direction = 'OUT' then -m.quantity
      when m.movement_type = 'PRODUCTION_RECEIPT' then m.quantity
      when m.movement_type = 'CUSTOMER_DELIVERY' then -m.quantity
      when m.movement_type = 'ADJUSTMENT' then m.quantity
      else -m.quantity
    end
  ), 0)
  into v_balance
  from public.milk_pool_movements m
  where m.user_id = new.user_id
    and m.business_date = new.business_date
    and m.shift = new.shift
    and (tg_op = 'INSERT' or m.id <> old.id);

  v_delta := case
    when new.movement_direction = 'IN' then new.quantity
    when new.movement_direction = 'OUT' then -new.quantity
    when new.movement_type = 'PRODUCTION_RECEIPT' then new.quantity
    when new.movement_type = 'CUSTOMER_DELIVERY' then -new.quantity
    when new.movement_type = 'ADJUSTMENT' then new.quantity
    else -new.quantity
  end;

  if v_balance + v_delta < 0 then
    raise exception using
      errcode = '23514',
      message = format(
        'Insufficient milk in the %s shift on %s. Available: %s litres; requested outflow: %s litres.',
        new.shift, new.business_date, greatest(v_balance, 0), new.quantity
      );
  end if;

  return new;
end;
$milk_balance_guard$;

drop trigger if exists milk_pool_nonnegative_balance_guard on public.milk_pool_movements;
create trigger milk_pool_nonnegative_balance_guard
before insert or update of user_id, business_date, shift, movement_type, movement_direction, quantity
on public.milk_pool_movements
for each row execute function public.guard_milk_pool_nonnegative_balance();

revoke all on function public.guard_milk_pool_nonnegative_balance() from public, anon, authenticated;

-- Snapshot balances by event date. Legacy undated payments are reported separately rather
-- than being assigned an invented date in historical balances.
create or replace function public.get_financial_balance_snapshot(p_as_of date)
returns table (
  snapshot_date date,
  customer_receivables_current numeric,
  customer_credits_current numeric,
  customer_receivables_as_of numeric,
  customer_credits_as_of numeric,
  supplier_outstanding_current numeric,
  supplier_outstanding_as_of_before_legacy numeric,
  supplier_legacy_undated_paid_amount numeric,
  buffalo_purchase_outstanding_current numeric,
  buffalo_purchase_outstanding_as_of_before_legacy numeric,
  buffalo_purchase_legacy_undated_paid_amount numeric,
  buffalo_sale_outstanding_current numeric,
  buffalo_sale_outstanding_as_of numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $financial_snapshot$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_as_of is null then
    raise exception using errcode = '23514', message = 'Choose a historical date for the balance snapshot.';
  end if;

  return query
  with customer_lifetime as (
    select c.id,
      coalesce((select sum(m.calculated_amount) from public.milk_entries m
        where m.user_id = owner_id and m.customer_id = c.id and m.deleted_at is null), 0) as sales,
      coalesce((select sum(cp.amount) from public.customer_payments cp
        where cp.user_id = owner_id and cp.customer_id = c.id), 0) as payments
    from public.customers c
    where c.user_id = owner_id
  ),
  customer_historical as (
    select c.id,
      coalesce((select sum(m.calculated_amount) from public.milk_entries m
        where m.user_id = owner_id and m.customer_id = c.id
          and m.deleted_at is null and m.business_date <= p_as_of), 0) as sales,
      coalesce((select sum(cp.amount) from public.customer_payments cp
        where cp.user_id = owner_id and cp.customer_id = c.id
          and cp.payment_date <= p_as_of), 0) as payments
    from public.customers c
    where c.user_id = owner_id
  ),
  expense_ledger as (
    select e.id, e.total_amount, e.paid_amount,
      coalesce((select sum(ep.amount) from public.expense_payments ep
        where ep.user_id = owner_id and ep.expense_id = e.id), 0) as all_dated_payments,
      coalesce((select sum(ep.amount) from public.expense_payments ep
        where ep.user_id = owner_id and ep.expense_id = e.id
          and ep.payment_date <= p_as_of), 0) as dated_payments_as_of
    from public.expenses e
    where e.user_id = owner_id and e.deleted_at is null
  ),
  purchase_ledger as (
    select bp.id, bp.purchase_price, bp.amount_paid,
      coalesce((select sum(p.amount) from public.buffalo_purchase_payments p
        where p.user_id = owner_id and p.buffalo_id = bp.buffalo_id), 0) as all_dated_payments,
      coalesce((select sum(p.amount) from public.buffalo_purchase_payments p
        where p.user_id = owner_id and p.buffalo_id = bp.buffalo_id
          and p.payment_date <= p_as_of), 0) as dated_payments_as_of,
      bp.purchase_date
    from public.buffalo_purchases bp
    where bp.user_id = owner_id
  ),
  sale_ledger as (
    select s.id, s.sale_price, s.amount_pending, s.sale_date,
      coalesce((select sum(p.amount) from public.buffalo_sale_payments p
        where p.user_id = owner_id and p.buffalo_sale_id = s.id), 0) as all_payments,
      coalesce((select sum(p.amount) from public.buffalo_sale_payments p
        where p.user_id = owner_id and p.buffalo_sale_id = s.id
          and p.payment_date <= p_as_of), 0) as payments_as_of
    from public.buffalo_sales s
    where s.user_id = owner_id
  )
  select
    p_as_of,
    coalesce((select sum(greatest(sales - payments, 0)) from customer_lifetime), 0),
    coalesce((select sum(greatest(payments - sales, 0)) from customer_lifetime), 0),
    coalesce((select sum(greatest(sales - payments, 0)) from customer_historical), 0),
    coalesce((select sum(greatest(payments - sales, 0)) from customer_historical), 0),
    coalesce((select sum(greatest(total_amount - paid_amount, 0)) from expense_ledger), 0),
    coalesce((select sum(greatest(e.total_amount - e.dated_payments_as_of, 0))
      from expense_ledger e
      join public.expenses source on source.id = e.id
      where source.business_date <= p_as_of), 0),
    coalesce((select sum(greatest(paid_amount - all_dated_payments, 0)) from expense_ledger), 0),
    coalesce((select sum(bp.amount_pending) from public.buffalo_purchases bp
      where bp.user_id = owner_id), 0),
    coalesce((select sum(greatest(purchase_price - dated_payments_as_of, 0))
      from purchase_ledger where purchase_date <= p_as_of), 0),
    coalesce((select sum(greatest(amount_paid - all_dated_payments, 0))
      from purchase_ledger), 0),
    coalesce((select sum(amount_pending) from sale_ledger), 0),
    coalesce((select sum(greatest(sale_price - payments_as_of, 0))
      from sale_ledger where sale_date <= p_as_of), 0);
end;
$financial_snapshot$;

revoke all on function public.get_financial_balance_snapshot(date) from public, anon;
grant execute on function public.get_financial_balance_snapshot(date) to authenticated;

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


-- Preserve the existing period KPI contract and add explicit as-of balances.
-- The function is recreated because PostgreSQL cannot change a RETURNS TABLE row type in place.
drop function public.get_farm_financial_summary(date, date);
create function public.get_farm_financial_summary(p_from date, p_to date)
returns table (
  milk_quantity_sold numeric,
  milk_sales_revenue numeric,
  customer_collections numeric,
  operating_expenses numeric,
  dated_expense_payments numeric,
  customer_receivables numeric,
  customer_credits numeric,
  supplier_outstanding numeric,
  buffalo_purchase_cost numeric,
  buffalo_purchase_payments numeric,
  buffalo_purchase_outstanding numeric,
  legacy_undated_paid_amount numeric,
  customer_receivables_as_of numeric,
  customer_credits_as_of numeric,
  supplier_outstanding_as_of_before_legacy numeric,
  supplier_legacy_undated_paid_amount numeric,
  buffalo_purchase_outstanding_as_of_before_legacy numeric,
  buffalo_purchase_legacy_undated_paid_amount numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $farm_summary$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception using errcode = '23514', message = 'Choose a valid report date range.';
  end if;

  return query
  select
    coalesce((select sum(m.milk_quantity) from public.milk_entries m
      where m.user_id = owner_id and m.deleted_at is null
        and m.business_date between p_from and p_to), 0),
    coalesce((select sum(m.calculated_amount) from public.milk_entries m
      where m.user_id = owner_id and m.deleted_at is null
        and m.business_date between p_from and p_to), 0),
    coalesce((select sum(cp.amount) from public.customer_payments cp
      where cp.user_id = owner_id and cp.payment_date between p_from and p_to), 0),
    coalesce((select sum(greatest(e.total_amount - coalesce(capitalized.amount, 0), 0))
      from public.expenses e
      left join lateral (
        select sum(c.amount) as amount
        from public.buffalo_acquisition_costs c
        where c.user_id = owner_id and c.expense_id = e.id
      ) capitalized on true
      where e.user_id = owner_id and e.deleted_at is null
        and e.business_date between p_from and p_to), 0),
    coalesce((select sum(ep.amount) from public.expense_payments ep
      where ep.user_id = owner_id and ep.payment_date between p_from and p_to), 0),
    coalesce((select sum(greatest(coalesce(sales.total, 0) - coalesce(payments.total, 0), 0))
      from public.customers c
      left join lateral (
        select sum(m.calculated_amount) as total from public.milk_entries m
        where m.user_id = owner_id and m.customer_id = c.id and m.deleted_at is null
      ) sales on true
      left join lateral (
        select sum(cp.amount) as total from public.customer_payments cp
        where cp.user_id = owner_id and cp.customer_id = c.id
      ) payments on true
      where c.user_id = owner_id), 0),
    coalesce((select sum(greatest(coalesce(payments.total, 0) - coalesce(sales.total, 0), 0))
      from public.customers c
      left join lateral (
        select sum(m.calculated_amount) as total from public.milk_entries m
        where m.user_id = owner_id and m.customer_id = c.id and m.deleted_at is null
      ) sales on true
      left join lateral (
        select sum(cp.amount) as total from public.customer_payments cp
        where cp.user_id = owner_id and cp.customer_id = c.id
      ) payments on true
      where c.user_id = owner_id), 0),
    coalesce((select sum(e.pending_amount) from public.expenses e
      where e.user_id = owner_id and e.deleted_at is null), 0),
    coalesce((select sum(bp.purchase_price) from public.buffalo_purchases bp
      where bp.user_id = owner_id and bp.purchase_date between p_from and p_to), 0),
    coalesce((select sum(bpp.amount) from public.buffalo_purchase_payments bpp
      where bpp.user_id = owner_id and bpp.payment_date between p_from and p_to), 0),
    coalesce((select sum(bp.amount_pending) from public.buffalo_purchases bp
      where bp.user_id = owner_id), 0),
    coalesce((select sum(greatest(e.paid_amount - coalesce(payments.ledger_paid, 0), 0))
      from public.expenses e
      left join lateral (
        select sum(ep.amount) as ledger_paid
        from public.expense_payments ep
        where ep.user_id = owner_id and ep.expense_id = e.id
      ) payments on true
      where e.user_id = owner_id and e.deleted_at is null), 0),
    coalesce((select sum(greatest(coalesce(sales.total, 0) - coalesce(payments.total, 0), 0))
      from public.customers c
      left join lateral (
        select sum(m.calculated_amount) as total from public.milk_entries m
        where m.user_id = owner_id and m.customer_id = c.id and m.deleted_at is null
          and m.business_date <= p_to
      ) sales on true
      left join lateral (
        select sum(cp.amount) as total from public.customer_payments cp
        where cp.user_id = owner_id and cp.customer_id = c.id
          and cp.payment_date <= p_to
      ) payments on true
      where c.user_id = owner_id), 0),
    coalesce((select sum(greatest(coalesce(payments.total, 0) - coalesce(sales.total, 0), 0))
      from public.customers c
      left join lateral (
        select sum(m.calculated_amount) as total from public.milk_entries m
        where m.user_id = owner_id and m.customer_id = c.id and m.deleted_at is null
          and m.business_date <= p_to
      ) sales on true
      left join lateral (
        select sum(cp.amount) as total from public.customer_payments cp
        where cp.user_id = owner_id and cp.customer_id = c.id
          and cp.payment_date <= p_to
      ) payments on true
      where c.user_id = owner_id), 0),
    coalesce((select sum(greatest(e.total_amount - coalesce(payments.paid, 0), 0))
      from public.expenses e
      left join lateral (
        select sum(ep.amount) as paid from public.expense_payments ep
        where ep.user_id = owner_id and ep.expense_id = e.id
          and ep.payment_date <= p_to
      ) payments on true
      where e.user_id = owner_id and e.deleted_at is null
        and e.business_date <= p_to), 0),
    coalesce((select sum(greatest(e.paid_amount - coalesce(payments.ledger_paid, 0), 0))
      from public.expenses e
      left join lateral (
        select sum(ep.amount) as ledger_paid from public.expense_payments ep
        where ep.user_id = owner_id and ep.expense_id = e.id
      ) payments on true
      where e.user_id = owner_id and e.deleted_at is null), 0),
    coalesce((select sum(greatest(bp.purchase_price - coalesce(payments.paid, 0), 0))
      from public.buffalo_purchases bp
      left join lateral (
        select sum(p.amount) as paid from public.buffalo_purchase_payments p
        where p.user_id = owner_id and p.buffalo_id = bp.buffalo_id
          and p.payment_date <= p_to
      ) payments on true
      where bp.user_id = owner_id and bp.purchase_date <= p_to), 0),
    coalesce((select sum(greatest(bp.amount_paid - coalesce(payments.ledger_paid, 0), 0))
      from public.buffalo_purchases bp
      left join lateral (
        select sum(p.amount) as ledger_paid from public.buffalo_purchase_payments p
        where p.user_id = owner_id and p.buffalo_id = bp.buffalo_id
      ) payments on true
      where bp.user_id = owner_id), 0);
end;
$farm_summary$;

revoke all on function public.get_farm_financial_summary(date, date) from public, anon;
grant execute on function public.get_farm_financial_summary(date, date) to authenticated;


-- Sale reports now return both the live outstanding balance and the balance at the
-- end of the selected report range. Existing output columns retain their order.
drop function public.get_buffalo_sale_financial_summary(date, date);
create function public.get_buffalo_sale_financial_summary(p_from date, p_to date)
returns table (
  buffalo_sale_revenue numeric,
  buffalo_sale_collections numeric,
  buffalo_sale_outstanding numeric,
  buffalo_sales_count bigint,
  buffalo_sale_outstanding_as_of numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $sale_summary$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception using errcode = '23514', message = 'Choose a valid report date range.';
  end if;

  return query
  select
    coalesce((select sum(s.sale_price) from public.buffalo_sales s
      where s.user_id = owner_id and s.sale_date between p_from and p_to), 0),
    coalesce((select sum(p.amount) from public.buffalo_sale_payments p
      where p.user_id = owner_id and p.payment_date between p_from and p_to), 0),
    coalesce((select sum(s.amount_pending) from public.buffalo_sales s
      where s.user_id = owner_id), 0),
    coalesce((select count(*) from public.buffalo_sales s
      where s.user_id = owner_id and s.sale_date between p_from and p_to), 0),
    coalesce((select sum(greatest(s.sale_price - coalesce(payments.paid, 0), 0))
      from public.buffalo_sales s
      left join lateral (
        select sum(p.amount) as paid
        from public.buffalo_sale_payments p
        where p.user_id = owner_id and p.buffalo_sale_id = s.id
          and p.payment_date <= p_to
      ) payments on true
      where s.user_id = owner_id and s.sale_date <= p_to), 0);
end;
$sale_summary$;

revoke all on function public.get_buffalo_sale_financial_summary(date, date) from public, anon;
grant execute on function public.get_buffalo_sale_financial_summary(date, date) to authenticated;
