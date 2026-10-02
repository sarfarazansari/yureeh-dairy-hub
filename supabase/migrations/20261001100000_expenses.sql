-- Expense categories, suppliers and expense records. System categories are shared;
-- farm-created categories, vendors and expenses are scoped to their owner.
create type public.expense_category_group as enum (
  'FEED', 'ANIMAL', 'FARM_OPERATIONS', 'TRANSPORT', 'UTILITIES',
  'LABOUR', 'EQUIPMENT', 'ADMIN', 'OTHER'
);
create type public.expense_payment_method as enum (
  'CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER', 'CREDIT'
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category_group public.expense_category_group not null,
  default_unit text,
  is_quantity_based boolean not null default false,
  is_active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name),
  unique (id, owner_id)
);
create index expense_categories_owner_idx on public.expense_categories(owner_id, is_active, name);
create trigger expense_categories_updated_at before update on public.expense_categories
for each row execute function public.set_updated_at();

insert into public.expense_categories(name,category_group,default_unit,is_quantity_based) values
 ('Khal','FEED','KG',true),('Chana Churi','FEED','KG',true),('Chapad','FEED','KG',true),
 ('Gehu Ke Faade','FEED','KG',true),('Poha Churi','FEED','KG',true),('Tiwan Khal','FEED','KG',true),
 ('Green Fodder','FEED','KG',true),('Dry Fodder','FEED','KG',true),('Mineral Mixture','FEED','KG',true),
 ('Salt','FEED','KG',true),('Other Feed','FEED','KG',true),
 ('Buffalo Purchase Related','ANIMAL',null,false),('Veterinary','ANIMAL',null,false),('Medicine','ANIMAL',null,false),
 ('Vaccination','ANIMAL',null,false),('Supplements','ANIMAL','PIECE',false),('Breeding / AI','ANIMAL',null,false),
 ('Freight','TRANSPORT','TRIP',true),('Loading / Unloading','TRANSPORT','TRIP',true),
 ('Local Transportation','TRANSPORT','TRIP',true),('Fuel','TRANSPORT','LITRE',true),
 ('Farm Cleaning','FARM_OPERATIONS',null,false),('Maintenance','FARM_OPERATIONS',null,false),
 ('Repairs','FARM_OPERATIONS',null,false),('Water','FARM_OPERATIONS',null,false),('Electricity','UTILITIES',null,false),
 ('Farm Labour','LABOUR','DAY',true),('Temporary Labour','LABOUR','DAY',true),('Other Labour','LABOUR',null,false),
 ('Equipment Purchase','EQUIPMENT',null,false),('Equipment Repair','EQUIPMENT',null,false),('Tools','EQUIPMENT','PIECE',true),
 ('Phone / Internet','ADMIN','MONTH',false),('Bank Charges','ADMIN',null,false),('UPI Charges','ADMIN',null,false),
 ('Office / Stationery','ADMIN',null,false),('Miscellaneous','OTHER',null,false);

create table public.expense_vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  mobile text,
  address text,
  city text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);
