# Yureeh Dairy Hub — Engineering Rules and Handoff

Last updated: 2026-10-18

## Project context

Repository: https://github.com/sarfarazansari/yureeh-dairy-hub  
Default branch: `master`  
Current work branch at handoff: `feature/sec-001-database-integrity-audit`


Yureeh Dairy Hub is a practical dairy-farm operations app built with Next.js App Router, TypeScript, React, Supabase/PostgreSQL, RLS, React Hook Form, Zod, and TanStack Query.

## Non-negotiable workflow rules

1. **Always start new feature work from the latest `master`.** First inspect/fetch the latest master, then create a dedicated feature branch from master. Never base the next module's branch on an older feature branch.
2. The user owns raising and merging PRs. Do not raise, finalize, or merge a PR unless explicitly asked.
3. The user tests the working branch locally before PR. When they report issues, fix them on that same feature branch and ask them to retest. Do not merge on their behalf.
4. Before implementing a module, inspect the existing code and all relevant Supabase migrations. Treat migrations and database constraints as the source of truth for persistence behavior.
5. For audit-only requests, document findings first and do not change code until asked.
6. Make complete, production-safe data-flow changes, not UI-only patches. Use migrations for schema changes.
7. Prefer pragmatic, understandable designs over overengineering. Reuse established project patterns; keep components and files focused, concise, and readable.
8. Use appropriate schema validation, database constraints, transactional RPCs where atomicity matters, RLS/ownership checks, and TanStack Query invalidation.
9. Before handing work to the user, statically validate the full integration: route files, imports, component props, service and RPC signatures, migration ordering, foreign-key uniqueness requirements, RLS paths, enum/check compatibility, backfill safety, query keys/invalidation, and cross-module references.
10. Be explicit about verification boundaries. Do not claim tests were run unless they were actually run. GitHub inspection/static review is not equivalent to running the local app or applying migrations to the user's Supabase database.
11. Keep URLs based on immutable database IDs, not mutable business/display codes.
12. Do not invent domain facts. Ask only when an unknown decision materially affects correctness; otherwise use sensible, clearly stated assumptions.

## Domain modeling principles

Classify each real-world event correctly before deciding fields or screens:
- Master/reference data
- Transaction/acquisition
- Payment or payment ledger
- Inventory movement/consumption/adjustment
- Operational event or lifecycle history
- Derived report/analytics

Avoid treating every module as generic CRUD. Model the real workflow and preserve audit history where financial or lifecycle integrity matters.

## Current architecture and module notes

### Existing modules
- Dashboard and analytics: derived/reporting views.
- Buffalo management and acquisition/purchase.
- Buffalo milk production by buffalo + business date + shift.
- Milk sales/collection entries linked to customers, with historical applied pricing.
- Customers and customer rate history.
- Expenses, categories, and vendors.
- Authentication and user/farm isolation via RLS.

### Important data boundaries
- Buffalo purchase/acquisition is a transaction; the buffalo profile is master data.
- Purchase price and later acquisition-related costs such as freight are distinct concepts.
- Buffalo production is not the same thing as milk sold to customers.
- Expense payment totals/statuses must reconcile with recorded amounts.
- Inventory must be modeled through stock movements, consumption, and adjustments rather than merely adding stock fields to expenses.
- Legacy `buffalo_daily_performance` exists alongside normalized `buffalo_milk_production`; preserve and understand historical data before changing or removing it.

## Buffalo management work completed on `feature/buffalo-domain-audit`

Implemented work includes:
- Buffalo profile editing.
- Purchase transaction editing with safeguards against setting purchase price below amounts already paid.
- Vendor editing (vendor is a shared master; edits affect other records using that vendor).
- Buffalo purchase payment ledger and `record_buffalo_purchase_payment` RPC.
- Buffalo status/lifecycle history and `change_buffalo_status` RPC.
- Historical payment backfill without inventing installment splits; legacy initial payment method is recorded as `OTHER` when the original method was not captured.
- TanStack Query provider and buffalo hooks.
- Buffalo detail view for profile, purchase/vendor, payment history, status history, and production summary.
- Immutable-ID detail routing: `/buffaloes/[id]`, so changing a buffalo code does not break its URL.
- A fix to the Herd Overview Edit link so it uses `buffalo.id`, not `buffalo.buffalo_code`.

Relevant route:
`src/app/(protected)/buffaloes/[id]/page.tsx`

The detail route uses `useParams<{ id: string }>()` and passes the UUID to `BuffaloDetailPage`. The old `[code]` route was removed. The Herd Overview name and Edit links should both use `/buffaloes/${buffalo.id}`.

Latest known fix commit:
`72be8a5ce4c651b4996d67ae823e6b748a67dc01` — `fix(buffaloes): use immutable ID for edit link`.

The user reported the route works after checking local files, pulling the branch, and restarting the dev server. User will raise the PR and merge into master themselves. Do not create or merge a PR on their behalf.

## Next planned module: Milk Production deep-dive

Start with domain discovery, not immediate coding. Trace the full workflow:

**Buffalo → Milk Production → Farm Milk Pool → Milk Sales / Customer Delivery**

Inspect at minimum:
- `supabase/migrations/20261001130000_buffalo_shift_production.sql`
- `src/features/buffalo-production/BuffaloAnalyticsPage.tsx`
- `src/features/buffalo-production/DailyPerformancePage.tsx`
- `src/features/buffalo-production/services/buffalo-production.service.ts`
- All references to `buffalo_milk_production`
- `save_buffalo_milk_production` RPC and related migrations
- Legacy `buffalo_daily_performance` and migration/backfill logic
- Milk sales/collection entries and their relationship (or lack of relationship) to production
- Dashboard and analytics dependencies

