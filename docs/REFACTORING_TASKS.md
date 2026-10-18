# Refactoring Task Tracker

Last reviewed: 2026-10-18
Repository: https://github.com/sarfarazansari/yureeh-dairy-hub
Base branch: `master`

## Status definitions

- **Pending** — not started.
- **In Progress** — currently being worked on; update at each handoff.
- **Blocked** — cannot safely proceed; state the exact dependency.
- **Completed** — implementation and required verification are complete.
- **Deferred** — deliberately postponed with a reason.

Never mark a task Completed based only on a proposed plan or static inspection. Record verification evidence and limitations.

## Current priority queue

| ID | Priority | Task | Status | Depends on | Completion evidence |
|---|---|---|---|---|---|
| REF-001 | P0 | Establish permanent architecture standards and one-command workflow | Completed | — | Architecture, tracker and handoff created; permanent rules and workflow updated on feature branch |
| REF-002 | P0 | Complete file-by-file inventory of all server/data access, Supabase calls, RPCs, fetches, effects and query/mutation hooks | Completed | REF-001 | Recursive tree (238 tracked files, 141 source files, 60 migrations) and all source files screened; detailed path-level inventory in `docs/REFACTORING_API_INVENTORY.md` |
| REF-003 | P0 | Audit current query infrastructure and state ownership (TanStack Query, local state, Zustand/store usage) | Completed | REF-002 | `docs/REFACTORING_QUERY_STATE_AUDIT.md`: source-backed query-key, invalidation, auth-cache and server-state findings; static validation limits recorded |
| REF-004 | P1 | Map module boundaries, dependencies and shared types/schemas/helpers | Completed | REF-002 | `docs/REFACTORING_MODULE_BOUNDARIES_AUDIT.md`: module/dependency map, overlapping types/helpers, canonical ownership candidates and validation limits |
| REF-005 | P1 | Audit server-state fetching and effects; define migration pattern for ad hoc useEffect fetching | Completed (static audit) | REF-003, REF-004 | `docs/REFACTORING_EFFECTS_AUDIT.md`: prioritized path-level candidates, preserved UI/auth effects, migration pattern, risk ordering and acceptance checklist; runtime limitations recorded |
| REF-006 | P1 | Audit mutation invalidation, duplicate submission, errors, loading/empty states and pagination | Completed (static audit) | REF-003, REF-004 | `docs/REFACTORING_MUTATION_UX_AUDIT.md`: confirmed cache gaps, per-module safeguards/risks, invalidation matrix, pagination and regression checklists; static limitations recorded |
| REF-007 | P1 | Audit finance, milk pool, feed inventory, purchase/payment and consumption transaction integrity | Completed (static audit) | REF-002 | `docs/REFACTORING_TRANSACTION_INTEGRITY_AUDIT.md`: operation-to-ledger map, RPC/migration/RLS contracts, confirmed cache gaps, retry/reversal risks and explicit validation limits |
| REF-008 | P1 | Finalize refactor phases and acceptance criteria based on the full repository audit | Completed (planning artifact) | REF-002–REF-007 | `docs/REFACTORING_IMPLEMENTATION_ROADMAP.md`: ordered phases, dependencies, scope, acceptance criteria, regression plan and cross-domain invalidation contract |
| REF-009 | P1 | Standardize shared query-key ownership and targeted cross-feature invalidation | In Progress (static invalidation gaps fixed; runtime validation pending) | REF-008 | Shared customer/production key factories, milk-entry→customer/report invalidation, production-history key unification, `docs/QUERY_INVALIDATION_CONTRACT.md`; typecheck/lint/build/smoke tests outstanding |
| REF-010A | P1 | Consolidate verified canonical types and pure shared helpers | In Progress (source changes committed; validation pending) | REF-009 | Canonical milk shift/pricing types, shared pooled-fat record, identical customer shape reuse; date helper audit and tests outstanding |
| REF-010B | P1 | Move dashboard, sales/production analytics and financial reports to query-backed read boundaries | In Progress (main read boundaries migrated; validation pending) | REF-009 | Dashboard, sales analytics, buffalo analytics and financial report reads use date/filter-aware query keys; compare output against existing RPCs and run regression |
| REF-010C | P1 | Move feed inventory and feed-master reads to query-backed boundaries | In Progress (read/write boundaries migrated; validation pending) | REF-009 | Feed master, inventory stock/movement and pagination reads use query boundaries; feed-item create/update/activation writes use mutation hooks; verify RLS and duplicate-name handling |
| REF-010D | P1 | Refactor expense reads and payment boundary | In Progress (expense routes now query/mutation-backed; validation pending) | REF-009 | Expense history/new-expense reads, category/vendor directories and expense create/update/soft-delete/payment writes now use query/mutation boundaries; full typecheck/build and workflow tests outstanding |
| REF-010E | P1 | Refactor feed-purchase reads and mutation hooks | In Progress (archive/forms/mutations migrated; validation pending) | REF-009, REF-010C, REF-010D | Existing idempotency-key lifecycle and RPC writes preserved; local replay, lock and reconciliation tests outstanding |
| REF-010F | P1 | Refactor feed-consumption reads and mutation hooks | In Progress (archive/forms/mutations migrated; validation pending) | REF-009, REF-010C, REF-010E | Existing RPC-only writes preserved with stock/cost/reversal invalidation; stock/date/concurrency/reversal tests outstanding |
| REF-010G | P1 | Refactor diet-plan and scheduler query/mutation boundaries | In Progress (plan and scheduler boundaries implemented; validation pending) | REF-009, REF-010C, REF-010E, REF-010F | Plan archive/options/detail/save and scheduler settings/run history/save/explicit failed-run retry use query/mutation boundaries; DB posting/retry regression tests outstanding |
| REF-011A | P1 | Refactor buffalo lifecycle/acquisition/sale and customer payment boundaries | In Progress (acquisition-cost query boundary and cross-domain invalidation improved; runtime validation pending) | REF-009, REF-010A, REF-010B | Buffalo mutation invalidation and customer payment/report invalidation improved; acquisition-cost UI and common payment retry/idempotency policy remain unverified |
| REF-011B | P2 | Refactor any remaining modules one task per run | In Progress (expense/feed-item/scheduler boundaries implemented; remaining-module audit pending) | REF-010A–REF-011A | Expense history/new/category/vendor and feed-item writes are now query/mutation-backed; audit remaining direct-access modules and verify all cache dependencies |
| REF-012 | P2 | Final architecture regression audit and remove obsolete duplicate patterns | Blocked (2026-10-18 static source pass updated; executable validation and full consumer audit outstanding) | REF-011A, REF-011B | `docs/REFACTORING_REF009_REF012_IMPLEMENTATION_AUDIT.md` records mutation/query matrix, source-level security review, one confirmed invalidation fix, and explicit unavailable runtime checks |
| SEC-001 | P0 | Database security and financial/inventory integrity tests: RLS/ownership, ledger-locked expenses, payment retry/concurrency, feed consumption/reversal, scheduler atomicity/duplicate runs | In Progress / Blocked on disposable DB execution | REF-007, REF-010D–REF-010G, REF-011A | SQL regression artifact and handoff added; static review identifies unkeyed customer payment retries; SQL/RLS/concurrency/reconciliation checks remain unexecuted |
| REF-013 | P1 | Implement feature-owned folder boundaries and justified client-state stores, one module at a time | In Progress (feature-owned boundaries extended to buffalo acquisition costs and query keys; local validation pending) | REF-008 | Expense helpers are feature-owned; feed-items, feed-inventory, feed-purchases, feed-consumption and diet-plans services/query hooks/schemas/components now live under `src/features/*`; customer domain types now live in `src/features/customers/types.ts` instead of the service, with milk query consumers updated; diet-plan database/domain types and schedule types now live in `src/features/diet-plans/types.ts`, form values are schema-inferred, and the obsolete `src/lib/diet-plan-types.ts` was removed; feed item, inventory, purchase and consumption types now have feature-owned canonical definitions (legacy `src/lib/feed-*-types.ts` files are re-export-only compatibility facades), and feed components/services import feature-owned types; expense domain/payment types now live in `src/features/expenses/types.ts` and the legacy `src/lib/expense-types.ts` is a re-export facade; milk entry list projections now live in `src/features/milk/milk-entry-list.types.ts`, pure list/date helpers in `src/features/milk/utils/milk-entry-list.ts`, and list reads in `src/features/milk/services/milk-entry-list.service.ts`; legacy `src/lib/milk-entry-list.ts` is a re-export facade; milk entry Zod schema now lives in `src/features/milk/milk-entry.schema.ts` and the old lib path is re-export-only; remaining module boundary/store-candidate audit and local validation outstanding |

