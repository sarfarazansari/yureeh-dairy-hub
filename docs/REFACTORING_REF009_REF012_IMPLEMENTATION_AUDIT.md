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


### Duplicate helper/formula consolidation

- `src/features/expenses/utils/expense-format.ts` now re-exports shared `money` from `src/lib/farm-format.ts` and aliases canonical `todayDateKey` as the existing `todayLocal` API; duplicate implementations were removed without changing consumer import names.
- Milk-entry list `localDateKey` now delegates date normalization to `src/lib/date-key.ts`, and `isValidBusinessDate` delegates calendar validation to `isValidDateKey`. Day.js remains for date presets/range arithmetic.
- Buffalo purchase validation now reuses `getBuffaloPaymentType` from the buffalo feature rather than maintaining a second payment-type formula.
- Payment-method string unions remain domain-owned for buffalo/customer until their database constraints and business semantics are compared; identical current literals alone are not enough to merge them.
- Re-export-only compatibility facades remain in place for old type/schema/list import paths until a branch-wide compiler-backed consumer audit proves safe removal.


## Final architecture/query/security regression pass — 2026-10-18

**Branch:** `feature/final-architecture-query-security-audit`  
**Starting master commit:** `a7d068ee78c400a21a555c1cadf93d4a572730ab`  
**Method:** GitHub source/migration inspection; the complete recursive tree contained 359 tracked paths, 170 TS/TSX files under `src/`, and 60 SQL migrations. No local repository checkout or live/disposable Supabase connection was available.

### Implemented on this branch

- `src/features/expenses/expense.queries.ts`: expense payment success now invalidates the feed inventory and feed-cost analytics query roots, in addition to existing expense, vendor/category, purchase, finance, and dashboard roots. Expense creation now also invalidates feed-cost analytics. Rationale: payment/category/cost-related expense changes must refresh the inventory-cost-derived/report surfaces rather than leave a prior cache entry displayed.

### Mutation-to-query dependency matrix (static mapping)

| Mutation family | Successful invalidation observed | Status / caveat |
|---|---|---|
| Milk entry create/update/delete | milk root; customer directory/detail descendants; sales analytics; financial reports; dashboard | Covered in source; database transaction/RPC behavior not runtime-tested. |
| Manual milk-pool movement | milk root | Appropriate for pool/reconciliation paths; validate all pool consumers with runtime smoke tests. |
| Buffalo production save | production root; milk root; dashboard; sales analytics; financial reports | Buffalo detail history now uses the canonical production history key factory, so production-root invalidation covers it. |
| Customer create/update/pricing/active/payment | customer root or directory/detail; milk root for selector/pricing/master changes; reports/dashboard for financial mutations | Covered for inspected hooks. Customer payment/payment-form retry is not idempotency-keyed; do not blindly retry ambiguous network outcomes. |
| Buffalo purchase/profile/vendor/status/payment/sale/disposal | buffalo and production roots; diet-plan eligibility; expenses; reports/dashboard | Shared helper covers inspected lifecycle mutation paths. Acquisition cost has targeted buffalo/acquisition/expense/report/dashboard invalidation. |
| Expense create | expense, vendor/category, feed purchase/inventory, buffalo option, feed-cost analytics, finance/dashboard | Updated in this branch to include feed-cost analytics. Direct table operation remains subject to RLS/database constraints; no RPC/database runtime test. |
| Expense update/soft-delete | expense, category/vendor, feed-item/purchase/consumption/diet-plan, reports/dashboard; buffalo root | Feed-cost invalidation was not present in the current helper; evaluate whether editable/deleted expense records can influence feed cost in the live domain before broadening further. Existing lock checks are in the UI and need DB bypass/concurrency verification. |
| Expense payment | expense, vendor/category, feed purchase/inventory, feed-cost analytics, reports/dashboard | Updated in this branch to include feed inventory and feed-cost roots. No automatic retry added. |
| Expense category/vendor CRUD | expense plus related feed master/purchase/consumption/diet-plan, reports/dashboard | Covered for inspected hooks; category seeding intentionally remains a separate external setup effect and needs concurrent-init validation. |
| Feed item create/update/activation | feed item, inventory, purchase, consumption, diet plan, feed-cost analytics, reports/dashboard | Covered by mutation helper; write RLS/unique-name behavior not runtime-tested. |
| Feed purchase create/edit/delete | purchase archive/detail, inventory, expenses, vendor/category summaries, feed-cost analytics, reports/dashboard | Covered; request-key lifecycle and ledger constraints still need disposable database checks. |
| Feed consumption create/edit/delete | consumption archive/detail, inventory, diet plans, feed-cost analytics, reports/dashboard | Covered; RPC-only ledger writes and reversals preserved; no DB concurrency tests run. |
| Diet plan create/update | plan root, scheduler/run history, feed-item selectors | Covered in source; no schedule posting implied by plan save. |
| Schedule setting save | schedule/settings and run history | Covered; schedule save should not change stock. |
| Explicit failed-run retry | scheduler/run history, consumption/inventory, feed-cost analytics, reports/dashboard | Covered in source; scheduler atomicity, uniqueness and FAILED-only transition remain database/runtime checks. |

