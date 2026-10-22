# Expense History PDF Export

Last updated: 2026-10-22

## Behavior

- The **Export PDF** action is on `/expenses/history`.
- The report follows the current Expense History filters: date range, search, category, category group, vendor, payment status, payment method, buffalo, outstanding-only, and sort direction/order.
- Export is independent of the visible page size and pagination. The export query fetches matching rows in 500-row chunks, so the report is not limited to the current page or an arbitrary 1,000-row client-side cap.
- The printable report opens in a separate browser tab/window and uses the browser's **Print / Save as PDF** action, matching the established Milk Entries export pattern.
- Report details include business date, category and group, vendor, description, quantity/unit, rate, total, paid, outstanding, payment status/method, and due date.
- The summary shows total expenses, total paid, total outstanding, and matching transaction count.
- Dates use the shared readable `formatDate` presentation helper. HTML values are escaped before insertion into the printable document.
- Pop-up blocking and query failures are surfaced to the user; a retry action is shown for export-query failures.

## Implementation

- `src/app/(protected)/expenses/history/page.tsx`: Export PDF button and printable report generation.
- `src/features/expenses/expense.queries.ts`: `useExpenseHistoryExportQuery`, applying the same filters as history and fetching all matching rows in 500-row batches.
- No database schema or Supabase migration change is required.

## Verification boundary

This change was implemented and read-back/static-reviewed through the GitHub connector. This environment does not provide the repository's local checkout or runtime, so typecheck, lint, formatting, build, browser printing, large-result export, and manual filter regression tests were not executed here. Do not describe the feature as runtime-tested until those checks pass locally.

## Manual acceptance checks

1. Export with no filters and confirm the report count matches Expense History's total matching count, not the current page row count.
2. Apply each filter (date range, search, category, group, vendor, status, payment method, buffalo, outstanding-only) and verify exported rows match the visible query criteria.
3. Test ascending and descending sort options.
4. Confirm total, paid, and outstanding summary amounts reconcile with the exported rows.
5. Test zero matching rows, a query failure/retry, and browser pop-up blocking.
6. Export more than 1,000 matching rows and confirm all rows are included across the 500-row batches.
7. Confirm dates are human-readable and special characters in descriptions/vendor/category names display as text rather than HTML.
8. Run the repository's typecheck, lint, format check, build, and browser/manual tests before merging.
