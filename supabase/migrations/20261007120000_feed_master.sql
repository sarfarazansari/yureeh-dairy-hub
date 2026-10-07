-- Feed master: physical feed items are intentionally separate from expense categories.
create table public.feed_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text not null default 'OTHER' check (category in ('CONCENTRATE','FODDER','SUPPLEMENT','MINERAL','OTHER')),
  base_unit text not null check (length(trim(base_unit)) > 0),
  purchase_unit text not null check (length(trim(purchase_unit)) > 0),
  purchase_unit_quantity numeric(14,3) not null default 1 check (purchase_unit_quantity > 0),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  unique (user_id, id)
);
create index feed_items_active_name_idx on public.feed_items(user_id, is_active, name);
create trigger feed_items_updated_at before update on public.feed_items
for each row execute function public.set_updated_at();
alter table public.feed_items enable row level security;
create policy "feed_items_select_own" on public.feed_items for select to authenticated using (user_id = (select auth.uid()));
create policy "feed_items_insert_own" on public.feed_items for insert to authenticated with check (user_id = (select auth.uid()));
create policy "feed_items_update_own" on public.feed_items for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "feed_items_delete_own" on public.feed_items for delete to authenticated using (user_id = (select auth.uid()));