## Source inventory pointer

The complete static API/query/effect/state inventory is in `docs/REFACTORING_API_INVENTORY.md`. REF-003 query/state findings are in `docs/REFACTORING_QUERY_STATE_AUDIT.md`; REF-004 module/dependency/type ownership findings are in `docs/REFACTORING_MODULE_BOUNDARIES_AUDIT.md`; REF-007 transaction findings are in `docs/REFACTORING_TRANSACTION_INTEGRITY_AUDIT.md`; REF-008 implementation ordering is in `docs/REFACTORING_IMPLEMENTATION_ROADMAP.md`; REF-009 invalidation rules are in `docs/QUERY_INVALIDATION_CONTRACT.md`. The file list below remains a short orientation index, not the canonical exhaustive inventory. Do not infer that a file is absent merely because it is not listed here.

### Shared infrastructure
- `src/lib/supabase.ts` — Supabase client creation.
- `src/app/auth-gate.tsx` — session retrieval and auth-state subscription via `useEffect`.
- `package.json` — Next.js, React, Supabase, TanStack Query, Zod, React Hook Form-related project conventions; scripts currently include dev/build/start/lint/format but no explicit test or typecheck script.

### Buffaloes and production
- `src/features/buffaloes/services/buffalo.service.ts` — buffalo profile, purchase, payment, status, sale/disposal data access and RPC calls.
- `src/features/buffaloes/hooks/use-buffaloes.ts` — TanStack Query hook(s).
- `src/features/buffalo-production/services/buffalo-production.service.ts` — production sheet and save RPCs; production/fat/buffalo queries.
- `src/features/buffalo-production/buffalo-production.queries.ts` — query/mutation hooks.
- `src/features/buffalo-production/BuffaloAnalyticsPage.tsx` — effect-based loading observed.
- `src/features/buffalo-production/DailyPerformancePage.tsx` — listed in handoff as a key production route; audit direct access and dependencies.

### Customers and milk
- `src/features/customers/services/customer.service.ts` — customer data, pricing and payment-related RPCs.
- `src/features/customers/customer.queries.ts` — query/mutation hooks.
- `src/features/customers/CustomersPage.tsx` — directory query usage and auth lookup observed.
- `src/features/customers/CustomerDetailPage.tsx` — detail/query retry patterns observed.
- `src/features/milk/services/milk-entry.service.ts` — milk-entry create/update/delete RPCs and counts.
- `src/features/milk/services/milk-pool.service.ts` — milk-pool reconciliation, movement and shift-context RPCs; production/fat queries.
- `src/features/milk/milk.queries.ts` — query/mutation hooks.
- `src/features/milk/EntriesPage.tsx` — list/export query hooks and refetch paths observed.
- `src/features/milk/MilkPoolPage.tsx` — query results/retry patterns observed.

### Dashboard, analytics and finance
- `src/features/analytics/services/sales-analytics.service.ts` — sales analytics RPC and customer lookup.
- `src/features/analytics/SalesAnalyticsPage.tsx` — effect-based loading observed.
- `src/features/dashboard/services/dashboard.service.ts` — dashboard data queries and sales analytics RPC.
- `src/features/dashboard.tsx` — effect-based loading observed.
- `src/app/(protected)/financial-reports/page.tsx` — financial summary RPCs and effect-based loading observed.
- `src/features/buffalo-production/BuffaloAnalyticsPage.tsx` — production analytics data path also feeds analytics.

