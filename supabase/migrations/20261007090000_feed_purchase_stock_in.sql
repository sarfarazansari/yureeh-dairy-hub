-- Phase 3: feed purchase / stock-in.
create table public.feed_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feed_item_id uuid not null references public.feed_items(id) on delete restrict,
  vendor_id uuid references public.expense_vendors(id) on delete restrict,
  expense_id uuid not null references public.expenses(id) on delete restrict,
  business_date date not null,
  purchase_quantity numeric(14,3) not null check (purchase_quantity > 0),
  purchase_unit text not null check (length(trim(purchase_unit)) > 0),
  base_quantity numeric(14,3) not null check (base_quantity > 0),
  base_unit text not null check (length(trim(base_unit)) > 0),
  rate_per_purchase_unit numeric(14,4) not null check (rate_per_purchase_unit > 0),
  total_amount numeric(14,2) not null check (total_amount > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, expense_id)
);

create index feed_purchases_date_idx on public.feed_purchases(user_id, business_date desc);
create index feed_purchases_item_idx on public.feed_purchases(user_id, feed_item_id, business_date desc);
create index feed_purchases_vendor_idx on public.feed_purchases(user_id, vendor_id, business_date desc);

alter table public.feed_purchases enable row level security;

create policy "feed_purchases_select_own"
  on public.feed_purchases for select to authenticated
  using (user_id = (select auth.uid()));

create policy "feed_purchases_insert_own"
  on public.feed_purchases for insert to authenticated
  with check (user_id = (select auth.uid()));

create trigger feed_purchases_updated_at
before update on public.feed_purchases
for each row execute function public.set_updated_at();

create unique index feed_inventory_movements_feed_purchase_uq
  on public.feed_inventory_movements(user_id, source_type, source_id)
  where source_type = 'FEED_PURCHASE' and source_id is not null;

create or replace function public.create_feed_purchase(
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
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_feed public.feed_items;
  v_vendor_exists boolean;
  v_category_id uuid;
  v_total numeric(14,2);
  v_base_quantity numeric(14,3);
  v_unit_cost numeric(14,2);
  v_expense public.expenses;
  v_purchase public.feed_purchases;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  if p_business_date is null then raise exception 'Business date is required.'; end if;
  if p_purchase_quantity is null or p_purchase_quantity <= 0 then raise exception 'Purchase quantity must be greater than zero.'; end if;
  if p_rate_per_purchase_unit is null or p_rate_per_purchase_unit <= 0 then raise exception 'Purchase rate must be greater than zero.'; end if;
  if p_paid_amount is null or p_paid_amount < 0 then raise exception 'Paid amount cannot be negative.'; end if;
  if p_payment_status not in ('PAID','PARTIAL','CREDIT') then raise exception 'Invalid payment status.'; end if;

  select * into v_feed
  from public.feed_items
  where id = p_feed_item_id and user_id = v_user_id
  for update;

  if not found then raise exception 'Feed item not found.'; end if;
  if not v_feed.is_active then raise exception 'Inactive feed items cannot be purchased.'; end if;

  if p_vendor_id is not null then
    select exists(
      select 1 from public.expense_vendors
      where id = p_vendor_id and user_id = v_user_id and is_active
    ) into v_vendor_exists;
    if not v_vendor_exists then raise exception 'Selected vendor is not available.'; end if;
  end if;

  select id into v_category_id
  from public.expense_categories
  where owner_id = v_user_id
    and is_active
    and category_group = 'FEED'
    and lower(trim(name)) = lower(trim(v_feed.name))
  limit 1;

  if v_category_id is null then
    raise exception 'No active FEED expense category exists for "%".', v_feed.name;
  end if;

  v_total := round(p_purchase_quantity * p_rate_per_purchase_unit, 2);
  if v_total <= 0 then raise exception 'Total amount must be greater than zero.'; end if;
  if p_paid_amount > v_total then raise exception 'Paid amount cannot exceed total amount.'; end if;

  if p_payment_status = 'PAID' and p_paid_amount <> v_total then
    raise exception 'Paid amount must equal total for PAID status.';
  elsif p_payment_status = 'CREDIT' and p_paid_amount <> 0 then
    raise exception 'Paid amount must be zero for CREDIT status.';
  elsif p_payment_status = 'PARTIAL' and (p_paid_amount <= 0 or p_paid_amount >= v_total) then
    raise exception 'PARTIAL payment must be greater than zero and less than total.';
  end if;

  v_base_quantity := round(p_purchase_quantity * v_feed.purchase_unit_quantity, 3);
  if v_base_quantity <= 0 then raise exception 'Calculated inventory quantity must be greater than zero.'; end if;
  v_unit_cost := round(v_total / v_base_quantity, 2);

  insert into public.expenses (
    user_id, business_date, category_id, vendor_id, description,
    quantity, unit, rate, total_amount, payment_status, paid_amount,
    payment_method, due_date, notes
  ) values (
    v_user_id, p_business_date, v_category_id, p_vendor_id,
    v_feed.name || ' purchase',
    p_purchase_quantity, v_feed.purchase_unit, p_rate_per_purchase_unit,
    v_total, p_payment_status, p_paid_amount,
    case when p_payment_status = 'CREDIT' then 'CREDIT' else p_payment_method end,
    p_due_date, p_notes
  )
  returning * into v_expense;

  insert into public.feed_purchases (
    user_id, feed_item_id, vendor_id, expense_id, business_date,
    purchase_quantity, purchase_unit, base_quantity, base_unit,
    rate_per_purchase_unit, total_amount, notes
  ) values (
    v_user_id, v_feed.id, p_vendor_id, v_expense.id, p_business_date,
    p_purchase_quantity, v_feed.purchase_unit, v_base_quantity, v_feed.base_unit,
    p_rate_per_purchase_unit, v_total, p_notes
  )
  returning * into v_purchase;

  insert into public.feed_inventory_movements (
    user_id, feed_item_id, movement_type, quantity, unit_cost,
    source_type, source_id, occurred_at, notes
  ) values (
    v_user_id, v_feed.id, 'PURCHASE', v_base_quantity, v_unit_cost,
    'FEED_PURCHASE', v_purchase.id,
    p_business_date::timestamptz, p_notes
  );

  return v_purchase;
end;
$$;

grant execute on function public.create_feed_purchase(
  uuid,uuid,date,numeric,numeric,text,numeric,text,date,text
) to authenticated;
