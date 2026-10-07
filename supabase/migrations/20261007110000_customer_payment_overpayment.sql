-- Allow customer payments to exceed current outstanding.
-- Excess payments are retained in the payment ledger as customer credit/advance.

create or replace function public.record_customer_payment(
  p_customer_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_method public.payment_method,
  p_transaction_reference text,
  p_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  payment_id uuid;
  customer_row_id uuid;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Sign in again.';
  end if;

  if p_payment_date is null then
    raise exception using errcode = '23514', message = 'Payment date is required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception using errcode = '23514', message = 'Payment amount must be greater than ₹0.';
  end if;

  if p_payment_method is null then
    raise exception using errcode = '23514', message = 'Payment method is required.';
  end if;

  select c.id
    into customer_row_id
  from public.customers c
  where c.id = p_customer_id
    and c.user_id = owner_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Customer was not found.';
  end if;

  insert into public.customer_payments(
    user_id,
    customer_id,
    payment_date,
    amount,
    payment_method,
    transaction_reference,
    notes
  )
  values (
    owner_id,
    customer_row_id,
    p_payment_date,
    p_amount,
    p_payment_method,
    nullif(btrim(p_transaction_reference), ''),
    nullif(btrim(p_notes), '')
  )
  returning id into payment_id;

  return payment_id;
end;
$$;

revoke all on function public.record_customer_payment(uuid,date,numeric,public.payment_method,text,text)
  from public, anon;

grant execute on function public.record_customer_payment(uuid,date,numeric,public.payment_method,text,text)
  to authenticated;
