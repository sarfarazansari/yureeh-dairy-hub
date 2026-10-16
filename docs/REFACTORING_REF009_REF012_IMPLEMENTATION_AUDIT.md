# REF-009 through REF-012 — Implementation Audit and Handoff

Date: 2026-10-16  
Branch: `feature/refactor-engineering-standards`  
Base target: `master`  
Status: **In progress — not merge-ready until the remaining phases and validation are completed**

## Implemented in this session

### Shared types and query infrastructure
- Added `src/lib/milk-domain.ts` as the canonical owner for milk pricing and shift unions; existing imports from `src/lib/analytics.ts` remain compatible through type re-exports.
- Added `src/features/milk/milk.types.ts` as the canonical mixed milk-pool fat record.
- Removed duplicate `MilkPoolShiftFatRecord` declarations in the milk-pool and buffalo-production domains.
- Reused the customer feature's `CustomerOption` shape for the identical dashboard customer projection.
- Added dedicated dashboard, sales analytics and financial report query boundaries with keys containing the date/filter inputs.
- Replaced effect-driven remote reads on the farm dashboard, sales analytics page, buffalo analytics page, financial report page and expense dashboard with TanStack Query reads (the expense dashboard retains a separate effect only for its existing category-seeding side effect).

### Feed master, inventory, purchases, consumption and diet plans
- Added typed paginated query boundaries for feed master, inventory stock/movement history, purchase archive, consumption archive and diet-plan archive.
- Query keys include page, page size and active filters; inventory stock remains read from the ledger-derived stock view and movement history remains server-paginated.
- Moved purchase create/edit/delete and consumption create/edit/delete RPC calls behind mutation hooks. The purchase creation request-key is still generated and retained by the page per unchanged form intent; no automatic mutation retry was added.
- Moved diet-plan save RPC invocation behind a mutation hook.
- Query-backed form references/details were added for purchase, consumption and diet-plan forms.
- Successful feed mutations invalidate their affected stock, archive, plan, expense/vendor, dashboard and report query families; failed mutations do not trigger success invalidation.

### Expenses and lifecycle/payment cache dependencies
- Added a typed expense-detail query and moved `record_expense_payment` behind a mutation hook without changing RPC arguments or adding automatic retry.
- Added a query-backed expense dashboard read boundary.
- Expanded successful milk-entry invalidation to refresh customer directory/detail descendants plus dashboard, sales analytics and financial-report queries.
- Expanded production-save invalidation to refresh dashboard, sales analytics and financial reports.
- Buffalo lifecycle/acquisition/sale/payment mutation hooks now also invalidate production eligibility/history and the dashboard/financial-report query families.
- Customer payment, pricing and activation paths invalidate the relevant customer/milk and report/dashboard families.

## Static verification performed

- Read back changed files through GitHub after each edit.
- Compared the working branch with `master`; the current branch contains the refactoring commits and no PR was created.
- Checked that migrated dashboard/analytics/report/inventory/archive/detail pages no longer contain the specific direct reads that were moved behind query boundaries.
- Reviewed the new query keys for date ranges, customer filters, page/page size and archive filters.
- Checked for the existence of a repository CI workflow and reported commit status. No `.github/workflows/ci.yml` was found and the latest commit has no reported status checks.

## Outstanding work — do not mark REF-012 Completed yet

The roadmap has not been fully completed. Remaining items include:

1. **Expense module:** history/archive, new-expense reference reads, categories and vendors still have page-owned Supabase access and need a dedicated query/service migration. The existing category-seeding behavior must remain intentional and idempotent.
2. **Feed scheduler:** scheduler settings/run-history reads and scheduled-post verification have not been fully migrated or tested. Preserve run snapshots, uniqueness, atomic posting and explicit FAILED-only retry.
3. **Buffalo/customer lifecycle:** audit remaining direct acquisition-cost UI access and verify sale/acquisition/payment flows; establish a common uncertain-payment reconciliation/idempotency policy only after reviewing existing RPC constraints.
4. **Canonical helpers:** date helper consolidation is intentionally unfinished until Asia/Kolkata business-date semantics and all consumers can be compared. Do not merge customer and buffalo payment method types without database constraint review.
5. **Invalidation completeness:** the new query roots are in place for the migrated paths, but a repository-wide mutation-to-consumer matrix still needs verification for every remaining expense, scheduler, buffalo and report write.
6. **Query lifecycle/security:** account/farm switch cache isolation has not been verified.
7. **REF-012 repository-wide audit:** direct data access, effect-driven reads, duplicated helpers/keys, unsafe retry configuration and approved ledger-writing RPC boundaries still need a final exhaustive scan after remaining migrations.

## Required validation before merge

No local checkout was available in this session, and the repository does not expose CI status checks for the latest commit. The following have **not** been run and must not be assumed to pass:

- TypeScript typecheck, ESLint, Prettier check, Next.js build.
- Unit/integration tests (the package scripts do not define a test command).
- Browser smoke tests for milk entry reassignment, production history refresh, feed purchase same-key replay, purchase/consumption edit/delete guards, scheduler retry and expense payment.
- Live/disposable Supabase RPC/RLS/constraint/concurrency checks and reconciliation queries.
- Auth/account-switch cache isolation checks.

Recommended local commands:
```sh
npm run lint
npm run format:check
npx tsc --noEmit
npm run build
```

Then run the targeted workflow tests listed in `docs/REFACTORING_IMPLEMENTATION_ROADMAP.md`. Do not merge based only on this static GitHub review.

## Merge/branch policy

No pull request or merge was created by this work. Continue on `feature/refactor-engineering-standards`. The user owns PR creation and merge. No database schema, migration, RPC, RLS policy or production data was changed.
