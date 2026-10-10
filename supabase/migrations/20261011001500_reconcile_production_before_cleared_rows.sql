-- Reconcile submitted production receipts before reversing records cleared from the sheet.
-- This prevents a false negative intermediate balance when the same save adds milk
-- that compensates for a receipt being cleared. The final shift balance guard remains active.
create or replace function public.save_buffalo_milk_production(
  p_business_date date,
  p_shift public.milk_shift,
  p_buffalo_ids uuid[],
  p_records jsonb
)
returns void
language plpgsql
set search_path = ''
as $function$
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
  from public.buffaloes b
  where b.user_id = auth.uid()
    and b.id = any(p_buffalo_ids)
    and (b.purchase_date is null or b.purchase_date <= p_business_date)
    and coalesce((
      select h.status
      from public.buffalo_status_history h
      where h.user_id = auth.uid()
        and h.buffalo_id = b.id
        and h.effective_date <= p_business_date
      order by h.effective_date desc, h.created_at desc
      limit 1
    ), 'OTHER'::public.buffalo_status) = 'ACTIVE'::public.buffalo_status;

  if v_owned_count <> cardinality(p_buffalo_ids) then
    raise exception 'One or more buffaloes were not active on the selected date, were not yet purchased, or do not belong to this farm.' using errcode = '22023';
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

  -- First persist all nonblank values and their pool receipts. If blank rows are
  -- reversed first, the balance guard can reject a valid sheet save before these
  -- compensating receipts have been added.
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

  -- Only after the submitted records are reconciled, reverse and remove blank rows.
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
end;
$function$;