Determine how the real farm handles collected milk, household/customer deliveries, unsold milk, spoilage, and reconciliation before proposing a model. Decide whether the app needs individual-animal production only, a farm-level milk pool/inventory, or both as separate but reconcilable records. Do not assume that production automatically equals milk available for sale or milk sold.

First produce a module-level current-state map and gap analysis. Make changes only after the workflow and design are agreed or the user explicitly asks for implementation.

## Handoff prompt for a new conversation

Continue work on the Yureeh Dairy Hub repository: https://github.com/sarfarazansari/yureeh-dairy-hub.

Read `docs/WORKFLOW_AND_HANDOFF.md` and `YUREEH_PROJECT_RULES.md` first, then inspect the latest repository state. The user is handling the PR and merge for `feature/buffalo-domain-audit` themselves. Do not raise or merge a PR.

Before starting new work, use the latest `master` as the base and create a fresh feature branch from it; never branch the next module from the previous feature branch. The next task is a deep audit of Milk Production and its real-world flow into farm milk pool and milk sales/customer delivery. Inspect migrations and all relevant code first, map the current implementation, and identify domain gaps before editing. Follow the engineering and testing rules in this document. Be transparent about which checks are static versus actually executed.


## Refactoring workflow (permanent)

Read these documents at the start of every refactoring session, in this order:
1. `YUREEH_PROJECT_RULES.md`
2. `docs/WORKFLOW_AND_HANDOFF.md`
3. `docs/REFACTORING_ARCHITECTURE.md`
4. `docs/REFACTORING_TASKS.md`

### Single-command continuation

The user's short command `1 refactor karo` means:
- Inspect latest remote `master`; create a fresh feature branch from it, never from an old feature branch.
- Select the highest-priority Pending task whose dependencies are Completed.
- Inspect all relevant source, migrations, RPCs, RLS and downstream consumers before changing code.
- Complete one coherent task, run relevant checks, and update the task tracker with evidence.
- Record branch, changed files, checks, limitations, blockers and next task in the tracker/handoff.
- Do not ask the user to repeat established requirements.
- Do not create a PR or merge; the user owns those actions.
- Do not claim local tests/builds or remote database operations that were not actually run.

### Current refactoring state

- Working branch: `feature/refactor-engineering-standards` (continue on this same branch when the user says `1 refactor karo`).
- Architecture standard: `docs/REFACTORING_ARCHITECTURE.md`
- Task tracker: `docs/REFACTORING_TASKS.md`
- Completed source inventory: `docs/REFACTORING_API_INVENTORY.md`
- Completed query/state audit: `docs/REFACTORING_QUERY_STATE_AUDIT.md`
- Completed module/dependency/type audit: `docs/REFACTORING_MODULE_BOUNDARIES_AUDIT.md`
- `REF-001` through `REF-004` are Completed. REF-002–REF-004 are documented static audits; no source implementation refactor has started.
- Next task: `REF-005` — audit server-state fetching and effects, and define a safe migration pattern for effect-driven remote reads.
- Latest `master` base verified before REF-004: `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9`. Branch was 7 commits ahead and 0 behind before REF-004 changes; REF-004 added documentation commits on this same branch.
- Query/state findings: milk-entry mutations miss customer-summary/detail invalidation; buffalo production history has duplicate query-key ownership and production save misses the buffalo-detail history key; acquisition-cost UI owns direct query/mutation logic; auth-cache lifecycle needs validation.
- Module/type findings: duplicate `MilkPoolShiftFatRecord` definitions; `CustomerOption` overlaps `DashboardCustomer`; shift/pricing literals have inconsistent ownership; feed services live under route folders while types are in `src/lib`; expenses shared helpers mix UI, date/currency helpers and category seeding.
- Transaction-critical audit REF-007 remains mandatory before moving feed/milk/expense service boundaries or consolidating domain types that depend on DB constraints.
- No local checkout was available; build, lint, typecheck, tests, runtime flows and database/RLS checks have not been run.
- Do not begin implementation migrations until REF-005 through REF-008 audits and the ordered phase plan are complete.


### Previous session handoff — 2026-10-16 (REF-004)

- Current branch: `feature/refactor-engineering-standards`
- Latest master base: `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9`; before this task branch comparison showed 7 commits ahead and 0 behind.
- Completed: `REF-004`, documented at `docs/REFACTORING_MODULE_BOUNDARIES_AUDIT.md`; tracker updated in `docs/REFACTORING_TASKS.md`.
- The audit maps buffalo lifecycle/finance, production, customers, milk/pool, analytics/dashboard, expenses, feed master/purchases/consumption/inventory/diet plans, and financial reports. It documents dependency edges and shared type/helper ownership.
- Highest-confidence consolidation candidates: `MilkPoolShiftFatRecord` is declared independently in production and milk-pool modules; `DashboardCustomer` overlaps customer `CustomerOption`; shift/pricing literal unions and import direction need canonical ownership. Do not merge customer/buffalo payment method types without DB-constraint/domain review.
- Boundary findings: feed services are under `src/app/(protected)/feeds/*` while their types are in `src/lib/*-types.ts`; milk list/service/schema responsibilities are spread between `src/lib` and the milk feature; expenses `shared.tsx` mixes UI, date/currency helpers and default category seeding.
- Next task for `1 refactor karo same branch`: `REF-005` — audit effect-driven remote reads and define a migration pattern. Continue on this branch, read the four required docs, and preserve valid auth/UI effects. Do not implement type moves before REF-007 verifies transaction/RPC/RLS/report dependencies.
- Verification boundary: GitHub source reads and branch comparison only. No local build, lint, typecheck, tests, runtime flows or database operations were run. No PR or merge was created.


### Previous session handoff — 2026-10-16 (REF-005)

