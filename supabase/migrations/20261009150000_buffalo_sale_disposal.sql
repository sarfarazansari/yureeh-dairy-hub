-- Buffalo sale and disposal transactions.
-- Terminal events are recorded transactionally; status alone is not sufficient evidence.

create table public.buffalo_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  buffalo_id uuid not null,
  sale_date date not null,
  buyer_name text not null check (length(trim(buyer_name)) > 0),
  buyer_mobile text,
  buyer_location text,
  sale_price numeric(14,2) not null check (sale_price > 0),
  amount_received numeric(14,2) not null default 0 check (amount_received >= 0 and amount_received <= sale_price),
  amount_pending numeric(14,2) generated always as (sale_price - amount_received) stored,
  payment_status public.payment_status not null,
  payment_due_date date,
  payment_terms text,
  payment_method public.payment_method,
  transaction_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, buffalo_id),
  foreign key (user_id, buffalo_id) references public.buffaloes(user_id, id) on delete restrict,
  check ((payment_status = 'PAID' and amount_pending = 0)
    or (payment_status = 'PARTIAL' and amount_received > 0 and amount_pending > 0)
    or (payment_status = 'CREDIT' and amount_received = 0)),
  check (amount_pending = 0 or payment_due_date is not null)
);

create index buffalo_sales_date_idx on public.buffalo_sales(user_id, sale_date desc);
create index buffalo_sales_balance_idx on public.buffalo_sales(user_id, payment_status) where amount_pending > 0;

create table public.buffalo_sale_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  buffalo_sale_id uuid not null,
  buffalo_id uuid not null,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method public.payment_method not null,
  transaction_reference text,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (user_id, buffalo_sale_id) references public.buffalo_sales(user_id, id) on delete restrict,
  foreign key (user_id, buffalo_id) references public.buffaloes(user_id, id) on delete restrict
);

create index buffalo_sale_payments_sale_idx on public.buffalo_sale_payments(user_id, buffalo_sale_id, payment_date desc);
create index buffalo_sale_payments_buffalo_idx on public.buffalo_sale_payments(user_id, buffalo_id, payment_date desc);

create table public.buffalo_disposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  buffalo_id uuid not null,
  disposal_type text not null check (disposal_type in ('DEATH', 'TRANSFER_OUT', 'OTHER')),
  effective_date date not null,
  reason text not null check (length(trim(reason)) > 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, buffalo_id),
  foreign key (user_id, buffalo_id) references public.buffaloes(user_id, id) on delete restrict
);

create index buffalo_disposals_date_idx on public.buffalo_disposals(user_id, effective_date desc);

alter table public.buffalo_sales enable row level security;
alter table public.buffalo_sale_payments enable row level security;
alter table public.buffalo_disposals enable row level security;

create policy buffalo_sales_select_own on public.buffalo_sales
  for select to authenticated using (user_id = (select auth.uid()));
create policy buffalo_sale_payments_select_own on public.buffalo_sale_payments
  for select to authenticated using (user_id = (select auth.uid()));
create policy buffalo_disposals_select_own on public.buffalo_disposals
  for select to authenticated using (user_id = (select auth.uid()));

grant select on public.buffalo_sales, public.buffalo_sale_payments, public.buffalo_disposals to authenticated;
revoke insert, update, delete on public.buffalo_sales, public.buffalo_sale_payments, public.buffalo_disposals from anon, authenticated;

-- Only transaction RPCs may move a buffalo into a terminal status.
create or replace function public.guard_terminal_buffalo_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $guard$
begin
  if new.current_status is distinct from old.current_status then
    if old.current_status in ('SOLD', 'DECEASED', 'OTHER')
      and current_setting('app.allow_terminal_buffalo_status_change', true) is distinct from 'true' then
      raise exception using errcode = '23514', message = 'A terminal buffalo status cannot be changed.';
    end if;
    if new.current_status in ('SOLD', 'DECEASED', 'OTHER')
      and current_setting('app.allow_terminal_buffalo_status_change', true) is distinct from 'true' then
      raise exception using errcode = '23514', message = 'Use the sale or disposal workflow to record a terminal status.';
    end if;
  end if;
  return new;
end;
$guard$;

create trigger buffaloes_guard_terminal_status
before update of current_status on public.buffaloes
for each row execute function public.guard_terminal_buffalo_status();