### Expenses
- `src/app/(protected)/expenses/page.tsx` — expense list data access and effect.
- `src/app/(protected)/expenses/new/page.tsx` — lookup queries and expense creation observed.
- `src/app/(protected)/expenses/history/page.tsx` — paginated expense query, related lookups, update and soft-delete paths observed.
- `src/app/(protected)/expenses/history/[id]/page.tsx` — expense/payment queries and `record_expense_payment` RPC observed.
- `src/app/(protected)/expenses/categories/page.tsx` — category CRUD and auth calls observed.
- `src/app/(protected)/expenses/vendors/page.tsx` — vendor queries and directory-summary RPC observed.
- `src/app/(protected)/expenses/shared.tsx` — category lookup/default category insertion observed.

### Feed purchases, consumption, inventory and diet plans
- `src/app/(protected)/feeds/items/page.tsx` — feed item query/count and CRUD/activation observed in route page.
- `src/app/(protected)/feeds/purchases/services.ts` — purchase create/edit/delete RPCs and movement queries.
- `src/app/(protected)/feeds/consumption/services.ts` — consumption create/edit/delete RPCs, movements, feed items and stock queries.
- `src/app/(protected)/feeds/inventory/services.ts` — stock and movement queries.
- `src/app/(protected)/feeds/diet-plans/services.ts` — plans/items, feed items, production-sheet RPC and save-plan RPC.
- `src/app/(protected)/feeds/purchases/page.tsx` — lookup loading observed.
- `src/app/(protected)/feeds/consumption/page.tsx` — effect-based loading observed.
- `src/app/(protected)/feeds/inventory/page.tsx` — stock/movement effects observed.
- `src/app/(protected)/feeds/diet-plans/page.tsx` — effect-based list loading observed.
- `src/app/(protected)/feeds/purchases/components/FeedPurchaseForm.tsx` — effect observed.
- `src/app/(protected)/feeds/diet-plans/components/DietPlanForm.tsx` — effects observed.
- `src/app/(protected)/buffalo-sales/page.tsx` — effect and query/refetch usage requires tracing.

### Session log — 2026-10-18 (final architecture/query/security regression pass)

- Task: Final audit continuation across REF-009/REF-010/REF-011/REF-012.
- Branch: `feature/final-architecture-query-security-audit`.
- Starting `master`: `a7d068ee78c400a21a555c1cadf93d4a572730ab` (current latest remote head at branch creation).
- Commit: `1f5a8d7aadc96934048248bd219913a9e0448ebf` — `fix(expenses): refresh feed cost dependents after expense writes`.
- Source tree evidence: recursive tree contained 359 paths, 170 TS/TSX under `src/`, and 60 SQL migrations.
- Fixed: expense create invalidates feed-cost analytics; expense payment invalidates feed inventory and feed-cost analytics as well as its existing dependencies. Ledger writes/RPCs were not changed.
- Docs updated: `docs/REFACTORING_TASKS.md`, `docs/WORKFLOW_AND_HANDOFF.md`, `docs/REFACTORING_REF009_REF012_IMPLEMENTATION_AUDIT.md`, `docs/QUERY_INVALIDATION_CONTRACT.md`.
- Checks executed: GitHub file read-back and source/migration static review. Not executed: npm install, typecheck, lint, format check, build, automated tests, browser, Supabase/RLS/concurrency tests. No local runtime/database was available.
- Status: In Progress/Blocked for acceptance; do not mark REF-012 Completed until runtime/compiler/database checks are run.
- No PR, merge, schema change, or production data change.

## Per-task handoff record

Append a dated entry here after each work session:

- Date:
- Task ID:
- Branch:
- Status:
- Files changed:
- Checks executed and results:
- Checks not run / limitations:
- Blockers or decisions:
- Next task ID:

## Rules for updating this tracker

1. Update status when starting and finishing a task.
2. Never mark a task complete until acceptance criteria and relevant checks are satisfied.
3. Keep file inventory path-exact; label unverified leads as unverified.
4. If scope changes, add a task and dependency rather than silently broadening an existing task.
5. Keep one coherent implementation task per `1 refactor karo` run unless a small prerequisite is essential.
6. The next task is the highest-priority Pending task whose dependencies are Completed.


### Session log — 2026-10-16

- Task ID: REF-001
- Branch: `feature/refactor-engineering-standards`
- Status: Completed
- Files changed: `YUREEH_PROJECT_RULES.md`, `docs/WORKFLOW_AND_HANDOFF.md`, `docs/REFACTORING_ARCHITECTURE.md`, `docs/REFACTORING_TASKS.md`
- Checks executed and results: GitHub branch/file read-back confirmed all four files exist on the feature branch; static documentation consistency review only.
- Checks not run / limitations: Application build, lint, tests and local Git status were not run because this session used remote GitHub file operations, not a local checkout.
- Blockers or decisions: The repository-wide search endpoint did not return indexed code results in this session. The initial API inventory is intentionally marked partial rather than falsely claiming exhaustive coverage.
- Next task ID: REF-002 — obtain/verify a complete source-file inventory and trace all API/data-access/effect/query patterns before planning module refactors.


### Session log — 2026-10-16 (REF-002)

- Task ID: REF-002
- Branch: `feature/refactor-engineering-standards`
- Status: Completed
- Files changed: `docs/REFACTORING_API_INVENTORY.md`, `docs/REFACTORING_TASKS.md`, `docs/WORKFLOW_AND_HANDOFF.md`
- Checks executed and results: Retrieved latest `master` ref at `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9`; rebased this documentation branch onto that base using Git data APIs and a force-with-lease ref update; retrieved an untruncated recursive tree (238 tracked files, 141 TS/JS source files, 60 migrations); screened all 141 source files for Supabase/RPC/query/effect/store patterns; read back key service and query-hook files.
- Checks not run / limitations: No local checkout was available (clone network resolution failed); build, lint, typecheck, tests and runtime checks were not executed. This task is a static inventory, not an implementation refactor.
- Findings: TanStack Query is installed but adoption is partial; no Zustand dependency/store was found; expense/feed/report modules have multiple page-level data-access/effect patterns; a buffalo acquisition-cost component contains direct query/mutation code; `react-hook-form` is not listed in package dependencies.
- Next task ID: REF-003 — audit query infrastructure, server/client state ownership, key conventions and cache invalidation using the source paths documented in the API inventory.


