-- Customer receivables and payment ledger.
-- Customer payments are separate financial transactions from milk sales.

create table public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method public.payment_method not null,
  transaction_reference text,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (user_id, customer_id)
    references public.customers(user_id, id) on delete cascade
);

create index customer_payments_customer_idx
  on public.customer_payments(user_id, customer_id, payment_date desc, created_at desc);

alter table public.customer_payments enable row level security;

create policy customer_payments_select_own on public.customer_payments
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy customer_payments_insert_own on public.customer_payments
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy customer_payments_update_own on public.customer_payments
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy customer_payments_delete_own on public.customer_payments
  for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.record_customer_payment(
  p_customer_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_method public.payment_method,
  p_transaction_reference text,
  p_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  payment_id uuid;
  customer_row_id uuid;
  sales_total numeric(14,2);
  payments_total numeric(14,2);
  outstanding numeric(14,2);
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

  if p_payment_method is null then
    raise exception using errcode = '23514', message = 'Payment method is required.';
  end if;

  select c.id
    into customer_row_id
  from public.customers c
  where c.id = p_customer_id
    and c.user_id = owner_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Customer was not found.';
  end if;

  select coalesce(sum(m.calculated_amount), 0)
    into sales_total
  from public.milk_entries m
  where m.user_id = owner_id
    and m.customer_id = p_customer_id
    and m.deleted_at is null;

  select coalesce(sum(p.amount), 0)
    into payments_total
  from public.customer_payments p
  where p.user_id = owner_id
    and p.customer_id = customer_row_id;

  outstanding := sales_total - payments_total;

  if outstanding <= 0 then
    raise exception using errcode = '23514', message = 'This customer has no outstanding balance.';
  end if;

  if p_amount > outstanding then
    raise exception using errcode = '23514',
      message = format('Payment cannot be greater than the outstanding balance of ₹%s.', to_char(outstanding, 'FM999999990.00'));
  end if;

  insert into public.customer_payments(
    user_id,
    customer_id,
    payment_date,
    amount,
    payment_method,
    transaction_reference,
    notes
  )
  values (
    owner_id,
    customer_row_id,
    p_payment_date,
    p_amount,
    p_payment_method,
    nullif(btrim(p_transaction_reference), ''),
    nullif(btrim(p_notes), '')
  )
  returning id into payment_id;

  return payment_id;
end;
$$;

revoke all on function public.record_customer_payment(uuid,date,numeric,public.payment_method,text,text)
  from public, anon;

grant execute on function public.record_customer_payment(uuid,date,numeric,public.payment_method,text,text)
  to authenticated;
