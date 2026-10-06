-- Allow editing buffalo master/profile data without changing acquisition transactions.
alter table public.buffaloes
  add constraint buffalo_code_not_blank_after_trim
  check (length(trim(buffalo_code)) > 0);

create or replace function public.update_buffalo_profile(
  p_buffalo_id uuid,
  p_buffalo_code text,
  p_name text,
  p_breed text,
  p_color text,
  p_identification_mark text,
  p_age_at_purchase_months integer,
  p_notes text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign in to edit buffalo.';
  end if;
  if nullif(btrim(p_buffalo_code), '') is null then
    raise exception using errcode = '23514', message = 'Buffalo code is required.';
  end if;
  if nullif(btrim(p_breed), '') is null then
    raise exception using errcode = '23514', message = 'Breed is required.';
  end if;
  if p_age_at_purchase_months is not null and p_age_at_purchase_months < 0 then
    raise exception using errcode = '23514', message = 'Age at purchase cannot be negative.';
  end if;

  update public.buffaloes
  set
    buffalo_code = upper(btrim(p_buffalo_code)),
    name = nullif(btrim(p_name), ''),
    breed = btrim(p_breed),
    color = nullif(btrim(p_color), ''),
    identification_mark = nullif(btrim(p_identification_mark), ''),
    age_at_purchase_months = p_age_at_purchase_months,
    notes = nullif(btrim(p_notes), '')
  where id = p_buffalo_id and user_id = auth.uid();

  if not found then
    raise exception using errcode = 'P0002', message = 'Buffalo was not found.';
  end if;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'Buffalo code already exists. Please use a unique code.';
end;
$$;

revoke all on function public.update_buffalo_profile(uuid,text,text,text,text,text,integer,text)
  from public, anon;
grant execute on function public.update_buffalo_profile(uuid,text,text,text,text,text,integer,text)
  to authenticated;
