-- Diet plan scheduler and atomic inventory posting.
-- Feeding times are per-farm settings and intentionally have no guessed defaults.

create table public.diet_plan_schedule_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  morning_time time,
  evening_time time,
  timezone text not null default 'Asia/Kolkata' check (timezone = 'Asia/Kolkata'),
  updated_at timestamptz not null default now(),
  check (morning_time is null or evening_time is null or morning_time <> evening_time)
);

alter table public.diet_plan_schedule_settings enable row level security;

create policy "diet_plan_schedule_settings_select_own"
  on public.diet_plan_schedule_settings for select to authenticated
  using (user_id = (select auth.uid()));

create policy "diet_plan_schedule_settings_insert_own"
  on public.diet_plan_schedule_settings for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "diet_plan_schedule_settings_update_own"
  on public.diet_plan_schedule_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table public.diet_feeding_run_buffaloes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null,
  buffalo_id uuid not null references public.buffaloes(id) on delete restrict,
  buffalo_name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, run_id, buffalo_id),
  foreign key (user_id, run_id)
    references public.diet_feeding_runs(user_id, id) on delete restrict
);

create index diet_feeding_run_buffaloes_run_idx
  on public.diet_feeding_run_buffaloes(user_id, run_id);

alter table public.diet_feeding_run_buffaloes enable row level security;

