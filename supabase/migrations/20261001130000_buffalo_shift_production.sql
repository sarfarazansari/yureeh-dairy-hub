-- Normalize buffalo production to one row per buffalo, business date, and shift.
-- Keep buffalo_daily_performance unchanged as the legacy audit source.
create table public.buffalo_milk_production (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  buffalo_id uuid not null,
  business_date date not null,
  shift public.milk_shift not null,
  milk_quantity numeric not null check (milk_quantity >= 0 and scale(milk_quantity) <= 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, buffalo_id) references public.buffaloes(user_id, id) on delete cascade,
  unique (user_id, buffalo_id, business_date, shift)
);

create index buffalo_milk_production_date_idx
  on public.buffalo_milk_production(user_id, business_date desc, shift, buffalo_id);
create index buffalo_milk_production_buffalo_idx
  on public.buffalo_milk_production(user_id, buffalo_id, business_date desc, shift);
create trigger buffalo_milk_production_updated_at
  before update on public.buffalo_milk_production
  for each row execute function public.set_updated_at();

alter table public.buffalo_milk_production enable row level security;
grant select, insert, update, delete on public.buffalo_milk_production to authenticated;
create policy buffalo_milk_production_select_own on public.buffalo_milk_production
  for select to authenticated using (user_id = (select auth.uid()));
create policy buffalo_milk_production_insert_own on public.buffalo_milk_production
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy buffalo_milk_production_update_own on public.buffalo_milk_production
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy buffalo_milk_production_delete_own on public.buffalo_milk_production
  for delete to authenticated using (user_id = (select auth.uid()));

-- Legacy zeroes cannot be distinguished from blank inputs saved as zero by the
-- old form. Migrate only positive measured quantities; preserve every legacy
-- row (including fats and notes) in buffalo_daily_performance for audit.
insert into public.buffalo_milk_production(user_id, buffalo_id, business_date, shift, milk_quantity)
select user_id, buffalo_id, business_date, 'MORNING'::public.milk_shift, morning_milk_quantity
from public.buffalo_daily_performance
where morning_milk_quantity > 0;

insert into public.buffalo_milk_production(user_id, buffalo_id, business_date, shift, milk_quantity)
select user_id, buffalo_id, business_date, 'EVENING'::public.milk_shift, evening_milk_quantity
from public.buffalo_daily_performance
where evening_milk_quantity > 0;

-- One transactional save endpoint validates the entire shift sheet, updates
-- existing values, inserts new values, and removes rows intentionally cleared.
create or replace function public.save_buffalo_milk_production(
  p_business_date date,
  p_shift public.milk_shift,
  p_buffalo_ids uuid[],
  p_records jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry jsonb;
  v_buffalo_id uuid;
  v_milk_quantity numeric;
  v_record_ids uuid[] := array[]::uuid[];
  v_owned_count integer;
  v_id_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save buffalo production.' using errcode = '42501';
  end if;
  if p_business_date is null or p_shift is null then
    raise exception 'A production date and shift are required.' using errcode = '22023';
  end if;
  if p_buffalo_ids is null or p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception 'Invalid production sheet.' using errcode = '22023';
  end if;

  select count(distinct id)::integer into v_id_count
  from unnest(p_buffalo_ids) as buffalo_ids(id);
  if v_id_count <> cardinality(p_buffalo_ids) or array_position(p_buffalo_ids, null) is not null then
    raise exception 'The buffalo list contains duplicate or invalid IDs.' using errcode = '22023';
  end if;

  select count(*)::integer into v_owned_count
  from public.buffaloes
  where user_id = auth.uid()
    and current_status in ('ACTIVE', 'DRY')
    and id = any(p_buffalo_ids);
  if v_owned_count <> cardinality(p_buffalo_ids) then
    raise exception 'One or more buffaloes are not active or dry, or do not belong to this farm.' using errcode = '22023';
  end if;

  for v_entry in select value from jsonb_array_elements(p_records) as records(value) loop
    if jsonb_typeof(v_entry) <> 'object'
      or jsonb_typeof(v_entry->'buffalo_id') <> 'string'
      or jsonb_typeof(v_entry->'milk_quantity') <> 'number' then
      raise exception 'Each production value must include a buffalo and a numeric milk quantity.' using errcode = '22023';
    end if;
    v_buffalo_id := (v_entry->>'buffalo_id')::uuid;
    v_milk_quantity := (v_entry->>'milk_quantity')::numeric;
    if not (v_buffalo_id = any(p_buffalo_ids)) then
      raise exception 'A production value does not belong to this sheet.' using errcode = '22023';
    end if;
    if v_milk_quantity < 0 or scale(v_milk_quantity) > 3 then
      raise exception 'Milk quantity must be zero or greater with at most three decimal places.' using errcode = '22023';
    end if;
    if v_buffalo_id = any(v_record_ids) then
      raise exception 'A buffalo appears more than once in this production sheet.' using errcode = '22023';
    end if;
    v_record_ids := array_append(v_record_ids, v_buffalo_id);
  end loop;

  delete from public.buffalo_milk_production
  where user_id = auth.uid()
    and business_date = p_business_date
    and shift = p_shift
    and buffalo_id = any(p_buffalo_ids)
    and not (buffalo_id = any(v_record_ids));

  for v_entry in select value from jsonb_array_elements(p_records) as records(value) loop
    v_buffalo_id := (v_entry->>'buffalo_id')::uuid;
    v_milk_quantity := (v_entry->>'milk_quantity')::numeric;
    insert into public.buffalo_milk_production(user_id, buffalo_id, business_date, shift, milk_quantity)
    values (auth.uid(), v_buffalo_id, p_business_date, p_shift, v_milk_quantity)
    on conflict (user_id, buffalo_id, business_date, shift)
    do update set milk_quantity = excluded.milk_quantity;
  end loop;
end;
$$;

revoke all on function public.save_buffalo_milk_production(date, public.milk_shift, uuid[], jsonb) from public, anon;
grant execute on function public.save_buffalo_milk_production(date, public.milk_shift, uuid[], jsonb) to authenticated;
