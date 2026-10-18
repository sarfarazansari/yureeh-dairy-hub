-- SEC-001 transactional security regression tests.
-- DESTRUCTIVE-GUARD: local Supabase database only. Synthetic fixtures roll back.
-- Command:
--   SEC001_ALLOW_DESTRUCTIVE_TESTS=YES SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f supabase/tests/sec-001-database-integrity.sql
\set ON_ERROR_STOP on
\if :{?SEC001_ALLOW_DESTRUCTIVE_TESTS}
\else
  \echo 'BLOCKED: set SEC001_ALLOW_DESTRUCTIVE_TESTS=YES.'
  \quit 3
\endif
\if :SEC001_ALLOW_DESTRUCTIVE_TESTS != 'YES'
  \echo 'BLOCKED: SEC001_ALLOW_DESTRUCTIVE_TESTS must equal YES.'
  \quit 3
\endif
\if :{?SUPABASE_DB_URL}
\else
  \echo 'BLOCKED: SUPABASE_DB_URL must point to local Supabase Postgres.'
  \quit 3
\endif

begin;

do $guard$
declare
  v_host text := coalesce(inet_server_addr()::text, 'local-socket');
  v_db text := current_database();
begin
  if v_host not in ('127.0.0.1', '::1', 'local-socket') then
    raise exception 'SEC-001 safety stop: host % is not loopback/local socket', v_host;
  end if;
  if v_db not ilike '%test%' and v_db not ilike '%postgres%' then
    raise exception 'SEC-001 safety stop: unexpected database name %', v_db;
  end if;
end
$guard$;

-- Assumes the standard Supabase auth.users structure and fully applied migrations.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
)
values
 ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000001',
  'authenticated','authenticated','sec001-owner-a@example.invalid','',now(),
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000002',
  'authenticated','authenticated','sec001-owner-b@example.invalid','',now(),
  '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','')
on conflict (id) do nothing;

-- Create fixtures as the database test operator, then verify under owner A RLS.
reset role;
create temporary table sec001_fixture_ids (
  owner_a uuid not null,
  owner_b uuid not null,
  category_id uuid not null,
  vendor_a uuid not null,
  vendor_b uuid not null,
  expense_a uuid not null,
  expense_b uuid not null
) on commit drop;

do $fixtures$
declare
  v_category uuid;
  v_group public.expense_category_group;
  v_name text;
  v_vendor_a uuid;
  v_vendor_b uuid;
  v_expense_a uuid;
  v_expense_b uuid;
begin
  select id, name, category_group into v_category, v_name, v_group
  from public.expense_categories
  where owner_id is null and is_active
  order by name
  limit 1;
  if v_category is null then
    raise exception 'SEC-001 prerequisite: no active shared expense category';
  end if;

  insert into public.expense_vendors(user_id,name)
  values ('a0000000-0000-4000-8000-000000000001','SEC001 vendor A')
  returning id into v_vendor_a;
  insert into public.expense_vendors(user_id,name)
  values ('a0000000-0000-4000-8000-000000000002','SEC001 vendor B')
  returning id into v_vendor_b;

  insert into public.expenses(
    user_id,business_date,category_id,category_name_snapshot,
    category_group_snapshot,vendor_id,description,total_amount,payment_status,paid_amount
  ) values (
    'a0000000-0000-4000-8000-000000000001',current_date,v_category,v_name,v_group,
    v_vendor_a,'SEC001 temporary row A',10,'CREDIT',0
  ) returning id into v_expense_a;

  insert into public.expenses(
    user_id,business_date,category_id,category_name_snapshot,
    category_group_snapshot,vendor_id,description,total_amount,payment_status,paid_amount
  ) values (
    'a0000000-0000-4000-8000-000000000002',current_date,v_category,v_name,v_group,
    v_vendor_b,'SEC001 temporary row B',10,'CREDIT',0
  ) returning id into v_expense_b;

  insert into sec001_fixture_ids values (
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000002',
    v_category,v_vendor_a,v_vendor_b,v_expense_a,v_expense_b
  );
end
$fixtures$;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

do $rls$
declare
  v_count integer;
begin
  select count(*) into v_count from public.expenses;
  if v_count <> 1 then
    raise exception 'SEC-001 FAIL: owner A should see one own expense, saw %',v_count;
  end if;

  begin
    insert into public.expense_vendors(user_id,name)
    values ('a0000000-0000-4000-8000-000000000002','SEC001 forbidden vendor');
  exception when insufficient_privilege or check_violation then
    -- Expected RLS denial.
    null;
  end;
  if exists (select 1 from public.expense_vendors where name='SEC001 forbidden vendor') then
    raise exception 'SEC-001 FAIL: owner A forged owner B vendor write succeeded';
  end if;

  update public.expenses
  set total_amount = 20
  where id = (select expense_b from sec001_fixture_ids);
  if found then
    raise exception 'SEC-001 FAIL: owner A updated owner B expense';
  end if;

  begin
    insert into public.customer_payments(
      user_id,customer_id,payment_date,amount,payment_method
    ) values (
      'a0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000001',
      current_date,1,'CASH'::public.payment_method
    );
  exception when insufficient_privilege or check_violation or foreign_key_violation then
    -- Expected ownership/FK denial for this forged write.
    null;
  end;
  if exists (
    select 1 from public.customer_payments
    where user_id='a0000000-0000-4000-8000-000000000002' and amount=1
      and payment_date=current_date
  ) then
    raise exception 'SEC-001 FAIL: forged customer payment write persisted';
  end if;
end
$rls$;

-- Presence of DB guards is asserted; direct update/delete behavior should also
-- be exercised with a valid active feed_purchase fixture once local schema is confirmed.
do $expense_guard$
begin
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid='public.expenses'::regclass
      and t.tgname='expenses_guard_feed_purchase_link'
      and not t.tgisinternal
  ) then
    raise exception 'SEC-001 FAIL: feed-purchase-linked expense guard trigger missing';
  end if;
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid='public.expenses'::regclass
      and t.tgname='expenses_guard_paid_amount_ledger'
      and not t.tgisinternal
  ) then
    raise exception 'SEC-001 FAIL: ledger-derived paid_amount guard trigger missing';
  end if;
end
$expense_guard$;

do $scheduler$
begin
  if not exists (
    select 1 from pg_index i
    where i.indrelid='public.diet_feeding_runs'::regclass
      and i.indisunique
      and pg_get_indexdef(i.indexrelid) ilike '%user_id, plan_id, feeding_date, shift%'
  ) then
    raise exception 'SEC-001 FAIL: scheduler occurrence uniqueness constraint/index missing';
  end if;
end
$scheduler$;

rollback;
\echo 'SEC-001 transactional baseline assertions passed. Concurrent session scenarios remain required.'