create index expense_vendors_name_idx on public.expense_vendors(user_id, name);
create trigger expense_vendors_updated_at before update on public.expense_vendors
for each row execute function public.set_updated_at();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_date date not null,
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  category_name_snapshot text not null,
  category_group_snapshot public.expense_category_group not null,
  vendor_id uuid,
  vendor_name_snapshot text,
  description text,
  quantity numeric(14,3) check (quantity is null or quantity >= 0),
  unit text,
  rate numeric(14,4) check (rate is null or rate >= 0),
  total_amount numeric(14,2) not null check (total_amount > 0),
  payment_status public.payment_status not null,
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  pending_amount numeric(14,2) generated always as (total_amount - paid_amount) stored,
  payment_method public.expense_payment_method,
  due_date date,
  buffalo_id uuid,
  buffalo_code_snapshot text,
  notes text,
  receipt_reference text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, vendor_id) references public.expense_vendors(user_id, id) on delete restrict,
  foreign key (user_id, buffalo_id) references public.buffaloes(user_id, id) on delete restrict,
  check (paid_amount <= total_amount),
  check (pending_amount >= 0),
  check (quantity is null or rate is null or total_amount = round(quantity * rate, 2)),
  check (payment_status <> 'PAID' or pending_amount = 0),
  check (payment_status <> 'PARTIAL' or (paid_amount > 0 and pending_amount > 0)),
  check (payment_status <> 'CREDIT' or paid_amount = 0)
);
create index expenses_date_idx on public.expenses(user_id, business_date desc) where deleted_at is null;
create index expenses_category_idx on public.expenses(user_id, category_id) where deleted_at is null;
create index expenses_group_idx on public.expenses(user_id, category_group_snapshot) where deleted_at is null;
create index expenses_vendor_idx on public.expenses(user_id, vendor_id) where deleted_at is null;
create index expenses_buffalo_idx on public.expenses(user_id, buffalo_id) where deleted_at is null;
create index expenses_status_idx on public.expenses(user_id, payment_status) where deleted_at is null;
create index expenses_due_idx on public.expenses(user_id, due_date) where deleted_at is null and pending_amount > 0;

create or replace function public.snapshot_expense_references()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  cat public.expense_categories%rowtype;
  vendor public.expense_vendors%rowtype;
  buffalo public.buffaloes%rowtype;
begin
  select * into cat from public.expense_categories where id = new.category_id;
  if not found or (cat.owner_id is not null and cat.owner_id <> new.user_id) then
    raise exception 'Expense category is unavailable to this farm';
  end if;
  new.category_name_snapshot := cat.name;
  new.category_group_snapshot := cat.category_group;
  if new.vendor_id is not null then
    select * into vendor from public.expense_vendors where id = new.vendor_id and user_id = new.user_id;
    if not found then raise exception 'Expense vendor is unavailable to this farm'; end if;
    new.vendor_name_snapshot := vendor.name;
  else
    new.vendor_name_snapshot := null;
  end if;
  if new.buffalo_id is not null then
    select * into buffalo from public.buffaloes where id = new.buffalo_id and user_id = new.user_id;
    if not found then raise exception 'Buffalo is unavailable to this farm'; end if;
    new.buffalo_code_snapshot := buffalo.buffalo_code;
  else
    new.buffalo_code_snapshot := null;
  end if;
  return new;
end;
$$;
create trigger expenses_snapshot_refs before insert or update of category_id, vendor_id, buffalo_id
on public.expenses for each row execute function public.snapshot_expense_references();
create trigger expenses_updated_at before update on public.expenses
for each row execute function public.set_updated_at();

alter table public.expense_categories enable row level security;
alter table public.expense_vendors enable row level security;
alter table public.expenses enable row level security;
create policy "expense_categories_read_available" on public.expense_categories for select to authenticated
using (owner_id is null or owner_id = (select auth.uid()));
create policy "expense_categories_create_own" on public.expense_categories for insert to authenticated
with check (owner_id = (select auth.uid()));
create policy "expense_categories_update_own" on public.expense_categories for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "expense_categories_delete_own" on public.expense_categories for delete to authenticated
using (owner_id = (select auth.uid()));
create policy "expense_vendors_select_own" on public.expense_vendors for select to authenticated
using (user_id = (select auth.uid()));
create policy "expense_vendors_insert_own" on public.expense_vendors for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "expense_vendors_update_own" on public.expense_vendors for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "expense_vendors_delete_own" on public.expense_vendors for delete to authenticated
using (user_id = (select auth.uid()));
create policy "expenses_select_own" on public.expenses for select to authenticated
using (user_id = (select auth.uid()));
create policy "expenses_insert_own" on public.expenses for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "expenses_update_own" on public.expenses for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "expenses_delete_own" on public.expenses for delete to authenticated
using (user_id = (select auth.uid()));
