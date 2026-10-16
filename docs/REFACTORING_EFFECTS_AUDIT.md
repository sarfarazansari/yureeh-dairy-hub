# Server-State Fetching and React Effects Audit

Task: `REF-005`  
Branch: `feature/refactor-engineering-standards`  
Base: `master` at `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9`  
Date: 2026-10-16  
Method: static GitHub source inventory and review of existing query/state and module-boundary audits. No local checkout/runtime was available.

## Executive summary

TanStack Query is installed and already used by buffaloes, buffalo production, customers, and milk. Adoption is inconsistent: dashboard, analytics, financial reports, expenses, and multiple feed pages fetch remote data in `useEffect` and duplicate server records, loading state, and errors in component state. These reads are good migration candidates, but effects must be classified by intent before changing them.

This task is an audit and migration design only. No source implementation files were changed. Migration execution remains gated on REF-006, REF-007, and REF-008, particularly transaction/ledger dependencies and cache invalidation requirements.

## 1. Effect classification

### A. Remote/server-state fetches — candidates for TanStack Query

The existing API inventory identified these source paths as loading remote data through effects or local fetch/loading state:

| Priority | Module / paths | Current pattern and recommendation | Risk / prerequisite |
|---|---|---|---|
| P1 | `src/features/dashboard.tsx`; `src/features/dashboard/services/dashboard.service.ts` | Dashboard RPC/table reads are fetched in an effect and copied into local data/loading state. Introduce a dashboard query hook backed by the existing service; key by every dashboard filter/date input. | Dashboard combines cross-domain summaries. Coordinate invalidation with REF-006/007. |
| P1 | `src/features/analytics/SalesAnalyticsPage.tsx`; `src/features/analytics/services/sales-analytics.service.ts` | Sales analytics service reads are loaded via an effect. Move result/loading/error ownership to a query; keep selected filters/date range local and include them in the key. | Preserve formulas and the report's current date-range semantics. |
| P1 | `src/features/buffalo-production/BuffaloAnalyticsPage.tsx`; `src/features/buffalo-production/services/buffalo-production.service.ts` | Production analytics is service-backed but effect-loaded. Use the production feature's query conventions rather than introducing another key owner. | Production → milk pool and buffalo-detail history dependencies need REF-006/007 review. |
| P1 | `src/app/(protected)/financial-reports/page.tsx` | Page calls financial summary RPCs in an effect. Extract a typed report service and query boundary; keep route composition thin. | High sensitivity: expenses, buffalo sale, customer receipts and feed-cost summaries must reconcile. Defer implementation until REF-007. |
| P1 | `src/app/(protected)/feeds/inventory/page.tsx`; `src/app/(protected)/feeds/inventory/services.ts` | Stock and movement reads are fetched separately with local loading/error/pagination state. Query keys should distinguish stock filters from movement filters/pages. | Inventory is ledger-derived; do not replace ledger calculations or change movement semantics. |
| P1 | `src/app/(protected)/feeds/consumption/page.tsx`; `src/app/(protected)/feeds/consumption/new/page.tsx`; `src/app/(protected)/feeds/consumption/edit/[id]/page.tsx`; `src/app/(protected)/feeds/consumption/services.ts` | List, feed items, stock and selected consumption are effect-loaded. Model each read as a query with dependent queries gated by `enabled`. | Consumption create/edit/delete and reversals are transactional; mutation retry and invalidation must be covered by REF-006/007. |
| P1 | `src/app/(protected)/feeds/purchases/page.tsx`; `src/app/(protected)/feeds/purchases/new/page.tsx`; `src/app/(protected)/feeds/purchases/edit/[id]/page.tsx`; `src/app/(protected)/feeds/purchases/services.ts` | Purchase lists/details and feed/vendor options are effect-loaded. Separate query ownership from form-local state. | Purchase ↔ expense/payment ↔ stock-in invariants and idempotency must be preserved. |
| P1 | `src/app/(protected)/feeds/diet-plans/page.tsx`; `src/app/(protected)/feeds/diet-plans/new/page.tsx`; `src/app/(protected)/feeds/diet-plans/edit/[id]/page.tsx`; `src/app/(protected)/feeds/diet-plans/services.ts` | Plan, feed, and date-dependent eligible-buffalo reads are effect-loaded. Use plan/detail/reference queries and dependent-query `enabled` conditions. | Scheduler snapshots, run status, failure handling, explicit retries and consumption integration are critical; inspect RPCs before migration. |
| P1 | `src/app/(protected)/feeds/diet-plans/schedule/page.tsx` | Schedule settings and feeding-run reads are mixed with direct RPC actions in the route. Extract read services/queries separately from mutation design. | Do not turn scheduler retry into automatic mutation retry or alter run/idempotency semantics. |
| P1 | `src/app/(protected)/expenses/page.tsx`; `src/app/(protected)/expenses/history/page.tsx`; `src/app/(protected)/expenses/history/[id]/page.tsx` | Expense list/history/detail and payment-related reads use effects/local state. Query keys need filters, pagination and entity IDs. | Expense soft deletion, payment totals/status, linked feed purchases and reports require REF-006/007. |
| P1 | `src/app/(protected)/expenses/new/page.tsx`; `src/app/(protected)/expenses/categories/page.tsx`; `src/app/(protected)/expenses/vendors/page.tsx`; `src/app/(protected)/expenses/vendors/[id]/page.tsx` | Lookup/master/directory reads are in routes. Move reads behind typed services and query hooks; leave form/dialog state local. | Preserve controlled categories, vendor ownership, and idempotent default-category seeding. |
| P2 | `src/app/(protected)/feeds/items/page.tsx` | Feed-item list/count and master reads/writes are in a route. First isolate service boundaries, then introduce query/mutation hooks. | Master changes affect purchases, diet plans, consumption and stock display; include dependent invalidation. |

