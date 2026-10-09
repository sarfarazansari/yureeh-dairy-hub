# Feed Inventory Integration & Hardening — Phase 7

## Findings addressed

- Feed consumption previously wrote `unit_cost = NULL`, so inventory quantity decreased but inventory value did not. New consumption records snapshot the current weighted-average inventory cost.
- Consumption creation now rejects quantities above current available stock in the database RPC, not only in the form.
- Consumption edit restores the old movement's quantity/value before validating and costing the replacement movement.
- Consumption edit/delete lock the feed master row while checking later activity and writing reversal movements, serializing those operations with the normal purchase/consumption flow.
- Existing consumption movements with missing costs are backfilled in ledger creation order when a historical weighted-average cost can be derived. Rows for which the ledger has no positive quantity or has a negative value emit a database warning and remain unresolved rather than inventing a cost.

## Financial-report boundary

Feed purchases continue to create the corresponding expense transaction. The financial reconciliation report includes that purchase expense by business date and supplier payments by payment date. Do not add the same feed consumption cost as another operating expense: doing so would double-count the purchase. Inventory value is a separate operational stock valuation, not an additional cash expense.

## Migration

Apply `supabase/migrations/20261009170000_feed_consumption_cost_hardening.sql` in development before testing this phase.

## Verification checklist

1. Run `npm run build` and the repository lint command.
2. Apply the migration and inspect migration logs for warnings about historical consumption rows whose costs could not be derived.
3. Create a purchase for a feed item and confirm one purchase, one linked expense, and one stock-in movement are created atomically.
4. Verify purchase quantity, stock value, and weighted-average cost in `/feeds/inventory`.
5. Consume part of that stock. Confirm the movement stores a non-null unit cost, stock quantity decreases, and stock value decreases by approximately quantity × applied unit cost.
6. Attempt to consume more than available stock, including two rapid submissions; the database must reject any over-consumption.
7. Edit a consumption without later inventory activity. Verify the original is retained, reversal movement restores its quantity/value, and the replacement consumption has an applied unit cost.
8. Delete a consumption without later inventory activity. Verify a reversal movement restores stock quantity and value.
9. Verify edit/delete is rejected when later inventory activity exists.
10. Check the inventory ledger for any remaining `CONSUMPTION` rows with `unit_cost IS NULL`. Investigate these as historical valuation exceptions; do not guess their cost.
11. Regression-test purchase payment status, expense history/detail and payments, diet plan consumption schedule/run history, Feed Master, Buffalo, and Financial Reconciliation.
12. Confirm one feed purchase is not counted twice in financial reports as both a purchase expense and a consumption expense.
13. Confirm users cannot read or change another farm's feed items, purchases, expenses, or movements.

## Verification boundary

This phase has been statically reviewed through the repository integration. The local build, lint, migration application, database behavior, and browser flows must still be verified in development before merging. Do not create a PR or merge until the user confirms testing.
