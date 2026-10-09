-- Connect future buffalo production changes to the milk pool.
-- Production remains the source-of-truth animal record; pool receipts are derived
-- from it transactionally and corrected through reversal movements.

create or replace function public.sync_buffalo_milk_pool_receipt(
  p_production_id uuid,
  p_business_date date,
  p_shift public.milk_shift,
  p_quantity numeric
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  current_receipt public.milk_pool_movements%rowtype;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;

  select m.* into current_receipt
  from public.milk_pool_movements m
  where m.user_id = owner_id
    and m.movement_type = 'PRODUCTION_RECEIPT'
    and m.source_type = 'BUFFALO_MILK_PRODUCTION'
    and m.source_id = p_production_id
    and not exists (
      select 1 from public.milk_pool_movements reversal
      where reversal.reversal_of_id = m.id
    )
  order by m.created_at desc
  limit 1
  for update;

  if current_receipt.id is not null
     and (p_quantity is null or p_quantity <= 0 or current_receipt.quantity <> p_quantity) then
    insert into public.milk_pool_movements (
      user_id, business_date, shift, movement_type, movement_direction,
      quantity, reversal_of_id, source_type, source_id, notes
    )
    values (
      owner_id, current_receipt.business_date, current_receipt.shift,
      'ADJUSTMENT', 'OUT', current_receipt.quantity, current_receipt.id,
      'BUFFALO_MILK_PRODUCTION_REVERSAL', p_production_id,
      'Reversal of previous production receipt.'
    );
  end if;

  if p_quantity is not null and p_quantity > 0
     and (
       current_receipt.id is null
       or current_receipt.quantity <> p_quantity
     ) then
    insert into public.milk_pool_movements (
      user_id, business_date, shift, movement_type, movement_direction,
      quantity, source_type, source_id, notes
    )
    values (
      owner_id, p_business_date, p_shift,
      'PRODUCTION_RECEIPT', 'IN', p_quantity,
      'BUFFALO_MILK_PRODUCTION', p_production_id,
      'Buffalo milk production receipt.'
    );
  end if;
end;
$$;

revoke all on function public.sync_buffalo_milk_pool_receipt(
  uuid, date, public.milk_shift, numeric
) from public, anon;
grant execute on function public.sync_buffalo_milk_pool_receipt(
  uuid, date, public.milk_shift, numeric
) to authenticated;

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
  v_existing public.buffalo_milk_production%rowtype;
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

  -- Intentionally cleared records must first reverse their active pool receipts.
  for v_existing in
    select *
    from public.buffalo_milk_production
    where user_id = auth.uid()
      and business_date = p_business_date
      and shift = p_shift
      and buffalo_id = any(p_buffalo_ids)
      and not (buffalo_id = any(v_record_ids))
  loop
    perform public.sync_buffalo_milk_pool_receipt(
      v_existing.id, v_existing.business_date, v_existing.shift, null
    );
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

    insert into public.buffalo_milk_production(
      user_id, buffalo_id, business_date, shift, milk_quantity
    )
    values (
      auth.uid(), v_buffalo_id, p_business_date, p_shift, v_milk_quantity
    )
    on conflict (user_id, buffalo_id, business_date, shift)
    do update set milk_quantity = excluded.milk_quantity
    returning * into v_existing;

    perform public.sync_buffalo_milk_pool_receipt(
      v_existing.id, v_existing.business_date, v_existing.shift, v_existing.milk_quantity
    );
  end loop;
end;
$$;