### Session log — 2026-10-16 (REF-003)

- Task ID: REF-003
- Branch: `feature/refactor-engineering-standards`
- Status: Completed (static audit; no implementation refactor)
- Files changed: `docs/REFACTORING_QUERY_STATE_AUDIT.md`, `docs/REFACTORING_TASKS.md`, `docs/WORKFLOW_AND_HANDOFF.md`
- Checks executed and results: Confirmed branch is 4 commits ahead of and 0 commits behind latest `master` at `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9`; read QueryProvider, buffalo/customer/milk/production query modules, acquisition-cost component, buffalo-sales query consumer, related services, package scripts, inventory and tracker. Documented source-backed query-key ownership and invalidation findings.
- Checks not run / limitations: No local checkout; build, lint, typecheck, tests, browser/account-switching checks and database operations were not run. Findings are static source review, not runtime proof.
- Findings: Milk-entry mutations do not invalidate customer summary/detail caches; buffalo production history has two query-key owners and production saves do not invalidate the buffalo-detail history key; acquisition-cost UI owns direct query/mutation logic; auth-cache lifecycle needs validation; dashboards/analytics/expenses/feed/report screens still store remote state locally.
- Blockers or decisions: No business decision needed for the audit. Cross-feature invalidation should be implemented only after the dependency map and transaction audit are complete; preserve existing RPC atomicity.
- Next task ID: REF-004 — map module boundaries, dependencies and canonical shared types/schemas/helpers.


### Session log — 2026-10-16 (REF-004)

- Task ID: REF-004
- Branch: `feature/refactor-engineering-standards`
- Status: Completed (static architecture/type audit; no source implementation changes)
- Files changed: `docs/REFACTORING_MODULE_BOUNDARIES_AUDIT.md`, `docs/REFACTORING_TASKS.md`, `docs/WORKFLOW_AND_HANDOFF.md`
- Checks executed and results: Compared the branch with latest `master` at `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9` (7 commits ahead, 0 behind before this task); inspected feature/shared types and services for buffaloes, production, customers, milk, dashboard, analytics, expenses and feed domains. Documented module ownership, dependency map and source-backed overlapping type/helper candidates.
- Checks not run / limitations: No local checkout; no build, lint, typecheck, tests, runtime flows, SQL/RLS/database checks or exhaustive compiler-backed import search. Type consolidation candidates require import/constraint verification before implementation.
- Findings: Duplicate `MilkPoolShiftFatRecord` definitions in production and milk-pool modules; `CustomerOption` overlaps `DashboardCustomer`; shift/pricing literals and aliases have inconsistent ownership; feed services are route-scoped while feed domain types live in `src/lib`; expense shared file mixes UI/helpers/category seeding; date helpers have multiple implementations.
- Blockers or decisions: No business decision required for the map. Do not consolidate payment method types or date helpers without checking database constraints, all consumers and timezone expectations. Transaction-critical feed/milk boundaries remain pending REF-007.
- Next task ID: REF-005 — audit server-state fetching and effects; define a safe migration pattern for effect-driven remote reads.


### Session log — 2026-10-16 (REF-005)

- Task ID: REF-005
- Branch: `feature/refactor-engineering-standards`
- Status: Completed (static audit and migration design; no source implementation changes)
- Files changed: `docs/REFACTORING_EFFECTS_AUDIT.md`, `docs/REFACTORING_TASKS.md`, `docs/WORKFLOW_AND_HANDOFF.md`
- Checks executed and results: Read project rules, workflow handoff, architecture, task tracker, API inventory, query/state audit and module-boundary audit; verified branch comparison against `master` at `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9` was 10 commits ahead / 0 behind before REF-005; documented effect-driven remote-read candidates, valid effect classes, migration pattern, dependency-aware ordering and acceptance checklist.
- Checks not run / limitations: No local checkout; build, lint, typecheck, tests, browser/runtime/account-switch checks, Supabase migrations, RLS checks and database operations were not run. Classification builds on the repository-wide static inventory and is not runtime proof.
- Findings: Dashboard, sales/production analytics, financial reports, expenses and feed inventory/purchase/consumption/diet-plan pages are candidates for query-backed reads. Auth subscriptions, timers, date-picker synchronization, form/dialog synchronization and local pagination correction must not be removed blindly. Transactional feed and financial modules remain gated on REF-007.
- Blockers or decisions: No business decision required for this audit. Do not begin source migrations until REF-006 through REF-008 are completed.
- Next task ID: REF-006 — audit mutation invalidation, duplicate submission, errors, loading/empty states and pagination.


### Session log — 2026-10-16 (REF-006)

- Task ID: REF-006
- Branch: `feature/refactor-engineering-standards`
- Status: Completed (static audit; no source implementation changes)
- Files changed: `docs/REFACTORING_MUTATION_UX_AUDIT.md`, `docs/REFACTORING_TASKS.md`, `docs/WORKFLOW_AND_HANDOFF.md`
- Checks executed and results: Read prior inventory/query/effects audits; inspected milk/customer/production query modules, buffalo mutation hooks, feed purchase/consumption/inventory/diet-plan services, expense history/detail and key feed pages. Confirmed missing customer cache invalidation for milk writes and missing buffalo-detail production-history invalidation after production save. Documented per-module mutation guards, pagination behavior, dependency matrix and regression checklist.
- Checks not run / limitations: No local checkout; build, lint, typecheck, tests, browser/manual regression, concurrency, RPC/RLS and database checks were not run. Not every page's pending/error path or the full downstream invalidation graph can be confirmed by this static pass.
- Findings: Existing safeguards include feed-purchase idempotency RPC, RPC-backed feed consumption writes, expense ledger lock checks, server-side expense/feed pagination and explicit guarded scheduler retry. Broad cross-domain invalidation still needs the REF-007 transaction map.
- Blockers or decisions: No business decision needed. Do not implement cross-domain invalidation or transactional write refactors before REF-007 and REF-008.
- Next task ID: REF-007 — audit finance, milk pool, feed inventory, purchase/payment and consumption transaction integrity end-to-end.


