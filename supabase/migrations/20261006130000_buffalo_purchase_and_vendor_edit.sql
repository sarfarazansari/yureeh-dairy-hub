-- Editable buffalo acquisition and vendor details.
-- Payment amounts remain ledger-driven; the purchase edit cannot rewrite paid history.

create or replace function public.update_buffalo_purchase(
  p_buffalo_id uuid,
  p_purchase_date date,
  p_purchase_price numeric,
  p_payment_due_date date,
  p_payment_terms text,
  p_payment_method public.payment_method,
  p_transaction_reference text,
  p_notes text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  purchase_row public.buffalo_purchases%rowtype;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in to edit purchase details.';
  end if;

  if p_purchase_date is null then
    raise exception using errcode = '23514', message = 'Purchase date is required.';
  end if;

  if p_purchase_price is null or p_purchase_price <= 0 then
    raise exception using errcode = '23514', message = 'Purchase price must be greater than ₹0.';
  end if;

  select *
    into purchase_row
  from public.buffalo_purchases
  where user_id = owner_id
    and buffalo_id = p_buffalo_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Buffalo purchase record was not found.';
  end if;

  if purchase_row.amount_paid > p_purchase_price then
    raise exception using errcode = '23514',
      message = 'Purchase price cannot be lower than the amount already paid.';
  end if;

  if purchase_row.amount_paid < p_purchase_price and p_payment_due_date is null then
    raise exception using errcode = '23514',
      message = 'Udhaar due date is required while a balance is pending.';
  end if;

  update public.buffalo_purchases
  set
    purchase_date = p_purchase_date,
    purchase_price = p_purchase_price,
    payment_status = case
      when purchase_row.amount_paid = p_purchase_price then 'PAID'::public.payment_status
      when purchase_row.amount_paid > 0 then 'PARTIAL'::public.payment_status
      else 'CREDIT'::public.payment_status
    end,
    payment_due_date = case
      when purchase_row.amount_paid = p_purchase_price then null
      else p_payment_due_date
    end,
    payment_terms = case
      when purchase_row.amount_paid = p_purchase_price then null
      else nullif(btrim(p_payment_terms), '')
    end,
    payment_method = p_payment_method,
    transaction_reference = nullif(btrim(p_transaction_reference), ''),
    notes = nullif(btrim(p_notes), '')
  where id = purchase_row.id
    and user_id = owner_id;

  update public.buffaloes
  set purchase_date = p_purchase_date
  where id = p_buffalo_id
    and user_id = owner_id;
end;
$$;

revoke all on function public.update_buffalo_purchase(
  uuid,date,numeric,date,text,public.payment_method,text,text
) from public, anon;

grant execute on function public.update_buffalo_purchase(
  uuid,date,numeric,date,text,public.payment_method,text,text
) to authenticated;


create or replace function public.update_buffalo_vendor(
  p_buffalo_id uuid,
  p_name text,
  p_mobile text,
  p_address text,
  p_village_city text,
  p_state text,
  p_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  purchase_row public.buffalo_purchases%rowtype;
  vendor_id uuid;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in to edit vendor details.';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception using errcode = '23514', message = 'Vendor name is required.';
  end if;

  select *
    into purchase_row
  from public.buffalo_purchases
  where user_id = owner_id
    and buffalo_id = p_buffalo_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Buffalo purchase record was not found.';
  end if;

  vendor_id := purchase_row.vendor_id;

  if vendor_id is null then
    insert into public.vendors(user_id, name, mobile, address, village_city, state, notes)
    values (
      owner_id,
      btrim(p_name),
      nullif(btrim(p_mobile), ''),
      nullif(btrim(p_address), ''),
      nullif(btrim(p_village_city), ''),
      nullif(btrim(p_state), ''),
      nullif(btrim(p_notes), '')
    )
    returning id into vendor_id;
  else
    update public.vendors
    set
      name = btrim(p_name),
      mobile = nullif(btrim(p_mobile), ''),
      address = nullif(btrim(p_address), ''),
      village_city = nullif(btrim(p_village_city), ''),
      state = nullif(btrim(p_state), ''),
      notes = nullif(btrim(p_notes), '')
    where id = vendor_id
      and user_id = owner_id;
  end if;

  update public.buffalo_purchases
  set vendor_id = vendor_id
  where id = purchase_row.id
    and user_id = owner_id;

  return vendor_id;
end;
$$;

revoke all on function public.update_buffalo_vendor(
  uuid,text,text,text,text,text,text
) from public, anon;

grant execute on function public.update_buffalo_vendor(
  uuid,text,text,text,text,text,text
) to authenticated;
