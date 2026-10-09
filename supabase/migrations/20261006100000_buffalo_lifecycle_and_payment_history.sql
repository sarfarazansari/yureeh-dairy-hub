-- Buffalo lifecycle and purchase-payment history.
-- These are append-only business events; existing purchase snapshots remain intact.

-- The purchase primary key is globally unique, but tenant-scoped composite
-- foreign keys are used throughout the schema for ownership integrity.
alter table public.buffalo_purchases
  add constraint buffalo_purchases_user_id_id_key unique (user_id, id);


create table public.buffalo_purchase_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  buffalo_purchase_id uuid not null,
  buffalo_id uuid not null,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method public.payment_method not null,
  transaction_reference text,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (user_id, buffalo_purchase_id)
    references public.buffalo_purchases(user_id, id) on delete cascade,
  foreign key (user_id, buffalo_id)
    references public.buffaloes(user_id, id) on delete cascade
);

create index buffalo_purchase_payments_purchase_idx
  on public.buffalo_purchase_payments(user_id, buffalo_purchase_id, payment_date desc);
create index buffalo_purchase_payments_buffalo_idx
  on public.buffalo_purchase_payments(user_id, buffalo_id, payment_date desc);

alter table public.buffalo_purchase_payments enable row level security;
create policy buffalo_purchase_payments_select_own on public.buffalo_purchase_payments
  for select to authenticated using (user_id = (select auth.uid()));
create policy buffalo_purchase_payments_insert_own on public.buffalo_purchase_payments
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy buffalo_purchase_payments_update_own on public.buffalo_purchase_payments
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy buffalo_purchase_payments_delete_own on public.buffalo_purchase_payments
  for delete to authenticated using (user_id = (select auth.uid()));

create table public.buffalo_status_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  buffalo_id uuid not null,
  status public.buffalo_status not null,
  effective_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (user_id, buffalo_id)
    references public.buffaloes(user_id, id) on delete cascade
);

create index buffalo_status_history_buffalo_idx
  on public.buffalo_status_history(user_id, buffalo_id, effective_date desc, created_at desc);

alter table public.buffalo_status_history enable row level security;
create policy buffalo_status_history_select_own on public.buffalo_status_history
  for select to authenticated using (user_id = (select auth.uid()));
create policy buffalo_status_history_insert_own on public.buffalo_status_history
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy buffalo_status_history_update_own on public.buffalo_status_history
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy buffalo_status_history_delete_own on public.buffalo_status_history
  for delete to authenticated using (user_id = (select auth.uid()));

-- Backfill the initial state without inventing historical status transitions.
insert into public.buffalo_status_history(user_id, buffalo_id, status, effective_date, notes)
select b.user_id, b.id, b.current_status, coalesce(b.purchase_date, current_date), 'Initial status recorded from buffalo master.'
from public.buffaloes b
where not exists (
  select 1 from public.buffalo_status_history h
  where h.buffalo_id = b.id
);

create or replace function public.record_buffalo_purchase_payment(
  p_buffalo_id uuid,
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
  purchase_row public.buffalo_purchases%rowtype;
  payment_id uuid;
  new_paid numeric;
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

  select *
    into purchase_row
  from public.buffalo_purchases
  where user_id = owner_id and buffalo_id = p_buffalo_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Buffalo purchase record was not found.';
  end if;

  if p_amount > purchase_row.amount_pending then
    raise exception using errcode = '23514', message = 'Payment cannot be greater than the pending purchase balance.';
  end if;

  insert into public.buffalo_purchase_payments(
    user_id, buffalo_purchase_id, buffalo_id, payment_date, amount,
    payment_method, transaction_reference, notes
  )
  values (
    owner_id, purchase_row.id, p_buffalo_id, p_payment_date, p_amount,
    p_payment_method, nullif(btrim(p_transaction_reference), ''), nullif(btrim(p_notes), '')
  )
  returning id into payment_id;

  new_paid := purchase_row.amount_paid + p_amount;

  update public.buffalo_purchases
  set amount_paid = new_paid,
      payment_status = case
        when new_paid = purchase_price then 'PAID'::public.payment_status
        else 'PARTIAL'::public.payment_status
      end,
      payment_due_date = case when new_paid = purchase_price then null else payment_due_date end,
      payment_terms = case when new_paid = purchase_price then null else payment_terms end,
      payment_method = case when new_paid = purchase_price then p_payment_method else payment_method end,
      transaction_reference = case when new_paid = purchase_price then nullif(btrim(p_transaction_reference), '') else transaction_reference end
  where id = purchase_row.id
    and user_id = owner_id;

  return payment_id;
end;
$$;

revoke all on function public.record_buffalo_purchase_payment(uuid,date,numeric,public.payment_method,text,text)
  from public, anon;
grant execute on function public.record_buffalo_purchase_payment(uuid,date,numeric,public.payment_method,text,text)
  to authenticated;

create or replace function public.change_buffalo_status(
  p_buffalo_id uuid,
  p_status public.buffalo_status,
  p_effective_date date,
  p_notes text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  current public.buffaloes%rowtype;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_effective_date is null then
    raise exception using errcode = '23514', message = 'Status effective date is required.';
  end if;
  if p_status is null then
    raise exception using errcode = '23514', message = 'Buffalo status is required.';
  end if;

  select *
    into current
  from public.buffaloes
  where id = p_buffalo_id and user_id = owner_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Buffalo was not found.';
  end if;

  if current.current_status = p_status then
    raise exception using errcode = '23514', message = 'Buffalo is already in this status.';
  end if;

  update public.buffaloes
  set current_status = p_status
  where id = p_buffalo_id and user_id = owner_id;

  insert into public.buffalo_status_history(
    user_id, buffalo_id, status, effective_date, notes
  )
  values (
    owner_id, p_buffalo_id, p_status, p_effective_date, nullif(btrim(p_notes), '')
  );
end;
$$;

revoke all on function public.change_buffalo_status(uuid,public.buffalo_status,date,text)
  from public, anon;
grant execute on function public.change_buffalo_status(uuid,public.buffalo_status,date,text)
  to authenticated;
