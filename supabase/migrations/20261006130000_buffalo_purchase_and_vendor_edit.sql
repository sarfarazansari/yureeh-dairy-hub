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
  target_vendor_id uuid;
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

  target_vendor_id := purchase_row.vendor_id;

  if target_vendor_id is null then
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
    returning id into target_vendor_id;
  else
    update public.vendors
    set
      name = btrim(p_name),
      mobile = nullif(btrim(p_mobile), ''),
      address = nullif(btrim(p_address), ''),
      village_city = nullif(btrim(p_village_city), ''),
      state = nullif(btrim(p_state), ''),
      notes = nullif(btrim(p_notes), '')
    where id = target_vendor_id
      and user_id = owner_id;
  end if;

  update public.buffalo_purchases
  set vendor_id = target_vendor_id
  where id = purchase_row.id
    and user_id = owner_id;

  return target_vendor_id;
end;
$$;

revoke all on function public.update_buffalo_vendor(
  uuid,text,text,text,text,text,text
) from public, anon;

grant execute on function public.update_buffalo_vendor(
  uuid,text,text,text,text,text,text
) to authenticated;


-- Existing purchases predate the payment ledger. Preserve their recorded paid
-- balance as one historical payment entry rather than inventing installments.
insert into public.buffalo_purchase_payments(
  user_id,
  buffalo_purchase_id,
  buffalo_id,
  payment_date,
  amount,
  payment_method,
  transaction_reference,
  notes
)
select
  p.user_id,
  p.id,
  p.buffalo_id,
  p.purchase_date,
  p.amount_paid,
  coalesce(p.payment_method, 'OTHER'::public.payment_method),
  p.transaction_reference,
  'Historical payment balance recorded before payment history was introduced.'
from public.buffalo_purchases p
where p.amount_paid > 0
  and not exists (
    select 1
    from public.buffalo_purchase_payments existing
    where existing.buffalo_purchase_id = p.id
  );

-- Keep new buffalo purchases consistent with the payment ledger. The initial
-- advance is recorded as the first payment event; later payments use the
-- dedicated payment RPC.
create or replace function public.create_buffalo_purchase(
  p_buffalo_code text,
  p_breed text,
  p_purchase_date date,
  p_purchase_price numeric,
  p_advance_paid numeric,
  p_payment_due_date date,
  p_payment_terms text,
  p_buffalo_name text,
  p_vendor_name text,
  p_vendor_location text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  buffalo_id uuid;
  purchase_vendor_id uuid;
  purchase_id uuid;
  normalized_code text := upper(btrim(p_buffalo_code));
  clean_breed text := btrim(p_breed);
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;
  if normalized_code is null or normalized_code = '' then
    raise exception using errcode = '23514', message = 'Buffalo code is required.';
  end if;
  if clean_breed is null or clean_breed = '' then
    raise exception using errcode = '23514', message = 'Breed is required.';
  end if;
  if p_purchase_date is null then
    raise exception using errcode = '23514', message = 'Purchase date is required.';
  end if;
  if p_purchase_price is null or p_purchase_price <= 0 then
    raise exception using errcode = '23514', message = 'Purchase price must be greater than ₹0.';
  end if;
  if p_advance_paid is null or p_advance_paid < 0 then
    raise exception using errcode = '23514', message = 'Advance paid must be zero or greater.';
  end if;
  if p_advance_paid > p_purchase_price then
    raise exception using errcode = '23514', message = 'Advance paid cannot be greater than purchase price.';
  end if;
  if p_advance_paid < p_purchase_price and p_payment_due_date is null then
    raise exception using errcode = '23514', message = 'Udhaar due date is required when a balance is due.';
  end if;
  if nullif(btrim(p_vendor_location), '') is not null
     and nullif(btrim(p_vendor_name), '') is null then
    raise exception using errcode = '23514', message = 'Enter a vendor name to save its location.';
  end if;
  if exists (
    select 1
    from public.buffaloes b
    where b.user_id = owner_id
      and upper(btrim(b.buffalo_code)) = normalized_code
  ) then
    raise exception using errcode = '23505',
      message = 'Buffalo code already exists. Please use a unique code.';
  end if;

  if nullif(btrim(p_vendor_name), '') is not null then
    insert into public.vendors(user_id, name, village_city)
    values(owner_id, btrim(p_vendor_name), nullif(btrim(p_vendor_location), ''))
    returning id into purchase_vendor_id;
  end if;

  insert into public.buffaloes(user_id, buffalo_code, name, breed, purchase_date)
  values(owner_id, normalized_code, nullif(btrim(p_buffalo_name), ''), clean_breed, p_purchase_date)
  returning id into buffalo_id;

  insert into public.buffalo_purchases(
    user_id,
    buffalo_id,
    vendor_id,
    purchase_date,
    purchase_price,
    amount_paid,
    payment_status,
    payment_due_date,
    payment_terms
  )
  values (
    owner_id,
    buffalo_id,
    purchase_vendor_id,
    p_purchase_date,
    p_purchase_price,
    p_advance_paid,
    case
      when p_advance_paid = p_purchase_price then 'PAID'::public.payment_status
      when p_advance_paid > 0 then 'PARTIAL'::public.payment_status
      else 'CREDIT'::public.payment_status
    end,
    p_payment_due_date,
    nullif(btrim(p_payment_terms), '')
  )
  returning id into purchase_id;

  if p_advance_paid > 0 then
    insert into public.buffalo_purchase_payments(
      user_id,
      buffalo_purchase_id,
      buffalo_id,
      payment_date,
      amount,
      payment_method,
      notes
    )
    values (
      owner_id,
      purchase_id,
      buffalo_id,
      p_purchase_date,
      p_advance_paid,
      'CASH'::public.payment_method,
      'Initial payment recorded at buffalo purchase.'
    );
  end if;

  return buffalo_id;
end;
$$;

revoke all on function public.create_buffalo_purchase(
  text,text,date,numeric,numeric,date,text,text,text,text
) from public, anon;

grant execute on function public.create_buffalo_purchase(
  text,text,date,numeric,numeric,date,text,text,text,text
) to authenticated;
