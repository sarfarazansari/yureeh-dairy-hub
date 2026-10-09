# Operations and Financial Integrity — Verification Checklist

Branch: `feature/operations-financial-reporting-audit`

## Milk pool: per-shift balance

1. Apply `20261009180000_operations_financial_integrity.sql` after all earlier migrations.
2. Enter morning production and verify morning deliveries can use only that morning's balance.
3. Enter evening production and verify evening deliveries use the evening balance independently.
4. Attempt a delivery above the shift balance; expect a database error and no saved milk entry or movement.
5. Submit two deliveries concurrently whose combined quantity exceeds the balance; only the transaction(s) within available stock should commit.
6. Edit a delivery upward, move it to another date/shift, and reduce its quantity. Verify the old movement is reversed and the new shift is validated atomically.
7. Attempt to reduce/delete production after deliveries have consumed the stock; expect the operation to be rejected if it would make that shift negative.
8. Record household use, wastage, and other outflows; verify these also cannot make a shift negative.
9. Verify each operation remains isolated to the authenticated farm and movement writes still go through controlled RPCs.

## Financial balances

1. Run the financial summary for a date range and verify existing period KPIs remain unchanged.
2. Verify current customer receivables/credits reflect all sales and payments through today.
3. Verify historical customer receivables/credits reflect sales through the report end date less payments received through that date.
4. Verify current supplier and buffalo purchase balances match the live ledgers.
5. Compare historical supplier/purchase balances with dated payment ledgers. Legacy undated paid amounts are surfaced separately and are not assigned invented historical dates.
6. Verify buffalo sale reports return both current outstanding and outstanding as of the report end date.
7. Capitalized acquisition costs linked to an expense should be excluded from operating-expense totals for that expense's business-date period; the underlying expense and its payment ledger must remain intact.

## Buffalo carrying value

1. Link an active expense already assigned to a buffalo as an acquisition cost (for example, eligible transportation/freight).
2. Verify the acquisition cost appears once in the buffalo detail and contributes to carrying value.
3. Record a sale above carrying value; verify positive gain is displayed.
4. Record a sale below carrying value; verify the loss magnitude is displayed and not mislabelled as a gain.
5. Record a disposal; verify carrying value and disposal loss are displayed.
6. Verify acquisition costs cannot be added after sale/disposal and cannot link an expense assigned to another buffalo.
7. Confirm no depreciation is applied; no depreciation policy has been specified.
8. Check legacy sale/disposal rows without an acquisition record and investigate any carrying values left null.

## Regression checks

- `npm run build`
- Run the repository lint/type-check command.
- Apply migrations to a development Supabase project and inspect the migration output.
- Verify expense totals, expense payments, buffalo purchase payments, buffalo sale payments, feed purchase/consumption inventory valuation, and existing milk-pool reconciliation.
- Confirm no feed consumption cost is counted as a second cash expense.

## Verification boundary

This change was committed through GitHub's repository integration and reviewed statically. A local build, lint, migration application, and live database/browser tests have **not** been run in this environment. The user should run these checks locally before raising a PR. Do not create or merge a PR on the user's behalf.