### Session log — 2026-10-16 (REF-007 + REF-008)

- Task IDs: REF-007, REF-008
- Branch: `feature/refactor-engineering-standards`
- Status: Completed (static transaction audit + implementation roadmap; no app source implementation)
- Files changed: `docs/REFACTORING_TRANSACTION_INTEGRITY_AUDIT.md`, `docs/REFACTORING_IMPLEMENTATION_ROADMAP.md`, `docs/REFACTORING_TASKS.md`, `docs/WORKFLOW_AND_HANDOFF.md`
- Checks executed and results: Read the required project/workflow/architecture/tracker docs and prior audits; inspected current milk/customer/production/buffalo/feed/expense/report service paths and selected SQL migrations for milk pool, feed stock/purchase/consumption, customer/expense payments, scheduler, financial reconciliation and buffalo lifecycle. Documented confirmed ledger/RPC contracts, explicit unknowns, cross-feature invalidation gaps and ordered implementation phases.
- Checks not run / limitations: No local checkout; build, lint, typecheck, tests, live DB/RLS introspection, SQL execution, concurrency tests, cron verification or production data reconciliation were not run. Audit claims are static only.
- Findings: Existing RPC/ledger protections must be preserved; milk→customer and production→buffalo-history invalidation gaps are confirmed; payment callers without request keys need an explicit retry/idempotency policy; feed purchase correction remains locked when payment history or later stock movements exist; scheduler deployment/runtime remains unverified.
- Blockers or decisions: No business decision needed to finalize the plan. No application source or database changes. No PR or merge created.
- Next task ID: REF-009 — standardize shared query-key ownership and targeted cross-feature invalidation.


### Session log — 2026-10-16 (REF-009 implementation)

- Task ID: REF-009
- Branch: `feature/refactor-engineering-standards`
- Status: In Progress (source edits committed; local validation pending)
- Files changed: `src/features/customers/customer.query-keys.ts`, `src/features/customers/customer.queries.ts`, `src/features/buffalo-production/buffalo-production.query-keys.ts`, `src/features/buffalo-production/buffalo-production.queries.ts`, `src/features/buffaloes/hooks/use-buffaloes.ts`, `src/features/milk/milk.queries.ts`, `docs/QUERY_INVALIDATION_CONTRACT.md`, `docs/REFACTORING_TASKS.md`, `docs/WORKFLOW_AND_HANDOFF.md`
- Implemented: Extracted customer and buffalo-production query-key factories to key-only modules; made buffalo detail production history use the canonical production-history key; milk-entry create/update/delete now invalidate milk data, customer directory and all customer-detail/payment descendants; manual pool movement retains milk-only invalidation. No transaction/RPC code was changed and no automatic retries were added.
- Checks executed and results: Read project rules, workflow handoff, architecture, tracker, query/state and mutation audits, transaction audit and roadmap; inspected current query hooks; wrote changes on the existing branch; fetched source files back to confirm imports, shared key use and mutation invalidation paths.
- Checks not run / limitations: No local checkout; TypeScript/typecheck, lint, build, tests and browser regression were not run. No query-key tests exist in this task's changed files; test infrastructure was not executed. Account-switch cache lifecycle remains a separate verification item.
- Next step: User/local environment should run typecheck, lint, build and smoke-test milk entry create/update/delete (including customer reassignment) and production save → buffalo detail history refresh. After verification, mark REF-009 Completed and proceed to REF-010A/REF-010B in the roadmap.


### Implementation session — 2026-10-16 (REF-009 through REF-012 batch)

- Branch: `feature/refactor-engineering-standards`
- Status: In progress; do not merge yet.
- Implementation audit: `docs/REFACTORING_REF009_REF012_IMPLEMENTATION_AUDIT.md`.
- Source changes include canonical milk-domain types, query-backed dashboard/analytics/financial-report reads, feed master/inventory/archive/form query boundaries, purchase/consumption/diet-plan mutation hooks, expense detail/payment and dashboard boundaries, and expanded targeted invalidation for milk/customer/buffalo/feed dependencies.
- No migrations, RPC definitions, RLS policies, or production data were changed. No PR was created.
- Validation not run: local checkout was unavailable; TypeScript, lint, format check, build, automated tests, browser regression, live/disposable Supabase/RLS/concurrency checks, and auth cache isolation remain outstanding. Repository has no `.github/workflows/ci.yml` and latest commit reports no status checks.
- Remaining modules are explicitly listed in the implementation audit. REF-012 remains blocked until the remaining expense/scheduler/acquisition-cost paths are migrated and the required validations pass.
- Branch comparison at this checkpoint reported 101 commits ahead and 2 behind `master`. During this session, one query-key update was briefly written to the default branch because the branch argument was omitted; a subsequent commit restored the file content to its prior state. The default-branch file content was read back and verified restored. The two extra default-branch commits remain in history; no force-reset was attempted.
- Next: finish remaining REF-010D/010G/011A/011B modules, perform the repository-wide REF-012 audit, then run local validation before the user creates a PR/merges.


### Session log — 2026-10-16 (REF-013 initial structural implementation)

- Task ID: REF-013
- Branch: `feature/feature-folder-structure-foundation`
- Base: latest `master` at `1f291af036ff737049af3db51936a3d72234da29` (fetched immediately before branch creation).
- Status: In Progress
- Files changed: `src/features/expenses/components/ExpenseNavigationShell.tsx`, `src/features/expenses/services/expense-setup.service.ts`, `src/features/expenses/utils/expense-format.ts`, `src/app/(protected)/expenses/shared.tsx`.
- Changes: moved expense navigation/date-filter UI into feature-owned components, category-seeding data access into an expense service, and currency/local-date helpers into feature utilities. The old route-level `shared.tsx` now temporarily re-exports the new canonical implementations to keep existing route imports compatible during incremental migration.
- Store decision: no Zustand dependency/store added in this first slice. Existing shared data is server-owned and should remain in TanStack Query; no specific cross-route client-owned state has yet been demonstrated to justify a store. Store candidates must be identified from actual consumers before introducing a global store.
- Checks executed: read latest master branch SHA and relevant source files; statically compared extracted implementations to previous shared helper behavior.
- Checks not run: local typecheck, lint, build, tests and browser smoke tests; this session uses remote GitHub file operations without a local checkout.
- Next: review new files and imports, run local checks on the feature branch, then continue the next structural slice by moving remaining expense-route imports off the compatibility module. Do not merge until local checks pass.