- Current branch: `feature/refactor-engineering-standards`
- Latest master base: `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9`; branch comparison before this task was 10 commits ahead and 0 behind. The branch remains the user's requested working branch; no new branch was created.
- Completed: REF-005, documented in `docs/REFACTORING_EFFECTS_AUDIT.md`; task tracker updated.
- Audit findings: dashboard, sales/production analytics, financial reports, expenses and feed inventory/purchase/consumption/diet-plan pages contain effect-driven server reads that are candidates for TanStack Query. Preserve auth subscriptions, timers, date-picker and form/dialog synchronization, and local pagination corrections unless an equivalent replacement is proven.
- Migration design: service → feature query-key/query-options/hook → page; keys include all result-changing inputs; local UI/form state stays local; explicit loading/error/empty states; dependent reads use `enabled`; no blind retries for non-idempotent financial/inventory/scheduler mutations; validate auth cache lifecycle on account changes.
- No source implementation or database files changed. This remains an audit-first workflow: do not start implementation migrations until REF-006, REF-007 and REF-008 are complete, especially the transaction-integrity audit.
- Verification boundary: GitHub source/doc inspection and static synthesis only. No local checkout; build, lint, typecheck, tests, runtime/account-switch checks and database/RLS operations were not run. No PR or merge was created.
- Next task for `1 refactor karo same branch`: REF-006 — mutation invalidation, duplicate-submission, error/loading/empty-state and pagination audit.


### Latest session handoff — 2026-10-16 (REF-006)

- Current branch: `feature/refactor-engineering-standards`
- Latest master base: `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9`; branch was 13 commits ahead and 0 behind before REF-006.
- Completed: REF-006 static audit documented in `docs/REFACTORING_MUTATION_UX_AUDIT.md`; tracker updated.
- Confirmed query-cache gaps: milk-entry create/update/delete invalidates the milk root but not customer directory/detail summaries; production save invalidates production/milk roots but not the separate buffalo-detail production-history key.
- Existing safeguards worth preserving: feed purchase create uses an idempotency-key RPC; feed consumption operations are RPC-backed; expense history has ledger/feed-purchase lock checks, busy/error/retry states and URL-backed server pagination; scheduler failed-run retry is explicit and guarded.
- The audit records a cross-domain invalidation checklist, pagination requirements, duplicate-submit/retry policy and per-module regression checklist. Full dependency mapping remains pending REF-007; do not implement broad invalidation changes before that audit and REF-008 phase planning.
- Verification boundary: static GitHub file inspection only. No local checkout; build, lint, typecheck, tests, browser/manual regression, concurrency, RPC/RLS and database checks were not run. No source implementation or database changes; no PR or merge created.
- Next task for `1 refactor karo same branch`: REF-007 — trace finance, milk pool, feed inventory, purchase/payment and consumption transaction integrity end-to-end.


### Latest session handoff — 2026-10-16 (REF-007 + REF-008)

- Current branch: `feature/refactor-engineering-standards`. Continue on this same branch as explicitly requested; do not create a PR or merge.
- Completed static transaction audit: `docs/REFACTORING_TRANSACTION_INTEGRITY_AUDIT.md`. It maps milk production/delivery/pool, customer payments, feed purchase→expense→stock, consumption costing/reversals, diet scheduler, buffalo lifecycle/payments and financial reports to the inspected services/RPCs/migrations.
- Completed final implementation roadmap: `docs/REFACTORING_IMPLEMENTATION_ROADMAP.md`. The first implementation task is REF-009 (canonical query keys and targeted cross-feature invalidation). Later work is ordered by transaction risk and dependency: canonical types/helpers, read-only analytics/reports, feed inventory/master, expenses/payments, feed purchases, feed consumption, diet scheduler, then buffalo/customer payment boundaries and final regression.
- Confirmed gaps to fix in REF-009: milk mutations do not refresh customer directory/detail summaries; production save does not refresh the separate buffalo-detail production-history key. Avoid global cache invalidation.
- Integrity invariants to preserve: PostgreSQL RPC atomicity and RLS; append-only milk-pool/feed inventory ledgers with reversals; feed-purchase idempotency and linked expense/stock integrity; consumption applied-cost snapshots and later-movement locks; dated payment ledgers/legacy undated balances; scheduler snapshots and explicit retry. Payment RPCs without request idempotency keys require a deliberate common retry policy; never add blind automatic retries.
- Latest master base previously verified: `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9`. Verify branch-vs-master comparison after this documentation update before reporting current ahead/behind counts.
- Validation boundary: remote GitHub file/migration inspection only. No local checkout; build, lint, typecheck, tests, live database/RLS checks, SQL execution, concurrency tests, scheduler/cron verification and production data reconciliation were not run. No application source or database objects changed.
- Next task for `1 refactor karo same branch`: REF-009 — standardize query-key ownership and targeted cross-feature invalidation, starting with the two confirmed cache gaps.


### Latest session handoff — 2026-10-16 (REF-009 implementation)

- Continue on the same branch: `feature/refactor-engineering-standards`. No PR or merge was created.
- REF-009 source implementation is committed, but task status remains In Progress until local validation. Read `docs/QUERY_INVALIDATION_CONTRACT.md` for ownership and invalidation rules.
- Changes: added `src/features/customers/customer.query-keys.ts` and `src/features/buffalo-production/buffalo-production.query-keys.ts`; customer query hooks import/re-export the dedicated customer key factory; buffalo detail production history now uses `buffaloProductionQueryKeys.history`, the same key used by the production feature; milk entry create/update/delete invalidate milk queries plus customer directory and all customer detail/payment descendants. Manual pool movements invalidate milk only. Production save already invalidates the canonical production root, so the buffalo detail history refreshes through the shared key.
- No RPC, SQL, migration, RLS, financial ledger or retry behavior changed. No automatic mutation retries were introduced.
- Validation boundary: GitHub read-back/static checks only. No local checkout; typecheck, lint, build, tests, browser smoke tests and account-switch cache checks were not run.
- Required next local checks: typecheck/lint/build; milk entry create/update/delete, especially reassignment between customers; verify customer directory and both old/new customer detail summaries refresh; save production and verify buffalo detail history refresh; verify manual pool movement doesn't cause unnecessary customer refetch. Then mark REF-009 Completed and move to REF-010A or REF-010B.


