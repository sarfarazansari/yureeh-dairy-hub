-- Preserve the existing purchase columns. In this schema:
-- amount_paid is the amount paid at purchase time, amount_pending is already
-- generated from purchase_price - amount_paid, payment_status is the existing
-- PAID/PARTIAL/CREDIT classification, and payment_due_date/payment_terms hold
-- the udhaar due date and terms. No equivalent columns are added.

-- Do not silently merge or delete duplicate buffaloes. Stop with a useful
-- report if legacy case/whitespace variants collide after normalization.
do $$
declare duplicate_report text;
begin
  select string_agg(format('farm %s: %s (%s rows)', user_id, buffalo_code, row_count), '; ')
    into duplicate_report
  from (
    select user_id, upper(btrim(buffalo_code)) as buffalo_code, count(*) as row_count
    from public.buffaloes
    group by user_id, upper(btrim(buffalo_code))
    having count(*) > 1
  ) duplicates;
  if duplicate_report is not null then
    raise exception 'Cannot add normalized buffalo-code uniqueness. Resolve these duplicate codes per farm without deleting records: %', duplicate_report;
  end if;
end;
$$;

-- Canonicalize existing spellings only after confirming this will not merge
-- two existing records. The records and their IDs remain untouched.
update public.buffaloes
set buffalo_code = upper(btrim(buffalo_code))
where buffalo_code <> upper(btrim(buffalo_code));

create or replace function public.normalize_buffalo_code()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.buffalo_code := upper(btrim(new.buffalo_code));
  if new.buffalo_code is null or new.buffalo_code = '' then
    raise exception using errcode = '23514', message = 'Buffalo code is required.';
  end if;
  return new;
end;
$$;

drop trigger if exists buffaloes_normalize_code on public.buffaloes;
create trigger buffaloes_normalize_code
before insert or update of buffalo_code on public.buffaloes
for each row execute function public.normalize_buffalo_code();

create unique index if not exists buffaloes_user_normalized_code_uidx
  on public.buffaloes (user_id, upper(btrim(buffalo_code)));

-- Keep old rows intact while enforcing new purchase rules. NOT VALID checks
-- apply to inserts and changed rows without requiring historical cleanup.
do $$ begin
  alter table public.buffalo_purchases add constraint buffalo_purchase_price_positive
    check (purchase_price > 0) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.buffalo_purchases add constraint buffalo_purchase_credit_state_valid
    check (
      (amount_paid = purchase_price and payment_status = 'PAID' and payment_due_date is null)
      or
      (amount_paid < purchase_price and payment_status in ('PARTIAL', 'CREDIT') and payment_due_date is not null)
    ) not valid;
exception when duplicate_object then null;
end $$;

create or replace function public.normalize_buffalo_purchase_payment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.purchase_price is null or new.purchase_price <= 0 then
    raise exception using errcode = '23514', message = 'Purchase price must be greater than ₹0.';
  end if;
  if new.amount_paid is null or new.amount_paid < 0 then
    raise exception using errcode = '23514', message = 'Advance paid must be zero or greater.';
  end if;
  if new.amount_paid > new.purchase_price then
    raise exception using errcode = '23514', message = 'Advance paid cannot be greater than purchase price.';
  end if;
  if new.purchase_date is null then
    raise exception using errcode = '23514', message = 'Purchase date is required.';
  end if;

  if new.amount_paid = new.purchase_price then
    new.payment_status := 'PAID';
    new.payment_due_date := null;
    new.payment_terms := null;
  else
    if new.payment_due_date is null then
      raise exception using errcode = '23514', message = 'Udhaar due date is required when a balance is due.';
    end if;
    new.payment_status := case when new.amount_paid > 0
      then 'PARTIAL'::public.payment_status else 'CREDIT'::public.payment_status end;
  end if;
  return new;
end;
$$;

drop trigger if exists buffalo_purchases_normalize_payment on public.buffalo_purchases;
create trigger buffalo_purchases_normalize_payment
before insert or update on public.buffalo_purchases
for each row execute function public.normalize_buffalo_purchase_payment();

-- A new buffalo and its purchase must commit together. This deferred trigger
-- blocks direct API inserts that would leave a zero-price/incomplete animal,
-- while allowing the RPC below to create both rows in one transaction.
create or replace function public.require_buffalo_purchase()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.buffaloes b where b.id = new.id
      and (nullif(btrim(b.breed), '') is null or b.purchase_date is null)
  ) then
    raise exception using errcode = '23514', message = 'Buffalo breed and purchase date are required.';
  end if;
  if exists (select 1 from public.buffaloes b where b.id = new.id)
     and not exists (select 1 from public.buffalo_purchases p where p.buffalo_id = new.id) then
    raise exception using errcode = '23514', message = 'A buffalo purchase with a valid purchase price is required.';
  end if;
  return null;
end;
$$;

drop trigger if exists buffaloes_require_purchase on public.buffaloes;
create constraint trigger buffaloes_require_purchase
after insert on public.buffaloes
deferrable initially deferred
for each row execute function public.require_buffalo_purchase();

-- Single transactional server-side path: the vendor, buffalo and purchase
-- either all save or all roll back. Existing RLS policies remain in force.
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
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  buffalo_id uuid;
  purchase_vendor_id uuid;
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
  if nullif(btrim(p_vendor_location), '') is not null and nullif(btrim(p_vendor_name), '') is null then
    raise exception using errcode = '23514', message = 'Enter a vendor name to save its location.';
  end if;
  if exists (
    select 1 from public.buffaloes b
    where b.user_id = owner_id and upper(btrim(b.buffalo_code)) = normalized_code
  ) then
    raise exception using errcode = '23505', message = 'Buffalo code already exists. Please use a unique code.';
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
    user_id, buffalo_id, vendor_id, purchase_date, purchase_price, amount_paid,
    payment_status, payment_due_date, payment_terms
  ) values (
    owner_id, buffalo_id, purchase_vendor_id, p_purchase_date, p_purchase_price, p_advance_paid,
    case when p_advance_paid = p_purchase_price then 'PAID'::public.payment_status
         when p_advance_paid > 0 then 'PARTIAL'::public.payment_status
         else 'CREDIT'::public.payment_status end,
    p_payment_due_date, nullif(btrim(p_payment_terms), '')
  );
  return buffalo_id;
end;
$$;

revoke all on function public.create_buffalo_purchase(text,text,date,numeric,numeric,date,text,text,text,text) from public;
grant execute on function public.create_buffalo_purchase(text,text,date,numeric,numeric,date,text,text,text,text) to authenticated;