### Session log — 2026-10-16 (REF-013 structural slice updated)

- Implemented on `feature/feature-folder-structure-foundation` from latest master `1f291af036ff737049af3db51936a3d72234da29`.
- Migrated imports in all seven expense routes to feature-owned components, services and utilities; removed `src/app/(protected)/expenses/shared.tsx`.
- Read-back verification: fetched all seven routes from the feature branch and confirmed none references the removed `shared.tsx`; all show imports from `@/features/expenses/*`.
- Runtime checks remain not run: local typecheck, lint, build, unit tests and browser smoke tests. The branch is not ready to merge until the user runs checks locally.
- Store policy unchanged: no Zustand store is justified by this slice. TanStack Query remains the server cache; state should not be duplicated into Zustand. Store candidates are to be evaluated from concrete cross-route client-state requirements.


### Session log — 2026-10-16 (REF-013 feed module migrations)

- Branch: `feature/feature-folder-structure-foundation`; base remains latest master `1f291af036ff737049af3db51936a3d72234da29`.
- Migrated service/query/schema ownership:
  - Feed items: `src/features/feed-items/feed-items.service.ts`, `feed-items.queries.ts`.
  - Feed inventory: `src/features/feed-inventory/feed-inventory.service.ts`, `feed-inventory.queries.ts`.
  - Feed purchases: `src/features/feed-purchases/feed-purchases.service.ts`, `feed-purchases.queries.ts`, `feed-purchases.schema.ts`.
  - Feed consumption: `src/features/feed-consumption/feed-consumption.service.ts`, `feed-consumption.queries.ts`, `feed-consumption.schema.ts`.
  - Diet plans/scheduler: `src/features/diet-plans/diet-plan.service.ts`, `diet-plan.queries.ts`, `diet-plan.schema.ts`, `diet-plan-schedule.queries.ts`.
- Updated consuming routes/forms to import the feature-owned files and deleted the old route-owned service/query/schema files for these modules. Existing shared domain types in `src/lib/*-types.ts` remain shared because multiple feed domains consume them; do not duplicate those types merely to populate feature folders.
- Store audit: package has no Zustand dependency and current examined shared data is server-owned (TanStack Query), while sidebar mobile-open and page forms are local UI state. No global store was introduced without a demonstrated cross-route client-state requirement. If the user expects a specific store behavior, identify that state/consumer explicitly before choosing the store API.
- Verification performed: GitHub read-back of source files and targeted route imports during migration. No local typecheck/lint/build/tests/browser checks run in this environment. These migrations are not merge-ready until user runs checks.


### Session log — 2026-10-16 (feed UI component ownership)

- Moved feed item, inventory, purchase, consumption and diet-plan UI components from route folders into their respective `src/features/*/components` directories.
- Updated route pages to import feature-owned components. Updated moved components to reference feature-owned schemas/services and the canonical expense date utility where needed.
- Removed the old route-owned component files after creating feature-owned replacements.
- GitHub tree/source read-back and targeted import inspection performed; full local build/typecheck/lint/tests were not run. This is still In Progress until the user confirms local checks.


### Session log — 2026-10-16 (developer verification command)

- Added `npm run typecheck` (`tsc --noEmit`) to `package.json` so the documented TypeScript validation has a standard one-command entry point.
- No dependencies were added and no lockfile change was required for this script-only change.
- Command has not been executed in this environment; user must run it locally.


### Session log — 2026-10-16 (REF-013 customer type ownership)

- Task ID: REF-013
- Branch: `feature/feature-folder-structure-foundation`
- Status: In Progress (customer type boundary migrated; full task validation pending)
- Files changed: `src/features/customers/types.ts`, `src/features/customers/services/customer.service.ts`, `src/features/customers/customer.queries.ts`, `src/features/customers/CustomersPage.tsx`, `src/features/customers/CustomerDetailPage.tsx`, `docs/REFACTORING_TASKS.md`, `docs/WORKFLOW_AND_HANDOFF.md`.
- Changes: created a feature-owned canonical customer types module; services now import domain types rather than defining exported domain shapes; customer query hooks and UI components import those types from the feature boundary. `PricingType` and `Shift` reuse the canonical `src/lib/milk-domain.ts` definitions. The RPC directory-summary row remains service-local because it is an internal database projection, not a UI/domain type.
- Integrity boundary: no SQL, RPC behavior, RLS, payment mutation, query keys or business calculations changed.
- Checks performed: GitHub read-back of source before edits and targeted updates on this branch; static review of imports and type ownership.
- Checks not run: local typecheck, lint, formatting, build, automated tests and browser workflows. No local checkout was available; do not treat this as merge-ready until these checks pass.
- Next: continue REF-013 with the next safe feature boundary/type ownership slice after inspecting current consumers; keep Zustand deferred until a real cross-route client-owned state requirement is identified.


### Session log — 2026-10-16 (REF-013 diet-plan type ownership)