---

## Latest handoff — 2026-10-16 (REF-009 through REF-012 batch)

- Working branch remains `feature/refactor-engineering-standards`. No PR or merge was created.
- Detailed coverage and unresolved work: `docs/REFACTORING_REF009_REF012_IMPLEMENTATION_AUDIT.md`.
- Implemented in this batch: canonical milk shift/pricing types and mixed-fat record; dashboard, sales analytics, buffalo analytics, financial-report and expense-dashboard query boundaries; feed master/inventory/purchase/consumption/diet-plan query boundaries; feed purchase/consumption/diet-plan mutation hooks; expense detail/payment query and mutation boundary; expanded milk/customer/buffalo/feed cache invalidation.
- Not complete: expense history/new/category/vendor route boundaries; scheduler settings/run-history/retry refactor and disposable DB validation; remaining buffalo acquisition-cost direct data access review; full mutation-to-consumer invalidation audit.
- Validation boundary: GitHub read-back/static review only. No local checkout; `npm run lint`, `npm run format:check`, `npx tsc --noEmit`, `npm run build`, automated tests, browser smoke tests, live/disposable Supabase RPC/RLS/concurrency checks and account-switch cache isolation were not run. No CI workflow/status checks were found for the latest branch commit.
- Tracker statuses are deliberately left In Progress/Blocked where the acceptance checks or implementation scope remain outstanding. Do not merge until remaining phases and local validation are complete.
- Branch comparison checkpoint reported 101 commits ahead / 2 behind `master`. During this batch, one query-key edit was briefly committed to the default branch after omitting the branch argument. A follow-up commit restored the default-branch file content, which was read back and verified. The two extra default-branch commits remain in history; no force reset was attempted. This is disclosed so the branch history divergence is not mistaken for an application change.
- No database migrations, RPC definitions, RLS policies or production data were changed.


### Additional source implementation — 2026-10-16

- Expense history is now read through a filter-keyed TanStack Query hook, including its category/vendor/buffalo options and related payment/feed-purchase lock checks.
- New-expense reference options use an owner-scoped query; expense create/update/soft-delete, category CRUD and vendor CRUD use mutation hooks with dependent query invalidation.
- Feed-item create/update/activation writes use mutation hooks.
- Feeding schedule settings and recent runs use a query hook; saving times and retrying a FAILED run use mutations. The page does not run a browser timer and retry remains explicit.
- These changes have been read back from the feature branch. They have not been locally typechecked, linted, built or tested because a local clone could not be obtained in this environment. REF-009 through REF-012 must not be marked complete until those checks and the remaining buffalo/report/ledger regressions are reviewed.


## Structural refactor handoff — 2026-10-16

- Latest master base verified: `1f291af036ff737049af3db51936a3d72234da29`.
- New working branch: `feature/feature-folder-structure-foundation` (created directly from latest master).
- User clarified that the previous refactoring changes did not visibly deliver the requested feature folder structure and store architecture. Treat that feedback as a scope correction: source-boundary migrations must be implemented, not merely documented.
- REF-013 was added to `docs/REFACTORING_TASKS.md` for incremental feature-owned folder boundaries and justified client-state stores.
- First structural slice: expense shell/date filter UI moved to `src/features/expenses/components/ExpenseNavigationShell.tsx`; expense category setup moved to `src/features/expenses/services/expense-setup.service.ts`; `money` and `todayLocal` moved to `src/features/expenses/utils/expense-format.ts`. `src/app/(protected)/expenses/shared.tsx` currently provides temporary compatibility re-exports so existing imports remain valid while routes are migrated incrementally.
- No Zustand store was added: the reviewed shared state is server-owned or page-local, and the architecture explicitly forbids duplicating server state in a store. Identify an actual cross-route client-owned state candidate before adding Zustand.
- Validation boundary: static extraction review only. Local typecheck, lint, build, tests and browser flows were not run from this environment. User must run these on the branch before merging.
- Next step: move expense route imports directly to feature-owned components/services/utils, then remove the compatibility module only when no imports remain; continue module-by-module after that.


## REF-013 update — 2026-10-16

- Branch: `feature/feature-folder-structure-foundation`, based directly on latest master `1f291af036ff737049af3db51936a3d72234da29`.
- Expense module structure is now implemented in source (not just documented):
  - `src/features/expenses/components/ExpenseNavigationShell.tsx` owns the expense shell and date filters.
  - `src/features/expenses/services/expense-setup.service.ts` owns the category-seeding Supabase operation.
  - `src/features/expenses/utils/expense-format.ts` owns currency formatting and local-date helpers.
  - All seven expense route pages now import these feature-owned modules directly.
  - Removed `src/app/(protected)/expenses/shared.tsx` after read-back confirmed the seven route pages no longer import it.
- Store: no Zustand store added in this slice. The app's remote data belongs in TanStack Query; only real cross-route client-owned state should enter a Zustand store. A later store decision must name the exact shared state and consumers, not add a generic store by convention.
- Verification: GitHub read-back confirmed imports and absence of legacy shared-module references in all seven expense routes. Local build/typecheck/lint/tests/browser checks were not run in this environment. Please run them locally before merge.
- Next task: continue REF-013 with the next high-value module boundary after this expense extraction, using the same incremental migration approach. Keep user responsible for PR/merge.


## REF-013 update — feed feature boundaries — 2026-10-16

