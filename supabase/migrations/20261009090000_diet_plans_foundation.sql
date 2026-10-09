-- Diet plan foundation.
-- Quantities are totals for the assigned buffalo group per feeding slot.
-- Automatic run creation/posting is introduced in a later phase.

create table public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  notes text,
  start_date date not null,
  end_date date,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'PAUSED', 'STOPPED')),
  timezone text not null default 'Asia/Kolkata'
    check (timezone = 'Asia/Kolkata'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  check (end_date is null or end_date >= start_date)
);

create index diet_plans_schedule_idx
  on public.diet_plans(user_id, status, start_date, end_date);

create trigger diet_plans_updated_at
before update on public.diet_plans
for each row execute function public.set_updated_at();

alter table public.diet_plans enable row level security;

create policy "diet_plans_select_own"
  on public.diet_plans for select to authenticated
  using (user_id = (select auth.uid()));

create policy "diet_plans_insert_own"
  on public.diet_plans for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "diet_plans_update_own"
  on public.diet_plans for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Plans are stopped/archived instead of deleted so run history remains auditable.
-- No DELETE policy is intentionally provided.

create table public.diet_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null,
  feed_item_id uuid not null,
  base_unit text not null check (length(trim(base_unit)) > 0),
  morning_quantity numeric(14,3) not null default 0 check (morning_quantity >= 0),
  evening_quantity numeric(14,3) not null default 0 check (evening_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, plan_id, feed_item_id),
  foreign key (user_id, plan_id)
    references public.diet_plans(user_id, id) on delete cascade,
  foreign key (user_id, feed_item_id)
    references public.feed_items(user_id, id) on delete restrict,
  check (morning_quantity > 0 or evening_quantity > 0)
);

create index diet_plan_items_plan_idx
  on public.diet_plan_items(user_id, plan_id);

create trigger diet_plan_items_updated_at
before update on public.diet_plan_items
for each row execute function public.set_updated_at();

alter table public.diet_plan_items enable row level security;

create policy "diet_plan_items_select_own"
  on public.diet_plan_items for select to authenticated
  using (user_id = (select auth.uid()));

create policy "diet_plan_items_insert_own"
  on public.diet_plan_items for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.diet_plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.feed_items f
      where f.id = feed_item_id
        and f.user_id = (select auth.uid())
        and f.is_active
        and f.base_unit = diet_plan_items.base_unit
    )
  );

create policy "diet_plan_items_update_own"
  on public.diet_plan_items for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.diet_plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.feed_items f
      where f.id = feed_item_id
        and f.user_id = (select auth.uid())
        and f.is_active
        and f.base_unit = diet_plan_items.base_unit
    )
  );

create table public.diet_plan_buffaloes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null,
  buffalo_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, plan_id, buffalo_id),
  foreign key (user_id, plan_id)
    references public.diet_plans(user_id, id) on delete cascade,
  foreign key (buffalo_id) references public.buffaloes(id) on delete restrict
);

create index diet_plan_buffaloes_plan_idx
  on public.diet_plan_buffaloes(user_id, plan_id);

create index diet_plan_buffaloes_buffalo_idx
  on public.diet_plan_buffaloes(user_id, buffalo_id);

alter table public.diet_plan_buffaloes enable row level security;

create policy "diet_plan_buffaloes_select_own"
  on public.diet_plan_buffaloes for select to authenticated
  using (user_id = (select auth.uid()));

create policy "diet_plan_buffaloes_insert_own"
  on public.diet_plan_buffaloes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.diet_plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.buffaloes b
      where b.id = buffalo_id and b.user_id = (select auth.uid())
    )
  );

create policy "diet_plan_buffaloes_delete_own"
  on public.diet_plan_buffaloes for delete to authenticated
  using (user_id = (select auth.uid()));

create table public.diet_feeding_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null,
  feeding_date date not null,
  shift text not null check (shift in ('MORNING', 'EVENING')),
  scheduled_for timestamptz not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSING', 'POSTED', 'FAILED', 'SKIPPED')),
  failure_reason text,
  retry_count integer not null default 0 check (retry_count >= 0),
  started_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_id, feeding_date, shift),
  unique (user_id, id),
  foreign key (user_id, plan_id)
    references public.diet_plans(user_id, id) on delete restrict,
  check (
    (status = 'FAILED' and failure_reason is not null)
    or status <> 'FAILED'
  ),
  check ((status = 'POSTED') = (posted_at is not null))
);

create index diet_feeding_runs_schedule_idx
  on public.diet_feeding_runs(status, scheduled_for);

create index diet_feeding_runs_plan_history_idx
  on public.diet_feeding_runs(user_id, plan_id, feeding_date desc, shift);

create trigger diet_feeding_runs_updated_at
before update on public.diet_feeding_runs
for each row execute function public.set_updated_at();

alter table public.diet_feeding_runs enable row level security;

create policy "diet_feeding_runs_select_own"
  on public.diet_feeding_runs for select to authenticated
  using (user_id = (select auth.uid()));

-- Run creation and state transitions are reserved for trusted database functions
-- used by the scheduler and explicit retry workflow.

create table public.diet_feeding_run_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null,
  feed_item_id uuid not null,
  feed_item_name text not null,
  base_unit text not null,
  planned_quantity numeric(14,3) not null check (planned_quantity > 0),
  posted_movement_id uuid references public.feed_inventory_movements(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (user_id, run_id, feed_item_id),
  foreign key (user_id, run_id)
    references public.diet_feeding_runs(user_id, id) on delete restrict,
  foreign key (user_id, feed_item_id)
    references public.feed_items(user_id, id) on delete restrict
);

create index diet_feeding_run_items_run_idx
  on public.diet_feeding_run_items(user_id, run_id);

alter table public.diet_feeding_run_items enable row level security;

create policy "diet_feeding_run_items_select_own"
  on public.diet_feeding_run_items for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.diet_feeding_runs r
      where r.id = run_id and r.user_id = (select auth.uid())
    )
  );

-- One inventory deduction per feed item for each scheduled feeding run.
create unique index feed_inventory_movements_diet_run_item_uq
  on public.feed_inventory_movements(user_id, source_type, source_id, feed_item_id)
  where source_type = 'DIET_PLAN' and source_id is not null;
