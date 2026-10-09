# Feed Inventory UI — Phase 6

## Scope

- Add `/feeds/inventory` as the dedicated current-stock and movement-history screen.
- Show every feed master, including items that have never had a movement and therefore have zero stock.
- Calculate current quantity, stock value, and weighted average cost from `feed_inventory_movements`; the ledger remains the source of truth.
- Configure a low-stock threshold per feed item in the existing create/edit form. Thresholds use the item's base unit; zero disables low-stock alerts.
- Show low-stock and out-of-stock counts and status indicators.
- Provide server-side paginated movement history with date, feed item, and movement-type filters.
- Keep the movement ledger read-only in this UI. Posted movement corrections continue to use the existing purchase/consumption correction workflows.

## Migration

Apply `supabase/migrations/20261009160000_feed_inventory_ui.sql` in development before using the new inventory screen.

## Manual verification

1. Run `npm run build` and the repository lint command.
2. Apply the migration and confirm it succeeds against the current database.
3. Open Feed Inventory and verify every feed master appears, including an item with no purchases (quantity/value should be zero and average cost should be blank).
4. Record a purchase; verify stock quantity, stock value, average cost, and movement history update.
5. Record consumption; verify stock and stock value decrease and the outbound movement appears with negative quantity/value.
6. Verify purchase/consumption reversals and corrections are represented as ledger movements and are not editable from the inventory history table.
7. Set a low-stock threshold in Feed Items, save, and verify the indicator appears when stock is at/below the threshold; set threshold to zero and verify low-stock alert is disabled.
8. Verify out-of-stock indicators, search, stock-status filters, movement date filters, feed/type filters, and pagination.
9. Confirm feed-item and movement visibility is restricted to the signed-in farm.
10. Regression-test Feed Master, Feed Purchase, Feed Consumption, Diet Plan schedule/run history, Expenses, Buffalo, and Financial Reports.

## Important accounting note

This page reports the current weighted-average inventory value from the existing movement ledger. It is not a full financial statement. Feed consumption cost and the existing financial report should be reconciled during Phase 7.