- Continued on `feature/feature-folder-structure-foundation` (fresh branch from latest master).
- Moved feed-items service/query files to `src/features/feed-items` and feed-inventory service/query files to `src/features/feed-inventory`; consuming pages now import feature-owned query hooks. Removed their old route-owned service/query duplicates.
- Moved feed-purchases service/query/schema to `src/features/feed-purchases`; updated the purchase archive/new/edit routes and form to import those files, then removed old route-owned service/query/schema files.
- Moved feed-consumption service/query/schema to `src/features/feed-consumption`; updated archive/new/edit routes and form, then removed old route-owned files.
- Moved diet-plan service/query/schema and scheduler query hooks to `src/features/diet-plans`; updated plan archive/new/edit/schedule routes and form, then removed old route-owned files.
- Shared domain types in `src/lib/*-types.ts` intentionally remain shared until consumer analysis confirms a safe canonical owner.
- No Zustand store was introduced because the current candidate state is either server-owned (TanStack Query) or local to the UI component. Adding a store without cross-route client-state requirements would violate project rules. This is a documented decision, not a claim that store architecture work is fully complete.
- Static verification only: route import edits were checked against source files while migrating. Full repository import scan, typecheck, lint, build, tests and browser regression checks still need to be run locally before merge.
- Next: audit the remaining feed module component ownership, then buffalo/customer/milk shared types and service boundaries; only then finalize the app-wide folder architecture and remove duplicate types/helpers.


## REF-013 update — feed component ownership — 2026-10-16

- Moved all feed module UI components out of `src/app/(protected)/feeds/**/components` and into feature-owned component folders:
  - `src/features/feed-items/components/*`
  - `src/features/feed-inventory/components/*`
  - `src/features/feed-purchases/components/*`
  - `src/features/feed-consumption/components/*`
  - `src/features/diet-plans/components/*`
- Updated feed archive/new/edit routes to import feature-owned components, and adjusted moved components' dependencies to feature-owned services/schemas/utilities. Removed old route-owned component duplicates.
- Remaining routes stay under `src/app/(protected)/feeds` as routing entry points; business logic, query hooks, schemas and reusable module UI now belong under `src/features` for the migrated feed domains.
- Static checks only. Run local typecheck, lint, build, purchase/consumption/plan scheduler regression flows and browser smoke tests before merge.


## Developer check command — 2026-10-16

- Added `npm run typecheck` → `tsc --noEmit` to `package.json`. Use it alongside `npm run lint`, `npm run format:check`, and `npm run build` before merging the structural refactor.
- These commands were not run remotely by this session.


## Structural refactor handoff — 2026-10-16

- Active branch: `feature/feature-folder-structure-foundation` (user requested continuing on this same branch).
- REF-013 now includes feature-owned expense helpers/navigation, feed item/inventory/purchase/consumption/diet-plan components and service/query/schema boundaries, plus canonical customer domain types in `src/features/customers/types.ts`.
- Customer type consumers updated: `customer.service.ts`, `customer.queries.ts`, `CustomersPage.tsx`, `CustomerDetailPage.tsx`, and `src/features/milk/milk.queries.ts` (the cross-feature `CustomerOption` consumer). The customer directory RPC summary projection remains private to the service. Shared `PricingType` and `Shift` remain canonical in `src/lib/milk-domain.ts`.
- Store decision: no Zustand store has been introduced. Current inspected shared remote data belongs in TanStack Query; local form/sidebar state remains local. Revisit only if a concrete cross-route client-owned state requirement is identified.
- Static source updates were written/read through GitHub. Typecheck, lint, formatting, build, tests and browser checks were not run in a local checkout. User should run them before merging.
- Next structural slice: audit remaining module-owned type/service/component boundaries (especially milk and buffalo sales) and migrate one coherent set with all consumers verified; do not create empty folders or duplicate shared types.


### REF-013 continuation — 2026-10-16 (diet plans)

- Continued on `feature/feature-folder-structure-foundation` as requested; no branch, PR or merge was created.
- Diet-plan types moved from `src/lib/diet-plan-types.ts` into `src/features/diet-plans/types.ts`; form values are now inferred from `diet-plan.schema.ts`, and schedule types use canonical `Shift` from `src/lib/milk-domain.ts`. The obsolete shared diet-plan type file was deleted after updating the known service, query, form, new-route and edit-route consumers.
- No local test/build was run. Before merge, run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, then exercise diet-plan create/edit, schedule settings and explicit FAILED-run retry against a disposable/test environment.
- Next: continue REF-013 with remaining module-owned type boundaries, then run full architecture audit REF-012 only after prerequisite implementation slices and user-side runtime validation are complete.


### REF-013 continuation — 2026-10-16 (feed type ownership)

- Canonical feed domain types now live under their owning feature directories: feed items, inventory, purchases and consumption. Services and feature UI import these definitions directly. Inventory movement row projection type is owned by `src/features/feed-inventory/types.ts`, not the service.
- The old `src/lib/feed-*-types.ts` modules were retained as re-export-only compatibility facades so any other consumers are not broken mid-migration; they contain no competing type definitions. Remove these facades only after a repository-wide consumer search proves they are unused.
- No database/RPC or business behavior changes were made. Local checks remain unrun.


### REF-013 continuation — 2026-10-16 (expense type ownership)

- Expense types now have one canonical feature-owned definition in `src/features/expenses/types.ts`; the old `src/lib/expense-types.ts` is a re-export-only compatibility facade. `ExpensePayment` remains re-exported from the query module to avoid an accidental import API break.
- No financial transaction logic changed. Local checks and expense/payment workflow tests remain outstanding.


### REF-013 / REF-010A continuation — 2026-10-16 (milk list boundaries)

