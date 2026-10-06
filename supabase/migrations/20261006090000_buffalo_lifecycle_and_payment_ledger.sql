-- Buffalo lifecycle history and purchase payment ledger.
-- Keeps the existing purchase summary columns for compatibility while adding
-- appendable operational records for later payments and status changes.

create table public.buffalo_purchase_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid not null,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method public.payment_method not null,
  transaction_reference text,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (user_id, purchase_id)
    references public.buffalo_purchases(user_id, id)
    on delete cascade,
  unique (user_id, id)
);

create index buffalo_purchase_payments_purchase_idx
  on public.buffalo_purchase_payments(user_id, purchase_id, payment_date desc);

alter table public.buffalo_purchase_payments enable row level security;

create policy buffalo_purchase_payments_select_own
  on public.buffalo_purchase_payments for select to authenticated
  using (user_id = (select auth.uid()));

create policy buffalo_purchase_payments_insert_own
  on public.buffalo_purchase_payments for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Payments are operational records. Do not expose update/delete through RLS.

create table public.buffalo_status_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  buffalo_id uuid not null,
  status public.buffalo_status not null,
  effective_date date not null,
  reason text,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (user_id, buffalo_id)
    references public.buffaloes(user_id, id)
    on delete cascade,
  unique (user_id, id)
);

create index buffalo_status_history_buffalo_idx
  on public.buffalo_status_history(user_id, buffalo_id, effective_date desc, created_at desc);

alter table public.buffalo_status_history enable row level security;

create policy buffalo_status_history_select_own
  on public.buffalo_status_history for select to authenticated
  using (user_id = (select auth.uid()));

create policy buffalo_status_history_insert_own
  on public.buffalo_status_history for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Backfill one initial ACTIVE event for existing animals that do not have
-- lifecycle history yet. This does not invent historical transitions.
insert into public.buffalo_status_history(user_id, buffalo_id, status, effective_date, reason)
select b.user_id, b.id, b.current_status, coalesce(b.purchase_date, b.created_at::date), 'Initial recorded status'
from public.buffaloes b
where not exists (
  select 1
  from public.buffalo_status_history h
  where h.user_id = b.user_id and h.buffalo_id = b.id
);

-- New purchases start their lifecycle at ACTIVE.
create or replace function public.create_initial_buffalo_status_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.buffalo_status_history(user_id, buffalo_id, status, effective_date, reason)
  values (new.user_id, new.id, new.current_status, coalesce(new.purchase_date, current_date), 'Initial status');
  return new;
end;
$$;

drop trigger if exists buffalo_initial_status_history on public.buffaloes;
create trigger buffalo_initial_status_history
after insert on public.buffaloes
for each row execute function public.create_initial_buffalo_status_history();

-- Record a later status transition atomically.
create or replace function public.change_buffalo_status(
  p_buffalo_id uuid,
  p_status public.buffalo_status,
  p_effective_date date,
  p_reason text,
  p_notes text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current public.buffalo_status;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign in to change buffalo status.';
  end if;
  if p_effective_date is null then
    raise exception using errcode = '23514', message = 'Status date is required.';
  end if;

  select current_status into v_current
  from public.buffaloes
  where id = p_buffalo_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Buffalo is unavailable to this farm.';
  end if;

  if v_current = p_status then
    raise exception using errcode = '23514', message = 'Buffalo is already in this status.';
  end if;

  update public.buffaloes
  set current_status = p_status
  where id = p_buffalo_id and user_id = auth.uid();

  insert into public.buffalo_status_history(
    user_id, buffalo_id, status, effective_date, reason, notes
  )
  values (
    auth.uid(), p_buffalo_id, p_status, p_effective_date,
    nullif(btrim(p_reason), ''), nullif(btrim(p_notes), '')
  );
end;
$$;

revoke all on function public.change_buffalo_status(uuid, public.buffalo_status, date, text, text)
  from public, anon;
grant execute on function public.change_buffalo_status(uuid, public.buffalo_status, date, text, text)
  to authenticated;

-- Record a payment against an outstanding buffalo purchase.
-- amount_paid on buffalo_purchases remains the current aggregate for
-- compatibility/reporting; this table provides the payment-level history.
create or replace function public.record_buffalo_purchase_payment(
  p_purchase_id uuid,
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
  v_purchase public.buffalo_purchases%rowtype;
  v_payment_id uuid;
  v_new_paid numeric;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign in to record a payment.';
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
  into v_purchase
  from public.buffalo_purchases
  where id = p_purchase_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Purchase is unavailable to this farm.';
  end if;

  if v_purchase.amount_pending <= 0 then
    raise exception using errcode = '23514', message = 'This buffalo purchase is already fully paid.';
  end if;

  v_new_paid := v_purchase.amount_paid + p_amount;

  if v_new_paid > v_purchase.purchase_price then
    raise exception using errcode = '23514', message = 'Payment cannot be greater than the outstanding balance.';
  end if;

  insert into public.buffalo_purchase_payments(
    user_id, purchase_id, payment_date, amount, payment_method,
    transaction_reference, notes
  )
  values (
    auth.uid(), p_purchase_id, p_payment_date, p_amount, p_payment_method,
    nullif(btrim(p_transaction_reference), ''), nullif(btrim(p_notes), '')
  )
  returning id into v_payment_id;

  update public.buffalo_purchases
  set
    amount_paid = v_new_paid,
    payment_status = case
      when v_new_paid = purchase_price then 'PAID'::public.payment_status
      else 'PARTIAL'::public.payment_status
    end,
    payment_due_date = case when v_new_paid = purchase_price then null else payment_due_date end,
    payment_terms = case when v_new_paid = purchase_price then null else payment_terms end
  where id = p_purchase_id and user_id = auth.uid();

  return v_payment_id;
end;
$$;

revoke all on function public.record_buffalo_purchase_payment(
  uuid, date, numeric, public.payment_method, text, text
) from public, anon;
grant execute on function public.record_buffalo_purchase_payment(
  uuid, date, numeric, public.payment_method, text, text
) to authenticated;
