# Feed purchase / expense reconciliation diagnostics

Run these queries read-only in Supabase SQL Editor before attempting any historical repair. They return candidate discrepancies only; do not auto-delete or recreate records.

## 1. Purchases with missing or soft-deleted linked expenses

```sql
select fp.id as purchase_id, fp.user_id, fp.expense_id, fp.status as purchase_status,
       e.deleted_at as expense_deleted_at, fp.total_amount as purchase_total,
       e.total_amount as expense_total
from public.feed_purchases fp
left join public.expenses e
  on e.id = fp.expense_id and e.user_id = fp.user_id
where fp.expense_id is null
   or e.id is null
   or e.deleted_at is not null
order by fp.created_at desc;
```

## 2. Purchase / expense amount mismatches

```sql
select fp.id as purchase_id, fp.user_id, fp.expense_id,
       fp.total_amount as purchase_total, e.total_amount as expense_total,
       fp.total_amount - e.total_amount as difference
from public.feed_purchases fp
join public.expenses e on e.id = fp.expense_id and e.user_id = fp.user_id
where fp.total_amount is distinct from e.total_amount
order by fp.created_at desc;
```

## 3. Missing or duplicate original stock-in movements

```sql
select fp.id as purchase_id, fp.user_id, fp.feed_item_id, fp.status,
       count(m.id) filter (where m.movement_type = 'PURCHASE') as original_stock_in_count
from public.feed_purchases fp
left join public.feed_inventory_movements m
  on m.user_id = fp.user_id
 and m.source_type = 'FEED_PURCHASE'
 and m.source_id = fp.id
group by fp.id, fp.user_id, fp.feed_item_id, fp.status
having count(m.id) filter (where m.movement_type = 'PURCHASE') <> 1
order by fp.created_at desc;
```

## 4. Candidate orphaned feed-generated expenses

The current schema's authoritative relationship is `feed_purchases.expense_id`. If that relationship was lost, an expense cannot be proven to originate from a feed purchase using description text alone. This query only lists candidates for manual review; the description match is not authoritative.

```sql
select e.id as expense_id, e.user_id, e.business_date, e.description,
       e.total_amount, e.paid_amount, e.pending_amount, e.deleted_at
from public.expenses e
where e.deleted_at is null
  and lower(coalesce(e.description, '')) like '%purchase%'
  and not exists (
    select 1 from public.feed_purchases fp
    where fp.user_id = e.user_id and fp.expense_id = e.id
  )
order by e.business_date desc;
```

## 5. Payment ledger versus expense balance

```sql
select e.id as expense_id, e.user_id, e.total_amount, e.paid_amount,
       e.pending_amount,
       coalesce(sum(ep.amount), 0) as dated_payment_total,
       greatest(e.paid_amount - coalesce(sum(ep.amount), 0), 0) as legacy_undated_paid_amount,
       (coalesce(sum(ep.amount), 0) > e.paid_amount) as ledger_exceeds_paid,
       (e.pending_amount is distinct from (e.total_amount - e.paid_amount)) as pending_mismatch
from public.expenses e
left join public.expense_payments ep
  on ep.user_id = e.user_id and ep.expense_id = e.id
group by e.id, e.user_id, e.total_amount, e.paid_amount, e.pending_amount
having coalesce(sum(ep.amount), 0) > e.paid_amount
    or e.pending_amount is distinct from (e.total_amount - e.paid_amount)
order by e.created_at desc;
```

## Deployment caution

The integrity migration intentionally aborts if duplicate purchase expense links or duplicate original stock-in movements already exist. Run diagnostics first and review each discrepancy. Do not repair historical financial or inventory records without an explicitly reviewed mapping and a separately approved repair script.
