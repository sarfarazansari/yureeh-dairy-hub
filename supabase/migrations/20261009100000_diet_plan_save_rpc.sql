-- Save a diet plan and its assignments atomically.
create or replace function public.save_diet_plan(
  p_plan_id uuid,
  p_name text,
  p_notes text,
  p_start_date date,
  p_end_date date,
  p_status text,
  p_feed_items jsonb,
  p_buffalo_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
  v_item jsonb;
  v_feed_id uuid;
  v_morning numeric;
  v_evening numeric;
  v_base_unit text;
  v_seen uuid[] := array[]::uuid[];
  v_owned_count integer;
  v_id_count integer;
begin
  if v_user_id is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'Plan name is required.'; end if;
  if p_start_date is null or (p_end_date is not null and p_end_date < p_start_date) then
    raise exception 'Plan end date cannot be earlier than its start date.';
  end if;
  if p_status not in ('ACTIVE','PAUSED','STOPPED') then raise exception 'Invalid plan status.'; end if;
  if jsonb_typeof(p_feed_items) <> 'array' or jsonb_array_length(p_feed_items) = 0 then
    raise exception 'Add at least one feed item.';
  end if;
  if p_buffalo_ids is null or cardinality(p_buffalo_ids) = 0 then raise exception 'Select at least one buffalo.'; end if;

  select count(distinct x)::integer into v_id_count from unnest(p_buffalo_ids) x;
  if v_id_count <> cardinality(p_buffalo_ids) or array_position(p_buffalo_ids, null) is not null then
    raise exception 'Buffalo selection contains duplicate or invalid IDs.';
  end if;

  select count(*)::integer into v_owned_count
  from public.buffaloes b
  where b.user_id = v_user_id
    and b.id = any(p_buffalo_ids)
    and (b.purchase_date is null or b.purchase_date <= p_start_date)
    and coalesce((
      select h.status
      from public.buffalo_status_history h
      where h.user_id = v_user_id
        and h.buffalo_id = b.id
        and h.effective_date <= p_start_date
      order by h.effective_date desc, h.created_at desc
      limit 1
    ), 'OTHER'::public.buffalo_status) = 'ACTIVE'::public.buffalo_status;

  if v_owned_count <> cardinality(p_buffalo_ids) then
    raise exception 'Select only buffaloes active on the plan start date.';
  end if;

  if p_plan_id is null then
    insert into public.diet_plans(user_id,name,notes,start_date,end_date,status)
    values(v_user_id,trim(p_name),nullif(trim(p_notes),''),p_start_date,p_end_date,p_status)
    returning id into v_plan_id;
  else
    select id into v_plan_id from public.diet_plans
    where id = p_plan_id and user_id = v_user_id for update;
    if not found then raise exception 'Diet plan not found.'; end if;
    if exists (
      select 1 from public.diet_feeding_runs r
      where r.user_id = v_user_id and r.plan_id = v_plan_id and r.status = 'PROCESSING'
    ) then raise exception 'This plan cannot be edited while a feeding run is processing.'; end if;

    update public.diet_plans
    set name = trim(p_name), notes = nullif(trim(p_notes), ''),
        start_date = p_start_date, end_date = p_end_date, status = p_status
    where id = v_plan_id and user_id = v_user_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_feed_items) as x(value) loop
    if jsonb_typeof(v_item) <> 'object'
      or coalesce(v_item->>'feed_item_id','') = ''
      or coalesce(v_item->>'morning_quantity','') !~ '^([0-9]+)(\.[0-9]{1,3})?$'
      or coalesce(v_item->>'evening_quantity','') !~ '^([0-9]+)(\.[0-9]{1,3})?$' then
      raise exception 'Each feed row needs a feed item and valid morning/evening quantities (up to 3 decimals).';
    end if;

    v_feed_id := (v_item->>'feed_item_id')::uuid;
    v_morning := (v_item->>'morning_quantity')::numeric;
    v_evening := (v_item->>'evening_quantity')::numeric;

    if v_morning < 0 or v_evening < 0 or (v_morning = 0 and v_evening = 0) then
      raise exception 'Each feed must have a positive quantity for at least one feeding slot.';
    end if;
    if v_feed_id = any(v_seen) then raise exception 'A feed item can only appear once per plan.'; end if;
    v_seen := array_append(v_seen,v_feed_id);

    select f.base_unit into v_base_unit
    from public.feed_items f
    where f.id = v_feed_id and f.user_id = v_user_id and f.is_active
    for share;
    if not found then raise exception 'A selected feed item is inactive or unavailable.'; end if;

    insert into public.diet_plan_items(user_id,plan_id,feed_item_id,base_unit,morning_quantity,evening_quantity)
    values(v_user_id,v_plan_id,v_feed_id,v_base_unit,v_morning,v_evening)
    on conflict (user_id,plan_id,feed_item_id)
    do update set base_unit=excluded.base_unit,
                  morning_quantity=excluded.morning_quantity,
                  evening_quantity=excluded.evening_quantity,
                  updated_at=now();
  end loop;

  delete from public.diet_plan_items i
  where i.user_id = v_user_id and i.plan_id = v_plan_id
    and not (i.feed_item_id = any(v_seen));

  delete from public.diet_plan_buffaloes
  where user_id = v_user_id and plan_id = v_plan_id;

  insert into public.diet_plan_buffaloes(user_id,plan_id,buffalo_id)
  select v_user_id,v_plan_id,x
  from unnest(p_buffalo_ids) x;

  return v_plan_id;
end;
$$;

revoke all on function public.save_diet_plan(uuid,text,text,date,date,text,jsonb,uuid[]) from public, anon;
grant execute on function public.save_diet_plan(uuid,text,text,date,date,text,jsonb,uuid[]) to authenticated;
