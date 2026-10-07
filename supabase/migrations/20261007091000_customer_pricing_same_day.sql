-- Pricing history is date-effective. A second pricing change on the same business
-- date replaces the current day's configuration rather than creating overlapping
-- periods that cannot be distinguished by date alone.

create or replace function public.record_customer_rate_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.customer_rate_history(
      customer_id, pricing_type, rate, effective_from
    )
    values (
      new.id, new.pricing_type, new.default_rate, current_date
    );
  elsif old.default_rate is distinct from new.default_rate
     or old.pricing_type is distinct from new.pricing_type then

    if exists (
      select 1
      from public.customer_rate_history
      where customer_id = new.id
        and effective_from = current_date
        and effective_to is null
    ) then
      update public.customer_rate_history
      set pricing_type = new.pricing_type,
          rate = new.default_rate
      where customer_id = new.id
        and effective_from = current_date
        and effective_to is null;
    else
      update public.customer_rate_history
      set effective_to = greatest(effective_from, current_date - 1)
      where customer_id = new.id
        and effective_to is null;

      insert into public.customer_rate_history(
        customer_id, pricing_type, rate, effective_from
      )
      values (
        new.id, new.pricing_type, new.default_rate, current_date
      );
    end if;
  end if;

  return new;
end;
$$;