- Split the mixed milk-entry list module into `src/features/milk/milk-entry-list.types.ts`, `src/features/milk/utils/milk-entry-list.ts`, and `src/features/milk/services/milk-entry-list.service.ts`. The milk query hook now consumes those feature-owned boundaries directly.
- `src/lib/milk-entry-list.ts` remains a re-export-only compatibility facade because some other screens may still import shared date/list helpers. Remove it only after all consumers are migrated and checked.
- Existing query filters, server-side pagination, row order, date helpers and chunked list loading were preserved by extraction; runtime behavior has not been executed in this environment.


### REF-013 / REF-010A continuation — 2026-10-16 (milk schema ownership)

- Milk-entry validation now has one feature-owned definition at `src/features/milk/milk-entry.schema.ts`; the former lib module is re-export-only. The three known feature consumers were switched to the canonical path.
- The Zod validation and transform behavior were preserved during extraction. Runtime validation and milk/pool reconciliation checks remain pending.


- Static review correction during milk-list extraction: `getMilkEntryListUrl` was initially placed in the service module and the facade pointed at the utility module. This was corrected before handoff: the URL helper now lives in `src/features/milk/utils/milk-entry-list.ts`, and the service contains only list reads. The utility file's trailing orphan comment was also removed.


### REF-009 / REF-011A / REF-012 continuation — 2026-10-16 (cross-domain audit)

- Continued only on `feature/feature-folder-structure-foundation`; no PR or merge created.
- Fixed customer create/profile-update invalidation for milk selector/context queries and introduced the canonical customer payments query-key factory.
- Centralized buffalo query keys in `src/features/buffaloes/buffalo.query-keys.ts`; buffalo mutations now invalidate diet-plan and expense roots. Moved buffalo acquisition-cost Supabase reads and the existing RPC write behind buffalo service/query hooks; the panel now retains local form state and uses the canonical date-only helper.
- Explicit scheduler retry now invalidates run history and downstream consumption/inventory/feed-cost/report/dashboard queries after success.
- QueryProvider now clears cached query data when authenticated user identity changes. This requires manual same-tab account-switch verification.
- Updated `docs/QUERY_INVALIDATION_CONTRACT.md` and `docs/REFACTORING_REF009_REF012_IMPLEMENTATION_AUDIT.md` with findings, fixes and the remaining validation boundary.
- Verification remains static read-back only. No local typecheck, lint, format, build, browser tests or Supabase RPC/RLS/concurrency tests ran. Keep REF-012 blocked until these are executed and the legacy compatibility-facade consumer graph is confirmed with a full local search/typecheck.
- Next: inspect remaining effect-driven read candidates and residual duplicate date/payment helpers; then run the complete validation checklist. User retains PR/merge control.

- Further invalidation review: feed purchase create/edit/delete now refresh expense-category summaries and feed-cost analytics; diet-plan save refreshes scheduler run history (joined plan labels). These still require browser/runtime verification.

- Duplicate helper pass: expense formatting now re-exports shared `money` and canonical date-only `todayDateKey`; milk list date normalization/validation delegates to `src/lib/date-key.ts`; buffalo payment-type validation reuses the feature's canonical formula. Legacy type/schema/list facades remain until the full consumer graph can be verified.


## Latest handoff — 2026-10-18 — final architecture/query/security audit

- Fresh branch: `feature/final-architecture-query-security-audit`
- Starting `master` head: `a7d068ee78c400a21a555c1cadf93d4a572730ab`
- New commit: `1f5a8d7aadc96934048248bd219913a9e0448ebf`
- Changed source: `src/features/expenses/expense.queries.ts` now refreshes `feed-cost-analytics` after expense creation and refreshes both `feed-inventory` and `feed-cost-analytics` after expense payment.
- Audit/validation details: see `docs/REFACTORING_REF009_REF012_IMPLEMENTATION_AUDIT.md` and `docs/QUERY_INVALIDATION_CONTRACT.md`.
- This was a GitHub source-level pass, not a local build or runtime execution. Typecheck/lint/format/build/browser/Supabase/RLS/concurrency checks remain unrun. REF-012 remains Blocked until those checks and a full consumer audit are complete.
- User creates PR and merges. Do not merge this branch or create a PR.


## SEC-001 security/integrity handoff — 2026-10-18

- **Branch:** `feature/sec-001-database-integrity-audit`
- **Exact master base:** `b318e2702838e93a74c566695c6ab63302cd1ab0`
- **New artifacts:** `supabase/tests/sec-001-database-integrity.sql` (disposable/local-only transactional RLS and schema guard assertions) and `docs/SEC-001_DATABASE_SECURITY_AND_INTEGRITY_TESTS.md` (usage/limits).
- **Finding — payments:** `record_customer_payment` locks the customer row, which serializes payment submissions for that customer, but has no request idempotency token/table. An uncertain client timeout followed by a deliberate second submission can create a duplicate payment; do not blindly retry.
- **Finding — expenses:** RLS is owner-scoped; `record_expense_payment` locks the expense, writes a payment ledger record and updates `paid_amount` in one transaction. A trigger prevents direct `paid_amount` edits once dated payment records exist. A separate trigger blocks independent edits/deletes of an active feed-purchase-linked expense. These safeguards were only source-inspected and still require bypass tests against disposable Postgres.
- **Finding — feed inventory:** create consumption locks the feed item and records weighted-average cost; edit/delete append reversal movements and lock the original movement/feed row. Check reversal totals and two-session create/edit races in a disposable DB.
- **Finding — scheduler:** occurrence unique key is `(user_id, plan_id, feeding_date, shift)`; the scheduler claims rows with `FOR UPDATE SKIP LOCKED`, stores snapshot rows and posts movements in a per-run exception block, and exposes explicit retry only for FAILED runs without posted movement references. Verify by invoking scheduler concurrently and forcing a later item in a run to fail after an earlier item would otherwise post.
- **Verification boundary:** GitHub source reads and writes only. Neither the SQL regression file nor npm checks were executed because this connector session has no local checkout/runtime or disposable Supabase DB session. Do not treat SEC-001 as complete until those checks pass.
- **No production changes:** no migration ran, no production database was accessed, no payment/ledger RPC contract or retry behavior changed, and no PR/merge was created.
- **Next task:** after SEC-001 is executed successfully, proceed to REF-014 — duplicate helper/type consumer audit.


