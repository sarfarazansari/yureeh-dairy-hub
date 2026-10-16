# Refactoring Task Tracker

Last reviewed: 2026-10-16
Repository: https://github.com/sarfarazansari/yureeh-dairy-hub
Base branch: `master`
Execution branch for this planning baseline: `feature/refactor-engineering-standards`

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
| REF-005 | P1 | Audit server-state fetching and effects; define migration pattern for ad hoc useEffect fetching | Pending | REF-003, REF-004 | Prioritized findings with regression considerations |
| REF-006 | P1 | Audit mutation invalidation, duplicate submission, errors, loading/empty states and pagination | Pending | REF-003, REF-004 | Per-module checklist and confirmed gaps |
| REF-007 | P1 | Audit finance, milk pool, feed inventory, purchase/payment and consumption transaction integrity | Pending | REF-002 | Trace from UI to service/RPC/migration/RLS/report consumers |
| REF-008 | P1 | Finalize refactor phases and acceptance criteria based on the full repository audit | Pending | REF-002–REF-007 | Ordered task list with dependencies, files and validation plan |
| REF-009 | P1 | Refactor shared query conventions and shared data-access foundations if needed | Pending | REF-008 | Tests/typecheck/lint and migration plan if applicable |
| REF-010 | P1 | Refactor first selected feature module end-to-end | Pending | REF-009 | No direct DB access in UI, standardized queries/services/schemas, regression checks |
| REF-011 | P2 | Refactor remaining modules one task per run, in dependency-aware order | Pending | REF-010 | Each module independently verified and tracker updated |
| REF-012 | P2 | Final architecture regression audit and remove obsolete duplicate patterns | Pending | REF-011 | Search-based audit and validation report |

## Source inventory pointer

The complete static API/query/effect/state inventory is in `docs/REFACTORING_API_INVENTORY.md`. REF-003 query/state findings are in `docs/REFACTORING_QUERY_STATE_AUDIT.md`; REF-004 module/dependency/type ownership findings are in `docs/REFACTORING_MODULE_BOUNDARIES_AUDIT.md`. The file list below remains a short orientation index, not the canonical exhaustive inventory. Do not infer that a file is absent merely because it is not listed here.

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
