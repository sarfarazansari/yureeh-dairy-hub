-- Store measured fat for the mixed farm milk pool, once per date and shift.
-- Fat is a pool-level measurement, not an individual buffalo production attribute.
create table public.milk_pool_shift_fat (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_date date not null,
  shift public.milk_shift not null,
  fat_percentage numeric(5,2) not null check (fat_percentage >= 0 and fat_percentage <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, business_date, shift)
);

create index milk_pool_shift_fat_date_idx
  on public.milk_pool_shift_fat(user_id, business_date desc, shift);
create trigger milk_pool_shift_fat_updated_at
  before update on public.milk_pool_shift_fat
  for each row execute function public.set_updated_at();

alter table public.milk_pool_shift_fat enable row level security;
grant select, insert, update, delete on public.milk_pool_shift_fat to authenticated;
create policy milk_pool_shift_fat_select_own on public.milk_pool_shift_fat
  for select to authenticated using (user_id = (select auth.uid()));
create policy milk_pool_shift_fat_insert_own on public.milk_pool_shift_fat
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy milk_pool_shift_fat_update_own on public.milk_pool_shift_fat
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy milk_pool_shift_fat_delete_own on public.milk_pool_shift_fat
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.save_milk_pool_shift_fat(
  p_business_date date,
  p_shift public.milk_shift,
  p_fat_percentage numeric
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to save milk fat.' using errcode = '42501';
  end if;
  if p_business_date is null or p_shift is null then
    raise exception 'A date and shift are required.' using errcode = '22023';
  end if;
  if p_fat_percentage is null then
    delete from public.milk_pool_shift_fat
    where user_id = auth.uid()
      and business_date = p_business_date
      and shift = p_shift;
    return;
  end if;
  if p_fat_percentage < 0 or p_fat_percentage > 100 or scale(p_fat_percentage) > 2 then
    raise exception 'Fat percentage must be between 0 and 100 with at most two decimal places.' using errcode = '22023';
  end if;

  insert into public.milk_pool_shift_fat(user_id, business_date, shift, fat_percentage)
  values (auth.uid(), p_business_date, p_shift, p_fat_percentage)
  on conflict (user_id, business_date, shift)
  do update set fat_percentage = excluded.fat_percentage;
end;
$$;

revoke all on function public.save_milk_pool_shift_fat(date, public.milk_shift, numeric) from public, anon;
grant execute on function public.save_milk_pool_shift_fat(date, public.milk_shift, numeric) to authenticated;

-- Save the animal production sheet and pooled fat in one transaction. If either
-- validation or write fails, PostgreSQL rolls back both operations.
create or replace function public.save_buffalo_production_with_fat(
  p_business_date date,
  p_shift public.milk_shift,
  p_buffalo_ids uuid[],
  p_records jsonb,
  p_fat_percentage numeric
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.save_buffalo_milk_production(
    p_business_date, p_shift, p_buffalo_ids, p_records
  );
  perform public.save_milk_pool_shift_fat(
    p_business_date, p_shift, p_fat_percentage
  );
end;
$$;

revoke all on function public.save_buffalo_production_with_fat(
  date, public.milk_shift, uuid[], jsonb, numeric
) from public, anon;
grant execute on function public.save_buffalo_production_with_fat(
  date, public.milk_shift, uuid[], jsonb, numeric
) to authenticated;
