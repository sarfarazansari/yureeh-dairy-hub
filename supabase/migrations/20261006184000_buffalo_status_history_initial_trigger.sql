-- Keep lifecycle history complete for every newly purchased buffalo.
-- The production sheet can then resolve the herd as-of any business date.

create or replace function public.record_initial_buffalo_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.buffalo_status_history(
    user_id,
    buffalo_id,
    status,
    effective_date,
    notes
  )
  values (
    new.user_id,
    new.id,
    new.current_status,
    coalesce(new.purchase_date, current_date),
    'Initial status recorded when buffalo was added.'
  );
  return new;
end;
$$;

drop trigger if exists buffaloes_record_initial_status on public.buffaloes;
create trigger buffaloes_record_initial_status
after insert on public.buffaloes
for each row
execute function public.record_initial_buffalo_status();

revoke all on function public.record_initial_buffalo_status() from public, anon;
grant execute on function public.record_initial_buffalo_status() to authenticated;