- Task ID: REF-013
- Branch: `feature/feature-folder-structure-foundation`
- Status: In Progress (diet-plan type boundary migrated; validation pending)
- Files changed: `src/features/diet-plans/types.ts` (new), `src/features/diet-plans/diet-plan.service.ts`, `src/features/diet-plans/diet-plan.queries.ts`, `src/features/diet-plans/diet-plan.schema.ts`, `src/features/diet-plans/diet-plan-schedule.queries.ts`, `src/features/diet-plans/components/DietPlanForm.tsx`, `src/app/(protected)/feeds/diet-plans/new/page.tsx`, `src/app/(protected)/feeds/diet-plans/edit/[id]/page.tsx`; removed `src/lib/diet-plan-types.ts`.
- Changes: moved diet-plan list/detail/buffalo-option and scheduler types into the owning feature; moved form-value ownership to the Zod schema output type; centralized status values and reused the canonical milk `Shift` type for scheduled runs.
- Integrity boundary: no scheduler RPC, stock-posting, retry, database schema, or diet-plan business behavior intentionally changed.
- Validation: GitHub read/write succeeded. Local typecheck, lint, format, build, scheduler regression and Supabase posting/retry checks remain unrun.


### Session log — 2026-10-16 (REF-013 feed type ownership)

- Task ID: REF-013
- Branch: `feature/feature-folder-structure-foundation`
- Status: In Progress (feed type ownership migrated; local validation pending)
- Changes: added canonical type modules under `src/features/feed-items/types.ts`, `src/features/feed-inventory/types.ts`, `src/features/feed-purchases/types.ts`, and `src/features/feed-consumption/types.ts`. Updated feed services and feature components to import canonical feature-owned types. Moved `FeedInventoryMovementRow` into the inventory feature type module so the movement table no longer imports a type from its service. Legacy `src/lib/feed-*-types.ts` files now only re-export canonical types for any unmigrated consumers; they no longer define competing shapes.
- Integrity boundary: no stock calculations, purchase/consumption RPCs, transaction semantics, or database schema were changed.
- Validation: targeted source reads and GitHub write confirmation only. Local typecheck/lint/format/build, purchase replay, stock reconciliation and consumption reversal regression checks remain outstanding.


### Session log — 2026-10-16 (REF-013 expense type ownership)

- Task ID: REF-013
- Branch: `feature/feature-folder-structure-foundation`
- Status: In Progress (expense type ownership migrated; validation pending)
- Changes: created `src/features/expenses/types.ts` for expense categories, vendors, buffalo options, expense rows and payment rows; updated the expense query module to consume feature-owned types and retained its `ExpensePayment` type export for compatibility. `src/lib/expense-types.ts` is now re-export-only.
- Integrity boundary: no expense/payment RPC, ledger, balance, category-seeding or mutation behavior intentionally changed.
- Validation: source edits confirmed via GitHub. Local typecheck, lint, formatting, build, and payment/linked-purchase regression tests remain unrun.


### Session log — 2026-10-16 (REF-013 milk list boundary split)

- Task ID: REF-013 / REF-010A
- Branch: `feature/feature-folder-structure-foundation`
- Status: In Progress (milk list boundary split; validation pending)
- Changes: split the mixed `src/lib/milk-entry-list.ts` into feature-owned types, pure date/filter/URL/pagination utilities, and the paginated list service. Updated `src/features/milk/milk.queries.ts` to import directly from the feature modules. Retained the old lib path as a re-export facade for remaining consumers such as the customer detail view.
- Behavior preservation: kept the existing dayjs date calculations, business-date validation, URL serialization, query filters/order, server pagination and chunked summary fetch logic unchanged during extraction.
- Validation: static source extraction and GitHub writes only. Local typecheck/lint/format/build and milk create/edit/delete, customer summary and date-boundary regression checks remain unrun.


### Session log — 2026-10-16 (REF-013 milk entry schema ownership)

- Task ID: REF-013 / REF-010A
- Branch: `feature/feature-folder-structure-foundation`
- Status: In Progress (milk entry schema ownership migrated; validation pending)
- Changes: moved the milk-entry Zod schema and inferred form types into `src/features/milk/milk-entry.schema.ts`; new-entry form, milk query hooks and entries page now import from the feature. The old `src/lib/milk-entry-validation.ts` now only re-exports the canonical schema/types. PricingType imports the canonical `src/lib/milk-domain.ts` alias.
- Integrity boundary: validation rules and transform semantics were copied unchanged; no milk-sale or milk-pool transaction behavior intentionally changed.
- Validation: GitHub source updates only. Typecheck/lint/format/build and milk-entry create/edit/delete regression checks remain unrun.


### Session log — 2026-10-16 (cross-domain invalidation and REF-012 static pass)

- Branch: `feature/feature-folder-structure-foundation`.
- Customer create/profile update now invalidates milk customer/context queries; customer payment query key is centralized. Buffalo query keys were moved to a feature-owned key factory, and buffalo lifecycle mutations refresh diet-plan and expense roots.
- Buffalo acquisition-cost table reads and the existing atomic RPC write were moved behind the buffalo service and TanStack Query hooks. The UI keeps form state local; successful writes invalidate buffalo/acquisition-cost, expense and reporting dependents.
- Scheduler retry invalidation now includes consumption, stock, feed-cost, financial-report and dashboard roots. QueryProvider clears the cache when authenticated user identity changes.
- Static audit notes and validation checklist are in `docs/REFACTORING_REF009_REF012_IMPLEMENTATION_AUDIT.md` and `docs/QUERY_INVALIDATION_CONTRACT.md`.
- Status is not Completed: local typecheck/lint/format/build, browser workflows, account-switch testing, full compatibility-facade consumer search, and disposable Supabase RPC/RLS/concurrency/reconciliation tests remain unrun.


- REF-010A follow-up — 2026-10-16: removed duplicate expense `money` and current-date implementations by re-exporting `farm-format.money` and `date-input.todayDateKey`; milk date-key helpers now delegate to the canonical date-key module; buffalo purchase validation reuses the canonical buffalo payment-type formula. Static read-back only; full typecheck/lint/build and consumer graph verification remain pending.


## Pending follow-up queue — 2026-10-18

The user confirmed the application is working after merging the previous audit work. The items below remain open because source review and user smoke-testing do not replace compiler, automated, or database-level evidence. Keep existing REF-009 through REF-013 statuses unchanged until their recorded acceptance checks are met.