create policy "diet_feeding_run_buffaloes_select_own"
  on public.diet_feeding_run_buffaloes for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.save_diet_plan_schedule_settings(
  p_morning_time time,
  p_evening_time time
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_morning_time is null or p_evening_time is null then
    raise exception 'Set both morning and evening feeding times.';
  end if;
  if p_morning_time = p_evening_time then
    raise exception 'Morning and evening feeding times must be different.';
  end if;

  insert into public.diet_plan_schedule_settings(user_id, morning_time, evening_time, updated_at)
  values (v_user_id, p_morning_time, p_evening_time, now())
  on conflict (user_id) do update
    set morning_time = excluded.morning_time,
        evening_time = excluded.evening_time,
        updated_at = now();
end;
$$;

revoke all on function public.save_diet_plan_schedule_settings(time,time) from public, anon;
grant execute on function public.save_diet_plan_schedule_settings(time,time) to authenticated;

-- Cron runs every minute. It only creates a feeding occurrence at its configured
-- local minute; missed occurrences are recorded as failed rather than posted late.
create or replace function public.process_diet_plan_scheduler()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_local_now timestamp := v_now at time zone 'Asia/Kolkata';
  v_today date := (v_now at time zone 'Asia/Kolkata')::date;
  v_slot text;
  v_slot_time time;
  v_plan record;
  v_run record;
  v_item record;
  v_available numeric(14,3);
  v_movement_id uuid;
  v_error text;
begin
  -- Create unique run records for this exact configured minute.
  for v_plan in
    select p.user_id, p.id as plan_id, s.morning_time, s.evening_time
    from public.diet_plans p
    join public.diet_plan_schedule_settings s on s.user_id = p.user_id
    where p.status = 'ACTIVE'
      and p.start_date <= v_today
      and (p.end_date is null or p.end_date >= v_today)
      and (s.morning_time = v_local_now::time(0) or s.evening_time = v_local_now::time(0))
  loop
    v_slot := case when v_plan.morning_time = v_local_now::time(0) then 'MORNING' else 'EVENING' end;
    v_slot_time := case when v_slot = 'MORNING' then v_plan.morning_time else v_plan.evening_time end;

    insert into public.diet_feeding_runs(user_id, plan_id, feeding_date, shift, scheduled_for, status)
    values (
      v_plan.user_id, v_plan.plan_id, v_today, v_slot,
      (v_today + v_slot_time) at time zone 'Asia/Kolkata', 'PENDING'
    )
    on conflict (user_id, plan_id, feeding_date, shift) do nothing;
  end loop;

  -- Runs are processed serially; inventory movement triggers lock feed rows and
  -- enforce stock/costing rules. Each run's posting is a subtransaction.
  for v_run in
    select r.*
    from public.diet_feeding_runs r
    where r.status in ('PENDING', 'FAILED')
      and r.scheduled_for <= v_now
      and (
        r.status = 'PENDING'
        or (r.status = 'FAILED' and r.retry_count > 0)
      )
    order by r.scheduled_for, r.user_id, r.plan_id
    for update skip locked
  loop
    -- Do not automatically post a missed feeding after its scheduled minute.
    if v_now >= v_run.scheduled_for + interval '1 minute' then
      update public.diet_feeding_runs
      set status = 'FAILED',
          failure_reason = 'Scheduled time was missed. Use explicit retry after reviewing stock.',
          retry_count = retry_count + 1
      where id = v_run.id and user_id = v_run.user_id;
      continue;
    end if;

    update public.diet_feeding_runs
    set status = 'PROCESSING', started_at = v_now, failure_reason = null
    where id = v_run.id and user_id = v_run.user_id;

    begin
      -- A stopped/paused plan or a plan no longer valid for the date is skipped.
      if not exists (
        select 1 from public.diet_plans p
        where p.id = v_run.plan_id and p.user_id = v_run.user_id
          and p.status = 'ACTIVE'
          and p.start_date <= v_run.feeding_date
          and (p.end_date is null or p.end_date >= v_run.feeding_date)
      ) then
        update public.diet_feeding_runs
        set status = 'SKIPPED', failure_reason = null
        where id = v_run.id and user_id = v_run.user_id;
        continue;
      end if;

      -- Snapshot eligible assigned buffaloes at occurrence time. The quantity
      -- remains the plan's group total; it is never multiplied or auto-scaled.
      insert into public.diet_feeding_run_buffaloes(user_id, run_id, buffalo_id, buffalo_name)
      select v_run.user_id, v_run.id, b.id, b.name
      from public.diet_plan_buffaloes pb
      join public.buffaloes b on b.id = pb.buffalo_id and b.user_id = v_run.user_id
      where pb.user_id = v_run.user_id and pb.plan_id = v_run.plan_id
        and (b.purchase_date is null or b.purchase_date <= v_run.feeding_date)
        and coalesce((
          select h.status
          from public.buffalo_status_history h
          where h.user_id = v_run.user_id and h.buffalo_id = b.id
            and h.effective_date <= v_run.feeding_date
          order by h.effective_date desc, h.created_at desc
          limit 1
        ), 'OTHER'::public.buffalo_status) = 'ACTIVE'::public.buffalo_status
      on conflict (user_id, run_id, buffalo_id) do nothing;

      if not exists (
        select 1 from public.diet_feeding_run_buffaloes rb
        where rb.user_id = v_run.user_id and rb.run_id = v_run.id
      ) then
        update public.diet_feeding_runs
        set status = 'SKIPPED', failure_reason = null
        where id = v_run.id and user_id = v_run.user_id;
        continue;
      end if;

      insert into public.diet_feeding_run_items(
        user_id, run_id, feed_item_id, feed_item_name, base_unit, planned_quantity
      )
      select v_run.user_id, v_run.id, i.feed_item_id, f.name, i.base_unit,
        case when v_run.shift = 'MORNING' then i.morning_quantity else i.evening_quantity end
      from public.diet_plan_items i
      join public.feed_items f on f.id = i.feed_item_id and f.user_id = v_run.user_id
      where i.user_id = v_run.user_id and i.plan_id = v_run.plan_id
        and (case when v_run.shift = 'MORNING' then i.morning_quantity else i.evening_quantity end) > 0
      on conflict (user_id, run_id, feed_item_id) do nothing;

      if not exists (
        select 1 from public.diet_feeding_run_items ri
        where ri.user_id = v_run.user_id and ri.run_id = v_run.id
      ) then
        raise exception 'No feed quantities are configured for this feeding slot.';
      end if;

      -- Lock all feed rows in stable ID order before checking stock to avoid
      -- concurrent plan runs racing one another.
      perform 1
      from public.feed_items f
      join public.diet_feeding_run_items ri
        on ri.feed_item_id = f.id and ri.user_id = v_run.user_id
      where ri.run_id = v_run.id
      order by f.id
      for update of f;

      for v_item in
        select ri.*, coalesce((
          select sum(case when m.movement_type in ('PURCHASE','ADJUSTMENT_IN')
            then m.quantity else -m.quantity end)
          from public.feed_inventory_movements m
          where m.user_id = v_run.user_id and m.feed_item_id = ri.feed_item_id
        ), 0) as available_quantity
        from public.diet_feeding_run_items ri
        where ri.user_id = v_run.user_id and ri.run_id = v_run.id
        order by ri.feed_item_id
      loop
        if v_item.available_quantity < v_item.planned_quantity then
          raise exception 'Insufficient stock for %: available %, required % %.',
            v_item.feed_item_name, v_item.available_quantity, v_item.planned_quantity, v_item.base_unit;
        end if;
      end loop;

      -- The stock trigger derives the current weighted-average cost and checks
      -- again for negative stock. Any error rolls back all movements in this run.
      for v_item in
        select ri.*
        from public.diet_feeding_run_items ri
        where ri.user_id = v_run.user_id and ri.run_id = v_run.id
        order by ri.feed_item_id
      loop
        insert into public.feed_inventory_movements(
          user_id, feed_item_id, movement_type, quantity, unit_cost,
          source_type, source_id, occurred_at, notes
        )
        values (
          v_run.user_id, v_item.feed_item_id, 'CONSUMPTION', v_item.planned_quantity,
          null, 'DIET_PLAN', v_run.id, v_run.scheduled_for,
          format('Automatic diet plan feeding (%s) for %s.', v_run.shift, v_run.feeding_date)
        )
        returning id into v_movement_id;

        update public.diet_feeding_run_items
        set posted_movement_id = v_movement_id
        where id = v_item.id and user_id = v_run.user_id;
      end loop;

      update public.diet_feeding_runs
      set status = 'POSTED', posted_at = clock_timestamp(), failure_reason = null
      where id = v_run.id and user_id = v_run.user_id;
    exception when others then
      get stacked diagnostics v_error = message_text;
      -- The inner block rolls back snapshots/movements created during this try.
      update public.diet_feeding_runs
      set status = 'FAILED',
          failure_reason = left(coalesce(v_error, 'Automatic feeding failed.'), 1000),
          retry_count = retry_count + 1
      where id = v_run.id and user_id = v_run.user_id;
    end;
  end loop;
end;
$$;

revoke all on function public.process_diet_plan_scheduler() from public, anon, authenticated;
grant execute on function public.process_diet_plan_scheduler() to postgres, service_role;

-- The ledger trigger normally requires an authenticated farm owner. Trusted
-- scheduler execution is allowed only when running as a database owner/service role.
create or replace function public.prepare_feed_inventory_movement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_quantity numeric(14,3);
  current_value numeric(16,2);
  effective_unit_cost numeric(14,2);
  signed_quantity numeric(14,3);
begin
  if auth.uid() is not null then
    if new.user_id <> (select auth.uid()) then
      raise exception 'You can only create inventory movements for your own farm.';
    end if;
  elsif current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Trusted scheduler execution is required for unauthenticated inventory posting.';
  end if;

  perform 1 from public.feed_items
  where id = new.feed_item_id and user_id = new.user_id
  for update;
  if not found then
    raise exception 'Feed item not found or does not belong to the current user.';
  end if;

  select
    coalesce(sum(case when movement_type in ('PURCHASE', 'ADJUSTMENT_IN')
      then quantity else -quantity end), 0),
    coalesce(sum(case when movement_type in ('PURCHASE', 'ADJUSTMENT_IN')
      then quantity * coalesce(unit_cost, 0) else -(quantity * coalesce(unit_cost, 0)) end), 0)
  into current_quantity, current_value
  from public.feed_inventory_movements
  where user_id = new.user_id and feed_item_id = new.feed_item_id;

  if new.movement_type in ('PURCHASE', 'ADJUSTMENT_IN') then
    if new.unit_cost is null then
      raise exception 'Unit cost is required for purchase and stock-in movements.';
    end if;
    effective_unit_cost := new.unit_cost;
  else
    if new.unit_cost is null then
      if current_quantity <= 0 then
        raise exception 'Cannot remove stock because there is no available inventory.';
      end if;
      effective_unit_cost := round(current_value / current_quantity, 2);
    else
      effective_unit_cost := new.unit_cost;
    end if;
  end if;

  signed_quantity := case when new.movement_type in ('PURCHASE', 'ADJUSTMENT_IN')
    then new.quantity else -new.quantity end;
  if current_quantity + signed_quantity < 0 then
    raise exception 'Insufficient stock. Available: %, requested: %.', current_quantity, new.quantity;
  end if;
  new.unit_cost := effective_unit_cost;
  return new;
end;
$$;

-- pg_cron is available on Supabase hosted Postgres. Replace only this named job.
create extension if not exists pg_cron with schema pg_catalog;
do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'yureeh-diet-plan-scheduler';
exception when undefined_table or undefined_function then
  raise exception 'Supabase Cron (pg_cron) is not available; enable pg_cron before applying the diet scheduler migration.';
end;
$$;

select cron.schedule(
  'yureeh-diet-plan-scheduler',
  '* * * * *',
  'select public.process_diet_plan_scheduler();'
);