### Session log — 2026-10-18 (mandatory UI date readability standard)

- Added a mandatory project rule requiring every task to scan touched/related UI for readable dates and date ranges, including tables, KPI cards, charts/tooltips, filters, details, insights and exports. ISO values remain appropriate internally; presentation must use a consistent human-readable format and preserve date-only semantics.
- Added tracker task UI-001 for a repository-wide date-formatting audit and standardization, including regression evidence.
- Validation: fetched source docs from latest master, created fresh documentation branch from master, and read back each updated file after committing. No application code/build/runtime tests were run because this is a documentation-only change.
- Next task queue retains SEC-001 as the current highest-priority task; UI-001 is recorded as a tracked follow-up, and date-readability checks are mandatory for all tasks immediately.


## Buffalo performance decision dashboard — 2026-10-18

- **Branch:** `feature/buffalo-performance-decision-dashboard`, cut from latest master SHA `dcd6da1492b3258b6b81397526f0f78f30877786`.
- **Implementation:** redesigned `src/features/buffalo-production/BuffaloAnalyticsPage.tsx` with date presets/custom range, all-herd/single-buffalo selection, shift filter, KPI overview, period comparison showing readable dates and totals, sortable buffalo status summary, single-buffalo scorecard, production trend, recent 7-day insight, missing-shift coverage, daily milk history and paired morning/evening mixed-fat history.
- **Decision safeguards:** status is a rule-based production/data-completeness screening aid, not veterinary diagnosis; it does not claim profitability because per-animal revenue/cost attribution is not yet supported. Status thresholds require validation against real representative records.
- **Coverage fix:** herd missing-shift counts are calculated per buffalo/date/shift rather than treating a shift as present just because any buffalo has a record.
- **Commits:** `477e94e8969493d608cd3455349fa0143beac500` (dashboard implementation), `281f0fbf269df8568295b098d2400be760576909` (coverage calculation correction).
- **Verification:** latest source fetched back from GitHub after commits. Local typecheck, lint, build, tests and browser/manual UI testing were not executable in this GitHub-only session. Keep ANA-001 In Progress until these checks pass and the status thresholds are validated.
- **No PR/merge created.** User retains PR/merge control.


## Latest handoff — 2026-10-18 (Milk Margin After Feed dashboard card)

- Working branch: `feature/dashboard-milk-margin-after-feed`, created from latest `master` at `cb3197ef4c2f84c7fbdf04b0c7a64ef7ca6d6504`.
- Added a separate monthly Milk Margin After Feed card; existing Farm Finances card remains unchanged.
- Margin formula: milk sales revenue minus feed consumption cost from `feed_inventory_movements` rows with `movement_type = CONSUMPTION` and `source_type = FEED_CONSUMPTION`, using each row's recorded `unit_cost`. Feed purchase expenses and one-time setup expenses are excluded.
- Added a database RPC that aggregates monthly milk sales and actual feed consumption server-side, counts consumption entries without cost snapshots, and returns a cost-completeness signal. The UI does not display a misleading margin when any monthly consumption row has no cost.
- Changed files: `src/features/dashboard.tsx`, `src/features/dashboard/services/dashboard.service.ts`, new `src/features/dashboard/components/MilkMarginAfterFeedCard.tsx`, new migration `supabase/migrations/20261018130000_milk_margin_after_feed.sql`.
- Verification: source and migration reviewed statically through GitHub. Local build, lint, typecheck, UI/runtime checks, and applying the migration to Supabase were not run in this environment. Apply the migration before testing the branch locally.
- User owns local testing and PR/merge; no PR or merge was created.


## Feed module UX consistency pass — 2026-10-19

- Continued on `feature/dashboard-milk-margin-after-feed` as requested; no new branch, PR, or merge.
- Added page-size controls (20, 50, 100) for Feed Purchases, Feed Consumption, Feed Items, Feed Inventory movement history, and Diet Plans. Page size is included in query keys and passed to server-side pagination services.
- Tightened purchase/consumption filter layouts and Feed Items form grid; explicitly sets white text on primary actions.
- Visible purchase, consumption, inventory movement, and diet-plan dates now use human-readable formats.
- Feed Inventory stock search/filter remains in-memory over the aggregate stock query.
- Verification boundary: source-level changes only; local typecheck, lint, build, browser and Supabase runtime checks were not run. Validate before merge.


## Feed inventory page separation — 2026-10-19

- Continued on `feature/dashboard-milk-margin-after-feed`; no new branch, PR, or merge.
- `/feeds/inventory` now focuses on current stock, stock value, low-stock/out-of-stock indicators, and stock search/status filters.
- Added `/feeds/inventory/movements` for movement history with date range, feed item and movement type filters, plus 20/50/100 server-side pagination.
- Added `Movement History` to the FARM COSTS sidebar navigation. Existing inventory query/service contracts and ledger logic are unchanged.
- Verification boundary: source-level changes only; run typecheck, lint, build and browser smoke tests locally before merging.


## Milk entries date and shift UX — 2026-10-19

- **Branch:** `feature/milk-entries-date-shift-ux`, created from latest `master`.
- **Changed files:** `src/features/milk/EntriesPage.tsx`, `src/features/milk/services/milk-entry-list.service.ts`, `YUREEH_PROJECT_RULES.md`, `docs/REFACTORING_TASKS.md`.
- **Implemented:** Full month names for dates on the milk entries table and edit/delete dialogs; readable PDF report date range; explicit descending business date + Morning-before-Evening ordering; shift-specific row and badge colors (emerald for Morning, blue for Evening). Added the reusable date-readability rule to project rules.
- **Validation boundary:** Changes were written through GitHub and reviewed statically. Local typecheck, lint, format check, build, browser test and actual pagination/order verification were not run in this session.
- **PR/merge:** Not created. User owns PR and merge.


