-- Protect feed-purchase-generated expenses and make purchase creation retry-safe.
-- Existing purchase edit/delete RPCs mark the purchase DELETED before soft-deleting
-- its expense; the guards below intentionally allow that ordered workflow.
-- Paid purchases are locked from correction/deletion until payment reversal support exists.

begin;

do $$
begin
  if exists (
    select 1 from public.feed_purchases
    where expense_id is not null
    group by expense_id having count(*) > 1
  ) then
    raise exception 'Cannot add feed purchase expense uniqueness: duplicate expense_id values exist. Run the reconciliation diagnostics first.';
  end if;

  if exists (
    select 1 from public.feed_inventory_movements
    where source_type = 'FEED_PURCHASE'
      and movement_type = 'PURCHASE'
      and source_id is not null
    group by user_id, source_id having count(*) > 1
  ) then
    raise exception 'Cannot add original stock-in uniqueness: duplicate FEED_PURCHASE movements exist. Run the reconciliation diagnostics first.';
  end if;
end;
$$;

create unique index if not exists feed_purchases_expense_id_unique
  on public.feed_purchases(expense_id)
  where expense_id is not null;

create unique index if not exists feed_purchase_original_stock_in_unique
  on public.feed_inventory_movements(user_id, source_id)
  where source_type = 'FEED_PURCHASE'
    and movement_type = 'PURCHASE'
    and source_id is not null;

-- Stable request keys make retries and concurrent duplicate submissions return
-- the first result. Keys are scoped to the authenticated farm owner.
create table if not exists public.feed_purchase_idempotency (
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  purchase_id uuid not null references public.feed_purchases(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

alter table public.feed_purchase_idempotency enable row level security;
revoke all on public.feed_purchase_idempotency from public, anon, authenticated;

create or replace function public.create_feed_purchase_idempotent(
  p_idempotency_key uuid,
  p_feed_item_id uuid,
  p_vendor_id uuid,
  p_business_date date,
  p_purchase_quantity numeric,
  p_rate_per_purchase_unit numeric,
  p_payment_status text,
  p_paid_amount numeric,
  p_payment_method text,
  p_due_date date,
  p_notes text
)
returns public.feed_purchases
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_purchase_id uuid;
  v_purchase public.feed_purchases;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Purchase request key is required.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_idempotency_key::text, 0)
  );

  select purchase_id into v_purchase_id
  from public.feed_purchase_idempotency
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  if v_purchase_id is not null then
    select * into v_purchase
    from public.feed_purchases
    where id = v_purchase_id and user_id = v_user_id;
    if not found then
      raise exception 'Idempotency record points to a missing purchase; reconcile before retrying.';
    end if;
    return v_purchase;
  end if;

  select * into v_purchase
  from public.create_feed_purchase(
    p_feed_item_id, p_vendor_id, p_business_date,
    p_purchase_quantity, p_rate_per_purchase_unit,
    p_payment_status, p_paid_amount, p_payment_method, p_due_date, p_notes
  );

  insert into public.feed_purchase_idempotency(user_id, idempotency_key, purchase_id)
  values (v_user_id, p_idempotency_key, v_purchase.id);

  return v_purchase;
end;
$$;

-- Force clients through the idempotent wrapper; the wrapper invokes this RPC as its definer.
revoke all on function public.create_feed_purchase(
  uuid,uuid,date,numeric,numeric,text,numeric,text,date,text
) from public, anon, authenticated;

revoke all on function public.create_feed_purchase_idempotent(
  uuid,uuid,uuid,date,numeric,numeric,text,numeric,text,date,text
) from public, anon;
grant execute on function public.create_feed_purchase_idempotent(
  uuid,uuid,uuid,date,numeric,numeric,text,numeric,text,date,text
) to authenticated;

-- The independent Expense UI cannot change or soft-delete an active linked expense.
-- The purchase correction RPC first marks its purchase DELETED in the same transaction.
create or replace function public.guard_feed_purchase_linked_expense()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.feed_purchases fp
    where fp.user_id = old.user_id
      and fp.expense_id = old.id
      and fp.status = 'ACTIVE'
  ) then
    raise exception using
      errcode = '23514',
      message = 'This expense is managed by Feed Purchases. Edit or delete it from the Feed Purchases module.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists expenses_guard_feed_purchase_link on public.expenses;
create trigger expenses_guard_feed_purchase_link
before update or delete on public.expenses
for each row execute function public.guard_feed_purchase_linked_expense();

-- A purchase with any paid amount or dated payment history cannot be replaced
-- by the legacy correction workflow, which would detach that history.
create or replace function public.guard_feed_purchase_paid_correction()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_paid numeric(14,2);
  v_has_ledger boolean;
begin
  if old.status = 'ACTIVE' and new.status = 'DELETED' then
    select coalesce(e.paid_amount, 0)
      into v_paid
    from public.expenses e
    where e.user_id = old.user_id and e.id = old.expense_id;

    select exists (
      select 1 from public.expense_payments ep
      where ep.user_id = old.user_id and ep.expense_id = old.expense_id
    ) into v_has_ledger;

    if coalesce(v_paid, 0) > 0 or v_has_ledger then
      raise exception using
        errcode = '23514',
        message = 'This purchase has recorded payments. Editing/deleting is locked to preserve payment history and liability reconciliation.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists feed_purchases_guard_paid_correction on public.feed_purchases;
create trigger feed_purchases_guard_paid_correction
before update of status on public.feed_purchases
for each row execute function public.guard_feed_purchase_paid_correction();

commit;
