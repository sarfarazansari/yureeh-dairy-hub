-- Server-side summaries for the customer and expense-vendor directories.
-- SECURITY INVOKER preserves the caller's existing RLS restrictions.
create or replace function public.get_customer_directory_summaries()
returns table (
  customer_id uuid,
  total_milk_quantity numeric,
  total_sales_amount numeric,
  entry_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    coalesce(sum(me.milk_quantity), 0)::numeric,
    coalesce(sum(me.calculated_amount), 0)::numeric,
    count(me.id)
  from public.customers c
  left join public.milk_entries me
    on me.customer_id = c.id
   and me.deleted_at is null
  group by c.id;
$$;

create or replace function public.get_expense_vendor_directory_summaries()
returns table (
  vendor_id uuid,
  expense_count bigint,
  total_amount numeric,
  paid_amount numeric,
  pending_amount numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    v.id,
    count(e.id),
    coalesce(sum(e.total_amount), 0)::numeric,
    coalesce(sum(e.paid_amount), 0)::numeric,
    coalesce(sum(e.pending_amount), 0)::numeric
  from public.expense_vendors v
  left join public.expenses e
    on e.vendor_id = v.id
   and e.deleted_at is null
  group by v.id;
$$;