create or replace function public.create_buffalo_sale(
  p_buffalo_id uuid,
  p_sale_date date,
  p_buyer_name text,
  p_buyer_mobile text,
  p_buyer_location text,
  p_sale_price numeric,
  p_initial_payment numeric,
  p_payment_method public.payment_method,
  p_payment_date date,
  p_payment_due_date date,
  p_payment_terms text,
  p_transaction_reference text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $sale_fn$
declare
  owner_id uuid := auth.uid();
  buffalo_row public.buffaloes%rowtype;
  sale_id uuid;
  initial_paid numeric(14,2);
  next_status public.payment_status;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_sale_date is null then
    raise exception using errcode = '23514', message = 'Sale date is required.';
  end if;
  if nullif(btrim(p_buyer_name), '') is null then
    raise exception using errcode = '23514', message = 'Buyer name is required.';
  end if;
  if p_sale_price is null or p_sale_price <= 0 then
    raise exception using errcode = '23514', message = 'Sale price must be greater than ₹0.';
  end if;
  initial_paid := coalesce(p_initial_payment, 0);
  if initial_paid < 0 or initial_paid > p_sale_price then
    raise exception using errcode = '23514', message = 'Initial payment must be between ₹0 and the sale price.';
  end if;
  if initial_paid > 0 and (p_payment_method is null or p_payment_date is null) then
    raise exception using errcode = '23514', message = 'Payment date and method are required when money is received.';
  end if;
  if initial_paid < p_sale_price and p_payment_due_date is null then
    raise exception using errcode = '23514', message = 'Due date is required while sale proceeds are outstanding.';
  end if;

  select * into buffalo_row
  from public.buffaloes
  where id = p_buffalo_id and user_id = owner_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Buffalo was not found.';
  end if;
  if buffalo_row.current_status not in ('ACTIVE', 'DRY') then
    raise exception using errcode = '23514', message = 'Only an active or dry buffalo can be sold.';
  end if;
  if exists (select 1 from public.buffalo_sales s where s.user_id = owner_id and s.buffalo_id = p_buffalo_id)
    or exists (select 1 from public.buffalo_disposals d where d.user_id = owner_id and d.buffalo_id = p_buffalo_id) then
    raise exception using errcode = '23514', message = 'This buffalo already has a sale or disposal record.';
  end if;

  next_status := case when initial_paid = p_sale_price then 'PAID'::public.payment_status
    when initial_paid > 0 then 'PARTIAL'::public.payment_status
    else 'CREDIT'::public.payment_status end;

  insert into public.buffalo_sales(
    user_id, buffalo_id, sale_date, buyer_name, buyer_mobile, buyer_location,
    sale_price, amount_received, payment_status, payment_due_date, payment_terms,
    payment_method, transaction_reference, notes
  ) values (
    owner_id, p_buffalo_id, p_sale_date, btrim(p_buyer_name),
    nullif(btrim(p_buyer_mobile), ''), nullif(btrim(p_buyer_location), ''),
    p_sale_price, initial_paid, next_status,
    case when initial_paid = p_sale_price then null else p_payment_due_date end,
    case when initial_paid = p_sale_price then null else nullif(btrim(p_payment_terms), '') end,
    case when initial_paid > 0 then p_payment_method else null end,
    nullif(btrim(p_transaction_reference), ''), nullif(btrim(p_notes), '')
  ) returning id into sale_id;

  if initial_paid > 0 then
    insert into public.buffalo_sale_payments(
      user_id, buffalo_sale_id, buffalo_id, payment_date, amount,
      payment_method, transaction_reference, notes
    ) values (
      owner_id, sale_id, p_buffalo_id, p_payment_date, initial_paid,
      p_payment_method, nullif(btrim(p_transaction_reference), ''),
      'Initial payment received at sale.'
    );
  end if;

  perform set_config('app.allow_terminal_buffalo_status_change', 'true', true);
  update public.buffaloes set current_status = 'SOLD'
  where id = p_buffalo_id and user_id = owner_id;
  insert into public.buffalo_status_history(user_id, buffalo_id, status, effective_date, notes)
  values (owner_id, p_buffalo_id, 'SOLD', p_sale_date,
    'Sale recorded to ' || btrim(p_buyer_name) || '.');

  return sale_id;
end;
$sale_fn$;

revoke all on function public.create_buffalo_sale(
  uuid,date,text,text,text,numeric,numeric,public.payment_method,date,date,text,text,text
) from public, anon;
grant execute on function public.create_buffalo_sale(
  uuid,date,text,text,text,numeric,numeric,public.payment_method,date,date,text,text,text
) to authenticated;

create or replace function public.record_buffalo_sale_payment(
  p_buffalo_sale_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_method public.payment_method,
  p_transaction_reference text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $payment_fn$
declare
  owner_id uuid := auth.uid();
  sale_row public.buffalo_sales%rowtype;
  payment_id uuid;
  new_received numeric(14,2);
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_payment_date is null or p_payment_method is null then
    raise exception using errcode = '23514', message = 'Payment date and method are required.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception using errcode = '23514', message = 'Payment amount must be greater than ₹0.';
  end if;

  select * into sale_row
  from public.buffalo_sales
  where id = p_buffalo_sale_id and user_id = owner_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Buffalo sale was not found.';
  end if;
  if p_amount > sale_row.amount_pending then
    raise exception using errcode = '23514', message = 'Payment cannot exceed the outstanding sale balance.';
  end if;

  insert into public.buffalo_sale_payments(
    user_id, buffalo_sale_id, buffalo_id, payment_date, amount,
    payment_method, transaction_reference, notes
  ) values (
    owner_id, sale_row.id, sale_row.buffalo_id, p_payment_date, p_amount,
    p_payment_method, nullif(btrim(p_transaction_reference), ''), nullif(btrim(p_notes), '')
  ) returning id into payment_id;

  new_received := sale_row.amount_received + p_amount;
  update public.buffalo_sales
  set amount_received = new_received,
      payment_status = case when new_received = sale_price then 'PAID'::public.payment_status
        else 'PARTIAL'::public.payment_status end,
      payment_due_date = case when new_received = sale_price then null else payment_due_date end,
      payment_terms = case when new_received = sale_price then null else payment_terms end,
      payment_method = case when new_received = sale_price then p_payment_method else payment_method end,
      transaction_reference = case when new_received = sale_price then nullif(btrim(p_transaction_reference), '') else transaction_reference end
  where id = sale_row.id and user_id = owner_id;

  return payment_id;
end;
$payment_fn$;

revoke all on function public.record_buffalo_sale_payment(uuid,date,numeric,public.payment_method,text,text)
  from public, anon;
grant execute on function public.record_buffalo_sale_payment(uuid,date,numeric,public.payment_method,text,text)
  to authenticated;

create or replace function public.record_buffalo_disposal(
  p_buffalo_id uuid,
  p_disposal_type text,
  p_effective_date date,
  p_reason text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $disposal_fn$
declare
  owner_id uuid := auth.uid();
  buffalo_row public.buffaloes%rowtype;
  disposal_id uuid;
  next_status public.buffalo_status;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_effective_date is null then
    raise exception using errcode = '23514', message = 'Disposal date is required.';
  end if;
  if p_disposal_type not in ('DEATH', 'TRANSFER_OUT', 'OTHER') then
    raise exception using errcode = '23514', message = 'Choose a valid disposal type.';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '23514', message = 'A reason is required.';
  end if;

  select * into buffalo_row
  from public.buffaloes
  where id = p_buffalo_id and user_id = owner_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Buffalo was not found.';
  end if;
  if buffalo_row.current_status not in ('ACTIVE', 'DRY') then
    raise exception using errcode = '23514', message = 'Only an active or dry buffalo can be disposed.';
  end if;
  if exists (select 1 from public.buffalo_sales s where s.user_id = owner_id and s.buffalo_id = p_buffalo_id)
    or exists (select 1 from public.buffalo_disposals d where d.user_id = owner_id and d.buffalo_id = p_buffalo_id) then
    raise exception using errcode = '23514', message = 'This buffalo already has a sale or disposal record.';
  end if;

  next_status := case when p_disposal_type = 'DEATH' then 'DECEASED'::public.buffalo_status
    else 'OTHER'::public.buffalo_status end;

  insert into public.buffalo_disposals(
    user_id, buffalo_id, disposal_type, effective_date, reason, notes
  ) values (
    owner_id, p_buffalo_id, p_disposal_type, p_effective_date, btrim(p_reason), nullif(btrim(p_notes), '')
  ) returning id into disposal_id;

  perform set_config('app.allow_terminal_buffalo_status_change', 'true', true);
  update public.buffaloes set current_status = next_status
  where id = p_buffalo_id and user_id = owner_id;
  insert into public.buffalo_status_history(user_id, buffalo_id, status, effective_date, notes)
  values (owner_id, p_buffalo_id, next_status, p_effective_date, btrim(p_reason));

  return disposal_id;
end;
$disposal_fn$;

revoke all on function public.record_buffalo_disposal(uuid,text,date,text,text) from public, anon;
grant execute on function public.record_buffalo_disposal(uuid,text,date,text,text) to authenticated;

-- Generic status changes remain available for non-terminal herd operations only.
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
as $status_fn$
declare
  owner_id uuid := auth.uid();
  buffalo_row public.buffaloes%rowtype;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if p_effective_date is null or p_status is null then
    raise exception using errcode = '23514', message = 'Status and effective date are required.';
  end if;
  if p_status in ('SOLD', 'DECEASED', 'OTHER') then
    raise exception using errcode = '23514', message = 'Use the sale or disposal workflow for terminal statuses.';
  end if;

  select * into buffalo_row
  from public.buffaloes
  where id = p_buffalo_id and user_id = owner_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Buffalo was not found.';
  end if;
  if buffalo_row.current_status in ('SOLD', 'DECEASED', 'OTHER') then
    raise exception using errcode = '23514', message = 'A terminal buffalo record cannot be reactivated through status editing.';
  end if;
  if buffalo_row.current_status = p_status then
    raise exception using errcode = '23514', message = 'Buffalo is already in this status.';
  end if;

  update public.buffaloes set current_status = p_status
  where id = p_buffalo_id and user_id = owner_id;
  insert into public.buffalo_status_history(user_id, buffalo_id, status, effective_date, notes)
  values (owner_id, p_buffalo_id, p_status, p_effective_date, nullif(btrim(p_notes), ''));
end;
$status_fn$;

revoke all on function public.change_buffalo_status(uuid,public.buffalo_status,date,text) from public, anon;
grant execute on function public.change_buffalo_status(uuid,public.buffalo_status,date,text) to authenticated;
