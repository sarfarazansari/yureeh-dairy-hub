-- Financial reconciliation foundation: dated expense payments and server-side totals.
-- Existing paid_amount values are preserved as opening/legacy amounts; no historical payment dates are fabricated.

create table public.expense_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_id uuid not null,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method public.expense_payment_method not null check (payment_method <> 'CREDIT'),
  transaction_reference text,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (user_id, expense_id)
    references public.expenses(user_id, id) on delete cascade
);

create index expense_payments_expense_idx
  on public.expense_payments(user_id, expense_id, payment_date desc, created_at desc);
create index expense_payments_date_idx
  on public.expense_payments(user_id, payment_date desc);

alter table public.expense_payments enable row level security;
create policy expense_payments_select_own on public.expense_payments
  for select to authenticated using (user_id = (select auth.uid()));
create policy expense_payments_insert_own on public.expense_payments
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy expense_payments_update_own on public.expense_payments
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy expense_payments_delete_own on public.expense_payments
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.record_expense_payment(
  p_expense_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_method public.expense_payment_method,
  p_transaction_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  expense_row public.expenses%rowtype;
  payment_id uuid;
  new_paid numeric(14,2);
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_payment_date is null then
    raise exception using errcode = '23514', message = 'Payment date is required.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception using errcode = '23514', message = 'Payment amount must be greater than ₹0.';
  end if;
  if p_payment_method is null or p_payment_method = 'CREDIT' then
    raise exception using errcode = '23514', message = 'Choose an actual payment method.';
  end if;

  select *
    into expense_row
  from public.expenses
  where id = p_expense_id
    and user_id = owner_id
    and deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Expense was not found.';
  end if;
  if p_amount > expense_row.pending_amount then
    raise exception using errcode = '23514', message = 'Payment cannot exceed the pending expense balance.';
  end if;

  insert into public.expense_payments(
    user_id, expense_id, payment_date, amount, payment_method,
    transaction_reference, notes
  )
  values (
    owner_id, expense_row.id, p_payment_date, p_amount, p_payment_method,
    nullif(btrim(p_transaction_reference), ''), nullif(btrim(p_notes), '')
  )
  returning id into payment_id;

  new_paid := expense_row.paid_amount + p_amount;
  perform set_config('app.allow_expense_payment_update', 'true', true);
  update public.expenses
  set paid_amount = new_paid,
      payment_status = case
        when new_paid = total_amount then 'PAID'::public.payment_status
        when new_paid > 0 then 'PARTIAL'::public.payment_status
        else 'CREDIT'::public.payment_status
      end,
      payment_method = p_payment_method,
      due_date = case when new_paid = total_amount then null else due_date end
  where id = expense_row.id and user_id = owner_id;

  return payment_id;
end;
$$;

revoke all on function public.record_expense_payment(
  uuid, date, numeric, public.expense_payment_method, text, text
) from public, anon;
grant execute on function public.record_expense_payment(
  uuid, date, numeric, public.expense_payment_method, text, text
) to authenticated;

-- All values are aggregated in PostgreSQL so report totals are not subject to PostgREST row limits.
create or replace function public.get_farm_financial_summary(p_from date, p_to date)
returns table (
  milk_quantity_sold numeric,
  milk_sales_revenue numeric,
  customer_collections numeric,
  operating_expenses numeric,
  dated_expense_payments numeric,
  customer_net_receivable numeric,
  supplier_outstanding numeric,
  legacy_undated_paid_amount numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
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
    coalesce((select sum(e.total_amount) from public.expenses e
      where e.user_id = owner_id and e.deleted_at is null
        and e.business_date between p_from and p_to), 0),
    coalesce((select sum(ep.amount) from public.expense_payments ep
      where ep.user_id = owner_id and ep.payment_date between p_from and p_to), 0),
    coalesce((select sum(m.calculated_amount) from public.milk_entries m
      where m.user_id = owner_id and m.deleted_at is null), 0)
      - coalesce((select sum(cp.amount) from public.customer_payments cp
        where cp.user_id = owner_id), 0),
    coalesce((select sum(e.pending_amount) from public.expenses e
      where e.user_id = owner_id and e.deleted_at is null), 0),
    coalesce((select sum(greatest(e.paid_amount - coalesce(payments.ledger_paid, 0), 0))
      from public.expenses e
      left join lateral (
        select sum(ep.amount) as ledger_paid
        from public.expense_payments ep
        where ep.user_id = owner_id and ep.expense_id = e.id
      ) payments on true
      where e.user_id = owner_id and e.deleted_at is null), 0);
end;
$$;

revoke all on function public.get_farm_financial_summary(date, date) from public, anon;
grant execute on function public.get_farm_financial_summary(date, date) to authenticated;


-- Prevent the legacy expense editor from overwriting ledger-derived balances.
-- The payment RPC opts in transaction-locally immediately before updating the balance.
create or replace function public.guard_expense_paid_amount_with_ledger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.expense_payments ep
    where ep.user_id = old.user_id and ep.expense_id = old.id
  ) and current_setting('app.allow_expense_payment_update', true) is distinct from 'true' then
    raise exception using
      errcode = '23514',
      message = 'This expense has dated payments. Use the payment ledger to update its balance.';
  end if;
  return new;
end;
$$;

create trigger expenses_guard_paid_amount_ledger
before update of paid_amount on public.expenses
for each row execute function public.guard_expense_paid_amount_with_ledger();