These are candidates based on the inventory; exact dependencies and behavior must be re-read when each implementation task begins. This table does not claim every listed effect exclusively performs fetching.

### B. Existing query-backed features — fix key/invalidation ownership, not fetch effects

- `src/features/buffaloes/hooks/use-buffaloes.ts`
- `src/features/buffalo-production/buffalo-production.queries.ts`
- `src/features/customers/customer.queries.ts`
- `src/features/milk/milk.queries.ts`

Prefer extending these existing query boundaries over creating a parallel fetch layer. REF-003 already identified stale customer summaries after milk-entry mutations and duplicate production-history query-key ownership; resolve them through the REF-006 invalidation matrix rather than a broad cache reset.

`src/features/buffaloes/components/BuffaloAcquisitionCostPanel.tsx` is a separate boundary issue: it already uses TanStack Query locally but owns direct Supabase reads/RPC mutation and literal keys. Move data access behind the buffalo service/query layer only after REF-007 traces acquisition-cost and expense dependencies.

## 2. Effects to preserve unless direct inspection proves otherwise

| Path / effect purpose | Decision |
|---|---|
| `src/app/auth-gate.tsx` — session initialization and auth-state subscription | Keep as external-system synchronization. Review cleanup, stale session handling, and cache lifecycle separately; do not replace an auth subscription with a normal data query. |
| `src/components/layout/Sidebar.tsx` — responsive/navigation/auth UI state | Keep UI lifecycle behavior; inspect individual effects before any change. |
| `src/components/ui/TimedNotice.tsx`, `src/components/ui/Toast.tsx` — timers/callback lifecycle | Keep timer setup and cleanup. |
| `src/components/ui/date-range-picker.tsx` — imperative/date-picker synchronization | Keep synchronization where needed; do not create server queries for purely local date-picker state. |
| `src/app/(protected)/feeds/consumption/components/FeedConsumptionTable.tsx`, `src/app/(protected)/feeds/purchases/components/FeedPurchaseTable.tsx` — clamp local page to valid page count | Keep or replace with a render-safe derived-state approach only if behavior is proven equivalent; these are not remote fetches. |
| `src/app/(protected)/feeds/items/components/FeedItemEditDialog.tsx`, `src/app/(protected)/feeds/diet-plans/components/DietPlanForm.tsx`, `src/app/(protected)/feeds/purchases/components/FeedPurchaseForm.tsx` — dialog/form synchronization | Keep form/dialog-local synchronization. Re-check dependency arrays and reset behavior before edits. |
| `src/app/(protected)/buffalo-sales/page.tsx` — mixed query/refetch and effect/state logic | Unclassified until the exact effect is read in a future task. Do not remove it based only on its presence. |

General rule: an effect is not a defect by itself. Remove an effect only after identifying its side effect, cleanup, dependency contract, and equivalent replacement.

## 3. Safe migration pattern

Use this sequence for each module; do not migrate the whole repository in one pass.

