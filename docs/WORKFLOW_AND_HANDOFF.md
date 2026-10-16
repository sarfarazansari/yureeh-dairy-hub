# Yureeh Dairy Hub — Engineering Rules and Handoff

Last updated: 2026-10-06

## Project context

Repository: https://github.com/sarfarazansari/yureeh-dairy-hub  
Default branch: `master`  
Current work branch at handoff: `feature/feature-folder-structure-foundation`

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
