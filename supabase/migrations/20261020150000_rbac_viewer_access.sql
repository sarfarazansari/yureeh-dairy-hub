-- Farm-level Super Admin / Viewer access.
-- Existing owner records are backfilled as the initial Super Admin. A Viewer is
-- read-only even when a SECURITY DEFINER RPC is called directly: a database
-- trigger guards writes independently of the UI and table RLS.
begin;

create table if not exists public.farm_memberships (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  role text not null default 'viewer' check (role in ('super_admin', 'viewer')),
  status text not null default 'active' check (status in ('invited', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint farm_memberships_identity_check check (
    member_user_id is not null or invited_email is not null
  ),
  constraint farm_memberships_owner_member_unique unique (owner_user_id, member_user_id)
);

create unique index if not exists farm_memberships_invited_email_unique
  on public.farm_memberships (owner_user_id, lower(invited_email))
  where invited_email is not null and status = 'invited';

create unique index if not exists farm_memberships_member_unique
  on public.farm_memberships (member_user_id)
  where member_user_id is not null and status = 'active';

create index if not exists farm_memberships_owner_status_idx
  on public.farm_memberships (owner_user_id, status, role);

alter table public.farm_memberships enable row level security;

-- Bootstrap the existing data owner(s) without guessing an auth user from UI input.
-- This is deliberately based on persisted ownership columns, not user metadata.
do $$
declare
  r record;
begin
  for r in
    select table_schema, table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name <> 'farm_memberships'
      and column_name in ('user_id', 'owner_id')
      and data_type = 'uuid'
    order by table_name, column_name
  loop
    execute format(
      'insert into public.farm_memberships (owner_user_id, member_user_id, role, status) ' ||
      'select distinct %1$I, %1$I, ''super_admin'', ''active'' from %2$I.%3$I ' ||
      'where %1$I is not null on conflict (owner_user_id, member_user_id) do nothing',
      r.column_name, r.table_schema, r.table_name
    );
  end loop;
end $$;

create or replace function public.current_farm_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select fm.owner_user_id
  from public.farm_memberships fm
  where fm.member_user_id = (select auth.uid())
    and fm.status = 'active'
    and fm.role in ('super_admin', 'viewer')
  order by case when fm.role = 'super_admin' then 0 else 1 end
  limit 1
$$;

create or replace function public.current_farm_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select fm.role
  from public.farm_memberships fm
  where fm.member_user_id = (select auth.uid())
    and fm.status = 'active'
  limit 1
$$;

create or replace function public.is_farm_viewer()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.farm_memberships fm
    where fm.member_user_id = (select auth.uid())
      and fm.status = 'active'
      and fm.role = 'viewer'
  )
$$;

create or replace function public.is_farm_member(p_owner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_owner_user_id is not null and exists (
    select 1 from public.farm_memberships fm
    where fm.owner_user_id = p_owner_user_id
      and fm.member_user_id = (select auth.uid())
      and fm.status = 'active'
      and fm.role in ('super_admin', 'viewer')
  )
$$;

create or replace function public.guard_viewer_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is not null and public.is_farm_viewer() then
    raise exception 'Read-only access: viewers cannot change farm data.'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

create or replace function public.claim_farm_viewer_invite()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  v_owner_id uuid;
begin
  if v_user_id is null or v_email = '' then
    raise exception 'Sign in with the invited email address to accept access.';
  end if;

  if exists (
    select 1 from public.farm_memberships
    where member_user_id = v_user_id and status = 'active'
  ) then
    return public.current_farm_role();
  end if;

  select owner_user_id into v_owner_id
  from public.farm_memberships
  where lower(invited_email) = v_email
    and status = 'invited'
    and role = 'viewer'
  order by created_at
  limit 1
  for update;

  if v_owner_id is null then
    return null;
  end if;

  update public.farm_memberships
  set member_user_id = v_user_id,
      status = 'active',
      invited_email = null,
      updated_at = now()
  where owner_user_id = v_owner_id
    and lower(invited_email) = v_email
    and status = 'invited'
    and role = 'viewer';

  return 'viewer';
end
$$;

create or replace function public.touch_farm_membership_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists farm_memberships_updated_at on public.farm_memberships;
create trigger farm_memberships_updated_at
before update on public.farm_memberships
for each row execute function public.touch_farm_membership_updated_at();

-- Only a farm owner can create/revoke pending Viewer invitations. No client can
-- create an active membership or assign the Super Admin role.
drop policy if exists farm_memberships_select_related on public.farm_memberships;
create policy farm_memberships_select_related
on public.farm_memberships for select to authenticated
using (owner_user_id = (select auth.uid()) or member_user_id = (select auth.uid()));

drop policy if exists farm_memberships_invite_viewer on public.farm_memberships;
create policy farm_memberships_invite_viewer
on public.farm_memberships for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and member_user_id is null
  and role = 'viewer'
  and status = 'invited'
  and invited_email is not null
  and length(trim(invited_email)) > 3
);

drop policy if exists farm_memberships_revoke_viewer on public.farm_memberships;
create policy farm_memberships_revoke_viewer
on public.farm_memberships for update to authenticated
using (owner_user_id = (select auth.uid()) and role = 'viewer')
with check (owner_user_id = (select auth.uid()) and role = 'viewer' and status in ('invited', 'revoked'));

-- Add a farm-aware SELECT policy to every public table that exposes a canonical
-- user_id/owner_id. Existing policy checks remain in place and are OR-combined.
do $$
declare
  r record;
  v_owner_column text;
  v_policy_name text;
begin
  for r in
    select c.table_schema, c.table_name,
           bool_or(c.column_name = 'user_id') as has_user_id,
           bool_or(c.column_name = 'owner_id') as has_owner_id
    from information_schema.columns c
    join pg_class pc on pc.relname = c.table_name
    join pg_namespace pn on pn.oid = pc.relnamespace and pn.nspname = c.table_schema
    where c.table_schema = 'public'
      and c.column_name in ('user_id', 'owner_id')
      and c.data_type = 'uuid'
      and pc.relkind in ('r', 'p')
      and c.table_name <> 'farm_memberships'
    group by c.table_schema, c.table_name
  loop
    v_owner_column := case when r.has_user_id then 'user_id' else 'owner_id' end;
    execute format('alter table %I.%I enable row level security', r.table_schema, r.table_name);
    v_policy_name := 'rbac_farm_select_' || r.table_name;
    if not exists (
      select 1 from pg_policies
      where schemaname = r.table_schema and tablename = r.table_name and policyname = v_policy_name
    ) then
      execute format(
        'create policy %I on %I.%I for select to authenticated using (public.is_farm_member(%I))',
        v_policy_name, r.table_schema, r.table_name, v_owner_column
      );
    end if;
  end loop;
end $$;

-- Existing SELECT policies often compare an owning row to auth.uid(). Resolve
-- that owner through the trusted membership row so child-table policies and
-- relationship checks keep their existing predicates and constraints.
do $$
declare
  r record;
  v_qual text;
begin
  for r in
    select schemaname, tablename, policyname, qual
    from pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and qual is not null
      and position('auth.uid()' in qual) > 0
      and tablename <> 'farm_memberships'
  loop
    v_qual := replace(r.qual, 'auth.uid()', 'public.current_farm_owner_id()');
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    execute format(
      'create policy %I on %I.%I for select to authenticated using (%s)',
      r.policyname, r.schemaname, r.tablename, v_qual
    );
  end loop;
end $$;

-- A trigger is the last line of defense for Viewer writes, including writes
-- attempted through SECURITY DEFINER functions that otherwise bypass RLS.
do $$
declare
  r record;
  v_trigger_name text;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname <> 'farm_memberships'
  loop
    v_trigger_name := 'rbac_viewer_write_guard';
    execute format('drop trigger if exists %I on %I.%I', v_trigger_name, r.schema_name, r.table_name);
    execute format(
      'create trigger %I before insert or update or delete on %I.%I for each row execute function public.guard_viewer_write()',
      v_trigger_name, r.schema_name, r.table_name
    );
  end loop;
end $$;

revoke all on function public.current_farm_owner_id() from public, anon;
revoke all on function public.current_farm_role() from public, anon;
revoke all on function public.is_farm_viewer() from public, anon;
revoke all on function public.is_farm_member(uuid) from public, anon;
revoke all on function public.guard_viewer_write() from public, anon;
revoke all on function public.claim_farm_viewer_invite() from public, anon;
grant execute on function public.current_farm_owner_id() to authenticated;
grant execute on function public.current_farm_role() to authenticated;
grant execute on function public.is_farm_viewer() to authenticated;
grant execute on function public.is_farm_member(uuid) to authenticated;
grant execute on function public.claim_farm_viewer_invite() to authenticated;

commit;
