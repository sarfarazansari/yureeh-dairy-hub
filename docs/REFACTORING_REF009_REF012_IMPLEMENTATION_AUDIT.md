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
- Feed-item create/update/activation writes were moved from the page into mutation hooks with dependent inventory, purchase, consumption, diet-plan, feed-cost, dashboard and report invalidation.
- Feeding schedule settings and recent run history now use a query hook; schedule save and explicit FAILED-only retry use mutation hooks. No browser timer or automatic retry was introduced.
- Successful feed mutations invalidate their affected stock, archive, plan, expense/vendor, dashboard and report query families; failed mutations do not trigger success invalidation.

### Expenses and lifecycle/payment cache dependencies
- Added a typed expense-detail query and moved `record_expense_payment` behind a mutation hook without changing RPC arguments or adding automatic retry.
- Added query-backed expense dashboard, history/archive and new-expense reference reads.
- Expense create/update/soft-delete, category CRUD and vendor CRUD writes now use mutation hooks. The category bootstrap/authentication effect remains separate, while list reads are query-owned.
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

1. **Expense module:** query/mutation boundaries now cover history/archive, new-expense references, category/vendor directories and create/update/soft-delete/payment writes. Remaining review: category-seeding behavior under concurrent initialization, edit/delete locks, and mutation invalidation against live data.
2. **Feed scheduler:** settings/run-history and save/explicit retry boundaries are migrated, but scheduled-post verification, run snapshot invariants, uniqueness, atomic posting and FAILED-only retry must still be verified against a disposable Supabase database.
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


## Final continuation pass — 2026-10-16 — current execution branch

**Branch:** `feature/feature-folder-structure-foundation`  
**Review mode:** remote source read-back/static analysis; no local checkout, browser session or database session available.

### Findings fixed in this pass

1. Customer create/profile update could leave milk-entry customer selectors stale. Successful create/update now invalidates the milk query root. Customer payment keys use the customer feature's canonical key factory.
2. Buffalo lifecycle/acquisition mutations refreshed buffalo/production/report views but did not refresh diet-plan eligible-animal choices or buffalo-linked expense option queries. The shared buffalo mutation invalidation now covers `['diet-plans']` and `['expenses']`.
3. The buffalo acquisition-cost panel performed its own Supabase reads and RPC write with literal query keys. Query keys are now feature-owned; data access is in `buffalo.service.ts`; query/mutation hooks are in `use-buffaloes.ts`; the panel keeps only form/local UI state. The existing `record_buffalo_acquisition_cost` RPC boundary is unchanged.
4. Successful explicit diet-feeding-run retry refreshed only run history. It now refreshes consumption, inventory, feed-cost analytics, financial reports and dashboard after the RPC succeeds. Saving schedule times still invalidates only schedule/run data.
5. The browser QueryClient had no identity-transition cleanup. QueryProvider now clears cached queries when the authenticated user ID changes; same-user token refreshes do not clear the cache.
6. Canonical type/helper migrations remain feature-owned; old `src/lib/*-types`, milk-entry-list and milk-entry-validation paths that were migrated are re-export-only compatibility facades rather than competing definitions. They are intentionally not deleted without reliable full-branch consumer/typecheck evidence.

### Remaining architecture/security findings and limits

- The repository-wide invalidation matrix is materially improved but must be verified by exercising each mutation and checking its real active query consumers; static invalidation alone cannot prove data freshness.
- The complete consumer graph for every compatibility facade cannot be compiler-confirmed in this environment. Retain facades until a local branch-wide search/typecheck confirms there are no remaining imports, then remove unused facades in a separate safe cleanup.
- Existing transaction-integrity audit requirements remain: concurrent/idempotent payment checks; milk production/delivery reversal and balance reconciliation; feed purchase → linked expense → stock-in exactly once; consumption reversal/cost stability; scheduler overlap/FAILED-only retry/atomic posting; report-to-ledger reconciliation.
- Supabase security is only statically reviewed from migration source. Deployed migration parity, current RLS/grants/function owners/triggers, cross-farm direct table/RPC access and actual concurrency behavior have not been verified against the database.
- No local TypeScript check, lint, format check, Next build, browser workflow, unit/integration test, SQL/RLS test, account-switch test or production-data reconciliation ran. Do not mark REF-012 fully completed or merge-ready on this evidence alone.

### Updated status

The **static audit pass** for query invalidation, buffalo/customer/expense/feed architecture and current type/helper boundaries is recorded and fixes are committed on the requested branch. REF-012 remains blocked on executable validation and complete compiler-backed facade-consumer verification. No PR, merge, migration or production-data change was performed.

Branch comparison at the time of this audit showed the working branch based on current `master` with zero commits behind; its ahead count reflects connector-generated per-file commits and is not a quality/verification signal.

### Required next validation

Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`; then perform account-switch cache isolation and the disposable Supabase RPC/RLS/concurrency/reconciliation scenarios in `docs/REFACTORING_TRANSACTION_INTEGRITY_AUDIT.md` and `docs/REFACTORING_IMPLEMENTATION_ROADMAP.md`. No check should be marked passed unless executed.


Additional final-pass fixes: feed purchase mutations now invalidate expense-category summaries and feed-cost analytics alongside linked expense, vendor, inventory and report roots. Diet-plan save now invalidates scheduler/run-history data so the joined plan name cannot remain stale after a plan edit. Both changes are static-only pending mutation workflow checks.