## Sales analytics filter and UX pass — 2026-10-20

- **Branch:** `feature/analytics-filter-ux-charts`, based on latest master SHA `1369862d6bfca08a5d11a486b4016bb994670b78`.
- **UI:** Milk Margin After Feed is now the first, decision-focused card. It is explicitly farm-wide; it does not falsely imply feed costs have been allocated to an individual customer. Sales KPIs follow it, then two separate daily charts (litres and rupees use their own scales), sales breakdown/customer contribution, and finally farm-pool reconciliation and mixed-fat history.
- **Filter hardening:** Sales analytics query inputs and query keys normalize the customer ID, include date range + customer, refetch on mount, and avoid rendering prior-filter data as placeholder data. The current `get_sales_analytics_summary` migration already has a customer/date-filtered `sales_filtered` CTE; farm-wide totals are intentionally not customer-scoped. Verify this behavior against the actual Supabase migration state, not source alone.
- **Changed files:** `src/features/analytics/SalesAnalyticsPage.tsx`, `src/features/analytics/sales-analytics.queries.ts`.
- **Verification boundary:** Source fetched back from GitHub and statically reviewed. This connector session has no local checkout/runtime, so `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, browser tests, and live customer/date-range tests were not run. No migration was added or applied.
- **PR/merge:** None created; user retains PR/merge control.


### Session log — 2026-10-20 (shared mixed-milk fat table and date consistency)

- **Task:** Fix the duplicated mixed-milk fat history tables on `/milk-pool` and `/analytics`, including the raw ISO date display.
- **Branch:** `feature/analytics-filter-ux-charts` (continued from the same branch; no new branch created).
- **Changes:** Added `src/features/milk/components/MixedMilkFatHistoryTable.tsx` as the single canonical table. Both routes now render this component with the same headers, column structure, zebra row styling, and `D MMMM YYYY` display dates. `/milk-pool` no longer prints raw `YYYY-MM-DD` keys. Added project rules prohibiting duplicate route-level implementations of repeated tables and raw ISO dates in user-facing tables.
- **Files changed:** `src/features/milk/components/MixedMilkFatHistoryTable.tsx`, `src/features/milk/MilkPoolPage.tsx`, `src/features/analytics/SalesAnalyticsPage.tsx`, `YUREEH_PROJECT_RULES.md`, `docs/REFACTORING_TASKS.md`, `docs/WORKFLOW_AND_HANDOFF.md`.
- **Validation:** Source changes written on the existing branch; read-back, typecheck, lint, build, and browser comparison are still required. Do not claim runtime verified until executed.
- **PR/merge:** Not created; user retains PR/merge control.


---

## Current work — RBAC Viewer access (2026-10-20)

- Working branch: `feature/rbac-viewer-access`
- Base commit from latest observed `master`: `81763e3e872b4ca1216237729d4437e397dd58a7`
- Scope: complete Super Admin + read-only Viewer access across the whole application on this one branch; do not branch between phases.
- Plan: `docs/RBAC_IMPLEMENTATION_PLAN.md`
- Initial static review confirmed Supabase email/password auth in `src/app/auth-gate.tsx`, protected layout in `src/app/(protected)/layout.tsx`, centralized navigation in `src/components/layout/Sidebar.tsx`, and owner-scoped RLS patterns in existing migrations.
- Critical issue: current owner-scoped `user_id = auth.uid()` policies will not automatically let a second account read farm records. A shared farm membership/tenant model is needed and must be designed after full dependency inventory.
- Signup is currently available from the login gate; do not let open signup grant farm membership or any role.
- Some data mutations use SQL RPCs and `SECURITY DEFINER` functions. UI-only protection is unacceptable.
- Implemented on this branch (not yet runtime-validated):
  - `supabase/migrations/20261020150000_rbac_viewer_access.sql` — farm memberships, owner backfill, trusted role helpers, confirmed-email invitation claim, farm-aware SELECT policies, and a database trigger blocking Viewer writes across public base tables.
  - `supabase/migrations/20261020160000_rbac_read_rpc_owner_scope.sql` — eight read-only pricing/reporting/milk-pool RPCs now resolve the farm owner through membership.
  - `src/lib/farm-access.tsx`, `src/app/auth-gate.tsx` — role context and farm membership verification; authenticated accounts without membership are denied.
  - `src/features/access/ViewerAccessManager.tsx` and `/settings` — Super Admin invitation/revocation UI.
  - `src/components/layout/FarmRoleRouteGuard.tsx`, `Sidebar.tsx`, `AppShell.tsx` — initial write-route blocking, role-aware navigation, and a Viewer read-only banner.
- Inventory and current phase status: `docs/RBAC_ROUTE_AND_DATA_INVENTORY.md` and `docs/RBAC_IMPLEMENTATION_PLAN.md`.
- Important remaining work: complete the page-by-page mutation-control audit; inspect all views, policies, grants, RPCs and scheduled paths; the old `get_buffalo_production_sheet` client dependency has been replaced with direct RLS-scoped table reads because no migration definition was found; verify migration backfill against actual database contents; and test invite/revoke, cross-farm reads, direct API/RPC writes, and Super Admin regression.
- Verification boundary: GitHub source was fetched back for static review. This session cannot run a local checkout or access the live Supabase database, so typecheck, lint, build, browser tests, SQL parse/apply, and live security tests have not been run. Do not apply to production or merge until these checks pass.
- User owns PR creation and merging. Do not create a PR or merge without explicit instruction.
