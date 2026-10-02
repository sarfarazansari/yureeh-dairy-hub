-- Support the Milk Entries list's active-row date filters and deterministic sort.
-- The existing date index is replaced by this wider index, which has the same
-- user/date prefix and also covers created_at/id tie-break ordering.
create index if not exists milk_entries_user_date_created_idx
  on public.milk_entries(user_id, business_date desc, created_at desc, id desc)
  where deleted_at is null;

drop index if exists public.milk_entries_date_idx;

-- Customer-filtered list requests also constrain a business-date range and
-- use the same stable ordering.
create index if not exists milk_entries_user_customer_date_created_idx
  on public.milk_entries(user_id, customer_id, business_date desc, created_at desc, id desc)
  where deleted_at is null;
