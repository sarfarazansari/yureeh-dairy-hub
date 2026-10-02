-- Milk sales, customer defaults, immutable entry snapshots, and owner-scoped access.
create extension if not exists pgcrypto;

create type public.pricing_type as enum ('FIXED_PER_LITRE', 'FAT_BASED');
create type public.milk_shift as enum ('MORNING', 'EVENING');

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  phone text,
  address text,
  pricing_type public.pricing_type not null,
  default_rate numeric(12,2) not null check (default_rate > 0),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table public.customer_rate_history (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  pricing_type public.pricing_type not null,
  rate numeric(12,2) not null check (rate > 0),
  effective_from date not null,
  effective_to date check (effective_to is null or effective_to >= effective_from),
  created_at timestamptz not null default now()
);
create index customer_rate_history_customer_idx on public.customer_rate_history(customer_id, effective_from desc);

create or replace function public.record_customer_rate_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.customer_rate_history(customer_id, pricing_type, rate, effective_from)
    values (new.id, new.pricing_type, new.default_rate, current_date);
  elsif old.default_rate is distinct from new.default_rate or old.pricing_type is distinct from new.pricing_type then
    update public.customer_rate_history
      set effective_to = greatest(effective_from, current_date - 1)
      where customer_id = new.id and effective_to is null;
    insert into public.customer_rate_history(customer_id, pricing_type, rate, effective_from)
    values (new.id, new.pricing_type, new.default_rate, current_date);
  end if;
  return new;
end;
$$;
create trigger customers_rate_history after insert or update of default_rate, pricing_type
on public.customers for each row execute function public.record_customer_rate_change();
create trigger customers_updated_at before update on public.customers
for each row execute function public.set_updated_at();

create table public.milk_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_date date not null,
  shift public.milk_shift not null,
  customer_id uuid not null,
  milk_quantity numeric(12,3) not null check (milk_quantity >= 0),
  fat numeric(5,2) check (fat is null or (fat >= 0 and fat <= 20)),
  pricing_type public.pricing_type not null,
  applied_rate numeric(12,2) not null check (applied_rate > 0),
  calculated_amount numeric(14,2) not null check (calculated_amount >= 0),
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, customer_id) references public.customers(user_id, id) on delete restrict,
  check (pricing_type <> 'FAT_BASED' or fat is not null),
  check (calculated_amount = round(milk_quantity * applied_rate * case when pricing_type = 'FAT_BASED' then fat else 1 end, 2))
);
create index milk_entries_date_idx on public.milk_entries(user_id, business_date desc) where deleted_at is null;
create index milk_entries_customer_idx on public.milk_entries(user_id, customer_id);
create index milk_entries_shift_idx on public.milk_entries(user_id, shift);
create index milk_entries_pricing_idx on public.milk_entries(user_id, pricing_type);
create trigger milk_entries_updated_at before update on public.milk_entries
for each row execute function public.set_updated_at();

alter table public.customers enable row level security;
alter table public.customer_rate_history enable row level security;
alter table public.milk_entries enable row level security;
create policy "customers_select_own" on public.customers for select to authenticated using (user_id = (select auth.uid()));
create policy "customers_insert_own" on public.customers for insert to authenticated with check (user_id = (select auth.uid()));
create policy "customers_update_own" on public.customers for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "customers_delete_own" on public.customers for delete to authenticated using (user_id = (select auth.uid()));
create policy "customer_rates_select_own" on public.customer_rate_history for select to authenticated using (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = (select auth.uid())));
create policy "customer_rates_insert_own" on public.customer_rate_history for insert to authenticated with check (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = (select auth.uid())));
create policy "customer_rates_update_own" on public.customer_rate_history for update to authenticated using (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = (select auth.uid()))) with check (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = (select auth.uid())));
create policy "customer_rates_delete_own" on public.customer_rate_history for delete to authenticated using (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = (select auth.uid())));
create policy "milk_entries_select_own" on public.milk_entries for select to authenticated using (user_id = (select auth.uid()));
create policy "milk_entries_insert_own" on public.milk_entries for insert to authenticated with check (user_id = (select auth.uid()));
create policy "milk_entries_update_own" on public.milk_entries for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "milk_entries_delete_own" on public.milk_entries for delete to authenticated using (user_id = (select auth.uid()));
