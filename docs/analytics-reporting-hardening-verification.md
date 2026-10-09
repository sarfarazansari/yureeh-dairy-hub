# Analytics & Reporting Hardening — Verification

## Changes in this phase

- Sales analytics totals and grouped results are aggregated in PostgreSQL through `get_sales_analytics_summary`.
- Customer filtering applies to sales KPIs, daily chart, shifts, pricing split, and customer contribution.
- Farm revenue, expenses, farm production, and farm milk sold remain farm-wide regardless of the customer filter.
- The expense total excludes costs linked as capitalized buffalo acquisition costs, matching the financial summary's operating-expense basis.
- Reversed date ranges are rejected before the analytics request.
- The operating-summary note explains that feed inventory consumption valuation is not used and that the view is not net profit.

## Local checks

Run on the feature branch:

- [ ] `npm run build`
- [ ] `npm run lint`
- [ ] `npm run format:check`
- [ ] Apply migrations using the normal project workflow; confirm `20261009190000_sales_analytics_aggregation.sql` applies successfully.

## UI verification

- [ ] Today with no sales: KPIs show zero, weighted fat shows a dash, daily chart is empty, shift/pricing rows show zero.
- [ ] A range with data: compare milk quantity, revenue, weighted fat, entry count, daily totals, shift totals, customer totals, and pricing totals against the milk-entry archive for the same range.
- [ ] Select one customer: sales KPIs and grouped sales data contain only that customer's records.
- [ ] With a customer selected, confirm farm operating revenue, expenses, farm production, and farm milk sold remain farm-wide.
- [ ] Compare expense total with the financial report for the same date range, including an expense partly linked to buffalo acquisition costs.
- [ ] Try a custom range where the start date is after the end date: show a validation message and no stale analytics values.
- [ ] Test a large date range with more raw records than the configured PostgREST row limit; totals and grouped analytics should remain complete.
- [ ] Test loading, empty, RPC error, and customer-list error states.
- [ ] Confirm user/farm isolation by verifying an authenticated user cannot retrieve another farm's summary or pass another farm's customer ID.

## Important reporting definition

This page's operating summary is revenue minus recorded operating expenses by expense date, excluding costs capitalized to buffalo assets. It does not use feed inventory consumption valuation, so it must not be presented as net profit or a consumption-costed margin.

## Verification boundary

The implementation was statically reviewed in GitHub. Build, lint, formatting, migration application, and live Supabase/UI checks have not been run in this environment; complete the local checklist before opening a PR.
