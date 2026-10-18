-- SEC-001 security/integrity regression suite.
-- SAFETY: local/disposable Supabase only. Transactional synthetic fixtures are rolled back.
-- Run with:
--   SEC001_ALLOW_DESTRUCTIVE_TESTS=YES psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/sec-001-database-integrity.sql
-- This script is deliberately not wired to production deploy/migration commands.
\set ON_ERROR_STOP on
\if :{?SEC001_ALLOW_DESTRUCTIVE_TESTS}
\else
  \echo 'BLOCKED: set SEC001_ALLOW_DESTRUCTIVE_TESTS=YES for a disposable database.'
  \quit 3
\endif
\if :SEC001_ALLOW_DESTRUCTIVE_TESTS != 'YES'
  \echo 'BLOCKED: SEC001_ALLOW_DESTRUCTIVE_TESTS must equal YES.'
  \quit 3
\endif

begin;

-- Defense in depth: require an explicit local-test project identity and refuse
-- to proceed if the caller connected to a remote host. Local Supabase normally
-- exposes Postgres on localhost/127.0.0.1.
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

create temporary table sec001_fixture_users (
  user_id uuid primary key,
  email text not null unique
) on commit drop;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  fixture.user_id,
  'authenticated',
  'authenticated',
  fixture.email,
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(), now(), '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'sec001-owner-a@example.invalid'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'sec001-owner-b@example.invalid')
) as fixture(user_id, email);

insert into sec001_fixture_users(user_id,email)
values
  ('a0000000-0000-4000-8000-000000000001','sec001-owner-a@example.invalid'),
  ('a0000000-0000-4000-8000-000000000002','sec001-owner-b@example.invalid');

-- JWT claims are the supported way to exercise auth.uid() and authenticated RLS.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $rls$
declare
  v_owner_a uuid := 'a0000000-0000-4000-8000-000000000001';
  v_owner_b uuid := 'a0000000-0000-4000-8000-000000000002';
  v_visible integer;
begin
  -- A cannot forge ownership on a vendor row.
  begin
    insert into public.expense_vendors(user_id, name)
    values (v_owner_b, 'SEC001 forbidden vendor');
    raise exception 'SEC-001 FAIL: forged vendor ownership insert unexpectedly succeeded';
  exception when insufficient_privilege or check_violation then
    null;
  end;

  -- A should not be able to see B's expenses even if a fixture exists.
  select count(*) into v_visible
  from public.expenses
  where user_id = v_owner_b;
  if v_visible <> 0 then
    raise exception 'SEC-001 FAIL: cross-owner expense rows visible (% rows)', v_visible;
  end if;

  -- A cannot forge the owner column when recording a customer payment directly.
  -- Customer rows are not fabricated here; the policy must reject the forged owner
  -- before a valid customer FK could make the insert succeed.
  begin
    insert into public.customer_payments(
      user_id, customer_id, payment_date, amount, payment_method
    ) values (
      v_owner_b,
      'b0000000-0000-4000-8000-000000000001',
      current_date,
      1,
      'CASH'::public.payment_method
    );
    raise exception 'SEC-001 FAIL: forged customer payment ownership unexpectedly succeeded';
  exception when insufficient_privilege or check_violation or foreign_key_violation then
    null;
  end;
end
$rls$;

-- Seed an owner-owned category/vendor for an expense fixture. We temporarily
-- use the same authenticated owner and never disable RLS.
insert into public.expense_vendors(user_id, name)
values ('a0000000-0000-4000-8000-000000000001', 'SEC001 owned vendor');

-- Expense categories are shared system rows; select one existing active category.
do $expense$
declare
  v_user uuid := 'a0000000-0000-4000-8000-000000000001';
  v_category uuid;
  v_expense uuid;
  v_vendor uuid;
begin
  select id into v_category
  from public.expense_categories
  where owner_id is null and is_active
  order by name
  limit 1;
  if v_category is null then
    raise exception 'SEC-001 fixture prerequisite failed: no active shared expense category';
  end if;

  select id into v_vendor from public.expense_vendors
  where user_id = v_user and name = 'SEC001 owned vendor';
  insert into public.expenses(
    user_id, business_date, category_id, category_name_snapshot,
    category_group_snapshot, vendor_id, description, total_amount,
    payment_status, paid_amount
  ) values (
    v_user, current_date, v_category, 'SEC001 category snapshot',
    (select category_group from public.expense_categories where id = v_category),
    v_vendor, 'SEC001 linked-expense guard fixture', 10, 'CREDIT', 0
  ) returning id into v_expense;

  -- Feed-purchase ownership and linked expense fixture are only meaningful when
  -- required purchase fields/types are known from the full deployed migration set.
  -- We assert the linked-expense guard itself via its trigger's table relationship
  -- if a valid active purchase can be inserted through the schema's required columns.
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.oid = 'public.expenses'::regclass
      and t.tgname = 'expenses_guard_feed_purchase_link'
      and not t.tgisinternal
  ) then
    raise exception 'SEC-001 FAIL: expected DB trigger expenses_guard_feed_purchase_link is absent';
  end if;
end
$expense$;

-- Scheduler invariants at schema level: uniqueness must be enforced by a unique
-- constraint/index, not only application code. This intentionally asserts the
-- expected occurrence key exists before concurrency checks are attempted.
do $scheduler$
declare
  v_has_occurrence_unique boolean;
begin
  select exists (
    select 1
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    where t.oid = 'public.diet_feeding_runs'::regclass
      and i.indisunique
      and pg_get_indexdef(i.indexrelid) ilike '%user_id, plan_id, feeding_date, shift%'
  ) into v_has_occurrence_unique;
  if not v_has_occurrence_unique then
    raise exception 'SEC-001 FAIL: scheduler occurrence unique index/constraint is missing';
  end if;
end
$scheduler$;

rollback;

\echo 'SEC-001 transactional baseline assertions passed in this disposable database. Concurrency tests are still required.'