The matrix documents source-level paths observed, not proof that every read has an active TanStack Query consumer. Some effect-driven/legacy screens and direct data calls remain part of REF-011B/REF-012's pending consumer audit.

### Confirmed residual findings and severity

- **P1 — Executable verification unavailable:** no local `node_modules`, local checkout, browser session, or Supabase test connection was available through the GitHub source connector. Typecheck, ESLint, Prettier, Next build, browser workflows, auth/account switch and concurrency/RLS tests are therefore not claimed as passed.
- **P1 — Direct table expense writes require DB-path validation:** create/update/soft-delete use authenticated Supabase table operations, with current RLS and UI lock checks as protections. Static source inspection cannot demonstrate that a malicious/direct client cannot alter ledger-locked rows; review all later expense-locking triggers/policies and test bypass attempts in disposable DB before declaring the security acceptance criterion complete.
- **P1 — Payment retry/idempotency:** customer, expense and buffalo payment RPC call signatures do not visibly carry request idempotency keys in the inspected clients. Do not configure automatic mutation retries or blindly resubmit after an ambiguous timeout; reconcile server state first. Consider an explicit idempotency policy as a separately designed change, not a casual client-only patch.
- **P2 — Helper/type consumer audit remains static:** feature-owned types and re-export compatibility facades exist after REF-013. A compiler-backed import/unused-export/circular-dependency audit still needs local TypeScript/lint execution. Legacy compatibility files should not be deleted until all current consumers and external import contracts are confirmed.
- **P2 — Aggregation/pagination:** expense history uses a server-side ranged query with exact count and server-side filters; customer/vendor directory sums now use aggregation RPCs. Customer detail still returns up to 500 milk entries, and the expense dashboard's open-items query is capped at 500. Verify whether detail pagination and aggregate-backed dashboard summaries are required for actual farm volume; do not silently claim all reporting is fully unbounded.
- **P2 — Cache identity lifecycle:** QueryProvider clears cache on observed user-ID transitions, but the first session event, same-user multi-farm context (if introduced), and mounted requests resolving across an auth transition still need runtime tests. A query cache clear is not a substitute for database RLS/ownership checks.

### Security/migration source review

Inspected representative customer payment RLS/RPC migrations, expense RLS and reference-snapshot triggers, the diet scheduler RPC migration, feed-consumption cost/reversal hardening, and customer/vendor aggregation RPC migration. The inspected functions generally use authenticated ownership checks/RLS and explicit function grants; aggregation functions use `SECURITY INVOKER`. This is a representative source review, not an exhaustive deployed-schema audit: later migrations can replace earlier function bodies and remote applied migration state was unavailable. No schema or migration was changed/applied in this branch.

### Actual verification

- GitHub recursive tree: executed; not truncated (359 paths).
- GitHub source file read-back: executed for query/mutation modules, project rules, handoff, tracker, invalidation contract and selected migrations.
- New branch source read-back: executed after the expense invalidation edit.
- TypeScript / lint / format check / Next build / tests / browser / RLS / RPC concurrency: **not run** (local runtime/database unavailable).
- Production DB changes: none.
- PR/merge: none.

### Next required steps before REF-012 can be Completed

1. Fetch this branch locally and run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`; investigate and fix actual failures.
2. Run focused browser smoke tests for customer reassignment in milk entries, buffalo detail history refresh, feed purchase replay with a stable request key, expense payment invalidation, feed consumption correction/reversal, scheduler failed-run retry, and auth sign-out/account switch.
3. Against a disposable Supabase project, verify the latest migration chain, RLS access across two user accounts, direct mutation rejection for ledger-locked expenses, idempotent purchase replay, payment concurrency, feed-stock locking/reversal and scheduler uniqueness/atomic posting.
4. Finish the consumer scan of legacy re-export facades and remaining direct Supabase access before removing any files or marking REF-012/REF-013 complete.