1. **Trace first.** Read the route/component, service, query hooks, relevant migrations/RPCs/RLS, consumers, and reports. Record the current filters, sorting, pagination, empty behavior and business invariants.
2. **Service boundary.** Keep Supabase reads and RPC calls in a typed feature service. Avoid generic wrappers that only rename Supabase calls. Do not split an atomic transaction across client writes.
3. **Stable query keys.** Add a module-owned key factory. Include every result-changing input: record ID, date/date range, shift, search, status/filter, sort, page and page size. Keep key shapes deterministic and avoid sensitive data in keys.
4. **Query functions.** Query functions call the service and accept/pass an AbortSignal only where the Supabase/API call supports cancellation. Do not promise cancellation where the underlying request cannot be cancelled. Use `enabled` for dependent reads (for example, detail ID or date-dependent buffalo eligibility) rather than manually fetching in effects.
5. **Keep client state local.** Search text before debounce, selected tabs, open dialogs, unsaved form values, date-picker interaction state and table selection remain local. Query state owns remote records, loading/error status and server pagination results. Avoid mirroring query data into `useState`.
6. **Render explicit states.** Preserve separate initial loading, recoverable error/retry, empty result, and successful data states. For background refetch, avoid blanking usable stale data unless current behavior or correctness requires it.
7. **Mutation contract.** Use a query mutation only after mapping every affected key. Disable duplicate submit while pending; use database uniqueness/idempotency for high-risk operations. Do not enable blanket automatic retries for non-idempotent payment, expense, purchase, inventory, consumption or scheduler mutations.
8. **Auth lifecycle.** Verify how the QueryClient is scoped and what happens on sign-out/account switch. Ensure one user's cached farm data cannot remain visible to another session; clear/remove appropriately scoped cache on identity change after confirming app auth flow. This is a risk to validate, not a confirmed leak.
9. **Regression review.** Compare old/new filters, default date ranges, date-only timezone behavior, page reset/clamping, error messages, retries, sorting and navigation. Verify cross-module cache updates only after REF-006/007.
10. **Remove obsolete code.** After consumers use query state, remove only redundant fetch/loading/error state and the effect responsible for that fetch. Keep unrelated effects in the same component.

## 4. Recommended migration order

This is a dependency-aware order for later implementation, not permission to begin early:

1. **Query-backed domain consistency (after REF-006):** fix query-key ownership and missing invalidations in existing buffalo/customer/milk/production hooks. Small scope, but must use the completed invalidation matrix.
2. **Read-only analytics/dashboard queries:** sales analytics and production analytics first, then dashboard. These are read-models, but verify date/filter semantics and downstream invalidation.
3. **Feed inventory reads:** only after REF-007 defines stock ledger and cost/report invariants; split stock vs movement pagination keys.
4. **Expenses read paths:** after REF-007 defines expense/payment/feed-purchase cross-links and summary consumers.
5. **Feed purchases and consumption reads:** service/query migration separately from transaction writes; preserve request keys, reversal/delete semantics and no automatic retries.
6. **Diet plans and scheduler reads:** last among feed modules because date-dependent eligibility, run snapshots, explicit retries and consumption integration have wider operational consequences.
7. **Feed master and remaining route-level data access:** coordinate invalidation with purchases, plans and inventory.
8. **Auth/cache lifecycle hardening:** perform as a focused security regression task with account-switch tests; do not bury it inside an unrelated feature migration.

The final order may be adjusted by REF-007/REF-008 evidence. Do not start source implementation migrations until REF-005 through REF-008 are complete.

## 5. Acceptance checklist for every future migration

- [ ] Route remains thin and UI has no direct Supabase query/RPC call.
- [ ] Service input/output types and error handling are explicit.
- [ ] Query key includes all filters, date values, entity IDs and pagination inputs.
- [ ] Dependent queries use `enabled` and handle missing prerequisites.
- [ ] No server result is copied into local state as a second cache.
- [ ] Initial loading, error/retry, empty, success and background-refetch states remain correct.
- [ ] Local UI/form/date-picker state and legitimate effects are preserved.
- [ ] Pagination, filter changes, sorting and date-only/timezone behavior match current behavior.
- [ ] Mutations invalidate all dependent entity, list, inventory, finance, dashboard and analytics queries as applicable.
- [ ] Non-idempotent mutations have no unsafe automatic retry and have duplicate-submit protection.
- [ ] RPC atomicity, RLS, ledger reconciliation and historical records are unchanged.
- [ ] Relevant typecheck/build/lint/tests and manual regression scenarios are recorded honestly.

## Validation boundary

- Executed: read project rules, workflow handoff, architecture, task tracker, API inventory, query/state audit and module-boundary audit on `feature/refactor-engineering-standards`; compared the branch to `master` at `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9` (10 commits ahead, 0 behind before this task).
- Static review: effect classification and migration plan synthesized from the 141-file source scan and the existing path-level inventory. This is not a fresh line-by-line runtime verification of every effect.
- Not run: local build, lint, typecheck, tests, browser/account-switching checks, Supabase migrations, RLS checks or database operations. A local checkout was unavailable.
- No application source files or database objects were changed. No PR or merge was created.
