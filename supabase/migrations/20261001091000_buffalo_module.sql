-- Buffalo master, vendor purchase details, and per-date production records.
create type public.buffalo_status as enum ('ACTIVE', 'SOLD', 'DECEASED', 'DRY', 'OTHER');
create type public.payment_method as enum ('CASH', 'UPI', 'BANK_TRANSFER', 'OTHER');
create type public.payment_status as enum ('PAID', 'PARTIAL', 'CREDIT');

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  mobile text,
  address text,
  village_city text,
  state text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);
create trigger vendors_updated_at before update on public.vendors
for each row execute function public.set_updated_at();

create table public.buffaloes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  buffalo_code text not null check (length(trim(buffalo_code)) > 0),
  name text,
  purchase_date date,
  age_at_purchase_months integer check (age_at_purchase_months is null or age_at_purchase_months >= 0),
  breed text,
  color text,
  identification_mark text,
  current_status public.buffalo_status not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, buffalo_code),
  unique (user_id, id)
);
create trigger buffaloes_updated_at before update on public.buffaloes
for each row execute function public.set_updated_at();

create table public.buffalo_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  buffalo_id uuid not null unique,
  vendor_id uuid,
  purchase_date date not null,
  purchase_price numeric(14,2) not null check (purchase_price >= 0),
  payment_status public.payment_status not null,
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  amount_pending numeric(14,2) generated always as (purchase_price - amount_paid) stored,
  payment_terms text,
  payment_due_date date,
  payment_method public.payment_method,
  transaction_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, buffalo_id) references public.buffaloes(user_id, id) on delete cascade,
  foreign key (user_id, vendor_id) references public.vendors(user_id, id) on delete set null (vendor_id),
  check (amount_paid <= purchase_price)
);
create trigger buffalo_purchases_updated_at before update on public.buffalo_purchases
for each row execute function public.set_updated_at();

create table public.buffalo_daily_performance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  buffalo_id uuid not null,
  business_date date not null,
  morning_milk_quantity numeric(10,3) not null default 0 check (morning_milk_quantity >= 0),
  morning_fat numeric(5,2) check (morning_fat is null or (morning_fat >= 0 and morning_fat <= 20)),
  evening_milk_quantity numeric(10,3) not null default 0 check (evening_milk_quantity >= 0),
  evening_fat numeric(5,2) check (evening_fat is null or (evening_fat >= 0 and evening_fat <= 20)),
  feed_notes text,
  health_notes text,
  behavior_notes text,
  medicine_notes text,
  general_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, buffalo_id) references public.buffaloes(user_id, id) on delete cascade,
  unique (buffalo_id, business_date)
);
create index buffalo_perf_date_idx on public.buffalo_daily_performance(user_id, business_date desc);
create index buffalo_perf_buffalo_idx on public.buffalo_daily_performance(user_id, buffalo_id, business_date desc);
create trigger buffalo_daily_performance_updated_at before update on public.buffalo_daily_performance
for each row execute function public.set_updated_at();

alter table public.vendors enable row level security;
alter table public.buffaloes enable row level security;
alter table public.buffalo_purchases enable row level security;
alter table public.buffalo_daily_performance enable row level security;
create policy "vendors_select_own" on public.vendors for select to authenticated using (user_id = (select auth.uid()));
create policy "vendors_insert_own" on public.vendors for insert to authenticated with check (user_id = (select auth.uid()));
create policy "vendors_update_own" on public.vendors for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "vendors_delete_own" on public.vendors for delete to authenticated using (user_id = (select auth.uid()));
create policy "buffaloes_select_own" on public.buffaloes for select to authenticated using (user_id = (select auth.uid()));
create policy "buffaloes_insert_own" on public.buffaloes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "buffaloes_update_own" on public.buffaloes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "buffaloes_delete_own" on public.buffaloes for delete to authenticated using (user_id = (select auth.uid()));
create policy "buffalo_purchases_select_own" on public.buffalo_purchases for select to authenticated using (user_id = (select auth.uid()));
create policy "buffalo_purchases_insert_own" on public.buffalo_purchases for insert to authenticated with check (user_id = (select auth.uid()));
create policy "buffalo_purchases_update_own" on public.buffalo_purchases for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "buffalo_purchases_delete_own" on public.buffalo_purchases for delete to authenticated using (user_id = (select auth.uid()));
create policy "buffalo_performance_select_own" on public.buffalo_daily_performance for select to authenticated using (user_id = (select auth.uid()));
create policy "buffalo_performance_insert_own" on public.buffalo_daily_performance for insert to authenticated with check (user_id = (select auth.uid()));
create policy "buffalo_performance_update_own" on public.buffalo_daily_performance for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "buffalo_performance_delete_own" on public.buffalo_daily_performance for delete to authenticated using (user_id = (select auth.uid()));