| ID | Priority | Task | Status | Depends on | Acceptance evidence |
|---|---|---|---|---|---|
| SEC-001 | P1 | Verify database security and financial/stock integrity in a disposable Supabase test environment | Pending | Access to local/disposable Supabase environment and current migrations | Test authenticated-user ownership isolation and RLS; verify locked/posted expense rows cannot bypass ledger protections through direct table writes; test payment concurrency and duplicate submissions; verify feed consumption/reversal stock reconciliation; verify scheduler posting is atomic and duplicate-safe. Record exact commands, fixtures and results. Never use production data or apply unapproved production migrations. |
| REF-014 | P1 | Complete duplicate helper/type compatibility-facade consumer audit | Pending | Latest master checkout; REF-013 current state | Search every consumer of legacy `src/lib/*` compatibility facades and duplicate helper/type candidates; classify each as active, re-export-only, or removable; remove only proven-unused duplicates; run typecheck, lint, format check and build. |
| REF-015 | P2 | Verify server-side reporting completeness and pagination limits | Pending | Local runtime and representative test data | Check customer-detail milk history (observed 500-row cap) and expense-dashboard outstanding rows (observed 500-row cap); determine whether caps can silently omit relevant data; replace with server-side pagination/aggregation if required and regression-test totals. |
| UI-001 | P2 | Audit and standardize human-readable date formatting across the application UI | Pending | Latest master; repository-wide UI/date-display scan | Find raw ISO dates/date ranges in tables, KPIs, analytics insights, chart tooltips, detail pages, filters and exports; use the canonical display formatter (e.g. `18 Oct 2026`), preserve date-only semantics/timezone safety, label comparison periods, and add regression coverage/checklist. Recheck touched screens and record all remaining violations. |
| REF-016 | P1 | Close REF-009/REF-012 with executable regression evidence | Blocked until SEC-001 and local checks are available | SEC-001, REF-014, REF-015 findings as applicable | Run typecheck, lint, format check, production build and available automated tests; regression-test milk entry create/update/delete and customer reassignment, buffalo production save → buffalo detail history refresh, expense create/payment → feed cost/inventory/report refresh, account switching/cache isolation, and feed/diet scheduler retries. Update REF-009/REF-012 status only from actual evidence. |

### Recommended execution order

5. **UI-001 — date formatting/readability audit.** Run the mandatory date-readability scan during every task; complete the repository-wide standardization as a tracked follow-up.

1. **SEC-001 — database security and financial/stock integrity tests.** Use only a disposable/local Supabase database; inspect current migration/test conventions first. If the environment is unavailable, document the exact blocker and prepare runnable tests without claiming execution.
2. **REF-014 — compatibility-facade and duplicate consumer audit.** Use a complete repository search and compiler evidence before removing any compatibility export.
3. **REF-015 — reporting limits and pagination.** Confirm whether the 500-row caps affect real results; preserve existing calculations and query semantics.
4. **REF-016 — final regression and closure.** Run the available local checks and module workflows, then update REF-009/REF-012 based on evidence.

### Session log — 2026-10-18 (pending queue recorded)

- Task: Record the remaining security, architecture and regression tasks after the user confirmed the merged application is working.
- Branch: `docs/pending-security-regression-queue`, created from the latest `master`.
- File changed: `docs/REFACTORING_TASKS.md`.
- Changes: added SEC-001 and REF-014 through REF-016, with priorities, dependencies, acceptance evidence, safe database-testing constraints and recommended order.
- Checks executed: fetched the tracker from the new branch and prepared a documentation-only update; no application code or database changed.
- Checks not run: application typecheck, lint, formatting, build, automated tests and Supabase/RLS/concurrency tests; this documentation-only operation does not execute them.
- Next task: SEC-001 — database security and financial/stock integrity tests in a disposable Supabase environment.
### Session log — 2026-10-18 (SEC-001 database security/integrity audit)

- **Task:** SEC-001 — database security and financial/inventory integrity tests.
- **Status:** In Progress / Blocked on execution environment; do not mark Completed.
- **Branch:** `feature/sec-001-database-integrity-audit`, created from exact `master` SHA `b318e2702838e93a74c566695c6ab63302cd1ab0`.
- **Artifacts added:** `supabase/tests/sec-001-database-integrity.sql`; `docs/SEC-001_DATABASE_SECURITY_AND_INTEGRITY_TESTS.md`.
- **Static findings:** Expense RLS is owner-scoped; expense payments are writable only through `record_expense_payment`, which locks the expense row and rejects overpayment; the ledger guard blocks direct `paid_amount` changes after dated payments. Active feed-purchase-linked expenses are protected by `expenses_guard_feed_purchase_link`; purchase create uses `feed_purchase_idempotency`, an owner/key primary key and transaction advisory lock; feed consumption locks feed items and appends reversal movements; scheduler uses unique occurrence identity, `FOR UPDATE SKIP LOCKED`, per-run exception handling and explicit FAILED-only retry.
- **Risks/gaps identified:** customer payment RPC `record_customer_payment` serializes on the customer row but has no request idempotency key, so a client timeout followed by user resubmission can create duplicate payments; do not add automatic retries. Expense direct edit/delete for non-feed-purchase expenses and paid-ledger bypass attempts still require runtime verification. Stock ledger reconciliation, reversal behavior, scheduler duplicate invocation/overlap and rollback-after-mid-run failure require real disposable DB tests.
- **Checks actually executed:** read GitHub master branch SHA, created fresh feature branch, read required docs and selected source migrations, read back the two added files. Static source review only.
- **Not executed:** psql/Supabase migrations, RLS assertions, SQL regression file, concurrent payment sessions, purchase idempotency replay, feed stock/reversal reconciliation, scheduler duplicate/concurrency/atomicity, npm install, typecheck, lint, formatting, build or browser smoke tests. The available GitHub connector provides source writes/reads but no local repository runtime or disposable Supabase DB session.
- **Safety:** no migration applied, no production DB connection/data changes, no business RPC contract changed, no automatic retries added, no PR or merge created.
- **Next step:** run the documented suite against a local/disposable Supabase instance; complete two-session race tests and fix/extend test fixture assumptions only on evidence. REF-014 (duplicate helper/type consumer audit) must wait until SEC-001 verification is complete.
